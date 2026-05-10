import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, ipcMain } from 'electron';

export interface UpdateStatus {
  status: 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}

let mainWindow: BrowserWindow | null = null;
let lastStatus: UpdateStatus | null = null;
let checkError: string | null = null;

function sendStatus(s: UpdateStatus) {
  lastStatus = s;
  if (s.status === 'error') checkError = s.message || null;
  mainWindow?.webContents.send('update:status', s);
}

export function initAutoUpdater(win: BrowserWindow) {
  mainWindow = win;

  autoUpdater.autoDownload = false;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('update-available', (info) => {
    sendStatus({ status: 'available', version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    sendStatus({ status: 'downloading', percent: Math.floor(progress.percent) });
  });

  autoUpdater.on('update-downloaded', (info) => {
    sendStatus({ status: 'downloaded', version: info.version });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater]', err.message);
    sendStatus({ status: 'error', message: err.message });
  });

  // Initial check — 3s delay so renderer has time to mount its listener.
  // The promise's .catch() only logs; real errors fire the 'error' event above
  // which already sends status to the renderer. "No update" also rejects but
  // does NOT fire the error event — we handle that silently.
  setTimeout(() => {
    autoUpdater.checkForUpdates().then((result) => {
      if (result?.updateInfo?.version) {
        console.log('[Updater] Update available:', result.updateInfo.version);
      }
    }).catch((err) => {
      if (lastStatus?.status === 'error') {
        console.error('[Updater] Check failed:', err.message);
      } else {
        console.log('[Updater] No update available (current:', app.getVersion(), ')');
      }
    });
  }, 3000);

  registerIPC();
}

function registerIPC() {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  // Allow renderer to query the last-known status on mount (handles
  // the race where the event fired before the listener was attached)
  ipcMain.handle('update:getStatus', () => lastStatus);

  ipcMain.handle('update:check', async () => {
    checkError = null;
    try {
      const result = await autoUpdater.checkForUpdates();
      const version = result?.updateInfo?.version;
      return { updateAvailable: !!version, version: version ?? null };
    } catch (err: any) {
      if (checkError) {
        return { updateAvailable: false, error: checkError };
      }
      lastStatus = null;
      mainWindow?.webContents.send('update:status', null);
      return { updateAvailable: false, error: null };
    }
  });

  ipcMain.handle('update:quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });

  ipcMain.handle('update:download', async () => {
    try {
      await autoUpdater.downloadUpdate();
      return { ok: true };
    } catch (err: any) {
      return { ok: false, error: err.message };
    }
  });
}
