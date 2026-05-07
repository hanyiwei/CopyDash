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
}

export type FilterType = 'text' | 'image' | 'link' | 'color' | 'file' | null;

interface State {
  clips: Clip[];
  selectedClipId: string | null;
  searchQuery: string;
  filterType: FilterType;
  filterPinned: boolean;
  theme: 'dark' | 'light';
  maxHistory: number;
  setClips: (clips: Clip[]) => void;
  addClip: (clip: Clip) => void;
  removeClip: (id: string) => void;
  togglePin: (id: string) => void;
  setSelectedClipId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setFilterType: (type: FilterType) => void;
  setFilterPinned: (pinned: boolean) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setMaxHistory: (n: number) => void;
  clearClips: () => void;
}

const ipc = () => (window as any).electron.ipcRenderer;

export const useStore = create<State>((set) => ({
  clips: [],
  selectedClipId: null,
  searchQuery: '',
  filterType: null,
  filterPinned: false,
  theme: 'dark',
  maxHistory: 200,
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
  setMaxHistory: (n) => set({ maxHistory: n }),
  clearClips: () => set({ clips: [] }),
}));
