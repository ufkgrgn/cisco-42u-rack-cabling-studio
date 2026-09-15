import React from 'react';
import { DeviceCatalogItem, PortDefinition } from '../../../core/types';

interface FaceplatePreviewProps {
  device: Partial<DeviceCatalogItem>;
  viewFace: 'front' | 'rear';
  onToggleFace?: () => void;
  interactive?: boolean;
}

const CATEGORY_COLORS: Record<string, string> = {
  router: '#2563eb',       // Blue
  switch: '#0284c7',       // Sky
  'fiber-switch': '#0284c7',
  server: '#059669',       // Emerald
  'patch-panel': '#7c3aed', // Purple
  patch: '#7c3aed',
  pdu: '#d97706',          // Amber
  organizer: '#475569',    // Slate
  blank: '#334155',
  accessory: '#475569',
  custom: '#0d9488'        // Teal
};

export const FaceplatePreview: React.FC<FaceplatePreviewProps> = ({
  device,
  viewFace,
  onToggleFace,
  interactive = true
}) => {
  const u = Math.max(1, Math.min(60, device.u || 1));
  const chassisHeight = u * 32;
  const totalWidth = 528; // 24px left ear + 480px chassis + 24px right ear
  const earWidth = 24;
  const chassisWidth = 480;

  const categoryColor = CATEGORY_COLORS[device.category || 'custom'] || '#0d9488';
  const ports = (viewFace === 'front' ? device.ports : device.rearPorts) || [];

  return (
    <div className="flex flex-col items-center select-none">
      {interactive && onToggleFace && (
        <div className="flex items-center justify-between w-full mb-2 px-1">
          <span className="text-xs text-gray-400 font-mono">
            {device.manufacturer || 'Custom'} {device.name || 'Device'} ({u}U)
          </span>
          <button
            type="button"
            onClick={onToggleFace}
            className="text-[11px] px-2 py-0.5 rounded bg-[#1f2937] hover:bg-[#374151] text-sky-400 border border-sky-400/30 transition flex items-center gap-1"
          >
            <span>Görünüm:</span>
            <strong className="uppercase">{viewFace === 'front' ? 'Ön Yüz (Front)' : 'Arka Yüz (Rear)'}</strong>
            <span className="text-[10px] text-gray-400">↻ Çevir</span>
          </button>
        </div>
      )}

      {/* 19-inch EIA-310-D Chassis SVG */}
      <div className="w-full overflow-x-auto bg-[#080d1a] p-3 rounded-lg border border-[#1e293b] flex justify-center shadow-inner">
        <svg
          viewBox={`0 0 ${totalWidth} ${chassisHeight}`}
          className="max-w-full h-auto drop-shadow-md"
          style={{ maxHeight: Math.min(480, Math.max(120, chassisHeight * 2)) }}
        >
          <defs>
            {/* Metal Ear Texture */}
            <linearGradient id="earGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor="#334155" />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>

            {/* Chassis Faceplate Texture */}
            <linearGradient id="chassisGrad" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#111827" />
              <stop offset="100%" stopColor="#0b0f17" />
            </linearGradient>

            {/* Screw Hole Gradient */}
            <radialGradient id="screwGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#94a3b8" />
              <stop offset="70%" stopColor="#475569" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
          </defs>

          {/* Left Rack Ear (24px) */}
          <rect x={0} y={0} width={earWidth} height={chassisHeight} fill="url(#earGrad)" rx={2} stroke="#475569" strokeWidth={0.75} />
          {/* Left Screws (top & bottom per U) */}
          {Array.from({ length: u }).map((_, i) => (
            <React.Fragment key={`screw-l-${i}`}>
              <circle cx={12} cy={i * 32 + 8} r={3} fill="url(#screwGrad)" stroke="#0f172a" strokeWidth={0.5} />
              <circle cx={12} cy={i * 32 + 24} r={3} fill="url(#screwGrad)" stroke="#0f172a" strokeWidth={0.5} />
            </React.Fragment>
          ))}

          {/* Main 19" Chassis Faceplate (480px) */}
          <rect
            x={earWidth}
            y={0}
            width={chassisWidth}
            height={chassisHeight}
            fill="url(#chassisGrad)"
            stroke="#334155"
            strokeWidth={1}
            rx={1}
          />

          {/* Category Color Accent Strip (4px on left edge of chassis) */}
          <rect
            x={earWidth}
            y={0}
            width={4}
            height={chassisHeight}
            fill={categoryColor}
          />

          {/* Right Rack Ear (24px) */}
          <rect
            x={earWidth + chassisWidth}
            y={0}
            width={earWidth}
            height={chassisHeight}
            fill="url(#earGrad)"
            rx={2}
            stroke="#475569"
            strokeWidth={0.75}
          />
          {/* Right Screws */}
          {Array.from({ length: u }).map((_, i) => (
            <React.Fragment key={`screw-r-${i}`}>
              <circle cx={earWidth + chassisWidth + 12} cy={i * 32 + 8} r={3} fill="url(#screwGrad)" stroke="#0f172a" strokeWidth={0.5} />
              <circle cx={earWidth + chassisWidth + 12} cy={i * 32 + 24} r={3} fill="url(#screwGrad)" stroke="#0f172a" strokeWidth={0.5} />
            </React.Fragment>
          ))}

          {/* Model Identification Text */}
          <text
            x={earWidth + 12}
            y={Math.min(18, chassisHeight / 2 + 4)}
            fill="#94a3b8"
            fontSize={9}
            fontWeight="bold"
            fontFamily="ui-monospace, monospace"
          >
            {device.modelTag || device.name || 'CUSTOM HARDWARE'}
          </text>

          {/* Ports / Connectors Grid */}
          {ports.map((port: PortDefinition, idx: number) => {
            let px = earWidth + 120 + (idx % 24) * 14;
            let py = 6 + Math.floor(idx / 24) * 14;

            if (port.xPct !== undefined && port.yPct !== undefined) {
              px = earWidth + port.xPct * chassisWidth;
              py = port.yPct * chassisHeight;
            }

            const pType = port.type || 'rj45';
            const isFiber = ['sfp', 'sfp+', 'sfp28', 'qsfp+', 'qsfp28', 'lc', 'sc'].includes(pType);
            const isPower = ['c13', 'c14', 'c19', 'c20'].includes(pType);

            return (
              <g key={port.id || `port-${idx}`} transform={`translate(${px - 5}, ${py - 5})`}>
                <title>{`${port.name} (${pType.toUpperCase()})${port.poe ? ' [PoE]' : ''}`}</title>
                {isPower ? (
                  // Power Inlet / Outlet Hexagon/Trapezoid shape
                  <path
                    d="M 1 3 L 9 3 L 10 7 L 8 11 L 2 11 L 0 7 Z"
                    fill="#1e293b"
                    stroke="#f59e0b"
                    strokeWidth={0.75}
                  />
                ) : isFiber ? (
                  // SFP / Optical Cage
                  <rect
                    x={0}
                    y={0}
                    width={10}
                    height={10}
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth={0.75}
                    rx={1}
                  />
                ) : (
                  // RJ45 Copper Jack with LED
                  <>
                    <rect
                      x={0}
                      y={0}
                      width={10}
                      height={9}
                      fill="#0f172a"
                      stroke="#64748b"
                      strokeWidth={0.75}
                      rx={1}
                    />
                    {/* Tiny link LED */}
                    <circle cx={port.poe ? 8 : 2} cy={2} r={1} fill={port.poe ? '#eab308' : '#22c55e'} />
                  </>
                )}
              </g>
            );
          })}

          {/* Rear Face PSU Details if on rear */}
          {viewFace === 'rear' && ports.length === 0 && (
            <g transform={`translate(${earWidth + 360}, ${chassisHeight / 2 - 8})`}>
              <rect x={0} y={0} width={22} height={16} fill="#1e293b" stroke="#f59e0b" strokeWidth={1} rx={2} />
              <text x={3} y={11} fill="#fbbf24" fontSize={7} fontWeight="bold">AC IN</text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
};
