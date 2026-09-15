import React from 'react';
import { DeviceCatalogItem } from '../../../core/types';

interface WizardStepPowerProps {
  device: Partial<DeviceCatalogItem>;
  onChange: (updates: Partial<DeviceCatalogItem>) => void;
}

export const WizardStepPower: React.FC<WizardStepPowerProps> = ({ device, onChange }) => {
  const watts = device.powerWatts || 0;
  const dualPsu = Boolean(device.dualPsu);
  const calculatedBtu = Math.round(watts * 3.412142);
  const currentBtu = device.heatBtu !== undefined ? device.heatBtu : calculatedBtu;

  const handleWattsChange = (newWatts: number) => {
    const safeWatts = Math.max(0, Math.min(20000, newWatts));
    const newBtu = Math.round(safeWatts * 3.412142);
    onChange({
      powerWatts: safeWatts,
      heatBtu: newBtu,
      heatBtuPerHour: newBtu
    });
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700/60 pb-2">
        <h3 className="text-sm font-semibold text-white">Adım 3: Güç Tüketimi & Isıl Yük (BTU/hr)</h3>
        <p className="text-xs text-gray-400">Veri merkezi enerji bütçesi ve soğutma kapasitesi hesaplamaları.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Typical Power Watts */}
        <div>
          <label htmlFor="power-watts" className="block text-xs font-medium text-gray-300 mb-1">
            Tipik Güç Tüketimi (Watts)
          </label>
          <div className="relative">
            <input
              id="power-watts"
              type="number"
              min={0}
              max={20000}
              value={watts}
              onChange={(e) => handleWattsChange(parseInt(e.target.value, 10) || 0)}
              className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white font-mono focus:outline-none focus:border-sky-500"
            />
            <span className="absolute right-3 top-1.5 text-[10px] text-gray-500 font-mono">W</span>
          </div>
          <div className="flex gap-1.5 mt-2">
            {[0, 45, 250, 370, 750, 1100, 1600].map((presetW) => (
              <button
                key={presetW}
                type="button"
                onClick={() => handleWattsChange(presetW)}
                className={`text-[10px] px-2 py-0.5 rounded transition ${
                  watts === presetW
                    ? 'bg-amber-600 text-white font-bold'
                    : 'bg-[#1f2937] text-gray-300 hover:bg-[#374151]'
                }`}
              >
                {presetW}W
              </button>
            ))}
          </div>
        </div>

        {/* Dual PSU Toggle */}
        <div className="bg-[#161f30] p-3 rounded-lg border border-[#232f45] flex flex-col justify-between">
          <div>
            <span className="block text-xs font-semibold text-gray-200 mb-1">Yedekli Güç Kaynağı (Dual / Redundant PSU)</span>
            <p className="text-[11px] text-gray-400">
              Cihazın 2 bağımsız AC güç girişi (A+B Beslemesi) bulunup bulunmadığını belirtir.
            </p>
          </div>
          <label className="flex items-center gap-2 mt-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dualPsu}
              onChange={(e) => onChange({ dualPsu: e.target.checked })}
              className="w-4 h-4 rounded text-sky-500 bg-gray-900 border-gray-700 focus:ring-sky-500"
            />
            <span className="text-xs text-white font-medium">Çift PSU Destekli (Redundant A+B)</span>
          </label>
        </div>

        {/* Heat Dissipation (BTU/hr) */}
        <div className="col-span-2 bg-[#161f30] p-3 rounded-lg border border-[#232f45]">
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="heat-btu" className="text-xs font-semibold text-amber-400">
              Isıl Yük / Isı Yayılımı (BTU / Saat)
            </label>
            <button
              type="button"
              onClick={() => {
                const auto = Math.round(watts * 3.412142);
                onChange({ heatBtu: auto, heatBtuPerHour: auto });
              }}
              className="text-[10px] px-2 py-0.5 rounded bg-[#1f2937] text-amber-300 hover:bg-[#374151] border border-amber-500/30 transition"
            >
              Otomatik Hesapla (Watts × 3.412)
            </button>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="heat-btu"
              type="number"
              min={0}
              value={currentBtu}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10) || 0;
                onChange({ heatBtu: val, heatBtuPerHour: val });
              }}
              className="w-48 px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-amber-300 font-mono focus:outline-none focus:border-amber-500"
            />
            <span className="text-xs text-gray-400 font-mono">
              ≈ {(currentBtu / 3.412).toFixed(0)} Watts eşdeğeri termal enerji
            </span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">
            ASHRAE TC9.9 veri merkezi soğutma hesabı standardı: 1 Watt = 3.412142 BTU/hr
          </p>
        </div>
      </div>
    </div>
  );
};
