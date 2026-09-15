import React from 'react';
import { Star, Zap, RotateCcw } from 'lucide-react';

interface CatalogFilterBarProps {
  activeCategory: string;
  onSelectCategory: (cat: string) => void;
  activeManufacturer: string;
  onSelectManufacturer: (mfr: string) => void;
  activeU: string;
  onSelectU: (u: string) => void;
  poeOnly: boolean;
  onTogglePoe: () => void;
  favoritesOnly: boolean;
  onToggleFavorites: () => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

const CATEGORIES = [
  { id: 'all', label: 'Tümü' },
  { id: 'switch', label: 'Switch' },
  { id: 'router', label: 'Router' },
  { id: 'server', label: 'Server' },
  { id: 'patch-panel', label: 'Patch' },
  { id: 'pdu', label: 'PDU/ATS' },
  { id: 'organizer', label: 'Düzenleyici' },
  { id: 'accessory', label: 'Aksesuar' },
  { id: 'custom', label: 'Özel [Custom]' }
];

const U_PRESETS = ['all', '1', '2', '3', '4', '5+'];

export const CatalogFilterBar: React.FC<CatalogFilterBarProps> = ({
  activeCategory,
  onSelectCategory,
  activeManufacturer,
  onSelectManufacturer,
  activeU,
  onSelectU,
  poeOnly,
  onTogglePoe,
  favoritesOnly,
  onToggleFavorites,
  onClearFilters,
  hasActiveFilters
}) => {
  return (
    <div className="space-y-2 py-1 select-none">
      {/* Category Pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[11px]">
        {CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onSelectCategory(c.id)}
            className={`px-2 py-0.5 rounded whitespace-nowrap transition ${
              activeCategory === c.id
                ? 'bg-sky-600 text-white font-medium shadow-sm'
                : 'bg-[#1f2937] text-gray-300 hover:bg-[#374151]'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Secondary Row: Manufacturer, U-Height, PoE, Favorites */}
      <div className="flex items-center justify-between gap-1 text-[11px] pt-0.5">
        {/* Manufacturer Select */}
        <select
          value={activeManufacturer}
          onChange={(e) => onSelectManufacturer(e.target.value)}
          className="bg-[#1f2937] border border-[#374151] rounded px-1.5 py-0.5 text-gray-200 focus:outline-none focus:border-sky-500 text-[10px]"
        >
          <option value="all">Marka: Tümü</option>
          <option value="cisco">Cisco</option>
          <option value="dell">Dell</option>
          <option value="hpe">HPE</option>
          <option value="estap">Estap</option>
          <option value="generic">Generic</option>
          <option value="custom">Custom</option>
        </select>

        {/* U Height Select */}
        <div className="flex items-center gap-0.5 bg-[#161f30] p-0.5 rounded border border-[#232f45]">
          <span className="text-[10px] text-gray-400 px-1">U:</span>
          {U_PRESETS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onSelectU(u)}
              className={`px-1.5 py-0.5 rounded text-[10px] transition ${
                activeU === u
                  ? 'bg-sky-600 text-white font-bold'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {u === 'all' ? 'Tümü' : `${u}U`}
            </button>
          ))}
        </div>

        {/* Toggle Toggles: PoE & Star */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePoe}
            title="Sadece PoE Portlu Cihazlar"
            className={`p-1 rounded border transition ${
              poeOnly
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-[#1f2937] border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Zap className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={onToggleFavorites}
            title="Sadece Yıldızlı Favoriler"
            className={`p-1 rounded border transition ${
              favoritesOnly
                ? 'bg-yellow-500/20 border-yellow-500 text-yellow-300'
                : 'bg-[#1f2937] border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Star className="w-3 h-3" />
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={onClearFilters}
              title="Filtreleri Temizle"
              className="p-1 rounded bg-rose-950/40 border border-rose-800/60 text-rose-400 hover:bg-rose-900/60 transition"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
