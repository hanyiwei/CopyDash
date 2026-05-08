import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { useStore } from '../store/useStore';

interface SettingsPanelProps {
  onClose: () => void;
}

type PanelLevel = 'main' | 'privacy' | 'shortcuts';

const HISTORY_OPTIONS = [100, 200, 300];

const PRIVACY_APPS = [
  { key: '1password', label: '1Password' },
  { key: 'bitwarden', label: 'Bitwarden' },
  { key: 'keepass', label: 'KeePass' },
  { key: 'mstsc', label: 'Remote Desktop' },
  { key: 'windowsterminal', label: 'Windows Terminal' },
];

const ipc = () => (window as any).electron.ipcRenderer;

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const shortcut = useStore(s => s.shortcut);
  const setShortcut = useStore(s => s.setShortcut);
  const [level, setLevel] = useState<PanelLevel>('main');
  const [maxHistory, setMaxHistory] = useState(200);
  const [loaded, setLoaded] = useState(false);
  const [privacyApps, setPrivacyApps] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [capturedKeys, setCapturedKeys] = useState('');
  const [shortcutError, setShortcutError] = useState('');
  const [shortcutSaved, setShortcutSaved] = useState(false);
  const recordingRef = useRef(false);
  const capturedRef = useRef('');
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => { capturedRef.current = capturedKeys; }, [capturedKeys]);
  useEffect(() => {
    return () => { if (savedTimerRef.current) clearTimeout(savedTimerRef.current); };
  }, []);

  const confirmShortcut = async (keys: string) => {
    const result = await ipc().invoke('shortcut:update', keys);
    if (result.ok) {
      setShortcut(keys);
      setRecording(false);
      setShortcutError('');
      setShortcutSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShortcutSaved(false), 2000);
    } else {
      setShortcutError(result.error || 'Failed to register');
    }
  };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!recordingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setRecording(false);
        setCapturedKeys('');
        setShortcutError('');
        return;
      }

      // Enter confirms the previously captured combo
      if (e.key === 'Enter') {
        if (capturedRef.current) {
          confirmShortcut(capturedRef.current);
        }
        return;
      }

      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Super');

      const keyName = e.key === ' ' ? 'Space' : e.key.length === 1 ? e.key.toUpperCase() : e.key;
      parts.push(keyName);

      if (parts.length < 2) {
        setShortcutError('Requires a modifier key (Ctrl, Alt, Shift, Win)');
        return;
      }

      const combo = parts.join('+');
      capturedRef.current = combo;
      setCapturedKeys(combo);
      setShortcutError('');
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  // Cancel recording when navigating away from shortcuts panel
  useEffect(() => {
    if (level !== 'shortcuts') {
      setRecording(false);
      setCapturedKeys('');
      setShortcutError('');
    }
  }, [level]);

  useEffect(() => {
    const load = async () => {
      const val = await ipc().invoke('db:settings:get', 'max_history');
      if (val) setMaxHistory(parseInt(val, 10) || 200);
      const t = await ipc().invoke('db:settings:get', 'theme');
      if (t && t !== theme) setTheme(t as 'dark' | 'light');
      const pv = await ipc().invoke('db:settings:get', 'privacy_apps');
      const defaults: Record<string, boolean> = {};
      PRIVACY_APPS.forEach(a => { defaults[a.key] = false; });
      if (pv) {
        try {
          const parsed = JSON.parse(pv);
          Object.assign(defaults, parsed);
        } catch { /* keep defaults */ }
      }
      setPrivacyApps(defaults);
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const handleHistory = async (n: number) => {
    setMaxHistory(n);
    await ipc().invoke('db:settings:set', 'max_history', String(n));
  };

  const handleTheme = (t: 'dark' | 'light') => setTheme(t);

  const handlePrivacyToggle = async (key: string, value: boolean) => {
    const next = { ...privacyApps, [key]: value };
    setPrivacyApps(next);
    await ipc().invoke('db:settings:set', 'privacy_apps', JSON.stringify(next));
  };

  const enabledCount = Object.values(privacyApps).filter(Boolean).length;

  const header = (title: string, showBack: boolean) => (
    <div className="px-4 py-3 border-b border-beige-border dark:border-white/5 flex items-center gap-2">
      {showBack && (
        <button
          onClick={() => setLevel('main')}
          className="p-0.5 hover:bg-card/50 dark:hover:bg-white/10 rounded-lg text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
      <h3 className="text-xs font-bold text-brown dark:text-white uppercase tracking-wider flex-1">{title}</h3>
      <button
        onClick={onClose}
        className="p-0.5 hover:bg-card/50 dark:hover:bg-white/10 rounded-lg text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const rowClass = "flex items-center justify-between w-full py-1";
  const labelClass = "text-xs text-brown-secondary dark:text-zinc-300";

  // ── Level 2: Privacy Apps ──
  if (level === 'privacy') {
    return (
      <div
        ref={panelRef}
        className="absolute right-2 top-12 z-50 w-64 bg-page dark:bg-zinc-900 border border-beige-border dark:border-white/10 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden"
      >
        {header('Privacy Apps', true)}
        <div className="p-4 space-y-3">
          <p className="text-[11px] text-brown-muted dark:text-zinc-500">
            Toggle on to exclude an app from clipboard recording.
          </p>
          <div className="space-y-0.5">
            {PRIVACY_APPS.map(app => (
              <div key={app.key} className={rowClass}>
                <span className={labelClass}>{app.label}</span>
                <button
                  onClick={() => handlePrivacyToggle(app.key, !privacyApps[app.key])}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    privacyApps[app.key] ? 'bg-orange-500' : 'bg-page-dim dark:bg-zinc-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      privacyApps[app.key] ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── Level 2: Shortcuts ──
  if (level === 'shortcuts') {
    return (
      <div
        ref={panelRef}
        className="absolute right-2 top-12 z-50 w-64 bg-page dark:bg-zinc-900 border border-beige-border dark:border-white/10 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden"
      >
        {header('Shortcuts', true)}
        <div className="p-4 space-y-0.5">
          <div className="flex items-center justify-between w-full py-1.5 px-2 -mx-2 rounded-md hover:bg-card/50 dark:hover:bg-white/5 transition-colors group">
            <span className={labelClass}>Toggle window</span>
            {recording ? (
              <span className={`text-[11px] font-mono ${capturedKeys ? 'text-green-600 dark:text-green-400' : 'text-orange-500 animate-pulse'}`}>
                {capturedKeys ? <>{capturedKeys} <span className="text-brown-muted dark:text-zinc-500">Enter ↵</span></> : 'Press keys...'}
              </span>
            ) : (
              <button
                onClick={() => { setRecording(true); setCapturedKeys(''); setShortcutError(''); }}
                className="text-[11px] text-brown-muted dark:text-zinc-500 font-mono group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors cursor-pointer flex items-center gap-1"
                title="Click to change shortcut"
              >
                {shortcut}
                {shortcutSaved && <Check className="w-3 h-3 text-green-500" />}
              </button>
            )}
          </div>
          {shortcutError && (
            <p className="text-[10px] text-red-500 dark:text-red-400 px-2 pb-1">{shortcutError}</p>
          )}
          <div className="pt-3 mt-1 border-t border-beige-border dark:border-white/5" />
          <div className="flex items-center justify-between w-full py-1.5 px-2 -mx-2 rounded-md hover:bg-card/50 dark:hover:bg-white/5 transition-colors group">
            <span className={labelClass}>Cancel</span>
            <span className="text-[11px] text-brown-muted dark:text-zinc-500 font-mono group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors">Esc</span>
          </div>
          <div className="flex items-center justify-between w-full py-1.5 px-2 -mx-2 rounded-md hover:bg-card/50 dark:hover:bg-white/5 transition-colors group">
            <span className={labelClass}>Paste as plain text</span>
            <span className="text-[11px] text-brown-muted dark:text-zinc-500 font-mono group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors">Shift+Click</span>
          </div>
          <div className="flex items-center justify-between w-full py-1.5 px-2 -mx-2 rounded-md hover:bg-card/50 dark:hover:bg-white/5 transition-colors group">
            <span className={labelClass}>Paste</span>
            <span className="text-[11px] text-brown-muted dark:text-zinc-500 font-mono group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors">Double-click</span>
          </div>
          <div className="flex items-center justify-between w-full py-1.5 px-2 -mx-2 rounded-md hover:bg-card/50 dark:hover:bg-white/5 transition-colors group">
            <span className={labelClass}>Context menu</span>
            <span className="text-[11px] text-brown-muted dark:text-zinc-500 font-mono group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors">Right-click</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Level 1: Main ──
  return (
    <div
      ref={panelRef}
      className="absolute right-2 top-12 z-50 w-64 bg-page dark:bg-zinc-900 border border-beige-border dark:border-white/10 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden"
    >
      {header('Settings', false)}

      {!loaded ? (
        <div className="px-4 py-6 text-center text-brown-muted dark:text-zinc-500 text-xs">Loading...</div>
      ) : (
        <div className="p-4 space-y-3">
          {/* Theme */}
          <div className="flex items-center justify-between">
            <span className={labelClass}>Theme</span>
            <div className="flex bg-card dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => handleTheme('dark')}
                className={`p-1.5 rounded-md transition-colors ${
                  theme === 'dark' ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted hover:text-brown dark:hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleTheme('light')}
                className={`p-1.5 rounded-md transition-colors ${
                  theme === 'light' ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted hover:text-brown dark:hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* History */}
          <div className="flex items-center justify-between">
            <span className={labelClass}>History</span>
            <div className="flex bg-card dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
              {HISTORY_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => handleHistory(n)}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
                    maxHistory === n ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted hover:text-brown dark:hover:text-white'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* Privacy Apps entry */}
          <button
            onClick={() => setLevel('privacy')}
            className="flex items-center justify-between w-full py-1 hover:bg-card/50 dark:hover:bg-white/5 rounded-md px-1 -mx-1 transition-colors"
          >
            <span className={labelClass}>Privacy Apps</span>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-brown-muted dark:text-zinc-400">{enabledCount > 0 ? `${enabledCount} on` : 'Off'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-brown-muted dark:text-zinc-400" />
            </div>
          </button>

          {/* Shortcuts entry */}
          <button
            onClick={() => setLevel('shortcuts')}
            className="flex items-center justify-between w-full py-1 hover:bg-card/50 dark:hover:bg-white/5 rounded-md px-1 -mx-1 transition-colors"
          >
            <span className={labelClass}>Shortcuts</span>
            <ChevronRight className="w-3.5 h-3.5 text-brown-muted dark:text-zinc-400" />
          </button>

          {/* Clear all history */}
          <div className="pt-2 border-t border-beige-border dark:border-white/5">
            <button
              onDoubleClick={async () => {
                await ipc().invoke('db:clearAll');
                useStore.getState().clearClips();
                onClose();
              }}
              className="w-full py-2 rounded-xl text-xs font-medium text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors select-none"
            >
              Double-click to clear all history
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
