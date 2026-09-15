import React from 'react';
import { DeviceCatalogItem, DeviceCategory } from '../../../core/types';

interface WizardStepGeneralProps {
  device: Partial<DeviceCatalogItem>;
  onChange: (updates: Partial<DeviceCatalogItem>) => void;
}

const MANUFACTURERS = ['Cisco', 'Dell', 'HPE', 'Juniper', 'Arista', 'Fortinet', 'Estap', 'Generic', 'Custom'];

const CATEGORIES: { value: DeviceCategory; label: string }[] = [
  { value: 'switch', label: 'Network Switch (Ağ Anahtarı)' },
  { value: 'router', label: 'Router (Yönlendirici)' },
  { value: 'server', label: 'Rack Server (Sunucu)' },
  { value: 'patch-panel', label: 'Patch Panel / ODF (Sonlandırma)' },
  { value: 'pdu', label: 'Power Distribution Unit / ATS (PDU)' },
  { value: 'organizer', label: 'Cable Organizer (Kablo Düzenleyici)' },
  { value: 'accessory', label: 'Rack Accessory (Aksesuar)' },
  { value: 'blank', label: 'Blanking Panel (Kör Panel)' },
  { value: 'compact', label: 'Compact Hardware (Kompakt Cihaz)' }
];

export const WizardStepGeneral: React.FC<WizardStepGeneralProps> = ({ device, onChange }) => {
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const id = device.id && !device.id.startsWith('cust-') ? device.id : `cust-${slug || 'device'}`;
    onChange({ name, id });
  };

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700/60 pb-2">
        <h3 className="text-sm font-semibold text-white">Adım 1: Genel Bilgiler & Kimlik</h3>
        <p className="text-xs text-gray-400">Cihazın model adını, üreticisini ve kategorisini belirleyin.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Model Name */}
        <div className="col-span-2">
          <label htmlFor="model-name" className="block text-xs font-medium text-gray-300 mb-1">
            Model adı <span className="text-red-400">*</span>
          </label>
          <input
            id="model-name"
            type="text"
            maxLength={100}
            required
            value={device.name || ''}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Örn: Cisco Catalyst 9300-24T veya Özel Sunucu"
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500"
          />
          <div className="flex justify-between text-[10px] text-gray-500 mt-0.5">
            <span>Benzersiz donanım adı</span>
            <span>{(device.name || '').length}/100</span>
          </div>
        </div>

        {/* Unique ID */}
        <div>
          <label htmlFor="device-id" className="block text-xs font-medium text-gray-300 mb-1">
            Katalog ID (Benzersiz Anahtar) <span className="text-red-400">*</span>
          </label>
          <input
            id="device-id"
            type="text"
            pattern="^[a-zA-Z0-9_-]+$"
            value={device.id || ''}
            onChange={(e) => onChange({ id: e.target.value.replace(/[^a-zA-Z0-9_-]/g, '') })}
            placeholder="cust-cisco-switch"
            className="w-full px-3 py-1.5 text-xs bg-[#111827] border border-[#374151] rounded text-sky-400 font-mono focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Manufacturer */}
        <div>
          <label htmlFor="manufacturer" className="block text-xs font-medium text-gray-300 mb-1">
            Üretici Firma
          </label>
          <select
            id="manufacturer"
            value={device.manufacturer || 'Cisco'}
            onChange={(e) => onChange({ manufacturer: e.target.value })}
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-gray-100 focus:outline-none focus:border-sky-500"
          >
            {MANUFACTURERS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Category */}
        <div>
          <label htmlFor="category" className="block text-xs font-medium text-gray-300 mb-1">
            Kategori
          </label>
          <select
            id="category"
            value={device.category || 'switch'}
            onChange={(e) => onChange({ category: e.target.value as DeviceCategory })}
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-gray-100 focus:outline-none focus:border-sky-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        {/* Model Tag */}
        <div>
          <label htmlFor="model-tag" className="block text-xs font-medium text-gray-300 mb-1">
            Model Etiketi / Kodu (Facia Tag)
          </label>
          <input
            id="model-tag"
            type="text"
            maxLength={40}
            value={device.modelTag || ''}
            onChange={(e) => onChange({ modelTag: e.target.value })}
            placeholder="Örn: WS-C2960X-24PS-L"
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500"
          />
        </div>

        {/* Description */}
        <div className="col-span-2">
          <label htmlFor="description" className="block text-xs font-medium text-gray-300 mb-1">
            Teknik Açıklama
          </label>
          <textarea
            id="description"
            rows={3}
            maxLength={1000}
            value={device.desc || ''}
            onChange={(e) => onChange({ desc: e.target.value })}
            placeholder="Cihaz özellikleri, montaj notları ve kablolama yönergeleri..."
            className="w-full px-3 py-1.5 text-xs bg-[#1f2937] border border-[#374151] rounded text-gray-100 placeholder-gray-500 focus:outline-none focus:border-sky-500 resize-none"
          />
          <div className="text-right text-[10px] text-gray-500">
            {(device.desc || '').length}/1000
          </div>
        </div>
      </div>
    </div>
  );
};
