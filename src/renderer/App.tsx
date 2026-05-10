import React, { useEffect, useState, useRef } from 'react';
import { Settings, X, ArrowDownToLine, CheckCircle2, ExternalLink } from 'lucide-react';
import { useStore, type UpdateStatus } from './store/useStore';
import SearchBar from './components/SearchBar';
import ClipList from './components/ClipList';
import SettingsPanel from './components/SettingsPanel';

const App: React.FC = () => {
  const setClips = useStore(state => state.setClips);
  const addClip = useStore(state => state.addClip);
  const clipsCount = useStore(state => state.clips.length);
  const toastMessage = useStore(state => state.toastMessage);
  const shortcut = useStore(state => state.shortcut);
  const setTheme = useStore(state => state.setTheme);
  const setColorScheme = useStore(state => state.setColorScheme);
  const setShortcut = useStore(state => state.setShortcut);
  const updateStatus = useStore(state => state.updateStatus);
  const setUpdateStatus = useStore(state => state.setUpdateStatus);
  const locale = useStore(state => state.locale);
  const [isVisible, setIsVisible] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const cancelHide = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const showWithAnimation = () => {
    cancelHide();
    setIsVisible(false);
    requestAnimationFrame(() => {
      if (mountedRef.current) setIsVisible(true);
    });
  };

  useEffect(() => {
    mountedRef.current = true;

    const fetchClips = async () => {
      try {
        const ipcRenderer = window.electronAPI;
        const result = await ipcRenderer.invoke('db:getAll');
        if (result && mountedRef.current) setClips(result);
        // Load theme, migrate 'system' to 'dark'
        const t = await ipcRenderer.invoke('db:settings:get', 'theme');
        // Migrate 'system' (old default) to 'dark'
        setTheme((!t || t === 'system') ? 'dark' : t as 'dark' | 'light');
        // Load maxHistory
        const mh = await ipcRenderer.invoke('db:settings:get', 'max_history');
        if (mh) {
          useStore.getState().setMaxHistory(parseInt(mh, 10) || 200);
        }
        // Load color scheme
        const cs = await ipcRenderer.invoke('db:settings:get', 'color_scheme');
        if (cs) setColorScheme(cs as 'default' | 'earth' | 'sage' | 'violet');
        // Load shortcut
        const sc = await ipcRenderer.invoke('db:settings:get', 'shortcut_toggle');
        if (sc) setShortcut(sc);
      } catch (err) {
        console.error('[App] Fetch error:', err);
      }
    };

    fetchClips();

    const handleNewClip = (clip: any) => {
      addClip(clip);
    };

    const handleWindowShown = () => {
      showWithAnimation();
    };

    const handleWindowHideStart = () => {
      setIsVisible(false);
      // 180ms allows the CSS exit animation (150ms) to finish before hiding the window
      hideTimer.current = setTimeout(() => {
        if (mountedRef.current) {
          window.electronAPI.send('window:hide');
        }
        hideTimer.current = null;
      }, 180);
    };

    const handleWindowFocus = () => {
      cancelHide();
      if (mountedRef.current) setIsVisible(true);
    };

    const handleShortcutChanged = (sc: string) => setShortcut(sc);

    const handleUpdateStatus = (payload: UpdateStatus) => setUpdateStatus(payload);

    const unsubNew = window.electronAPI.on('new-clip', handleNewClip);
    const unsubShown = window.electronAPI.on('window-shown', handleWindowShown);
    const unsubHide = window.electronAPI.on('window-hide-start', handleWindowHideStart);
    const unsubFocus = window.electronAPI.on('window-focus', handleWindowFocus);
    const unsubSc = window.electronAPI.on('shortcut-changed', handleShortcutChanged);
    const unsubUpdate = window.electronAPI.on('update:status', handleUpdateStatus);

    // Replay any status that arrived before the listener was attached
    window.electronAPI.invoke('update:getStatus').then((s: any) => {
      if (s && mountedRef.current) setUpdateStatus(s);
    });

    return () => {
      mountedRef.current = false;
      cancelHide();
      unsubNew();
      unsubShown();
      unsubHide();
      unsubFocus();
      unsubSc();
      unsubUpdate();
    };
  }, []);

  return (
    <div
      className={`h-full w-full bg-transparent flex flex-col overflow-hidden transition-all ${
        isVisible
          ? 'duration-[220ms] translate-y-0 opacity-100'
          : 'duration-[150ms] translate-y-4 opacity-0'
      }`}
      style={{
        transitionTimingFunction: isVisible
          ? 'cubic-bezier(0.22, 0.61, 0.36, 1)'
          : 'ease-in',
      }}
    >
      <div className="flex-1 bg-page dark:bg-d-page text-brown dark:text-d-white flex flex-col overflow-hidden border border-beige-border dark:border-d-white/10 dark:shadow-2xl rounded-3xl m-2 relative">
        <div className="flex-shrink-0 flex items-center relative">
          {/* Logo — opens GitHub in system default browser */}
          <button
            onClick={() => window.electronAPI.invoke('shell:openExternal', 'https://github.com/hanyiwei/CopyDash')}
            className="flex-shrink-0 pl-5 pr-6 text-brown dark:text-d-white hover:text-accent dark:hover:text-accent transition-colors cursor-pointer select-none flex items-center gap-1 group"
            title="CopyDash on GitHub"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="currentColor" className="group-hover:animate-spin-fast">
              <path d="M17.6544 1.70001L14.8716 4.23315C16.147 4.62331 17.3453 5.28102 18.3612 6.20626C21.8744 9.40606 21.8744 14.594 18.3612 17.7938C15.7696 20.1542 11.7644 21.6563 6.3456 22.3L9.12838 19.7669C7.85304 19.3767 6.65466 18.719 5.6388 17.7938C2.1256 14.594 2.1048 9.42501 5.6388 6.20626C8.2304 3.84585 12.2356 2.34376 17.6544 1.70001ZM12 8.00001C9.51472 8.00001 7.5 9.79087 7.5 12C7.5 14.2092 9.51472 16 12 16C14.4853 16 16.5 14.2092 16.5 12C16.5 9.79087 14.4853 8.00001 12 8.00001Z"/>
            </svg>
            <span className="text-sm font-bold tracking-tight">CopyDash</span>
          </button>

          {/* Search + filters */}
          <div className="flex-1">
            <SearchBar />
          </div>

          {/* Update prompt */}
          {updateStatus && (
            <button
              onClick={() => {
                if (updateStatus.status === 'downloading') {
                  return;
                }
                if (updateStatus.status === 'downloaded') {
                  window.electronAPI.invoke('update:quit-and-install');
                } else if (updateStatus.status === 'available') {
                  window.electronAPI.invoke('update:download');
                } else if (updateStatus.status === 'error') {
                  window.electronAPI.invoke('update:check');
                } else if (updateStatus.status === 'fallback') {
                  window.electronAPI.invoke('shell:openExternal', 'https://github.com/hanyiwei/CopyDash/releases');
                }
              }}
              className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition-all ${
                updateStatus.status === 'error'
                  ? 'bg-red-500/20 text-red-600 dark:text-red-400 cursor-pointer'
                  : updateStatus.status === 'downloaded'
                    ? 'bg-green-500/20 text-green-600 dark:text-green-400 cursor-pointer'
                    : updateStatus.status === 'fallback'
                      ? 'bg-amber-500/20 text-amber-600 dark:text-amber-400 cursor-pointer'
                      : 'bg-orange-500/20 text-orange-600 dark:text-orange-400 cursor-pointer'
              }`}
            >
              {updateStatus.status === 'downloaded' ? (
                <CheckCircle2 className="w-3.5 h-3.5" />
              ) : updateStatus.status === 'error' ? (
                <X className="w-3.5 h-3.5" />
              ) : updateStatus.status === 'fallback' ? (
                <ExternalLink className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownToLine className="w-3.5 h-3.5" />
              )}
              <span>
                {updateStatus.status === 'downloading'
                  ? `${locale === 'zh' ? '下载中' : 'Downloading'} ${updateStatus.percent ?? 0}%`
                  : updateStatus.status === 'downloaded'
                    ? locale === 'zh' ? '已就绪 · 点击重启' : 'Ready · Click to restart'
                    : updateStatus.status === 'error'
                      ? locale === 'zh' ? '更新检查失败 · 点击重试' : 'Update check failed · Click to retry'
                    : updateStatus.status === 'fallback'
                      ? locale === 'zh' ? '更新持续失败 · 去官网下载' : 'Update keeps failing · Download manually'
                      : locale === 'zh' ? '新版本可用 · 点击更新' : 'New version · Click to update'}
              </span>
            </button>
          )}

          {/* Settings + close on the right */}
          <div className="flex-shrink-0 flex items-center gap-0.5 pr-2">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="p-1.5 hover:bg-page-dim/50 dark:hover:bg-d-white/10 rounded-xl text-brown-faint/60 dark:text-d-text-faint hover:text-brown dark:hover:text-d-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => window.electronAPI.send('window:hide')}
              className="p-1.5 hover:bg-page-dim/50 dark:hover:bg-d-white/10 rounded-xl text-brown-faint/60 dark:text-d-text-faint hover:text-brown dark:hover:text-d-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Settings popover */}
          {showSettings && (
            <SettingsPanel onClose={() => setShowSettings(false)} />
          )}
        </div>

        <main className="flex-1 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-hidden">
            <ClipList />
          </div>
        </main>

        <footer className="h-8 bg-badge/30 dark:bg-d-footer/40 border-t border-beige-border dark:border-d-white/5 flex items-center justify-between px-4 text-[10px] text-brown-muted dark:text-d-text-muted font-bold tracking-widest uppercase">
          <div className="flex items-center gap-4">
            <span>{clipsCount} ITEMS</span>
            {toastMessage ? (
              <span className="text-red-500 dark:text-red-400 animate-pulse">{toastMessage}</span>
            ) : (
              <span className="opacity-40">{shortcut.toUpperCase()} TO TOGGLE</span>
            )}
          </div>
          <button
            onClick={() => window.electronAPI.invoke('shell:openExternal', 'https://github.com/hanyiwei/CopyDash')}
            className="hover:text-brown dark:hover:text-d-white transition-colors cursor-pointer flex items-center gap-2 text-brown-faint/60 dark:text-d-text-faint"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></div>
            CopyDash built by 大花
          </button>
        </footer>
      </div>
    </div>
  );
};

export default App;
