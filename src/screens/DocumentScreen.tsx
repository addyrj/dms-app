// src/screens/DocumentScreen.tsx
// FIXED: per-page duration persisted to AsyncStorage (2.2 override)
// When navigated from PlayerScreen, calls navigation.goBack() when done
// (PlayerScreen's 'focus' listener then calls advance())

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Image,
  StatusBar, ActivityIndicator, useWindowDimensions, Platform, NativeModules, PixelRatio,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useApp } from '../context/AppContext';

// FIX: was react-native-pdf, which wraps a third-party PDFium native
// library (io.legere.pdfiumandroid / libpdfium.so) with a confirmed,
// unpatched native crash (SIGSEGV — one page's close() racing another
// page's render() on shared FreeType state). Replaced with a custom native
// module (android/.../PdfPageModule.kt) built on Android's own PdfRenderer
// API — part of the OS itself, not a bundled third-party library — which
// renders each page to a plain image file instead.
const { PdfPageModule } = NativeModules;
let FileViewer: any = null;
try { FileViewer = require('react-native-file-viewer').default; } catch (_) {}
let RNFS: any = null;
try { RNFS = require('react-native-fs'); } catch (_) {}

import { TVFile, reportError, ENV } from '../services/api';

// FIX: isPdf now only matches actual PDFs. It previously included ppt/pptx,
// which were being handed straight to the PDFium-based <Pdf> renderer —
// PDFium cannot parse PPT/PPTX (they're a completely different file format,
// ZIP+XML vs PDF's own structure) and this was a plausible native crash
// trigger on some devices. ppt/pptx/doc/docx/xls/xlsx now fall through to
// the info-card branch below instead of ever reaching the PDF renderer.
const isPdf = (n: string) => ((n||'').split('.').pop()?.toLowerCase() || '') === 'pdf';
const isOfficeDoc = (n: string) => ['ppt','pptx','doc','docx','xls','xlsx'].includes((n||'').split('.').pop()?.toLowerCase() || '');
const DURATION_KEY = (fileName: string) => `doc_dur_${fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

const DOC_COLORS: Record<string, string> = {
  pdf:'#EF4444', ppt:'#F97316', pptx:'#F97316',
  doc:'#3B82F6', docx:'#3B82F6', xls:'#22C55E', xlsx:'#22C55E',
};
const getDocColor = (n: string) => DOC_COLORS[(n||'').split('.').pop()?.toLowerCase() || ''] || '#6B7280';

interface Props {
  navigation: any;
  route: { params: { file: TVFile; duration?: number; onFinish?: () => void } };
}

export default function DocumentScreen({ navigation, route }: Props) {
  const { file, duration: routeDuration } = route.params;
  const { tv } = useApp();
  // FIX: was `Dimensions.get('window')` read once at module load — if the
  // screen's actual orientation/size wasn't settled yet at that instant
  // (e.g. still portrait during startup, or a genuine rotation later), every
  // size calculation below stayed locked to that stale value for the rest of
  // the app's life. useWindowDimensions() stays live and updates on real
  // orientation/size changes instead.
  const { width: W, height: H } = useWindowDimensions();

  // FIX 2.2: load persisted per-page duration from AsyncStorage
  const serverDur   = routeDuration || (isPdf(file.file_name) ? ENV.PDF_DURATION : ENV.DOC_DURATION);
  const [customDur,     setCustomDur]     = useState(serverDur);
  const [loading,       setLoading]       = useState(true);
  const [loadingMsg,    setLoadingMsg]     = useState('Preparing document...');
  const [currentPage,   setCurrentPage]   = useState(1);
  const [totalPages,    setTotalPages]     = useState(1);
  const [showControls,  setShowControls]  = useState(true);
  const [timeLeft,      setTimeLeft]      = useState(0);
  const [showDurPicker, setShowDurPicker] = useState(false);
  const [localPath,     setLocalPath]     = useState<string | null>(null);
  const [pdfError,      setPdfError]      = useState(false);
  const [downloadPct,   setDownloadPct]   = useState(0);
  // Each page is fit + zoomed to the screen box using ITS OWN actual
  // dimensions natively (see PdfPageModule.kt) — not a size calibrated once
  // from a different page — so pageBoxW/H below are just whatever the
  // native render call reports back for the page currently on screen.
  const [pageImageUri,   setPageImageUri]   = useState<string | null>(null);
  const [pageBoxW,       setPageBoxW]       = useState<number | null>(null);
  const [pageBoxH,       setPageBoxH]       = useState<number | null>(null);

  const timerRef   = useRef<any>(null);
  const countRef   = useRef<any>(null);
  const controlRef = useRef<any>(null);

  // Short cooldown on manual Prev/Next taps purely to stop a double-tap
  // from firing two overlapping page-render calls — not a crash-safety
  // measure (PdfPageModule doesn't share the old library's race condition).
  const pageNavLockRef = useRef(false);
  const changePage = (next: number) => {
    if (pageNavLockRef.current) return;
    pageNavLockRef.current = true;
    setTimeout(() => { pageNavLockRef.current = false; }, 400);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countRef.current) clearInterval(countRef.current);
    if (next > totalPages) { goBack(); return; }
    setCurrentPage(Math.max(1, next));
  };

  // Load saved duration override
  useEffect(() => {
    AsyncStorage.getItem(DURATION_KEY(file.file_name)).then(saved => {
      if (saved) setCustomDur(Number(saved));
    }).catch(() => {});
  }, [file.file_name]);

  const color  = getDocColor(file.file_name);
  const ext    = (file.file_name.split('.').pop() || 'DOC').toUpperCase();
  // FIX: doc_duration_seconds IS per-page already — do NOT divide by totalPages
  const pageDur = customDur;

  const goBack = () => {
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (countRef.current)  clearInterval(countRef.current);
    try {
      if (navigation.canGoBack()) navigation.goBack();
      else navigation.navigate('Dashboard');
    } catch (_) { navigation.navigate('Dashboard'); }
  };

  const startTimer = (dur: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countRef.current) clearInterval(countRef.current);
    setTimeLeft(dur);
    countRef.current = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    timerRef.current = setTimeout(goBack, dur * 1000);
  };

  const startPageTimer = (dur: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (countRef.current) clearInterval(countRef.current);
    setTimeLeft(dur);
    countRef.current = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000);
    timerRef.current = setTimeout(() => {
      if (countRef.current) clearInterval(countRef.current);
      if (currentPage >= totalPages) goBack();
      else setCurrentPage(p => p + 1);
    }, dur * 1000);
  };

  useEffect(() => {
    controlRef.current = setTimeout(() => setShowControls(false), 5000);
    return () => { if (controlRef.current) clearTimeout(controlRef.current); };
  }, []);

  useEffect(() => () => {
    if (timerRef.current)   clearTimeout(timerRef.current);
    if (countRef.current)   clearInterval(countRef.current);
    if (controlRef.current) clearTimeout(controlRef.current);
  }, []);

  useEffect(() => { prepareDocument(); }, []);

  const prepareDocument = async () => {
    setLoading(true);
    if (file.local_path) {
      const exists = RNFS ? await RNFS.exists(file.local_path) : false;
      if (exists) { await openFile(file.local_path); return; }
    }
    if (!RNFS) {
      setLoadingMsg('Cannot download — no file library');
      setLoading(false);
      startTimer(customDur);
      return;
    }
    try {
      setLoadingMsg('Downloading...');
      const dir = `${RNFS.DocumentDirectoryPath}/dms_docs`;
      if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);
      const safeName = file.file_name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const destPath = `${dir}/${file.id}_${safeName}`;
      const alreadyExists = await RNFS.exists(destPath);
      if (!alreadyExists) {
        await RNFS.downloadFile({
          fromUrl: file.file_url, toFile: destPath,
          progress: (p: any) => {
            const pct = Math.round((p.bytesWritten / p.contentLength) * 100);
            setDownloadPct(pct); setLoadingMsg(`Downloading... ${pct}%`);
          },
        }).promise;
      }
      await openFile(destPath);
    } catch (e) {
      setLoadingMsg('Download failed');
      setLoading(false);
      startTimer(customDur);
    }
  };

  const openFile = async (path: string) => {
    if (isPdf(file.file_name)) {
      setLocalPath(path);
      setLoading(false);
    } else {
      setLoading(false);
      startTimer(customDur);
      if (FileViewer) {
        try { await FileViewer.open(path, { showOpenWithDialog: false }); } catch {}
      }
    }
  };

  // PDF page timer
  useEffect(() => {
    if (!isPdf(file.file_name) || loading || pdfError || !localPath) return;
    startPageTimer(pageDur);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (countRef.current) clearInterval(countRef.current);
    };
  }, [currentPage, loading, totalPages, pdfError, localPath, pageDur]);

  // Opens the PDF once via PdfPageModule and reads its page count.
  useEffect(() => {
    if (!isPdf(file.file_name) || !localPath || !PdfPageModule) return;
    let cancelled = false;
    (async () => {
      try {
        const info = await PdfPageModule.openDocument(localPath);
        if (cancelled) return;
        setTotalPages(info.pageCount || 1);
      } catch (e) {
        if (cancelled) return;
        setPdfError(true);
        try {
          const reason = (e as any)?.message || String(e);
          if (tv) reportError({ tv_id:tv.tv_id, db_name:tv.db_name, error_type:'pdf_render', error_message:`PDF open failed: ${file.file_name} — ${reason}` }).catch(()=>{});
        } catch(_) {}
        setTimeout(() => goBack(), 3000);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localPath]);

  // Renders the current page to an image file, fit + zoomed to the screen
  // box using THIS page's own real dimensions (computed natively — see
  // PdfPageModule.kt). Zoom trims blank page margins on all 4 edges evenly;
  // 14% per request — 12% was crop-free, 15% just started clipping the top
  // of tight-margin pages (e.g. page 2 of the Hardware JD doc), so 14% is
  // being tried as the middle ground. Still a guess about how much margin a
  // given page actually has, so it needs checking across real documents.
  // Re-fires on page change and on W/H themselves changing (e.g. a real
  // screen rotation/resize after a page was already rendered).
  const PDF_ZOOM = 1.14;
  useEffect(() => {
    if (!isPdf(file.file_name) || !localPath || !PdfPageModule || pdfError) return;
    let cancelled = false;
    (async () => {
      try {
        // W/H from useWindowDimensions() are density-independent px — the
        // bitmap needs to be rendered at the screen's real (physical) pixel
        // count or it comes out visibly blurry once stretched to fill that
        // many dp on any screen with pixel density > 1. Render at physical
        // pixels, then convert the returned size back to dp for layout.
        const ratio = PixelRatio.get();
        const res = await PdfPageModule.renderPage(localPath, currentPage - 1, W * ratio, H * ratio, PDF_ZOOM);
        if (!cancelled) {
          setPageImageUri(res.uri);
          setPageBoxW(res.width / ratio);
          setPageBoxH(res.height / ratio);
        }
      } catch (e) {
        if (cancelled) return;
        setPdfError(true);
        try {
          const reason = (e as any)?.message || String(e);
          if (tv) reportError({ tv_id:tv.tv_id, db_name:tv.db_name, error_type:'pdf_render', error_message:`PDF page render failed: ${file.file_name} p${currentPage} — ${reason}` }).catch(()=>{});
        } catch(_) {}
        setTimeout(() => goBack(), 3000);
      }
    })();
    return () => { cancelled = true; };
  }, [currentPage, localPath, pdfError, W, H]);

  // Release the native renderer/file handle when leaving this document.
  useEffect(() => () => {
    if (PdfPageModule && isPdf(file.file_name)) {
      try { PdfPageModule.closeDocument(); } catch (_) {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTap = () => {
    setShowControls(true);
    if (controlRef.current) clearTimeout(controlRef.current);
    controlRef.current = setTimeout(() => setShowControls(false), 5000);
  };

  // FIX 2.2: save duration override to AsyncStorage
  const applyDuration = (sec: number) => {
    setCustomDur(sec);
    setShowDurPicker(false);
    startTimer(sec);
    AsyncStorage.setItem(DURATION_KEY(file.file_name), String(sec)).catch(() => {});
  };

  const progressPct = Math.round(
    (timeLeft / Math.max(1, isPdf(file.file_name) ? pageDur : customDur)) * 100
  );
  const durOptions = [15, 30, 50, 60, 90, 120, 180, 300];

  const renderContent = () => {
    if (isPdf(file.file_name) && localPath && PdfPageModule && !pdfError) {
      // The image is already rendered natively at the correct fit+zoom size
      // for THIS page (see the renderPage effect above and PdfPageModule.kt)
      // — no further sizing math needed here. The wrapper is a fixed
      // W x H box with overflow hidden, so the (slightly-larger-than-box,
      // by PDF_ZOOM) centered image gets cropped evenly on all 4 edges.
      return (
        <View style={[s.pdfStretchWrap, { width: W, height: H }]}>
          {pageImageUri && pageBoxW && pageBoxH ? (
            <Image
              source={{ uri: `file://${pageImageUri}` }}
              style={{ width: pageBoxW, height: pageBoxH }}
            />
          ) : (
            <ActivityIndicator size="large" color={color}/>
          )}
        </View>
      );
    }
    return (
      <View style={s.infoCard}>
        <Text style={[s.infoIcon, { color }]}>
          {ext === 'PDF' ? '📄' : ['PPT','PPTX'].includes(ext) ? '📊' : ['DOC','DOCX'].includes(ext) ? '📝' : '📗'}
        </Text>
        <Text style={s.infoName}>{file.file_name}</Text>
        <View style={[s.extPill, { backgroundColor: color }]}>
          <Text style={s.extPillTxt}>{ext}</Text>
        </View>
        <Text style={s.infoSub}>
          {pdfError ? 'PDF render failed — skipping in 3s...'
           : !PdfPageModule && isPdf(file.file_name) ? 'PDF renderer not available'
           : isOfficeDoc(file.file_name) ? 'Not supported on this display — convert to PDF to show it here'
           : 'Opened in external viewer'}
        </Text>
        <Text style={s.countdown}>{timeLeft}s</Text>
      </View>
    );
  };

  return (
    <View style={s.container}>
      <StatusBar hidden/>
      <TouchableOpacity style={s.content} onPress={handleTap} activeOpacity={1}>
        {renderContent()}
      </TouchableOpacity>

      {loading && (
        <View style={s.loadOverlay}>
          <ActivityIndicator size="large" color={color}/>
          <Text style={s.loadTxt}>{loadingMsg}</Text>
          {downloadPct > 0 && downloadPct < 100 && (
            <View style={s.progTrack}>
              <View style={[s.progBar, { width:`${downloadPct}%` as any, backgroundColor: color }]}/>
            </View>
          )}
        </View>
      )}

      {showControls && !loading && (
        <View style={s.controls}>
          <View style={s.topBar}>
            <TouchableOpacity style={s.closeBtn} onPress={goBack}>
              <Text style={s.closeBtnTxt}>✕</Text>
            </TouchableOpacity>
            <View style={s.titleBox}>
              <Text style={s.titleTxt} numberOfLines={1}>{file.file_name}</Text>
              <Text style={s.pageTxt}>
                {isPdf(file.file_name) && totalPages > 1
                  ? `Page ${currentPage}/${totalPages} · ${pageDur}s each · ${timeLeft}s left`
                  : `${ext} · ${timeLeft}s left`}
              </Text>
            </View>
            <View style={[s.extBadge, { backgroundColor: color }]}>
              <Text style={s.extBadgeTxt}>{ext}</Text>
            </View>
          </View>

          <View style={s.timerBar}>
            <View style={[s.timerFill, { backgroundColor: color, width: `${progressPct}%` as any }]}/>
          </View>

          <View style={s.bottomNav}>
            {isPdf(file.file_name) && totalPages > 1 ? (
              <>
                <TouchableOpacity style={s.navBtn}
                  onPress={() => changePage(currentPage - 1)}>
                  <Text style={s.navBtnTxt}>◀ Prev</Text>
                </TouchableOpacity>
                <View style={s.dotsRow}>
                  {Array.from({ length: Math.min(totalPages, 10) }).map((_, i) => (
                    <View key={i} style={[s.dot, i + 1 === currentPage && s.dotActive]}/>
                  ))}
                  {totalPages > 10 && <Text style={s.moreTxt}>+{totalPages - 10}</Text>}
                </View>
                <TouchableOpacity style={[s.navBtn, { backgroundColor: color, borderColor: color }]}
                  onPress={() => changePage(currentPage + 1)}>
                  <Text style={[s.navBtnTxt, { color:'#fff' }]}>{currentPage >= totalPages ? 'Done ✓' : 'Next ▶'}</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={[s.navBtn, { backgroundColor: color, borderColor: color, flex:1 }]} onPress={goBack}>
                <Text style={[s.navBtnTxt, { color:'#fff' }]}>✓ Done</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.durBtn} onPress={() => setShowDurPicker(v => !v)}>
              <Text style={s.durBtnTxt}>⏱ {customDur}s/pg {customDur !== serverDur ? '✏️' : ''}</Text>
            </TouchableOpacity>
          </View>

          {showDurPicker && (
            <View style={s.durPicker}>
              <Text style={s.durPickerTitle}>Set Per-Page Duration (saved on device)</Text>
              <View style={s.durOptions}>
                {durOptions.map(sec => (
                  <TouchableOpacity key={sec}
                    style={[s.durOption, customDur === sec && s.durOptionActive]}
                    onPress={() => applyDuration(sec)}>
                    <Text style={[s.durOptionTxt, customDur === sec && { color:'#fff' }]}>
                      {sec >= 60 ? `${sec/60}m` : `${sec}s`}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {customDur !== serverDur && (
                <TouchableOpacity onPress={() => applyDuration(serverDur)} style={{ marginTop:10 }}>
                  <Text style={{ color:'rgba(255,255,255,0.5)', fontSize:12, textAlign:'center' }}>
                    Reset to server default ({serverDur}s)
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex:1, backgroundColor:'#111' },
  content:      { flex:1 },
  pdfStretchWrap: { alignItems:'center', justifyContent:'center', overflow:'hidden' },
  infoCard:     { flex:1, alignItems:'center', justifyContent:'center', padding:32 },
  infoIcon:     { fontSize:80, marginBottom:16 },
  infoName:     { fontSize:16, fontWeight:'700', color:'#fff', textAlign:'center', marginBottom:12 },
  extPill:      { paddingHorizontal:16, paddingVertical:6, borderRadius:8, marginBottom:12 },
  extPillTxt:   { color:'#fff', fontSize:14, fontWeight:'800' },
  infoSub:      { fontSize:13, color:'#9CA3AF', textAlign:'center', marginBottom:20 },
  countdown:    { fontSize:48, fontWeight:'800', color:'#fff' },
  loadOverlay:  { position:'absolute', top:0,left:0,right:0,bottom:0, alignItems:'center', justifyContent:'center', backgroundColor:'rgba(0,0,0,0.85)' },
  loadTxt:      { marginTop:12, fontSize:14, color:'#fff', fontWeight:'600' },
  progTrack:    { width:200, height:6, backgroundColor:'#333', borderRadius:3, marginTop:12, overflow:'hidden' },
  progBar:      { height:6, borderRadius:3 },
  controls:     { position:'absolute', top:0,left:0,right:0,bottom:0, justifyContent:'space-between' },
  topBar:       { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(0,0,0,0.75)', paddingHorizontal:16, paddingTop: Platform.OS==='android'?44:52, paddingBottom:12 },
  closeBtn:     { width:36, height:36, backgroundColor:'rgba(255,255,255,0.15)', borderRadius:18, alignItems:'center', justifyContent:'center', marginRight:10 },
  closeBtnTxt:  { fontSize:16, color:'#fff', fontWeight:'700' },
  titleBox:     { flex:1 },
  titleTxt:     { fontSize:14, fontWeight:'700', color:'#fff', marginBottom:2 },
  pageTxt:      { fontSize:11, color:'rgba(255,255,255,0.6)' },
  extBadge:     { paddingHorizontal:10, paddingVertical:5, borderRadius:8 },
  extBadgeTxt:  { color:'#fff', fontSize:12, fontWeight:'800' },
  timerBar:     { height:3, backgroundColor:'rgba(255,255,255,0.2)', width:'100%' },
  timerFill:    { height:3 },
  bottomNav:    { flexDirection:'row', alignItems:'center', backgroundColor:'rgba(0,0,0,0.75)', paddingHorizontal:16, paddingVertical:12, gap:8 },
  navBtn:       { paddingHorizontal:16, paddingVertical:10, borderRadius:10, backgroundColor:'rgba(255,255,255,0.15)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)' },
  navBtnTxt:    { fontSize:13, fontWeight:'700', color:'#fff' },
  dotsRow:      { flex:1, flexDirection:'row', justifyContent:'center', flexWrap:'wrap', alignItems:'center' },
  dot:          { width:7, height:7, borderRadius:4, backgroundColor:'rgba(255,255,255,0.3)', marginHorizontal:2 },
  dotActive:    { backgroundColor:'#0ABCAA', width:18 },
  moreTxt:      { fontSize:11, color:'rgba(255,255,255,0.6)', fontWeight:'600' },
  durBtn:       { paddingHorizontal:12, paddingVertical:10, borderRadius:10, backgroundColor:'rgba(255,255,255,0.1)', borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  durBtnTxt:    { fontSize:12, fontWeight:'700', color:'#fff' },
  durPicker:    { position:'absolute', bottom:70, right:16, left:16, backgroundColor:'#1a1a2e', borderRadius:16, padding:16, borderWidth:1, borderColor:'rgba(255,255,255,0.1)', shadowColor:'#000', shadowOffset:{width:0,height:4}, shadowOpacity:0.5, shadowRadius:12, elevation:8 },
  durPickerTitle:{ fontSize:13, fontWeight:'700', color:'#fff', marginBottom:12 },
  durOptions:   { flexDirection:'row', flexWrap:'wrap', gap:8 },
  durOption:    { paddingHorizontal:14, paddingVertical:8, borderRadius:8, backgroundColor:'rgba(255,255,255,0.1)', borderWidth:1, borderColor:'rgba(255,255,255,0.2)' },
  durOptionActive:{ backgroundColor:'#16A34A', borderColor:'#16A34A' },
  durOptionTxt: { fontSize:13, fontWeight:'600', color:'#fff' },
});