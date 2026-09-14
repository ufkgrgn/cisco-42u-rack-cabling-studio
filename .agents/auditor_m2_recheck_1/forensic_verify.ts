import { clampZoom, calculatePointerZoom, screenToWorld, worldToScreen } from '../../src/engine/camera/affine';
import { Camera } from '../../src/engine/camera/Camera';
import { LODManager } from '../../src/engine/scene/LODManager';
import { LODTier } from '../../src/engine/scene/types';
import { SceneGraph } from '../../src/engine/scene/SceneGraph';
import { DragManager } from '../../src/engine/interaction/DragManager';
import { EngineBridge } from '../../src/engine/bridge/EngineBridge';
import { RackModel, DeviceCatalogItem } from '../../src/core/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`[FAIL] ${msg}`);
    process.exit(1);
  }
  console.log(`[PASS] ${msg}`);
}

console.log('=== Independent Forensic Verification ===');

// Check 1: clampZoom mathematical integrity
assert(clampZoom(NaN) === 1.0, 'clampZoom(NaN) returns 1.0');
assert(clampZoom(Infinity) === 4.0, 'clampZoom(Infinity) clamps to 4.0');
assert(clampZoom(-Infinity) === 0.1, 'clampZoom(-Infinity) clamps to 0.1');
assert(clampZoom(0) === 0.1, 'clampZoom(0) clamps to 0.1');
assert(clampZoom(100) === 4.0, 'clampZoom(100) clamps to 4.0');
assert(clampZoom(1.5) === 1.5, 'clampZoom(1.5) returns 1.5');

// Check 2: calculatePointerZoom stationarity invariant
const current = { x: 200, y: -150, zoom: 1.0 };
const anchorX = 960;
const anchorY = 540;
const nextState = calculatePointerZoom(current, anchorX, anchorY, 2.5);
const wBefore = screenToWorld(anchorX, anchorY, current);
const wAfter = screenToWorld(anchorX, anchorY, nextState);
const err = Math.hypot(wAfter.x - wBefore.x, wAfter.y - wBefore.y);
assert(err < 1e-10, `Anchor stationarity preserved: error = ${err}`);

// Check 3: Non-finite inputs do not poison state
const poisoned = calculatePointerZoom(current, NaN, Infinity, NaN);
assert(poisoned.x === current.x && poisoned.y === current.y && poisoned.zoom === current.zoom, 'calculatePointerZoom preserves state on NaN/Infinity');

// Check 4: Camera getters and setters
const camera = new Camera();
camera.scale = 10.0;
assert(camera.zoom === 4.0 && camera.scale === 4.0, 'Camera.scale = 10.0 clamped to 4.0');
camera.scale = -5;
assert(camera.zoom === 0.1 && camera.scale === 0.1, 'Camera.scale = -5 clamped to 0.1');
camera.scale = NaN;
assert(camera.zoom === 0.1, 'Camera.scale = NaN ignored');
camera.setPan(100, 200);
camera.panBy(NaN, 50);
assert(camera.state.x === 100 && camera.state.y === 200, 'Camera.panBy(NaN, 50) ignored');
camera.zoomAt(NaN, 100, NaN);
assert(camera.state.x === 100 && camera.state.zoom === 0.1, 'Camera.zoomAt(NaN, 100, NaN) ignored');

// Check 5: LOD Hysteresis & off-screen rack sync
const lod = new LODManager();
assert(lod.currentTier === LODTier.STANDARD, 'Initial LOD is STANDARD');
const { changed: ch1, tier: t1 } = lod.evaluateScale(0.30);
assert(ch1 && t1 === LODTier.OVERVIEW, 'Scale 0.30 transitions to OVERVIEW');
// In deadband [0.33, 0.35], state remains OVERVIEW
const { changed: ch2, tier: t2 } = lod.evaluateScale(0.34);
assert(!ch2 && t2 === LODTier.OVERVIEW, 'Deadband 0.34 prevents flickering to STANDARD');

// Check 6: SceneGraph & DragManager raycast bounds check
const scene = new SceneGraph();
const dummyRack: RackModel = {
  id: 'rack_test',
  name: 'Test Rack',
  totalU: 42,
  widthMm: 600,
  depthMm: 1000,
  maxLoadKg: 1000,
  positionX: 0,
  devices: [],
};
const dummyCatalog = new Map<string, DeviceCatalogItem>([
  ['sw1', { id: 'sw1', name: 'Switch 1', category: 'switch', u: 1, manufacturer: 'Cisco', ports: [] }],
]);
scene.syncRacks([dummyRack], dummyCatalog);
const bridge = EngineBridge.getInstance();
const dragMgr = new DragManager(scene, bridge);

// Verify initial rack state
const rackContainer = scene.rackContainers.get('rack_test')!;
assert(rackContainer.currentLOD === LODTier.STANDARD, 'RackContainer initialized at STANDARD LOD');
assert(rackContainer.badgeContainer.visible === false, 'RackContainer badgeContainer is hidden in STANDARD LOD');
assert(rackContainer.railsGraphics.visible === true, 'RackContainer railsGraphics visible in STANDARD LOD');
assert(rackContainer.uSlotsContainer.visible === true, 'RackContainer uSlotsContainer visible in STANDARD LOD');

// Raycast check: outside vertical interval [rack.y - 50, rack.y + rackHeight + 50]
assert(scene.findRackAt(100, 40, -10000, 50) === null, 'Raycast at worldY = -10000 returns null');
assert(scene.findRackAt(100, 40, 50000, 50) === null, 'Raycast at worldY = +50000 returns null');
assert(scene.findRackAt(100, 40, 500, 50) !== null, 'Raycast at worldY = 500 returns rack');

// DragManager handlePointerMove outside bounds
dragMgr.startDrag({ catalogItem: dummyCatalog.get('sw1')! });
dragMgr.handlePointerMove(100, -10000);
assert(dragMgr.ghost.isValid === false, 'DragGhost isValid is false when worldY = -10000');
assert(dragMgr.ghost.reason === 'OUTSIDE RACK BOUNDS', 'DragGhost reason is OUTSIDE RACK BOUNDS when worldY = -10000');
dragMgr.cancelDrag();

console.log('=== All 15 Independent Invariant Checks PASSED Cleanly ===');
