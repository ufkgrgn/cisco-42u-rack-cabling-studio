/**
 * Cisco Enterprise Rack & Cabling Studio - Centralized Dirty-Region Render Scheduler
 * Batches DOM & SVG updates into a single requestAnimationFrame tick to prevent layout thrashing.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  let dirtyFlags = {
    rackStructure: false,
    devices: false,
    cables: false,
    schedule: false,
    metrics: false
  };

  let rafId = null;
  let isFlushing = false;

  function flush() {
    rafId = null;
    if (isFlushing) return;
    isFlushing = true;

    try {
      const current = { ...dirtyFlags };
      dirtyFlags = {
        rackStructure: false,
        devices: false,
        cables: false,
        schedule: false,
        metrics: false
      };

      // 1. Rack rails and slots geometry (if cabinet height/structure changed)
      if (current.rackStructure) {
        if (typeof RS.renderRackRailsAndSlots === 'function') {
          RS.renderRackRailsAndSlots();
        }
        if (typeof RS.renderRackTabs === 'function') {
          RS.renderRackTabs();
        }
      }

      // 2. Mounted devices & faceplates
      if (current.devices) {
        if (typeof RS.renderMountedDevices === 'function') {
          RS.renderMountedDevices();
        }
      }

      // 3. Cables layer (rendered after device ports exist in DOM)
      if (current.cables) {
        if (typeof RS.renderAllCables === 'function') {
          RS.renderAllCables();
        }
      }

      // 4. Schedule table spreadsheet (virtualized / paginated)
      if (current.schedule) {
        if (typeof RS.renderScheduleTable === 'function') {
          RS.renderScheduleTable();
        }
      }

      // 5. Rack canopy power/BTU metrics
      if (current.metrics) {
        if (typeof RS.updateAllRackCanopies === 'function') {
          RS.updateAllRackCanopies();
        }
      }

      document.dispatchEvent(new CustomEvent('rackstudio:rendered', { bubbles: true, detail: current }));
    } finally {
      isFlushing = false;
    }
  }

  function invalidate(flags = {}) {
    if (flags.all) {
      dirtyFlags.rackStructure = true;
      dirtyFlags.devices = true;
      dirtyFlags.cables = true;
      dirtyFlags.schedule = true;
      dirtyFlags.metrics = true;
    } else {
      if (flags.rackStructure) dirtyFlags.rackStructure = true;
      if (flags.devices) dirtyFlags.devices = true;
      if (flags.cables) dirtyFlags.cables = true;
      if (flags.schedule) dirtyFlags.schedule = true;
      if (flags.metrics) dirtyFlags.metrics = true;
    }

    if (!rafId) {
      rafId = requestAnimationFrame(flush);
    }
  }

  function flushSync() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    flush();
  }

  RS.invalidate = invalidate;
  RS.flushSync = flushSync;
})();
