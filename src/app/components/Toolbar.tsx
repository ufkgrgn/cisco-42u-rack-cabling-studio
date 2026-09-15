import React, { useState } from 'react';
import { useProjectStore } from '../../core/state/projectStore';
import { useHistoryStore } from '../../core/state/historyStore';
import { ResizeRackCommand } from '../../core/history/commands/ResizeRackCommand';
import { canResizeRack } from '../../core/placement';
import { engineBridge } from '../../engine/bridge/EngineBridge';
import { ZoomIn, ZoomOut, Maximize2, Layers, Eye, AlertTriangle } from 'lucide-react';

export const Toolbar: React.FC = () => {
  const { project } = useProjectStore();
  const { executeCommand } = useHistoryStore();
  const [activeFace, setActiveFace] = useState<'front' | 'rear'>('front');
  const [customU, setCustomU] = useState<string>('');
  const [resizeWarning, setResizeWarning] = useState<string | null>(null);

  const activeRack = project.racks.find(r => r.id === project.activeRackId) || project.racks[0];

  const handleFaceToggle = (face: 'front' | 'rear') => {
    setActiveFace(face);
    engineBridge.emit('view:toggle-face', { rackId: activeRack?.id, face });
  };

  const applyHeightChange = (newTotalU: number) => {
    if (!activeRack || isNaN(newTotalU)) return;

    const check = canResizeRack(activeRack, newTotalU);
    if (!check.allowed) {
      setResizeWarning(check.message || `Cannot shrink below U${check.maxOccupiedU}`);
      setTimeout(() => setResizeWarning(null), 4000);
      return;
    }

    setResizeWarning(null);
    executeCommand(new ResizeRackCommand(activeRack.id, newTotalU));
  };

  const handleSelectHeight = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = parseInt(e.target.value, 10);
    applyHeightChange(val);
  };

  const handleCustomUKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const val = parseInt(customU, 10);
      if (!isNaN(val)) {
        applyHeightChange(val);
        setCustomU('');
      }
    }
  };

  const handleZoomIn = () => {
    const anchorX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
    const anchorY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
    engineBridge.emit('camera:zoom', { factor: 1.25, screenAnchorX: anchorX, screenAnchorY: anchorY });
  };

  const handleZoomOut = () => {
    const anchorX = typeof window !== 'undefined' ? window.innerWidth / 2 : 500;
    const anchorY = typeof window !== 'undefined' ? window.innerHeight / 2 : 400;
    engineBridge.emit('camera:zoom', { factor: 0.8, screenAnchorX: anchorX, screenAnchorY: anchorY });
  };

  const handleFitView = () => {
    engineBridge.emit('camera:fit-all', undefined);
  };

  return (
    <div className="h-10 bg-[#0e1424] border-b border-[#1f2937] flex items-center justify-between px-4 text-xs text-gray-300 select-none">
      <div className="flex items-center gap-4">
        {/* Front / Rear Viewpoint Switcher */}
        <div className="flex items-center gap-1 bg-[#151c28] border border-[#2b394f] rounded p-0.5">
          <Eye className="w-3.5 h-3.5 text-[#38bdf8] ml-1 mr-0.5" />
          <button
            onClick={() => handleFaceToggle('front')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeFace === 'front'
                ? 'bg-[#0284c7] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Switch to Front View"
          >
            FRONT
          </button>
          <button
            onClick={() => handleFaceToggle('rear')}
            className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
              activeFace === 'rear'
                ? 'bg-[#0284c7] text-white shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Switch to Rear View"
          >
            REAR
          </button>
        </div>

        <div className="h-4 w-[1px] bg-[#374151]" />

        {/* Rack Height Control (Presets + 1-60U input) */}
        <div className="flex items-center gap-2">
          <Layers className="w-3.5 h-3.5 text-[#049fd9]" />
          <span className="text-gray-400">Height:</span>
          <select
            value={activeRack?.totalU || 42}
            onChange={handleSelectHeight}
            className="bg-[#1f2937] border border-[#374151] rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:border-[#049fd9]"
            title="Select Rack Height preset"
          >
            {[12, 18, 24, 36, 42, 45, 48, 52, 60].map((u) => (
              <option key={u} value={u}>
                {u}U
              </option>
            ))}
            {activeRack && ![12, 18, 24, 36, 42, 45, 48, 52, 60].includes(activeRack.totalU) && (
              <option value={activeRack.totalU}>{activeRack.totalU}U (Custom)</option>
            )}
          </select>

          <input
            type="number"
            min={1}
            max={60}
            placeholder="1-60"
            value={customU}
            onChange={(e) => setCustomU(e.target.value)}
            onKeyDown={handleCustomUKeyDown}
            className="w-14 bg-[#1f2937] border border-[#374151] rounded px-1.5 py-0.5 text-xs text-white text-center focus:outline-none focus:border-[#049fd9]"
            title="Enter custom rack height (1-60U) and press Enter"
          />

          {resizeWarning && (
            <span className="flex items-center gap-1 text-amber-400 bg-amber-950/40 border border-amber-800/60 rounded px-1.5 py-0.5 text-[10px]">
              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
              {resizeWarning}
            </span>
          )}
        </div>

        <div className="h-4 w-[1px] bg-[#374151]" />

        {/* View stats */}
        <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono">
          <span>Active: <b className="text-white">{activeRack?.name || 'None'}</b></span>
          <span>Face: <b className={activeFace === 'front' ? 'text-cyan-400' : 'text-amber-400'}>[{activeFace.toUpperCase()}]</b></span>
          <span>Devices: <b className="text-white">{activeRack?.devices.length || 0}</b></span>
          <span>Cables: <b className="text-white">{project.cables.length || 0}</b></span>
        </div>
      </div>

      {/* Viewport quick actions */}
      <div className="flex items-center gap-1">
        <button
          onClick={handleZoomIn}
          className="p-1 rounded hover:bg-[#1f2937] text-gray-400 hover:text-white transition-colors"
          title="Zoom In"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleZoomOut}
          className="p-1 rounded hover:bg-[#1f2937] text-gray-400 hover:text-white transition-colors"
          title="Zoom Out"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleFitView}
          className="p-1 rounded hover:bg-[#1f2937] text-gray-400 hover:text-white transition-colors"
          title="Fit View"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
