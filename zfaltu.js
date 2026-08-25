// src/screens/DashboardScreen.tsx
// Change: replaced separate MQTT pill with a combined TvNamePill
//         (green background = live, red = offline) in the header —
//         same component style as PlayerScreen.

import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl, StatusBar,
  Image, Platform, Modal, Animated, Dimensions, ScrollView,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { MqttService } from '../services/MqttService';
import { reportError, TVFile, ENV } from '../services/api';

const { width: SW } = Dimensions.get('window');
const SIDEBAR_W = 240;

const isVideo = (n: string) => ['mp4','mov','avi','webm','mkv'].includes(n.split('.').pop()?.toLowerCase()||'');
const isImage = (n: string) => ['jpg','jpeg','png','webp','gif','bmp'].includes(n.split('.').pop()?.toLowerCase()||'');
const isDoc   = (n: string) => ['pdf','ppt','pptx','doc','docx','xls','xlsx'].includes(n.split('.').pop()?.toLowerCase()||'');

const FILE_ICONS: Record<string,string> = {
  mp4:'🎬',mov:'🎬',avi:'🎬',webm:'🎬',
  jpg:'🖼️',jpeg:'🖼️',png:'🖼️',webp:'🖼️',
  pdf:'📄',ppt:'📊',pptx:'📊',doc:'📝',docx:'📝',xls:'📗',xlsx:'📗',
};
const getIcon = (n: string) => FILE_ICONS[n.split('.').pop()?.toLowerCase()||''] || '📎';

const DOC_COLORS: Record<string,string> = {
  pdf:'#EF4444',ppt:'#F97316',pptx:'#F97316',
  doc:'#3B82F6',docx:'#3B82F6',xls:'#22C55E',xlsx:'#22C55E',
};
const getDocColor = (n: string) => DOC_COLORS[n.split('.').pop()?.toLowerCase()||''] || '#6B7280';

const NAV = [
  { id:'home',    icon:'🏠', label:'Home' },
  { id:'docs',    icon:'▶',  label:'Play Docs' },
  { id:'library', icon:'🗂', label:'Media Library' },
  { id:'sync',    icon:'↺',  label:'Sync Content' },
  { id:'signout', icon:'⬢',  label:'Sign Out', danger:true },
];

// ── TV Name Pill — same style as PlayerScreen ─────────────────
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

export default function DashboardScreen({ navigation }: any) {
  const {
    tv, files, mqttConnected,
    refreshFiles, logout,
    shouldAutoPlay, clearAutoPlay, isSyncing, pendingFiles, volume,
  } = useApp();

  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [docModal,    setDocModal]    = useState(false);
  const [navFocus,    setNavFocus]    = useState(0);

  const slideAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;

  const mediaFiles = files.filter(f => isVideo(f.file_name) || isImage(f.file_name));
  const docFiles   = files.filter(f => isDoc(f.file_name));

  const openSidebar = () => {
    setSidebarOpen(true);
    Animated.spring(slideAnim, { toValue:0, useNativeDriver:true, tension:100, friction:12 }).start();
  };
  const closeSidebar = () => {
    Animated.timing(slideAnim, { toValue:-SIDEBAR_W, duration:200, useNativeDriver:true })
      .start(() => setSidebarOpen(false));
  };

  useEffect(() => {
    if (shouldAutoPlay && (mediaFiles.length > 0 || (pendingFiles && pendingFiles.length > 0))) { clearAutoPlay(); navigation.navigate('Player'); }
  }, [shouldAutoPlay, mediaFiles.length]);

  useEffect(() => {
    loadFiles();
    const h = (cmd: string) => {
      if (cmd === 'reload') navigation.reset({ index:0, routes:[{name:'Login'}] });
    };
    MqttService.onCommand(h);
    return () => MqttService.removeCommandListener(h);
  }, []);

  const loadFiles = async () => {
    try { await refreshFiles(); }
    catch (e: any) {
      if (tv) reportError({ tv_id:tv.tv_id, db_name:tv.db_name, error_type:'network', error_message:String(e) });
    } finally { setLoading(false); setRefreshing(false); }
  };

  const handleNav = (id: string) => {
    closeSidebar();
    setTimeout(() => {
      if (id === 'home') return;
      if (id === 'docs') { if (docFiles.length > 0) setDocModal(true); return; }
      if (id === 'library' || id === 'sync') { navigation.navigate('Sync'); return; }
      if (id === 'signout') {
        Alert.alert('Sign Out','Are you sure?',[
          { text:'Cancel', style:'cancel' },
          { text:'Sign Out', style:'destructive', onPress:logout },
        ]); return;
      }
    }, 250);
  };

  const openDoc = (file: TVFile) => {
    setDocModal(false);
    setTimeout(() => navigation.navigate('Document', { file }), 300);
  };

  const renderMedia = ({ item, index }: { item: TVFile; index: number }) => {
    const isImg = isImage(item.file_name);
    return (
      <View style={s.mediaCard}>
        <View style={s.seqBadge}><Text style={s.seqTxt}>{index + 1}</Text></View>
        <View style={s.thumb}>
          {isImg
            ? <Image source={{ uri:item.file_url }} style={s.thumbImg} resizeMode="cover" onError={() => {}}/>
            : <View style={s.thumbIcon}><Text style={{ fontSize:24 }}>{getIcon(item.file_name)}</Text></View>}
        </View>
        <View style={s.fileMid}>
          <Text style={s.fileName} numberOfLines={1}>{item.file_name}</Text>
          <View style={s.metaRow}>
            <View style={s.chip}><Text style={s.chipTxt}>{item.duration || ENV.IMAGE_DURATION}s</Text></View>
            <View style={[s.chip, s.chipGray]}><Text style={[s.chipTxt,{color:'#6B7280'}]}>Vol {volume}%</Text></View>
            {item.local_path ? <View style={s.savedChip}><Text style={s.savedTxt}>💾 Saved</Text></View> : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" backgroundColor="#fff"/>

      {/* ── HEADER ─────────────────────────────────────────────── */}
      <View style={s.header}>
        {/* Hamburger */}
        <TouchableOpacity style={s.hamburger} onPress={openSidebar} isTVSelectable={true}>
          <View style={s.hLine}/>
          <View style={[s.hLine, {width:16}]}/>
          <View style={s.hLine}/>
        </TouchableOpacity>

        {/* Logo */}
        <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain"/>

        {/* TV info (ID + Volume) */}
        <View style={s.headerInfoContainer}>
          <View style={s.headerInfoItem}>
            <Text style={s.headerInfoIcon}>🆔</Text>
            <Text style={s.headerInfoLabel}>TV ID</Text>
            <Text style={s.headerInfoValue}>{String(tv?.tv_id || '—')}</Text>
          </View>
          <View style={s.headerInfoDivider}/>
          <View style={s.headerInfoItem}>
            <Text style={s.headerInfoIcon}>🔊</Text>
            <Text style={s.headerInfoLabel}>Volume</Text>
            <Text style={s.headerInfoValue}>{`${volume}%`}</Text>
          </View>
        </View>

        {/* TV Name Pill — green=live, red=offline (replaces old mqttPill) */}
        {!!tv?.tv_name && (
          <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
        )}
      </View>

      {/* Sync banner */}
      {isSyncing && (
        <View style={s.syncBar}>
          <ActivityIndicator size="small" color="#16A34A" style={{marginRight:8}}/>
          <Text style={s.syncBarTxt}>Syncing new content...</Text>
        </View>
      )}

      {/* ── MEDIA LIST ─────────────────────────────────────────── */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color="#16A34A" size="large"/>
          <Text style={s.loadingTxt}>Loading content...</Text>
        </View>
      ) : (
        <FlatList
          data={mediaFiles}
          keyExtractor={it => String(it.id)}
          renderItem={renderMedia}
          contentContainerStyle={s.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadFiles(); }}
              tintColor="#16A34A" colors={['#16A34A']}/>
          }
          ListHeaderComponent={
            mediaFiles.length > 0 ? (
              <View style={s.sectionRow}>
                <View style={s.sectionDot}/>
                <Text style={s.sectionTitle}>Media Loop</Text>
                <View style={s.sectionBadge}>
                  <Text style={s.sectionBadgeTxt}>{mediaFiles.length}</Text>
                </View>
                <Text style={s.sectionHint}>auto-plays in sequence</Text>
                <TouchableOpacity onPress={loadFiles} style={s.refreshBtn} isTVSelectable={true}>
                  <Text style={s.refreshBtnTxt}>↺ Refresh</Text>
                </TouchableOpacity>
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={s.emptyBranded}>
              {/* IOTtech logo */}
              <Image
                source={require('../assets/logo.png')}
                style={s.emptyLogo}
                resizeMode="contain"
              />

              {/* Upload folder icon — drawn with Views */}
              <View style={s.uploadWrap}>
                {/* Arrow head (points up) */}
                <View style={s.arrowHead}/>
                {/* Arrow shaft */}
                <View style={s.arrowShaft}/>
                {/* Folder body */}
                <View style={s.folderBody}>
                  <View style={s.folderTab}/>
                </View>
              </View>

              <Text style={s.emptyMsg}>Please Upload the Content</Text>

              {docFiles.length > 0 ? (
                <TouchableOpacity
                  style={s.emptyDocsBtn}
                  onPress={() => setDocModal(true)}>
                  <Text style={s.emptyDocsBtnTxt}>
                    📄  {docFiles.length} document{docFiles.length !== 1 ? 's' : ''} available — tap to open
                  </Text>
                </TouchableOpacity>
              ) : (
                <Text style={s.emptySub}>
                  Publish media from the admin panel to start playing.
                </Text>
              )}
            </View>
          }
          ListFooterComponent={<View style={{height:130}}/>}
        />
      )}

      {/* ── BOTTOM BAR ─────────────────────────────────────────── */}
      <View style={s.bottomBar}>
        <View style={s.bottomRow}>
          {mediaFiles.length > 0 ? (
            <TouchableOpacity style={s.playBtn}
              onPress={() => navigation.navigate('Player')} isTVSelectable={true}>
              <Text style={s.playBtnTxt}>▶  Play Media ({mediaFiles.length} Files)</Text>
            </TouchableOpacity>
          ) : (
            <View style={[s.playBtn, {backgroundColor:'#D1D5DB'}]}>
              <Text style={[s.playBtnTxt, {color:'#9CA3AF'}]}>No Media</Text>
            </View>
          )}
           <TouchableOpacity style={s.syncBtn}
            onPress={() => navigation.navigate('Sync')} isTVSelectable={true}>
            <Text style={s.syncBtnTxt}>⬇  Sync Content</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Sidebar overlay */}
      {sidebarOpen && (
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={closeSidebar}/>
      )}

      {/* ── SIDEBAR ────────────────────────────────────────────── */}
      <Animated.View style={[s.sidebar, { transform:[{ translateX: slideAnim }] }]}>
        <View style={s.sidebarHeader}>
          <Image source={require('../assets/logo.png')} style={s.sidebarLogo} resizeMode="contain"/>
          {/* TV pill inside sidebar too */}
          {!!tv?.tv_name && (
            <View style={{ marginTop:10 }}>
              <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
            </View>
          )}
        </View>

        <ScrollView style={s.navScroll} contentContainerStyle={s.navList}
          showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {NAV.map((item, i) => (
            <TouchableOpacity
              key={item.id}
              style={[s.navItem, item.danger && s.navItemDanger, navFocus === i && s.navItemFocused]}
              onPress={() => handleNav(item.id)}
              onFocus={() => setNavFocus(i)}
              isTVSelectable={true}>
              <Text style={[s.navIcon, item.danger && {color:'#EF4444'}]}>{item.icon}</Text>
              <Text style={[s.navLabel, item.danger && {color:'#EF4444'}]}>{item.label}</Text>
              {item.id === 'docs' && docFiles.length > 0 && (
                <View style={s.navBadge}><Text style={s.navBadgeTxt}>{docFiles.length}</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
        <Text style={s.version}>Version 1.0.0</Text>
      </Animated.View>

      {/* ── DOC MODAL ──────────────────────────────────────────── */}
      <Modal visible={docModal} transparent animationType="slide"
        onRequestClose={() => setDocModal(false)}>
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setDocModal(false)}>
          <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
            <View style={s.sheetHeader}>
              <View>
                <Text style={s.sheetTitle}>📄 Documents</Text>
                <Text style={s.sheetSub}>{docFiles.length} file{docFiles.length!==1?'s':''} — tap to open</Text>
              </View>
              <TouchableOpacity style={s.closeBtn} onPress={() => setDocModal(false)}>
                <Text style={s.closeBtnTxt}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={s.docList}>
              {docFiles.map(file => {
                const ext   = file.file_name.split('.').pop()?.toUpperCase() || 'DOC';
                const color = getDocColor(file.file_name);
                return (
                  <TouchableOpacity key={String(file.id)} style={s.docRow}
                    onPress={() => openDoc(file)} activeOpacity={0.75} isTVSelectable={true}>
                    <View style={[s.docIconBox, {backgroundColor:color+'15', borderColor:color+'40'}]}>
                      <Text style={{fontSize:24}}>{getIcon(file.file_name)}</Text>
                    </View>
                    <View style={{flex:1}}>
                      <Text style={s.docName} numberOfLines={2}>{file.file_name}</Text>
                      <View style={{flexDirection:'row', alignItems:'center', marginTop:4}}>
                        <View style={[s.extBadge, {backgroundColor:color}]}>
                          <Text style={s.extBadgeTxt}>{ext}</Text>
                        </View>
                        <Text style={s.docDurTxt}>
                          {file.duration ? file.duration + 's per page' : ENV.PDF_DURATION + 's (default)'}
                        </Text>
                        {file.local_path
                          ? <Text style={{fontSize:11,color:'#15803D',marginLeft:6}}>💾</Text>
                          : null}
                      </View>
                    </View>
                    <View style={[s.openBtn, {backgroundColor:color}]}>
                      <Text style={s.openBtnTxt}>▶{'\n'}Open</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const GREEN = '#16A34A';
const s = StyleSheet.create({
  root: { flex:1, backgroundColor:'#F8FAFB' },

  // Header
  header: {
    flexDirection:'row', alignItems:'center',
    paddingHorizontal:14,
    paddingTop: Platform.OS==='android' ? 40 : 50,
    paddingBottom:12,
    backgroundColor:'#fff',
    borderBottomWidth:1, borderBottomColor:'#E5E7EB',
    minHeight:80,
  },
  hamburger: { width:30, height:30, justifyContent:'center', gap:5, marginRight:10 },
  hLine:     { width:16, height:2, backgroundColor:'#374151', borderRadius:1, marginVertical:2 },
  logo:      { width:120, height:52, marginRight:10 },

  // TV info items (ID + Volume only — name is in the pill)
  headerInfoContainer: {
    flex:1, flexDirection:'row', alignItems:'center', paddingHorizontal:4,
  },
  headerInfoItem:  { alignItems:'center', justifyContent:'center', paddingHorizontal:8, flex:1 },
  headerInfoIcon:  { fontSize:16, marginBottom:2 },
  headerInfoLabel: { fontSize:9, color:'#6B7280', fontWeight:'600',
                     textTransform:'uppercase', letterSpacing:0.5, marginBottom:1 },
  headerInfoValue: { fontSize:13, fontWeight:'700', color:'#1A1A2E' },
  headerInfoDivider:{ width:1, height:36, backgroundColor:'#E5E7EB', marginHorizontal:2 },

  syncBar:    { flexDirection:'row', alignItems:'center', backgroundColor:'#F0FDF4',
                paddingHorizontal:16, paddingVertical:6,
                borderBottomWidth:1, borderBottomColor:'#BBF7D0' },
  syncBarTxt: { fontSize:12, color:GREEN, fontWeight:'600' },

  listContent:     { paddingHorizontal:12, paddingTop:8 },
  sectionRow:      { flexDirection:'row', alignItems:'center', marginBottom:10 },
  sectionDot:      { width:8, height:8, borderRadius:4, backgroundColor:GREEN, marginRight:8 },
  sectionTitle:    { fontSize:14, fontWeight:'700', color:'#1A1A2E', marginRight:8 },
  sectionBadge:    { backgroundColor:'#F0FDF4', paddingHorizontal:8, paddingVertical:2,
                     borderRadius:99, borderWidth:1, borderColor:'#BBF7D0', marginRight:8 },
  sectionBadgeTxt: { fontSize:12, fontWeight:'700', color:GREEN },
  sectionHint:     { fontSize:11, color:'#9CA3AF', flex:1 },
  refreshBtn:      { paddingHorizontal:10, paddingVertical:4, borderRadius:8,
                     backgroundColor:'#F0FDF4', borderWidth:1, borderColor:'#BBF7D0' },
  refreshBtnTxt:   { fontSize:12, color:GREEN, fontWeight:'600' },

  mediaCard: { flexDirection:'row', alignItems:'center', backgroundColor:'#fff',
               borderRadius:12, padding:12, marginBottom:8,
               borderWidth:1, borderColor:'#E5E7EB' },
  seqBadge:  { width:24, height:24, borderRadius:12, backgroundColor:'#F0FDF4',
               alignItems:'center', justifyContent:'center', marginRight:10,
               borderWidth:1, borderColor:'#BBF7D0' },
  seqTxt:    { fontSize:11, fontWeight:'700', color:GREEN },
  thumb:     { width:52, height:52, borderRadius:10, overflow:'hidden', marginRight:12,
               backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB' },
  thumbImg:  { width:52, height:52 },
  thumbIcon: { width:52, height:52, alignItems:'center', justifyContent:'center' },
  fileMid:   { flex:1 },
  fileName:  { fontSize:13, fontWeight:'600', color:'#1A1A2E', marginBottom:5 },
  metaRow:   { flexDirection:'row', alignItems:'center', flexWrap:'wrap' },
  chip:      { backgroundColor:'#F0FDF4', paddingHorizontal:7, paddingVertical:2,
               borderRadius:6, borderWidth:1, borderColor:'#BBF7D0', marginRight:5 },
  chipGray:  { backgroundColor:'#F9FAFB', borderColor:'#E5E7EB' },
  chipTxt:   { fontSize:10, fontWeight:'600', color:GREEN },
  savedChip: { backgroundColor:'#F0FDF4', paddingHorizontal:7, paddingVertical:2,
               borderRadius:6, borderWidth:1, borderColor:'#BBF7D0' },
  savedTxt:  { fontSize:10, color:'#15803D', fontWeight:'600' },

  center:     { flex:1, alignItems:'center', justifyContent:'center', paddingTop:60 },
  loadingTxt: { color:'#6B7280', marginTop:12, fontSize:14 },

  // ── Branded empty state (matches IOTtech TV splash) ───────
  emptyBranded:  { alignItems:'center', paddingTop:40, paddingBottom:40,
                   paddingHorizontal:32 },
  emptyLogo:     { width:260, height:88, marginBottom:32 },

  // Upload icon — arrow above folder
  uploadWrap:    { alignItems:'center', marginBottom:20 },
  arrowHead:     { width:0, height:0,
                   borderLeftWidth:18, borderRightWidth:18, borderBottomWidth:26,
                   borderStyle:'solid',
                   borderLeftColor:'transparent', borderRightColor:'transparent',
                   borderBottomColor:'#e8b25a' },
  arrowShaft:    { width:10, height:22, backgroundColor:'#e8b25a', borderRadius:2 },

  folderBody:    { width:90, height:68,
                   borderWidth:4, borderColor:'#e8b25a', borderRadius:6,
                   backgroundColor:'#e8b25a', marginTop:2 },

  folderTab:     { position:'absolute', top:-22, left:-1,
                   width:36, height:20,
                   borderTopLeftRadius:6, borderTopRightRadius:6,
                   borderWidth:4, borderColor:'#e8b25a',
                   borderBottomWidth:0, backgroundColor:'#e8b25a' },

  emptyMsg:      { fontSize:18, fontWeight:'700', color:'#1A1A2E',
                   textAlign:'center', marginBottom:12 },
  emptySub:      { fontSize:13, color:'#6B7280', textAlign:'center', lineHeight:20 },
  emptyDocsBtn:  { marginTop:4, backgroundColor:'#EFF6FF',
                   paddingHorizontal:16, paddingVertical:10,
                   borderRadius:10, borderWidth:1, borderColor:'#BFDBFE' },
  emptyDocsBtnTxt:{ fontSize:13, color:'#1D4ED8', fontWeight:'600' },

  bottomBar: { position:'absolute', bottom:0, left:0, right:0,
               backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#E5E7EB',
               paddingHorizontal:12, paddingTop:10,
               paddingBottom: Platform.OS==='android' ? 12 : 24 },
  bottomRow: { flexDirection:'row', gap:10 },
  playBtn:   { flex:1, backgroundColor:GREEN, borderRadius:12,
               paddingVertical:14, alignItems:'center' },
  playBtnTxt:{ color:'#fff', fontSize:14, fontWeight:'700' },
  syncBtn:   { flex:1, backgroundColor:'#fff', borderRadius:12, paddingVertical:14,
               alignItems:'center', borderWidth:2, borderColor:GREEN },
  syncBtnTxt:{ color:GREEN, fontSize:14, fontWeight:'700' },

  overlay: { position:'absolute', top:0, left:0, right:0, bottom:0,
             backgroundColor:'rgba(0,0,0,0.4)', zIndex:10 },
  sidebar: { position:'absolute', top:0, left:0, bottom:0, width:SIDEBAR_W,
             backgroundColor:'#fff', zIndex:20,
             shadowColor:'#000', shadowOffset:{width:4,height:0},
             shadowOpacity:0.15, shadowRadius:12, elevation:12 },
  sidebarHeader: { paddingHorizontal:20,
                   paddingTop: Platform.OS==='android' ? 44 : 56,
                   paddingBottom:16,
                   borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
  sidebarLogo:   { width:180, height:50 },
  navScroll: { flex:1 },
  navList:   { paddingVertical:12, paddingBottom:20 },
  navItem:   { flexDirection:'row', alignItems:'center',
               paddingHorizontal:20, paddingVertical:16,
               borderRadius:10, marginHorizontal:8, marginBottom:2 },
  navItemFocused: { backgroundColor:'#F0FDF4' },
  navItemDanger:  { marginTop:8 },
  navIcon:   { fontSize:14, marginRight:14, color:'#374151' },
  navLabel:  { fontSize:12, fontWeight:'600', color:'#1A1A2E', flex:1 },
  navBadge:  { backgroundColor:GREEN, width:22, height:22, borderRadius:11,
               alignItems:'center', justifyContent:'center' },
  navBadgeTxt:{ color:'#fff', fontSize:11, fontWeight:'800' },
  version:   { fontSize:11, color:'#9CA3AF', textAlign:'center',
               paddingBottom: Platform.OS==='android' ? 16 : 28 },

  modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
  sheet:        { backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:40 },
  sheetHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
                  paddingHorizontal:20, paddingTop:20, paddingBottom:14,
                  borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
  sheetTitle:   { fontSize:18, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
  sheetSub:     { fontSize:13, color:'#6B7280' },
  closeBtn:     { width:36, height:36, backgroundColor:'#F3F4F6', borderRadius:18,
                  alignItems:'center', justifyContent:'center' },
  closeBtnTxt:  { fontSize:16, color:'#374151', fontWeight:'700' },
  docList:      { paddingHorizontal:16, paddingTop:12 },
  docRow:       { flexDirection:'row', alignItems:'center', backgroundColor:'#FAFAFA',
                  borderRadius:14, padding:14, marginBottom:10,
                  borderWidth:1, borderColor:'#E5E7EB' },
  docIconBox:   { width:48, height:48, borderRadius:12, alignItems:'center',
                  justifyContent:'center', marginRight:12, borderWidth:1 },
  docName:      { fontSize:13, fontWeight:'600', color:'#1A1A2E' },
  extBadge:     { paddingHorizontal:8, paddingVertical:3, borderRadius:6, marginRight:6 },
  extBadgeTxt:  { color:'#fff', fontSize:11, fontWeight:'800' },
  docDurTxt:    { fontSize:11, color:'#6B7280' },
  openBtn:      { paddingHorizontal:12, paddingVertical:8, borderRadius:10,
                  alignItems:'center', marginLeft:8, minWidth:52 },
  openBtnTxt:   { color:'#fff', fontSize:12, fontWeight:'700', textAlign:'center' },
});