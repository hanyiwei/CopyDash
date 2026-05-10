import React, { useState, useEffect } from 'react';
import { Pin, FileText, Folder, Palette, Image, Link, Files, FileAudio, FileVideo, FileImage, FileArchive, FileCode, File } from 'lucide-react';
import { useStore } from '../store/useStore';
import { isImageUrl, isUrl } from '../utils/urlDetect';
import { maybeHighlight } from '../utils/highlight';

interface ClipItemProps {
  clip: any;
  onDoubleClick: (clip: any, e: React.MouseEvent) => void;
}

const EXT_ICON: Record<string, React.ComponentType<any>> = {
  // Audio
  mp3: FileAudio, wav: FileAudio, flac: FileAudio, aac: FileAudio, ogg: FileAudio, wma: FileAudio, m4a: FileAudio,
  // Video
  mp4: FileVideo, avi: FileVideo, mkv: FileVideo, mov: FileVideo, wmv: FileVideo, webm: FileVideo, flv: FileVideo,
  // Image
  png: FileImage, jpg: FileImage, jpeg: FileImage, gif: FileImage, bmp: FileImage, svg: FileImage, webp: FileImage, ico: FileImage,
  // Archive
  zip: FileArchive, rar: FileArchive, '7z': FileArchive, tar: FileArchive, gz: FileArchive, bz2: FileArchive, xz: FileArchive,
  // Code
  js: FileCode, ts: FileCode, jsx: FileCode, tsx: FileCode, py: FileCode, java: FileCode, c: FileCode, cpp: FileCode, cs: FileCode, rb: FileCode, go: FileCode, rs: FileCode, swift: FileCode, kt: FileCode, php: FileCode, html: FileCode, css: FileCode, scss: FileCode, json: FileCode, xml: FileCode, yaml: FileCode, yml: FileCode, sh: FileCode, bat: FileCode, ps1: FileCode, sql: FileCode, vue: FileCode, svelte: FileCode,
  // Document
  txt: FileText, md: FileText, pdf: FileText, doc: FileText, docx: FileText, xls: FileText, xlsx: FileText, ppt: FileText, pptx: FileText, csv: FileText, rtf: FileText,
};

const CAT_NAMES: Record<string, string> = {
  mp3: 'Audio', wav: 'Audio', flac: 'Audio', aac: 'Audio', ogg: 'Audio', wma: 'Audio', m4a: 'Audio',
  mp4: 'Video', avi: 'Video', mkv: 'Video', mov: 'Video', wmv: 'Video', webm: 'Video', flv: 'Video',
  png: 'Image', jpg: 'Image', jpeg: 'Image', gif: 'Image', bmp: 'Image', svg: 'Image', webp: 'Image', ico: 'Image',
  zip: 'Archive', rar: 'Archive', '7z': 'Archive', tar: 'Archive', gz: 'Archive', bz2: 'Archive', xz: 'Archive',
  js: 'Code', ts: 'Code', jsx: 'Code', tsx: 'Code', py: 'Code', java: 'Code', c: 'Code', cpp: 'Code', cs: 'Code', rb: 'Code', go: 'Code', rs: 'Code', swift: 'Code', kt: 'Code', php: 'Code', html: 'Code', css: 'Code', scss: 'Code', json: 'Code', xml: 'Code', yaml: 'Code', yml: 'Code', sh: 'Code', bat: 'Code', ps1: 'Code', sql: 'Code', vue: 'Code', svelte: 'Code',
  txt: 'Doc', md: 'Doc', pdf: 'Doc', doc: 'Doc', docx: 'Doc', xls: 'Doc', xlsx: 'Doc', ppt: 'Doc', pptx: 'Doc', csv: 'Doc', rtf: 'Doc',
};

const getFileIcon = (name: string): React.ComponentType<any> => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return EXT_ICON[ext] || File;
};

const getFileLabel = (name: string): string => {
  const ext = (name.split('.').pop() || '').toLowerCase();
  return CAT_NAMES[ext] || 'Files';
};

const ClipItem: React.FC<ClipItemProps> = ({ clip, onDoubleClick }) => {
  const { togglePin, selectedClipId, setSelectedClipId } = useStore();
  const [isHovering, setIsHovering] = useState(false);
  const [imageUrlError, setImageUrlError] = useState(false);

  useEffect(() => {
    setImageUrlError(false);
  }, [clip.id, clip.content_text]);

  const handlePinClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const newPinStatus = clip.is_pinned ? 0 : 1;
    try {
      await (window as any).electron.ipcRenderer.invoke('db:updatePin', clip.id, newPinStatus);
      togglePin(clip.id);
    } catch (err) {
      console.error('[ClipItem] Pin update failed:', err);
    }
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatTime = (dateStr: string) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'NOW';
    if (mins < 60) return `${mins}M`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}H`;
    return `${Math.floor(hours / 24)}D`;
  };

  const imageUrl = clip.type !== 4 && !clip.has_color && isImageUrl(clip.content_text || '') ? clip.content_text.trim() : null;
  const isLink = !imageUrl && clip.type !== 4 && !clip.has_color && isUrl(clip.content_text || '');

  let filePaths: string[] = [];
  let fileNames: string[] = [];
  let isAllFolders = false;
  if (clip.type === 4 && clip.content_text) {
    try { filePaths = JSON.parse(clip.content_text); } catch {}
    fileNames = filePaths.map(p => p.split(/[\\/]/).pop() || p);
    isAllFolders = filePaths.length > 0 && filePaths.every(p => {
      const last = (p.split(/[\\/]/).pop() || '');
      return !last.includes('.');
    });
  }

  return (
    <div
      className="relative flex-shrink-0"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <div
        onDoubleClick={(e) => onDoubleClick(clip, e)}
        onClick={() => setSelectedClipId(clip.id)}
        className={`group relative w-[240px] h-[280px] bg-card dark:bg-zinc-800/90 hover:bg-card-hover dark:hover:bg-zinc-700/90 rounded-2xl transition-[background-color] duration-300 flex flex-col overflow-hidden cursor-default ${
          selectedClipId === clip.id
            ? 'border-2 border-brown-muted/50 dark:border-zinc-700'
            : 'border border-beige-border dark:border-white/5'
        } ${isHovering ? 'z-10' : ''}`}
      >
        <div className={`flex flex-col h-full transition-transform duration-300 ${isHovering ? 'scale-[1.02]' : ''}`}>
        {/* Top bar: type badge (left) + pin button (right) */}
        <div className="absolute top-3 left-3 right-3 z-20 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {clip.type === 4 ? (
              isAllFolders ? (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-badge/30 dark:bg-zinc-700/50 rounded-md text-[10px] font-medium text-brown-subtle dark:text-zinc-400">
                  <Folder className="w-3 h-3" />
                  Folder
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-badge/30 dark:bg-zinc-700/50 rounded-md text-[10px] font-medium text-brown-subtle dark:text-zinc-400">
                  {(() => { const Icon = fileNames.length === 1 ? getFileIcon(fileNames[0]) : Files; return <Icon className="w-3 h-3" />; })()}
                  {fileNames.length === 1 ? getFileLabel(fileNames[0]) : 'Files'}
                </span>
              )
            ) : clip.type === 2 ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-badge/30 dark:bg-zinc-700/50 rounded-md text-[10px] font-medium text-brown-subtle dark:text-zinc-400">
                <Image className="w-3 h-3" />
                Image
              </span>
            ) : isLink || imageUrl ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-badge/30 dark:bg-zinc-700/50 rounded-md text-[10px] font-medium text-brown-subtle dark:text-zinc-400">
                <Link className="w-3 h-3" />
                Link
              </span>
            ) : clip.has_color ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-badge/30 dark:bg-zinc-700/50 rounded-md text-[10px] font-medium text-brown-subtle dark:text-zinc-400">
                <Palette className="w-3 h-3" />
                Color
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-badge/30 dark:bg-zinc-700/50 rounded-md text-[10px] font-medium text-brown-subtle dark:text-zinc-400">
                <FileText className="w-3 h-3" />
                Text
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-auto">
            <span className="text-[10px] font-normal text-brown-muted dark:text-zinc-500 tracking-tight opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
              {formatTime(clip.created_at)}
            </span>
            {clip.is_pinned === 1 && (
              <button
                onClick={handlePinClick}
                className="text-orange-500 hover:text-orange-400 drop-shadow-md transition-colors flex-shrink-0"
                title="Click to unpin"
              >
                <Pin className="w-3.5 h-3.5 fill-current" />
              </button>
            )}
          </div>
        </div>

        {/* Main content area — all types use px-3 for uniform side padding */}
        <div className="flex-1 flex flex-col min-h-0">
          {clip.type === 4 ? (
            isAllFolders ? (
              /* Folder card */
              <div className="flex-1 flex flex-col pt-8 px-3 pb-3 justify-center">
                <div className="flex items-center justify-center mb-2">
                  <Folder className="w-8 h-8 text-amber-500/80" />
                </div>
                <div className="text-center space-y-0.5">
                  {fileNames.slice(0, 2).map((name, i) => (
                    <p key={i} className="text-[12px] text-brown-secondary dark:text-zinc-300 truncate leading-tight">{name}</p>
                  ))}
                  {fileNames.length > 2 && (
                    <p className="text-[12px] text-brown-muted dark:text-zinc-500">+{fileNames.length - 2} more</p>
                  )}
                </div>
                <div className="mt-1.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] text-brown-muted dark:text-zinc-500">
                    Pastes as path (use in File Explorer)
                  </span>
                </div>
                <div className="mt-2 text-center">
                  <span className="text-[9px] text-brown-muted dark:text-zinc-600">
                    {filePaths.length} folder{filePaths.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ) : (
              /* File card */
              <div className="flex-1 flex flex-col pt-8 px-3 pb-3 justify-center">
                <div className="flex items-center justify-center mb-2">
                  {(() => { const Icon = fileNames[0] ? getFileIcon(fileNames[0]) : Files; return <Icon className="w-8 h-8 text-brown-muted dark:text-zinc-500" />; })()}
                </div>
                <div className="text-center space-y-0.5">
                  {fileNames.slice(0, 2).map((name, i) => (
                    <p key={i} className="text-[12px] text-brown-secondary dark:text-zinc-300 truncate leading-tight">{name}</p>
                  ))}
                  {fileNames.length > 2 && (
                    <p className="text-[12px] text-brown-muted dark:text-zinc-500">+{fileNames.length - 2} more</p>
                  )}
                </div>
                {filePaths.length === 1 && (
                  <div className="mt-1.5 text-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-[10px] text-brown-muted dark:text-zinc-500 truncate leading-tight" title={filePaths[0]}>
                      {filePaths[0]}
                    </p>
                  </div>
                )}
                <div className="mt-2 text-center">
                  <span className="text-[9px] text-brown-muted dark:text-zinc-600">
                    {filePaths.length} file{filePaths.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            )
          ) : clip.type === 2 ? (
            /* Image card */
            <div className="flex-1 flex flex-col pt-8">
              <div className="flex-1 flex items-center justify-center px-3 pb-1 min-h-0">
                {clip.thumbnail ? (
                  <img
                    src={clip.thumbnail}
                    alt="thumb"
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : /^https?:\/\//i.test(clip.content_text || '') ? (
                  <img
                    src={clip.content_text.trim()}
                    alt="remote"
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="text-brown-muted dark:text-zinc-500 text-[10px]">No preview</div>
                )}
              </div>
              {clip.image_width && clip.image_height && (
                <div className="px-3 pb-2 text-center">
                  <span className="text-[11px] font-mono text-brown-muted dark:text-zinc-500">
                    {clip.image_width} × {clip.image_height}{clip.image_format ? ` · ${clip.image_format}` : ''}{clip.image_size ? ` · ${formatSize(clip.image_size)}` : ''}
                  </span>
                </div>
              )}
            </div>
          ) : imageUrl && !imageUrlError ? (
            /* Image URL card */
            <div className="flex-1 flex flex-col pt-8">
              <div className="flex-1 flex items-center justify-center px-3 pb-1 min-h-0">
                <img
                  src={imageUrl}
                  alt="preview"
                  className="max-w-full max-h-full object-contain rounded-lg"
                  onError={() => setImageUrlError(true)}
                />
              </div>
              {clip.image_width && clip.image_height && (
                <div className="px-3 pb-2 text-center">
                  <span className="text-[11px] font-mono text-brown-muted dark:text-zinc-500">
                    {clip.image_width} × {clip.image_height}{clip.image_format ? ` · ${clip.image_format}` : ''}{clip.image_size ? ` · ${formatSize(clip.image_size)}` : ''}
                  </span>
                </div>
              )}
            </div>
          ) : clip.has_color ? (
            /* Color card */
            <div className="flex-1 flex flex-col pt-8">
              <div
                className="flex-1 mx-3 my-2 rounded-lg border border-beige-border dark:border-white/5 shadow-inner"
                style={{ backgroundColor: clip.color_hex }}
              />
              <div className="px-3 py-2 text-center">
                <span className="text-[14px] font-mono font-bold text-brown-secondary dark:text-zinc-300">{clip.color_hex}</span>
                {clip.color_rgb && (
                  <span className="text-[14px] font-mono text-brown-muted dark:text-zinc-500 ml-2">{clip.color_rgb}</span>
                )}
              </div>
            </div>
          ) : (
            /* Text/Code/Link card */
            <div className="flex-1 flex flex-col pt-8 pb-3 overflow-hidden">
              {(() => {
                const raw = clip.content_text || '';
                const txt = raw.length > 500
                  ? raw.substring(0, 350) + '\n…\n' + raw.substring(raw.length - 150)
                  : raw;
                const result = maybeHighlight(txt);
                if (result.highlighted) {
                  return (
                    <div
                      className={`flex-1 px-4 py-1.5 overflow-hidden text-[14px] leading-[1.6] ${isLink ? 'break-all' : 'break-words'}`}
                      dangerouslySetInnerHTML={{ __html: result.html }}
                    />
                  );
                }
                return (
                  <div
                    className={`flex-1 px-4 py-1.5 overflow-hidden text-[14px] leading-[1.6] text-brown-secondary dark:text-zinc-300 whitespace-pre-wrap ${isLink ? 'break-all' : 'break-words'}`}
                  >
                    {txt}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default ClipItem;
