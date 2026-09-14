// ============================================================================
// Camera & Coordinate Pipeline Interface Types
// Aligns with PROJECT.md § 4 Interface Contracts
// ============================================================================

export interface WorldCoordinate {
  x: number;
  y: number;
}

export interface ScreenCoordinate {
  x: number;
  y: number;
}

export interface ScreenBounds {
  width: number;
  height: number;
}

export interface CameraState {
  x: number;     // Pan X translation in screen pixels
  y: number;     // Pan Y translation in screen pixels
  zoom: number;  // Uniform scale factor [0.1 .. 4.0]
}

export interface CameraBounds {
  minZoom: number;   // 0.1
  maxZoom: number;   // 4.0
  minX?: number;     // Optional world boundary constraints
  maxX?: number;
  minY?: number;
  maxY?: number;
}

export interface ViewportRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

export interface KineticVelocity {
  vx: number; // px / ms
  vy: number; // px / ms
}

export interface CameraOptions {
  minZoom?: number;
  maxZoom?: number;
  friction?: number;        // Kinetic friction per 16.6ms frame (default: 0.92)
  zoomSensitivity?: number; // Exponential wheel sensitivity (default: 0.0015)
  enableInertia?: boolean;
}
