import React from 'react';
import { useProjectStore } from '../../core/state/projectStore';
import { useHistoryStore } from '../../core/state/historyStore';
import { PlaceDeviceCommand } from '../../core/history/commands/PlaceDeviceCommand';
import { CatalogBrowser } from './catalog/CatalogBrowser';
import { CustomDeviceWizard } from './wizard/CustomDeviceWizard';
import { Box, Cable, Settings } from 'lucide-react';

interface SidebarProps {
  activeTab: 'catalog' | 'wizard' | 'schedule' | 'inspector';
  onSelectTab: (tab: 'catalog' | 'wizard' | 'schedule' | 'inspector') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const { project } = useProjectStore();
  const { executeCommand } = useHistoryStore();

  const activeRack = project.racks.find(r => r.id === project.activeRackId) || project.racks[0];

  const handleQuickMount = (catalogId: string, uHeight: number) => {
    if (!activeRack) return;

    // Find first available slot
    const totalU = activeRack.totalU;
    let foundU: number | null = null;

    for (let u = 1; u <= totalU - uHeight + 1; u++) {
      const endU = u + uHeight - 1;
      const collision = activeRack.devices.some(d => {
        if (d.face !== 'front') return false;
        const dEnd = d.startU + d.uHeight - 1;
        return Math.max(u, d.startU) <= Math.min(endU, dEnd);
      });
      if (!collision) {
        foundU = u;
        break;
      }
    }

    if (foundU !== null) {
      executeCommand(new PlaceDeviceCommand({
        rackId: activeRack.id,
        catalogId,
        startU: foundU,
        face: 'front'
      }));
    } else {
      alert(`No free ${uHeight}U slot available in ${activeRack.name}`);
    }
  };

  return (
    <aside className="w-80 bg-[#111827] border-r border-[#374151] flex flex-col z-10 select-none">
      {/* Tab Navigation */}
      <div className="flex border-b border-[#374151] bg-[#0d121f]">
        <button
          onClick={() => onSelectTab('catalog')}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'catalog'
              ? 'text-[#38bdf8] border-b-2 border-[#38bdf8] bg-[#111827]'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Box className="w-3.5 h-3.5" />
          <span>Catalog</span>
        </button>
        <button
          onClick={() => onSelectTab('schedule')}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'schedule'
              ? 'text-[#38bdf8] border-b-2 border-[#38bdf8] bg-[#111827]'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Cable className="w-3.5 h-3.5" />
          <span>Cables</span>
        </button>
        <button
          onClick={() => onSelectTab('inspector')}
          className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition ${
            activeTab === 'inspector'
              ? 'text-[#38bdf8] border-b-2 border-[#38bdf8] bg-[#111827]'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>Details</span>
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'catalog' && (
        <CatalogBrowser onQuickMount={handleQuickMount} />
      )}

      {activeTab === 'wizard' && (
        <>
          <CustomDeviceWizard
            isOpen={true}
            onClose={() => onSelectTab('catalog')}
          />
          <CatalogBrowser onQuickMount={handleQuickMount} />
        </>
      )}

      {activeTab === 'schedule' && (
        <div className="flex-1 p-3 overflow-y-auto text-xs text-gray-300">
          <h3 className="font-semibold text-white mb-2">Connected Cables ({project.cables.length})</h3>
          {project.cables.length === 0 ? (
            <p className="text-gray-500 italic">No cable runs connected yet.</p>
          ) : (
            <div className="space-y-1.5">
              {project.cables.map(c => (
                <div key={c.id} className="p-2 rounded bg-[#161f30] border border-[#232f45] text-[11px]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold" style={{ color: c.color }}>{c.id}</span>
                    <span className="capitalize text-gray-400">{c.category}</span>
                  </div>
                  <div className="text-gray-400 mt-0.5">
                    From: {c.from.deviceInstanceId}:{c.from.portId}
                  </div>
                  <div className="text-gray-400">
                    To: {c.to.deviceInstanceId}:{c.to.portId}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'inspector' && (
        <div className="flex-1 p-3 overflow-y-auto text-xs text-gray-300">
          <h3 className="font-semibold text-white mb-2">Inspector Details</h3>
          <div className="p-2.5 rounded bg-[#161f30] border border-[#232f45] space-y-1 text-[11px]">
            <div>Rack: <b className="text-white">{activeRack?.name}</b></div>
            <div>Total Height: <b className="text-white">{activeRack?.totalU}U</b></div>
            <div>Occupied Slots: <b className="text-white">{activeRack?.devices.length}</b> devices</div>
          </div>
        </div>
      )}
    </aside>
  );
};
