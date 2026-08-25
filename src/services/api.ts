// src/services/api.ts
// UPDATED: Added getTvAnnouncements + probeAndSetActiveUrl export
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

let Config: any = {};
try { Config = require('react-native-config').default; } catch (_) {}

const USE_LOCAL = Config.USE_LOCAL !== 'false';

const parseUrls = (raw: string): string[] =>
  (raw || '').split(',').map(u => u.trim()).filter(u => u.startsWith('http'));

export const ENV = {
  USE_LOCAL,
  API_URLS: USE_LOCAL
    ? (parseUrls(Config.LOCAL_API_URL || '').length > 0
        ? parseUrls(Config.LOCAL_API_URL)
        : ['http://localhost:5004', 'http://192.168.1.101:5004'])
    : (parseUrls(Config.PROD_API_URL || '').length > 0
        ? parseUrls(Config.PROD_API_URL)
        : ['https://ispplsop.com']),  // fallback online URL
  MQTT_HOST: USE_LOCAL ? (Config.LOCAL_MQTT_HOST || '') : (Config.PROD_MQTT_HOST || ''),
  MQTT_PORT: USE_LOCAL ? Number(Config.LOCAL_MQTT_PORT || 9001) : Number(Config.PROD_MQTT_PORT || 9001),
  MQTT_USER: USE_LOCAL ? (Config.LOCAL_MQTT_USER || '') : (Config.PROD_MQTT_USER || ''),
  MQTT_PASS: USE_LOCAL ? (Config.LOCAL_MQTT_PASS || '') : (Config.PROD_MQTT_PASS || ''),
  PDF_DURATION:   Number(Config.PDF_DURATION   || 50),
  DOC_DURATION:   Number(Config.DOC_DURATION   || 50),
  IMAGE_DURATION: Number(Config.IMAGE_DURATION || 10),
};

// DEBUG: log env values on startup
console.log('[ENV] USE_LOCAL:', USE_LOCAL, '| Config.USE_LOCAL:', Config.USE_LOCAL);
console.log('[ENV] PROD_API_URL:', Config.PROD_API_URL);
console.log('[ENV] API_URLS:', JSON.stringify(ENV.API_URLS));
console.log('[ENV] MQTT_HOST:', ENV.MQTT_HOST, 'PORT:', ENV.MQTT_PORT);

export const BASE_URLS = ENV.API_URLS;
let ACTIVE_URL = BASE_URLS[0] || '';
export const getBaseUrl = () => ACTIVE_URL;

const api = axios.create({ timeout: 15000, headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(async (config) => {
  config.baseURL = ACTIVE_URL;
  const token = await AsyncStorage.getItem('dms_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) await AsyncStorage.multiRemove(['dms_token', 'dms_tv']);
    return Promise.reject(err?.response?.data?.error || err.message || 'Request failed');
  }
);

export interface TVLoginResponse {
  success: boolean; tv_id: number; tv_name: string; volume: number;
  loop_interval_minutes: number; playlist_mode: string;
  db_name: string; client_id: number; token?: string;
}

export interface TVFile {
  id: number; tv_id: number; file_url: string; file_name: string;
  local_path?: string; duration: number; doc_duration_seconds?: number;
  sequence: number; volume: number;
  loop_interval_minutes: number; playlist_mode: string; last_updated: string;
}

export interface TVAnnouncement {
  id: number; message: string; type: 'good-news' | 'alert' | 'info';
  duration_minutes: number; expires_at: string; created_at: string;
}

// Try each URL — first one that responds wins
export const tvLogin = async (username: string, password: string, db_name: string): Promise<TVLoginResponse> => {
  if (BASE_URLS.length === 0) throw 'No server URLs configured. Check your .env file.';
  for (const url of BASE_URLS) {
    try {
      const res = await axios.post(`${url}/api/tv/login`, { username, password, db_name },
        { timeout: 8000, headers: { 'Content-Type': 'application/json' } });
      ACTIVE_URL = url;
      return res.data;
    } catch (e: any) {
      if (e.response) {
        ACTIVE_URL = url;
        throw e.response.data?.error || `Login failed (${e.response.status})`;
      }
    }
  }
  throw `Cannot connect to server. URLs tried: ${BASE_URLS.join(', ')}. Check your .env file.`;
};

// Probe all URLs and set ACTIVE_URL to the first that responds
export const probeAndSetActiveUrl = async (): Promise<void> => {
  for (const url of BASE_URLS) {
    try {
      await axios.get(`${url}/health`, { timeout: 4000 });
      ACTIVE_URL = url;
      console.log(`[API] Active URL: ${ACTIVE_URL}`);
      return;
    } catch {}
  }
  console.warn('[API] No URL responded to probe');
};

export const getTvFiles = async (tv_id: number, db_name: string): Promise<TVFile[]> => {
  const res = await api.get(`/api/tv/files/${tv_id}`, { params: { db_name } });
  return res.data;
};

export const getTvAnnouncements = async (tv_id: number, db_name: string): Promise<{ announcements: TVAnnouncement[] }> => {
  try {
    const res = await api.get(`/api/tv/announcements/${tv_id}`, { params: { db_name } });
    return res.data;
  } catch {
    return { announcements: [] };
  }
};

export const sendHeartbeat = async (payload: {
  tv_id: number; status: 'ONLINE' | 'OFFLINE'; db_name: string;
  temperature?: string; uptime_minutes?: number; content_loops?: number;
}) => { const res = await api.post('/api/tv/status', payload); return res.data; };

export const reportStorage = async (tv_id: number, db_name: string, storage_available: string) => {
  const res = await api.post('/api/tv/storage', { tv_id, db_name, storage_available }); return res.data;
};

export const reportDownloadComplete = async (tv_id: number, db_name: string, production_line_id: number) => {
  const res = await api.post('/api/tv/download-complete', { tv_id, db_name, production_line_id }); return res.data;
};

export const reportError = async (payload: {
  tv_id: number; db_name: string;
  error_type: 'playback' | 'download' | 'network' | 'hardware' | 'other'; error_message: string;
}) => { try { await api.post('/api/tv/error', payload); } catch (_) {} };

export const getVolume = async (tv_id: number, db_name: string) => {
  const res = await api.get(`/api/tv/volume/${tv_id}`, { params: { db_name } }); return res.data;
};

export default api;