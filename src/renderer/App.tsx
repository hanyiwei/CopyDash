import React, { useEffect, useState, useRef } from 'react';
import { Settings, X } from 'lucide-react';
import { useStore } from './store/useStore';
import SearchBar from './components/SearchBar';
import ClipList from './components/ClipList';
import SettingsPanel from './components/SettingsPanel';

const App: React.FC = () => {
  const setClips = useStore(state => state.setClips);
  const addClip = useStore(state => state.addClip);
  const clipsCount = useStore(state => state.clips.length);
  const setTheme = useStore(state => state.setTheme);
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
        const ipcRenderer = (window as any).electron.ipcRenderer;
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
          (window as any).electron.ipcRenderer.send('window:hide');
        }
        hideTimer.current = null;
      }, 180);
    };

    const handleWindowFocus = () => {
      cancelHide();
      if (mountedRef.current) setIsVisible(true);
    };

    const unsubNew = (window as any).electron.ipcRenderer.on('new-clip', handleNewClip);
    const unsubShown = (window as any).electron.ipcRenderer.on('window-shown', handleWindowShown);
    const unsubHide = (window as any).electron.ipcRenderer.on('window-hide-start', handleWindowHideStart);
    const unsubFocus = (window as any).electron.ipcRenderer.on('window-focus', handleWindowFocus);

    return () => {
      mountedRef.current = false;
      cancelHide();
      unsubNew();
      unsubShown();
      unsubHide();
      unsubFocus();
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
      <div className="flex-1 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white flex flex-col overflow-hidden border border-zinc-200 dark:border-white/10 dark:shadow-2xl rounded-3xl m-2 relative">
        <div className="flex-shrink-0 flex items-center relative">
          {/* Logo — opens GitHub in system default browser */}
          <button
            onClick={() => (window as any).electron.ipcRenderer.invoke('shell:openExternal', 'https://github.com/hanyiwei')}
            className="flex-shrink-0 pl-5 pr-6 text-zinc-900 dark:text-white hover:text-orange-400 dark:hover:text-orange-400 transition-colors cursor-pointer select-none flex items-center gap-1 group"
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

          {/* Settings + close on the right */}
          <div className="flex-shrink-0 flex items-center gap-0.5 pr-2">
            <button
              onClick={() => setShowSettings(v => !v)}
              className="p-1.5 hover:bg-zinc-200/50 dark:hover:bg-white/10 rounded-xl text-zinc-300 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => (window as any).electron.ipcRenderer.send('window:hide')}
              className="p-1.5 hover:bg-zinc-200/50 dark:hover:bg-white/10 rounded-xl text-zinc-300 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white transition-colors"
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

        <footer className="h-8 bg-zinc-100 dark:bg-black/40 border-t border-zinc-200 dark:border-white/5 flex items-center justify-between px-4 text-[10px] text-zinc-400 dark:text-zinc-500 font-bold tracking-widest uppercase">
          <div className="flex items-center gap-4">
            <span>{clipsCount} ITEMS</span>
            <span className="opacity-40">ALT+SHIFT+V TO TOGGLE</span>
          </div>
          <button
            onClick={() => (window as any).electron.ipcRenderer.invoke('shell:openExternal', 'https://github.com/hanyiwei')}
            className="hover:text-zinc-900 dark:hover:text-white transition-colors cursor-pointer flex items-center gap-2 text-zinc-300 dark:text-zinc-600"
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
