/**
 * Cisco Enterprise Rack & Cabling Studio - Intelligent Network Rules & Compliance Engine
 * Enforces network engineering standards:
 * - Loop prevention (blocks self-connecting ports on the same switch)
 * - Media & port compatibility validation (copper RJ45 vs optical LC/SC, AC PDU isolation)
 * - Automatic Uplink recognition: Auto-assigns [UPLINK] / [TRUNK] role, #00d2ff / #7c3aed color and port markers
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  /**
   * Normalizes and checks if a port type is an SFP or QSFP transceiver cage.
   * Matches 'sfp', 'sfp+', 'sfp28', 'qsfp', 'qsfp+', 'qsfp28'.
   */
  function isSfpCageType(type) {
    if (!type) return false;
    const t = String(type).toLowerCase().trim();
    return t === 'sfp' || t === 'sfp+' || t === 'sfp28' || t === 'qsfp' || t === 'qsfp+' || t === 'qsfp28';
  }

  /**
   * Evaluates whether a port is classified as an Uplink / Core / Trunk port.
   * Checks port ID patterns, name patterns, type and speed attributes.
   */
  function isUplinkPort(port, device, catalog) {
    if (!port) return false;
    const pId = String(port.id || '').toLowerCase();
    const pName = String(port.name || '').toLowerCase();
    const pSpeed = String(port.speed || '').toLowerCase();
    const pType = String(port.type || '').toLowerCase();

    // 1. Explicit port id prefix (e.g. up1, up_1_1, uplink)
    if (pId.startsWith('up')) return true;

    // 2. Port speed notes or port name designating uplink / core / spine / stack
    if (pSpeed.includes('uplink') || pSpeed.includes('spine') || pSpeed.includes('core')) {
      return true;
    }

    // 3. TenGigabit / 25G / 40G / 100G speed designation on a standard switch
    if (pName.startsWith('te') || pName.startsWith('fo') || pName.startsWith('twe') || pName.startsWith('hu') || pName.startsWith('25ge') || pName.startsWith('100ge')) {
      return true;
    }

    // 4. SFP / QSFP optical module ports on access switch models (e.g. 2960, 9200L, 9300L)
    const cat = catalog || (device && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[device.catalogKey] : null);
    if (cat && isSfpCageType(pType)) {
      // If the device is primarily copper access switch with dedicated SFP cages
      const hasCopperPorts = Array.isArray(cat.ports) && cat.ports.some(p => p.type === 'rj45');
      if (hasCopperPorts) return true;
    }

    return false;
  }

  /**
   * Detects if the connection between two ports qualifies as an Uplink / Trunk connection.
   * Returns metadata for auto-configuring role, color, and labels.
   */
  function detectUplinkConnection(sourceDev, sourcePort, targetDev, targetPort) {
    const catSrc = sourceDev && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[sourceDev.catalogKey] : null;
    const catTgt = targetDev && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[targetDev.catalogKey] : null;

    const isSrcUplink = isUplinkPort(sourcePort, sourceDev, catSrc);
    const isTgtUplink = isUplinkPort(targetPort, targetDev, catTgt);

    const isSrcSwitch = catSrc && (catSrc.category === 'switch' || catSrc.category === 'fiber-switch' || catSrc.category === 'compact');
    const isTgtSwitch = catTgt && (catTgt.category === 'switch' || catTgt.category === 'fiber-switch' || catTgt.category === 'compact');
    const isSrcRouter = catSrc && catSrc.category === 'router';
    const isTgtRouter = catTgt && catTgt.category === 'router';

    const isFiber = isFiberConnection(sourceDev, sourcePort, targetDev, targetPort);

    // CRITICAL: Switch-to-Switch Interconnection Rules (Loop / STP Protection)
    // Connecting two switches prompts for confirmation: 802.1Q Trunk is recommended, but Standard Access is permitted.
    if (isSrcSwitch && isTgtSwitch) {
      if (isFiber) {
        return {
          isUplink: true,
          isTrunk: true,
          isFiber: true,
          isSwitchToSwitch: true,
          disallowStandard: false,
          role: 'trunk',
          color: FIBER_SINGLEMODE_YELLOW,
          prefix: '[TRUNK-FIBER]',
          reason: 'Switchler Arası Optik Fiber Trunk Hattı (Loop / STP Koruması). 802.1Q Trunk önerilir, Standart Access seçilebilir.',
          requiresPrompt: true
        };
      }
      if (isSrcUplink && isTgtUplink) {
        return {
          isUplink: true,
          isTrunk: true,
          isSwitchToSwitch: true,
          disallowStandard: false,
          role: 'uplink',
          color: '#00d2ff',
          prefix: '[UPLINK]',
          reason: 'Switchler Arası Donanımsal Uplink Port Hattı (Loop / STP Koruması). 802.1Q Trunk önerilir, Standart Access seçilebilir.',
          requiresPrompt: true
        };
      }
      return {
        isUplink: false,
        isTrunk: true,
        isSwitchToSwitch: true,
        disallowStandard: false,
        role: 'trunk',
        color: '#7c3aed',
        prefix: '[TRUNK]',
        reason: 'Switchler Arası 802.1Q Trunk Hattı (Loop / STP Koruması). 802.1Q Trunk önerilir, Standart Access seçilebilir.',
        requiresPrompt: true
      };
    }

    if (isFiber) {
      return {
        isUplink: true,
        isFiber: true,
        role: 'fiber',
        color: FIBER_SINGLEMODE_YELLOW,
        prefix: '[FIBER]',
        reason: 'Otomatik SFP/Fiber Optik Uplink Bağlantısı (Single-Mode OS2 Sarı)',
        requiresPrompt: false
      };
    }

    // Switch to Router or Fiber Core Switch uplink (no prompt required)
    if ((isSrcUplink && (isTgtRouter || catTgt?.category === 'fiber-switch')) ||
        (isTgtUplink && (isSrcRouter || catSrc?.category === 'fiber-switch'))) {
      return {
        isUplink: true,
        role: 'uplink',
        color: '#00d2ff',
        prefix: '[UPLINK]',
        reason: 'Otomatik Router/Core Uplink Bağlantısı',
        requiresPrompt: false
      };
    }

    return null;
  }

  const FIBER_SINGLEMODE_YELLOW = '#facc15'; // EIA/TIA-598 Single Mode OS1/OS2 Yellow

  /**
   * Evaluates whether a port is an optical fiber port (LC, SC, optical SFP transceiver).
   */
  function isFiberPort(port, device, catalog) {
    if (!port) return false;
    const type = String(port.type || '').toLowerCase();
    if (type === 'lc' || type === 'sc' || type === 'fiber') return true;
    const cat = catalog || (device && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[device.catalogKey] : null);
    if (cat?.category === 'fiber') return true;
    if (isSfpCageType(type)) {
      const speed = String(port.speed || '').toLowerCase();
      if (speed.includes('fiber') || cat?.category === 'fiber-switch') return true;
      return true; // SFP optical cage default
    }
    return false;
  }

  /**
   * Evaluates whether a connection between two ports is an optical fiber patch/run.
   * True ONLY if BOTH endpoints are optical (LC, SC, optical fiber/SFP) and NEITHER is copper RJ45.
   */
  function isFiberConnection(sourceDev, sourcePort, targetDev, targetPort) {
    if (!sourcePort || !targetPort) return false;
    const typeA = String(sourcePort.type || '').toLowerCase();
    const typeB = String(targetPort.type || '').toLowerCase();

    // Never a fiber connection if either endpoint is a copper RJ45 port or power socket!
    if (typeA === 'rj45' || typeB === 'rj45' || typeA === 'power' || typeB === 'power') {
      return false;
    }

    const catSrc = sourceDev && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[sourceDev.catalogKey] : null;
    const catTgt = targetDev && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[targetDev.catalogKey] : null;

    const isSrcFiber = isFiberPort(sourcePort, sourceDev, catSrc);
    const isTgtFiber = isFiberPort(targetPort, targetDev, catTgt);

    return isSrcFiber && isTgtFiber;
  }

  /**
   * Detects and returns fiber connection attributes (color, role, prefix).
   */
  function detectFiberConnection(sourceDev, sourcePort, targetDev, targetPort) {
    if (!isFiberConnection(sourceDev, sourcePort, targetDev, targetPort)) return null;

    const catSrc = sourceDev && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[sourceDev.catalogKey] : null;
    const catTgt = targetDev && RS.HARDWARE_CATALOG ? RS.HARDWARE_CATALOG[targetDev.catalogKey] : null;
    const isSrcSwitch = catSrc && (catSrc.category === 'switch' || catSrc.category === 'fiber-switch' || catSrc.category === 'compact');
    const isTgtSwitch = catTgt && (catTgt.category === 'switch' || catTgt.category === 'fiber-switch' || catTgt.category === 'compact');

    const pTypeA = String(sourcePort?.type || '').toUpperCase();
    const pTypeB = String(targetPort?.type || '').toUpperCase();
    const mediaLabel = (pTypeA === pTypeB) ? pTypeA : `${pTypeA}/${pTypeB}`;

    if (isSrcSwitch && isTgtSwitch) {
      return {
        isFiber: true,
        isTrunk: true,
        isSwitchToSwitch: true,
        disallowStandard: false,
        color: FIBER_SINGLEMODE_YELLOW,
        role: 'trunk',
        prefix: '[TRUNK-FIBER]',
        media: mediaLabel,
        reason: `Switchler Arası Single-Mode OS2 Fiber Trunk Bağlantısı (${mediaLabel}) (Loop / STP Koruması). 802.1Q Trunk önerilir, Standart Access seçilebilir.`,
        requiresPrompt: true
      };
    }

    return {
      isFiber: true,
      color: FIBER_SINGLEMODE_YELLOW,
      role: 'fiber',
      prefix: '[FIBER]',
      media: mediaLabel,
      reason: `Single-Mode OS2 Fiber Optik Bağlantı (${mediaLabel})`,
      requiresPrompt: false
    };
  }

  /**
   * Identifies passive structured cabling distribution panels (RJ45 patch panels, fiber ODFs)
   * that perform passive physical cross-connects without active switching/STP engines.
   */
  function isPassivePatchPanel(cat, catalogKey) {
    if (!cat && !catalogKey) return false;
    const c = String(cat?.category || '').toLowerCase();
    if (c === 'switch' || c === 'fiber-switch' || c === 'router' || c === 'server' || c === 'pdu' || c === 'firewall' || c === 'storage') {
      return false;
    }
    const k = String(catalogKey || '').toLowerCase();
    const name = String(cat?.name || '').toLowerCase();
    return c === 'patch' || c === 'patch-panel' || c === 'fiber' || c === 'odf' ||
           k.startsWith('patch-') || k.startsWith('fiber-odf') || name.includes('patch') || name.includes('odf') || name.includes('dağıtım paneli');
  }

  /**
   * Validates a proposed cable connection against network engineering rules.
   * Returns: { allowed: boolean, reason?: string, warning?: string, autoConfig?: object }
   */
  function validateConnection(source, target, optionsOrState = {}, catalogMap = null, maybeStrict = null) {
    let strictMode = true;
    let stateRef = RS.STATE || window.STATE;
    let catalogRef = RS.HARDWARE_CATALOG || window.HARDWARE_CATALOG;

    if (optionsOrState && typeof optionsOrState === 'object') {
      if (Array.isArray(optionsOrState.devices) || Array.isArray(optionsOrState.racks)) {
        stateRef = optionsOrState;
      }
      if (catalogMap) {
        catalogRef = catalogMap;
      }
      if (typeof maybeStrict === 'boolean') {
        strictMode = maybeStrict;
      } else if (optionsOrState.strictMode !== undefined) {
        strictMode = Boolean(optionsOrState.strictMode);
      } else if (optionsOrState.strictCompliance !== undefined) {
        strictMode = Boolean(optionsOrState.strictCompliance);
      } else if (stateRef?.strictCompliance !== undefined) {
        strictMode = Boolean(stateRef.strictCompliance);
      } else if (RS.STATE?.strictCompliance !== false) {
        strictMode = true;
      } else {
        strictMode = false;
      }
    }

    if (!catalogRef) catalogRef = RS.HARDWARE_CATALOG || window.HARDWARE_CATALOG || {};

    // 1. SELF-PORT VALIDATION: A port cannot connect to itself
    if (source.instanceId === target.instanceId && source.portId === target.portId) {
      return {
        allowed: false,
        type: 'same-port',
        reason: 'Aynı port kendisine bağlanamaz! Kablonun iki ucu aynı sokete takılamaz.'
      };
    }

    // Resolve hardware catalog and port objects
    const findDev = (instId) => {
      if (stateRef?.devices && Array.isArray(stateRef.devices)) {
        const d = stateRef.devices.find(item => item.instanceId === instId);
        if (d) return { device: d, rack: null };
      }
      const racks = stateRef?.racks || RS.STATE?.racks || window.STATE?.racks || [];
      for (const r of racks) {
        const d = r.devices?.find(item => item.instanceId === instId);
        if (d) return { device: d, rack: r };
      }
      return { device: null, rack: null };
    };

    const srcInfo = findDev(source.instanceId);
    const tgtInfo = findDev(target.instanceId);

    const devA = srcInfo.device;
    const devB = tgtInfo.device;
    const catA = devA && catalogRef ? catalogRef[devA.catalogKey] : null;
    const catB = devB && catalogRef ? catalogRef[devB.catalogKey] : null;

    const isPatchA = isPassivePatchPanel(catA, devA?.catalogKey);
    const isPatchB = isPassivePatchPanel(catB, devB?.catalogKey);

    // 2. SELF-LOOP VALIDATION:
    // Passive Patch Panels / ODFs allow intra-panel cross-connects (pass-through / loopback test) with an advisory warning.
    // Active devices (Switches, Routers, Servers) strictly disallow same-device loops (STP / Broadcast Storm protection).
    let loopWarning = null;
    if (source.instanceId === target.instanceId) {
      if (isPatchA) {
        loopWarning = '⚠️ Patch Panel Çapraz Aktarma: Aynı panel üzerinde port köprüleme (cross-connect / loopback) yapıldı.';
      } else {
        return {
          allowed: false,
          type: 'loop',
          reason: 'Fiziksel Döngü Engellendi! Aynı aktif cihazın (Switch/Router) iki portu birbirine bağlanamaz (Loop / STP koruması).'
        };
      }
    }

    const portA = catA?.ports?.find(p => p.id === source.portId);
    const portB = catB?.ports?.find(p => p.id === target.portId);

    const typeA = String(portA?.type || 'rj45').toLowerCase();
    const typeB = String(portB?.type || 'rj45').toLowerCase();

    // 3. POWER ISOLATION: PDU AC power ports cannot connect to network ports
    if (typeA === 'power' || typeB === 'power') {
      if (typeA !== typeB) {
        return {
          allowed: false,
          type: 'media-mismatch',
          reason: 'PDU 230V Güç prizine ağ (Ethernet/Fiber) kablosu bağlanamaz! (Elektriksel İzolasyon)'
        };
      }
    }

    // 4. PHYSICAL MEDIA COMPATIBILITY (In Strict Compliance Mode)
    if (strictMode) {
      const isFiberA = typeA === 'lc' || typeA === 'sc' || typeA === 'fiber';
      const isFiberB = typeB === 'lc' || typeB === 'sc' || typeB === 'fiber';
      const isSfpA = isSfpCageType(typeA);
      const isSfpB = isSfpCageType(typeB);
      const isCopperA = typeA === 'rj45';
      const isCopperB = typeB === 'rj45';

      // Direct copper RJ45 to optical LC/SC connector mismatch
      if ((isCopperA && isFiberB) || (isFiberA && isCopperB)) {
        return {
          allowed: false,
          type: 'media-mismatch',
          reason: `Fiziksel Konnektör Uyuşmazlığı! Bakır ${typeA.toUpperCase()} portu ile Optik ${typeB.toUpperCase()} portu doğrudan bağlanamaz (Medya Dönüştürücü / SFP gerekir).`
        };
      }

      // Direct copper RJ45 to optical SFP cage mismatch without copper transceiver
      if ((isCopperA && isSfpB) || (isSfpA && isCopperB)) {
        return {
          allowed: false,
          type: 'media-mismatch',
          reason: `Fiziksel Konnektör Uyuşmazlığı! Bakır RJ45 kablosu doğrudan SFP yuvasına takılamaz (1000BASE-T SFP Bakır Transceiver gerekir).`
        };
      }
    }

    // Inter-panel pass-through warning between two different patch panels
    // Connecting two distinct patch panels or fiber ODFs is standard structured cabling cross-connect.
    let passThroughWarning = null;
    if (isPatchA && isPatchB && source.instanceId !== target.instanceId) {
      passThroughWarning = "Patch Panel Ara Bağlantı (Cross-Connect): İki pasif panel arası köprü bağlantısı yapılıyor.";
    }

    // 5. AUTOMATIC UPLINK & FIBER RECOGNITION
    const fiberConfig = detectFiberConnection(devA, portA, devB, portB);
    const uplinkConfig = detectUplinkConnection(devA, portA, devB, portB);

    return {
      allowed: true,
      warning: loopWarning || passThroughWarning || null,
      autoConfig: fiberConfig || uplinkConfig,
      fiberConfig: fiberConfig
    };
  }

  // Export functions to global namespace
  RS.NetworkRules = {
    isPassivePatchPanel,
    isSfpCageType,
    isUplinkPort,
    isFiberPort,
    isFiberConnection,
    detectFiberConnection,
    detectUplinkConnection,
    validateConnection
  };
  window.NetworkRules = RS.NetworkRules;
})();