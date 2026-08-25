// src/services/StorageService.ts
// FIX B: files that return 404 → excluded from playlist, loop never crashes
// FIX C: file_url hostname replaced with active server IP
// FIX E: getPlayUrl returns file:// prefix for local files (ExoPlayer needs it)

import AsyncStorage from '@react-native-async-storage/async-storage';
import { TVFile, getBaseUrl } from './api';

let RNFS: any = null;
try { RNFS = require('react-native-fs'); } catch (_) {
  console.warn('[Storage] react-native-fs not installed — using URL fallback');
}

const PLAYLIST_KEY = 'dms_local_playlist';
const MEDIA_DIR    = () => RNFS ? `${RNFS.DocumentDirectoryPath}/dms_media` : null;

const ensureDir = async () => {
  if (!RNFS) return;
  const dir = MEDIA_DIR()!;
  if (!(await RNFS.exists(dir))) await RNFS.mkdir(dir);
};

// FIX C: rewrite host/port in file_url to match the active server
const normalizeUrl = (rawUrl: string): string => {
  const active = getBaseUrl();
  if (!active || !rawUrl) return rawUrl;
  try {
    const src  = new URL(rawUrl);
    const base = new URL(active);
    src.hostname = base.hostname;
    src.port     = base.port;
    src.protocol = base.protocol;
    return src.toString();
  } catch {
    return rawUrl;
  }
};

// FIX B: returns null on ANY failure (404, network error, corrupt file)
const downloadFile = async (
  file: TVFile,
  onProgress?: (pct: number) => void
): Promise<string | null> => {
  if (!RNFS) return null;
  try {
    await ensureDir();
    const localName = `${file.id}_${file.file_name.replace(/[^a-zA-Z0-9._]/g, '_')}`;
    const localPath = `${MEDIA_DIR()}/${localName}`;

    // Already cached — verify non-empty
    if (await RNFS.exists(localPath)) {
      const stat = await RNFS.stat(localPath).catch(() => null);
      if (stat && stat.size > 0) {
        onProgress?.(100);
        return localPath;
      }
      await RNFS.unlink(localPath).catch(() => {});
    }

    const downloadUrl = normalizeUrl(file.file_url);
    console.log(`[Storage] Downloading: ${file.file_name}`);

    const result = await RNFS.downloadFile({
      fromUrl: downloadUrl,
      toFile:  localPath,
      headers: { Accept: '*/*' },
      progress: (p: any) => {
        const pct = p.contentLength > 0
          ? Math.round((p.bytesWritten / p.contentLength) * 100) : 0;
        onProgress?.(pct);
      },
    }).promise;

    if (result.statusCode === 200) {
      const stat = await RNFS.stat(localPath).catch(() => null);
      if (stat && stat.size > 0) {
        console.log(`[Storage] ✅ Downloaded: ${file.file_name} (${stat.size} bytes)`);
        return localPath;
      }
    }

    // Non-200 or empty = failure
    console.warn(`[Storage] ❌ Failed: ${file.file_name} (HTTP ${result.statusCode})`);
    await RNFS.unlink(localPath).catch(() => {});
    return null;

  } catch (e) {
    console.warn(`[Storage] ❌ Error: ${file.file_name}:`, e);
    return null;
  }
};

// FIX B: only files with successful download included in returned playlist
export const syncLocalFiles = async (
  serverFiles: TVFile[],
  onProgress?: (fileIndex: number, filePct: number, total: number) => void
): Promise<TVFile[]> => {
  if (!RNFS) {
    await savePlaylist(serverFiles);
    return serverFiles;
  }

  const playable: TVFile[] = [];

  for (let i = 0; i < serverFiles.length; i++) {
    const file = serverFiles[i];
    onProgress?.(i, 0, serverFiles.length);

    const localPath = await downloadFile(file, (pct) => {
      onProgress?.(i, pct, serverFiles.length);
    });

    if (localPath) {
      playable.push({ ...file, local_path: localPath });
    } else {
      console.warn(`[Storage] Skipping from playlist: ${file.file_name}`);
    }
  }

  console.log(`[Storage] ${playable.length}/${serverFiles.length} files playable`);
  await cleanOldFiles(playable);
  await savePlaylist(playable);
  return playable;
};

const cleanOldFiles = async (currentFiles: TVFile[]) => {
  // FIX 6: Also remove files deleted from server (not in current server list)
  if (!RNFS) return;
  try {
    const dir = MEDIA_DIR()!;
    if (!(await RNFS.exists(dir))) return;
    const allFiles  = await RNFS.readDir(dir);
    const keepPaths = new Set(currentFiles.map(f => f.local_path).filter(Boolean));
    for (const f of allFiles) {
      if (!keepPaths.has(f.path)) {
        await RNFS.unlink(f.path);
      }
    }
  } catch (e) {
    console.warn('[Storage] Clean failed:', e);
  }
};

export const savePlaylist = async (files: TVFile[]) => {
  try {
    await AsyncStorage.setItem(PLAYLIST_KEY, JSON.stringify({
      files, saved_at: new Date().toISOString(),
    }));
  } catch (e) {
    console.warn('[Storage] Failed to save playlist:', e);
  }
};

export const loadLocalPlaylist = async (): Promise<TVFile[]> => {
  try {
    const raw = await AsyncStorage.getItem(PLAYLIST_KEY);
    if (!raw) return [];
    const files: TVFile[] = (JSON.parse(raw).files || []);
    if (!RNFS) return files;

    const verified: TVFile[] = [];
    for (const f of files) {
      if (f.local_path) {
        try {
          const exists = await RNFS.exists(f.local_path);
          // FIX: also check file has actual content (not 0-byte)
          if (exists) {
            const stat = await RNFS.stat(f.local_path).catch(() => null);
            if (stat && stat.size > 0) {
              verified.push(f);
              continue;
            }
          }
        } catch {}
        // File missing or corrupt — include without local_path (will re-download on next sync)
        verified.push({ ...f, local_path: undefined });
      } else {
        verified.push(f);
      }
    }
    return verified;
  } catch (e) {
    console.warn('[Storage] Failed to load playlist:', e);
    return [];
  }
};

// FIX E: always return file:// prefixed path for local files
export const getPlayUrl = (file: TVFile): string => {
  if (file.local_path && RNFS) {
    return file.local_path.startsWith('file://')
      ? file.local_path
      : `file://${file.local_path}`;
  }
  return normalizeUrl(file.file_url);
};

// Re-export for PlayerScreen
export const _isMediaFile = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  return ['mp4','mov','avi','webm','mkv','jpg','jpeg','png','webp','gif','bmp'].includes(ext);
};

export const hasLocalStorage = () => !!RNFS;
