import React, { useEffect, useRef, useState } from 'react';
import { PixiCanvas } from '../../engine/canvas/PixiCanvas';
import { engineBridge } from '../../engine/bridge/EngineBridge';
import { EngineStatus, SupportedRendererType } from '../../engine/canvas/types';
import { Loader2, AlertCircle, ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

export const Viewport: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [status, setStatus] = useState<EngineStatus>('initializing');
  const [rendererType, setRendererType] = useState<SupportedRendererType>('webgl');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const zoomBadgeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let isCancelled = false;
    let engine: PixiCanvas | null = null;

    const initEngine = async () => {
      if (!canvasRef.current || !containerRef.current) return;

      try {
        setStatus('initializing');
        engine = new PixiCanvas({
          canvas: canvasRef.current,
          container: containerRef.current,
          preference: 'webgpu',
          backgroundColor: 0x070a10,
        });

        await engine.init();

        if (isCancelled) {
          engine.destroy();
          return;
        }

        setStatus('ready');
      } catch (err: any) {
        if (isCancelled) return;
        console.error('[Viewport] Graphics engine failed to initialize:', err);
        setErrorMessage(err?.message || 'WebGL / WebGPU context creation failed.');
        setStatus('error');
      }
    };

    initEngine();

    // Listen to engine ready event for active renderer badge
    const unsubReady = engineBridge.on('engine:ready', ({ renderer }) => {
      if (!isCancelled) setRendererType(renderer);
    });

    // Listen to camera viewport updates for HUD display (Direct DOM mutation: zero React re-render overhead)
    const unsubViewport = engineBridge.on('viewport:change', ({ zoom }) => {
      if (zoomBadgeRef.current) {
        zoomBadgeRef.current.textContent = `${Math.round(zoom * 100)}%`;
      }
    });

    return () => {
      isCancelled = true;
      unsubReady();
      unsubViewport();
      if (engine) {
        engine.destroy();
        engine = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex-1 relative w-full h-full overflow-hidden bg-[#070a10] select-none"
    >
      {/* React 19 Owned Canvas Node */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full block touch-none"
      />

      {/* Initializing Spinner Overlay */}
      {status === 'initializing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/80 backdrop-blur-xs z-10 pointer-events-none">
          <div className="flex flex-col items-center gap-2 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin text-[#38bdf8]" />
            <span className="text-xs font-mono">Initializing GPU Viewport...</span>
          </div>
        </div>
      )}

      {/* Context Error Overlay */}
      {status === 'error' && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#070a10]/95 z-20 p-6">
          <div className="max-w-md bg-[#161f2f] border border-rose-500/50 rounded-lg p-5 text-center shadow-2xl">
            <AlertCircle className="w-8 h-8 text-rose-400 mx-auto mb-2" />
            <h3 className="text-sm font-semibold text-white">Renderer Initialization Failed</h3>
            <p className="text-xs text-gray-300 mt-2 mb-4 leading-relaxed font-mono">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-1.5 bg-[#049fd9] hover:bg-[#0385b5] text-white text-xs rounded font-medium transition cursor-pointer"
            >
              Reload Studio
            </button>
          </div>
        </div>
      )}

      {/* Floating Touch Controls HUD (Optimized 44x44px touch targets for tablets) */}
      {status === 'ready' && (
        <div className="absolute bottom-11 right-3 flex flex-col gap-1.5 z-10 select-none">
          <div className="flex flex-col bg-[#111827]/90 backdrop-blur-md rounded-lg border border-[#374151]/80 shadow-xl overflow-hidden p-0.5 gap-0.5">
            <button
              onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = rect ? rect.width / 2 : 500;
                const cy = rect ? rect.height / 2 : 400;
                engineBridge.emit('camera:zoom', { factor: 1.25, screenAnchorX: cx, screenAnchorY: cy });
              }}
              title="Zoom In"
              aria-label="Zoom In"
              className="w-11 h-11 flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#1f293d] active:bg-[#049fd9] active:text-white rounded transition-colors cursor-pointer"
            >
              <ZoomIn className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = rect ? rect.width / 2 : 500;
                const cy = rect ? rect.height / 2 : 400;
                engineBridge.emit('camera:zoom', { factor: 0.8, screenAnchorX: cx, screenAnchorY: cy });
              }}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="w-11 h-11 flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#1f293d] active:bg-[#049fd9] active:text-white rounded transition-colors cursor-pointer"
            >
              <ZoomOut className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                engineBridge.emit('camera:fit-all', undefined);
              }}
              title="Fit to Screen"
              aria-label="Fit to Screen"
              className="w-11 h-11 flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#1f293d] active:bg-[#049fd9] active:text-white rounded transition-colors cursor-pointer"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                const rect = containerRef.current?.getBoundingClientRect();
                const cx = rect ? rect.width / 2 : 500;
                const cy = rect ? rect.height / 2 : 400;
                engineBridge.emit('camera:zoom-to', { factor: 1.0, screenX: cx, screenY: cy });
              }}
              title="Reset Zoom (100%)"
              aria-label="Reset Zoom"
              className="w-11 h-11 flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#1f293d] active:bg-[#049fd9] active:text-white rounded transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Floating HUD (Non-interactive overlay with zero React canvas overhead) */}
      {status === 'ready' && (
        <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none z-10 font-mono text-[10px]">
          <span className="px-2 py-0.5 rounded bg-[#111827]/80 text-gray-400 border border-[#374151]">
            {rendererType.toUpperCase()}
          </span>
          <span ref={zoomBadgeRef} className="px-2 py-0.5 rounded bg-[#111827]/80 text-[#38bdf8] border border-[#374151]">
            100%
          </span>
        </div>
      )}
    </div>
  );
};
