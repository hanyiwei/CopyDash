import React, { useState, useRef, useEffect } from 'react';
import { Search, X, FileText, Image, Link, Palette, Files, Pin } from 'lucide-react';
import { useStore, FilterType } from '../store/useStore';
import { clipMatchesType } from '../utils/clipType';

const SearchBar: React.FC = () => {
  const clips = useStore(s => s.clips);
  const searchQuery = useStore(s => s.searchQuery);
  const filterType = useStore(s => s.filterType);
  const filterPinned = useStore(s => s.filterPinned);
  const setSearchQuery = useStore(s => s.setSearchQuery);
  const setFilterType = useStore(s => s.setFilterType);
  const setFilterPinned = useStore(s => s.setFilterPinned);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSearchOpen && inputRef.current) inputRef.current.focus();
  }, [isSearchOpen]);

  // Click outside to close search
  useEffect(() => {
    if (!isSearchOpen) return;
    const handler = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isSearchOpen, setSearchQuery]);


  const filters: { key: FilterType; icon: any; label: string }[] = [
    { key: 'text', icon: FileText, label: 'Text' },
    { key: 'image', icon: Image, label: 'Image' },
    { key: 'link', icon: Link, label: 'Link' },
    { key: 'color', icon: Palette, label: 'Color' },
    { key: 'file', icon: Files, label: 'File' },
  ];

  const visibleFilters = filters.filter(f => clips.some(c => clipMatchesType(c, f.key!)));
  const hasPinned = clips.some(c => !!c.is_pinned);

  const handleTypeClick = (key: FilterType) => {
    setFilterType(filterType === key ? null : key);
  };

  const handleSearchToggle = () => {
    if (isSearchOpen) {
      setIsSearchOpen(false);
      setSearchQuery('');
    } else {
      setIsSearchOpen(true);
    }
  };

  return (
    <div className="px-4 py-2 flex items-center gap-1.5">
      {/* Search — when expanded, icon sits inside the input */}
      <div ref={searchContainerRef} className="flex items-center">
        {!isSearchOpen ? (
          <button
            onClick={handleSearchToggle}
            className="group flex items-center gap-1.5 px-2 py-1.5 rounded-xl hover:bg-zinc-200/50 dark:hover:bg-white/10 transition-all duration-300"
          >
            <Search className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white transition-colors" />
            <span className="text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 max-w-0 group-hover:max-w-20 opacity-0 group-hover:opacity-100 text-zinc-400 group-hover:text-zinc-900 dark:group-hover:text-white">Search</span>
          </button>
        ) : (
          <div className="relative w-44">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-blue-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setIsSearchOpen(false); setSearchQuery(''); } }}
              placeholder="Search..."
              className="w-full bg-zinc-100 dark:bg-zinc-800/80 border border-blue-500/30 rounded-lg py-1 pl-8 pr-7 text-xs text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 focus:outline-none focus:border-blue-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200/50 dark:hover:bg-white/10 rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            )}
            <button
              onClick={handleSearchToggle}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 hover:bg-zinc-200/50 dark:hover:bg-white/10 rounded text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors"
              style={{ display: searchQuery ? 'none' : undefined }}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Type filters */}
      {visibleFilters.length > 0 && (
        <div className="flex items-center gap-0.5">
          {visibleFilters.map(({ key, icon: Icon, label }) => {
            const active = filterType === key;
            return (
              <button
                key={key}
                onClick={() => handleTypeClick(key)}
                className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all duration-300 ${
                  active ? 'bg-blue-600/30' : 'hover:bg-zinc-200/50 dark:hover:bg-white/10'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
                  active ? 'text-blue-500' : 'text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'
                }`} />
                <span className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 max-w-0 group-hover:max-w-20 opacity-0 group-hover:opacity-100 ${
                  active ? 'text-blue-500' : 'text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'
                }`}>{label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Pin filter — no separator line */}
      {hasPinned && (
        <button
          onClick={() => setFilterPinned(!filterPinned)}
          className={`group flex items-center gap-1.5 px-2 py-1.5 rounded-xl transition-all duration-300 ${
            filterPinned ? 'bg-amber-600/30' : 'hover:bg-zinc-200/50 dark:hover:bg-white/10'
          }`}
        >
          <Pin className={`w-3.5 h-3.5 flex-shrink-0 transition-colors ${
            filterPinned ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'
          }`} />
          <span className={`text-xs font-medium whitespace-nowrap overflow-hidden transition-all duration-300 max-w-0 group-hover:max-w-20 opacity-0 group-hover:opacity-100 ${
            filterPinned ? 'text-amber-500' : 'text-zinc-500 group-hover:text-zinc-900 dark:group-hover:text-white'
          }`}>Pinned</span>
        </button>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Active filter badge */}
      {(filterType || filterPinned || searchQuery) && (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-bold text-blue-500">
          <span className="opacity-50">FILTER</span>
          <button
            onClick={() => { setFilterType(null); setFilterPinned(false); setSearchQuery(''); setIsSearchOpen(false); }}
            className="hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            <X className="w-2.5 h-2.5" />
          </button>
        </div>
      )}
    </div>
  );
};

export default SearchBar;
