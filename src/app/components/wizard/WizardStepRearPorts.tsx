import React, { useState } from 'react';
import { DeviceCatalogItem, PortDefinition, PortType } from '../../../core/types';

interface WizardStepRearPortsProps {
  device: Partial<DeviceCatalogItem>;
  onChange: (updates: Partial<DeviceCatalogItem>) => void;
}

export const WizardStepRearPorts: React.FC<WizardStepRearPortsProps> = ({ device, onChange }) => {
  const rearPorts = device.rearPorts || [];
  const [hasMgmt, setHasMgmt] = useState<boolean>(rearPorts.some(p => p.id === 'mgmt0' || p.id === 'mgmt'));
  const [hasConsole, setHasConsole] = useState<boolean>(rearPorts.some(p => p.id === 'console'));
  const [inletType, setInletType] = useState<PortType>('c14');

  const updateRearPorts = (includeMgmt: boolean, includeConsole: boolean, psuType: PortType) => {
    const newRear: PortDefinition[] = [];

    // Management Port
    if (includeMgmt) {
      newRear.push({
        id: 'mgmt',
        name: 'MGMT (OOB)',
        type: 'rj45',
        speed: '1G',
        xPct: 0.12,
        yPct: 0.50,
        facing: 'rear'
      });
    }

    // Console Port
    if (includeConsole) {
      newRear.push({
        id: 'console',
        name: 'Console (RJ45)',
        type: 'rj45',
        xPct: 0.22,
        yPct: 0.50,
        facing: 'rear'
      });
    }

    // Power Supplies
    if (device.powerWatts && device.powerWatts > 0) {
      newRear.push({
        id: 'psu_1',
        name: `PSU 1 (${psuType.toUpperCase()})`,
        type: psuType,
        xPct: 0.80,
        yPct: 0.50,
        facing: 'rear'
      });

      if (device.dualPsu) {
        newRear.push({
          id: 'psu_2',
          name: `PSU 2 (${psuType.toUpperCase()})`,
          type: psuType,
          xPct: 0.90,
          yPct: 0.50,
          facing: 'rear'
        });
      }
    }

    onChange({ rearPorts: newRear });
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700/60 pb-2">
        <h3 className="text-sm font-semibold text-white">Adım 5: Arka Panel I/O & Güç Girişleri</h3>
        <p className="text-xs text-gray-400">Arka yüzeydeki AC güç soketlerini, bant dışı yönetim (OOB) ve konsol portlarını tanımlayın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Out of Band Management */}
        <div className="bg-[#161f30] p-3 rounded-lg border border-[#232f45]">
          <span className="block text-xs font-semibold text-white mb-1">Bant Dışı Yönetim Portu (OOB MGMT)</span>
          <p className="text-[11px] text-gray-400 mb-2">
            Özel yönetim ağı bağlantısı için 1G RJ45 portu ekler (Cisco mgmt0, Dell iDRAC, HPE iLO).
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasMgmt}
              onChange={(e) => {
                setHasMgmt(e.target.checked);
                updateRearPorts(e.target.checked, hasConsole, inletType);
              }}
              className="w-4 h-4 rounded text-sky-500 bg-gray-900 border-gray-700 focus:ring-sky-500"
            />
            <span className="text-xs text-sky-300 font-medium">Arka Yüze MGMT Portu Ekle</span>
          </label>
        </div>

        {/* Serial Console */}
        <div className="bg-[#161f30] p-3 rounded-lg border border-[#232f45]">
          <span className="block text-xs font-semibold text-white mb-1">Seri Konsol Portu (Console)</span>
          <p className="text-[11px] text-gray-400 mb-2">
            Konsol sunucusu veya yerel yönetim için arka panele RJ45 seri port ekler.
          </p>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={hasConsole}
              onChange={(e) => {
                setHasConsole(e.target.checked);
                updateRearPorts(hasMgmt, e.target.checked, inletType);
              }}
              className="w-4 h-4 rounded text-sky-500 bg-gray-900 border-gray-700 focus:ring-sky-500"
            />
            <span className="text-xs text-sky-300 font-medium">Arka Yüze Konsol Portu Ekle</span>
          </label>
        </div>

        {/* Power Inlet Type */}
        <div className="col-span-2 bg-[#161f30] p-3 rounded-lg border border-[#232f45]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-amber-400">AC Güç Soketi Standart Tipi</span>
            <span className="text-xs text-gray-300">
              {device.dualPsu ? '2x Redundant Giriş' : '1x Giriş'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              { type: 'c14', label: 'IEC C14 (Standart 10A/15A)', desc: '1000W altı anahtar/sunucular' },
              { type: 'c20', label: 'IEC C20 (Yüksek Güç 16A/20A)', desc: '1000W+ sunucular, PDU, omurga' },
              { type: 'terminal', label: 'DC / Terminal Blok', desc: '-48V Telekom DC besleme' }
            ].map((opt) => (
              <button
                key={opt.type}
                type="button"
                onClick={() => {
                  setInletType(opt.type as PortType);
                  updateRearPorts(hasMgmt, hasConsole, opt.type as PortType);
                }}
                className={`p-2 rounded text-left border transition ${
                  inletType === opt.type
                    ? 'bg-amber-950/40 border-amber-500 text-white'
                    : 'bg-[#1f2937] border-gray-700 text-gray-300 hover:bg-[#283548]'
                }`}
              >
                <div className="text-xs font-bold">{opt.label}</div>
                <div className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="text-xs text-gray-400 px-1">
        Tanımlı Arka Panel Port Sayısı: <strong className="text-white">{rearPorts.length}</strong>
      </div>
    </div>
  );
};
