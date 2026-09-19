/**
 * Cisco Enterprise Rack & Cabling Studio - Cabling Engine (Barrel Aggregator)
 * 
 * Modularized Architecture:
 * - js/2d/cable-routing.js      : Duct side resolution, D-ring loops, horizontal organizers, pathway math, metrology
 * - js/2d/cables-svg-renderer.js: Cable SVG rendering, bezier arcs, connector boots/pins, cable highlights
 * - js/2d/cable-hud.js          : Floating Quick HUD, cable right-click context menu, delete shortcuts
 * - js/2d/switch-autofill.js    : Automated sequential domino patching and switch bulk colorization
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  // Preserve public API namespace references for backward compatibility
  RS.renderAllCables = RS.renderAllCables || function (...args) {
    return RS.renderAllCables ? RS.renderAllCables(...args) : undefined;
  };
  RS.cancelPendingConnection = RS.cancelPendingConnection || function (...args) {
    return RS.cancelPendingConnection ? RS.cancelPendingConnection(...args) : undefined;
  };
  RS.getNextCableId = RS.getNextCableId || function (...args) {
    return RS.getNextCableId ? RS.getNextCableId(...args) : undefined;
  };
  RS.getCableEndpointInfo = RS.getCableEndpointInfo || function (...args) {
    return RS.getCableEndpointInfo ? RS.getCableEndpointInfo(...args) : undefined;
  };
  RS.getCableLabel = RS.getCableLabel || function (...args) {
    return RS.getCableLabel ? RS.getCableLabel(...args) : undefined;
  };
  RS.renameCable2D = RS.renameCable2D || function (...args) {
    return RS.renameCable2D ? RS.renameCable2D(...args) : undefined;
  };
  RS.getEndpointOrganizerChannelYs = RS.getEndpointOrganizerChannelYs || function (...args) {
    return RS.getEndpointOrganizerChannelYs ? RS.getEndpointOrganizerChannelYs(...args) : undefined;
  };
  RS.getActiveOrganizers = RS.getActiveOrganizers || function (...args) {
    return RS.getActiveOrganizers ? RS.getActiveOrganizers(...args) : undefined;
  };
  RS.findDeviceOrganizer = RS.findDeviceOrganizer || function (...args) {
    return RS.findDeviceOrganizer ? RS.findDeviceOrganizer(...args) : undefined;
  };
  RS.getDRingBracketCoords = RS.getDRingBracketCoords || function (...args) {
    return RS.getDRingBracketCoords ? RS.getDRingBracketCoords(...args) : undefined;
  };
  RS.renderDRingOverlays = RS.renderDRingOverlays || function (...args) {
    return RS.renderDRingOverlays ? RS.renderDRingOverlays(...args) : undefined;
  };
  RS.renderOrganizerOverlays = RS.renderOrganizerOverlays || function (...args) {
    return RS.renderOrganizerOverlays ? RS.renderOrganizerOverlays(...args) : undefined;
  };
  RS.buildStructuredCablePath = RS.buildStructuredCablePath || function (...args) {
    return RS.buildStructuredCablePath ? RS.buildStructuredCablePath(...args) : undefined;
  };
  RS.hideCableQuickHud = RS.hideCableQuickHud || function (...args) {
    return RS.hideCableQuickHud ? RS.hideCableQuickHud(...args) : undefined;
  };
  RS.hideCableContextMenu = RS.hideCableContextMenu || function (...args) {
    return RS.hideCableContextMenu ? RS.hideCableContextMenu(...args) : undefined;
  };
  RS.disconnectCable = RS.disconnectCable || function (...args) {
    return RS.disconnectCable ? RS.disconnectCable(...args) : undefined;
  };
  RS.showCableQuickHud = RS.showCableQuickHud || function (...args) {
    return RS.showCableQuickHud ? RS.showCableQuickHud(...args) : undefined;
  };
  RS.showCableContextMenu = RS.showCableContextMenu || function (...args) {
    return RS.showCableContextMenu ? RS.showCableContextMenu(...args) : undefined;
  };
  RS.highlightCable = RS.highlightCable || function (...args) {
    return RS.highlightCable ? RS.highlightCable(...args) : undefined;
  };
  RS.setCableHover = RS.setCableHover || function (...args) {
    return RS.setCableHover ? RS.setCableHover(...args) : undefined;
  };
  RS.setDeviceCablesHover = RS.setDeviceCablesHover || function (...args) {
    return RS.setDeviceCablesHover ? RS.setDeviceCablesHover(...args) : undefined;
  };
  RS.toggleCableDuctSide = RS.toggleCableDuctSide || function (...args) {
    return RS.toggleCableDuctSide ? RS.toggleCableDuctSide(...args) : undefined;
  };
  RS.resolveCableDuctSide = RS.resolveCableDuctSide || function (...args) {
    return RS.resolveCableDuctSide ? RS.resolveCableDuctSide(...args) : undefined;
  };
  RS.addDirectCable = RS.addDirectCable || function (...args) {
    return RS.addDirectCable ? RS.addDirectCable(...args) : undefined;
  };
  RS.highlightDropSlots = RS.highlightDropSlots || function (...args) {
    return RS.highlightDropSlots ? RS.highlightDropSlots(...args) : undefined;
  };
  RS.bulkColorizeSwitchCables = RS.bulkColorizeSwitchCables || function (...args) {
    return RS.bulkColorizeSwitchCables ? RS.bulkColorizeSwitchCables(...args) : undefined;
  };
  RS.openSwitchBulkColorPopover = RS.openSwitchBulkColorPopover || function (...args) {
    return RS.openSwitchBulkColorPopover ? RS.openSwitchBulkColorPopover(...args) : undefined;
  };
  RS.openSwitchAutoFillPopover = RS.openSwitchAutoFillPopover || function (...args) {
    return RS.openSwitchAutoFillPopover ? RS.openSwitchAutoFillPopover(...args) : undefined;
  };
  RS.undoAutoPatch = RS.undoAutoPatch || function (...args) {
    return RS.undoAutoPatch ? RS.undoAutoPatch(...args) : undefined;
  };
  RS.runSequentialAutoPatch = RS.runSequentialAutoPatch || function (...args) {
    return RS.runSequentialAutoPatch ? RS.runSequentialAutoPatch(...args) : undefined;
  };
})();
