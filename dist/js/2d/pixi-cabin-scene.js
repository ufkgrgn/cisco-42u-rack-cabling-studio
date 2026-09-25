/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS 2D Cabin Scene & Stripe Engine
 * Renders GPU-accelerated rack cabin interior slot stripes (U1-U60), guidelines,
 * and high-performance real-time slot drop highlights during dragging.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const STATE = RS.STATE;
  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);

  const cabinScenes = new Map();
  let lastCabinSignature = null;
  let activeCabinLod = 'macro';

  function getViewportTransform() {
    const host = document.getElementById('viewport-canvas') ||
      document.getElementById('rack-container') ||
      document.getElementById('rack-stage');
    if (!host) return null;
    const rect = host.getBoundingClientRect();
    const camera = RS.ZOOM_STATE || {};
    const scale = Number(camera.scale) || 1;
    return {
      left: rect.left,
      top: rect.top,
      panX: Number(camera.panX) || 0,
      panY: Number(camera.panY) || 0,
      scale
    };
  }

  function clientToWorld(clientX, clientY, transform) {
    return {
      x: (clientX - transform.left - transform.panX) / transform.scale,
      y: (clientY - transform.top - transform.panY) / transform.scale
    };
  }

  function getOrCreateCabinScene(rackId) {
    const key = String(rackId || '__unknown__');
    let scene = cabinScenes.get(key);
    if (scene) return scene;

    const container = new window.PIXI.Container();
    container.label = `rack-cabin-scene-${key}`;
    container.eventMode = 'none';

    const stripesGraphic = new window.PIXI.Graphics();
    stripesGraphic.label = `cabin-stripes-${key}`;
    stripesGraphic.eventMode = 'none';

    const dropHighlightGraphic = new window.PIXI.Graphics();
    dropHighlightGraphic.label = `cabin-drop-highlight-${key}`;
    dropHighlightGraphic.eventMode = 'none';
    dropHighlightGraphic.visible = false;

    container.addChild(stripesGraphic, dropHighlightGraphic);

    scene = {
      key,
      container,
      stripesGraphic,
      dropHighlightGraphic,
      bounds: null,
      heightU: 42
    };

    cabinScenes.set(key, scene);
    PixiContext.cabinSceneContainer?.addChild(container);
    return scene;
  }

  function buildCabinStripes(scene, heightU) {
    const g = scene.stripesGraphic;
    g.clear();

    const totalHeight = heightU * 32;
    const slotWidth = 530;
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';

    for (let u = heightU; u >= 1; u--) {
      const slotY = (heightU - u) * 32;
      const isEven = (u % 2 === 0);
      const fillColor = isLight
        ? (isEven ? 0xe6ecf2 : 0xdfe5ee)
        : (isEven ? 0x0a0e17 : 0x0e1422);

      // 32px slot stripe
      g.rect(0, slotY, slotWidth, 32).fill(fillColor);

      // Subtle horizontal divider line (bottom of each U slot)
      const dividerColor = isLight ? 0xc0cbd9 : 0x1e293b;
      const dividerAlpha = isLight ? 0.9 : 0.75;
      g.rect(0, slotY + 31, slotWidth, 1).fill({ color: dividerColor, alpha: dividerAlpha });

      // Subtle center reference line
      const centerColor = isLight ? 0x94a3b8 : 0x151f30;
      const centerAlpha = isLight ? 0.35 : 0.35;
      g.rect(14, slotY + 16, slotWidth - 28, 1).fill({ color: centerColor, alpha: centerAlpha });
    }

    // Rail boundary guide lines
    const railLineColor = isLight ? 0x94a3b8 : 0x334155;
    g.rect(0, 0, 1, totalHeight).fill({ color: railLineColor, alpha: 0.95 });
    g.rect(slotWidth - 1, 0, 1, totalHeight).fill({ color: railLineColor, alpha: 0.95 });
  }

  function syncPixiCabinScenes(explicitLod) {
    const pixiApp = PixiContext.pixiApp;
    const cabinContainer = PixiContext.cabinSceneContainer;
    if (!cabinContainer || !pixiApp) return false;

    const enabled = STATE.cableRenderMode === 'pixi';
    cabinContainer.visible = enabled;
    if (!enabled) return false;

    const lod = explicitLod || (RS.ZOOM_STATE?.scale < 0.35 ? 'macro' : 'detail');
    activeCabinLod = lod;

    const isMulti = STATE.viewMode === 'multi' && STATE.racks && STATE.racks.length > 1;
    const racks = isMulti ? STATE.racks : [getActiveRack()].filter(Boolean);

    const transform = getViewportTransform();
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const signature = `${currentTheme}|${lod}|${isMulti ? 'multi' : 'single'}|${racks.map(r => `${r.id}:${r.heightU || 42}`).join(';')}`;
    if (signature === lastCabinSignature && cabinScenes.size === racks.length) {
      return false;
    }

    const currentKeys = new Set(racks.map(r => String(r.id)));
    for (const [key, scene] of cabinScenes) {
      if (!currentKeys.has(key)) {
        if (scene.container.parent) scene.container.parent.removeChild(scene.container);
        scene.container.destroy({ children: true });
        cabinScenes.delete(key);
      }
    }

    racks.forEach((rack, index) => {
      const scene = getOrCreateCabinScene(rack.id);
      const heightU = rack.heightU || 42;
      scene.heightU = heightU;

      // Position cabin slot space in world coordinates
      let worldX = isMulti ? (60 + index * 698 + 23) : 23;
      let worldY = isMulti ? 76 : 0;
      let slotW = 530;
      let slotH = heightU * 32;

      if (transform) {
        const spaceEl = document.getElementById(`rack-${rack.id}-space`) ||
                        document.getElementById('rack-space') ||
                        document.querySelector(`.rack-container[data-rack-id="${rack.id}"] .rack-main-space`);
        if (spaceEl) {
          const r = spaceEl.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) {
            const tl = clientToWorld(r.left, r.top, transform);
            worldX = tl.x;
            worldY = tl.y;
            slotW = r.width / transform.scale;
            slotH = r.height / transform.scale;
          }
        }
      }

      scene.container.position.set(worldX, worldY);
      scene.bounds = {
        minX: worldX,
        minY: worldY,
        maxX: worldX + slotW,
        maxY: worldY + slotH
      };

      if (signature !== lastCabinSignature) {
        buildCabinStripes(scene, heightU);
      }

      // Cabin stripes are visible in macro mode under the NineSlice device chassis
      scene.stripesGraphic.visible = (lod === 'macro');
    });

    lastCabinSignature = signature;
    return true;
  }

  function updateDropHighlight(targetU, uHeight, isValid, targetRackId) {
    if (STATE.cableRenderMode !== 'pixi') return;
    const reqU = Math.max(1, Number(uHeight) || 1);
    const uNum = Number(targetU);
    if (!Number.isFinite(uNum) || uNum < 1) {
      clearDropHighlight();
      return;
    }

    const hostRackId = targetRackId || STATE.activeRackId;
    const scene = (hostRackId ? cabinScenes.get(String(hostRackId)) : null) ||
                  Array.from(cabinScenes.values())[0];
    if (!scene) return;

    cabinScenes.forEach(s => {
      if (s !== scene) {
        s.dropHighlightGraphic.clear();
        s.dropHighlightGraphic.visible = false;
      }
    });

    const slotY = (scene.heightU - uNum) * 32;
    const highlightH = reqU * 32;
    const color = isValid ? 0x10b981 : 0xef4444;

    const g = scene.dropHighlightGraphic;
    g.clear();
    g.roundRect(2, slotY + 2, 526, highlightH - 4, 3)
      .fill({ color, alpha: 0.28 })
      .stroke({ width: 2, color, alpha: 0.92 });
    g.visible = true;

    PixiContext.renderPixi?.('cabin-drop-highlight');
  }

  function clearDropHighlight() {
    let hadVisible = false;
    cabinScenes.forEach(s => {
      if (s.dropHighlightGraphic.visible) {
        s.dropHighlightGraphic.clear();
        s.dropHighlightGraphic.visible = false;
        hadVisible = true;
      }
    });
    if (hadVisible) PixiContext.renderPixi?.('cabin-clear-highlight');
  }

  function applyCabinViewportCulling(minX, minY, maxX, maxY) {
    cabinScenes.forEach(scene => {
      const b = scene.bounds;
      if (!b) {
        scene.container.visible = true;
        return;
      }
      const visible = !(b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY);
      scene.container.visible = visible;
    });
  }

  function destroyCabinScenes() {
    cabinScenes.forEach(scene => {
      if (scene.container.parent) scene.container.parent.removeChild(scene.container);
      scene.container.destroy({ children: true });
    });
    cabinScenes.clear();
    lastCabinSignature = null;
  }

  function invalidatePixiCabinScenes() {
    lastCabinSignature = null;
  }

  // Export to RackStudio and PixiContext namespaces
  RS.PixiCabinScene = {
    syncPixiCabinScenes,
    updateDropHighlight,
    clearDropHighlight,
    applyCabinViewportCulling,
    destroyCabinScenes,
    invalidatePixiCabinScenes,
    getCabinScenes: () => cabinScenes
  };

  PixiContext.PixiCabinScene = RS.PixiCabinScene;
  PixiContext.syncPixiCabinScenes = syncPixiCabinScenes;
  RS.syncPixiCabinScenes = syncPixiCabinScenes;
  PixiContext.updateDropHighlight = updateDropHighlight;
  PixiContext.clearDropHighlight = clearDropHighlight;
  PixiContext.applyCabinViewportCulling = applyCabinViewportCulling;
})();
