import React, { useState } from 'react';
import { DeviceCatalogItem } from '../../../core/persistence/schemas';
import { FaceplatePreview } from './FaceplatePreview';
import { exportCustomDeviceToJson, exportCustomDeviceToYaml } from '../../../core/catalog/customDeviceIO';
import { CheckCircle2, AlertCircle, Download } from 'lucide-react';

interface WizardStepPreviewProps {
  device: Partial<DeviceCatalogItem>;
  validationErrors: string[];
}

export const WizardStepPreview: React.FC<WizardStepPreviewProps> = ({ device, validationErrors }) => {
  const [viewFace, setViewFace] = useState<'front' | 'rear'>('front');

  const getNormalizedDevice = (): DeviceCatalogItem => ({
    id: device.id || 'custom-device',
    name: device.name || 'Custom Device',
    category: device.category || 'custom',
    u: device.u || 1,
    manufacturer: device.manufacturer || 'Custom',
    depthMm: device.depthMm ?? 400,
    powerWatts: device.powerWatts ?? 0,
    ports: device.ports || [],
    rearPorts: device.rearPorts || [],
    isCustom: true,
    weightKg: device.weightKg,
    dualPsu: device.dualPsu,
    heatBtu: device.heatBtu,
    heatBtuPerHour: device.heatBtuPerHour,
    modelTag: device.modelTag,
    desc: device.desc
  });

  const handleDownloadJson = () => {
    if (!device.name || !device.id) return;
    const json = exportCustomDeviceToJson(getNormalizedDevice());
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadYaml = () => {
    if (!device.name || !device.id) return;
    const yaml = exportCustomDeviceToYaml(getNormalizedDevice());
    const blob = new Blob([yaml], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.id}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isValid = validationErrors.length === 0;

  return (
    <div className="space-y-4">
      <div className="border-b border-gray-700/60 pb-2">
        <h3 className="text-sm font-semibold text-white">Adım 6: Önizleme, Doğrulama & Dışa Aktarma</h3>
        <p className="text-xs text-gray-400">Oluşturulan donanımın 19" şasi önizlemesini inceleyin ve doğrulayın.</p>
      </div>

      {/* Validation Checklist Badge */}
      <div className={`p-3 rounded-lg border ${
        isValid
          ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300'
          : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
      }`}>
        <div className="flex items-center gap-2 font-semibold text-xs">
          {isValid ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Donanım Şeması Geçerli ve EIA-310-D Standartlarına Uygun</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-rose-400" />
              <span>Donanım Şemasında Düzeltilmesi Gereken Hatalar Var ({validationErrors.length})</span>
            </>
          )}
        </div>
        {!isValid && (
          <ul className="mt-2 text-[11px] list-disc list-inside space-y-0.5 text-rose-200">
            {validationErrors.map((err, i) => (
              <li key={i}>{err}</li>
            ))}
          </ul>
        )}
      </div>

      {/* Faceplate Preview */}
      <FaceplatePreview
        device={device}
        viewFace={viewFace}
        onToggleFace={() => setViewFace(viewFace === 'front' ? 'rear' : 'front')}
      />

      {/* Specs Overview Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        <div className="bg-[#161f30] p-2 rounded border border-[#232f45]">
          <span className="text-gray-400 block text-[10px]">Model & ID</span>
          <strong className="text-white truncate block">{device.name}</strong>
          <span className="text-[10px] text-sky-400 font-mono">{device.id}</span>
        </div>

        <div className="bg-[#161f30] p-2 rounded border border-[#232f45]">
          <span className="text-gray-400 block text-[10px]">Fiziksel Boyut</span>
          <strong className="text-white block">{device.u}U ({(Number(device.u || 1) * 44.45).toFixed(1)} mm)</strong>
          <span className="text-[10px] text-gray-400">{device.depthMm || 400}mm D • {device.weightKg || 5}kg</span>
        </div>

        <div className="bg-[#161f30] p-2 rounded border border-[#232f45]">
          <span className="text-gray-400 block text-[10px]">Güç & Isı Yükü</span>
          <strong className="text-white block">{device.powerWatts || 0} Watts {device.dualPsu ? '(Dual PSU)' : ''}</strong>
          <span className="text-[10px] text-amber-400 font-mono">{device.heatBtu || 0} BTU/hr</span>
        </div>

        <div className="bg-[#161f30] p-2 rounded border border-[#232f45]">
          <span className="text-gray-400 block text-[10px]">Port Sayısı</span>
          <strong className="text-white block">Ön: {(device.ports || []).length} • Arka: {(device.rearPorts || []).length}</strong>
          <span className="text-[10px] text-sky-400 capitalize">{device.category}</span>
        </div>
      </div>

      {/* Export Actions */}
      <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-700/60">
        <button
          type="button"
          onClick={handleDownloadJson}
          className="px-3 py-1.5 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 text-xs border border-gray-600 transition flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span>JSON İndir</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadYaml}
          className="px-3 py-1.5 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 text-xs border border-gray-600 transition flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5 text-amber-400" />
          <span>YAML İndir</span>
        </button>
      </div>
    </div>
  );
};
