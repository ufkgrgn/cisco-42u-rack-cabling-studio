import React, { useState } from 'react';
import { DeviceCatalogItem, PortDefinition, PortType } from '../../../core/types';

interface WizardStepFrontPortsProps {
  device: Partial<DeviceCatalogItem>;
  onChange: (updates: Partial<DeviceCatalogItem>) => void;
}

const PORT_TYPES: { value: PortType; label: string }[] = [
  { value: 'rj45', label: 'RJ45 (Bakır Gigabit / 10G)' },
  { value: 'sfp', label: 'SFP (1G Fiber Cages)' },
  { value: 'sfp+', label: 'SFP+ (10G Fiber Cages)' },
  { value: 'sfp28', label: 'SFP28 (25G Fiber Cages)' },
  { value: 'qsfp+', label: 'QSFP+ (40G Cages)' },
  { value: 'qsfp28', label: 'QSFP28 (100G Cages)' },
  { value: 'lc', label: 'LC Duplex (Optik Kuplör)' },
  { value: 'sc', label: 'SC Duplex (Optik Kuplör)' },
  { value: 'dac', label: 'DAC (Direct Attach Copper)' },
  { value: 'c13', label: 'IEC C13 (PDU Çıkış)' },
  { value: 'c14', label: 'IEC C14 (Güç Giriş)' },
  { value: 'terminal', label: 'Terminal / Konsol / Buton' }
];

export const WizardStepFrontPorts: React.FC<WizardStepFrontPortsProps> = ({ device, onChange }) => {
  const currentPorts = device.ports || [];
  const [portCount, setPortCount] = useState<number>(currentPorts.length);
  const [portType, setPortType] = useState<PortType>(currentPorts[0]?.type || 'rj45');
  const [portSpeed, setPortSpeed] = useState<string>(currentPorts[0]?.speed || '1G');
  const [poeEnabled, setPoeEnabled] = useState<boolean>(Boolean(currentPorts[0]?.poe));
  const [prefix, setPrefix] = useState<string>('Port ');
  const [rows, setRows] = useState<1 | 2>(2);

  const generatePorts = (count: number, type: PortType, speed: string, poe: boolean, pfx: string, rowCount: 1 | 2) => {
    const safeCount = Math.max(0, Math.min(96, count));
    if (safeCount === 0) {
      onChange({ ports: [] });
      return;
    }

    const cols = rowCount === 1 ? safeCount : Math.ceil(safeCount / 2);
    const newPorts: PortDefinition[] = [];

    for (let i = 0; i < safeCount; i++) {
      const col = rowCount === 1 ? i : Math.floor(i / 2);
      const row = rowCount === 1 ? 0 : i % 2;
      const xPct = Number((0.06 + (cols > 1 ? (col / (cols - 1)) * 0.88 : 0)).toFixed(4));
      const yPct = rowCount === 1 ? 0.50 : (row === 0 ? 0.28 : 0.72);

      newPorts.push({
        id: `p${i + 1}`,
        name: `${pfx}${i + 1}`,
        type,
        speed: speed || undefined,
        poe: poe || undefined,
        row,
        group: Math.floor(i / 8) + 1,
        xPct,
        yPct,
        facing: 'front'
      });
    }

    onChange({ ports: newPorts });
  };

  const handleApplyMatrix = () => {
    generatePorts(portCount, portType, portSpeed, poeEnabled, prefix, rows);
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700/60 pb-2">
        <h3 className="text-sm font-semibold text-white">Adım 4: Ön Panel Port Matrisi (0-96 Port)</h3>
        <p className="text-xs text-gray-400">Ön yüzdeki ağ portlarını, hızlarını ve PoE yeteneklerini yapılandırın.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[#161f30] p-3 rounded-lg border border-[#232f45]">
        {/* Port Count */}
        <div>
          <label htmlFor="port-count" className="block text-xs font-semibold text-sky-400 mb-1">
            Port sayısı <span className="text-red-400">*</span>
          </label>
          <input
            id="port-count"
            type="number"
            min={0}
            max={96}
            value={portCount}
            onChange={(e) => {
              const val = Math.max(0, Math.min(96, parseInt(e.target.value, 10) || 0));
              setPortCount(val);
              generatePorts(val, portType, portSpeed, poeEnabled, prefix, rows);
            }}
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white font-mono focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Port Type */}
        <div>
          <label htmlFor="port-type" className="block text-xs font-semibold text-sky-400 mb-1">
            Port tipi <span className="text-red-400">*</span>
          </label>
          <select
            id="port-type"
            value={portType}
            onChange={(e) => {
              const val = e.target.value as PortType;
              setPortType(val);
              generatePorts(portCount, val, portSpeed, poeEnabled, prefix, rows);
            }}
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white focus:outline-none focus:border-sky-500"
          >
            {PORT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div>
          <label htmlFor="port-speed" className="block text-xs font-medium text-gray-300 mb-1">
            Bağlantı Hızı
          </label>
          <select
            id="port-speed"
            value={portSpeed}
            onChange={(e) => {
              setPortSpeed(e.target.value);
              generatePorts(portCount, portType, e.target.value, poeEnabled, prefix, rows);
            }}
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white focus:outline-none focus:border-sky-500"
          >
            {['100M', '1G', '2.5G', '5G', '10G', '25G', '40G', '100G'].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {/* Port Presets */}
        <div className="col-span-3 flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] text-gray-400">Hızlı Adet:</span>
          {[0, 8, 12, 16, 24, 48, 96].map((cnt) => (
            <button
              key={cnt}
              type="button"
              onClick={() => {
                setPortCount(cnt);
                generatePorts(cnt, portType, portSpeed, poeEnabled, prefix, rows);
              }}
              className={`text-[10px] px-2 py-0.5 rounded transition ${
                portCount === cnt ? 'bg-sky-600 text-white font-bold' : 'bg-[#1f2937] text-gray-300 hover:bg-[#374151]'
              }`}
            >
              {cnt}P
            </button>
          ))}
        </div>

        {/* Numbering & Layout */}
        <div>
          <label htmlFor="port-prefix" className="block text-xs font-medium text-gray-300 mb-1">
            İsimlendirme Ön Eki
          </label>
          <input
            id="port-prefix"
            type="text"
            value={prefix}
            onChange={(e) => {
              setPrefix(e.target.value);
              generatePorts(portCount, portType, portSpeed, poeEnabled, e.target.value, rows);
            }}
            placeholder="Örn: Gi1/0/, Port , P"
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white font-mono focus:outline-none focus:border-sky-500"
          />
        </div>

        <div>
          <label htmlFor="row-layout" className="block text-xs font-medium text-gray-300 mb-1">
            Satır Düzeni
          </label>
          <select
            id="row-layout"
            value={rows}
            onChange={(e) => {
              const r = parseInt(e.target.value, 10) as 1 | 2;
              setRows(r);
              generatePorts(portCount, portType, portSpeed, poeEnabled, prefix, r);
            }}
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-white focus:outline-none focus:border-sky-500"
          >
            <option value={2}>2 Satır (Standart 1U Switch/Patch Panel)</option>
            <option value={1}>1 Satır (Yatay Tek Sıra)</option>
          </select>
        </div>

        <div className="flex items-end pb-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={poeEnabled}
              onChange={(e) => {
                setPoeEnabled(e.target.checked);
                generatePorts(portCount, portType, portSpeed, e.target.checked, prefix, rows);
              }}
              className="w-4 h-4 rounded text-sky-500 bg-gray-900 border-gray-700 focus:ring-sky-500"
            />
            <span className="text-xs text-amber-400 font-medium">PoE Desteği (Power over Ethernet)</span>
          </label>
        </div>
      </div>

      {/* Ports summary indicator */}
      <div className="flex items-center justify-between text-xs text-gray-400 px-1">
        <span>Oluşturulan Ön Port Sayısı: <strong className="text-white">{currentPorts.length}</strong></span>
        <button
          type="button"
          onClick={handleApplyMatrix}
          className="text-[11px] text-sky-400 hover:text-sky-300 underline"
        >
          Matrisi Yeniden Uygula
        </button>
      </div>
    </div>
  );
};
