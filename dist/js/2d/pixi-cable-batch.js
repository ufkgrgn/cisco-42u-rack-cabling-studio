/**
 * Cisco Enterprise Rack & Cabling Studio - PixiJS v8 Batched Cable Geometry
 * Provides high-performance batched cable rendering with interleaved casing,
 * core, and 3D specular highlight passes, retained rack grouping, and focus variants.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const PixiContext = RS.PixiContext = RS.PixiContext || {};

  const STATE = RS.STATE;

  const CABLE_VISUAL_STYLE = Object.freeze({
    casingWidth: 4.8,
    coreWidth: 2.6,
    highlightWidth: 0.8,
    highlightAlpha: 0.18,
    casingColor: 0x060913,
    highlightColor: 0xffffff,
    railSpacing: 3.2,
    traySpacing: 2.8
  });

  const parsedPathCache = new Map();

  function parsePathString(pathD) {
    const raw = pathD.match(/[MLCQZ][^MLCQZ]*/gi) || [];
    const parsed = new Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      const cmd = raw[i];
      parsed[i] = {
        type: cmd[0],
        args: cmd.slice(1).trim().split(/[\s,]+/).map(Number)
      };
    }
    return parsed;
  }

  function parseSvgPathD(graphics, target) {
    if (!target || !graphics) return;
    let commands;
    if (typeof target === 'object' && target !== null && target.pathD) {
      if (!target._parsedCommands || target._parsedPathD !== target.pathD) {
        target._parsedPathD = target.pathD;
        target._parsedCommands = parsePathString(target.pathD);
      }
      commands = target._parsedCommands;
    } else if (typeof target === 'string') {
      commands = parsedPathCache.get(target);
      if (!commands) {
        commands = parsePathString(target);
        if (parsedPathCache.size < 5000) parsedPathCache.set(target, commands);
      }
    }
    if (!commands) return;
    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      const type = cmd.type;
      const args = cmd.args;
      if (type === 'M' || type === 'm') graphics.moveTo(args[0], args[1]);
      else if (type === 'L' || type === 'l') graphics.lineTo(args[0], args[1]);
      else if (type === 'Q' || type === 'q') graphics.quadraticCurveTo(args[0], args[1], args[2], args[3]);
      else if (type === 'C' || type === 'c') graphics.bezierCurveTo(args[0], args[1], args[2], args[3], args[4], args[5]);
      else if (type === 'Z' || type === 'z') graphics.closePath();
    }
  }

  function destroyContainerChildren(container) {
    if (!container) return;
    container.removeChildren().forEach(child => {
      child.filters?.forEach(filter => filter.destroy?.());
      child.destroy?.({ children: true });
    });
  }

  function appendConnector(graphics, point, color, focused = false) {
    if (!point || !graphics) return;
    const radius = focused ? 3.8 : 3.4;
    const pinRadius = focused ? 1.4 : 1.2;
    graphics.circle(point.x, point.y, radius)
      .fill(0x090d16)
      .stroke({ width: focused ? 1.8 : 1.6, color, alignment: 0.5 });
    graphics.circle(point.x, point.y, pinRadius).fill(color);
  }

  function createStubBadge(display, group, color) {
    if (!display?.isStub || !display.stubPoint || !display.stubBadgeText || !group?.connectors) return;
    const destX = display.stubPoint.x;
    const destY = display.stubPoint.y;
    const badgeW = Math.max(76, display.stubBadgeText.length * 6.5 + 16);
    const badgeH = 18;
    const bx = display.isRightExit ? destX + 4 : destX - badgeW - 4;
    const by = destY - badgeH / 2;
    group.connectors.roundRect(bx, by, badgeW, badgeH, 4)
      .fill(0x0f172a)
      .stroke({ width: 1.2, color });
    if (!window.PIXI?.Text) return;
    try {
      const textObj = new window.PIXI.Text({
        text: display.stubBadgeText,
        style: { fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 9, fontWeight: '600', fill: 0xe2e8f0 }
      });
      textObj.x = bx + badgeW / 2;
      textObj.y = by + 2;
      textObj.anchor?.set ? textObj.anchor.set(0.5, 0) : (textObj.anchor = { x: 0.5, y: 0 });
      group.badges?.push(textObj);
    } catch (_) {
      try {
        const textObj = new window.PIXI.Text(display.stubBadgeText, {
          fontFamily: 'system-ui, -apple-system, sans-serif', fontSize: 9, fontWeight: '600', fill: 0xe2e8f0
        });
        textObj.x = bx + badgeW / 2;
        textObj.y = by + 2;
        textObj.anchor?.set ? textObj.anchor.set(0.5, 0) : (textObj.anchor = { x: 0.5, y: 0 });
        group.badges?.push(textObj);
      } catch (_) {}
    }
  }

  function destroyFocusVariants(display) {
    if (!display?.focusVariants) return;
    display.focusVariants.forEach(variant => {
      variant.parent?.removeChild(variant);
      destroyContainerChildren(variant);
      variant.destroy?.();
    });
    display.focusVariants.clear();
  }

  function destroyCableDisplay(display) {
    if (!display) return;
    const renderStats = PixiContext.renderStats;
    if (PixiContext.usesBatchedViewportRenderer?.()) {
      destroyFocusVariants(display);
      if (renderStats) renderStats.destroyedDisplays++;
      return;
    }
    [display.glow, display.casing, display.core, ...(display.boots || [])].forEach(graphic => {
      if (!graphic) return;
      graphic.parent?.removeChild(graphic);
      graphic.destroy?.();
    });
    if (renderStats) renderStats.destroyedDisplays++;
  }

  function getRetainedFocusVariant(display, selectedOnly) {
    const telemetry = PixiContext.performanceTelemetry;
    const color = display.previewColorNum ?? display.colorNum;
    const endpointSignature = (display.endpoints || []).map(point => `${point.x}:${point.y}`).join('|');
    const key = `${display.pathD}|${color}|${selectedOnly ? 'selected' : 'hover'}|${endpointSignature}`;
    display.focusVariants ||= new Map();
    const cached = display.focusVariants.get(key);
    if (cached) {
      if (telemetry) telemetry.focusVariantCacheHits++;
      return cached;
    }
    destroyFocusVariants(display);
    const variant = new window.PIXI.Container();
    const glow = new window.PIXI.Graphics();
    const casing = new window.PIXI.Graphics();
    const core = new window.PIXI.Graphics();
    const highlight = new window.PIXI.Graphics();
    const boots = new window.PIXI.Graphics();
    variant.eventMode = 'none';
    glow.eventMode = 'none';
    casing.eventMode = 'none';
    core.eventMode = 'none';
    highlight.eventMode = 'none';
    boots.eventMode = 'none';

    parseSvgPathD(glow, display.pathD);
    parseSvgPathD(casing, display.pathD);
    parseSvgPathD(core, display.pathD);
    parseSvgPathD(highlight, display.pathD);
    display.endpoints.forEach(point => appendConnector(boots, point, color, true));

    glow.stroke({ width: selectedOnly ? 9 : 8, color, alpha: selectedOnly ? 0.72 : 0.62, cap: 'round', join: 'round' });
    glow.blendMode = 'add';
    casing.stroke({ width: selectedOnly ? 5.8 : 5.4, color: CABLE_VISUAL_STYLE.casingColor, alpha: 1, cap: 'round', join: 'round' });
    core.stroke({ width: selectedOnly ? 3.5 : 3.2, color, alpha: 1, cap: 'round', join: 'round' });
    highlight.stroke({ width: 0.9, color: CABLE_VISUAL_STYLE.highlightColor, alpha: 0.35, cap: 'round', join: 'round' });

    variant.addChild(glow, casing, core, highlight, boots);
    display.focusVariants.set(key, variant);
    if (telemetry) telemetry.focusVariantCacheMisses++;
    return variant;
  }

  function buildRetainedRackBatch(rackKey, displays, cableIndex = -1, connectorIndex = -1) {
    const cablesContainer = PixiContext.getCablesContainer?.();
    const connectorsContainer = PixiContext.getConnectorsContainer?.();
    const rackGroup = { displays: [...displays], byColor: new Map() };
    const cableBatch = new window.PIXI.Container();
    const connectorBatch = new window.PIXI.Container();
    cableBatch.__rackId = connectorBatch.__rackId = rackKey;

    const points = displays.flatMap(display => display.endpoints || []);
    const bounds = points.length ? {
      minX: Math.min(...points.map(point => point.x)) - 180,
      minY: Math.min(...points.map(point => point.y)) - 180,
      maxX: Math.max(...points.map(point => point.x)) + 180,
      maxY: Math.max(...points.map(point => point.y)) + 180
    } : null;
    cableBatch.__worldBounds = connectorBatch.__worldBounds = bounds;

    const casing = new window.PIXI.Graphics();
    casing.eventMode = 'none';
    const connectors = new window.PIXI.Graphics();
    connectors.eventMode = 'none';
    const badges = [];

    // Interleaved stroke sequence:
    // For each cable:
    // 1. Dark casing (4.8px #060913) - crisp separation between adjacent parallel lines
    // 2. Colored core (2.6px display.colorNum)
    // 3. 3D cylindrical highlight (0.8px #ffffff alpha 0.18)
    displays.forEach(display => {
      // 1. Casing
      parseSvgPathD(casing, display);
      casing.stroke({
        width: CABLE_VISUAL_STYLE.casingWidth,
        color: CABLE_VISUAL_STYLE.casingColor,
        alpha: 1,
        cap: 'round',
        join: 'round'
      });

      // 2. Core
      parseSvgPathD(casing, display);
      casing.stroke({
        width: CABLE_VISUAL_STYLE.coreWidth,
        color: display.colorNum,
        alpha: 1,
        cap: 'round',
        join: 'round'
      });

      // 3. Highlight
      parseSvgPathD(casing, display);
      casing.stroke({
        width: CABLE_VISUAL_STYLE.highlightWidth,
        color: CABLE_VISUAL_STYLE.highlightColor,
        alpha: CABLE_VISUAL_STYLE.highlightAlpha,
        cap: 'round',
        join: 'round'
      });

      // Endpoints & connectors
      display.endpoints.forEach(point => appendConnector(connectors, point, display.colorNum, false));
      createStubBadge(display, { connectors, badges }, display.colorNum);
    });

    cableBatch.addChild(casing);
    connectorBatch.addChild(connectors);
    badges.forEach(badge => connectorBatch.addChild(badge));

    if (cableIndex >= 0 && cablesContainer?.addChildAt) cablesContainer.addChildAt(cableBatch, Math.min(cableIndex, cablesContainer.children.length));
    else cablesContainer?.addChild(cableBatch);
    if (connectorIndex >= 0 && connectorsContainer?.addChildAt) connectorsContainer.addChildAt(connectorBatch, Math.min(connectorIndex, connectorsContainer.children.length));
    else connectorsContainer?.addChild(connectorBatch);

    rackGroup.cableBatch = cableBatch;
    rackGroup.connectorBatch = connectorBatch;
    rackGroup.casing = casing;
    rackGroup.connectors = connectors;
    rackGroup.badges = badges;
    rackGroup.displays = displays;
    return rackGroup;
  }

  function rebuildBatchedBase() {
    const usesBatched = PixiContext.usesBatchedViewportRenderer?.();
    const cablesContainer = PixiContext.getCablesContainer?.();
    const connectorsContainer = PixiContext.getConnectorsContainer?.();
    const focusContainer = PixiContext.getFocusContainer?.();
    const batchedRackGroups = PixiContext.batchedRackGroups;
    const cableDisplays = PixiContext.cableDisplays;
    const renderStats = PixiContext.renderStats;
    const telemetry = PixiContext.performanceTelemetry;

    if (!usesBatched || !cablesContainer || !connectorsContainer) return;
    destroyContainerChildren(cablesContainer);
    destroyContainerChildren(connectorsContainer);
    batchedRackGroups.clear();

    const byRack = new Map();
    for (const display of cableDisplays.values()) {
      const rackKey = display.rackKey || '__cross__:unknown:unknown';
      let displays = byRack.get(rackKey);
      if (!displays) {
        displays = [];
        byRack.set(rackKey, displays);
      }
      displays.push(display);
    }

    byRack.forEach((displays, rackKey) => {
      batchedRackGroups.set(rackKey, buildRetainedRackBatch(rackKey, displays));
    });

    if (renderStats) {
      renderStats.batchRebuilds++;
      renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + (focusContainer?.children?.length || 0);
    }
    if (telemetry) telemetry.fullBatchRebuilds++;
  }

  function appendBatchedDisplays(cableIds) {
    const usesBatched = PixiContext.usesBatchedViewportRenderer?.();
    const batchedRackGroups = PixiContext.batchedRackGroups;
    const cableDisplays = PixiContext.cableDisplays;
    const cablesContainer = PixiContext.getCablesContainer?.();
    const connectorsContainer = PixiContext.getConnectorsContainer?.();
    const focusContainer = PixiContext.getFocusContainer?.();
    const renderStats = PixiContext.renderStats;
    const telemetry = PixiContext.performanceTelemetry;

    if (!usesBatched || !cableIds.size) return false;
    const pending = [];
    for (const cableId of cableIds) {
      const display = cableDisplays.get(cableId);
      const rackGroup = display && batchedRackGroups.get(display.rackKey || '__cross__:unknown:unknown');
      if (!display || display.isStub || !rackGroup?.casing || !rackGroup.cableBatch || !rackGroup.connectorBatch) return false;
      pending.push({ display, rackGroup });
    }

    for (const { display, rackGroup } of pending) {
      // Interleaved stroke sequence: casing -> core -> highlight
      parseSvgPathD(rackGroup.casing, display.pathD);
      rackGroup.casing.stroke({
        width: CABLE_VISUAL_STYLE.casingWidth,
        color: CABLE_VISUAL_STYLE.casingColor,
        alpha: 1,
        cap: 'round',
        join: 'round'
      });

      parseSvgPathD(rackGroup.casing, display.pathD);
      rackGroup.casing.stroke({
        width: CABLE_VISUAL_STYLE.coreWidth,
        color: display.colorNum,
        alpha: 1,
        cap: 'round',
        join: 'round'
      });

      parseSvgPathD(rackGroup.casing, display.pathD);
      rackGroup.casing.stroke({
        width: CABLE_VISUAL_STYLE.highlightWidth,
        color: CABLE_VISUAL_STYLE.highlightColor,
        alpha: CABLE_VISUAL_STYLE.highlightAlpha,
        cap: 'round',
        join: 'round'
      });

      if (rackGroup.connectors) {
        display.endpoints.forEach(point => appendConnector(rackGroup.connectors, point, display.colorNum, false));
      }
      rackGroup.displays.push(display);

      const bounds = rackGroup.cableBatch.__worldBounds;
      if (bounds) {
        display.endpoints.forEach(point => {
          bounds.minX = Math.min(bounds.minX, point.x - 180);
          bounds.minY = Math.min(bounds.minY, point.y - 180);
          bounds.maxX = Math.max(bounds.maxX, point.x + 180);
          bounds.maxY = Math.max(bounds.maxY, point.y + 180);
        });
      }
    }

    if (telemetry) telemetry.incrementalBatchUpdates += pending.length;
    if (renderStats && cablesContainer && connectorsContainer) {
      renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + (focusContainer?.children?.length || 0);
    }
    return true;
  }

  function rebuildBatchedRackGroups(rackKeys) {
    const usesBatched = PixiContext.usesBatchedViewportRenderer?.();
    const batchedRackGroups = PixiContext.batchedRackGroups;
    const cableDisplays = PixiContext.cableDisplays;
    const cablesContainer = PixiContext.getCablesContainer?.();
    const connectorsContainer = PixiContext.getConnectorsContainer?.();
    const focusContainer = PixiContext.getFocusContainer?.();
    const renderStats = PixiContext.renderStats;
    const telemetry = PixiContext.performanceTelemetry;

    if (!usesBatched || !rackKeys.size) return false;
    for (const rackKey of rackKeys) {
      const rackGroup = batchedRackGroups.get(rackKey);
      if (!rackGroup?.cableBatch || !rackGroup.connectorBatch) return false;
    }

    let processedDisplays = 0;
    for (const rackKey of rackKeys) {
      const previous = batchedRackGroups.get(rackKey);
      const cableIndex = cablesContainer?.getChildIndex ? cablesContainer.getChildIndex(previous.cableBatch) : -1;
      const connectorIndex = connectorsContainer?.getChildIndex ? connectorsContainer.getChildIndex(previous.connectorBatch) : -1;
      previous.cableBatch.parent?.removeChild(previous.cableBatch);
      previous.connectorBatch.parent?.removeChild(previous.connectorBatch);
      destroyContainerChildren(previous.cableBatch);
      destroyContainerChildren(previous.connectorBatch);
      previous.cableBatch.destroy?.();
      previous.connectorBatch.destroy?.();
      batchedRackGroups.delete(rackKey);

      const displays = (previous.displays && previous.displays.length)
        ? previous.displays.filter(d => (d.id ? cableDisplays.has(d.id) : Array.from(cableDisplays.values()).includes(d)))
        : Array.from(cableDisplays.values()).filter(display => (display.rackKey || '__cross__:unknown:unknown') === rackKey);
      processedDisplays += displays.length;
      if (displays.length) batchedRackGroups.set(rackKey, buildRetainedRackBatch(rackKey, displays, cableIndex, connectorIndex));
    }

    if (telemetry) {
      telemetry.partialRackBatchRebuilds += rackKeys.size;
      telemetry.partialRemovalBatchCablesProcessed += processedDisplays;
      telemetry.avoidedFullRemovalBatchRebuilds++;
    }
    if (renderStats && cablesContainer && connectorsContainer) {
      renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + (focusContainer?.children?.length || 0);
    }
    return true;
  }

  function rebuildBatchedStyleGroups(arg1, arg2) {
    const usesBatched = PixiContext.usesBatchedViewportRenderer?.();
    const batchedRackGroups = PixiContext.batchedRackGroups;
    const cableDisplays = PixiContext.cableDisplays;
    const telemetry = PixiContext.performanceTelemetry;
    const previousColorsByCableId = (arg2 instanceof Map) ? arg2 : (arg1 instanceof Map ? arg1 : new Map());

    if (!usesBatched || !previousColorsByCableId.size) return false;
    const affectedRackKeys = new Set();
    const affectedByRack = new Map();
    for (const [cableId, previousColor] of previousColorsByCableId) {
      const display = cableDisplays.get(cableId);
      const rackKey = display?.rackKey || '__cross__:unknown:unknown';
      const rackGroup = batchedRackGroups.get(rackKey);
      if (!display || !rackGroup?.cableBatch || !rackGroup.connectorBatch) return false;
      affectedRackKeys.add(rackKey);
      if (!affectedByRack.has(rackKey)) affectedByRack.set(rackKey, new Set());
      affectedByRack.get(rackKey).add(previousColor);
      affectedByRack.get(rackKey).add(display.colorNum);
    }

    const success = rebuildBatchedRackGroups(affectedRackKeys);
    if (success && telemetry) {
      telemetry.partialColorBatchRebuilds += Array.from(affectedByRack.values()).reduce((sum, colors) => sum + colors.size, 0);
      telemetry.partialColorBatchCablesProcessed += Array.from(affectedRackKeys).reduce((sum, key) => sum + (batchedRackGroups.get(key)?.displays?.length || 0), 0);
      telemetry.avoidedFullStyleBatchRebuilds++;
    }
    return success;
  }

  function rebuildBatchedFocus() {
    const usesBatched = PixiContext.usesBatchedViewportRenderer?.();
    const cablesContainer = PixiContext.getCablesContainer?.();
    const connectorsContainer = PixiContext.getConnectorsContainer?.();
    const focusContainer = PixiContext.getFocusContainer?.();
    const cableDisplays = PixiContext.cableDisplays;
    const telemetry = PixiContext.performanceTelemetry;
    const renderStats = PixiContext.renderStats;

    if (!usesBatched || !focusContainer || !cablesContainer || !connectorsContainer) return;
    focusContainer.removeChildren();

    const hoveredCableId = PixiContext.getHoveredCableId?.();
    const groupHoveredCableIds = PixiContext.getGroupHoveredCableIds?.() || new Set();
    const hasHoverFocus = (hoveredCableId !== null && hoveredCableId !== undefined) || groupHoveredCableIds.size > 0;
    const hasSelectFocus = !hasHoverFocus && !!STATE.highlightedCableId;
    const dimmedAlpha = hasHoverFocus ? 0.14 : (hasSelectFocus ? 0.22 : 1);
    cablesContainer.alpha = dimmedAlpha;
    connectorsContainer.alpha = dimmedAlpha;

    const focusIds = new Set(groupHoveredCableIds);
    if (hoveredCableId) focusIds.add(hoveredCableId);
    if (!hasHoverFocus && STATE.highlightedCableId) focusIds.add(STATE.highlightedCableId);

    if (telemetry) telemetry.incrementalFocusPasses++;
    if (!focusIds.size) {
      if (renderStats) renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length;
      return;
    }

    const selectedOnly = !hasHoverFocus && !!STATE.highlightedCableId;
    for (const id of focusIds) {
      const display = cableDisplays.get(id);
      if (!display) continue;
      focusContainer.addChild(getRetainedFocusVariant(display, selectedOnly));
      if (telemetry) telemetry.incrementalFocusCablesProcessed++;
    }
    if (renderStats) {
      renderStats.batchDisplayCount = cablesContainer.children.length + connectorsContainer.children.length + focusContainer.children.length;
    }
  }

  function redrawCableDisplay(cableId) {
    const cableDisplays = PixiContext.cableDisplays;
    const display = cableDisplays.get(cableId);
    if (!display) return;

    const hoveredCableId = PixiContext.getHoveredCableId?.();
    const groupHoveredCableIds = PixiContext.getGroupHoveredCableIds?.() || new Set();
    const selected = STATE.highlightedCableId === cableId;
    const hovered = hoveredCableId === cableId || groupHoveredCableIds.has(cableId);
    const hasHoverFocus = hoveredCableId !== null && hoveredCableId !== undefined || groupHoveredCableIds.size > 0;
    const visuallyFocused = hovered || (selected && !hasHoverFocus);
    const activeColor = display.previewColorNum ?? display.colorNum;
    display.visualAlpha = hovered ? 1 : (hasHoverFocus ? 0.14 : 1);
    display.glowAlpha = visuallyFocused ? 1 : 0;

    if (PixiContext.usesBatchedViewportRenderer?.()) {
      rebuildBatchedFocus();
      return;
    }

    if (display.glow) {
      display.glow.clear();
      if (visuallyFocused) {
        parseSvgPathD(display.glow, display.pathD);
        display.glow.stroke({
          width: selected ? 12 : 10,
          color: activeColor,
          alpha: selected ? 0.58 : 0.48,
          cap: 'round',
          join: 'round'
        });
        display.glow.blendMode = 'add';
      }
      display.glow.alpha = visuallyFocused ? 1 : 0;
    }

    if (display.casing) {
      display.casing.clear();
      parseSvgPathD(display.casing, display.pathD);
      display.casing.stroke({
        width: selected ? 5.8 : (hovered ? 5.4 : 4.8),
        color: CABLE_VISUAL_STYLE.casingColor,
        alpha: selected || hovered ? 1 : 0.95,
        cap: 'round',
        join: 'round'
      });
      display.casing.alpha = display.core?.alpha || 1;
    }

    if (display.core) {
      display.core.clear();
      parseSvgPathD(display.core, display.pathD);
      display.core.stroke({
        width: selected ? 3.5 : (hovered ? 3.2 : 2.6),
        color: activeColor,
        alpha: 1,
        cap: 'round',
        join: 'round'
      });
      display.core.alpha = hovered ? 1 : (hasHoverFocus ? 0.14 : 1);
    }
  }

  function refreshCableFocus(fullyRedrawIds = new Set(), shouldRender = true) {
    const usesBatched = PixiContext.usesBatchedViewportRenderer?.();
    const telemetry = PixiContext.performanceTelemetry;
    const cableDisplays = PixiContext.cableDisplays;

    if (usesBatched) {
      if (telemetry) telemetry.focusFullDisplayScansAvoided += cableDisplays.size;
      rebuildBatchedFocus();
      if (shouldRender) PixiContext.renderPixi?.('focus');
      else if (telemetry) telemetry.avoidedFocusRenders++;
      return;
    }

    const hoveredCableId = PixiContext.getHoveredCableId?.();
    const groupHoveredCableIds = PixiContext.getGroupHoveredCableIds?.() || new Set();
    const hasHoverFocus = hoveredCableId !== null && hoveredCableId !== undefined || groupHoveredCableIds.size > 0;

    for (const [id, display] of cableDisplays) {
      if (fullyRedrawIds.has(id) || id === STATE.highlightedCableId) {
        redrawCableDisplay(id);
        continue;
      }
      const hovered = hoveredCableId === id || groupHoveredCableIds.has(id);
      const alpha = hovered ? 1 : (hasHoverFocus ? 0.14 : 1);
      if (display.core) display.core.alpha = alpha;
      if (display.casing) display.casing.alpha = alpha;
      if (display.glow) display.glow.alpha = 0;
      display.boots?.forEach(boot => { boot.alpha = alpha; });
    }
    if (shouldRender) PixiContext.renderPixi?.('focus');
    else if (telemetry) telemetry.avoidedFocusRenders++;
  }

  // Exports
  RS.PixiCableBatch = {
    CABLE_VISUAL_STYLE,
    parseSvgPathD,
    appendConnector,
    createStubBadge,
    destroyContainerChildren,
    destroyFocusVariants,
    destroyCableDisplay,
    getRetainedFocusVariant,
    buildRetainedRackBatch,
    rebuildBatchedBase,
    appendBatchedDisplays,
    rebuildBatchedRackGroups,
    rebuildBatchedStyleGroups,
    rebuildBatchedFocus,
    redrawCableDisplay,
    refreshCableFocus
  };

  RS.refreshCableFocus = refreshCableFocus;

  PixiContext.CABLE_VISUAL_STYLE = CABLE_VISUAL_STYLE;
  PixiContext.parseSvgPathD = parseSvgPathD;
  PixiContext.appendConnector = appendConnector;
  PixiContext.createStubBadge = createStubBadge;
  PixiContext.destroyContainerChildren = destroyContainerChildren;
  PixiContext.destroyFocusVariants = destroyFocusVariants;
  PixiContext.destroyCableDisplay = destroyCableDisplay;
  PixiContext.getRetainedFocusVariant = getRetainedFocusVariant;
  PixiContext.buildRetainedRackBatch = buildRetainedRackBatch;
  PixiContext.rebuildBatchedBase = rebuildBatchedBase;
  PixiContext.appendBatchedDisplays = appendBatchedDisplays;
  PixiContext.rebuildBatchedRackGroups = rebuildBatchedRackGroups;
  PixiContext.rebuildBatchedStyleGroups = rebuildBatchedStyleGroups;
  PixiContext.rebuildBatchedFocus = rebuildBatchedFocus;
  PixiContext.redrawCableDisplay = redrawCableDisplay;
  PixiContext.refreshCableFocus = refreshCableFocus;
})();
