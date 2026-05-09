import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, ipcMain } from 'electron';

let mainWindow: BrowserWindow | null = null;

export function initAutoUpdater(win: BrowserWindow) {
  mainWindow = win;

  autoUpdater.autoDownload = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:status', {
      status: 'available',
      version: info.version,
    });
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:status', {
      status: 'downloading',
      percent: Math.floor(progress.percent),
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:status', {
      status: 'downloaded',
      version: info.version,
    });
  });

  autoUpdater.on('error', (err) => {
    console.error('[Updater]', err.message);
    mainWindow?.webContents.send('update:status', { status: 'error', message: err.message });
  });

  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      console.error('[Updater] Check failed:', err.message);
    });
  }, 3000);

  registerIPC();
}

function registerIPC() {
  ipcMain.handle('app:getVersion', () => app.getVersion());

  ipcMain.handle('update:check', async () => {
    try {
      const result = await autoUpdater.checkForUpdates();
      const version = result?.updateInfo?.version;
      return { updateAvailable: !!version, version: version ?? null };
    } catch (err: any) {
      return { updateAvailable: false, error: err.message };
    }
  });

  ipcMain.handle('update:quit-and-install', () => {
    autoUpdater.quitAndInstall();
  });
}
