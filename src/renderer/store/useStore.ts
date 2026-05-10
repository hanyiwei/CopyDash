import { create } from 'zustand';

interface Clip {
  id: string;
  type: number;
  content_text: string;
  content_html: string;
  thumbnail: string;
  image_path: string;
  created_at: string;
  source_app: string;
  source_icon: string;
  is_pinned: number;
  has_color: number;
  color_hex: string;
  color_rgb: string;
  image_width: number | null;
  image_height: number | null;
  image_size: number | null;
  image_format: string | null;
}

export type FilterType = 'text' | 'image' | 'link' | 'color' | 'file' | null;

export interface UpdateStatus {
  status: 'available' | 'downloading' | 'downloaded' | 'error' | 'fallback';
  version?: string;
  percent?: number;
  message?: string;
}

interface State {
  clips: Clip[];
  selectedClipId: string | null;
  searchQuery: string;
  filterType: FilterType;
  filterPinned: boolean;
  theme: 'dark' | 'light';
  colorScheme: 'warm' | 'cool' | 'forest' | 'mauve';
  locale: 'en' | 'zh';
  maxHistory: number;
  toastMessage: string | null;
  updateStatus: UpdateStatus | null;
  updateCheckedAt: number | null;
  shortcut: string;
  autoLaunch: boolean;
  setClips: (clips: Clip[]) => void;
  addClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  togglePin: (id: string) => void;
  setSelectedClipId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterType: (type: FilterType) => void;
  setFilterPinned: (pinned: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setColorScheme: (scheme: 'warm' | 'cool' | 'forest' | 'mauve') => void;
  setLocale: (locale: 'en' | 'zh') => void;
  setMaxHistory: (n: number) => void;
  showToast: (message: string) => void;
  setUpdateStatus: (s: UpdateStatus | null) => void;
  setUpdateCheckedAt: (ts: number | null) => void;
  setShortcut: (s: string) => void;
  setAutoLaunch: (v: boolean) => void;
  clearClips: () => void;
}

const ipc = () => (window as any).electron.ipcRenderer;

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useStore = create<State>((set) => ({
  clips: [],
  selectedClipId: null,
  searchQuery: '',
  filterType: null,
  filterPinned: false,
  theme: 'dark',
  colorScheme: 'warm',
  locale: 'en',
  maxHistory: 200,
  toastMessage: null,
  updateStatus: null,
  updateCheckedAt: null,
  shortcut: 'Ctrl+Shift+V',
  autoLaunch: true,
  setClips: (clips) => {
    set({ clips: [...clips] });
  },
  addClip: (clip) => set((state) => {
    const filtered = state.clips.filter(c => c.id !== clip.id);
    return {
      clips: [clip, ...filtered].slice(0, state.maxHistory)
    };
  }),
  removeClip: (id) => set((state) => ({
    clips: state.clips.filter(c => c.id !== id),
    selectedClipId: state.selectedClipId === id ? null : state.selectedClipId
  })),
  togglePin: (id) => set((state) => ({
    clips: state.clips.map(c =>
      c.id === id ? { ...c, is_pinned: c.is_pinned ? 0 : 1 } : c
    )
  })),
  setSelectedClipId: (id) => set({ selectedClipId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterType: (type) => set({ filterType: type }),
  setFilterPinned: (pinned) => set({ filterPinned: pinned }),
  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
    ipc().invoke('db:settings:set', 'theme', theme).catch((err: unknown) => console.error('[Store] setTheme persist failed:', err));
  },
  setColorScheme: (scheme) => {
    document.documentElement.setAttribute('data-theme', scheme);
    set({ colorScheme: scheme });
    ipc().invoke('db:settings:set', 'color_scheme', scheme).catch((err: unknown) => console.error('[Store] setColorScheme persist failed:', err));
  },
  setLocale: (locale) => {
    set({ locale });
    ipc().invoke('db:settings:set', 'locale', locale).catch((err: unknown) => console.error('[Store] setLocale persist failed:', err));
  },
  setMaxHistory: (n) => set({ maxHistory: n }),
  showToast: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ toastMessage: message });
    toastTimer = setTimeout(() => {
      set({ toastMessage: null });
      toastTimer = null;
    }, 2000);
  },
  setUpdateStatus: (s) => set({ updateStatus: s }),
  setUpdateCheckedAt: (ts) => set({ updateCheckedAt: ts }),
  setShortcut: (s) => set({ shortcut: s }),
  setAutoLaunch: (v) => set({ autoLaunch: v }),
  clearClips: () => set({ clips: [] }),
}));
