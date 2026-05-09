import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { useStore } from '../store/useStore';

interface SettingsPanelProps {
  onClose: () => void;
}

type TabType = 'general' | 'privacy' | 'shortcuts';
type SubView = null | 'history';
type Locale = 'en' | 'zh';

const HISTORY_OPTIONS = [100, 200, 300];

const PRIVACY_APPS = [
  { key: '1password', label: '1Password' },
  { key: 'bitwarden', label: 'Bitwarden' },
  { key: 'keepass', label: 'KeePass' },
  { key: 'mstsc', label: 'Remote Desktop' },
  { key: 'windowsterminal', label: 'Windows Terminal' },
];

const L: Record<string, Record<Locale, string>> = {
  settings:       { en: 'Settings', zh: '设置' },
  tabGeneral:     { en: 'General', zh: '通用' },
  tabPrivacy:     { en: 'Privacy', zh: '隐私' },
  tabShortcuts:   { en: 'Shortcuts', zh: '快捷键' },
  loading:        { en: 'Loading...', zh: '加载中...' },
  theme:          { en: 'Theme', zh: '主题' },
  language:       { en: 'Language', zh: '语言' },
  history:        { en: 'History', zh: '历史记录' },
  privacyApps:    { en: 'Privacy Apps', zh: '隐私应用' },
  privacyDesc:    { en: 'Toggle on to exclude an app from clipboard recording', zh: '开启后将排除该应用的剪贴板记录' },
  shortcuts:      { en: 'Shortcuts', zh: '快捷键' },
  autoLaunch:     { en: 'Auto Launch', zh: '开机自启' },
  clearHistory:   { en: 'Double-click to clear all history', zh: '双击-清空历史' },
  historyDesc:    { en: 'Max items to keep. Excess is auto-removed', zh: '最大记录条数，超出自动清除' },
  toggleWindow:   { en: 'Toggle window', zh: '唤醒主页' },
  pressKeys:      { en: 'Press keys...', zh: '输入新按键...' },
  shortcutHint:   { en: 'Click to change', zh: '点击修改' },
  pastePlain:     { en: 'Paste as plain text', zh: '粘贴为纯文本' },
  paste:          { en: 'Paste', zh: '粘贴' },
  version:        { en: 'Version', zh: '版本' },
  checkUpdate:    { en: 'Check for updates', zh: '检查更新' },
  checkingUpdate: { en: 'Checking...', zh: '检查中…' },
  upToDate:       { en: 'Up to date', zh: '已是最新' },
  updateAvailable:{ en: 'Update found!', zh: '发现更新！' },
  updateFailed:   { en: 'Check failed', zh: '检查失败' },
};

const ipc = () => (window as any).electron.ipcRenderer;

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const theme = useStore(s => s.theme);
  const setTheme = useStore(s => s.setTheme);
  const locale = useStore(s => s.locale);
  const setLocale = useStore(s => s.setLocale);
  const shortcut = useStore(s => s.shortcut);
  const setShortcut = useStore(s => s.setShortcut);
  const autoLaunch = useStore(s => s.autoLaunch);
  const setAutoLaunch = useStore(s => s.setAutoLaunch);
  const clipsCount = useStore(s => s.clips.length);
  const [tab, setTab] = useState<TabType>('general');
  const [subView, setSubView] = useState<SubView>(null);
  const [maxHistory, setMaxHistory] = useState(200);
  const [appVersion, setAppVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateResult, setUpdateResult] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [privacyApps, setPrivacyApps] = useState<Record<string, boolean>>({});
  const [recording, setRecording] = useState(false);
  const [shortcutError, setShortcutError] = useState('');
  const [shortcutSaved, setShortcutSaved] = useState(false);
  const recordingRef = useRef(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const updateResultTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasModifiedShortcut = useRef(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const t = (key: string): string => L[key]?.[locale] ?? key;

  useEffect(() => { recordingRef.current = recording; }, [recording]);
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      if (updateResultTimerRef.current) clearTimeout(updateResultTimerRef.current);
    };
  }, []);

  const confirmShortcut = async (keys: string) => {
    const result = await ipc().invoke('shortcut:update', keys);
    if (result.ok) {
      setShortcut(keys);
      setRecording(false);
      setShortcutError('');
      setShortcutSaved(true);
      hasModifiedShortcut.current = true;
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
        setShortcutError('');
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
      confirmShortcut(combo);
    };

    document.addEventListener('keydown', handler, true);
    return () => document.removeEventListener('keydown', handler, true);
  }, []);

  useEffect(() => {
    if (tab !== 'shortcuts') {
      setRecording(false);
      setShortcutError('');
    }
  }, [tab]);

  useEffect(() => {
    const load = async () => {
      const ver = await ipc().invoke('app:getVersion');
      if (ver) setAppVersion(ver);
      const val = await ipc().invoke('db:settings:get', 'max_history');
      if (val) setMaxHistory(parseInt(val, 10) || 200);
      const t = await ipc().invoke('db:settings:get', 'theme');
      if (t && t !== theme) setTheme(t as 'dark' | 'light');
      const l = await ipc().invoke('db:settings:get', 'locale');
      if (l && l !== locale) setLocale(l as 'en' | 'zh');
      const pv = await ipc().invoke('db:settings:get', 'privacy_apps');
      const al = await ipc().invoke('db:settings:get', 'auto_launch');
      if (al !== null) setAutoLaunch(al === '1');
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
    setSubView(null);
  };

  const handleTheme = (t: 'dark' | 'light') => setTheme(t);

  const handlePrivacyToggle = async (key: string, value: boolean) => {
    const next = { ...privacyApps, [key]: value };
    setPrivacyApps(next);
    await ipc().invoke('db:settings:set', 'privacy_apps', JSON.stringify(next));
  };

  const flashUpdateResult = (key: string) => {
    setUpdateResult(t(key));
    if (updateResultTimerRef.current) clearTimeout(updateResultTimerRef.current);
    updateResultTimerRef.current = setTimeout(() => setUpdateResult(null), 1500);
  };

  const doCheckUpdate = async () => {
    if (checkingUpdate) return;
    setCheckingUpdate(true);
    try {
      const result = await ipc().invoke('update:check');
      if (result?.updateAvailable) {
        flashUpdateResult('updateAvailable');
        setCheckingUpdate(false);
      } else {
        flashUpdateResult('upToDate');
        setCheckingUpdate(false);
      }
    } catch {
      flashUpdateResult('updateFailed');
      setCheckingUpdate(false);
    }
  };

  const rowClass = "flex items-center justify-between w-full min-h-[30px] px-2";
  const labelClass = "text-xs text-brown-secondary dark:text-zinc-300";
  const mutedClass = "text-[11px] text-brown-muted dark:text-zinc-500";

  const tabs: { key: TabType; label: string }[] = [
    { key: 'general', label: t('tabGeneral') },
    { key: 'privacy', label: t('tabPrivacy') },
    { key: 'shortcuts', label: t('tabShortcuts') },
  ];

  const showSubView = tab === 'general' && subView !== null;

  const header = (
    <div className="px-5 py-3 border-b border-beige-border dark:border-white/5 flex items-center gap-2">
      {showSubView && (
        <button
          onClick={() => setSubView(null)}
          className="p-0.5 hover:bg-card/50 dark:hover:bg-white/10 rounded-lg text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-white transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
      )}
      <h3 className="text-xs font-bold text-brown dark:text-white uppercase tracking-wider flex-1">
        {showSubView ? t(subView!) : t('settings')}
      </h3>
      <button
        onClick={onClose}
        className="p-0.5 hover:bg-card/50 dark:hover:bg-white/10 rounded-lg text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-white transition-colors"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const clearButton = (
    <div className="pt-2 border-t border-beige-border dark:border-white/5">
      <button
        onDoubleClick={async () => { await ipc().invoke('db:clearAll'); useStore.getState().clearClips(); onClose(); }}
        className="w-full py-2 rounded-xl text-xs font-medium text-red-400/50 hover:text-red-400 hover:bg-red-500/10 transition-colors select-none"
      >
        {t('clearHistory')}
      </button>
    </div>
  );

  const segBtn = (active: boolean) =>
    `flex-1 py-1 text-[10px] font-medium rounded-md transition-colors ${
      active ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-zinc-300'
    }`;

  // ── Render ──
  return (
    <div
      ref={panelRef}
      className="absolute right-2 top-12 z-50 w-72 bg-page dark:bg-zinc-900 border border-beige-border dark:border-white/10 rounded-xl shadow-lg dark:shadow-2xl overflow-hidden overflow-y-auto max-h-[calc(100vh-4rem)] custom-scrollbar"
    >
      {header}

      {!loaded ? (
        <div className="px-4 py-6 text-center text-brown-muted dark:text-zinc-500 text-xs">{t('loading')}</div>
      ) : showSubView ? (
        /* ── Sub-view: Language / History ── */
        <div className="px-5 py-4 space-y-1">
          {subView === 'history' ? (
            <div className="space-y-3">
              <p className="text-[10px] text-brown-muted dark:text-zinc-500">{t('historyDesc')}</p>
              <div className="space-y-1">
              {HISTORY_OPTIONS.map(n => (
                <button key={n} onClick={() => handleHistory(n)} className="flex items-center justify-between w-full py-2 px-3 rounded-md hover:bg-card/50 dark:hover:bg-white/5 transition-colors">
                  <span className={labelClass}>{n}</span>
                  {maxHistory === n && <Check className="w-3.5 h-3.5 text-orange-500" />}
                </button>
              ))}
              </div>
              {clearButton}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="px-5 py-4">
          {/* Tab bar — hidden in sub-view, but we don't reach here when showSubView */}
          <div className="flex bg-card dark:bg-zinc-800 rounded-lg p-0.5 mb-4">
            {tabs.map(({ key, label }) => (
              <button key={key} onClick={() => setTab(key)} className={segBtn(tab === key)}>{label}</button>
            ))}
          </div>

          {/* Tab: General */}
          {tab === 'general' && (
            <div className="space-y-3">
              {/* Auto Launch */}
              <div className={rowClass}>
                <span className={labelClass}>{t('autoLaunch')}</span>
                <button
                  onClick={async () => { const next = !autoLaunch; setAutoLaunch(next); await ipc().invoke('setting:setAutoLaunch', next); }}
                  className={`relative w-7 h-4 rounded-full transition-colors ${autoLaunch ? 'bg-orange-500' : 'bg-page-dim dark:bg-zinc-600'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${autoLaunch ? 'translate-x-3' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Theme */}
              <div className={rowClass}>
                <span className={labelClass}>{t('theme')}</span>
                <div className="flex bg-card dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                  <button onClick={() => handleTheme('dark')} className={`p-1 rounded-md transition-colors ${theme === 'dark' ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-zinc-300'}`}>
                    <Moon className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleTheme('light')} className={`p-1 rounded-md transition-colors ${theme === 'light' ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-zinc-300'}`}>
                    <Sun className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Language */}
              <div className={rowClass}>
                <span className={labelClass}>{t('language')}</span>
                <div className="flex bg-card dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                  <button onClick={() => setLocale('en')} className={`w-5 h-5 p-1 rounded-md transition-colors flex items-center justify-center text-[10px] font-medium ${locale === 'en' ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-zinc-300'}`}>EN</button>
                  <button onClick={() => setLocale('zh')} className={`w-5 h-5 p-1 rounded-md transition-colors flex items-center justify-center text-[10px] font-medium ${locale === 'zh' ? 'bg-page-dim dark:bg-zinc-600 text-brown dark:text-white' : 'text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-zinc-300'}`}>中</button>
                </div>
              </div>

              {/* History */}
              <button onClick={() => setSubView('history')} className={`${rowClass} group`}>
                <span className={labelClass}>{t('history')}</span>
                <div className="flex items-center gap-0.5 text-brown-muted dark:text-zinc-500 group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors">
                  <span className={mutedClass}>{clipsCount}/{maxHistory}</span>
                  <ChevronRight className="w-3 h-3" />
                </div>
              </button>

              {/* Version */}
              {appVersion && (
                <div className={rowClass}>
                  <span className={labelClass}>{t('version')} v{appVersion}</span>
                  <button
                    onClick={doCheckUpdate}
                    disabled={checkingUpdate}
                    className={`text-[11px] font-medium transition-colors ${checkingUpdate ? 'text-brown-muted dark:text-zinc-500 cursor-default' : updateResult ? 'text-green-600 dark:text-green-400' : 'text-brown-muted dark:text-zinc-500 hover:text-brown dark:hover:text-zinc-300 cursor-pointer'}`}
                  >
                    {checkingUpdate ? t('checkingUpdate') : updateResult ?? t('checkUpdate')}
                  </button>
                </div>
              )}

            </div>
          )}

          {/* Tab: Privacy */}
          {tab === 'privacy' && (
            <div className="space-y-3">
              <p className="text-[10px] text-brown-muted dark:text-zinc-500">{t('privacyDesc')}</p>
              <div className="space-y-0.5">
                {PRIVACY_APPS.map(app => (
                  <div key={app.key} className={rowClass}>
                    <span className={labelClass}>{app.label}</span>
                    <button
                      onClick={() => handlePrivacyToggle(app.key, !privacyApps[app.key])}
                      className={`relative w-7 h-4 rounded-full transition-colors ${privacyApps[app.key] ? 'bg-orange-500' : 'bg-page-dim dark:bg-zinc-600'}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow-sm transition-transform ${privacyApps[app.key] ? 'translate-x-3' : 'translate-x-0'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab: Shortcuts */}
          {tab === 'shortcuts' && (
            <div className="space-y-3">
              <div className={`${rowClass} group rounded-md hover:bg-card/50 dark:hover:bg-white/5 transition-colors`}>
                <span className={labelClass}>{t('toggleWindow')}</span>
                <div className="flex items-center gap-1.5">
                  {!recording && !hasModifiedShortcut.current && (
                    <span className="text-[10px] text-brown-muted/60 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">{t('shortcutHint')}</span>
                  )}
                  {recording ? (
                    <span className="text-[11px] font-mono text-orange-500 animate-pulse">{t('pressKeys')}</span>
                  ) : (
                    <button
                      onClick={() => { setRecording(true); setShortcutError(''); }}
                      className={`text-[11px] font-mono transition-colors cursor-pointer flex items-center gap-1 ${
                        shortcutSaved
                          ? 'text-green-500 dark:text-green-400'
                          : 'text-brown-muted dark:text-zinc-500 group-hover:text-brown-secondary dark:group-hover:text-zinc-300'
                      }`}
                      title="Click to change shortcut"
                    >
                      {shortcut}
                    </button>
                  )}
                </div>
              </div>
              {shortcutError && <p className="text-[10px] text-red-500 dark:text-red-400 pb-1">{shortcutError}</p>}
              <div className={rowClass}>
                <span className={labelClass}>{t('pastePlain')}</span>
                <span className="text-[11px] text-brown-muted dark:text-zinc-500 font-mono group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors">Shift+Click</span>
              </div>
              <div className={rowClass}>
                <span className={labelClass}>{t('paste')}</span>
                <span className="text-[11px] text-brown-muted dark:text-zinc-500 font-mono group-hover:text-brown-secondary dark:group-hover:text-zinc-300 transition-colors">Double-click</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SettingsPanel;
