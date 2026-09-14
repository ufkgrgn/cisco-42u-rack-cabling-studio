import React, { useState } from 'react';
import { BUILT_IN_CATALOG } from '../../core/catalog/catalogRegistry';
import { useProjectStore } from '../../core/state/projectStore';
import { useHistoryStore } from '../../core/state/historyStore';
import { PlaceDeviceCommand } from '../../core/history/commands/PlaceDeviceCommand';
import { Box, Cable, Settings, Search, PlusCircle } from 'lucide-react';

interface SidebarProps {
  activeTab: 'catalog' | 'wizard' | 'schedule' | 'inspector';
  onSelectTab: (tab: 'catalog' | 'wizard' | 'schedule' | 'inspector') => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onSelectTab }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const { project } = useProjectStore();
  const { executeCommand } = useHistoryStore();

  const activeRack = project.racks.find(r => r.id === project.activeRackId) || project.racks[0];

  const filteredCatalog = BUILT_IN_CATALOG.filter(item =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.manufacturer.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
        <div className="flex-1 flex flex-col p-3 overflow-hidden">
          {/* Search box */}
          <div className="relative mb-3">
            <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-gray-400" />
            <input
              type="text"
              placeholder="Search hardware, category..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-gray-200 placeholder-gray-400 focus:outline-none focus:border-[#049fd9]"
            />
          </div>

          {/* Device list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {filteredCatalog.map((item) => (
              <div
                key={item.id}
                className="p-2.5 rounded bg-[#161f30] border border-[#232f45] hover:border-[#38bdf8] transition group"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-xs font-medium text-gray-200 group-hover:text-[#38bdf8] transition">
                    {item.name}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#1f2937] text-gray-300 font-mono font-bold">
                    {item.u}U
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                  <span className="capitalize">{item.category} • {item.manufacturer}</span>
                  <button
                    onClick={() => handleQuickMount(item.id, item.u)}
                    className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-[#049fd9]/20 text-[#38bdf8] hover:bg-[#049fd9] hover:text-white transition"
                    title={`Mount into next free slot in ${activeRack?.name || 'rack'}`}
                  >
                    <PlusCircle className="w-3 h-3" />
                    Mount
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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
