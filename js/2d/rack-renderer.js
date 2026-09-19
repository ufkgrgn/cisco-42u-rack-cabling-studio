/**
 * Cisco Enterprise Rack & Cabling Studio - Rack Renderer Module (Barrel Aggregator)
 * 
 * Modularized Architecture:
 * - js/2d/rack-structure-renderer.js : Rack rails, slots (1-60U), multi-rack layout & telemetry badges
 * - js/2d/device-actions.js          : Mount, remove, clear cables/devices, delete modals & toasts
 * - js/2d/faceplate-renderer.js      : Hardware faceplates (Cisco switches, routers, panels, PDUs)
 * - js/2d/port-interaction-handler.js: Port hovering, role cycling, click handling, and cable completion
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  // Preserve public API namespace references for backward compatibility
  RS.renderRackRailsAndSlots = RS.renderRackRailsAndSlots || function (...args) {
    return RS.renderRackRailsAndSlots ? RS.renderRackRailsAndSlots(...args) : undefined;
  };
  RS.refreshVisibleRackContent = RS.refreshVisibleRackContent || function (...args) {
    return RS.refreshVisibleRackContent ? RS.refreshVisibleRackContent(...args) : undefined;
  };
  RS.mountDeviceAt = RS.mountDeviceAt || function (...args) {
    return RS.mountDeviceAt ? RS.mountDeviceAt(...args) : undefined;
  };
  RS.removeDevice = RS.removeDevice || function (...args) {
    return RS.removeDevice ? RS.removeDevice(...args) : undefined;
  };
  RS.clearRackCables = RS.clearRackCables || function (...args) {
    return RS.clearRackCables ? RS.clearRackCables(...args) : undefined;
  };
  RS.clearRackDevices = RS.clearRackDevices || function (...args) {
    return RS.clearRackDevices ? RS.clearRackDevices(...args) : undefined;
  };
  RS.clearDeviceCables = RS.clearDeviceCables || function (...args) {
    return RS.clearDeviceCables ? RS.clearDeviceCables(...args) : undefined;
  };
  RS.updateDeviceMetadata = RS.updateDeviceMetadata || function (...args) {
    return RS.updateDeviceMetadata ? RS.updateDeviceMetadata(...args) : undefined;
  };
  RS.renderMountedDevices = RS.renderMountedDevices || function (...args) {
    return RS.renderMountedDevices ? RS.renderMountedDevices(...args) : undefined;
  };
  RS.renderRouterFaceplate = RS.renderRouterFaceplate || function (...args) {
    return RS.renderRouterFaceplate ? RS.renderRouterFaceplate(...args) : undefined;
  };
  RS.renderOrganizerFaceplate = RS.renderOrganizerFaceplate || function (...args) {
    return RS.renderOrganizerFaceplate ? RS.renderOrganizerFaceplate(...args) : undefined;
  };
  RS.renderBlankFaceplate = RS.renderBlankFaceplate || function (...args) {
    return RS.renderBlankFaceplate ? RS.renderBlankFaceplate(...args) : undefined;
  };
  RS.renderSwitchOrPatchFaceplate = RS.renderSwitchOrPatchFaceplate || function (...args) {
    return RS.renderSwitchOrPatchFaceplate ? RS.renderSwitchOrPatchFaceplate(...args) : undefined;
  };
  RS.renderPortIcon = RS.renderPortIcon || function (...args) {
    return RS.renderPortIcon ? RS.renderPortIcon(...args) : undefined;
  };
  RS.bindPortInteractions = RS.bindPortInteractions || function (...args) {
    return RS.bindPortInteractions ? RS.bindPortInteractions(...args) : undefined;
  };
  RS.handlePortHover = RS.handlePortHover || function (...args) {
    return RS.handlePortHover ? RS.handlePortHover(...args) : undefined;
  };
  RS.handlePortLeave = RS.handlePortLeave || function (...args) {
    return RS.handlePortLeave ? RS.handlePortLeave(...args) : undefined;
  };
  RS.handlePortClick = RS.handlePortClick || function (...args) {
    return RS.handlePortClick ? RS.handlePortClick(...args) : undefined;
  };
  RS.findRoutingOrganizers = RS.findRoutingOrganizers || function (...args) {
    return RS.findRoutingOrganizers ? RS.findRoutingOrganizers(...args) : undefined;
  };
  RS.calculateCableLengthMeters = RS.calculateCableLengthMeters || function (...args) {
    return RS.calculateCableLengthMeters ? RS.calculateCableLengthMeters(...args) : undefined;
  };
})();
