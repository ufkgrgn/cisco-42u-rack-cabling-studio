import React from 'react';
import { DeviceCatalogItem } from '../../../core/types';
import { engineBridge } from '../../../engine/bridge/EngineBridge';
import { Star, PlusCircle, Trash2, Download, Zap } from 'lucide-react';
import { exportCustomDeviceToJson, exportCustomDeviceToYaml } from '../../../core/catalog/customDeviceIO';

interface CatalogCardProps {
  item: DeviceCatalogItem;
  isFavorite: boolean;
  onToggleFavorite: (id: string) => void;
  onQuickMount: (catalogId: string, u: number) => void;
  onDeleteCustom?: (id: string) => void;
}

export const CatalogCard: React.FC<CatalogCardProps> = ({
  item,
  isFavorite,
  onToggleFavorite,
  onQuickMount,
  onDeleteCustom
}) => {
  const hasPoe = item.ports.some(p => p.poe === true);

  // Pointer-based Drag Initiation to GPU Canvas
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only primary mouse button or touch
    if (e.button !== 0) return;

    // Do not initiate drag if clicking button, star, or interactive controls
    const target = e.target as HTMLElement;
    if (target.closest('button') || target.closest('input') || target.closest('select')) {
      return;
    }

    e.preventDefault();
    engineBridge.emit('device:drag-start', {
      catalogId: item.id
    });

    const handleWindowPointerMove = (ev: PointerEvent) => {
      engineBridge.emit('device:drag-move', {
        screenX: ev.clientX,
        screenY: ev.clientY
      });
    };

    const handleWindowPointerUp = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
      engineBridge.emit('device:drag-end', {
        screenX: ev.clientX,
        screenY: ev.clientY
      });
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);
  };

  const handleExportJson = (e: React.MouseEvent) => {
    e.stopPropagation();
    const json = exportCustomDeviceToJson(item as any);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportYaml = (e: React.MouseEvent) => {
    e.stopPropagation();
    const yaml = exportCustomDeviceToYaml(item as any);
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.id}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      data-device-id={item.id}
      onPointerDown={handlePointerDown}
      className="p-2.5 rounded bg-[#161f30] border border-[#232f45] hover:border-sky-500/70 transition group cursor-grab active:cursor-grabbing select-none relative"
    >
      {/* Top row: Title + Badges */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-semibold text-gray-200 group-hover:text-sky-400 transition truncate">
              {item.name}
            </span>
            {item.isCustom && (
              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-950 text-teal-300 border border-teal-700">
                CUSTOM
              </span>
            )}
            {hasPoe && (
              <span className="text-[9px] font-semibold px-1 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800 flex items-center gap-0.5">
                <Zap className="w-2.5 h-2.5" />
                PoE
              </span>
            )}
          </div>
          <div className="text-[10px] text-gray-400 mt-0.5 truncate">
            {item.manufacturer} • <span className="capitalize">{item.category}</span>
            {item.powerWatts ? ` • ${item.powerWatts}W` : ''}
            {item.ports.length > 0 ? ` • ${item.ports.length} port` : ''}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite(item.id);
            }}
            title={isFavorite ? 'Favorilerden Çıkar' : 'Favorilere Ekle'}
            className="p-1 rounded text-gray-500 hover:text-yellow-400 transition"
          >
            <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
          </button>

          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f2937] text-gray-300 font-mono font-bold">
            {item.u}U
          </span>
        </div>
      </div>

      {/* Bottom row: Quick Mount & Custom Actions */}
      <div className="mt-2 pt-1.5 border-t border-gray-800/80 flex items-center justify-between text-[11px]">
        <div className="flex items-center gap-1">
          {item.isCustom && (
            <>
              <button
                type="button"
                onClick={handleExportJson}
                title="JSON İndir"
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f2937] text-sky-400 hover:bg-[#374151] transition flex items-center gap-0.5"
              >
                <Download className="w-2.5 h-2.5" />
                JSON
              </button>
              <button
                type="button"
                onClick={handleExportYaml}
                title="YAML İndir"
                className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f2937] text-amber-400 hover:bg-[#374151] transition flex items-center gap-0.5"
              >
                <Download className="w-2.5 h-2.5" />
                YAML
              </button>
              {onDeleteCustom && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${item.name}" özel cihazını silmek istiyor musunuz?`)) {
                      onDeleteCustom(item.id);
                    }
                  }}
                  title="Özel Cihazı Sil"
                  className="p-1 rounded text-rose-400 hover:bg-rose-950/50 transition"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickMount(item.id, item.u);
          }}
          className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded bg-sky-600/20 text-sky-400 hover:bg-sky-600 hover:text-white transition"
          title="Aktif kabindeki ilk boş slota yerleştir"
        >
          <PlusCircle className="w-3 h-3" />
          Mount
        </button>
      </div>
    </div>
  );
};
