import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ScrollThumbProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  itemCount: number;
}

const ScrollThumb: React.FC<ScrollThumbProps> = ({ containerRef, itemCount }) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const [thumbLeft, setThumbLeft] = useState(0);
  const [thumbWidth, setThumbWidth] = useState(40);
  const dragging = useRef(false);

  const updateThumb = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const maxScroll = scrollWidth - clientWidth;
    const trackW = trackRef.current?.clientWidth || 120;
    const thumbW = Math.max(24, (clientWidth / scrollWidth) * trackW);
    const thumbL = maxScroll > 0 ? (scrollLeft / maxScroll) * (trackW - thumbW) : 0;

    setThumbWidth(thumbW);
    setThumbLeft(thumbL);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateThumb, { passive: true });
    updateThumb();
    const ro = new ResizeObserver(updateThumb);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateThumb);
      ro.disconnect();
    };
  }, [containerRef, updateThumb]);

  useEffect(() => {
    updateThumb();
  }, [itemCount, updateThumb]);

  const scrollToRatio = useCallback(
    (ratio: number) => {
      const el = containerRef.current;
      if (!el) return;
      const maxScroll = el.scrollWidth - el.clientWidth;
      el.scrollTo({ left: Math.max(0, ratio * maxScroll), behavior: 'auto' });
    },
    [containerRef],
  );

  const handleTrackClick = (e: React.MouseEvent) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    scrollToRatio(ratio);
  };

  const handleThumbMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const track = trackRef.current!;
    const trackRect = track.getBoundingClientRect();

    const onMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const x = ev.clientX - trackRect.left;
      const ratio = Math.max(0, Math.min(1, x / trackRect.width));
      scrollToRatio(ratio);
    };

    const onUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  if (itemCount <= 50) return null;

  return (
    <div className="flex justify-center pb-2">
      <div
        ref={trackRef}
        className="w-40 mx-auto relative h-1.5 rounded-full bg-page-dim dark:bg-white/5 cursor-pointer hover:h-2 transition-all"
        onClick={handleTrackClick}
      >
        <div
          className="absolute top-0 h-full rounded-full bg-badge dark:bg-white/20 hover:bg-brown-subtle dark:hover:bg-white/30 transition-colors"
          style={{ left: thumbLeft, width: thumbWidth }}
          onMouseDown={handleThumbMouseDown}
        />
      </div>
    </div>
  );
};

export default ScrollThumb;
