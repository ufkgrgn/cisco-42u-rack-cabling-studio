import React, { useRef, useState, useEffect } from 'react';
import { DeviceCatalogItem } from '../../../core/types';
import { CatalogCard } from './CatalogCard';

interface VirtualizedCatalogListProps {
  items: DeviceCatalogItem[];
  favorites: Set<string>;
  onToggleFavorite: (id: string) => void;
  onQuickMount: (catalogId: string, u: number) => void;
  onDeleteCustom?: (id: string) => void;
  itemHeight?: number;
}

export const VirtualizedCatalogList: React.FC<VirtualizedCatalogListProps> = ({
  items,
  favorites,
  onToggleFavorite,
  onQuickMount,
  onDeleteCustom,
  itemHeight = 78
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState<number>(0);
  const [viewportHeight, setViewportHeight] = useState<number>(500);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const updateHeight = () => {
      setViewportHeight(el.clientHeight);
    };

    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(el);

    return () => ro.disconnect();
  }, []);

  const totalCount = items.length;
  const totalHeight = totalCount * itemHeight;

  // Windowing calculation with 3-item overscan buffer
  const buffer = 3;
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - buffer);
  const endIndex = Math.min(totalCount, Math.ceil((scrollTop + viewportHeight) / itemHeight) + buffer);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  if (totalCount === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-gray-500">
        <p className="text-xs catalog-count">0 donanım — filtreleri değiştirin</p>
        <p className="text-[11px] text-gray-600 mt-1">Arama kriterlerine uygun donanım bulunamadı.</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto relative pr-1 space-y-1"
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0
          }}
          className="space-y-1.5"
        >
          {visibleItems.map((item) => (
            <CatalogCard
              key={item.id}
              item={item}
              isFavorite={favorites.has(item.id)}
              onToggleFavorite={onToggleFavorite}
              onQuickMount={onQuickMount}
              onDeleteCustom={onDeleteCustom}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
