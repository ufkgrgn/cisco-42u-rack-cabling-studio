import React from 'react';
import { DeviceCatalogItem } from '../../../core/types';

interface WizardStepDimensionsProps {
  device: Partial<DeviceCatalogItem>;
  onChange: (updates: Partial<DeviceCatalogItem>) => void;
}

export const WizardStepDimensions: React.FC<WizardStepDimensionsProps> = ({ device, onChange }) => {
  const currentU = Math.max(1, Math.min(60, device.u || 1));
  const depthMm = device.depthMm || 400;
  const weightKg = device.weightKg || 5.0;

  const mmHeight = (currentU * 44.45).toFixed(1);
  const inchHeight = (currentU * 1.75).toFixed(2);

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700/60 pb-2">
        <h3 className="text-sm font-semibold text-white">Adım 2: Fiziksel Boyutlar & Kabin Alanı</h3>
        <p className="text-xs text-gray-400">EIA-310-D standardına uygun U yüksekliğini ve şasi derinliğini belirleyin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* U Height */}
        <div className="col-span-2 bg-[#161f30] p-3 rounded-lg border border-[#232f45]">
          <div className="flex items-center justify-between mb-2">
            <label htmlFor="u-height" className="text-xs font-semibold text-sky-400">
              Yükseklik (U) <span className="text-red-400">*</span>
            </label>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-800">
              {currentU} U ({mmHeight} mm / {inchHeight}")
            </span>
          </div>

          <div className="flex items-center gap-3">
            <input
              id="u-height"
              type="number"
              min={1}
              max={60}
              required
              value={currentU}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onChange({ u: isNaN(val) ? 1 : Math.max(1, Math.min(60, val)) });
              }}
              className="w-20 px-2 py-1 text-xs bg-[#1f2937] border border-[#374151] rounded text-white font-mono text-center focus:outline-none focus:border-sky-500"
            />
            <input
              type="range"
              min={1}
              max={60}
              value={currentU}
              onChange={(e) => onChange({ u: parseInt(e.target.value, 10) })}
              className="flex-1 accent-sky-500 cursor-pointer"
            />
          </div>

          <div className="flex gap-2 mt-2">
            {[1, 2, 3, 4, 6, 8, 12].map((presetU) => (
              <button
                key={presetU}
                type="button"
                onClick={() => onChange({ u: presetU })}
                className={`text-[10px] px-2 py-0.5 rounded transition ${
                  currentU === presetU
                    ? 'bg-sky-600 text-white font-bold'
                    : 'bg-[#1f2937] text-gray-300 hover:bg-[#374151]'
                }`}
              >
                {presetU}U
              </button>
            ))}
          </div>
        </div>

        {/* Chassis Depth */}
        <div>
          <label htmlFor="depth-mm" className="block text-xs font-medium text-gray-300 mb-1">
            Şasi Derinliği (mm)
          </label>
          <div className="relative">
            <input
              id="depth-mm"
              type="number"
              min={50}
              max={1200}
              value={depthMm}
              onChange={(e) => onChange({ depthMm: Math.max(50, Math.min(1200, parseInt(e.target.value, 10) || 400)) })}
              className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white font-mono focus:outline-none focus:border-sky-500"
            />
            <span className="absolute right-3 top-1.5 text-[10px] text-gray-500 font-mono">mm</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Standart anahtar: ~400mm, Derin sunucu: ~750mm</p>
        </div>

        {/* Physical Weight */}
        <div>
          <label htmlFor="weight-kg" className="block text-xs font-medium text-gray-300 mb-1">
            Toplam Ağırlık (kg)
          </label>
          <div className="relative">
            <input
              id="weight-kg"
              type="number"
              step="0.1"
              min={0.1}
              max={300}
              value={weightKg}
              onChange={(e) => onChange({ weightKg: Math.max(0.1, parseFloat(e.target.value) || 5.0) })}
              className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white font-mono focus:outline-none focus:border-sky-500"
            />
            <span className="absolute right-3 top-1.5 text-[10px] text-gray-500 font-mono">kg</span>
          </div>
          <p className="text-[10px] text-gray-500 mt-1">Kabin statik yük taşıma kapasitesi hesaplamalarında kullanılır.</p>
        </div>
      </div>
    </div>
  );
};
