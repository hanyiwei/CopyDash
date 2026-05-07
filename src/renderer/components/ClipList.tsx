import React, { useEffect, useRef, useState } from 'react';
import { useStore } from '../store/useStore';
import ClipItem from './ClipItem';
import ScrollThumb from './ScrollThumb';
import { Clipboard } from 'lucide-react';
import { clipMatchesType } from '../utils/clipType';

const ClipList: React.FC = () => {
  const clips = useStore(state => state.clips);
  const searchQuery = useStore(state => state.searchQuery);
  const filterType = useStore(state => state.filterType);
  const filterPinned = useStore(state => state.filterPinned);
  const togglePin = useStore(state => state.togglePin);
  const removeClip = useStore(state => state.removeClip);
  const selectedClipId = useStore(state => state.selectedClipId);
  const setSelectedClipId = useStore(state => state.setSelectedClipId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [removingIds, setRemovingIds] = useState(new Set<string>());

  // Auto-select first clip
  useEffect(() => {
    if (clips.length > 0 && !selectedClipId) {
      setSelectedClipId(clips[0].id);
    }
  }, [clips, selectedClipId, setSelectedClipId]);

  useEffect(() => {
    const handleAction = async ({ action, clip }: any) => {
      if (action === 'paste') {
        await (window as any).electron.ipcRenderer.invoke('clipboard:writeAndPaste', clip, false);
      }
      if (action === 'paste-plain') {
        await (window as any).electron.ipcRenderer.invoke('clipboard:writeAndPaste', clip, true);
      }
      if (action === 'copy') {
        let copyText = clip.content_text;
        if (clip.type === 4) {
          try {
            copyText = (JSON.parse(clip.content_text || '[]') as string[]).join('\r\n');
          } catch { /* keep raw content_text */ }
        }
        await (window as any).electron.ipcRenderer.invoke('clipboard:writeText', copyText);
      }
      if (action === 'toggle-pin') {
        const newPinStatus = clip.is_pinned ? 0 : 1;
        await (window as any).electron.ipcRenderer.invoke('db:updatePin', clip.id, newPinStatus);
        togglePin(clip.id);
      }
      if (action === 'delete') {
        await (window as any).electron.ipcRenderer.invoke('db:deleteById', clip.id);
        setRemovingIds(prev => new Set(prev).add(clip.id));
        // Timeout fallback in case animation end event doesn't fire (e.g. filter change)
        setTimeout(() => {
          removeClip(clip.id);
          setRemovingIds(prev => {
            const next = new Set(prev);
            next.delete(clip.id);
            return next;
          });
        }, 500);
      }
    };

    const unsubscribe = (window as any).electron.ipcRenderer.on('menu-action', handleAction);

    return () => unsubscribe();
  }, [togglePin, removeClip]);

  const filteredClips = clips.filter(clip => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      if (!clip.content_text?.toLowerCase().includes(q) &&
          !clip.source_app?.toLowerCase().includes(q)) return false;
    }
    if (filterType && !clipMatchesType(clip, filterType)) return false;
    if (filterPinned && !clip.is_pinned) return false;
    return true;
  });

  const handleDoubleClick = (clip: any, e: React.MouseEvent) => {
    const isShiftPressed = e.shiftKey;
    (window as any).electron.ipcRenderer.invoke('clipboard:writeAndPaste', clip, isShiftPressed);
  };

  const handleContextMenu = (clip: any) => {
    (window as any).electron.ipcRenderer.invoke('menu:showContext', clip);
  };

  const handleAnimationEnd = (clipId: string) => {
    if (removingIds.has(clipId)) {
      removeClip(clipId);
      setRemovingIds(prev => {
        const next = new Set(prev);
        next.delete(clipId);
        return next;
      });
    }
  };

  // Wheel rotation (vertical delta) is remapped to horizontal scroll
  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY !== 0 && scrollRef.current) {
      scrollRef.current.scrollBy({
        left: e.deltaY,
        behavior: 'auto'
      });
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div
        ref={scrollRef}
        onWheel={handleWheel}
        className="flex-1 overflow-x-auto overflow-y-hidden flex items-stretch p-4 pt-2 gap-4 custom-scrollbar"
      >
        {filteredClips.length === 0 ? (
          <div className="min-w-full flex flex-col items-center justify-center text-center opacity-30">
            <div className="w-16 h-16 bg-page-dim/50 dark:bg-white/5 rounded-full flex items-center justify-center mb-4">
              <Clipboard className="w-8 h-8" />
            </div>
            <p className="text-sm font-bold uppercase tracking-widest">No records found</p>
            {searchQuery && <p className="text-xs mt-2">Try clearing your search</p>}
          </div>
        ) : (
          <>
            {filteredClips.map((clip) => (
              <div
                key={clip.id}
                onContextMenu={() => handleContextMenu(clip)}
                className={`flex-shrink-0 max-w-[240px] overflow-hidden transition-[max-width] duration-500 ease-out ${
                  removingIds.has(clip.id) ? 'card-exit max-w-0' : ''
                }`}
                onAnimationEnd={() => handleAnimationEnd(clip.id)}
              >
                <ClipItem
                  clip={clip}
                  onDoubleClick={handleDoubleClick}
                />
              </div>
            ))}
            <div className="flex-shrink-0 w-8" />
          </>
        )}
      </div>

      <ScrollThumb containerRef={scrollRef} itemCount={filteredClips.length} />
    </div>
  );
};

export default ClipList;
