// --- APPLICATION STATE (MULTI-RACK / MULTI-CABINET) ---
export const STATE = {
  racks: [
    {
      id: 'rack-1',
      name: 'MDF - Ana Omurga & Dağıtım Kabini',
      units: Array(43).fill(null),
      devices: []
    }
  ],
  activeRackId: 'rack-1',
  cables: [],
  cableCounter: 0,
  rackCounter: 1,
  selectedLibraryItem: null,
  selectedCableColor: '#2563eb',
  cableRoutingMode: 'structured', // 'structured' (side channel) or 'direct' (tight patch)
  pendingConnection: null,
  highlightedCableId: null
};

// Helper: Get active rack object
export function getActiveRack() {
  let r = STATE.racks.find(rack => rack.id === STATE.activeRackId);
  if (!r && STATE.racks.length > 0) {
    r = STATE.racks[0];
    STATE.activeRackId = r.id;
  }
  return r;
}

// --- PAN & ZOOM CANVAS STATE ---
export const ZOOM_STATE = {
  scale: 1.0,
  panX: 0,
  panY: 0,
  minScale: 0.35,
  maxScale: 3.5,
  isPanning: false,
  startX: 0,
  startY: 0,
  hasMoved: false,
  isFit: true
};

// --- DOM REFERENCES ---
export const dom = {
  railLeft: null,
  railRight: null,
  rackSpace: null,
  rackContainer: null,
  viewportCanvas: null,
  rackStage: null,
  cablesSvg: null,
  cablesGroup: null,
  connectorsGroup: null,
  dringOverlayGroup: null,
  scheduleTbody: null,
  cableCountLabel: null,
  connectionStatusHint: null,
  inspectorInfo: null,
  tooltip: null,
  statusSelectionText: null,
  fileImport: null,
  btnExportVisio: null,
  btnExportJson: null,
  btnImportJson: null,
  btnPresetMdf: null,
  btnPresetIdf: null,
  btnPresetSite: null,
  btnClearAll: null,
  btnClearCables: null,
  btnZoomIn: null,
  btnZoomOut: null,
  btnZoomFit: null,
  btnZoomActual: null,
  zoomBadge: null,
  navJumpTop: null,
  navJumpMid: null,
  navJumpBot: null,
  btnRouteStructured: null,
  btnRouteDirect: null,
  btnTidyCables: null,
  rackTabsList: null,
  btnAddRack: null,
  btnRenameRack: null
};

export function initDomReferences() {
  dom.railLeft = document.getElementById('rail-left');
  dom.railRight = document.getElementById('rail-right');
  dom.rackSpace = document.getElementById('rack-space');
  dom.rackContainer = document.getElementById('rack-container');
  dom.viewportCanvas = document.getElementById('viewport-canvas');
  dom.rackStage = document.getElementById('rack-stage');
  dom.cablesSvg = document.getElementById('cables-svg');
  dom.cablesGroup = document.getElementById('cables-group');
  dom.connectorsGroup = document.getElementById('connectors-group');
  dom.dringOverlayGroup = document.getElementById('dring-overlay-group');
  dom.scheduleTbody = document.getElementById('schedule-tbody');
  dom.cableCountLabel = document.getElementById('cable-count-label');
  dom.connectionStatusHint = document.getElementById('connection-status-hint');
  dom.inspectorInfo = document.getElementById('inspector-info');
  dom.tooltip = document.getElementById('tooltip');
  dom.statusSelectionText = document.getElementById('status-selection-text');
  dom.fileImport = document.getElementById('file-import');
  dom.btnExportVisio = document.getElementById('btn-export-visio');
  dom.btnExportJson = document.getElementById('btn-export-json');
  dom.btnImportJson = document.getElementById('btn-import-json');
  dom.btnPresetMdf = document.getElementById('btn-preset-mdf');
  dom.btnPresetIdf = document.getElementById('btn-preset-idf');
  dom.btnPresetSite = document.getElementById('btn-preset-site');
  dom.btnClearAll = document.getElementById('btn-clear-all');
  dom.btnClearCables = document.getElementById('btn-clear-cables');
  dom.btnZoomIn = document.getElementById('btn-zoom-in');
  dom.btnZoomOut = document.getElementById('btn-zoom-out');
  dom.btnZoomFit = document.getElementById('btn-zoom-fit');
  dom.btnZoomActual = document.getElementById('btn-zoom-actual');
  dom.zoomBadge = document.getElementById('zoom-badge');
  dom.navJumpTop = document.getElementById('nav-jump-top');
  dom.navJumpMid = document.getElementById('nav-jump-mid');
  dom.navJumpBot = document.getElementById('nav-jump-bot');
  dom.btnRouteStructured = document.getElementById('btn-route-structured');
  dom.btnRouteDirect = document.getElementById('btn-route-direct');
  dom.btnTidyCables = document.getElementById('btn-tidy-cables');
  dom.rackTabsList = document.getElementById('rack-tabs-list');
  dom.btnAddRack = document.getElementById('btn-add-rack');
  dom.btnRenameRack = document.getElementById('btn-rename-rack');
}
