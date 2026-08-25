// src/context/AppContext.tsx
// UPDATED:
// - Issue 4: Auto-sync every 5 minutes (no manual button needed)
// - lastSyncTime tracked for UI display
// - FIX A: probeAndSetActiveUrl in try-catch
// - FIX B: _startServices always called after session restore
// - pendingFiles for background download

import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MqttService } from '../services/MqttService';
import { syncLocalFiles, loadLocalPlaylist } from '../services/StorageService';
import {
  TVLoginResponse, TVFile,
  sendHeartbeat, getTvFiles, reportStorage,
  reportDownloadComplete, probeAndSetActiveUrl, reportError,
} from '../services/api';

let RNFS: any = null;
try { RNFS = require('react-native-fs'); } catch (_) {}

const getRealStorage = async (): Promise<string> => {
  if (!RNFS?.getFSInfo) return '—';
  try {
    const info = await RNFS.getFSInfo();
    const freeMb = info.freeSpace / (1024*1024);
    const totMb  = info.totalSpace / (1024*1024);
    return freeMb >= 1024
      ? `${(freeMb/1024).toFixed(1)} GB free / ${(totMb/1024).toFixed(1)} GB`
      : `${Math.round(freeMb)} MB free / ${(totMb/1024).toFixed(1)} GB`;
  } catch { return '—'; }
};

export interface DownloadProgress {
  fileIndex: number; filePct: number; total: number;
}

interface AppState {
  tv:               TVLoginResponse | null;
  files:            TVFile[];
  pendingFiles:     TVFile[] | null;
  mqttConnected:    boolean;
  isLoggedIn:       boolean;
  shouldAutoPlay:   boolean;
  isSyncing:        boolean;
  downloadProgress: DownloadProgress | null;
  lastSyncTime:     Date | null;
  volume:           number;
}

interface AppContextValue extends AppState {
  login:          (tv: TVLoginResponse) => Promise<void>;
  logout:         () => Promise<void>;
  refreshFiles:   () => Promise<void>;
  syncNow:        () => Promise<void>;
  consumePending: () => void;
  setFiles:       (files: TVFile[]) => void;
  clearAutoPlay:  () => void;
  setVolume:      (v: number) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

const AUTO_SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutes

export function AppProvider({ children, onLogout }: {
  children: React.ReactNode; onLogout: () => void;
}) {
  const [tv,               setTv]               = useState<TVLoginResponse | null>(null);
  const [files,            setFiles]            = useState<TVFile[]>([]);
  const [pendingFiles,     setPendingFiles]     = useState<TVFile[] | null>(null);
  const [mqttConnected,    setMqttConnected]    = useState(false);
  const [isLoggedIn,       setIsLoggedIn]       = useState(false);
  const [shouldAutoPlay,   setShouldAutoPlay]   = useState(false);
  const [isSyncing,        setIsSyncing]        = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
  const [lastSyncTime,     setLastSyncTime]     = useState<Date | null>(null);
  const [shouldSkipCurrent,setShouldSkipCurrent] = useState(false);
  const [volume,           setVolume]           = useState<number>(50);

  const heartbeatRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const storageRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSyncRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const tvRef         = useRef<TVLoginResponse | null>(null);
  const syncingRef    = useRef(false);

  // Restore session
  useEffect(() => {
    (async () => {
      let saved: TVLoginResponse | null = null;
      try {
        const localFiles = await loadLocalPlaylist();
        if (localFiles.length > 0) {
          setFiles(localFiles);
          console.log(`[AppContext] Loaded ${localFiles.length} local files`);
        }
        const raw = await AsyncStorage.getItem('dms_tv');
        if (!raw) return;
        saved = JSON.parse(raw) as TVLoginResponse;
        try {
          if (typeof probeAndSetActiveUrl === 'function') await probeAndSetActiveUrl();
        } catch (e: any) {
          console.warn('[AppContext] URL probe failed (non-fatal):', e?.message || e);
        }
        setTv(saved); tvRef.current = saved; setIsLoggedIn(true);
        if (localFiles.some(f => _isMediaFile(f.file_name))) setShouldAutoPlay(true);
      } catch (e) { console.warn('[AppContext] Session restore error:', e); }
      if (saved) {
        try {
          setTv(saved); tvRef.current = saved; setIsLoggedIn(true);
          _startServices(saved);
        } catch (e) { console.warn('[AppContext] _startServices failed:', e); }
      }
    })();
    return () => _stopServices();
  }, []);

  const login = async (tvData: TVLoginResponse) => {
    try {
      await AsyncStorage.setItem('dms_tv', JSON.stringify(tvData));
      if (tvData.token) await AsyncStorage.setItem('dms_token', tvData.token);
    } catch (e) { console.warn('[AppContext] Save session failed:', e); }
    setTv(tvData); tvRef.current = tvData; setIsLoggedIn(true);
    _startServices(tvData);
  };

  const logout = async () => {
    try { _stopServices(); await AsyncStorage.multiRemove(['dms_tv','dms_token']); }
    catch (e) { console.warn('[AppContext] Logout failed:', e); }
    setTv(null); tvRef.current = null;
    setFiles([]); setPendingFiles(null);
    setMqttConnected(false); setIsLoggedIn(false);
    setShouldAutoPlay(false); setIsSyncing(false);
    setDownloadProgress(null); setLastSyncTime(null);
    try { onLogout(); } catch (_) {}
  };

  const refreshFiles = async () => {
    const cur = tvRef.current;
    if (!cur) return;
    try {
      const list = await getTvFiles(cur.tv_id, cur.db_name);
      setFiles(list);
    } catch { console.log('[Files] Refresh failed — keeping local cache'); }
  };

  // Background sync — never interrupts current loop
  const filesRef = useRef<TVFile[]>([]);
  useEffect(() => { filesRef.current = files; }, [files]);

  const syncNow = useCallback(async () => {
    const cur = tvRef.current;
    if (!cur || syncingRef.current) return;
    syncingRef.current = true;
    setIsSyncing(true);
    setDownloadProgress(null);
    try {
      console.log('[Sync] Fetching file list...');
      const serverFiles = await getTvFiles(cur.tv_id, cur.db_name);
      console.log(`[Sync] ${serverFiles.length} file(s) from server`);
      const downloaded = await syncLocalFiles(
        serverFiles,
        (fileIndex, filePct, total) => setDownloadProgress({ fileIndex, filePct, total })
      );
      console.log(`[Sync] ✅ ${downloaded.length} playable files ready`);
      if (downloaded.length > 0) {
        await reportDownloadComplete(cur.tv_id, cur.db_name, 0);
        MqttService.publishCompleted();
      }
      setPendingFiles(downloaded);
      setLastSyncTime(new Date());

      // FIX: Auto-play when new content arrives (not just on boot)
      // Only triggers if files actually changed (prevents forcing back to Player on periodic sync)
      // Use ref for current files (avoids stale closure)
      const currentIds = new Set(filesRef.current.map((f: TVFile) => f.id));
      const hasNewFiles = downloaded.length !== filesRef.current.length ||
        downloaded.some((f: TVFile) => !currentIds.has(f.id));
      if (downloaded.length > 0 && hasNewFiles) {
        console.log('[AutoPlay] New content detected — triggering auto-play');
        setShouldAutoPlay(true);
      }
    } catch (e) {
      console.warn('[Sync] Failed — keeping current playlist:', e);
      const local = await loadLocalPlaylist();
      if (local.length > 0 && files.length === 0) setFiles(local);
    } finally {
      setIsSyncing(false);
      setDownloadProgress(null);
      syncingRef.current = false;
    }
  }, []);

  const consumePending = useCallback(() => {
    setPendingFiles(prev => {
      if (prev !== null) {
        console.log(`[AppContext] Swapping playlist → ${prev.length} files`);
        setFiles(prev);
      }
      return null;
    });
  }, []);

  const clearAutoPlay = () => setShouldAutoPlay(false);
  const clearSkipCurrent = () => setShouldSkipCurrent(false);

  const _startServices = (tvData: TVLoginResponse) => {
    _stopServices();
    MqttService.init(tvData.tv_id, tvData.db_name);
    MqttService.onConnectionChange(setMqttConnected);

    const handleCmd = (cmd: string) => {
      console.log('[AppContext] MQTT cmd:', cmd);
      if (cmd === 'reload') logout();
      if (cmd === 'true' || cmd === '1') {
        // Option A: syncNow + signal PlayerScreen to skip current file immediately
        setShouldSkipCurrent(true);
        syncNow();
      }
      // FIX 5: Dynamic volume from MQTT
      try {
        const parsed = JSON.parse(cmd);
        if (parsed?.type === 'volume' && typeof parsed.volume === 'number') {
          console.log('[AppContext] MQTT volume:', parsed.volume);
          setVolume(parsed.volume);
        }
      } catch {}
    };
    MqttService.onCommand(handleCmd);

    // Heartbeat every 30s
    heartbeatRef.current = setInterval(() => {
      sendHeartbeat({ tv_id: tvData.tv_id, status:'ONLINE', db_name: tvData.db_name, uptime_minutes:1 })
        .catch(() => {});
    }, 30000);

    // Storage report every 5 min
    const reportRealStorage = async () => {
      const s = await getRealStorage();
      reportStorage(tvData.tv_id, tvData.db_name, s).catch(() => {});
    };
    reportRealStorage();
    storageRef.current = setInterval(reportRealStorage, 300000);

    // Issue 4: Auto-sync — immediate + every 5 minutes
    setTimeout(() => syncNow(), 4000);
    autoSyncRef.current = setInterval(() => {
      console.log('[AutoSync] Periodic sync triggered');
      syncNow();
    }, AUTO_SYNC_INTERVAL);
  };

  const _stopServices = () => {
    MqttService.disconnect();
    if (heartbeatRef.current) { clearInterval(heartbeatRef.current); heartbeatRef.current = null; }
    if (storageRef.current)   { clearInterval(storageRef.current);   storageRef.current   = null; }
    if (autoSyncRef.current)  { clearInterval(autoSyncRef.current);  autoSyncRef.current  = null; }
  };

  return (
    <AppContext.Provider value={{
      tv, files, pendingFiles, mqttConnected, isLoggedIn,
      shouldAutoPlay, isSyncing, downloadProgress, lastSyncTime,
      login, logout, refreshFiles, syncNow, consumePending, setFiles, clearAutoPlay, clearSkipCurrent, setVolume,
      volume, shouldSkipCurrent,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const _isMediaFile = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['mp4','mov','avi','webm','mkv','jpg','jpeg','png','webp','gif','bmp'].includes(ext);
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be inside AppProvider');
  return ctx;
}

