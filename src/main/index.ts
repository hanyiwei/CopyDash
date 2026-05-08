import { app, BrowserWindow, ipcMain, globalShortcut, Tray, Menu, clipboard, nativeImage, protocol, screen, shell } from 'electron';
import path from 'path';
import { is } from '@electron-toolkit/utils';
import { startMonitoring, markContentHash } from './monitor';
import { initDB, dbQuery } from './db/database';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import fs from 'fs';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let registerToggleShortcut: (accelerator: string) => boolean;

function safeSend(channel: string, ...args: any[]) {
  try { mainWindow?.webContents?.send(channel, ...args); } catch {}
}
let lastForegroundHwnd: string | null = null;

function captureForeground(): void {
  if (process.platform !== 'win32') return;
  const script = `
    Add-Type -Name PB_Cap -Namespace PB -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();' -ErrorAction SilentlyContinue
    $hwnd = [PB.PB_Cap]::GetForegroundWindow()
    if ($hwnd -ne [IntPtr]::Zero) { Write-Output $hwnd.ToString() }
  `;
  const encodedCapture = Buffer.from(script.replace(/\n/g, ' '), 'utf16le').toString('base64');
  exec(`powershell -EncodedCommand ${encodedCapture}`, { timeout: 2000, windowsHide: true }, (error, stdout) => {
    if (!error && stdout.trim()) {
      lastForegroundHwnd = stdout.trim();
      console.log('[Main] Captured foreground HWND:', lastForegroundHwnd);
    }
  });
}

// Register custom protocol for local images
protocol.registerSchemesAsPrivileged([
  { scheme: 'cd-file', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true } }
]);

async function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight, x: screenX, y: screenY } = primaryDisplay.workArea;
  
  // Paste-like panel usually takes a good portion of the width, but not necessarily full
  const winWidth = Math.floor(screenWidth * 0.9); 
  const winHeight = Math.min(420, Math.floor(screenHeight * 0.55));

  mainWindow = new BrowserWindow({
    width: winWidth,
    height: winHeight,
    x: screenX + Math.floor((screenWidth - winWidth) / 2),
    y: screenY + screenHeight - winHeight,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    backgroundColor: '#00000000', // Fully transparent
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      devTools: true
    },
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Prevent default Electron context menu on the window
  mainWindow.webContents.on('context-menu', (e) => {
    e.preventDefault();
  });

  mainWindow.on('blur', () => {
    safeSend('window-hide-start');
    // Renderer handles hide timing after animation
  });

  mainWindow.on('focus', () => {
    safeSend('window-focus');
  });
}

function createTray() {
  try {
    const iconPath = path.join(__dirname, '../../resources/icon.png');
    const icon = nativeImage.createFromPath(iconPath);
    
    if (icon.isEmpty()) {
      console.error('Tray icon is empty at:', iconPath);
      // Create a small empty image as fallback to prevent crash
      const emptyIcon = nativeImage.createEmpty();
      tray = new Tray(emptyIcon);
    } else {
      tray = new Tray(icon);
    }

    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show CopyDash', click: () => { captureForeground(); mainWindow?.showInactive(); setTimeout(() => safeSend('window-shown'), 50); } },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]);
    tray.setToolTip('CopyDash');
    tray.setContextMenu(contextMenu);
  } catch (err) {
    console.error('Tray creation error:', err);
  }
}

app.whenReady().then(async () => {
  // Protocol handler
  protocol.handle('cd-file', (request) => {
    try {
      let filePath = decodeURIComponent(request.url.replace('cd-file://', ''));
      filePath = filePath.replace(/\//g, path.sep);
      const data = fs.readFileSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const mime = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : 'image/png';
      return new Response(data, { headers: { 'Content-Type': mime } });
    } catch (err: any) {
      console.error('[cd-file] Failed to load:', request.url, 'Error:', err?.message);
      return new Response(null, { status: 404 });
    }
  });

  await initDB();

  // Auto-launch on startup
  const autoLaunchRow = dbQuery.get("SELECT value FROM settings WHERE key = ?", ['auto_launch']);
  const openAtLogin = autoLaunchRow?.value === '1';
  app.setLoginItemSettings({ openAtLogin, path: process.execPath, args: [] });

  await createWindow();
  createTray();

    // Global Shortcut — read from settings, default to Ctrl+Shift+V
    const shortcutSetting = dbQuery.get('SELECT value FROM settings WHERE key = ?', ['shortcut_toggle']);
    const defaultShortcut = 'Ctrl+Shift+V';
    if (!shortcutSetting) {
      dbQuery.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shortcut_toggle', defaultShortcut]);
    }
    const shortcutAccelerator = shortcutSetting?.value || defaultShortcut;

    registerToggleShortcut = (accelerator: string): boolean => {
      globalShortcut.unregisterAll();
      try {
        const ok = globalShortcut.register(accelerator, () => {
          console.log('[Main] Toggle shortcut pressed');
          if (mainWindow?.isVisible()) {
            safeSend('window-hide-start');
          } else {
            mainWindow?.showInactive();
            safeSend('window-shown');
            captureForeground();
          }
        });
        if (ok) {
          console.log(`[Main] Shortcut registered: ${accelerator}`);
        }
        return ok;
      } catch {
        return false;
      }
    }

    if (!registerToggleShortcut(shortcutAccelerator)) {
      console.error(`[Main] Failed to register shortcut: ${shortcutAccelerator}. It may be in use by another app.`);
    }

  // Tray click
  tray?.on('click', () => {
    if (mainWindow?.isVisible()) {
      safeSend('window-hide-start');
    } else {
      mainWindow?.showInactive();
      safeSend('window-shown');
      captureForeground();
    }
  });

  // Start Monitoring
  startMonitoring((clip) => {
    console.log('[Main] Sending new-clip to renderer:', clip.id, 'Type:', clip.type);
    safeSend('new-clip', clip);
  });
});

// Open URL in system default browser
ipcMain.handle('shell:openExternal', (_, url: string) => {
  shell.openExternal(url);
});

// Settings handlers
ipcMain.handle('db:settings:get', (_, key: string) => {
  const row = dbQuery.get('SELECT value FROM settings WHERE key = ?', [key]);
  return row?.value ?? null;
});

ipcMain.handle('db:settings:set', (_, key: string, value: string) => {
  dbQuery.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
});

ipcMain.handle('shortcut:update', (_, accelerator: string) => {
  if (!accelerator || typeof accelerator !== 'string') {
    return { ok: false, error: 'Invalid shortcut' };
  }
  const ok = registerToggleShortcut(accelerator);
  if (ok) {
    dbQuery.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['shortcut_toggle', accelerator]);
    safeSend('shortcut-changed', accelerator);
    return { ok: true };
  }
  // Re-register the old shortcut on failure
  const old = dbQuery.get('SELECT value FROM settings WHERE key = ?', ['shortcut_toggle']);
  if (old?.value) registerToggleShortcut(old.value);
  return { ok: false, error: 'Shortcut in use by another app' };
});

ipcMain.handle('setting:setAutoLaunch', (_, enable: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enable, path: process.execPath, args: [] });
  dbQuery.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', ['auto_launch', enable ? '1' : '0']);
  return enable;
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC Handlers
ipcMain.handle('db:getAll', () => {
    const row = dbQuery.get('SELECT value FROM settings WHERE key = ?', ['max_history']);
    const limit = row ? parseInt(row.value, 10) || 200 : 200;
    const clips = dbQuery.all('SELECT * FROM clip_history ORDER BY created_at DESC LIMIT ?', [limit]);
    console.log(`[Main] Loaded ${clips.length} clips from DB (limit: ${limit})`);
    return clips;
  });

  ipcMain.on('window:hide', () => {
    mainWindow?.hide();
  });

  ipcMain.on('renderer-log', (_, level, ...args) => {
    console.log(`[Renderer ${level}]`, ...args);
  });

ipcMain.handle('db:deleteById', (_, id: string) => {
  return dbQuery.run('DELETE FROM clip_history WHERE id = ?', [id]);
});

ipcMain.handle('db:clearAll', () => {
  dbQuery.run('DELETE FROM clip_history');
});

ipcMain.handle('db:updatePin', (_, id: string, isPinned: number) => {
  return dbQuery.run('UPDATE clip_history SET is_pinned = ? WHERE id = ?', [isPinned, id]);
});

ipcMain.handle('clipboard:writeText', (_, text: string) => {
    clipboard.writeText(text);
  });

  ipcMain.handle('clipboard:writeAndPaste', async (_, clip: any, plainText: boolean = false) => {
  console.log('Paste requested:', clip.id, 'Plain:', plainText);
  try {
    if (clip.type === 1) {
      if (plainText) {
        clipboard.writeText(clip.content_text);
      } else {
        clipboard.write({
          text: clip.content_text,
          html: clip.content_html
        });
      }
      markContentHash(clip.content_text || '', clip.content_html || '');
    } else if (clip.type === 4) {
      // Write file paths back to clipboard via PowerShell.
      // Use base64-encoded JSON to avoid any path-escaping issues.
      const paths: string[] = JSON.parse(clip.content_text || '[]');
      if (paths.length > 0) {
        const pathsJson = JSON.stringify(paths);
        const pathsBase64 = Buffer.from(pathsJson, 'utf8').toString('base64');
        const fileClipScript = `
          $json = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String('${pathsBase64}'))
          $paths = $json | ConvertFrom-Json
          $col = New-Object System.Collections.Specialized.StringCollection
          foreach ($p in $paths) { $null = $col.Add($p) }
          Add-Type -AssemblyName System.Windows.Forms
          [System.Windows.Forms.Clipboard]::SetFileDropList($col)
        `;
        const encoded = Buffer.from(fileClipScript.replace(/\n/g, ' '), 'utf16le').toString('base64');
        await execAsync(`powershell -STA -EncodedCommand ${encoded}`, { timeout: 3000, windowsHide: true });
      }
    } else if (clip.type === 2) {
      const img = nativeImage.createFromPath(clip.image_path);
      clipboard.writeImage(img);
    }

    mainWindow?.blur();
    mainWindow?.hide();

    // Wait for renderer hide animation (280ms) + margin
    await new Promise(resolve => setTimeout(resolve, 400));

    if (process.platform === 'win32') {
      const keys = '^v';
      let script: string;
      if (lastForegroundHwnd) {
        const hwnd = lastForegroundHwnd;
        script = `
          Add-Type -Name PB_Rest -Namespace PB -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId); [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();' -ErrorAction SilentlyContinue
          $target = [IntPtr]::new(${hwnd})
          $cur = [PB.PB_Rest]::GetForegroundWindow()
          $tid1 = 0; $tid2 = 0
          [PB.PB_Rest]::GetWindowThreadProcessId($target, [ref]$tid1)
          [PB.PB_Rest]::GetWindowThreadProcessId($cur, [ref]$tid2)
          if ($tid1 -ne $tid2) { [PB.PB_Rest]::AttachThreadInput([PB.PB_Rest]::GetCurrentThreadId(), $tid2, $true) }
          [PB.PB_Rest]::SetForegroundWindow($target)
          if ($tid1 -ne $tid2) { [PB.PB_Rest]::AttachThreadInput([PB.PB_Rest]::GetCurrentThreadId(), $tid2, $false) }
          // 80ms sleep for SetForegroundWindow to complete before SendKeys
          Start-Sleep -Milliseconds 80
          $wshell = New-Object -ComObject WScript.Shell;
          $wshell.SendKeys('${keys}');
        `;
      } else {
        script = `
          $wshell = New-Object -ComObject WScript.Shell;
          $wshell.SendKeys('${keys}');
        `;
      }
      const encodedPaste = Buffer.from(script.replace(/\n/g, ' '), 'utf16le').toString('base64');
      exec(`powershell -EncodedCommand ${encodedPaste}`, { windowsHide: true }, (error) => {
        if (error) console.error('Paste execution error:', error);
      });
    }
    return true;
  } catch (err) {
    console.error('Paste handler error:', err);
    return false;
  }
});

ipcMain.handle('menu:showContext', (event, clip: any) => {
  const items: Electron.MenuItemConstructorOptions[] = [];

  // Copy (text + file types)
  if (clip.type === 1 || clip.type === 4) {
    items.push({
      label: 'Copy',
      click: () => event.sender.send('menu-action', { action: 'copy', clip })
    });
  }

  // Pin / Unpin (all types)
  items.push({
    label: clip.is_pinned ? 'Unpin' : 'Pin',
    click: () => event.sender.send('menu-action', { action: 'toggle-pin', clip })
  });

  // Paste as Plain Text (text type only)
  if (clip.type === 1) {
    items.push({
      label: 'Paste as Plain Text',
      click: () => event.sender.send('menu-action', { action: 'paste-plain', clip })
    });
  }

  // Paste (all types)
  items.push({
    label: 'Paste',
    click: () => event.sender.send('menu-action', { action: 'paste', clip })
  });

  items.push({ type: 'separator' });

  // Delete — visually distinct label
  items.push({
    label: 'Delete',
    click: () => event.sender.send('menu-action', { action: 'delete', clip })
  });

  const menu = Menu.buildFromTemplate(items);
  menu.popup({ window: BrowserWindow.fromWebContents(event.sender)! });
});
