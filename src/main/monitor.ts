import { clipboard } from 'electron';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { dbQuery, imagesPath } from './db/database';
import path from 'path';
import fs from 'fs';
import Jimp from 'jimp';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
let lastHash = '';

export function markContentHash(text: string, html?: string) {
  lastHash = crypto.createHash('md5').update(text + (html || '')).digest('hex');
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; }
  else if (h < 120) { r = x; g = c; }
  else if (h < 180) { g = c; b = x; }
  else if (h < 240) { g = x; b = c; }
  else if (h < 300) { r = x; b = c; }
  else { r = c; b = x; }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function extractFirstColor(text: string): { hex: string; rgb: string } | null {
  // Try hex first
  const hexMatch = text.match(/#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})\b/);
  if (hexMatch) {
    let hex = hexMatch[0];
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { hex: hex.toUpperCase(), rgb: `rgb(${r}, ${g}, ${b})` };
  }

  // Try rgb/rgba
  const rgbMatch = text.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+)?\s*\)/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]), g = parseInt(rgbMatch[2]), b = parseInt(rgbMatch[3]);
    return { hex: rgbToHex(r, g, b), rgb: `rgb(${r}, ${g}, ${b})` };
  }

  // Try hsl/hsla
  const hslMatch = text.match(/hsla?\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*(?:,\s*[\d.]+)?\s*\)/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1]), s = parseInt(hslMatch[2]), l = parseInt(hslMatch[3]);
    const [r, g, b] = hslToRgb(h, s, l);
    return { hex: rgbToHex(r, g, b), rgb: `rgb(${r}, ${g}, ${b})` };
  }

  return null;
}

// Minimal RTF → plain-text converter. Strips RTF tags, keeps text content
// and basic structure (paragraphs). Full RTF parsing is too complex for a
// clipboard manager; this handles the common case of WordPad / Outlook
// copying only RTF without a companion text/html format.
function rtfToHtml(rtf: string): string {
  let text = rtf;

  // Remove RTF header: everything from {\rtf to the first \viewkind or content
  text = text.replace(/^\{\\rtf1?[^}]*\}/, '');

  // Remove destination groups ({\*\command ...}) — these are metadata, not content
  text = text.replace(/\{\\\*\\[^{}]*\{[^}]*\}\}/g, '');
  text = text.replace(/\{\\\*\\[^}]*\}/g, '');

  // Structural commands
  text = text.replace(/\\par\b/g, '<br>');
  text = text.replace(/\\line\b/g, '<br>');
  text = text.replace(/\\tab\b/g, '&emsp;');

  // Hex-encoded characters: \'xx
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, h) =>
    String.fromCharCode(parseInt(h, 16)));

  // Bold / italic / underline as inline spans (toggle commands)
  let html = '';
  let inBold = false, inItalic = false, inUnderline = false;
  const parts = text.split(/(\\b\b|\\i\b|\\ul\b|\\ulnone\b|\\b0\b|\\i0\b)/);
  for (const part of parts) {
    switch (part) {
      case '\\b': case '\\b0': inBold = !inBold; if (inBold) html += '<b>'; else html += '</b>'; break;
      case '\\i': case '\\i0': inItalic = !inItalic; if (inItalic) html += '<i>'; else html += '</i>'; break;
      case '\\ul': inUnderline = true; html += '<u>'; break;
      case '\\ulnone': inUnderline = false; html += '</u>'; break;
      default: html += part; break;
    }
  }
  // Close any unclosed tags
  if (inUnderline) html += '</u>';
  if (inItalic) html += '</i>';
  if (inBold) html += '</b>';

  // Strip remaining RTF commands and braces
  html = html
    .replace(/\\[a-zA-Z]+\d*\s*/g, '')
    .replace(/[\\{}]/g, '');

  return html.trim();
}

async function extractIconViaPowerShell(exePath: string): Promise<string> {
  const escaped = exePath.replace(/\\/g, '\\\\');
  const script = `
    Add-Type -AssemblyName System.Drawing -ErrorAction Stop;
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon('${escaped}');
    if ($icon) {
      $bitmap = $icon.ToBitmap();
      $ms = New-Object System.IO.MemoryStream;
      $bitmap.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png);
      $bytes = $ms.ToArray();
      [Console]::OutputEncoding = [System.Text.Encoding]::ASCII;
      Write-Output ('data:image/png;base64,' + [Convert]::ToBase64String($bytes));
      $ms.Close();
      $bitmap.Dispose();
      $icon.Dispose();
    }
  `;
  const encoded = Buffer.from(script.replace(/\n/g, ' '), 'utf16le').toString('base64');
  const { stdout } = await execAsync(`powershell -EncodedCommand ${encoded}`, { timeout: 3000, windowsHide: true });
  const trimmed = stdout.trim();
  if (trimmed && trimmed.startsWith('data:image/png;base64,')) {
    return trimmed;
  }
  return '';
}

async function getActiveWindowInfo(): Promise<{ name: string; path: string }> {
  if (process.platform === 'win32') {
    try {
      const script = `
        Add-Type -MemberDefinition '[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);' -Name 'Win32Utils' -Namespace 'Win32' -ErrorAction SilentlyContinue;
        $hwnd = [Win32.Win32Utils]::GetForegroundWindow();
        if ($hwnd -ne [IntPtr]::Zero) {
          $pid = 0;
          [Win32.Win32Utils]::GetWindowThreadProcessId($hwnd, [ref]$pid);
          $proc = Get-Process -Id $pid;
          [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
          Write-Output ($proc.Name + '|' + $proc.Path);
        }
      `;
      // Encode as UTF-16LE Base64 to avoid cmd.exe quoting issues
      const encoded = Buffer.from(script.replace(/\n/g, ' '), 'utf16le').toString('base64');
      const { stdout } = await execAsync(`powershell -EncodedCommand ${encoded}`, { timeout: 2000, windowsHide: true });
      const trimmed = stdout.trim();
      if (!trimmed) return { name: 'Unknown', path: '' };
      
      const parts = trimmed.split('|');
      return { 
        name: parts[0] || 'Unknown', 
        path: parts[1] || '' 
      };
    } catch (e: any) {
      console.error('[Monitor] GetActiveWindowInfo error:', e?.message || e);
      return { name: 'Unknown', path: '' };
    }
  }
  return { name: 'Unknown', path: '' };
}

const IMG_URL_RE = /^https?:\/\/.+\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i;

// Extract an image URL from clipboard content when the user copies an image
// without a standard bitmap format (browser copy-image, design tools, etc.)
function extractRemoteImageUrl(text: string, html: string): string | null {
  // Case 1: HTML <img> tag with a remote src
  const m = html?.match(/<img\b[^>]*src=["']([^"']+)["']/i);
  if (m?.[1]) {
    const txt = (text || '').trim();
    if (!txt || txt.length < 200) return m[1];
  }
  // Case 2: text content is a bare image URL
  const trimmed = (text || '').trim();
  if (trimmed && !trimmed.includes('\n') && IMG_URL_RE.test(trimmed)) {
    return trimmed;
  }
  return null;
}

// Validate remote image URL before download
function validateRemoteImageUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    const host = u.hostname;
    if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]') return false;
    if (/^10\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^192\.168\./.test(host)) return false;
    return true;
  } catch { return false; }
}

// Background download of remote image (e.g. browser copy-as-image, design tools)
async function downloadRemoteImage(clip: any): Promise<any> {
  const url = clip.content_text.trim();

  if (!validateRemoteImageUrl(url)) {
    console.log('[Monitor] Remote image blocked by validation:', url.substring(0, 80));
    return clip;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const ct = (response.headers.get('content-type') || '').toLowerCase();
  if (!ct.startsWith('image/')) {
    console.log('[Monitor] Remote image blocked — not an image:', ct);
    return clip;
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > 50 * 1024 * 1024) {
    console.log('[Monitor] Remote image blocked — too large:', contentLength);
    return clip;
  }

  const arrayBuffer = await response.arrayBuffer();
  if (arrayBuffer.byteLength > 50 * 1024 * 1024) {
    console.log('[Monitor] Remote image blocked — too large after fetch:', arrayBuffer.byteLength);
    return clip;
  }
  const buffer = Buffer.from(arrayBuffer);

  const ext = ct.includes('png') ? 'png' : ct.includes('gif') ? 'gif' : ct.includes('webp') ? 'webp' : ct.includes('bmp') ? 'bmp' : 'jpg';
  const fileName = `${Date.now()}.${ext}`;
  const filePath = path.join(imagesPath, fileName);
  fs.writeFileSync(filePath, buffer);
  const image_size = buffer.length;
  const image_format = ext.toUpperCase();

  let thumbnail = '';
  let image_width: number | null = null;
  let image_height: number | null = null;
  try {
    const jimpImage = await Jimp.read(buffer);
    image_width = jimpImage.bitmap.width;
    image_height = jimpImage.bitmap.height;
    const thumbBuffer = await jimpImage
      .scaleToFit(200, 200)
      .quality(80)
      .getBufferAsync(Jimp.MIME_JPEG);
    thumbnail = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
  } catch (err) {
    console.error('[Monitor] Remote thumbnail failed:', err);
  }

  dbQuery.run(
    'UPDATE clip_history SET image_path = ?, thumbnail = ?, image_width = ?, image_height = ?, image_size = ?, image_format = ? WHERE id = ?',
    [filePath, thumbnail, image_width, image_height, image_size, image_format, clip.id]
  );

  return { ...clip, image_path: filePath, thumbnail, image_width, image_height, image_size, image_format };
}

// Dynamic sensitive-app filter read from settings DB (privacy_apps JSON)
const DEFAULT_PRIVACY: Record<string, boolean> = {
  '1password': false, bitwarden: false, keepass: false,
  mstsc: false, windowsterminal: false,
};

let privacyFilter: Record<string, boolean> = { ...DEFAULT_PRIVACY };
let foregroundProcessName = '';
let fgUpdating = false;

function refreshPrivacyFilter() {
  try {
    const row = dbQuery.get("SELECT value FROM settings WHERE key = 'privacy_apps'");
    if (row?.value) {
      privacyFilter = { ...DEFAULT_PRIVACY, ...JSON.parse(row.value) };
    } else {
      privacyFilter = { ...DEFAULT_PRIVACY };
    }
  } catch { privacyFilter = { ...DEFAULT_PRIVACY }; }
}

async function updateForegroundName() {
  if (fgUpdating) return;
  fgUpdating = true;
  try {
    foregroundProcessName = ((await getActiveWindowInfo()).name || '').toLowerCase();
  } catch { /* ignore */ }
  fgUpdating = false;
}

function isSensitiveApp(): boolean {
  const name = foregroundProcessName;
  for (const [key, exclude] of Object.entries(privacyFilter)) {
    if (exclude && name.includes(key.toLowerCase())) return true;
  }
  return false;
}

export async function startMonitoring(onNewClip: (clip: any) => void) {
  const { app, nativeImage } = await import('electron');
  console.log('Clipboard monitoring started...');

  // Refresh foreground process name and privacy filter
  refreshPrivacyFilter();
  updateForegroundName();
  setInterval(() => { refreshPrivacyFilter(); updateForegroundName(); }, 5000);

  // Adaptive polling: 400ms when active, 2500ms when idle > 30s
  let pollInterval = 400;
  let lastActivity = Date.now();
  function resetPollSpeed() { pollInterval = 400; lastActivity = Date.now(); }
  setInterval(() => {
    if (Date.now() - lastActivity > 30000 && pollInterval === 400) {
      pollInterval = 2500;
      console.log('[Monitor] Idle — slowing poll to 2500ms');
    }
  }, 10000);

  const poll = async () => {
    // Skip polling when foreground is a sensitive app
    if (isSensitiveApp()) {
      setTimeout(poll, pollInterval);
      return;
    }
    try {
      const formats = clipboard.availableFormats();
      console.log('[Monitor] Formats:', formats.join(', '));

      let type = 0; // 0=哨兵, 1=文本, 2=图片, 4=文件
      let content_text = '';
      let content_html = '';
      let thumbnail = '';
      let image_path = '';
      let has_color = 0;
      let color_hex = '';
      let color_rgb = '';
      let image_width: number | null = null;
      let image_height: number | null = null;
      let image_size: number | null = null;
      let image_format: string | null = null;
      let hash = '';

      // File copy detection: text/uri-list = Windows CF_HDROP.
      // Electron exposes the format name but read() returns empty and
      // readBuffer() is unavailable in v30, so we use PowerShell.
      // Paths are collected but type is deferred — if the clipboard also
      // carries image data and all paths are image files, the clip is
      // classified as type 2 (image) so it pastes as a bitmap instead of
      // a bare file path into non-Explorer targets.
      let filePathsFromUriList: string[] = [];
      const hasUriList = formats.some(f => f === 'text/uri-list' || f.includes('uri-list'));
      if (hasUriList) {
        try {
          const psScript = `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; Add-Type -AssemblyName System.Windows.Forms; $files = [System.Windows.Forms.Clipboard]::GetFileDropList(); if ($files -and $files.Count -gt 0) { $files -join [char]0x1E }`;
          const psEncoded = Buffer.from(psScript, 'utf16le').toString('base64');
          const { stdout } = await execAsync(
            `powershell -STA -EncodedCommand ${psEncoded}`,
            { timeout: 3000, windowsHide: true }
          );
          const trimmed = (stdout || '').trim();
          if (trimmed) {
            const paths = trimmed.split('\x1E').filter(p => p.length > 0);
            if (paths.length > 0) {
              filePathsFromUriList = paths;
              console.log('[Monitor] File copy detected:', paths.length, 'files');
            }
          }
        } catch (e) {
          console.error('[Monitor] PS file detection failed:', e);
        }
      }

      // Image formats checked before text — images take priority when both are on clipboard
      const hasImage = formats.some(f => f.includes('image'));
      const hasText = formats.some(f => f.includes('text') || f.includes('plain'));

      // When Explorer copies an image file, both the file path (uri-list) and
      // the bitmap are on the clipboard.  Detect this case and classify as
      // type 2 so the image pastes as a bitmap into non-Explorer targets
      // (chat apps, design tools, browsers) instead of as a bare file path.
      const IMG_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico']);
      const singleImageFile = filePathsFromUriList.length === 1 &&
        IMG_EXTS.has(path.extname(filePathsFromUriList[0]).toLowerCase());

      if (type === 0 && hasImage) {
        const image = clipboard.readImage();
        if (!image.isEmpty()) {
          const buffer = image.toPNG();
          if (singleImageFile) {
            hash = crypto.createHash('md5').update(buffer).digest('hex');
            if (hash !== lastHash) {
              console.log('[Monitor] Image file from Explorer:', filePathsFromUriList[0]);
              type = 2;
              content_text = JSON.stringify(filePathsFromUriList);
            } else {
              setTimeout(poll, pollInterval);
              return;
            }
          } else if (filePathsFromUriList.length === 0) {
            // When the clipboard has both image and text (e.g. browser
            // "Copy Image"), extract the URL from HTML so the hash is
            // URL-based.  This prevents a duplicate clip when the image
            // format is dropped and the remaining text URL is picked up
            // in the next poll cycle.
            let extractedUrl = '';
            if (hasText) {
              const text = clipboard.readText();
              const html = clipboard.readHTML();
              const url = extractRemoteImageUrl(text, html);
              if (url) extractedUrl = url;
            }
            hash = extractedUrl
              ? crypto.createHash('md5').update(extractedUrl).digest('hex')
              : crypto.createHash('md5').update(buffer).digest('hex');
            if (hash !== lastHash) {
              console.log('[Monitor] New image detected, hash:', hash);
              type = 2;
              if (extractedUrl) {
                content_text = extractedUrl;
                content_html = '';
              }
            }
          }
        }
      }

      // Single image file path without bitmap on clipboard (Explorer
      // only puts CF_HDROP, not CF_BITMAP) — read the image from disk.
      if (type === 0 && singleImageFile && !hasImage) {
        hash = crypto.createHash('md5').update(JSON.stringify(filePathsFromUriList)).digest('hex');
        if (hash !== lastHash) {
          console.log('[Monitor] Image file from Explorer (disk):', filePathsFromUriList[0]);
          type = 2;
          content_text = JSON.stringify(filePathsFromUriList);
        } else {
          setTimeout(poll, pollInterval);
          return;
        }
      }

      // Remaining file paths without usable image data → type 4
      if (type === 0 && filePathsFromUriList.length > 0) {
        content_text = JSON.stringify(filePathsFromUriList);
        hash = crypto.createHash('md5').update(content_text).digest('hex');
        if (hash !== lastHash) {
          console.log('[Monitor] File copy stored as type 4:', filePathsFromUriList.length, 'files');
          type = 4;
        }
      }

      if (type === 0 && hasText) {
        content_text = clipboard.readText();
        content_html = clipboard.readHTML();

        // RTF fallback: some Windows apps only put Rich Text Format on clipboard.
        // Attempt to read and convert to basic HTML when no native HTML is present.
        if (!content_html || content_html.trim().length === 0) {
          const rtfFormat = formats.find(f => f.toLowerCase().includes('rtf'));
          if (rtfFormat) {
            try {
              const rtf = clipboard.read(rtfFormat);
              if (rtf) content_html = rtfToHtml(rtf);
            } catch { /* ignore */ }
          }
        }

        if (content_text || content_html) {
          hash = crypto.createHash('md5').update(content_text + (content_html || '')).digest('hex');
          if (hash !== lastHash) {
            type = 1;

            // Fallback file-path detection from text/plain content.
            // Some apps place plain paths or file:// URIs in the text format.
            const trimmed = content_text.trim();
            const lines = trimmed.split(/[\r\n]+/).filter(Boolean);
            if (lines.length > 0) {
              if (lines.every(l => l.startsWith('file:///') || l.startsWith('file://'))) {
                const paths = lines.map(l => {
                  const stripped = l.replace(/^file:\/\/\/?/, '');
                  return decodeURIComponent(stripped).replace(/\//g, '\\');
                });
                content_text = JSON.stringify(paths);
                hash = crypto.createHash('md5').update(content_text).digest('hex');
                if (hash !== lastHash) {
                  console.log('[Monitor] File drop detected (text URI):', paths.length, 'files');
                  type = 4;
                }
              } else if (lines.every(l => /^[A-Za-z]:[\\/]/.test(l) || /^\\\\/.test(l))) {
                content_text = JSON.stringify(lines);
                hash = crypto.createHash('md5').update(content_text).digest('hex');
                if (hash !== lastHash) {
                  console.log('[Monitor] File drop detected (text paths):', lines.length, 'files');
                  type = 4;
                }
              }
            }

            if (type === 1) {
              // Remote image fallback: some apps copy images without a standard
              // clipboard bitmap — instead the URL appears in HTML <img> or as
              // the plain text content itself.
              const extractedUrl = extractRemoteImageUrl(content_text, content_html);
              if (extractedUrl) {
                hash = crypto.createHash('md5').update(extractedUrl).digest('hex');
                if (hash !== lastHash) {
                  console.log('[Monitor] Remote image detected, URL:', extractedUrl.substring(0, 80));
                  type = 2;
                  content_text = extractedUrl;
                  content_html = '';
                }
              }
            }

            if (type === 1) {
              console.log('[Monitor] New text detected:', content_text.substring(0, 40));
            }
          }
        }
      }

      if (type === 0 || hash === lastHash) {
        setTimeout(poll, pollInterval);
        return;
      }

      lastHash = hash;
      resetPollSpeed();

      // If it's an image, save it and generate thumbnail
      if (type === 2) {
        const isRemoteUrl = content_text && /^https?:\/\//i.test(content_text.trim());

        // Always try clipboard bitmap first — browsers put both bitmap
        // and HTML URL on the clipboard for "Copy Image".
        const image = clipboard.readImage();
        if (!image.isEmpty()) {
          const buffer = image.toPNG();
          const fileName = `${Date.now()}.png`;
          image_path = path.join(imagesPath, fileName);
          fs.writeFileSync(image_path, buffer);
          image_size = buffer.length;
          image_format = 'PNG';

          try {
            const jimpImage = await Jimp.read(buffer);
            image_width = jimpImage.bitmap.width;
            image_height = jimpImage.bitmap.height;
            const thumbBuffer = await jimpImage
              .scaleToFit(200, 200)
              .quality(80)
              .getBufferAsync(Jimp.MIME_JPEG);
            thumbnail = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
          } catch (err) {
            console.error('Thumbnail generation failed:', err);
          }
        } else if (!isRemoteUrl) {
          // No bitmap, not a URL → read image file from disk
          // (Explorer file copy only puts CF_HDROP, not CF_BITMAP)
          try {
            const paths: string[] = JSON.parse(content_text || '[]');
            if (paths.length > 0 && fs.existsSync(paths[0])) {
              const srcPath = paths[0];
              const buffer = fs.readFileSync(srcPath);
              const ext = path.extname(srcPath).toLowerCase();
              const fmtMap: Record<string, string> = { '.jpg': 'jpg', '.jpeg': 'jpg', '.gif': 'gif', '.bmp': 'bmp', '.webp': 'webp' };
              const fmt = fmtMap[ext] || 'png';
              const fileName = `${Date.now()}.${fmt}`;
              image_path = path.join(imagesPath, fileName);
              fs.writeFileSync(image_path, buffer);
              image_size = buffer.length;
              image_format = fmt.toUpperCase();

              try {
                const jimpImage = await Jimp.read(buffer);
                image_width = jimpImage.bitmap.width;
                image_height = jimpImage.bitmap.height;
                const thumbBuffer = await jimpImage
                  .scaleToFit(200, 200)
                  .quality(80)
                  .getBufferAsync(Jimp.MIME_JPEG);
                thumbnail = `data:image/jpeg;base64,${thumbBuffer.toString('base64')}`;
              } catch (err) {
                console.error('Thumbnail generation failed:', err);
              }
            }
          } catch (err) {
            console.error('[Monitor] Disk image read failed:', err);
          }
        }
        // Pure remote URL (no bitmap): downloadRemoteImage handles it later
      } else {
        // Check for colors embedded in text
        if (content_text) {
          const colorInfo = extractFirstColor(content_text);
          if (colorInfo) {
            has_color = 1;
            color_hex = colorInfo.hex;
            color_rgb = colorInfo.rgb;
          }
        }
      }

      // console.log('Checking DB for hash:', hash);
      const existingClip = dbQuery.get('SELECT id FROM clip_history WHERE content_hash = ?', [hash]);
      // console.log('DB check finished, existing:', !!existingClip);

      // Initial clip object with placeholder app info
      const clip = {
        id: existingClip ? existingClip.id : uuidv4(),
        type,
        content_text,
        content_html,
        image_path,
        thumbnail,
        source_app: 'Unknown',
        source_icon: '',
        created_at: new Date().toISOString(),
        is_pinned: 0,
        has_color,
        color_hex,
        color_rgb,
        image_width,
        image_height,
        image_size,
        image_format,
        content_hash: hash
      };

      try {
        if (existingClip) {
          dbQuery.run(`
            UPDATE clip_history
            SET created_at = ?, has_color = ?, color_hex = ?, color_rgb = ?
            WHERE id = ?
          `, [clip.created_at, clip.has_color, clip.color_hex, clip.color_rgb, clip.id]);
          console.log(`DB Updated: ${clip.id}`);
        } else {
          dbQuery.run(`
            INSERT INTO clip_history (id, type, content_text, content_html, image_path, thumbnail, source_app, source_icon, created_at, is_pinned, has_color, color_hex, color_rgb, image_width, image_height, image_size, image_format, content_hash)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            clip.id, clip.type, clip.content_text, clip.content_html, clip.image_path, clip.thumbnail, clip.source_app, clip.source_icon, clip.created_at, clip.is_pinned, clip.has_color, clip.color_hex, clip.color_rgb, clip.image_width, clip.image_height, clip.image_size, clip.image_format, clip.content_hash
          ]);
          console.log(`DB Inserted: ${clip.id}`);
        }
        
        // Notify renderer immediately
        // Send clip immediately with Unknown source, then update with real app info asynchronously
        // to avoid blocking the clipboard poll on the slow PowerShell call
        onNewClip(clip);

        // Download remote image in background → local copy.
        // Skip if we already saved the bitmap locally (e.g. browser "Copy Image").
        if (clip.type === 2 && clip.content_text && /^https?:\/\//i.test(clip.content_text.trim()) && !clip.image_path) {
          downloadRemoteImage(clip).then(updated => {
            console.log('[Monitor] Remote image downloaded:', updated.id);
            onNewClip(updated);
          }).catch(err => {
            console.error('[Monitor] Remote image download failed:', err?.message);
          });
        }

        // Fetch app info in background
        getActiveWindowInfo().then(async (activeWindow) => {
          console.log('[Monitor] Active window info:', activeWindow.name, activeWindow.path?.substring(0, 60));
          if (activeWindow.name && activeWindow.name !== 'Unknown') {
            let source_icon = '';
            if (activeWindow.path) {
              try {
                const icon = await app.getFileIcon(activeWindow.path, { size: 'small' });
                console.log('[Monitor] getFileIcon returned, isEmpty:', icon.isEmpty());
                if (!icon.isEmpty()) {
                  source_icon = icon.toDataURL();
                  console.log('[Monitor] icon dataURL length:', source_icon.length);
                }
              } catch (e: any) {
                console.log('[Monitor] getFileIcon ERROR for', activeWindow.name, e?.message || e);
              }
              if (!source_icon) {
                console.log('[Monitor] Trying PowerShell fallback...');
                try {
                  source_icon = await extractIconViaPowerShell(activeWindow.path);
                  console.log('[Monitor] PowerShell fallback result length:', source_icon.length);
                } catch (e: any) {
                  console.log('[Monitor] PowerShell fallback ERROR for', activeWindow.name, e?.message || e);
                }
              }
            }

            console.log('[Monitor] Updating DB with source_icon length:', source_icon.length);
            dbQuery.run(`
              UPDATE clip_history
              SET source_app = ?, source_icon = ?
              WHERE id = ?
            `, [activeWindow.name, source_icon, clip.id]);

            console.log('[Monitor] Sending second new-clip with icon...');
            onNewClip({ ...clip, source_app: activeWindow.name, source_icon });
          }
        }).catch(err => {
          console.error('[Monitor] getActiveWindowInfo promise chain ERROR:', err);
        });

      } catch (dbErr) {
        console.error('CRITICAL DB ERROR:', dbErr);
      }
      

    } catch (err) {
      console.error('Clipboard monitor error:', err);
    }
    
    setTimeout(poll, pollInterval);
  };

  // Run cleanup every 5 minutes, reading max_history from settings
  setInterval(() => {
    try {
      const row = dbQuery.get('SELECT value FROM settings WHERE key = ?', ['max_history']);
      const max = row ? parseInt(row.value, 10) || 200 : 200;
      dbQuery.cleanup(max);
    } catch (e) {}
  }, 5 * 60 * 1000);

  poll();
}
