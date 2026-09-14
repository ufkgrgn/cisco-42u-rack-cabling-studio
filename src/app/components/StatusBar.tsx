import React from 'react';
import { useProjectStore } from '../../core/state/projectStore';
import { useHistoryStore } from '../../core/state/historyStore';
import { CheckCircle2, History } from 'lucide-react';

export const StatusBar: React.FC = () => {
  const { isDirty, project } = useProjectStore();
  const { lastAction, canUndo, canRedo } = useHistoryStore();

  const totalDevices = project.racks.reduce((acc, r) => acc + r.devices.length, 0);

  return (
    <footer className="h-7 bg-[#111827] border-t border-[#374151] flex items-center justify-between px-4 text-[11px] text-gray-400 select-none z-20">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 text-emerald-400 font-medium">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{isDirty ? 'Unsaved changes (WAL active)' : 'All changes saved'}</span>
        </div>

        {lastAction && (
          <div className="flex items-center gap-1 text-gray-400 border-l border-[#374151] pl-3">
            <History className="w-3 h-3 text-[#38bdf8]" />
            <span>Action: <b className="text-gray-200">{lastAction}</b></span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 font-mono">
        <span>Racks: <b className="text-white">{project.racks.length}</b></span>
        <span>Mounted Devices: <b className="text-white">{totalDevices}</b></span>
        <span>Cables: <b className="text-white">{project.cables.length}</b></span>
        <span className="text-[#38bdf8]">Undo/Redo: {canUndo ? 'Z' : '-'}/{canRedo ? 'Y' : '-'}</span>
      </div>
    </footer>
  );
};
