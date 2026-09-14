import React from 'react';
import { useProjectStore } from '../../core/state/projectStore';
import { useHistoryStore } from '../../core/state/historyStore';
import { ResizeRackCommand } from '../../core/history/commands/ResizeRackCommand';
import { ZoomIn, ZoomOut, Maximize2, Layers } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { project } = useProjectStore();
  const { executeCommand } = useHistoryStore();

  const activeRack = project.racks.find(r => r.id === project.activeRackId) || project.racks[0];

  const handleHeightChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTotalU = parseInt(e.target.value, 10);
    if (!activeRack || isNaN(newTotalU)) return;
    executeCommand(new ResizeRackCommand(activeRack.id, newTotalU));
  };

  return (
    <div className="h-10 bg-[#0e1424] border-b border-[#1f2937] flex items-center justify-between px-4 text-xs text-gray-300 select-none">
      <div className="flex items-center gap-4">
        {/* Rack Selector / Height control */}
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#049fd9]" />
          <span className="text-gray-400">Rack Height:</span>
          <select
            value={activeRack?.totalU || 42}
            onChange={handleHeightChange}
            className="bg-[#1f2937] border border-[#374151] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#049fd9]"
          >
            {[12, 18, 24, 36, 42, 45, 48, 52, 60].map((u) => (
              <option key={u} value={u}>
                {u}U
              </option>
            ))}
          </select>
        </div>

        <div className="h-4 w-[1px] bg-[#374151]" />

        {/* View stats */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono">
          <span>Active: <b className="text-white">{activeRack?.name || 'None'}</b></span>
          <span>Devices: <b className="text-white">{activeRack?.devices.length || 0}</b></span>
          <span>Cables: <b className="text-white">{project.cables.length || 0}</b></span>
        </div>
      </div>

      {/* Viewport quick actions */}
      <div className="flex items-center gap-1">
        <button
          className="p-1 rounded hover:bg-[#1f2937] text-gray-400 hover:text-white"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1 rounded hover:bg-[#1f2937] text-gray-400 hover:text-white"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          className="p-1 rounded hover:bg-[#1f2937] text-gray-400 hover:text-white"
          title="Fit View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
