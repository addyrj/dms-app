// src/screens/PlayerScreen.tsx
// Sidebar = exact same as DashboardScreen (logo + TvNamePill + nav items)
// Opens on tap anywhere on screen, slides from left, closes on overlay tap
// ADDED: Announcement ticker (MQTT real-time + 60s HTTP poll fallback)
// ADDED: DocLauncher - automatically opens documents in loop

import React, {
  useEffect, useState, useRef, useCallback, useMemo,
} from 'react';

import {
  View, Image, Text, StyleSheet, Dimensions,
  TouchableOpacity, StatusBar, ActivityIndicator,
  Animated, ScrollView, Platform, Modal, AppState,
} from 'react-native';

import { useIsFocused } from '@react-navigation/native';
import { useNavigation } from '@react-navigation/native';
import { useApp }      from '../context/AppContext';
import { MqttService } from '../services/MqttService';
import { TVFile, getTvAnnouncements, reportError } from '../services/api';
import { getPlayUrl }  from '../services/StorageService';

const { width: W, height: H } = Dimensions.get('window');
const SIDEBAR_W = 230;

let Video: any = null;
try { Video = require('react-native-video').default; } catch (_) {}

const _ext      = (n: string) => n.split('.').pop()?.toLowerCase() || '';
const _isVideo  = (n: string) => ['mp4','mov','avi','webm','mkv'].includes(_ext(n));
const _isImage  = (n: string) => ['jpg','jpeg','png','webp','gif','bmp'].includes(_ext(n));
const _isMedia  = (n: string) => _isVideo(n) || _isImage(n);
const _hasAlpha = (n: string) => ['png','webp','gif'].includes(_ext(n));
const _isDoc    = (n: string) =>
  ['pdf','ppt','pptx','doc','docx','xls','xlsx'].includes(_ext(n));

const DOC_ICONS: Record<string,string> = {
  pdf:'📄', ppt:'📊', pptx:'📊', doc:'📝', docx:'📝', xls:'📗', xlsx:'📗',
};
const docIcon = (n: string) => DOC_ICONS[_ext(n)] || '📎';

const DOC_COLORS: Record<string,string> = {
  pdf:'#EF4444', ppt:'#F97316', pptx:'#F97316',
  doc:'#3B82F6', docx:'#3B82F6', xls:'#22C55E', xlsx:'#22C55E',
};
const getDocColor = (n: string) => DOC_COLORS[_ext(n)] || '#6B7280';

// ── Announcement constants ────────────────────────────────────
const ANNOUNCEMENT_BG: Record<string, string> = {
  'good-news': '#16A34A',
  'alert':     '#DC2626',
  'info':      '#2563EB',
};
const ANNOUNCEMENT_LABEL: Record<string, string> = {
  'good-news': '🟢 GOOD NEWS',
  'alert':     '🔴 ALERT',
  'info':      '🔵 INFO',
};

// Nav items — same as Dashboard
const NAV = [
  { id:'home',    icon:'🏠', label:'Home' },
  { id:'docs',    icon:'▶',  label:'Play Docs' },
  { id:'library', icon:'🗂', label:'Media Library' },
  { id:'sync',    icon:'↺',  label:'Sync Content' },
  { id:'signout', icon:'⬢',  label:'Sign Out', danger: true },
];

// ── Ticker ────────────────────────────────────────────────────
// TV news-style seamless ticker:
// ✅ Full message (no word limit)
// ✅ No blank gap — 2 copies side by side, animates by exactly 1 copy width
// ✅ Constant speed (80px/sec) for all message lengths
// ✅ Single line, no wrapping

const TICKER_H   = 50;   // bar height
const PX_PER_SEC = 80;   // constant scroll speed (pixels per second)

const Ticker: React.FC<{ ann: any; onExpire: () => void }> = ({ ann, onExpire }) => {
  const x      = useRef(new Animated.Value(0)).current;
  const anim   = useRef<Animated.CompositeAnimation | null>(null);
  const [textW, setTextW] = useState(0);

  const bg  = ANNOUNCEMENT_BG[ann.type]    || '#2563EB';
  const lbl = ANNOUNCEMENT_LABEL[ann.type] || 'INFO';

  // FIX 1: Show FULL message — no word limit
  const msg = (ann.message || '').trim();

  // FIX 3: Constant speed — calculate duration from actual text width
  useEffect(() => {
    if (textW <= 0) return;

    // Animate exactly one copy width → seamless loop (no visible gap)
    const duration = (textW / PX_PER_SEC) * 1000;

    anim.current?.stop();
    x.setValue(0);

    // FIX 2: Loop by exactly textW pixels — second copy fills the gap perfectly
    anim.current = Animated.loop(
      Animated.timing(x, {
        toValue:         -textW,
        duration,
        useNativeDriver: true,
        easing:          (t) => t,  // linear — constant speed
      })
    );
    anim.current.start();

    return () => { anim.current?.stop(); };
  }, [textW, msg]);

  // Auto-hide when duration_minutes expires
  useEffect(() => {
    // Force UTC parsing — add Z suffix if missing (MySQL stores UTC without Z)
    const rawExpiry = ann.expires_at || '';
    const utcStr    = rawExpiry.endsWith('Z') ? rawExpiry : rawExpiry.replace(' ', 'T') + 'Z';
    const expiresAt = new Date(utcStr).getTime();
    const msLeft    = expiresAt - Date.now();
    console.log('[Ticker] expires_at:', rawExpiry, '| msLeft:', Math.round(msLeft/1000), 's');
    if (msLeft <= 0) { onExpire(); return; }
    const timer = setTimeout(() => onExpire(), msLeft);
    return () => clearTimeout(timer);
  }, [ann.expires_at]);

  return (
    <View style={[tick.bar, { backgroundColor: bg }]}>
      {/* Type badge */}
      <View style={tick.badge}>
        <Text style={tick.badgeTxt} numberOfLines={1}>{lbl}</Text>
      </View>

      {/* Scrolling area — overflow:hidden clips content */}
      <View style={tick.track}>
        <Animated.View
          style={[tick.row, { transform: [{ translateX: x }] }]}>
          {/* FIX 2: Two identical copies — when first exits left, second is already entering */}
          <Text
            numberOfLines={1}
            style={tick.text}
            onLayout={e => {
              const w = e.nativeEvent.layout.width;
              if (w > 0 && w !== textW) setTextW(w);
            }}>
            {msg}{'     '}
          </Text>
          <Text numberOfLines={1} style={tick.text}>
            {msg}{'     '}
          </Text>
        </Animated.View>
      </View>
    </View>
  );
};

const tick = StyleSheet.create({
  bar:      {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: TICKER_H, flexDirection: 'row', alignItems: 'center', zIndex: 100,
  },
  badge:    {
    height: TICKER_H, paddingHorizontal: 10,
    backgroundColor: 'rgba(0,0,0,0.28)',
    justifyContent: 'center', alignItems: 'center',
    minWidth: 80,
  },
  badgeTxt: { color: '#fff', fontSize: 20, fontWeight: '800', letterSpacing: 0.8 },
  track:    {
    flex: 1, height: TICKER_H,
    justifyContent: 'center',
    overflow: 'hidden',   // clips the Animated.View children
  },
  row:      {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text:     {
    color: '#fff', fontSize: 20, fontWeight: '800',
    paddingHorizontal: 6,
    includeFontPadding: false,
    textAlignVertical: 'center',
    // FIX 4: slightly less than TICKER_H to avoid clipping descenders
    height: TICKER_H - 6,
    lineHeight: TICKER_H - 6,
  },
});

// ── TvNamePill — green=live, red=offline ──────────────────────
const TvNamePill: React.FC<{ name: string; connected: boolean }> = ({ name, connected }) => (
  <View style={[pill.wrap, connected ? pill.live : pill.offline]}>
    <View style={pill.dot}/>
    <Text style={pill.txt} numberOfLines={1}>{name}</Text>
  </View>
);
const pill = StyleSheet.create({
  wrap:    { flexDirection:'row', alignItems:'center',
             paddingHorizontal:12, paddingVertical:6,
             borderRadius:20, maxWidth:180 },
  live:    { backgroundColor:'#16A34A' },
  offline: { backgroundColor:'#DC2626' },
  dot:     { width:7, height:7, borderRadius:4,
             backgroundColor:'rgba(255,255,255,0.8)', marginRight:7 },
  txt:     { color:'#fff', fontSize:12, fontWeight:'800' },
});

// ── DownloadIndicator ─────────────────────────────────────────
// Shows file-by-file download progress with % bar
// User knows something big is coming and can wait
const DownloadIndicator: React.FC<{
  fileIndex: number; filePct: number; total: number;
}> = ({ fileIndex, filePct, total }) => {
  const pct  = Math.max(0, Math.min(100, Math.round(filePct)));
  const done = fileIndex + 1;

  // Progress bar color: green when almost done, blue otherwise
  const barColor = pct > 80 ? '#22C55E' : '#60A5FA';

  return (
    <View style={s.dlWrap} pointerEvents="none">
      {/* Left: animated download icon */}
      <View style={s.dlIconWrap}>
        <Text style={s.dlIcon}>⬇</Text>
      </View>

      {/* Center: labels + progress bar */}
      <View style={s.dlBody}>
        {/* Top row: file count + percentage */}
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <Text style={s.dlLabel}>
            Downloading file {done} of {total}
          </Text>
          <Text style={[s.dlLabel, { fontWeight:'800', color: barColor }]}>
            {pct}%
          </Text>
        </View>

        {/* Progress bar */}
        <View style={s.dlTrack}>
          <View style={[s.dlFill, { width: `${pct}%` as any, backgroundColor: barColor }]}/>
        </View>

        {/* Bottom hint */}
        <Text style={s.dlHint}>
          {pct < 10
            ? 'Starting download… please wait'
            : pct < 50
            ? 'Downloading content to TV…'
            : pct < 90
            ? 'Almost there, please wait…'
            : 'Finishing up…'}
        </Text>
      </View>
    </View>
  );
};

// ── NoContentScreen ───────────────────────────────────────────
const NoContentScreen: React.FC<{
  isSyncing: boolean; onBack: () => void;
  mqttConnected: boolean; tvName: string;
  pendingFiles: TVFile[] | null; consumePending: () => void;
  onOpenSidebar?: () => void;
  volume?: number; tvId?: string | number;
  downloadProgress?: { fileIndex:number; filePct:number; total:number } | null;
}> = ({ isSyncing, onBack, mqttConnected, tvName, pendingFiles, consumePending, onOpenSidebar, volume, tvId, downloadProgress }) => {
  useEffect(() => {
    if (pendingFiles && pendingFiles.length > 0) consumePending();
  }, [pendingFiles]);

  return (
    <View style={s.noContent}>
      <StatusBar hidden/>
      {!!tvName && <TvNamePill name={tvName} connected={mqttConnected}/>}
      <Image source={require('../assets/logo.png')} style={s.noContentLogo} resizeMode="contain"/>
      {/* Upload icon */}
      <View style={s.uploadWrap}>
        <View style={s.arrowHead}/>
        <View style={s.arrowShaft}/>
        <View style={s.folderBody}><View style={s.folderTab}/></View>
      </View>
      <Text style={s.noContentMsg}>Please Upload the Content</Text>
      {isSyncing ? (
        <View style={{ width:'100%', maxWidth:420, marginBottom:20 }}>
          {downloadProgress ? (
            <>
              <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:6 }}>
                <Text style={{ color:'#1B7FD4', fontSize:14, fontWeight:'700' }}>
                  Downloading file {downloadProgress.fileIndex + 1} of {downloadProgress.total}
                </Text>
                <Text style={{ color: downloadProgress.filePct > 80 ? '#16A34A' : '#1B7FD4', fontSize:14, fontWeight:'800' }}>
                  {Math.round(downloadProgress.filePct)}%
                </Text>
              </View>
              <View style={{ height:8, backgroundColor:'#E5E7EB', borderRadius:4, overflow:'hidden' }}>
                <View style={{
                  height:8, borderRadius:4,
                  width: `${Math.max(2, Math.round(downloadProgress.filePct))}%`,
                  backgroundColor: downloadProgress.filePct > 80 ? '#16A34A' : '#1B7FD4',
                }}/>
              </View>
              <Text style={{ color:'#6B7280', fontSize:12, marginTop:8, textAlign:'center' }}>
                {downloadProgress.filePct < 10  ? 'Starting download… please wait'
                 : downloadProgress.filePct < 50 ? 'Downloading content to TV…'
                 : downloadProgress.filePct < 90 ? 'Almost there, please wait…'
                 : 'Finishing up…'}
              </Text>
            </>
          ) : (
            <View style={s.noContentSyncRow}>
              <ActivityIndicator color="#0ABCAA" size="small" style={{ marginRight:8 }}/>
              <Text style={s.noContentSyncTxt}>Checking for content…</Text>
            </View>
          )}
        </View>
      ) : (
        <Text style={s.noContentSub}>Publish media from the admin panel to start playing.</Text>
      )}
      <TouchableOpacity style={s.noContentBack} onPress={onBack}
        isTVSelectable={true} focusable={true}>
        <Text style={s.noContentBackTxt}>↺ Sync Content</Text>
      </TouchableOpacity>
    </View>
  );
};

// ── DocLauncher: Auto opens DocumentScreen when current file is a document ───────
function DocLauncher({
  file,
  onFinish,
  onLoad,
}: {
  file: any;
  onFinish: () => void;
  onLoad: () => void;
}) {
  const nav = useNavigation<any>();

  // FIX 4: Keep screen awake — prevent Android TV from sleeping
  useEffect(() => {
    // Fire a harmless state touch every 55 seconds to keep screen active
    const wakeInterval = setInterval(() => {
      // Accessing AppState keeps the JS bridge active, preventing sleep
      const _ = AppState.currentState;
    }, 55000);
    return () => clearInterval(wakeInterval);
  }, []);
  const launched = useRef(false);

  useEffect(() => {
    if (!file) return;
    if (launched.current) return;

    launched.current = true;
    onLoad();

    const timer = setTimeout(() => {
      nav.navigate('Document', {
        file,
        duration: file.doc_duration_seconds || file.duration || 50,
      });
    }, 300);

    const unsubscribe = nav.addListener('focus', () => {
      if (launched.current) {
        launched.current = false;
        onFinish();
      }
    });

    return () => {
      clearTimeout(timer);
      unsubscribe();
    };
  }, [file]);

  return null;
}

// ══════════════════════════════════════════════════════════════
// Doc Modal (same style as Dashboard)
// ══════════════════════════════════════════════════════════════
const DocModal: React.FC<{
  visible: boolean;
  docFiles: TVFile[];
  onClose: () => void;
  onOpen: (f: TVFile) => void;
}> = ({ visible, docFiles, onClose, onOpen }) => (
  <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
      <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
        <View style={s.sheetHeader}>
          <View>
            <Text style={s.sheetTitle}>📄 Documents</Text>
            <Text style={s.sheetSub}>
              {docFiles.length} file{docFiles.length !== 1 ? 's' : ''} — tap to open
            </Text>
          </View>
          <TouchableOpacity style={s.sheetCloseBtn} onPress={onClose}>
            <Text style={s.sheetCloseTxt}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ paddingHorizontal:16, paddingTop:12 }}>
          {docFiles.map(file => {
            const ext   = file.file_name.split('.').pop()?.toUpperCase() || 'DOC';
            const color = getDocColor(file.file_name);
            return (
              <TouchableOpacity key={String(file.id)} style={s.docRow}
                onPress={() => onOpen(file)} activeOpacity={0.75}>
                <View style={[s.docIconBox,
                  { backgroundColor: color+'15', borderColor: color+'40' }]}>
                  <Text style={{ fontSize:24 }}>{docIcon(file.file_name)}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={s.docName} numberOfLines={2}>{file.file_name}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center', marginTop:4 }}>
                    <View style={[s.extBadge, { backgroundColor: color }]}>
                      <Text style={s.extBadgeTxt}>{ext}</Text>
                    </View>
                    <Text style={s.docDurTxt}>
                      {file.duration ? `${file.duration}s per page` : '50s (default)'}
                    </Text>
                    {file.local_path
                      ? <Text style={{ fontSize:11, color:'#15803D', marginLeft:6 }}>💾</Text>
                      : null}
                  </View>
                </View>
                <View style={[s.openBtn, { backgroundColor: color }]}>
                  <Text style={s.openBtnTxt}>▶{'\n'}Open</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </TouchableOpacity>
    </TouchableOpacity>
  </Modal>
);

// ══════════════════════════════════════════════════════════════
// PlayerScreen
// ══════════════════════════════════════════════════════════════
export default function PlayerScreen({ navigation }: any) {
  const {
    tv, files: allFiles,
    pendingFiles, consumePending,
    mqttConnected, refreshFiles, logout,
    isSyncing, downloadProgress, volume,
    shouldSkipCurrent, clearSkipCurrent,
  } = useApp();

  const isFocused = useIsFocused();

  const fileKey  = allFiles.map(f => `${f.id}:${f.file_name}`).join('|');
  // CHANGE: Include documents in the playlist loop
  const files    = useMemo(() => allFiles.filter(f => _isMedia(f.file_name) || _isDoc(f.file_name)), [fileKey]);
  const docFiles = useMemo(() => allFiles.filter(f => _isDoc(f.file_name)),  [fileKey]);

  // Playback state
  const [idx,          setIdx]          = useState(0);
  const [isLoading,    setIsLoading]    = useState(true);
  const [error,        setError]        = useState<string | null>(null);

  // Sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docModal,    setDocModal]    = useState(false);
  const [navFocus,    setNavFocus]    = useState(0);
  const slideAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;

  // Delete sync feedback state
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Announcement state ────────────────────────────────────
  const [announcement, setAnnouncement] = useState<any | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);


  const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filesLenRef = useRef(files.length);
  const prevIdxRef  = useRef<number>(-1);

  useEffect(() => { filesLenRef.current = files.length; }, [files.length]);

  // Option A: Skip current file immediately when MQTT fires (e.g. after file delete)
  // This prevents waiting up to 20 min for a video to finish
  useEffect(() => {
    if (shouldSkipCurrent) {
      clearSkipCurrent();
      setIsDeleting(true);
      console.log('[Player] MQTT skip signal — advancing immediately');
      next();
      setTimeout(() => setIsDeleting(false), 4000);
    }
  }, [shouldSkipCurrent]);

  const f = files[idx] as TVFile | undefined;

  // ── Sidebar open/close — same animation as Dashboard ────────
  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.spring(slideAnim, {
      toValue: 0, useNativeDriver: true, tension: 100, friction: 12,
    }).start();
  };
  const closeSidebar = () => {
    Animated.timing(slideAnim, {
      toValue: -SIDEBAR_W, duration: 200, useNativeDriver: true,
    }).start(() => setSidebarOpen(false));
  };

  // ── Nav handler — same logic as Dashboard ───────────────────
  const handleNav = (id: string) => {
    closeSidebar();
    setTimeout(() => {
      if (id === 'home') { navigation.navigate('Sync'); return; }
      if (id === 'docs') {
        if (docFiles.length > 0) setDocModal(true);
        return;
      }
      if (id === 'library' || id === 'sync') {
        navigation.navigate('Sync');
        return;
      }
      if (id === 'signout') { logout(); return; }
    }, 250);
  };

  // ── next ────────────────────────────────────────────────────
  const next = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setError(null);
    setIsLoading(true);
    setIdx(i => {
      const len = filesLenRef.current;
      if (len <= 0) return 0;
      return (i + 1) % len;
    });
  }, []);

  const startTimer = useCallback((dur: number) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(next, dur * 1000);
  }, [next]);

  // ── clamp idx ───────────────────────────────────────────────
  useEffect(() => {
    if (files.length > 0 && idx >= files.length) setIdx(0);
  }, [files.length]);

  // ── swap pending at end of loop ─────────────────────────────
  useEffect(() => {
    const prev = prevIdxRef.current;
    prevIdxRef.current = idx;
    const endOfLoop =
      prev >= 0 && files.length > 0 &&
      prev === files.length - 1 && idx === 0 &&
      pendingFiles !== null;
    if (endOfLoop) consumePending();
  }, [idx, files.length, pendingFiles, consumePending]);

  // ── image timer (paused when doc screen on top) ─────────────
  useEffect(() => {
    if (!f || !isFocused) return;
    setIsLoading(true);
    setError(null);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (_isImage(f.file_name)) startTimer(f.duration || 10);
    const t = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(t);
  }, [idx, f?.id, isFocused]); // eslint-disable-line

  useEffect(() => {
    if (!isFocused && timerRef.current) clearTimeout(timerRef.current);
  }, [isFocused]);

  // ── Announcement: MQTT real-time + 60s HTTP poll fallback ───
  useEffect(() => {
    if (!tv) return;

    // MQTT real-time (fastest path)
    const handleAnn = (ann: any) => {
      if (ann?.expires_at && new Date(ann.expires_at) > new Date()) {
        setAnnouncement(ann);
      }
    };
    MqttService.onAnnouncement(handleAnn);

    // HTTP poll every 60s as fallback
    const poll = async () => {
      try {
        const res = await getTvAnnouncements(tv.tv_id, tv.db_name);
        const active = (res?.announcements || []).find(
          (a: any) => a?.expires_at && new Date(a.expires_at) > new Date()
        ) || null;
        setAnnouncement(active);
      } catch {}
    };
    poll();
    pollTimer.current = setInterval(poll, 60_000);

    return () => {
      MqttService.removeAnnouncementListener(handleAnn);
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [tv]);

  // ── MQTT command listener ────────────────────────────────────
  useEffect(() => {
    const handle = (cmd: string) => {
      if (cmd === 'reload')
        navigation.reset({ index:0, routes:[{ name:'Login' }] });
    };
    MqttService.onCommand(handle);
    return () => MqttService.removeCommandListener(handle);
  }, [navigation]);

  // ── cleanup ─────────────────────────────────────────────────
  useEffect(() => () => {
    if (timerRef.current)  clearTimeout(timerRef.current);
    if (pollTimer.current) clearInterval(pollTimer.current);
  }, []);

  // ── open doc ────────────────────────────────────────────────
  const openDoc = (doc: TVFile) => {
    setDocModal(false);
    setTimeout(() => navigation.navigate('Document', { file: doc }), 200);
  };

  // ── No content — render with sidebar accessible ─────────
  if (files.length === 0) {
    return (
      <View style={{ flex:1, backgroundColor:'#fff' }}>
        <StatusBar hidden/>
        {/* NoContent main screen */}
        <NoContentScreen
          isSyncing={isSyncing}
          onBack={() => navigation.goBack()}
          mqttConnected={mqttConnected}
          tvName={tv?.tv_name || ''}
          pendingFiles={pendingFiles ?? null}
          consumePending={consumePending}
          onOpenSidebar={openSidebar}
          volume={volume}
          tvId={tv?.tv_id}
          downloadProgress={downloadProgress}
        />
        
        {/* ── Hamburger button — top-left, always visible ── */}
        <TouchableOpacity
          style={s.hamburgerBtn}
          onPress={openSidebar}
          activeOpacity={0.8}
          isTVSelectable={true}>
          <View style={s.hLine}/>
          <View style={[s.hLine, { width:14 }]}/>
          <View style={s.hLine}/>
        </TouchableOpacity>

        {/* ── TV Name Pill — top-right, always visible ─────────── */}
        {!!tv?.tv_name && (
          <View style={s.tvPillWrap} pointerEvents="none">
            <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
          </View>
        )}

        {/* ── Sidebar overlay ──────────────────────────────────── */}
        {sidebarOpen && (
          <TouchableOpacity
            style={s.overlay}
            activeOpacity={1}
            onPress={closeSidebar}
          />
        )}

        {/* ── SIDEBAR ───────────────────────────── */}
        <Animated.View style={[s.sidebar, { transform:[{ translateX: slideAnim }] }]}>
          {/* Header: logo + TV pill */}
          <View style={s.sidebarHeader}>
            <Image
              source={require('../assets/logo.png')}
              style={s.sidebarLogo}
              resizeMode="contain"
            />
            {!!tv?.tv_name && (
              <View style={{ marginTop:12 }}>
                <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
              </View>
            )}
            {/* TV ID + Volume chips — shown just above nav items */}
            {!!tv && (
              <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
                <View style={s.sidebarChip}>
                  <Text style={s.sidebarChipTxt}>📺 ID: {tv.tv_id ?? '—'}</Text>
                </View>
                <View style={s.sidebarChip}>
                  <Text style={s.sidebarChipTxt}>🔊 {volume ?? 0}%</Text>
                </View>
              </View>
            )}
          </View>

          {/* Nav items */}
          <ScrollView
            style={s.navScroll}
            contentContainerStyle={s.navList}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled">
            {NAV.map((item, i) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  s.navItem,
                  item.danger && s.navItemDanger,
                  navFocus === i && s.navItemFocused,
                ]}
                onPress={() => handleNav(item.id)}
                onFocus={() => setNavFocus(i)}
                isTVSelectable={true}>
                <Text style={[s.navIcon, item.danger && { color:'#EF4444' }]}>
                  {item.icon}
                </Text>
                <Text style={[s.navLabel, item.danger && { color:'#EF4444' }]}>
                  {item.label}
                </Text>
                {item.id === 'docs' && docFiles.length > 0 && (
                  <View style={s.navBadge}>
                    <Text style={s.navBadgeTxt}>{docFiles.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={s.version}>Version 1.0.0</Text>
        </Animated.View>
      </View>
    );
  }

  const playUrl         = f ? getPlayUrl(f) : '';
  const imageResizeMode = 'contain';

  return (
    <View style={s.container}>
      <StatusBar hidden/>
      <View style={s.blackBg}/>

      {/* ── Image ────────────────────────────────────────────── */}
      {f && _isImage(f.file_name) && (
        <Image
          source={{ uri: playUrl }}
          style={s.media}
          resizeMode={imageResizeMode}
          onLoad={() => { setIsLoading(false); setError(null); }}
          onLoadStart={() => setIsLoading(true)}
          onLoadEnd={() => setIsLoading(false)}
          onError={() => {
            console.warn('[Player] Image failed:', f.file_name);
            if (tv) reportError({ tv_id: tv.tv_id, db_name: tv.db_name, error_type:'playback', error_message: `Image failed: ${f.file_name}` }).catch(()=>{});
            setError(`Failed: ${f.file_name}`);
            setIsLoading(false);
            setTimeout(next, 2000);
          }}
        />
      )}

      {/* ── Video ────────────────────────────────────────────── */}
      {f && _isVideo(f.file_name) && Video && (
        <Video
          source={{ uri: playUrl }}
          style={s.media}
          resizeMode="contain"
          paused={!isFocused}
          muted={false}
          volume={volume / 100}  // FIX 5: dynamic volume from MQTT
          onLoad={() => setIsLoading(false)}
          onReadyForDisplay={() => setIsLoading(false)}
          onEnd={next}
          onError={(e: any) => {
            const reason = e?.error?.errorString || e?.error?.localizedDescription || 'Unknown';
            console.warn('[Player] Video error:', reason);
            if (tv) reportError({ tv_id: tv.tv_id, db_name: tv.db_name, error_type:'playback', error_message: `Video failed: ${f.file_name} — ${reason}` }).catch(()=>{});
            setError(`Cannot play: ${f.file_name}`);
            setIsLoading(false);
            setTimeout(next, 2000);
          }}
          repeat={false}
          playInBackground={true}
          playWhenInactive={true}
          ignoreSilentSwitch="ignore"
        />
      )}

      {f && _isVideo(f.file_name) && !Video && (
        <View style={s.unsupported}>
          <Text style={s.unsupportedIcon}>🎬</Text>
          <Text style={s.unsupportedName}>{f.file_name}</Text>
          <Text style={s.unsupportedSub}>react-native-video not installed</Text>
          {(() => { startTimer(f.duration || 10); return null; })()}
        </View>
      )}

      {/* ── DocLauncher: Auto-open document files ────────────── */}
      {f && _isDoc(f.file_name) && (
        <DocLauncher
          file={f}
          onLoad={() => setIsLoading(false)}
          onFinish={next}
        />
      )}

      {/* ── Loading / Error ──────────────────────────────────── */}
      {isLoading && (
        <View style={s.loadingOverlay}>
          <ActivityIndicator size="large" color="#3a4847"/>
        </View>
      )}
      {error && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {/* ── Hamburger button — top-left, always visible on mobile ── */}
      <TouchableOpacity
        style={s.hamburgerBtn}
        onPress={openSidebar}
        activeOpacity={0.8}
        hasTVPreferredFocus={!sidebarOpen}
        isTVSelectable={true}>
        <View style={s.hLine}/>
        <View style={[s.hLine, { width:14 }]}/>
        <View style={s.hLine}/>
      </TouchableOpacity>

      {/* ── TV Name Pill — top-right, always visible ─────────── */}
      {!!tv?.tv_name && (
        <View style={s.tvPillWrap} pointerEvents="none">
          <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
        </View>
      )}

      {/* ── Delete feedback indicator ────────────────────────── */}
      {isDeleting && (
        <View style={[s.dlWrap, { backgroundColor:'rgba(239,68,68,0.85)' }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" style={{ marginRight:6 }}/>
          <Text style={s.dlLabel}>Updating playlist…</Text>
        </View>
      )}

      {/* ── Download progress ────────────────────────────────── */}
      {isSyncing && downloadProgress && (
        <DownloadIndicator
          fileIndex={downloadProgress.fileIndex}
          filePct={downloadProgress.filePct}
          total={downloadProgress.total}
        />
      )}
      {isSyncing && !downloadProgress && (
        <View style={s.dlWrap} pointerEvents="none">
          <ActivityIndicator size="small" color="#fff" style={{ marginRight:6 }}/>
          <Text style={s.dlLabel}>Syncing…</Text>
        </View>
      )}

      {/* ── Sidebar overlay ──────────────────────────────────── */}
      {sidebarOpen && (
        <TouchableOpacity
          style={s.overlay}
          activeOpacity={1}
          onPress={closeSidebar}
          isTVSelectable={false}
          focusable={false}
        />
      )}

      {/* ── SIDEBAR — identical to DashboardScreen ───────────── */}
      <Animated.View style={[s.sidebar, { transform:[{ translateX: slideAnim }] }]}>

        {/* Header: logo + TV pill */}
        <View style={s.sidebarHeader}>
          <Image
            source={require('../assets/logo.png')}
            style={s.sidebarLogo}
            resizeMode="contain"
          />
          {!!tv?.tv_name && (
            <View style={{ marginTop:12 }}>
              <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
            </View>
          )}
          {/* TV ID + Volume chips — shown just above nav items */}
          {!!tv && (
            <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
              <View style={s.sidebarChip}>
                <Text style={s.sidebarChipTxt}>📺 ID: {tv.tv_id ?? '—'}</Text>
              </View>
              <View style={s.sidebarChip}>
                <Text style={s.sidebarChipTxt}>🔊 {volume ?? 0}%</Text>
              </View>
            </View>
          )}
        </View>

        {/* Nav items */}
        <ScrollView
          style={s.navScroll}
          contentContainerStyle={s.navList}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          {NAV.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              style={[
                s.navItem,
                item.danger && s.navItemDanger,
                navFocus === i && s.navItemFocused,
              ]}
              onPress={() => handleNav(item.id)}
              onFocus={() => setNavFocus(i)}
              hasTVPreferredFocus={sidebarOpen && i === 0}
              isTVSelectable={true}
              focusable={true}
              accessible={true}>
              <Text style={[s.navIcon, item.danger && { color:'#EF4444' }]}>
                {item.icon}
              </Text>
              <Text style={[s.navLabel, item.danger && { color:'#EF4444' }]}>
                {item.label}
              </Text>
              {item.id === 'docs' && docFiles.length > 0 && (
                <View style={s.navBadge}>
                  <Text style={s.navBadgeTxt}>{docFiles.length}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={s.version}>Version 1.0.0</Text>
      </Animated.View>

      {/* ── Doc modal ────────────────────────────────────────── */}
      <DocModal
        visible={docModal}
        docFiles={docFiles}
        onClose={() => setDocModal(false)}
        onOpen={openDoc}
      />

      {/* ── Announcement ticker ──────────────────────────────── */}
      {announcement && (() => {
        const raw = announcement.expires_at || '';
        const utc = raw.endsWith('Z') ? raw : raw.replace(' ','T') + 'Z';
        return new Date(utc) > new Date();
      })() && (
      <Ticker ann={announcement} onExpire={() => setAnnouncement(null)}/>  // ← must be LAST
      )}
    </View>
  );
}

// ══════════════════════════════════════════════════════════════
const GREEN = '#16A34A';

const s = StyleSheet.create({
  container:      { flex:1, backgroundColor:'#000' },
  blackBg:        { ...StyleSheet.absoluteFillObject, backgroundColor:'#000' },
  media: { position:'absolute', top:0, left:0, right:0, bottom:0 },

  loadingOverlay: { ...StyleSheet.absoluteFillObject,
                    alignItems:'center', justifyContent:'center',
                    backgroundColor:'rgba(0,0,0,0.6)' },
  errorBanner:    { position:'absolute', bottom:80, left:20, right:20,
                    backgroundColor:'rgba(239,68,68,0.9)', borderRadius:10, padding:12 },
  errorText:      { color:'#fff', fontSize:12, textAlign:'center', fontWeight:'600' },
  unsupported:    { flex:1, backgroundColor:'#111', alignItems:'center',
                    justifyContent:'center', padding:32 },
  unsupportedIcon:{ fontSize:64, marginBottom:16 },
  unsupportedName:{ fontSize:16, fontWeight:'700', color:'#fff', marginBottom:6 },
  unsupportedSub: { fontSize:13, color:'#9CA3AF' },

  // Hamburger — top-left, always visible, same look as Dashboard
  hamburgerBtn: { position:'absolute', top:8, left:10, zIndex:50,
                  width:30, height:30, borderRadius:10,
                  backgroundColor:'rgba(0,0,0,0.55)',
                  justifyContent:'center', alignItems:'center',
                  paddingHorizontal:10 },
  hLine: { width:14, height:2, backgroundColor:'#fff',
            borderRadius:1.5, marginVertical:2.5 },

  // TV pill — top right always visible
  tvPillWrap: { position:'absolute', top:10, right:16, zIndex:50 },

  // Download pill
  dlWrap:  { position:'absolute', top:56, right:14, zIndex:50,
              flexDirection:'row', alignItems:'center',
              backgroundColor:'rgba(0,0,0,0.72)', borderRadius:12,
              paddingHorizontal:12, paddingVertical:7,
              borderWidth:1, borderColor:'rgba(10,188,170,0.5)' },
  dlIcon:  { fontSize:14, color:'#0ABCAA', marginRight:7 },
  dlBody:  { minWidth:90 },
  dlLabel: { color:'#fff', fontSize:11, fontWeight:'700', marginBottom:3 },
  dlTrack: { height:4, backgroundColor:'rgba(255,255,255,0.2)',
              borderRadius:2, overflow:'hidden' },
  dlFill:  { height:4, backgroundColor:'#0ABCAA', borderRadius:2 },

  // ── Sidebar overlay + panel — mirrors DashboardScreen exactly ─
  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0,
             backgroundColor:'rgba(0,0,0,0.55)', zIndex:10 },

  sidebar: { position:'absolute', top:0, left:0, bottom:0,
             width:SIDEBAR_W, backgroundColor:'#fff', zIndex:20,
             shadowColor:'#000', shadowOffset:{ width:4, height:0 },
             shadowOpacity:0.2, shadowRadius:12, elevation:12 },

  sidebarHeader: { paddingHorizontal:20,
                   paddingTop: Platform.OS==='android' ? 44 : 56,
                   paddingBottom:16,
                   borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
  sidebarLogo:   { width:200, height:56 },
  sidebarChip:   { backgroundColor:'rgba(255,255,255,0.15)', borderRadius:99, paddingHorizontal:10, paddingVertical:4 },
  sidebarChipTxt:{ color:'#000', fontSize:12, fontWeight:'600' },

  navScroll: { flex:1 },
  navList:   { paddingVertical:12, paddingBottom:20 },

  navItem: { flexDirection:'row', alignItems:'center',
             paddingHorizontal:20, paddingVertical:16,
             borderRadius:10, marginHorizontal:8, marginBottom:2 },
  navItemFocused: { backgroundColor:'#F0FDF4' },
  navItemDanger:  { marginTop:8 },

  navIcon:  { fontSize:16, marginRight:14, color:'#374151' },
  navLabel: { fontSize:14, fontWeight:'600', color:'#1A1A2E', flex:1 },

  navBadge:    { backgroundColor:GREEN, width:22, height:22, borderRadius:11,
                 alignItems:'center', justifyContent:'center' },
  navBadgeTxt: { color:'#fff', fontSize:11, fontWeight:'800' },

  version: { fontSize:11, color:'#9CA3AF', textAlign:'center',
             paddingBottom: Platform.OS==='android' ? 16 : 28 },

  // ── No content screen ────────────────────────────────────────
  noContent:       { flex:1, backgroundColor:'#f0f8ff',
                     alignItems:'center', justifyContent:'center', padding:40 },
  noContentLogo:   { width:300, height:100, marginBottom:32 },
  uploadWrap:      { alignItems:'center', marginBottom:24 },
  arrowHead:       { width:0, height:0,
                     borderLeftWidth:18, borderRightWidth:18, borderBottomWidth:26,
                     borderStyle:'solid',
                     borderLeftColor:'transparent', borderRightColor:'transparent',
                     borderBottomColor:'#1B7FD4' },
  arrowShaft:      { width:6, height:22, backgroundColor:'#1B7FD4', borderRadius:2 },
  folderBody:      { width:90, height:68, borderWidth:4, borderColor:'#1B7FD4',
                     borderRadius:6, backgroundColor:'transparent', marginTop:2 },
  folderTab:       { position:'absolute', top:-22, left:-1, width:36, height:20,
                     borderTopLeftRadius:6, borderTopRightRadius:6,
                     borderWidth:4, borderColor:'#1B7FD4',
                     borderBottomWidth:0, backgroundColor:'transparent' },
  noContentMsg:    { fontSize:22, fontWeight:'700', color:'#1A1A2E',
                     textAlign:'center', marginBottom:12 },
  noContentSub:    { fontSize:14, color:'#6B7280', textAlign:'center',
                     lineHeight:22, marginBottom:24 },
  noContentSyncRow:{ flexDirection:'row', alignItems:'center', marginBottom:20 },
  noContentSyncTxt:{ color:'#0ABCAA', fontSize:14, fontWeight:'600' },
  noContentBack:   { backgroundColor:'rgba(27,127,212,0.12)',
                     paddingHorizontal:28, paddingVertical:12,
                     borderRadius:12, borderWidth:1, borderColor:'#1B7FD4' },
  noContentBackTxt:{ color:'#1B7FD4', fontSize:14, fontWeight:'700' },

  // ── Doc modal — same as Dashboard ───────────────────────────
  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet:        { backgroundColor:'#fff', borderTopLeftRadius:24,
                  borderTopRightRadius:24, paddingBottom:40, maxHeight:'80%' },
  sheetHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                  paddingHorizontal:20, paddingTop:20, paddingBottom:14,
                  borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
  sheetTitle:   { fontSize:18, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
  sheetSub:     { fontSize:13, color:'#6B7280' },
  sheetCloseBtn:{ width:36, height:36, backgroundColor:'#F3F4F6', borderRadius:18,
                  alignItems:'center', justifyContent:'center' },
  sheetCloseTxt:{ fontSize:16, color:'#374151', fontWeight:'700' },

  docRow:    { flexDirection:'row', alignItems:'center', backgroundColor:'#FAFAFA',
               borderRadius:14, padding:14, marginBottom:10,
               borderWidth:1, borderColor:'#E5E7EB' },
  docIconBox:{ width:48, height:48, borderRadius:12, alignItems:'center',
               justifyContent:'center', marginRight:12, borderWidth:1 },
  docName:   { fontSize:13, fontWeight:'600', color:'#1A1A2E' },
  extBadge:  { paddingHorizontal:8, paddingVertical:3, borderRadius:6, marginRight:6 },
  extBadgeTxt:{ color:'#fff', fontSize:11, fontWeight:'800' },
  docDurTxt: { fontSize:11, color:'#6B7280' },
  openBtn:   { paddingHorizontal:12, paddingVertical:8, borderRadius:10,
               alignItems:'center', marginLeft:8, minWidth:52 },
  openBtnTxt:{ color:'#fff', fontSize:12, fontWeight:'700', textAlign:'center' },
});