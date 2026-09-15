import React, { useState } from 'react';
import { DeviceCatalogItem } from '../../../core/types';
import { useProjectStore } from '../../../core/state/projectStore';
import { useHistoryStore } from '../../../core/state/historyStore';
import { PlaceDeviceCommand } from '../../../core/history/commands/PlaceDeviceCommand';
import { WizardStepGeneral } from './WizardStepGeneral';
import { WizardStepDimensions } from './WizardStepDimensions';
import { WizardStepPower } from './WizardStepPower';
import { WizardStepFrontPorts } from './WizardStepFrontPorts';
import { WizardStepRearPorts } from './WizardStepRearPorts';
import { WizardStepPreview } from './WizardStepPreview';
import { X, ChevronLeft, ChevronRight, Check, HardDriveDownload } from 'lucide-react';

interface CustomDeviceWizardProps {
  isOpen: boolean;
  onClose: () => void;
  initialDevice?: Partial<DeviceCatalogItem>;
}

const DEFAULT_DRAFT_DEVICE: Partial<DeviceCatalogItem> = {
  id: `cust-custom-switch-${Date.now().toString(36)}`,
  name: 'Özel 24-Port Gigabit Switch',
  category: 'switch',
  u: 1,
  manufacturer: 'Custom',
  depthMm: 400,
  weightKg: 5.5,
  powerWatts: 250,
  dualPsu: true,
  heatBtu: 853,
  heatBtuPerHour: 853,
  modelTag: 'CUST-24GE',
  desc: 'Kullanıcı tanımlı özel 1U ağ anahtarı.',
  ports: Array.from({ length: 24 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `Port ${i + 1}`,
    type: 'rj45' as const,
    speed: '1G',
    poe: true,
    row: i % 2,
    group: Math.floor(i / 8) + 1,
    xPct: Number((0.06 + (Math.floor(i / 2) / 11) * 0.88).toFixed(4)),
    yPct: i % 2 === 0 ? 0.28 : 0.72,
    facing: 'front' as const
  })),
  rearPorts: [
    { id: 'mgmt', name: 'MGMT', type: 'rj45' as const, speed: '1G', xPct: 0.12, yPct: 0.50, facing: 'rear' as const },
    { id: 'psu_1', name: 'PSU 1 (C14)', type: 'c14' as const, xPct: 0.80, yPct: 0.50, facing: 'rear' as const },
    { id: 'psu_2', name: 'PSU 2 (C14)', type: 'c14' as const, xPct: 0.90, yPct: 0.50, facing: 'rear' as const }
  ]
};

const STEPS = [
  { id: 1, title: 'Genel', desc: 'Model & Kimlik' },
  { id: 2, title: 'Boyutlar', desc: 'U Yüksekliği' },
  { id: 3, title: 'Güç & Isı', desc: 'Watts & BTU' },
  { id: 4, title: 'Ön Portlar', desc: '0-96 Port' },
  { id: 5, title: 'Arka I/O', desc: 'PSU & MGMT' },
  { id: 6, title: 'Önizleme', desc: 'Doğrulama & Kayıt' }
];

export const CustomDeviceWizard: React.FC<CustomDeviceWizardProps> = ({
  isOpen,
  onClose,
  initialDevice
}) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [draft, setDraft] = useState<Partial<DeviceCatalogItem>>({
    ...DEFAULT_DRAFT_DEVICE,
    ...(initialDevice || {})
  });

  const { project, addCustomDevice } = useProjectStore();
  const { executeCommand } = useHistoryStore();

  if (!isOpen) return null;

  const updateDraft = (updates: Partial<DeviceCatalogItem>) => {
    setDraft((prev) => ({ ...prev, ...updates }));
  };

  // Validate draft state
  const validationErrors: string[] = [];
  if (!draft.name || draft.name.trim().length === 0) {
    validationErrors.push('Cihaz model adı boş bırakılamaz.');
  }
  if (!draft.id || !/^[a-zA-Z0-9_-]+$/.test(draft.id)) {
    validationErrors.push('Katalog ID geçerli alfasayısal karakterlerden oluşmalıdır.');
  }
  if (!draft.u || draft.u < 1 || draft.u > 60) {
    validationErrors.push('U yüksekliği 1 ile 60 U arasında olmalıdır.');
  }
  if ((draft.ports || []).length > 96) {
    validationErrors.push('Ön panel port sayısı en fazla 96 olabilir.');
  }
  if ((draft.rearPorts || []).length > 96) {
    validationErrors.push('Arka panel port sayısı en fazla 96 olabilir.');
  }

  const isValid = validationErrors.length === 0;

  const buildFinalDevice = () => ({
    id: draft.id!,
    name: draft.name!,
    category: draft.category || 'custom',
    u: draft.u || 1,
    manufacturer: draft.manufacturer || 'Custom',
    depthMm: draft.depthMm ?? 400,
    powerWatts: draft.powerWatts ?? 0,
    ports: draft.ports || [],
    rearPorts: draft.rearPorts || [],
    isCustom: true,
    weightKg: draft.weightKg,
    dualPsu: draft.dualPsu,
    heatBtu: draft.heatBtu,
    heatBtuPerHour: draft.heatBtuPerHour,
    modelTag: draft.modelTag,
    desc: draft.desc
  });

  const handleSaveOnly = () => {
    if (!isValid || !draft.id || !draft.name) return;
    const finalDevice = buildFinalDevice();
    addCustomDevice(finalDevice);
    onClose();
  };

  const handleSaveAndMount = () => {
    if (!isValid || !draft.id || !draft.name) return;
    const finalDevice = buildFinalDevice();
    addCustomDevice(finalDevice);

    const activeRack = project.racks.find((r) => r.id === project.activeRackId) || project.racks[0];
    if (activeRack) {
      const uHeight = finalDevice.u;
      let targetU: number | null = null;

      // Find first collision-free slot from bottom up
      for (let u = 1; u <= activeRack.totalU - uHeight + 1; u++) {
        const endU = u + uHeight - 1;
        const collision = activeRack.devices.some((d) => {
          if (d.face !== 'front') return false;
          const dEnd = d.startU + d.uHeight - 1;
          return Math.max(u, d.startU) <= Math.min(endU, dEnd);
        });
        if (!collision) {
          targetU = u;
          break;
        }
      }

      if (targetU !== null) {
        executeCommand(
          new PlaceDeviceCommand({
            rackId: activeRack.id,
            catalogId: finalDevice.id,
            startU: targetU,
            face: 'front'
          })
        );
      }
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-[#0f172a] border border-[#334155] rounded-xl shadow-2xl w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden catalog-custom-form">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-[#334155] flex items-center justify-between bg-[#1e293b]/60">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span>Sıfır-Kod Özel Donanım Sihirbazı</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                F3.3 Wizard
              </span>
            </h2>
            <p className="text-xs text-gray-400">19" EIA-310-D standartlarında özel kabin donanımı oluşturun.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Navigation Indicator */}
        <div className="px-5 py-2.5 bg-[#0b1120] border-b border-[#1e293b] flex items-center justify-between gap-1 overflow-x-auto">
          {STEPS.map((s) => {
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setCurrentStep(s.id)}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-left transition ${
                  isCurrent
                    ? 'bg-sky-950/80 border border-sky-500 text-white'
                    : isCompleted
                    ? 'text-sky-400 hover:bg-gray-800/60'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    isCurrent
                      ? 'bg-sky-500 text-black'
                      : isCompleted
                      ? 'bg-sky-900 text-sky-200'
                      : 'bg-gray-800 text-gray-400'
                  }`}
                >
                  {isCompleted ? <Check className="w-3 h-3" /> : s.id}
                </div>
                <div className="hidden sm:block">
                  <div className="text-xs font-semibold leading-none">{s.title}</div>
                  <div className="text-[9px] text-gray-400 leading-none mt-0.5">{s.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Body Content */}
        <div className="flex-1 p-5 overflow-y-auto bg-[#0d1424]">
          {currentStep === 1 && <WizardStepGeneral device={draft} onChange={updateDraft} />}
          {currentStep === 2 && <WizardStepDimensions device={draft} onChange={updateDraft} />}
          {currentStep === 3 && <WizardStepPower device={draft} onChange={updateDraft} />}
          {currentStep === 4 && <WizardStepFrontPorts device={draft} onChange={updateDraft} />}
          {currentStep === 5 && <WizardStepRearPorts device={draft} onChange={updateDraft} />}
          {currentStep === 6 && <WizardStepPreview device={draft} validationErrors={validationErrors} />}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3 border-t border-[#334155] bg-[#0b1120] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs text-gray-400 hover:text-white transition"
          >
            İptal
          </button>

          <div className="flex items-center gap-2">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev - 1)}
                className="px-3.5 py-1.5 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 text-xs border border-gray-600 transition flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Geri</span>
              </button>
            )}

            {currentStep < 6 ? (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => prev + 1)}
                className="px-4 py-1.5 rounded bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow transition flex items-center gap-1"
              >
                <span>İleri</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  disabled={!isValid}
                  onClick={handleSaveOnly}
                  className="px-3.5 py-1.5 rounded bg-[#1f2937] hover:bg-[#374151] text-gray-200 text-xs border border-gray-600 disabled:opacity-50 transition"
                >
                  Kataloğa Kaydet
                </button>

                <button
                  type="button"
                  disabled={!isValid}
                  onClick={handleSaveAndMount}
                  className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow transition flex items-center gap-1.5 disabled:opacity-50"
                >
                  <HardDriveDownload className="w-4 h-4" />
                  <span>Kaydet ve Kabine Tak</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
