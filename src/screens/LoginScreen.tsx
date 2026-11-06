// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, ScrollView, KeyboardAvoidingView,
  Platform, Image,
} from 'react-native';
import { useApp } from '../context/AppContext';
import { tvLogin, LoginError } from '../services/api';

export default function LoginScreen() {
  const { login } = useApp();
  const [displayNumber, setDisplayNumber] = useState('');
  const [password,      setPassword]      = useState('');
  const [dbName,        setDbName]        = useState('');
  const [showPass,      setShowPass]      = useState(false);
  const [showDbField,   setShowDbField]   = useState(false); // hidden by default
  const [loading,       setLoading]       = useState(false);
  const [errors,        setErrors]        = useState({ display:'', password:'', db:'' });
  const [loginError,    setLoginError]    = useState<LoginError | null>(null);

  const validate = () => {
    const e = { display:'', password:'', db:'' };
    let ok = true;
    if (!displayNumber.trim()) { e.display  = 'Display number is required'; ok = false; }
    if (!password.trim())      { e.password = 'Password is required'; ok = false; }
    // DB only required if user manually opened the field
    if (showDbField && !dbName.trim()) { e.db = 'Enter database name'; ok = false; }
    setErrors(e); return ok;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    setLoading(true);
    setLoginError(null);
    try {
      const username = `display_${displayNumber.trim()}`;
      // If DB not provided, backend will auto-detect from display username
      const db = dbName.trim() || '';
      const result = await tvLogin(username, password, db);
      if (!result.success) {
        setLoginError({ isNetwork:false, message:'Invalid display username or password.' });
        return;
      }
      await login(result);
    } catch (err: any) {
      if (err && typeof err === 'object' && 'message' in err) {
        setLoginError(err as LoginError);
      } else {
        setLoginError({ isNetwork:false, message: typeof err === 'string' ? err : 'Something went wrong. Please try again.' });
      }
    } finally { setLoading(false); }
  };

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">

        {/* Header */}
        <View style={s.header}>
          <View style={s.logoWrap}>
            <Image source={require('../assets/logo.png')} style={s.logoImg} resizeMode="contain"/>
          </View>
          <Text style={s.title}>SOP TV Portal</Text>
          <Text style={s.subtitle}>Digital Signage Management System</Text>
        </View>

        {/* Card */}
        <View style={s.card}>
          <Text style={s.cardTitle}>Sign In</Text>
          {/* <Text style={s.cardSub}>Enter your display credentials</Text> */}

          {/* Display Number */}
          <Text style={s.label}>Display_Username</Text>
          <View style={s.prefixRow}>
            <View style={s.prefixBox}><Text style={s.prefixText}>display_</Text></View>
            <TextInput
              style={[s.prefixInput, errors.display ? s.inputErr : null]}
              placeholder="Display_Username"
              placeholderTextColor="#9CA3AF"
              value={displayNumber}
              onChangeText={t => { setDisplayNumber(t); setErrors(e => ({...e, display:''})); }}
              autoCapitalize="none"
              autoCorrect={false}
              hasTVPreferredFocus={true}
            />
          </View>
          {errors.display ? <Text style={s.errText}>{errors.display}</Text> : null}

          {/* Password */}
          <Text style={s.label}>Password</Text>
          <View>
            <TextInput
              style={[s.input, { paddingRight:50 }, errors.password ? s.inputErr : null]}
              placeholder="password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={t => { setPassword(t); setErrors(e => ({...e, password:''})); }}
              secureTextEntry={!showPass}
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />
            <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(v => !v)}>
              <Text style={s.eyeIcon}>{showPass ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>
          {errors.password ? <Text style={s.errText}>{errors.password}</Text> : null}

          {loginError && (
            <View style={[s.errorCard, loginError.isNetwork ? s.errorCardNetwork : s.errorCardAuth]}>
              <View style={s.errorHeader}>
                <Text style={s.errorIcon}>{loginError.isNetwork ? '📡' : '🔒'}</Text>
                <Text style={s.errorTitle}>
                  {loginError.isNetwork ? "Can't Reach Server" : 'Sign In Failed'}
                </Text>
              </View>
              <Text style={s.errorMessage}>{loginError.message}</Text>
              {loginError.details && (
                <Text style={s.errorDetailsText}>{loginError.details}</Text>
              )}
            </View>
          )}

          <TouchableOpacity
            style={[s.loginBtn, loading && s.loginBtnDim]}
            onPress={handleLogin}
            disabled={loading}
            focusable={true}
            isTVSelectable={true}>
            {loading
              ? <ActivityIndicator color="#fff"/>
              : <Text style={s.loginBtnText}>Sign In</Text>}
          </TouchableOpacity>
        </View>

        <Text style={s.footer}>IOTtech Smart Products Pvt. Ltd.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:    { flex:1, backgroundColor:'#F0FAF9' },
  scroll:       { flexGrow:1, justifyContent:'center', padding:24 },
  header:       { alignItems:'center', marginBottom:28 },
  logoWrap:     { width:280, height:100, backgroundColor:'#fff', borderRadius:16,
                  alignItems:'center', justifyContent:'center', marginBottom:16,
                  shadowColor:'#16A34A', shadowOffset:{width:0,height:4},
                  shadowOpacity:0.12, shadowRadius:12, elevation:5,
                  borderWidth:1, borderColor:'#BBF7D0', paddingHorizontal:16 },
  logoImg:      { width:260, height:60 },
  title:        { fontSize:24, fontWeight:'700', color:'#1A1A2E', letterSpacing:0.3 },
  subtitle:     { fontSize:13, color:'#6B7280', marginTop:4 },
  card:         { backgroundColor:'#fff',  width: '65%',
    maxWidth: 500,
    minWidth: 380,
    alignSelf: 'center', borderRadius:20, padding:24,
                  shadowColor:'#000', shadowOffset:{width:0,height:2},
                  shadowOpacity:0.08, shadowRadius:16, elevation:4,
                  borderWidth:1, borderColor:'#E5E7EB' },
  cardTitle:    { alignSelf: 'center', fontSize:20, fontWeight:'700', color:'#1A1A2E', marginBottom:4 },
  cardSub:      { fontSize:13, color:'#6B7280', marginBottom:24 },
  label:        { fontSize:12, fontWeight:'600', color:'#374151',
                  textTransform:'uppercase', letterSpacing:0.6,
                  marginBottom:8, marginTop:12 },
  optional:     { fontSize:11, color:'#9CA3AF', textTransform:'none', fontWeight:'400' },
  input:        { backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB',
                  borderRadius:12, paddingHorizontal:16, paddingVertical:13,
                  fontSize:15, color:'#1A1A2E', marginBottom:4 },
  inputErr:     { borderColor:'#EF4444' },
  prefixRow:    { flexDirection:'row', marginBottom:4 },
  prefixBox:    { backgroundColor:'#F0FDF4', borderWidth:1, borderColor:'#BBF7D0',
                  borderTopLeftRadius:12, borderBottomLeftRadius:12,
                  paddingHorizontal:12, justifyContent:'center' },
  prefixText:   { color:'#16A34A', fontSize:13, fontWeight:'700' },
  prefixInput:  { flex:1, backgroundColor:'#F9FAFB', borderWidth:1, borderColor:'#E5E7EB',
                  borderTopRightRadius:12, borderBottomRightRadius:12,
                  paddingHorizontal:14, paddingVertical:13,
                  fontSize:15, color:'#1A1A2E' },
  eyeBtn:       { position:'absolute', right:30, top:13 },
  eyeIcon:      { fontSize:20 },
  errText:      { fontSize:12, color:'#EF4444', marginBottom:8, marginTop:2 },
  advancedRow:  { marginTop:10, marginBottom:4, paddingVertical:8 },
  advancedTxt:  { fontSize:12, color:'#9CA3AF', textDecorationLine:'underline' },
  infoBox:      { backgroundColor:'#F0FDF4', borderRadius:10, padding:12,
                  marginTop:10, marginBottom:18,
                  borderWidth:1, borderColor:'#BBF7D0' },
  infoText:     { fontSize:12, color:'#6B7280', lineHeight:18 },
  infoCode:     { color:'#16A34A', fontWeight:'700' },
  errorCard:    { borderRadius:14, padding:16, marginTop:14, marginBottom:4, borderWidth:1 },
  errorCardNetwork: { backgroundColor:'#FFFBEB', borderColor:'#FDE68A' },
  errorCardAuth:    { backgroundColor:'#FEF2F2', borderColor:'#FECACA' },
  errorHeader:  { flexDirection:'row', alignItems:'center', marginBottom:6 },
  errorIcon:    { fontSize:20, marginRight:8 },
  errorTitle:   { fontSize:15, fontWeight:'700', color:'#1A1A2E' },
  errorMessage: { fontSize:13, color:'#4B5563', lineHeight:19 },
  errorDetailsText:   { fontSize:12, color:'#4B5563', marginTop:10, lineHeight:17, fontWeight:'600',
                        backgroundColor:'rgba(0,0,0,0.04)', borderRadius:8, padding:10 },
  loginBtn:     { backgroundColor:'#16A34A', borderRadius:12, paddingVertical:15,
                  alignItems:'center', marginTop:4,
                  shadowColor:'#16A34A', shadowOffset:{width:0,height:4},
                  shadowOpacity:0.3, shadowRadius:8, elevation:4 },
  loginBtnDim:  { backgroundColor:'#86EFAC' },
  loginBtnText: { color:'#fff', fontSize:16, fontWeight:'700' },
  footer:       { textAlign:'center', color:'#9CA3AF', fontSize:12, marginTop:24 },
});
