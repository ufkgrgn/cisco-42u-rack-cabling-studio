export type SupportedRendererType = 'webgpu' | 'webgl';

export type EngineStatus = 'uninitialized' | 'initializing' | 'ready' | 'destroyed' | 'error';

export interface CanvasEngineOptions {
  canvas: HTMLCanvasElement;
  container: HTMLElement;
  preference?: SupportedRendererType;
  backgroundColor?: number;
  antialias?: boolean;
  resolution?: number;
  autoDensity?: boolean;
  onReady?: (info: { renderer: SupportedRendererType; fps: number }) => void;
  onError?: (error: Error) => void;
}

export interface EngineInitResult {
  renderer: SupportedRendererType;
  dpr: number;
  width: number;
  height: number;
}
