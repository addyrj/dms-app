// src/screens/SyncScreen.tsx
// Updated to use context.syncNow() (real download) and show per-file progress
// from context.downloadProgress instead of faked HEAD checks.
import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ScrollView, ActivityIndicator, StatusBar,
  UIManager, findNodeHandle,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { getTvFiles, reportError, TVFile } from '../services/api';

interface FileStatus { file: TVFile; state:'waiting'|'downloading'|'done'|'error'; note: string; }

export default function SyncScreen({ navigation }: any) {
  const { tv, files, syncNow, downloadProgress, isSyncing } = useApp();
  const [statuses, setStatuses] = useState<FileStatus[]>([]);
  const [phase,    setPhase]    = useState<'idle'|'loading'|'downloading'|'done'|'error'>('idle');
  const [log,      setLog]      = useState<string[]>([]);
  const [focusedRow, setFocusedRow] = useState(0);

  // FIX: hasTVPreferredFocus isn't reliably honored on stock RN Android.
  // ref.current.focus() is a no-op, and UIManager.focus() only exists in
  // full Bridgeless mode (crashed the app when called here — this project
  // runs Fabric but not Bridgeless). dispatchViewManagerCommand's 'focus'
  // command is always present and is what the base Android ReactViewManager
  // handles for TV focus. Wrapped defensively so a failure here can never
  // crash the app, only leave D-pad focus unset.
  const firstRowRef = useRef<any>(null);
  useEffect(() => {
    if (statuses.length === 0) return;
    const t = setTimeout(() => {
      try {
        const tag = findNodeHandle(firstRowRef.current);
        if (tag != null) UIManager.dispatchViewManagerCommand(tag, 'focus', []);
      } catch (_) {}
    }, 120);
    return () => clearTimeout(t);
  }, [statuses.length > 0]);

  const addLog = (msg: string) => setLog(p => [...p, `${new Date().toLocaleTimeString()} — ${msg}`]);

  // Mirror live downloadProgress into per-row status
  useEffect(() => {
    if (!downloadProgress) return;
    setStatuses(prev => prev.map((s, i) => {
      if (i < downloadProgress.fileIndex)
        return { ...s, state:'done',        note:`${s.file.duration}s` };
      if (i === downloadProgress.fileIndex)
        return { ...s, state:'downloading', note:`Downloading… ${downloadProgress.filePct}%` };
      return s;
    }));
  }, [downloadProgress]);

  // When sync finishes, mark all remaining as done
  useEffect(() => {
    if (!isSyncing && phase === 'downloading') {
      setStatuses(prev => prev.map(s =>
        s.state !== 'done' ? { ...s, state:'done', note:`${s.file.duration}s` } : s
      ));
      addLog('✅ All files downloaded');
      setPhase('done');
    }
  }, [isSyncing]);

  useEffect(() => { startSync(); }, []);

  const startSync = async () => {
    if (!tv) return;
    setLog([]); setPhase('loading'); addLog('Fetching file list...');
    try {
      const serverFiles = await getTvFiles(tv.tv_id, tv.db_name);
      addLog(`Found ${serverFiles.length} file(s)`);
      if (serverFiles.length === 0) {
        addLog('No content assigned.'); setPhase('done'); return;
      }
      setStatuses(serverFiles.map(f => ({ file:f, state:'waiting', note:'' })));
      setPhase('downloading');
      addLog('Downloading to device (background — playback continues)...');
      await syncNow(); // uses AppContext — sets pendingFiles, not files directly
    } catch (err: any) {
      addLog(`Error: ${err}`); setPhase('error');
      if (tv) reportError({ tv_id:tv.tv_id, db_name:tv.db_name, error_type:'network', error_message:String(err) });
    }
  };

  const stateIcon = (state: FileStatus['state']) =>
    ({ waiting:'⏳', downloading:'⬇️', done:'✅', error:'❌' }[state]);

  return (
    <View style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff"/>
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} disabled={phase==='downloading'}>
          <Text style={s.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={s.title}>Content Sync</Text>
        <View style={{width:40}}/>
      </View>

      <View style={[s.banner,
        phase==='done'?s.bDone : phase==='error'?s.bError : s.bChecking]}>
        {(phase==='loading'||phase==='downloading') &&
          <ActivityIndicator size="small" color="#0ABCAA" style={{marginRight:8}}/>}
        <Text style={[s.bannerText,
          phase==='done'?{color:'#15803D'} : phase==='error'?{color:'#DC2626'} : {color:'#374151'}]}>
          {phase==='loading'       ? 'Fetching file list...' :
           phase==='downloading'   ? 'Downloading in background — playback continues ▶' :
           phase==='done'          ? '✅ Sync complete! Playlist updates at next loop.' :
                                     '⚠️ Sync failed'}
        </Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        {statuses.map((item, i) => (
          <TouchableOpacity
            key={item.file.id}
            ref={i === 0 ? firstRowRef : undefined}
            style={[s.row, focusedRow === i && s.rowFocused]}
            onFocus={() => setFocusedRow(i)}
            hasTVPreferredFocus={i === 0}
            isTVSelectable={true}
            focusable={true}
            activeOpacity={1}>
            <Text style={s.rowIcon}>{stateIcon(item.state)}</Text>
            <View style={{flex:1}}>
              <Text style={s.rowName} numberOfLines={1}>{item.file.file_name}</Text>
              <Text style={s.rowNote}>{item.note || 'waiting...'}</Text>
            </View>
            {item.state==='downloading' && downloadProgress && (
              <View style={s.miniBar}>
                <View style={[s.miniFill, {width:`${downloadProgress.filePct}%` as any}]}/>
              </View>
            )}
            {item.state==='done' && <View style={s.rowBadge}><Text style={s.rowBadgeText}>OK</Text></View>}
          </TouchableOpacity>
        ))}
        <View style={s.logBox}>
          <Text style={s.logTitle}>LOG</Text>
          {log.map((l,i) => <Text key={i} style={s.logLine}>{l}</Text>)}
        </View>
      </ScrollView>

      {(phase==='done'||phase==='error') && (
        <View style={s.bottom}>
          {phase==='done' && (
            <TouchableOpacity style={s.playBtn} onPress={() => navigation.navigate('Player')}>
              <Text style={s.playBtnText}>▶  Watch Now (new content at next loop)</Text>
            </TouchableOpacity>
          )}
          {phase==='error' && (
            <TouchableOpacity style={[s.btn, s.retryBtn]} onPress={startSync}>
              <Text style={s.btnText}>↺  Retry</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}>
            <Text style={[s.btnText, {color:'#374151'}]}>← Back</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:    { flex:1, backgroundColor:'#F8FAFB' },
  header:       { flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingHorizontal:20, paddingTop:52, paddingBottom:14, backgroundColor:'#fff', borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
  backBtn:      { width:38, height:38, backgroundColor:'#F3F4F6', borderRadius:10, alignItems:'center', justifyContent:'center' },
  backIcon:     { color:'#374151', fontSize:18, fontWeight:'600' },
  title:        { fontSize:18, fontWeight:'700', color:'#1A1A2E' },
  banner:       { flexDirection:'row', alignItems:'center', margin:16, borderRadius:12, padding:14, borderWidth:1 },
  bChecking:    { backgroundColor:'#F0FAF9', borderColor:'#CCF5F1' },
  bDone:        { backgroundColor:'#F0FDF4', borderColor:'#BBF7D0' },
  bError:       { backgroundColor:'#FEF2F2', borderColor:'#FECACA' },
  bannerText:   { fontSize:13, fontWeight:'600', flex:1 },
  scroll:       { padding:16, paddingBottom:160 },
  row:          { flexDirection:'row', alignItems:'center', backgroundColor:'#fff', borderRadius:12, padding:14, marginBottom:8, borderWidth:1, borderColor:'#E5E7EB' },
  rowFocused:   { borderColor:'#0ABCAA', borderWidth:2 },
  rowIcon:      { fontSize:20, marginRight:12 },
  rowName:      { fontSize:14, fontWeight:'600', color:'#1A1A2E', marginBottom:3 },
  rowNote:      { fontSize:12, color:'#6B7280' },
  miniBar:      { width:60, height:5, backgroundColor:'#E5E7EB', borderRadius:3, overflow:'hidden', marginLeft:8 },
  miniFill:     { height:5, backgroundColor:'#0ABCAA', borderRadius:3 },
  rowBadge:     { backgroundColor:'#F0FDF4', paddingHorizontal:8, paddingVertical:2, borderRadius:6, borderWidth:1, borderColor:'#BBF7D0' },
  rowBadgeText: { fontSize:11, fontWeight:'700', color:'#15803D' },
  logBox:       { backgroundColor:'#fff', borderRadius:12, padding:14, marginTop:8, borderWidth:1, borderColor:'#E5E7EB' },
  logTitle:     { fontSize:11, color:'#9CA3AF', fontWeight:'700', textTransform:'uppercase', letterSpacing:0.8, marginBottom:8 },
  logLine:      { fontSize:11, color:'#6B7280', lineHeight:18 },
  bottom:       { position:'absolute', bottom:0, left:0, right:0, padding:16, gap:8, backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#E5E7EB' },
  playBtn:      { backgroundColor:'#0ABCAA', borderRadius:12, paddingVertical:14, alignItems:'center' },
  playBtnText:  { color:'#fff', fontSize:14, fontWeight:'700' },
  btn:          { backgroundColor:'#F3F4F6', borderRadius:12, paddingVertical:13, alignItems:'center', borderWidth:1, borderColor:'#E5E7EB' },
  retryBtn:     { backgroundColor:'#FEF2F2', borderColor:'#FECACA' },
  btnText:      { fontSize:15, fontWeight:'600', color:'#EF4444' },
});
