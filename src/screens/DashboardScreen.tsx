
// import React, { useEffect, useState, useRef } from 'react';
// import {
//   View, Text, FlatList, TouchableOpacity,AppState, StyleSheet,
//   Alert, ActivityIndicator, RefreshControl, StatusBar,
//   Image, Platform, Modal, Animated, Dimensions, ScrollView
// } from 'react-native';
// import { useApp } from '../context/AppContext';

// import { MqttService } from '../services/MqttService';
// import { reportError, TVFile, ENV } from '../services/api';

// const { width: SW } = Dimensions.get('window');
// const SIDEBAR_W = 240;

// const isVideo = (n: string) => ['mp4','mov','avi','webm','mkv'].includes(n.split('.').pop()?.toLowerCase()||'');
// const isImage = (n: string) => ['jpg','jpeg','png','webp','gif','bmp'].includes(n.split('.').pop()?.toLowerCase()||'');
// const isDoc   = (n: string) => ['pdf','ppt','pptx','doc','docx','xls','xlsx'].includes(n.split('.').pop()?.toLowerCase()||'');

// const FILE_ICONS: Record<string,string> = {
//   mp4:'🎬',mov:'🎬',avi:'🎬',webm:'🎬',
//   jpg:'🖼️',jpeg:'🖼️',png:'🖼️',webp:'🖼️',
//   pdf:'📄',ppt:'📊',pptx:'📊',doc:'📝',docx:'📝',xls:'📗',xlsx:'📗',
// };
// const getIcon = (n: string) => FILE_ICONS[n.split('.').pop()?.toLowerCase()||''] || '📎';

// const DOC_COLORS: Record<string,string> = {
//   pdf:'#EF4444',ppt:'#F97316',pptx:'#F97316',
//   doc:'#3B82F6',docx:'#3B82F6',xls:'#22C55E',xlsx:'#22C55E',
// };
// const getDocColor = (n: string) => DOC_COLORS[n.split('.').pop()?.toLowerCase()||''] || '#6B7280';

// const NAV = [
//   { id:'home',    icon:'🏠', label:'Home' },
//   { id:'docs',    icon:'▶',  label:'Play Docs' },
//   { id:'library', icon:'🗂', label:'Media Library' },
//   { id:'sync',    icon:'↺',  label:'Sync Content' },
//   { id:'signout', icon:'⬢',  label:'Sign Out', danger:true },
// ];

// // ── TV Name Pill — same style as PlayerScreen ─────────────────
// const TvNamePill: React.FC<{ name: string; connected: boolean }> = ({ name, connected }) => (
//   <View style={[pill.wrap, connected ? pill.live : pill.offline]}>
//     <View style={pill.dot}/>
//     <Text style={pill.txt} numberOfLines={1}>{name}</Text>
//   </View>
// );

// const pill = StyleSheet.create({
//   wrap:    { flexDirection:'row', alignItems:'center',
//              paddingHorizontal:12, paddingVertical:6,
//              borderRadius:20, maxWidth:180 },
//   live:    { backgroundColor:'#16A34A' },
//   offline: { backgroundColor:'#DC2626' },
//   dot:     { width:7, height:7, borderRadius:4,
//              backgroundColor:'rgba(255,255,255,0.8)', marginRight:7 },
//   txt:     { color:'#fff', fontSize:12, fontWeight:'800' },
// });

// export default function DashboardScreen({ navigation }: any) {
//   const {
//     tv, files, mqttConnected,
//     refreshFiles, logout,
//     shouldAutoPlay, clearAutoPlay, isSyncing, pendingFiles, volume,
//   } = useApp();

//   const [loading,     setLoading]     = useState(true);
//   const [refreshing,  setRefreshing]  = useState(false);
//   const [sidebarOpen, setSidebarOpen] = useState(false);
//   const [docModal,    setDocModal]    = useState(false);
//   const [navFocus,    setNavFocus]    = useState(0);

//   const slideAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;

//   const mediaFiles = files.filter(f => isVideo(f.file_name) || isImage(f.file_name));
//   const docFiles   = files.filter(f => isDoc(f.file_name));

//   const openSidebar = () => {
//     setSidebarOpen(true);
//     Animated.spring(slideAnim, { toValue:0, useNativeDriver:true, tension:100, friction:12 }).start();
//   };
//   const closeSidebar = () => {
//     Animated.timing(slideAnim, { toValue:-SIDEBAR_W, duration:200, useNativeDriver:true })
//       .start(() => setSidebarOpen(false));
//   };

//   useEffect(() => {
//     if (shouldAutoPlay && (mediaFiles.length > 0 || (pendingFiles && pendingFiles.length > 0))) { clearAutoPlay(); navigation.navigate('Player'); }
//   }, [shouldAutoPlay, mediaFiles.length,pendingFiles]);

// useEffect(() => {
//     const wakeInterval = setInterval(() => {
//         const _ = AppState.currentState;
//     }, 55000);
//     return () => clearInterval(wakeInterval);
// }, []);

//   useEffect(() => {
//     loadFiles();
//     const h = (cmd: string) => {
//       if (cmd === 'reload') navigation.reset({ index:0, routes:[{name:'Login'}] });
//     };
//     MqttService.onCommand(h);
//     return () => MqttService.removeCommandListener(h);
//   }, []);

//   const loadFiles = async () => {
//     try { await refreshFiles(); }
//     catch (e: any) {
//       if (tv) reportError({ tv_id:tv.tv_id, db_name:tv.db_name, error_type:'network', error_message:String(e) });
//     } finally { setLoading(false); setRefreshing(false); }
//   };

//   const handleNav = (id: string) => {
//     closeSidebar();
//     setTimeout(() => {
//       if (id === 'home') return;
//       if (id === 'docs') { if (docFiles.length > 0) setDocModal(true); return; }
//       if (id === 'library' || id === 'sync') { navigation.navigate('Sync'); return; }
//       if (id === 'signout') {
//         Alert.alert('Sign Out','Are you sure?',[
//           { text:'Cancel', style:'cancel' },
//           { text:'Sign Out', style:'destructive', onPress:logout },
//         ]); return;
//       }
//     }, 250);
//   };

//   const openDoc = (file: TVFile) => {
//     setDocModal(false);
//     setTimeout(() => navigation.navigate('Document', { file }), 300);
//   };

//   const renderMedia = ({ item, index }: { item: TVFile; index: number }) => {
//     const isImg = isImage(item.file_name);
//     return (
//       <View style={s.mediaCard}>
//         <View style={s.seqBadge}><Text style={s.seqTxt}>{index + 1}</Text></View>
//         <View style={s.thumb}>
//           {isImg
//             ? <Image source={{ uri:item.file_url }} style={s.thumbImg} resizeMode="cover" onError={() => {}}/>
//             : <View style={s.thumbIcon}><Text style={{ fontSize:24 }}>{getIcon(item.file_name)}</Text></View>}
//         </View>
//         <View style={s.fileMid}>
//           <Text style={s.fileName} numberOfLines={1}>{item.file_name}</Text>
//           <View style={s.metaRow}>
//             <View style={s.chip}><Text style={s.chipTxt}>{item.duration || ENV.IMAGE_DURATION}s</Text></View>
//             <View style={[s.chip, s.chipGray]}><Text style={[s.chipTxt,{color:'#6B7280'}]}>Vol {volume}%</Text></View>
//             {item.local_path ? <View style={s.savedChip}><Text style={s.savedTxt}>💾 Saved</Text></View> : null}
//           </View>
//         </View>
//       </View>
//     );
//   };

//   return (
//     <View style={s.root}>
//       <StatusBar barStyle="dark-content" backgroundColor="#fff"/>

//       {/* ── HEADER ─────────────────────────────────────────────── */}
//       <View style={s.header}>
//         {/* Hamburger */}
//         <TouchableOpacity style={s.hamburger} onPress={openSidebar} isTVSelectable={true}>
//           <View style={s.hLine}/>
//           <View style={[s.hLine, {width:16}]}/>
//           <View style={s.hLine}/>
//         </TouchableOpacity>

//         {/* Logo */}
//         <Image source={require('../assets/logo.png')} style={s.logo} resizeMode="contain"/>

//         {/* TV info (ID + Volume) */}
//         <View style={s.headerInfoContainer}>
//           <View style={s.headerInfoItem}>
//             <Text style={s.headerInfoIcon}>🆔</Text>
//             <Text style={s.headerInfoLabel}>TV ID</Text>
//             <Text style={s.headerInfoValue}>{String(tv?.tv_id || '—')}</Text>
//           </View>
//           <View style={s.headerInfoDivider}/>
//           <View style={s.headerInfoItem}>
//             <Text style={s.headerInfoIcon}>🔊</Text>
//             <Text style={s.headerInfoLabel}>Volume</Text>
//             <Text style={s.headerInfoValue}>{`${volume}%`}</Text>
//           </View>
//         </View>

//         {/* TV Name Pill — green=live, red=offline (replaces old mqttPill) */}
//         {!!tv?.tv_name && (
//           <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
//         )}
//       </View>

//       {/* Sync banner */}
//       {isSyncing && (
//         <View style={s.syncBar}>
//           <ActivityIndicator size="small" color="#16A34A" style={{marginRight:8}}/>
//           <Text style={s.syncBarTxt}>Syncing new content...</Text>
//         </View>
//       )}

//       {/* ── MEDIA LIST ─────────────────────────────────────────── */}
//       {loading ? (
//         <View style={s.center}>
//           <ActivityIndicator color="#16A34A" size="large"/>
//           <Text style={s.loadingTxt}>Loading content...</Text>
//         </View>
//       ) : (
//         <FlatList
//           data={mediaFiles}
//           keyExtractor={it => String(it.id)}
//           renderItem={renderMedia}
//           contentContainerStyle={s.listContent}
//           refreshControl={
//             <RefreshControl
//               refreshing={refreshing}
//               onRefresh={() => { setRefreshing(true); loadFiles(); }}
//               tintColor="#16A34A" colors={['#16A34A']}/>
//           }
//           ListHeaderComponent={
//             mediaFiles.length > 0 ? (
//               <View style={s.sectionRow}>
//                 <View style={s.sectionDot}/>
//                 <Text style={s.sectionTitle}>Media Loop</Text>
//                 <View style={s.sectionBadge}>
//                   <Text style={s.sectionBadgeTxt}>{mediaFiles.length}</Text>
//                 </View>
//                 <Text style={s.sectionHint}>auto-plays in sequence</Text>
//                 <TouchableOpacity onPress={loadFiles} style={s.refreshBtn} isTVSelectable={true}>
//                   <Text style={s.refreshBtnTxt}>↺ Refresh</Text>
//                 </TouchableOpacity>
//               </View>
//             ) : null
//           }
//           ListEmptyComponent={
//             <View style={s.emptyBranded}>
//               {/* IOTtech logo */}
//               <Image
//                 source={require('../assets/logo.png')}
//                 style={s.emptyLogo}
//                 resizeMode="contain"
//               />

//               {/* Upload folder icon — drawn with Views */}
//               <View style={s.uploadWrap}>
//                 {/* Arrow head (points up) */}
//                 <View style={s.arrowHead}/>
//                 {/* Arrow shaft */}
//                 <View style={s.arrowShaft}/>
//                 {/* Folder body */}
//                 <View style={s.folderBody}>
//                   <View style={s.folderTab}/>
//                 </View>
//               </View>

//               <Text style={s.emptyMsg}>Please Upload the Content</Text>

//               {docFiles.length > 0 ? (
//                 <TouchableOpacity
//                   style={s.emptyDocsBtn}
//                   onPress={() => setDocModal(true)}>
//                   <Text style={s.emptyDocsBtnTxt}>
//                     📄  {docFiles.length} document{docFiles.length !== 1 ? 's' : ''} available — tap to open
//                   </Text>
//                 </TouchableOpacity>
//               ) : (
//                 <Text style={s.emptySub}>
//                   Publish media from the admin panel to start playing.
//                 </Text>
//               )}
//             </View>
//           }
//           ListFooterComponent={<View style={{height:130}}/>}
//         />
//       )}

//       {/* ── BOTTOM BAR ─────────────────────────────────────────── */}
//       <View style={s.bottomBar}>
//         <View style={s.bottomRow}>
//           {mediaFiles.length > 0 ? (
//             <TouchableOpacity style={s.playBtn}
//               onPress={() => navigation.navigate('Player')} isTVSelectable={true}>
//               <Text style={s.playBtnTxt}>▶  Play Media ({mediaFiles.length} Files)</Text>
//             </TouchableOpacity>
//           ) : (
//             <View style={[s.playBtn, {backgroundColor:'#D1D5DB'}]}>
//               <Text style={[s.playBtnTxt, {color:'#9CA3AF'}]}>No Media</Text>
//             </View>
//           )}
//            <TouchableOpacity style={s.syncBtn}
//             onPress={() => navigation.navigate('Sync')} isTVSelectable={true}>
//             <Text style={s.syncBtnTxt}>⬇  Sync Content</Text>
//           </TouchableOpacity>
//         </View>
//       </View>

//       {/* Sidebar overlay */}
//       {sidebarOpen && (
//         <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={closeSidebar}/>
//       )}

//       {/* ── SIDEBAR ────────────────────────────────────────────── */}
//       <Animated.View style={[s.sidebar, { transform:[{ translateX: slideAnim }] }]}>
//         <View style={s.sidebarHeader}>
//           <Image source={require('../assets/logo.png')} style={s.sidebarLogo} resizeMode="contain"/>
//           {/* TV pill inside sidebar too */}
//           {!!tv?.tv_name && (
//             <View style={{ marginTop:10 }}>
//               <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
//             </View>
//           )}
//         </View>

//         <ScrollView style={s.navScroll} contentContainerStyle={s.navList}
//           showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
//           {NAV.map((item, i) => (
//             <TouchableOpacity
//               key={item.id}
//               style={[s.navItem, item.danger && s.navItemDanger, navFocus === i && s.navItemFocused]}
//               onPress={() => handleNav(item.id)}
//               onFocus={() => setNavFocus(i)}
//               isTVSelectable={true}>
//               <Text style={[s.navIcon, item.danger && {color:'#EF4444'}]}>{item.icon}</Text>
//               <Text style={[s.navLabel, item.danger && {color:'#EF4444'}]}>{item.label}</Text>
//               {item.id === 'docs' && docFiles.length > 0 && (
//                 <View style={s.navBadge}><Text style={s.navBadgeTxt}>{docFiles.length}</Text></View>
//               )}
//             </TouchableOpacity>
//           ))}
//         </ScrollView>
//         <Text style={s.version}>Version 1.0.0</Text>
//       </Animated.View>

//       {/* ── DOC MODAL ──────────────────────────────────────────── */}
//       <Modal visible={docModal} transparent animationType="slide"
//         onRequestClose={() => setDocModal(false)}>
//         <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setDocModal(false)}>
//           <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
//             <View style={s.sheetHeader}>
//               <View>
//                 <Text style={s.sheetTitle}>📄 Documents</Text>
//                 <Text style={s.sheetSub}>{docFiles.length} file{docFiles.length!==1?'s':''} — tap to open</Text>
//               </View>
//               <TouchableOpacity style={s.closeBtn} onPress={() => setDocModal(false)}>
//                 <Text style={s.closeBtnTxt}>✕</Text>
//               </TouchableOpacity>
//             </View>
//             <View style={s.docList}>
//               {docFiles.map(file => {
//                 const ext   = file.file_name.split('.').pop()?.toUpperCase() || 'DOC';
//                 const color = getDocColor(file.file_name);
//                 return (
//                   <TouchableOpacity key={String(file.id)} style={s.docRow}
//                     onPress={() => openDoc(file)} activeOpacity={0.75} isTVSelectable={true}>
//                     <View style={[s.docIconBox, {backgroundColor:color+'15', borderColor:color+'40'}]}>
//                       <Text style={{fontSize:24}}>{getIcon(file.file_name)}</Text>
//                     </View>
//                     <View style={{flex:1}}>
//                       <Text style={s.docName} numberOfLines={2}>{file.file_name}</Text>
//                       <View style={{flexDirection:'row', alignItems:'center', marginTop:4}}>
//                         <View style={[s.extBadge, {backgroundColor:color}]}>
//                           <Text style={s.extBadgeTxt}>{ext}</Text>
//                         </View>
//                         <Text style={s.docDurTxt}>
//                           {file.duration ? file.duration + 's per page' : ENV.PDF_DURATION + 's (default)'}
//                         </Text>
//                         {file.local_path
//                           ? <Text style={{fontSize:11,color:'#15803D',marginLeft:6}}>💾</Text>
//                           : null}
//                       </View>
//                     </View>
//                     <View style={[s.openBtn, {backgroundColor:color}]}>
//                       <Text style={s.openBtnTxt}>▶{'\n'}Open</Text>
//                     </View>
//                   </TouchableOpacity>
//                 );
//               })}
//             </View>
//           </TouchableOpacity>
//         </TouchableOpacity>
//       </Modal>
//     </View>
//   );
// }

// const GREEN = '#16A34A';
// const s = StyleSheet.create({
//   root: { flex:1, backgroundColor:'#F8FAFB' },

//   // Header
//   header: {
//     flexDirection:'row', alignItems:'center',
//     paddingHorizontal:14,
//     paddingTop: Platform.OS==='android' ? 40 : 50,
//     paddingBottom:12,
//     backgroundColor:'#fff',
//     borderBottomWidth:1, borderBottomColor:'#E5E7EB',
//     minHeight:80,
//   },
//   hamburger: { width:30, height:30, justifyContent:'center', gap:5, marginRight:10 },
//   hLine:     { width:16, height:2, backgroundColor:'#374151', borderRadius:1, marginVertical:2 },
//   logo:      { width:120, height:52, marginRight:10 },

//   // TV info items (ID + Volume only — name is in the pill)
//   headerInfoContainer: {
//     flex:1, flexDirection:'row', alignItems:'center', paddingHorizontal:4,
//   },
//   headerInfoItem:  { alignItems:'center', justifyContent:'center', paddingHorizontal:8, flex:1 },
//   headerInfoIcon:  { fontSize:16, marginBottom:2 },
//   headerInfoLabel: { fontSize:9, color:'#6B7280', fontWeight:'600',
//                      textTransform:'uppercase', letterSpacing:0.5, marginBottom:1 },
//   headerInfoValue: { fontSize:13, fontWeight:'700', color:'#1A1A2E' },
//   headerInfoDivider:{ width:1, height:36, backgroundColor:'#E5E7EB', marginHorizontal:2 },

//   syncBar:    { flexDirection:'row', alignItems:'center', backgroundColor:'#F0FDF4',
//                 paddingHorizontal:16, paddingVertical:6,
//                 borderBottomWidth:1, borderBottomColor:'#BBF7D0' },
//   syncBarTxt: { fontSize:12, color:GREEN, fontWeight:'600' },

//   listContent:     { paddingHorizontal:12, paddingTop:8 },
//   sectionRow:      { flexDirection:'row', alignItems:'center', marginBottom:10 },
//   sectionDot:      { width:8, height:8, borderRadius:4, backgroundColor:GREEN, marginRight:8 },
//   sectionTitle:    { fontSize:14, fontWeight:'700', color:'#1A1A2E', marginRight:8 },
//   sectionBadge:    { backgroundColor:'#F0FDF4', paddingHorizontal:8, paddingVertical:2,
//                      borderRadius:99, borderWidth:1, borderColor:'#BBF7D0', marginRight:8 },
//   sectionBadgeTxt: { fontSize:12, fontWeight:'700', color:GREEN },
//   sectionHint:     { fontSize:11, color:'#9CA3AF', flex:1 },
//   refreshBtn:      { paddingHorizontal:10, paddingVertical:4, borderRadius:8,
//                      backgroundColor:'#F0FDF4', borderWidth:1, borderColor:'#BBF7D0' },
//   refreshBtnTxt:   { fontSize:12, color:GREEN, fontWeight:'600' },

//   mediaCard: { flexDirection:'row', alignItems:'center', backgroundColor:'#fff',
//                borderRadius:12, padding:12, marginBottom:8,
//                borderWidth:1, borderColor:'#E5E7EB' },
//   seqBadge:  { width:24, height:24, borderRadius:12, backgroundColor:'#F0FDF4',
//                alignItems:'center', justifyContent:'center', marginRight:10,
//                borderWidth:1, borderColor:'#BBF7D0' },
//   seqTxt:    { fontSize:11, fontWeight:'700', color:GREEN },
//   thumb:     { width:52, height:52, borderRadius:10, overflow:'hidden', marginRight:12,
//                backgroundColor:'#F3F4F6', borderWidth:1, borderColor:'#E5E7EB' },
//   thumbImg:  { width:52, height:52 },
//   thumbIcon: { width:52, height:52, alignItems:'center', justifyContent:'center' },
//   fileMid:   { flex:1 },
//   fileName:  { fontSize:13, fontWeight:'600', color:'#1A1A2E', marginBottom:5 },
//   metaRow:   { flexDirection:'row', alignItems:'center', flexWrap:'wrap' },
//   chip:      { backgroundColor:'#F0FDF4', paddingHorizontal:7, paddingVertical:2,
//                borderRadius:6, borderWidth:1, borderColor:'#BBF7D0', marginRight:5 },
//   chipGray:  { backgroundColor:'#F9FAFB', borderColor:'#E5E7EB' },
//   chipTxt:   { fontSize:10, fontWeight:'600', color:GREEN },
//   savedChip: { backgroundColor:'#F0FDF4', paddingHorizontal:7, paddingVertical:2,
//                borderRadius:6, borderWidth:1, borderColor:'#BBF7D0' },
//   savedTxt:  { fontSize:10, color:'#15803D', fontWeight:'600' },

//   center:     { flex:1, alignItems:'center', justifyContent:'center', paddingTop:60 },
//   loadingTxt: { color:'#6B7280', marginTop:12, fontSize:14 },

//   // ── Branded empty state (matches IOTtech TV splash) ───────
//   emptyBranded:  { alignItems:'center', paddingTop:40, paddingBottom:40,
//                    paddingHorizontal:32 },
//   emptyLogo:     { width:260, height:88, marginBottom:32 },

//   // Upload icon — arrow above folder
//   uploadWrap:    { alignItems:'center', marginBottom:20 },
//   arrowHead:     { width:0, height:0,
//                    borderLeftWidth:18, borderRightWidth:18, borderBottomWidth:26,
//                    borderStyle:'solid',
//                    borderLeftColor:'transparent', borderRightColor:'transparent',
//                    borderBottomColor:'#e8b25a' },
//   arrowShaft:    { width:10, height:22, backgroundColor:'#e8b25a', borderRadius:2 },

//   folderBody:    { width:90, height:68,
//                    borderWidth:4, borderColor:'#e8b25a', borderRadius:6,
//                    backgroundColor:'#e8b25a', marginTop:2 },

//   folderTab:     { position:'absolute', top:-22, left:-1,
//                    width:36, height:20,
//                    borderTopLeftRadius:6, borderTopRightRadius:6,
//                    borderWidth:4, borderColor:'#e8b25a',
//                    borderBottomWidth:0, backgroundColor:'#e8b25a' },

//   emptyMsg:      { fontSize:18, fontWeight:'700', color:'#1A1A2E',
//                    textAlign:'center', marginBottom:12 },
//   emptySub:      { fontSize:13, color:'#6B7280', textAlign:'center', lineHeight:20 },
//   emptyDocsBtn:  { marginTop:4, backgroundColor:'#EFF6FF',
//                    paddingHorizontal:16, paddingVertical:10,
//                    borderRadius:10, borderWidth:1, borderColor:'#BFDBFE' },
//   emptyDocsBtnTxt:{ fontSize:13, color:'#1D4ED8', fontWeight:'600' },

//   bottomBar: { position:'absolute', bottom:0, left:0, right:0,
//                backgroundColor:'#fff', borderTopWidth:1, borderTopColor:'#E5E7EB',
//                paddingHorizontal:12, paddingTop:10,
//                paddingBottom: Platform.OS==='android' ? 12 : 24 },
//   bottomRow: { flexDirection:'row', gap:10 },
//   playBtn:   { flex:1, backgroundColor:GREEN, borderRadius:12,
//                paddingVertical:14, alignItems:'center' },
//   playBtnTxt:{ color:'#fff', fontSize:14, fontWeight:'700' },
//   syncBtn:   { flex:1, backgroundColor:'#fff', borderRadius:12, paddingVertical:14,
//                alignItems:'center', borderWidth:2, borderColor:GREEN },
//   syncBtnTxt:{ color:GREEN, fontSize:14, fontWeight:'700' },

//   overlay: { position:'absolute', top:0, left:0, right:0, bottom:0,
//              backgroundColor:'rgba(0,0,0,0.4)', zIndex:10 },
//   sidebar: { position:'absolute', top:0, left:0, bottom:0, width:SIDEBAR_W,
//              backgroundColor:'#fff', zIndex:20,
//              shadowColor:'#000', shadowOffset:{width:4,height:0},
//              shadowOpacity:0.15, shadowRadius:12, elevation:12 },
//   sidebarHeader: { paddingHorizontal:20,
//                    paddingTop: Platform.OS==='android' ? 44 : 56,
//                    paddingBottom:16,
//                    borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
//   sidebarLogo:   { width:180, height:50 },
//   navScroll: { flex:1 },
//   navList:   { paddingVertical:12, paddingBottom:20 },
//   navItem:   { flexDirection:'row', alignItems:'center',
//                paddingHorizontal:20, paddingVertical:16,
//                borderRadius:10, marginHorizontal:8, marginBottom:2 },
//   navItemFocused: { backgroundColor:'#F0FDF4' },
//   navItemDanger:  { marginTop:8 },
//   navIcon:   { fontSize:14, marginRight:14, color:'#374151' },
//   navLabel:  { fontSize:12, fontWeight:'600', color:'#1A1A2E', flex:1 },
//   navBadge:  { backgroundColor:GREEN, width:22, height:22, borderRadius:11,
//                alignItems:'center', justifyContent:'center' },
//   navBadgeTxt:{ color:'#fff', fontSize:11, fontWeight:'800' },
//   version:   { fontSize:11, color:'#9CA3AF', textAlign:'center',
//                paddingBottom: Platform.OS==='android' ? 16 : 28 },

//   modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
//   sheet:        { backgroundColor:'#fff', borderTopLeftRadius:24, borderTopRightRadius:24, paddingBottom:40 },
//   sheetHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
//                   paddingHorizontal:20, paddingTop:20, paddingBottom:14,
//                   borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
//   sheetTitle:   { fontSize:18, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
//   sheetSub:     { fontSize:13, color:'#6B7280' },
//   closeBtn:     { width:36, height:36, backgroundColor:'#F3F4F6', borderRadius:18,
//                   alignItems:'center', justifyContent:'center' },
//   closeBtnTxt:  { fontSize:16, color:'#374151', fontWeight:'700' },
//   docList:      { paddingHorizontal:16, paddingTop:12 },
//   docRow:       { flexDirection:'row', alignItems:'center', backgroundColor:'#FAFAFA',
//                   borderRadius:14, padding:14, marginBottom:10,
//                   borderWidth:1, borderColor:'#E5E7EB' },
//   docIconBox:   { width:48, height:48, borderRadius:12, alignItems:'center',
//                   justifyContent:'center', marginRight:12, borderWidth:1 },
//   docName:      { fontSize:13, fontWeight:'600', color:'#1A1A2E' },
//   extBadge:     { paddingHorizontal:8, paddingVertical:3, borderRadius:6, marginRight:6 },
//   extBadgeTxt:  { color:'#fff', fontSize:11, fontWeight:'800' },
//   docDurTxt:    { fontSize:11, color:'#6B7280' },
//   openBtn:      { paddingHorizontal:12, paddingVertical:8, borderRadius:10,
//                   alignItems:'center', marginLeft:8, minWidth:52 },
//   openBtnTxt:   { color:'#fff', fontSize:12, fontWeight:'700', textAlign:'center' },
// });








// -------------------------------------------



// ---------------------------------------------------


// // src/screens/PlayerScreen.tsx
// // Sidebar = exact same as DashboardScreen (logo + TvNamePill + nav items)
// // Opens on tap anywhere on screen, slides from left, closes on overlay tap
// // ADDED: Announcement ticker (MQTT real-time + 60s HTTP poll fallback)
// // ADDED: DocLauncher - automatically opens documents in loop

// import React, {
//   useEffect, useState, useRef, useCallback, useMemo,
// } from 'react';

// import {
//   View, Image, Text, StyleSheet, Dimensions,
//   TouchableOpacity, StatusBar, ActivityIndicator,
//   Animated, ScrollView, Platform, Modal, AppState,
// } from 'react-native';

// import { useIsFocused } from '@react-navigation/native';
// import { useNavigation } from '@react-navigation/native';
// import { useApp }      from '../context/AppContext';
// import { MqttService } from '../services/MqttService';
// import { TVFile, getTvAnnouncements, reportError } from '../services/api';
// import { getPlayUrl }  from '../services/StorageService';

// const { width: W, height: H } = Dimensions.get('window');
// const SIDEBAR_W = 230;

// let Video: any = null;
// try { Video = require('react-native-video').default; } catch (_) {}

// const _ext      = (n: string) => n.split('.').pop()?.toLowerCase() || '';
// const _isVideo  = (n: string) => ['mp4','mov','avi','webm','mkv'].includes(_ext(n));
// const _isImage  = (n: string) => ['jpg','jpeg','png','webp','gif','bmp'].includes(_ext(n));
// const _isMedia  = (n: string) => _isVideo(n) || _isImage(n);
// const _hasAlpha = (n: string) => ['png','webp','gif'].includes(_ext(n));
// const _isDoc    = (n: string) =>
//   ['pdf','ppt','pptx','doc','docx','xls','xlsx'].includes(_ext(n));

// const DOC_ICONS: Record<string,string> = {
//   pdf:'📄', ppt:'📊', pptx:'📊', doc:'📝', docx:'📝', xls:'📗', xlsx:'📗',
// };
// const docIcon = (n: string) => DOC_ICONS[_ext(n)] || '📎';

// const DOC_COLORS: Record<string,string> = {
//   pdf:'#EF4444', ppt:'#F97316', pptx:'#F97316',
//   doc:'#3B82F6', docx:'#3B82F6', xls:'#22C55E', xlsx:'#22C55E',
// };
// const getDocColor = (n: string) => DOC_COLORS[_ext(n)] || '#6B7280';

// // ── Announcement constants ────────────────────────────────────
// const ANNOUNCEMENT_BG: Record<string, string> = {
//   'good-news': '#16A34A',
//   'alert':     '#DC2626',
//   'info':      '#2563EB',
// };
// const ANNOUNCEMENT_LABEL: Record<string, string> = {
//   'good-news': '🟢 GOOD NEWS',
//   'alert':     '🔴 ALERT',
//   'info':      '🔵 INFO',
// };

// // Nav items — same as Dashboard
// const NAV = [
//   { id:'home',    icon:'🏠', label:'Home' },
//   { id:'docs',    icon:'▶',  label:'Play Docs' },
//   { id:'library', icon:'🗂', label:'Media Library' },
//   { id:'sync',    icon:'↺',  label:'Sync Content' },
//   { id:'signout', icon:'⬢',  label:'Sign Out', danger: true },
// ];

// // ── Ticker ────────────────────────────────────────────────────
// // TV news-style seamless ticker:
// // ✅ Full message (no word limit)
// // ✅ No blank gap — 2 copies side by side, animates by exactly 1 copy width
// // ✅ Constant speed (80px/sec) for all message lengths
// // ✅ Single line, no wrapping

// const TICKER_H   = 40;   // bar height
// const PX_PER_SEC = 80;   // constant scroll speed (pixels per second)

// const Ticker: React.FC<{ ann: any; onExpire: () => void }> = ({ ann, onExpire }) => {
//   const x      = useRef(new Animated.Value(0)).current;
//   const anim   = useRef<Animated.CompositeAnimation | null>(null);
//   const [textW, setTextW] = useState(0);

//   const bg  = ANNOUNCEMENT_BG[ann.type]    || '#2563EB';
//   const lbl = ANNOUNCEMENT_LABEL[ann.type] || 'INFO';

//   // FIX 1: Show FULL message — no word limit
//   const msg = (ann.message || '').trim();

//   // FIX 3: Constant speed — calculate duration from actual text width
//   useEffect(() => {
//     if (textW <= 0) return;

//     // Animate exactly one copy width → seamless loop (no visible gap)
//     const duration = (textW / PX_PER_SEC) * 1000;

//     anim.current?.stop();
//     x.setValue(0);

//     // FIX 2: Loop by exactly textW pixels — second copy fills the gap perfectly
//     anim.current = Animated.loop(
//       Animated.timing(x, {
//         toValue:         -textW,
//         duration,
//         useNativeDriver: true,
//         easing:          (t) => t,  // linear — constant speed
//       })
//     );
//     anim.current.start();

//     return () => { anim.current?.stop(); };
//   }, [textW, msg]);

//   // Auto-hide when duration_minutes expires
//   useEffect(() => {
//     // Force UTC parsing — add Z suffix if missing (MySQL stores UTC without Z)
//     const rawExpiry = ann.expires_at || '';
//     const utcStr    = rawExpiry.endsWith('Z') ? rawExpiry : rawExpiry.replace(' ', 'T') + 'Z';
//     const expiresAt = new Date(utcStr).getTime();
//     const msLeft    = expiresAt - Date.now();
//     console.log('[Ticker] expires_at:', rawExpiry, '| msLeft:', Math.round(msLeft/1000), 's');
//     if (msLeft <= 0) { onExpire(); return; }
//     const timer = setTimeout(() => onExpire(), msLeft);
//     return () => clearTimeout(timer);
//   }, [ann.expires_at]);

//   return (
//     <View style={[tick.bar, { backgroundColor: bg }]}>
//       {/* Type badge */}
//       <View style={tick.badge}>
//         <Text style={tick.badgeTxt} numberOfLines={1}>{lbl}</Text>
//       </View>

//       {/* Scrolling area — overflow:hidden clips content */}
//       <View style={tick.track}>
//         <Animated.View
//           style={[tick.row, { transform: [{ translateX: x }] }]}>
//           {/* FIX 2: Two identical copies — when first exits left, second is already entering */}
//           <Text
//             numberOfLines={1}
//             style={tick.text}
//             onLayout={e => {
//               const w = e.nativeEvent.layout.width;
//               if (w > 0 && w !== textW) setTextW(w);
//             }}>
//             {msg}{'     '}
//           </Text>
//           <Text numberOfLines={1} style={tick.text}>
//             {msg}{'     '}
//           </Text>
//         </Animated.View>
//       </View>
//     </View>
//   );
// };

// const tick = StyleSheet.create({
//   bar:      {
//     position: 'absolute', bottom: 0, left: 0, right: 0,
//     height: TICKER_H, flexDirection: 'row', alignItems: 'center', zIndex: 100,
//   },
//   badge:    {
//     height: TICKER_H, paddingHorizontal: 10,
//     backgroundColor: 'rgba(0,0,0,0.28)',
//     justifyContent: 'center', alignItems: 'center',
//     minWidth: 80,
//   },
//   badgeTxt: { color: '#fff', fontSize: 16, fontWeight: '800', letterSpacing: 0.8 },
//   track:    {
//     flex: 1, height: TICKER_H,
//     justifyContent: 'center',
//     overflow: 'hidden',   // clips the Animated.View children
//   },
//   row:      {
//     flexDirection: 'row',
//     alignItems: 'center',
//   },
//   text:     {
//     color: '#fff', fontSize: 16, fontWeight: '800',
//     paddingHorizontal: 6,
//     includeFontPadding: false,
//     textAlignVertical: 'center',
//     // FIX 4: slightly less than TICKER_H to avoid clipping descenders
//     height: TICKER_H - 6,
//     lineHeight: TICKER_H - 6,
//   },
// });

// // ── TvNamePill — green=live, red=offline ──────────────────────
// const TvNamePill: React.FC<{ name: string; connected: boolean }> = ({ name, connected }) => (
//   <View style={[pill.wrap, connected ? pill.live : pill.offline]}>
//     <View style={pill.dot}/>
//     <Text style={pill.txt} numberOfLines={1}>{name}</Text>
//   </View>
// );
// const pill = StyleSheet.create({
//   wrap:    { flexDirection:'row', alignItems:'center',
//              paddingHorizontal:12, paddingVertical:6,
//              borderRadius:20, maxWidth:180 },
//   live:    { backgroundColor:'#16A34A' },
//   offline: { backgroundColor:'#DC2626' },
//   dot:     { width:7, height:7, borderRadius:4,
//              backgroundColor:'rgba(255,255,255,0.8)', marginRight:7 },
//   txt:     { color:'#fff', fontSize:12, fontWeight:'800' },
// });

// // ── DownloadIndicator ─────────────────────────────────────────
// // Shows file-by-file download progress with % bar
// // User knows something big is coming and can wait
// const DownloadIndicator: React.FC<{
//   fileIndex: number; filePct: number; total: number;
// }> = ({ fileIndex, filePct, total }) => {
//   const pct  = Math.max(0, Math.min(100, Math.round(filePct)));
//   const done = fileIndex + 1;

//   // Progress bar color: green when almost done, blue otherwise
//   const barColor = pct > 80 ? '#22C55E' : '#60A5FA';

//   return (
//     <View style={s.dlWrap} pointerEvents="none">
//       {/* Left: animated download icon */}
//       <View style={s.dlIconWrap}>
//         <Text style={s.dlIcon}>⬇</Text>
//       </View>

//       {/* Center: labels + progress bar */}
//       <View style={s.dlBody}>
//         {/* Top row: file count + percentage */}
//         <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
//           <Text style={s.dlLabel}>
//             Downloading file {done} of {total}
//           </Text>
//           <Text style={[s.dlLabel, { fontWeight:'800', color: barColor }]}>
//             {pct}%
//           </Text>
//         </View>

//         {/* Progress bar */}
//         <View style={s.dlTrack}>
//           <View style={[s.dlFill, { width: `${pct}%` as any, backgroundColor: barColor }]}/>
//         </View>

//         {/* Bottom hint */}
//         <Text style={s.dlHint}>
//           {pct < 10
//             ? 'Starting download… please wait'
//             : pct < 50
//             ? 'Downloading content to TV…'
//             : pct < 90
//             ? 'Almost there, please wait…'
//             : 'Finishing up…'}
//         </Text>
//       </View>
//     </View>
//   );
// };

// // ── NoContentScreen ───────────────────────────────────────────
// const NoContentScreen: React.FC<{
//   isSyncing: boolean; onBack: () => void;
//   mqttConnected: boolean; tvName: string;
//   pendingFiles: TVFile[] | null; consumePending: () => void;
//   onOpenSidebar?: () => void;
//   volume?: number; tvId?: string | number;
// }> = ({ isSyncing, onBack, mqttConnected, tvName, pendingFiles, consumePending, onOpenSidebar, volume, tvId }) => {
//   useEffect(() => {
//     if (pendingFiles && pendingFiles.length > 0) consumePending();
//   }, [pendingFiles]);

//   return (
//     <View style={s.noContent}>
//       <StatusBar hidden/>
//       {!!tvName && <TvNamePill name={tvName} connected={mqttConnected}/>}
//       <Image source={require('../assets/logo.png')} style={s.noContentLogo} resizeMode="contain"/>
//       {/* Upload icon */}
//       <View style={s.uploadWrap}>
//         <View style={s.arrowHead}/>
//         <View style={s.arrowShaft}/>
//         <View style={s.folderBody}><View style={s.folderTab}/></View>
//       </View>
//       <Text style={s.noContentMsg}>Please Upload the Content</Text>
//       {isSyncing ? (
//         <View style={s.noContentSyncRow}>
//           <ActivityIndicator color="#0ABCAA" size="small" style={{ marginRight:8 }}/>
//           <Text style={s.noContentSyncTxt}>Checking for content…</Text>
//         </View>
//       ) : (
//         <Text style={s.noContentSub}>Publish media from the admin panel to start playing.</Text>
//       )}
//       <View style={{ flexDirection:'row', gap:12, marginTop:8 }}>
//         <TouchableOpacity style={s.noContentBack} onPress={onBack}>
//           <Text style={s.noContentBackTxt}>← Dashboard</Text>
//         </TouchableOpacity>
//         {!!onOpenSidebar && (
//           <TouchableOpacity style={[s.noContentBack, { backgroundColor:'#374151' }]}
//             onPress={onOpenSidebar} isTVSelectable={true}>
//             <Text style={s.noContentBackTxt}>☰ Menu</Text>
//           </TouchableOpacity>
//         )}
//       </View>
//     </View>
//   );
// };

// // ── DocLauncher: Auto opens DocumentScreen when current file is a document ───────
// function DocLauncher({
//   file,
//   onFinish,
//   onLoad,
// }: {
//   file: any;
//   onFinish: () => void;
//   onLoad: () => void;
// }) {
//   const nav = useNavigation<any>();

//   // FIX 4: Keep screen awake — prevent Android TV from sleeping
//   useEffect(() => {
//     // Fire a harmless state touch every 55 seconds to keep screen active
//     const wakeInterval = setInterval(() => {
//       // Accessing AppState keeps the JS bridge active, preventing sleep
//       const _ = AppState.currentState;
//     }, 55000);
//     return () => clearInterval(wakeInterval);
//   }, []);
//   const launched = useRef(false);

//   useEffect(() => {
//     if (!file) return;
//     if (launched.current) return;

//     launched.current = true;
//     onLoad();

//     const timer = setTimeout(() => {
//       nav.navigate('Document', {
//         file,
//         duration: file.doc_duration_seconds || file.duration || 50,
//       });
//     }, 300);

//     const unsubscribe = nav.addListener('focus', () => {
//       if (launched.current) {
//         launched.current = false;
//         onFinish();
//       }
//     });

//     return () => {
//       clearTimeout(timer);
//       unsubscribe();
//     };
//   }, [file]);

//   return null;
// }

// // ══════════════════════════════════════════════════════════════
// // Doc Modal (same style as Dashboard)
// // ══════════════════════════════════════════════════════════════
// const DocModal: React.FC<{
//   visible: boolean;
//   docFiles: TVFile[];
//   onClose: () => void;
//   onOpen: (f: TVFile) => void;
// }> = ({ visible, docFiles, onClose, onOpen }) => (
//   <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
//     <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={onClose}>
//       <TouchableOpacity activeOpacity={1} style={s.sheet} onPress={() => {}}>
//         <View style={s.sheetHeader}>
//           <View>
//             <Text style={s.sheetTitle}>📄 Documents</Text>
//             <Text style={s.sheetSub}>
//               {docFiles.length} file{docFiles.length !== 1 ? 's' : ''} — tap to open
//             </Text>
//           </View>
//           <TouchableOpacity style={s.sheetCloseBtn} onPress={onClose}>
//             <Text style={s.sheetCloseTxt}>✕</Text>
//           </TouchableOpacity>
//         </View>
//         <ScrollView style={{ paddingHorizontal:16, paddingTop:12 }}>
//           {docFiles.map(file => {
//             const ext   = file.file_name.split('.').pop()?.toUpperCase() || 'DOC';
//             const color = getDocColor(file.file_name);
//             return (
//               <TouchableOpacity key={String(file.id)} style={s.docRow}
//                 onPress={() => onOpen(file)} activeOpacity={0.75}>
//                 <View style={[s.docIconBox,
//                   { backgroundColor: color+'15', borderColor: color+'40' }]}>
//                   <Text style={{ fontSize:24 }}>{docIcon(file.file_name)}</Text>
//                 </View>
//                 <View style={{ flex:1 }}>
//                   <Text style={s.docName} numberOfLines={2}>{file.file_name}</Text>
//                   <View style={{ flexDirection:'row', alignItems:'center', marginTop:4 }}>
//                     <View style={[s.extBadge, { backgroundColor: color }]}>
//                       <Text style={s.extBadgeTxt}>{ext}</Text>
//                     </View>
//                     <Text style={s.docDurTxt}>
//                       {file.duration ? `${file.duration}s per page` : '50s (default)'}
//                     </Text>
//                     {file.local_path
//                       ? <Text style={{ fontSize:11, color:'#15803D', marginLeft:6 }}>💾</Text>
//                       : null}
//                   </View>
//                 </View>
//                 <View style={[s.openBtn, { backgroundColor: color }]}>
//                   <Text style={s.openBtnTxt}>▶{'\n'}Open</Text>
//                 </View>
//               </TouchableOpacity>
//             );
//           })}
//         </ScrollView>
//       </TouchableOpacity>
//     </TouchableOpacity>
//   </Modal>
// );

// // ══════════════════════════════════════════════════════════════
// // PlayerScreen
// // ══════════════════════════════════════════════════════════════
// export default function PlayerScreen({ navigation }: any) {
//   const {
//     tv, files: allFiles,
//     pendingFiles, consumePending,
//     mqttConnected, refreshFiles, logout,
//     isSyncing, downloadProgress, volume,
//     shouldSkipCurrent, clearSkipCurrent,
//   } = useApp();

//   const isFocused = useIsFocused();

//   const fileKey  = allFiles.map(f => `${f.id}:${f.file_name}`).join('|');
//   // CHANGE: Include documents in the playlist loop
//   const files    = useMemo(() => allFiles.filter(f => _isMedia(f.file_name) || _isDoc(f.file_name)), [fileKey]);
//   const docFiles = useMemo(() => allFiles.filter(f => _isDoc(f.file_name)),  [fileKey]);

//   // Playback state
//   const [idx,          setIdx]          = useState(0);
//   const [isLoading,    setIsLoading]    = useState(true);
//   const [error,        setError]        = useState<string | null>(null);

//   // Sidebar state
//   const [sidebarOpen, setSidebarOpen] = useState(false);
//   const [docModal,    setDocModal]    = useState(false);
//   const [navFocus,    setNavFocus]    = useState(0);
//   const slideAnim = useRef(new Animated.Value(-SIDEBAR_W)).current;

//   // Delete sync feedback state
//   const [isDeleting, setIsDeleting] = useState(false);

//   // ── Announcement state ────────────────────────────────────
//   const [announcement, setAnnouncement] = useState<any | null>(null);
//   const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);


//   const timerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
//   const filesLenRef = useRef(files.length);
//   const prevIdxRef  = useRef<number>(-1);

//   useEffect(() => { filesLenRef.current = files.length; }, [files.length]);

//   // Option A: Skip current file immediately when MQTT fires (e.g. after file delete)
//   // This prevents waiting up to 20 min for a video to finish
//   useEffect(() => {
//     if (shouldSkipCurrent) {
//       clearSkipCurrent();
//       setIsDeleting(true);
//       console.log('[Player] MQTT skip signal — advancing immediately');
//       next();
//       setTimeout(() => setIsDeleting(false), 4000);
//     }
//   }, [shouldSkipCurrent]);

//   const f = files[idx] as TVFile | undefined;

//   // ── Sidebar open/close — same animation as Dashboard ────────
//   const openSidebar = () => {
//     setSidebarOpen(true);
//     Animated.spring(slideAnim, {
//       toValue: 0, useNativeDriver: true, tension: 100, friction: 12,
//     }).start();
//   };
//   const closeSidebar = () => {
//     Animated.timing(slideAnim, {
//       toValue: -SIDEBAR_W, duration: 200, useNativeDriver: true,
//     }).start(() => setSidebarOpen(false));
//   };

//   // ── Nav handler — same logic as Dashboard ───────────────────
//   const handleNav = (id: string) => {
//     closeSidebar();
//     setTimeout(() => {
//       if (id === 'home') { navigation.goBack(); return; }
//       if (id === 'docs') {
//         if (docFiles.length > 0) setDocModal(true);
//         return;
//       }
//       if (id === 'library' || id === 'sync') {
//         navigation.navigate('Sync');
//         return;
//       }
//       if (id === 'signout') { logout(); return; }
//     }, 250);
//   };

//   // ── next ────────────────────────────────────────────────────
//   const next = useCallback(() => {
//     if (timerRef.current) clearTimeout(timerRef.current);
//     setError(null);
//     setIsLoading(true);
//     setIdx(i => {
//       const len = filesLenRef.current;
//       if (len <= 0) return 0;
//       return (i + 1) % len;
//     });
//   }, []);

//   const startTimer = useCallback((dur: number) => {
//     if (timerRef.current) clearTimeout(timerRef.current);
//     timerRef.current = setTimeout(next, dur * 1000);
//   }, [next]);

//   // ── clamp idx ───────────────────────────────────────────────
//   useEffect(() => {
//     if (files.length > 0 && idx >= files.length) setIdx(0);
//   }, [files.length]);

//   // ── swap pending at end of loop ─────────────────────────────
//   useEffect(() => {
//     const prev = prevIdxRef.current;
//     prevIdxRef.current = idx;
//     const endOfLoop =
//       prev >= 0 && files.length > 0 &&
//       prev === files.length - 1 && idx === 0 &&
//       pendingFiles !== null;
//     if (endOfLoop) consumePending();
//   }, [idx, files.length, pendingFiles, consumePending]);

//   // ── image timer (paused when doc screen on top) ─────────────
//   useEffect(() => {
//     if (!f || !isFocused) return;
//     setIsLoading(true);
//     setError(null);
//     if (timerRef.current) clearTimeout(timerRef.current);
//     if (_isImage(f.file_name)) startTimer(f.duration || 10);
//     const t = setTimeout(() => setIsLoading(false), 2000);
//     return () => clearTimeout(t);
//   }, [idx, f?.id, isFocused]); // eslint-disable-line

//   useEffect(() => {
//     if (!isFocused && timerRef.current) clearTimeout(timerRef.current);
//   }, [isFocused]);

//   // ── Announcement: MQTT real-time + 60s HTTP poll fallback ───
//   useEffect(() => {
//     if (!tv) return;

//     // MQTT real-time (fastest path)
//     const handleAnn = (ann: any) => {
//       if (ann?.expires_at && new Date(ann.expires_at) > new Date()) {
//         setAnnouncement(ann);
//       }
//     };
//     MqttService.onAnnouncement(handleAnn);

//     // HTTP poll every 60s as fallback
//     const poll = async () => {
//       try {
//         const res = await getTvAnnouncements(tv.tv_id, tv.db_name);
//         const active = (res?.announcements || []).find(
//           (a: any) => a?.expires_at && new Date(a.expires_at) > new Date()
//         ) || null;
//         setAnnouncement(active);
//       } catch {}
//     };
//     poll();
//     pollTimer.current = setInterval(poll, 60_000);

//     return () => {
//       MqttService.removeAnnouncementListener(handleAnn);
//       if (pollTimer.current) clearInterval(pollTimer.current);
//     };
//   }, [tv]);

//   // ── MQTT command listener ────────────────────────────────────
//   useEffect(() => {
//     const handle = (cmd: string) => {
//       if (cmd === 'reload')
//         navigation.reset({ index:0, routes:[{ name:'Login' }] });
//     };
//     MqttService.onCommand(handle);
//     return () => MqttService.removeCommandListener(handle);
//   }, [navigation]);

//   // ── cleanup ─────────────────────────────────────────────────
//   useEffect(() => () => {
//     if (timerRef.current)  clearTimeout(timerRef.current);
//     if (pollTimer.current) clearInterval(pollTimer.current);
//   }, []);

//   // ── open doc ────────────────────────────────────────────────
//   const openDoc = (doc: TVFile) => {
//     setDocModal(false);
//     setTimeout(() => navigation.navigate('Document', { file: doc }), 200);
//   };

//   // ── No content — render with sidebar accessible ─────────
//   if (files.length === 0) {
//     return (
//       <View style={{ flex:1, backgroundColor:'#fff' }}>
//         <StatusBar hidden/>
//         {/* NoContent main screen */}
//         <NoContentScreen
//           isSyncing={isSyncing}
//           onBack={() => navigation.goBack()}
//           mqttConnected={mqttConnected}
//           tvName={tv?.tv_name || ''}
//           pendingFiles={pendingFiles ?? null}
//           consumePending={consumePending}
//           onOpenSidebar={openSidebar}
//           volume={volume}
//           tvId={tv?.tv_id}
//         />
        
//         {/* ── Hamburger button — top-left, always visible ── */}
//         <TouchableOpacity
//           style={s.hamburgerBtn}
//           onPress={openSidebar}
//           activeOpacity={0.8}
//           isTVSelectable={true}>
//           <View style={s.hLine}/>
//           <View style={[s.hLine, { width:14 }]}/>
//           <View style={s.hLine}/>
//         </TouchableOpacity>

//         {/* ── TV Name Pill — top-right, always visible ─────────── */}
//         {!!tv?.tv_name && (
//           <View style={s.tvPillWrap} pointerEvents="none">
//             <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
//           </View>
//         )}

//         {/* ── Sidebar overlay ──────────────────────────────────── */}
//         {sidebarOpen && (
//           <TouchableOpacity
//             style={s.overlay}
//             activeOpacity={1}
//             onPress={closeSidebar}
//           />
//         )}

//         {/* ── SIDEBAR ───────────────────────────── */}
//         <Animated.View style={[s.sidebar, { transform:[{ translateX: slideAnim }] }]}>
//           {/* Header: logo + TV pill */}
//           <View style={s.sidebarHeader}>
//             <Image
//               source={require('../assets/logo.png')}
//               style={s.sidebarLogo}
//               resizeMode="contain"
//             />
//             {!!tv?.tv_name && (
//               <View style={{ marginTop:12 }}>
//                 <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
//               </View>
//             )}
//             {/* TV ID + Volume chips — shown just above nav items */}
//             {!!tv && (
//               <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
//                 <View style={s.sidebarChip}>
//                   <Text style={s.sidebarChipTxt}>📺 ID: {tv.tv_id ?? '—'}</Text>
//                 </View>
//                 <View style={s.sidebarChip}>
//                   <Text style={s.sidebarChipTxt}>🔊 {volume ?? 0}%</Text>
//                 </View>
//               </View>
//             )}
//           </View>

//           {/* Nav items */}
//           <ScrollView
//             style={s.navScroll}
//             contentContainerStyle={s.navList}
//             showsVerticalScrollIndicator={false}
//             keyboardShouldPersistTaps="handled">
//             {NAV.map((item, i) => (
//               <TouchableOpacity
//                 key={item.id}
//                 style={[
//                   s.navItem,
//                   item.danger && s.navItemDanger,
//                   navFocus === i && s.navItemFocused,
//                 ]}
//                 onPress={() => handleNav(item.id)}
//                 onFocus={() => setNavFocus(i)}
//                 isTVSelectable={true}>
//                 <Text style={[s.navIcon, item.danger && { color:'#EF4444' }]}>
//                   {item.icon}
//                 </Text>
//                 <Text style={[s.navLabel, item.danger && { color:'#EF4444' }]}>
//                   {item.label}
//                 </Text>
//                 {item.id === 'docs' && docFiles.length > 0 && (
//                   <View style={s.navBadge}>
//                     <Text style={s.navBadgeTxt}>{docFiles.length}</Text>
//                   </View>
//                 )}
//               </TouchableOpacity>
//             ))}
//           </ScrollView>

//           <Text style={s.version}>Version 1.0.0</Text>
//         </Animated.View>
//       </View>
//     );
//   }

//   const playUrl         = f ? getPlayUrl(f) : '';
//   const imageResizeMode = 'contain';

//   return (
//     <View style={s.container}>
//       <StatusBar hidden/>
//       <View style={s.blackBg}/>

//       {/* ── Image ────────────────────────────────────────────── */}
//       {f && _isImage(f.file_name) && (
//         <Image
//           source={{ uri: playUrl }}
//           style={s.media}
//           resizeMode={imageResizeMode}
//           onLoad={() => { setIsLoading(false); setError(null); }}
//           onLoadStart={() => setIsLoading(true)}
//           onLoadEnd={() => setIsLoading(false)}
//           onError={() => {
//             console.warn('[Player] Image failed:', f.file_name);
//             if (tv) reportError({ tv_id: tv.tv_id, db_name: tv.db_name, error_type:'playback', error_message: `Image failed: ${f.file_name}` }).catch(()=>{});
//             setError(`Failed: ${f.file_name}`);
//             setIsLoading(false);
//             setTimeout(next, 2000);
//           }}
//         />
//       )}

//       {/* ── Video ────────────────────────────────────────────── */}
//       {f && _isVideo(f.file_name) && Video && (
//         <Video
//           source={{ uri: playUrl }}
//           style={s.media}
//           resizeMode="contain"
//           paused={!isFocused}
//           muted={false}
//           volume={volume / 100}  // FIX 5: dynamic volume from MQTT
//           onLoad={() => setIsLoading(false)}
//           onReadyForDisplay={() => setIsLoading(false)}
//           onEnd={next}
//           onError={(e: any) => {
//             const reason = e?.error?.errorString || e?.error?.localizedDescription || 'Unknown';
//             console.warn('[Player] Video error:', reason);
//             if (tv) reportError({ tv_id: tv.tv_id, db_name: tv.db_name, error_type:'playback', error_message: `Video failed: ${f.file_name} — ${reason}` }).catch(()=>{});
//             setError(`Cannot play: ${f.file_name}`);
//             setIsLoading(false);
//             setTimeout(next, 2000);
//           }}
//           repeat={false}
//           playInBackground={true}
//           playWhenInactive={true}
//           ignoreSilentSwitch="ignore"
//         />
//       )}

//       {f && _isVideo(f.file_name) && !Video && (
//         <View style={s.unsupported}>
//           <Text style={s.unsupportedIcon}>🎬</Text>
//           <Text style={s.unsupportedName}>{f.file_name}</Text>
//           <Text style={s.unsupportedSub}>react-native-video not installed</Text>
//           {(() => { startTimer(f.duration || 10); return null; })()}
//         </View>
//       )}

//       {/* ── DocLauncher: Auto-open document files ────────────── */}
//       {f && _isDoc(f.file_name) && (
//         <DocLauncher
//           file={f}
//           onLoad={() => setIsLoading(false)}
//           onFinish={next}
//         />
//       )}

//       {/* ── Loading / Error ──────────────────────────────────── */}
//       {isLoading && (
//         <View style={s.loadingOverlay}>
//           <ActivityIndicator size="large" color="#3a4847"/>
//         </View>
//       )}
//       {error && (
//         <View style={s.errorBanner}>
//           <Text style={s.errorText}>{error}</Text>
//         </View>
//       )}

//       {/* ── Hamburger button — top-left, always visible on mobile ── */}
//       <TouchableOpacity
//         style={s.hamburgerBtn}
//         onPress={openSidebar}
//         activeOpacity={0.8}
//         hasTVPreferredFocus={!sidebarOpen}
//         isTVSelectable={true}>
//         <View style={s.hLine}/>
//         <View style={[s.hLine, { width:14 }]}/>
//         <View style={s.hLine}/>
//       </TouchableOpacity>

//       {/* ── TV Name Pill — top-right, always visible ─────────── */}
//       {!!tv?.tv_name && (
//         <View style={s.tvPillWrap} pointerEvents="none">
//           <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
//         </View>
//       )}

//       {/* ── Delete feedback indicator ────────────────────────── */}
//       {isDeleting && (
//         <View style={[s.dlWrap, { backgroundColor:'rgba(239,68,68,0.85)' }]} pointerEvents="none">
//           <ActivityIndicator size="small" color="#fff" style={{ marginRight:6 }}/>
//           <Text style={s.dlLabel}>Updating playlist…</Text>
//         </View>
//       )}

//       {/* ── Download progress ────────────────────────────────── */}
//       {isSyncing && downloadProgress && (
//         <DownloadIndicator
//           fileIndex={downloadProgress.fileIndex}
//           filePct={downloadProgress.filePct}
//           total={downloadProgress.total}
//         />
//       )}
//       {isSyncing && !downloadProgress && (
//         <View style={s.dlWrap} pointerEvents="none">
//           <ActivityIndicator size="small" color="#fff" style={{ marginRight:6 }}/>
//           <Text style={s.dlLabel}>Syncing…</Text>
//         </View>
//       )}

//       {/* ── Sidebar overlay ──────────────────────────────────── */}
//       {sidebarOpen && (
//         <TouchableOpacity
//           style={s.overlay}
//           activeOpacity={1}
//           onPress={closeSidebar}
//         />
//       )}

//       {/* ── SIDEBAR — identical to DashboardScreen ───────────── */}
//       <Animated.View style={[s.sidebar, { transform:[{ translateX: slideAnim }] }]}>

//         {/* Header: logo + TV pill */}
//         <View style={s.sidebarHeader}>
//           <Image
//             source={require('../assets/logo.png')}
//             style={s.sidebarLogo}
//             resizeMode="contain"
//           />
//           {!!tv?.tv_name && (
//             <View style={{ marginTop:12 }}>
//               <TvNamePill name={tv.tv_name} connected={mqttConnected}/>
//             </View>
//           )}
//           {/* TV ID + Volume chips — shown just above nav items */}
//           {!!tv && (
//             <View style={{ flexDirection:'row', gap:8, marginTop:10, flexWrap:'wrap' }}>
//               <View style={s.sidebarChip}>
//                 <Text style={s.sidebarChipTxt}>📺 ID: {tv.tv_id ?? '—'}</Text>
//               </View>
//               <View style={s.sidebarChip}>
//                 <Text style={s.sidebarChipTxt}>🔊 {volume ?? 0}%</Text>
//               </View>
//             </View>
//           )}
//         </View>

//         {/* Nav items */}
//         <ScrollView
//           style={s.navScroll}
//           contentContainerStyle={s.navList}
//           showsVerticalScrollIndicator={false}
//           keyboardShouldPersistTaps="handled">
//           {NAV.map((item, i) => (
//             <TouchableOpacity
//               key={item.id}
//               style={[
//                 s.navItem,
//                 item.danger && s.navItemDanger,
//                 navFocus === i && s.navItemFocused,
//               ]}
//               onPress={() => handleNav(item.id)}
//               onFocus={() => setNavFocus(i)}
//               hasTVPreferredFocus={sidebarOpen && i === 0}
//               isTVSelectable={true}
//               accessible={true}>
//               <Text style={[s.navIcon, item.danger && { color:'#EF4444' }]}>
//                 {item.icon}
//               </Text>
//               <Text style={[s.navLabel, item.danger && { color:'#EF4444' }]}>
//                 {item.label}
//               </Text>
//               {item.id === 'docs' && docFiles.length > 0 && (
//                 <View style={s.navBadge}>
//                   <Text style={s.navBadgeTxt}>{docFiles.length}</Text>
//                 </View>
//               )}
//             </TouchableOpacity>
//           ))}
//         </ScrollView>

//         <Text style={s.version}>Version 1.0.0</Text>
//       </Animated.View>

//       {/* ── Doc modal ────────────────────────────────────────── */}
//       <DocModal
//         visible={docModal}
//         docFiles={docFiles}
//         onClose={() => setDocModal(false)}
//         onOpen={openDoc}
//       />

//       {/* ── Announcement ticker ──────────────────────────────── */}
//       {announcement && (() => {
//         const raw = announcement.expires_at || '';
//         const utc = raw.endsWith('Z') ? raw : raw.replace(' ','T') + 'Z';
//         return new Date(utc) > new Date();
//       })() && (
//       <Ticker ann={announcement} onExpire={() => setAnnouncement(null)}/>  // ← must be LAST
//       )}
//     </View>
//   );
// }

// // ══════════════════════════════════════════════════════════════=============================================
// const GREEN = '#16A34A';

// const s = StyleSheet.create({
//   container:      { flex:1, backgroundColor:'#000' },
//   blackBg:        { ...StyleSheet.absoluteFillObject, backgroundColor:'#000' },
//   media: { position:'absolute', top:0, left:0, right:0, bottom:0 },

//   loadingOverlay: { ...StyleSheet.absoluteFillObject,
//                     alignItems:'center', justifyContent:'center',
//                     backgroundColor:'rgba(0,0,0,0.6)' },
//   errorBanner:    { position:'absolute', bottom:80, left:20, right:20,
//                     backgroundColor:'rgba(239,68,68,0.9)', borderRadius:10, padding:12 },
//   errorText:      { color:'#fff', fontSize:12, textAlign:'center', fontWeight:'600' },
//   unsupported:    { flex:1, backgroundColor:'#111', alignItems:'center',
//                     justifyContent:'center', padding:32 },
//   unsupportedIcon:{ fontSize:64, marginBottom:16 },
//   unsupportedName:{ fontSize:16, fontWeight:'700', color:'#fff', marginBottom:6 },
//   unsupportedSub: { fontSize:13, color:'#9CA3AF' },

//   // Hamburger — top-left, always visible, same look as Dashboard
//   hamburgerBtn: { position:'absolute', top:8, left:10, zIndex:50,
//                   width:30, height:30, borderRadius:10,
//                   backgroundColor:'rgba(0,0,0,0.55)',
//                   justifyContent:'center', alignItems:'center',
//                   paddingHorizontal:10 },
//   hLine: { width:14, height:2, backgroundColor:'#fff',
//             borderRadius:1.5, marginVertical:2.5 },

//   // TV pill — top right always visible
//   tvPillWrap: { position:'absolute', top:10, right:16, zIndex:50 },

//   // Download pill
//   dlWrap:  { position:'absolute', top:56, right:14, zIndex:50,
//               flexDirection:'row', alignItems:'center',
//               backgroundColor:'rgba(0,0,0,0.72)', borderRadius:12,
//               paddingHorizontal:12, paddingVertical:7,
//               borderWidth:1, borderColor:'rgba(10,188,170,0.5)' },
//   dlIcon:  { fontSize:14, color:'#0ABCAA', marginRight:7 },
//   dlBody:  { minWidth:90 },
//   dlLabel: { color:'#fff', fontSize:11, fontWeight:'700', marginBottom:3 },
//   dlTrack: { height:4, backgroundColor:'rgba(255,255,255,0.2)',
//               borderRadius:2, overflow:'hidden' },
//   dlFill:  { height:4, backgroundColor:'#0ABCAA', borderRadius:2 },

//   // ── Sidebar overlay + panel — mirrors DashboardScreen exactly ─
//   overlay: { position:'absolute', top:0, left:0, right:0, bottom:0,
//              backgroundColor:'rgba(0,0,0,0.55)', zIndex:10 },

//   sidebar: { position:'absolute', top:0, left:0, bottom:0,
//              width:SIDEBAR_W, backgroundColor:'#fff', zIndex:20,
//              shadowColor:'#000', shadowOffset:{ width:4, height:0 },
//              shadowOpacity:0.2, shadowRadius:12, elevation:12 },

//   sidebarHeader: { paddingHorizontal:20,
//                    paddingTop: Platform.OS==='android' ? 44 : 56,
//                    paddingBottom:16,
//                    borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
//   sidebarLogo:   { width:200, height:56 },
//   sidebarChip:   { backgroundColor:'rgba(255,255,255,0.15)', borderRadius:99, paddingHorizontal:10, paddingVertical:4 },
//   sidebarChipTxt:{ color:'#000', fontSize:12, fontWeight:'600' },

//   navScroll: { flex:1 },
//   navList:   { paddingVertical:12, paddingBottom:20 },

//   navItem: { flexDirection:'row', alignItems:'center',
//              paddingHorizontal:20, paddingVertical:16,
//              borderRadius:10, marginHorizontal:8, marginBottom:2 },
//   navItemFocused: { backgroundColor:'#F0FDF4' },
//   navItemDanger:  { marginTop:8 },

//   navIcon:  { fontSize:16, marginRight:14, color:'#374151' },
//   navLabel: { fontSize:14, fontWeight:'600', color:'#1A1A2E', flex:1 },

//   navBadge:    { backgroundColor:GREEN, width:22, height:22, borderRadius:11,
//                  alignItems:'center', justifyContent:'center' },
//   navBadgeTxt: { color:'#fff', fontSize:11, fontWeight:'800' },

//   version: { fontSize:11, color:'#9CA3AF', textAlign:'center',
//              paddingBottom: Platform.OS==='android' ? 16 : 28 },

//   // ── No content screen ────────────────────────────────────────
//   noContent:       { flex:1, backgroundColor:'#f0f8ff',
//                      alignItems:'center', justifyContent:'center', padding:40 },
//   noContentLogo:   { width:300, height:100, marginBottom:32 },
//   uploadWrap:      { alignItems:'center', marginBottom:24 },
//   arrowHead:       { width:0, height:0,
//                      borderLeftWidth:18, borderRightWidth:18, borderBottomWidth:26,
//                      borderStyle:'solid',
//                      borderLeftColor:'transparent', borderRightColor:'transparent',
//                      borderBottomColor:'#1B7FD4' },
//   arrowShaft:      { width:6, height:22, backgroundColor:'#1B7FD4', borderRadius:2 },
//   folderBody:      { width:90, height:68, borderWidth:4, borderColor:'#1B7FD4',
//                      borderRadius:6, backgroundColor:'transparent', marginTop:2 },
//   folderTab:       { position:'absolute', top:-22, left:-1, width:36, height:20,
//                      borderTopLeftRadius:6, borderTopRightRadius:6,
//                      borderWidth:4, borderColor:'#1B7FD4',
//                      borderBottomWidth:0, backgroundColor:'transparent' },
//   noContentMsg:    { fontSize:22, fontWeight:'700', color:'#1A1A2E',
//                      textAlign:'center', marginBottom:12 },
//   noContentSub:    { fontSize:14, color:'#6B7280', textAlign:'center',
//                      lineHeight:22, marginBottom:24 },
//   noContentSyncRow:{ flexDirection:'row', alignItems:'center', marginBottom:20 },
//   noContentSyncTxt:{ color:'#0ABCAA', fontSize:14, fontWeight:'600' },
//   noContentBack:   { backgroundColor:'rgba(27,127,212,0.12)',
//                      paddingHorizontal:28, paddingVertical:12,
//                      borderRadius:12, borderWidth:1, borderColor:'#1B7FD4' },
//   noContentBackTxt:{ color:'#1B7FD4', fontSize:14, fontWeight:'700' },

//   // ── Doc modal — same as Dashboard ───────────────────────────
//   modalOverlay: { flex:1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent:'flex-end' },
//   sheet:        { backgroundColor:'#fff', borderTopLeftRadius:24,
//                   borderTopRightRadius:24, paddingBottom:40, maxHeight:'80%' },
//   sheetHeader:  { flexDirection:'row', alignItems:'center', justifyContent:'space-between',
//                   paddingHorizontal:20, paddingTop:20, paddingBottom:14,
//                   borderBottomWidth:1, borderBottomColor:'#E5E7EB' },
//   sheetTitle:   { fontSize:18, fontWeight:'800', color:'#1A1A2E', marginBottom:2 },
//   sheetSub:     { fontSize:13, color:'#6B7280' },
//   sheetCloseBtn:{ width:36, height:36, backgroundColor:'#F3F4F6', borderRadius:18,
//                   alignItems:'center', justifyContent:'center' },
//   sheetCloseTxt:{ fontSize:16, color:'#374151', fontWeight:'700' },

//   docRow:    { flexDirection:'row', alignItems:'center', backgroundColor:'#FAFAFA',
//                borderRadius:14, padding:14, marginBottom:10,
//                borderWidth:1, borderColor:'#E5E7EB' },
//   docIconBox:{ width:48, height:48, borderRadius:12, alignItems:'center',
//                justifyContent:'center', marginRight:12, borderWidth:1 },
//   docName:   { fontSize:13, fontWeight:'600', color:'#1A1A2E' },
//   extBadge:  { paddingHorizontal:8, paddingVertical:3, borderRadius:6, marginRight:6 },
//   extBadgeTxt:{ color:'#fff', fontSize:11, fontWeight:'800' },
//   docDurTxt: { fontSize:11, color:'#6B7280' },
//   openBtn:   { paddingHorizontal:12, paddingVertical:8, borderRadius:10,
//                alignItems:'center', marginLeft:8, minWidth:52 },
//   openBtnTxt:{ color:'#fff', fontSize:12, fontWeight:'700', textAlign:'center' },
// });