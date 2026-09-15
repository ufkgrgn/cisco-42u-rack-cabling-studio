import React, { useState, useMemo, useRef } from 'react';

import { useProjectStore } from '../../../core/state/projectStore';
import { catalogSearchEngine, getAllCatalogItems } from '../../../core/catalog/catalogRegistry';
import { CatalogFilterBar } from './CatalogFilterBar';
import { VirtualizedCatalogList } from './VirtualizedCatalogList';
import { CustomDeviceWizard } from '../wizard/CustomDeviceWizard';
import { importCustomDeviceAuto } from '../../../core/catalog/customDeviceIO';
import { Search, Plus, Upload, X } from 'lucide-react';

interface CatalogBrowserProps {
  onQuickMount: (catalogId: string, u: number) => void;
}

const FAVORITES_STORAGE_KEY = 'rackstudio.favorites';

export const CatalogBrowser: React.FC<CatalogBrowserProps> = ({ onQuickMount }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [manufacturer, setManufacturer] = useState<string>('all');
  const [uHeight, setUHeight] = useState<string>('all');
  const [poeOnly, setPoeOnly] = useState<boolean>(false);
  const [favoritesOnly, setFavoritesOnly] = useState<boolean>(false);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const { project, removeCustomDevice, importCustomDevices } = useProjectStore();

  const handleToggleFavorite = (id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch {
        // ignore quota errors
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setSearchQuery('');
    setCategory('all');
    setManufacturer('all');
    setUHeight('all');
    setPoeOnly(false);
    setFavoritesOnly(false);
  };

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    category !== 'all' ||
    manufacturer !== 'all' ||
    uHeight !== 'all' ||
    poeOnly ||
    favoritesOnly;

  // Search evaluation using CatalogSearchEngine (<5ms)
  const filteredItems = useMemo(() => {
    // Depend on project.customCatalog and revision to trigger re-search when custom items change
    void project.customCatalog;

    return catalogSearchEngine.search({
      query: searchQuery,
      category: category !== 'all' ? category : undefined,
      manufacturer: manufacturer !== 'all' ? manufacturer : undefined,
      uHeight: uHeight !== 'all' ? uHeight : undefined,
      poeOnly: poeOnly ? true : undefined,
      favoritesOnly: favoritesOnly ? true : undefined,
      favoriteIds: favorites
    });
  }, [searchQuery, category, manufacturer, uHeight, poeOnly, favoritesOnly, favorites, project.customCatalog]);

  const totalCatalogCount = getAllCatalogItems().length;

  // File import handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const result = importCustomDeviceAuto(content);
      if (result.success && result.devices.length > 0) {
        importCustomDevices(result.devices as any);
        alert(`${result.devices.length} adet özel donanım başarıyla içe aktarıldı.`);
      } else {
        const msg = (result.errors || []).map((err) => `${err.path}: ${err.message}`).join('\n');
        alert(`İçe aktarma hatası:\n${msg || 'Dosya biçimi geçersiz.'}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex-1 flex flex-col p-3 overflow-hidden select-none">
      {/* Top Action Bar: Search + Custom Device + Import */}
      <div className="flex items-center gap-1.5 mb-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-400" />
          <input
            type="text"
            placeholder="Donanım ara (Cisco, 48 port, PoE...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-7 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-gray-200 placeholder-gray-400 focus:outline-none focus:border-sky-500"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-2 text-gray-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Custom Device Button */}
        <button
          type="button"
          onClick={() => setIsWizardOpen(true)}
          title="Yeni Özel Donanım Sihirbazını Başlat"
          className="px-2.5 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center gap-1 shadow-sm transition whitespace-nowrap"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Özel</span>
        </button>

        {/* Import File Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title="JSON veya YAML Donanım Dosyası İçe Aktar"
          className="p-1.5 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-300 border border-gray-600 transition"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.yaml,.yml"
          onChange={handleFileUpload}
          className="hidden"
        />
      </div>

      {/* Filter Bar */}
      <CatalogFilterBar
        activeCategory={category}
        onSelectCategory={setCategory}
        activeManufacturer={manufacturer}
        onSelectManufacturer={setManufacturer}
        activeU={uHeight}
        onSelectU={setUHeight}
        poeOnly={poeOnly}
        onTogglePoe={() => setPoeOnly(!poeOnly)}
        favoritesOnly={favoritesOnly}
        onToggleFavorites={() => setFavoritesOnly(!favoritesOnly)}
        onClearFilters={handleClearFilters}
        hasActiveFilters={hasActiveFilters}
      />

      {/* Result Count Status */}
      <div className="flex items-center justify-between text-[11px] text-gray-400 py-1.5 px-0.5 border-b border-gray-800">
        <span className="catalog-count">
          {filteredItems.length} / {totalCatalogCount} donanım
        </span>
        {hasActiveFilters && (
          <span className="text-[10px] text-sky-400 font-mono">Filtrelendi</span>
        )}
      </div>

      {/* Virtualized Device List */}
      <div className="flex-1 overflow-hidden mt-1 flex flex-col">
        <VirtualizedCatalogList
          items={filteredItems}
          favorites={favorites}
          onToggleFavorite={handleToggleFavorite}
          onQuickMount={onQuickMount}
          onDeleteCustom={(id) => removeCustomDevice(id)}
        />
      </div>

      {/* Custom Device Wizard Dialog */}
      <CustomDeviceWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
      />
    </div>
  );
};
