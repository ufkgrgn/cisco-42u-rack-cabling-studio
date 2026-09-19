import { sfx } from './audio.js';
import { 
  CABLE_COLORS, 
  U_HEIGHT, 
  RAIL_WIDTH 
} from './catalog3d.js';

export function registerCableMeshMethods(Studio3D) {
  Studio3D.prototype.connectPorts = function(from, to, colorHex, customName, customNote) {
    if (from.devId === to.devId && from.portIdx === to.portIdx) return false;

    const existing = this.state.cables.find(
      c => (c.from.devId === from.devId && c.from.portIdx === from.portIdx) ||
           (c.to.devId === from.devId && c.to.portIdx === from.portIdx) ||
           (c.from.devId === to.devId && c.from.portIdx === to.portIdx) ||
           (c.to.devId === to.devId && c.to.portIdx === to.portIdx)
    );

    if (existing) {
      alert('Bu portta zaten takılı bir kablo bulunmaktadır!');
      return false;
    }

    const pA = this.getPortWorldPosition(from.devId, from.portIdx);
    const pB = this.getPortWorldPosition(to.devId, to.portIdx);
    if (!pA || !pB) return false;

    const dist = pA.distanceTo(pB);
    const lengthM = parseFloat((dist * 0.44 + 0.5).toFixed(2));

    const devFrom = this.state.devices.find(d => d.id === from.devId);
    const devTo = this.state.devices.find(d => d.id === to.devId);
    const defaultRackId = (this.state.racks[0] && this.state.racks[0].id) || 'rack-1';
    from.rackId = from.rackId || (devFrom && devFrom.rackId) || defaultRackId;
    to.rackId = to.rackId || (devTo && devTo.rackId) || defaultRackId;
    const nameFrom = devFrom ? devFrom.name.split(' ')[1] || 'Cihaz' : 'D1';
    const nameTo = devTo ? devTo.name.split(' ')[1] || 'Cihaz' : 'D2';

    const portCfgFrom = (devFrom && devFrom.portsConfig && (devFrom.portsConfig[from.portIdx] || devFrom.portsConfig['p' + from.portIdx])) || null;
    const portCfgTo = (devTo && devTo.portsConfig && (devTo.portsConfig[to.portIdx] || devTo.portsConfig['p' + to.portIdx])) || null;

    const isFromConfigured = Boolean(portCfgFrom && (portCfgFrom.color || portCfgFrom.role || portCfgFrom.isTrunk || portCfgFrom.vlan));
    const isToConfigured = Boolean(portCfgTo && (portCfgTo.color || portCfgTo.role || portCfgTo.isTrunk || portCfgTo.vlan));

    let masterCfg = null;
    if (isFromConfigured && !isToConfigured) {
      masterCfg = portCfgFrom;
      if (devTo) {
        this.updatePortConfig(to.devId, to.portIdx, {
          role: portCfgFrom.role || (portCfgFrom.isTrunk ? 'trunk' : 'access'),
          isTrunk: !!portCfgFrom.isTrunk,
          poeState: portCfgFrom.poeState || 'auto',
          color: portCfgFrom.color,
          vlan: portCfgFrom.vlan || '',
          description: portCfgFrom.description || '',
          ciscoName: portCfgFrom.ciscoName || '',
          autoCableColor: portCfgFrom.autoCableColor !== false
        });
      }
    } else if (!isFromConfigured && isToConfigured) {
      masterCfg = portCfgTo;
      if (devFrom) {
        this.updatePortConfig(from.devId, from.portIdx, {
          role: portCfgTo.role || (portCfgTo.isTrunk ? 'trunk' : 'access'),
          isTrunk: !!portCfgTo.isTrunk,
          poeState: portCfgTo.poeState || 'auto',
          color: portCfgTo.color,
          vlan: portCfgTo.vlan || '',
          description: portCfgTo.description || '',
          ciscoName: portCfgTo.ciscoName || '',
          autoCableColor: portCfgTo.autoCableColor !== false
        });
      }
    } else if (isFromConfigured && isToConfigured) {
      masterCfg = portCfgFrom;
    }

    const effectiveRole = masterCfg ? (masterCfg.role || (masterCfg.isTrunk ? 'trunk' : 'access')) : 'standard';
    const isTrunk = effectiveRole === 'trunk' || effectiveRole === 'uplink' || effectiveRole === 'trunk-ap' || Boolean(masterCfg && masterCfg.isTrunk);

    let rolePrefix = '';
    if (effectiveRole === 'trunk') rolePrefix = '[TRUNK] ';
    else if (effectiveRole === 'uplink') rolePrefix = '[UPLINK] ';
    else if (effectiveRole === 'trunk-ap') rolePrefix = '[AP-TRUNK] ';
    else if (effectiveRole === 'routed') rolePrefix = '[ROUTED] ';
    else if (effectiveRole === 'poe') rolePrefix = '[POE] ';
    else if (effectiveRole === 'mgmt' || effectiveRole === 'management') rolePrefix = '[MGMT] ';
    else if (isTrunk) rolePrefix = '[TRUNK] ';

    const cableId = 'cbl-' + Math.random().toString(36).substr(2, 9);
    const fromLabel = (portCfgFrom && portCfgFrom.ciscoName) || `${nameFrom}:P${from.portIdx}`;
    const toLabel = (portCfgTo && portCfgTo.ciscoName) || `${nameTo}:P${to.portIdx}`;
    const defaultName = `${rolePrefix}${fromLabel} ➔ ${toLabel}`;
    const defaultNote = (masterCfg && (masterCfg.description || masterCfg.note)) || '';

    const cableColor = colorHex || (masterCfg && masterCfg.autoCableColor !== false && masterCfg.color) || CABLE_COLORS[this.state.cableColorIdx].hex;

    const cableData = {
      id: cableId,
      name: customName || defaultName,
      note: customNote !== undefined ? customNote : defaultNote,
      from: from,
      to: to,
      color: cableColor,
      lengthM: lengthM
    };

    this.state.cables.push(cableData);
    this.buildCable3D(cableData);
    this.state.pushSnapshot();
    sfx.plug();
    return cableData;
  };

  Studio3D.prototype.updatePortConfig = function(devId, portIdx, config) {
    const dev = this.state.devices.find(d => d.id === devId);
    if (!dev) return false;
    if (!dev.portsConfig) dev.portsConfig = {};
    const numIdx = typeof portIdx === 'number' ? portIdx : (parseInt(portIdx, 10) || 1);
    if (!config || (config.role === 'access' && !config.ciscoName && !config.vlan && !config.description)) {
      delete dev.portsConfig[numIdx];
      delete dev.portsConfig['p' + numIdx];
    } else {
      dev.portsConfig[numIdx] = {
        role: config.role || 'trunk',
        isTrunk: config.role === 'trunk' || config.isTrunk === true,
        color: config.color || '#a855f7',
        ciscoName: config.ciscoName || '',
        vlan: config.vlan || '',
        description: config.description || config.note || '',
        autoCableColor: config.autoCableColor !== false
      };
    }
    this.rebuildAllDevices();
    this.state.pushSnapshot();
    this.showToast(`Port #${numIdx} Yapılandırması Kaydedildi`);
    return true;
  };

  Studio3D.prototype.updateCable = function(cableId, data) {
    const cable = this.state.cables.find(c => c.id === cableId);
    if (!cable) return false;

    if (data.name !== undefined) cable.name = data.name.trim() || cable.name;
    if (data.note !== undefined) cable.note = data.note.trim();
    if (data.color !== undefined) cable.color = data.color;

    this.rebuildAllCables();
    this.state.pushSnapshot();
    this.showToast(`Kablo Güncellendi: "${cable.name}"`);
    return true;
  };

  Studio3D.prototype.removeCable = function(cableId) {
    this.state.cables = this.state.cables.filter(c => c.id !== cableId);
    this.rebuildAllCables();
    this.state.pushSnapshot();
    sfx.delete();
  };

  Studio3D.prototype.buildCable3D = function(cable) {
    const pA = this.getPortWorldPosition(cable.from.devId, cable.from.portIdx);
    const pB = this.getPortWorldPosition(cable.to.devId, cable.to.portIdx);
    if (!pA || !pB) return;

    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.15 });
    const bootGeo = new THREE.BoxGeometry(0.065, 0.055, 0.12);

    const bootA = new THREE.Mesh(bootGeo, bootMat);
    bootA.position.copy(pA).add(new THREE.Vector3(0, 0, 0.06));
    this.cablesGroup.add(bootA);

    const bootB = new THREE.Mesh(bootGeo, bootMat);
    bootB.position.copy(pB).add(new THREE.Vector3(0, 0, 0.06));
    this.cablesGroup.add(bootB);

    const portIdxHash = (cable.from.portIdx || 1) * 7 + (cable.to.portIdx || 1) * 3;
    const zStagger = ((portIdxHash % 7) - 3) * 0.035;
    const sagStagger = ((portIdxHash % 5) - 2) * 0.02;

    const dy = Math.abs(pA.y - pB.y);
    const isNearU = dy <= U_HEIGHT * 2.2;
    const organizers = this.state.devices.filter(dev =>
      ['organizer', 'accessory'].includes(dev.category) || /organizer|cable-manager|dring/i.test(dev.catalogId || '')
    );
    const findOrganizerDirectlyBelow = device => device && organizers.find(org =>
      Number(org.startU) + Number(org.uHeight || 1) === Number(device.startU)
    );
    const organizerCenterY = organizer => organizer
      ? (organizer.startU - 1) * U_HEIGHT + (organizer.uHeight * U_HEIGHT) / 2 + 0.3
      : null;
    const devA = this.state.devices.find(dev => dev.id === cable.from.devId);
    const devB = this.state.devices.find(dev => dev.id === cable.to.devId);
    const organizerYA = organizerCenterY(findOrganizerDirectlyBelow(devA));
    const organizerYB = organizerCenterY(findOrganizerDirectlyBelow(devB));
    const organizerYs = Number.isFinite(organizerYA) && Number.isFinite(organizerYB)
      ? [organizerYA, organizerYB]
      : [];

    const getDevicePortCount = dev => {
      if (!dev) return 24;
      if (Array.isArray(dev.portDefinitions) && dev.portDefinitions.length) return dev.portDefinitions.length;
      if (Number.isFinite(Number(dev.portsCount)) && Number(dev.portsCount) > 0) return Number(dev.portsCount);
      return 24;
    };
    const pCountA = getDevicePortCount(devA);
    const pCountB = getDevicePortCount(devB);
    const portIdxA = cable.from.portIdx || 1;
    const portIdxB = cable.to.portIdx || 1;

    const getPortSideSign = (portIdx, totalPorts) => {
      const mid = Math.ceil(totalPorts / 2);
      return portIdx <= mid ? -1 : 1;
    };
    const sideSignA = getPortSideSign(portIdxA, pCountA);
    const sideSignB = getPortSideSign(portIdxB, pCountB);

    const rackAX = this.getRackX(cable.from.rackId || (devA && devA.rackId));
    const rackBX = this.getRackX(cable.to.rackId || (devB && devB.rackId));

    const getNearestRingX = (px, rackX, sideSign) => {
      const candidates = sideSign < 0 ? [-1.6, -0.8] : [0.8, 1.6];
      let best = rackX + candidates[0];
      let minD = Math.abs(px - best);
      for (let i = 1; i < candidates.length; i++) {
        const cand = rackX + candidates[i];
        const d = Math.abs(px - cand);
        if (d < minD) {
          minD = d;
          best = cand;
        }
      }
      return best;
    };
    const ringXA = getNearestRingX(pA.x, rackAX, sideSignA);
    const ringXB = getNearestRingX(pB.x, rackBX, sideSignB);

    const filletPath = (rawPts, radius = 0.075) => {
      if (rawPts.length <= 2) return rawPts;
      const smoothed = [rawPts[0]];
      for (let i = 1; i < rawPts.length - 1; i++) {
        const pPrev = rawPts[i - 1];
        const pCur = rawPts[i];
        const pNext = rawPts[i + 1];

        const vIn = new THREE.Vector3().subVectors(pPrev, pCur);
        const vOut = new THREE.Vector3().subVectors(pNext, pCur);
        const lenIn = vIn.length();
        const lenOut = vOut.length();

        if (lenIn < 0.005 || lenOut < 0.005) {
          smoothed.push(pCur);
          continue;
        }
        vIn.normalize();
        vOut.normalize();
        const dot = vIn.dot(vOut);

        if (dot < -0.98 || dot > 0.98) {
          smoothed.push(pCur);
          continue;
        }

        const effectiveRadius = Math.min(radius, lenIn * 0.44, lenOut * 0.44);
        const pEntry = new THREE.Vector3().copy(pCur).addScaledVector(vIn, effectiveRadius);
        const pExit = new THREE.Vector3().copy(pCur).addScaledVector(vOut, effectiveRadius);

        const bisector = new THREE.Vector3().addVectors(vIn, vOut).normalize();
        const halfAngle = Math.acos(Math.max(-1, Math.min(1, dot))) / 2;
        const arcMidDist = effectiveRadius * (1 / Math.sin(halfAngle) - 1);
        const pArcMid = new THREE.Vector3().copy(pCur).addScaledVector(bisector, Math.max(0, Math.min(effectiveRadius * 0.42, arcMidDist)));

        smoothed.push(pEntry);
        smoothed.push(pArcMid);
        smoothed.push(pExit);
      }
      smoothed.push(rawPts[rawPts.length - 1]);
      return smoothed;
    };

    const rawPoints = [];
    rawPoints.push(pA.clone());
    const pAOut = pA.clone().add(new THREE.Vector3(0, 0, 0.12));
    rawPoints.push(pAOut);

    const isInterRack = Math.abs(pA.x - pB.x) > 2.5;

    if (isInterRack) {
      const topTrayY = (Math.max(this.state.rackHeightU || 42, 42)) * U_HEIGHT + 0.90;
      const trayZ = 0.0 + ((portIdxHash % 7) - 3) * 0.04;
      const zChannel = Math.max(pA.z, pB.z) + 0.22 + zStagger;
      const sideXA = rackAX + sideSignA * (RAIL_WIDTH / 2 + 0.28);
      const sideXB = rackBX + sideSignB * (RAIL_WIDTH / 2 + 0.28);

      rawPoints.push(new THREE.Vector3(pA.x + sideSignA * 0.2, pA.y - 0.06, zChannel));
      rawPoints.push(new THREE.Vector3(sideXA, pA.y - 0.1, zChannel));
      rawPoints.push(new THREE.Vector3(sideXA, topTrayY - 0.2, zChannel));
      rawPoints.push(new THREE.Vector3(sideXA, topTrayY, trayZ));
      rawPoints.push(new THREE.Vector3(sideXB, topTrayY, trayZ));
      rawPoints.push(new THREE.Vector3(sideXB, topTrayY - 0.2, zChannel));
      rawPoints.push(new THREE.Vector3(sideXB, pB.y - 0.1, zChannel));
      rawPoints.push(new THREE.Vector3(pB.x + sideSignB * 0.2, pB.y - 0.06, zChannel));
    } else if (this.state.cableRoutingMode === 'structured' && organizerYs.length) {
      const ringLaneY = ((portIdxHash % 7) - 3) * 0.016;
      const ringLaneZ = ((portIdxHash % 5) - 2) * 0.018;
      const entryY = organizerYs[0] + ringLaneY;
      const exitY = organizerYs[organizerYs.length - 1] + ringLaneY;

      const sideXA = rackAX + sideSignA * (RAIL_WIDTH / 2 + 0.24 + ((portIdxHash % 6) - 2.5) * 0.025);
      const ringChannelZ = Math.max(pA.z, pB.z) + 0.26 + ringLaneZ;
      const frontTransitionZ = Math.max(pA.z, pB.z) + 0.16;

      const dropSignA = pA.y >= entryY ? 1 : -1;
      rawPoints.push(new THREE.Vector3(pA.x, entryY + dropSignA * 0.08, frontTransitionZ));
      rawPoints.push(new THREE.Vector3(pA.x, entryY, ringChannelZ));
      rawPoints.push(new THREE.Vector3(ringXA, entryY, ringChannelZ));
      rawPoints.push(new THREE.Vector3(sideXA, entryY, ringChannelZ));

      if (Math.abs(entryY - exitY) > 0.05) {
        rawPoints.push(new THREE.Vector3(sideXA, exitY, ringChannelZ));
      }

      rawPoints.push(new THREE.Vector3(ringXB, exitY, ringChannelZ));
      rawPoints.push(new THREE.Vector3(pB.x, exitY, ringChannelZ));

      const dropSignB = pB.y >= exitY ? 1 : -1;
      rawPoints.push(new THREE.Vector3(pB.x, exitY + dropSignB * 0.08, frontTransitionZ));
    } else if (isNearU) {
      const midX = (pA.x + pB.x) / 2;
      const midY = Math.min(pA.y, pB.y);
      const naturalSag = Math.min(0.24, 0.08 + dy * 0.15) + sagStagger;
      const forwardClearance = Math.max(pA.z, pB.z) + 0.16 + zStagger;

      rawPoints.push(new THREE.Vector3(pA.x + (midX - pA.x) * 0.3, pA.y - naturalSag * 0.6, forwardClearance));
      rawPoints.push(new THREE.Vector3(midX, midY - naturalSag, forwardClearance + 0.02));
      rawPoints.push(new THREE.Vector3(pB.x + (midX - pB.x) * 0.3, pB.y - naturalSag * 0.6, forwardClearance));
    } else if (this.state.cableRoutingMode === 'structured') {
      const chosenSide = sideSignA;
      const sideX = rackAX + chosenSide * (RAIL_WIDTH / 2 + 0.22 + ((portIdxHash % 6) - 2.5) * 0.03);
      const zChannel = Math.max(pA.z, pB.z) + 0.20 + zStagger;
      const midY = (pA.y + pB.y) / 2;

      rawPoints.push(new THREE.Vector3(sideX - chosenSide * 0.2, pA.y - 0.08, zChannel));
      rawPoints.push(new THREE.Vector3(sideX, pA.y - 0.15, zChannel));
      rawPoints.push(new THREE.Vector3(sideX, midY, zChannel + 0.02));
      rawPoints.push(new THREE.Vector3(sideX, pB.y - 0.15, zChannel));
      rawPoints.push(new THREE.Vector3(sideX - chosenSide * 0.2, pB.y - 0.08, zChannel));
    } else {
      const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
      const sag = Math.min(1.2, dy * 0.22 + 0.2) + sagStagger;
      const forwardClearance = Math.max(pA.z, pB.z) + 0.22 + zStagger;
      rawPoints.push(new THREE.Vector3(mid.x, mid.y - sag, forwardClearance));
    }

    const pBOut = pB.clone().add(new THREE.Vector3(0, 0, 0.12));
    rawPoints.push(pBOut);
    rawPoints.push(pB.clone());

    const points = filletPath(rawPoints, 0.075);
    const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
    const curveLen = curve.getLength();
    const calcMeters = parseFloat((curveLen * 0.44 + 0.5).toFixed(2));
    if (!cable.lengthM || isInterRack) {
      cable.lengthM = calcMeters;
    }
    
    const tubularSegments = Math.max(48, Math.min(128, Math.round(curveLen * 32)));
    const tubeGeo = new THREE.TubeGeometry(curve, tubularSegments, 0.024, 12, false);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: cable.color,
      roughness: 0.58,
      metalness: 0.12,
      emissive: cable.color,
      emissiveIntensity: 0.05
    });

    const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
    tubeMesh.name = cable.id;
    tubeMesh.castShadow = true;
    tubeMesh.userData = {
      isCable: true,
      cableId: cable.id,
      cableName: cable.name || 'Kablo',
      cableNote: cable.note || '',
      lengthM: cable.lengthM,
      endpointLabel: this.getCableEndpointLabel(cable)
    };

    this.cablesGroup.add(tubeMesh);
  };

  Studio3D.prototype.getCableEndpointLabel = function(cable) {
    const describe = endpoint => {
      const dev = this.state.devices.find(item => item.id === endpoint.devId);
      const port = dev && Array.isArray(dev.portDefinitions) ? dev.portDefinitions[(endpoint.portIdx || 1) - 1] : null;
      const deviceName = (dev && dev.name) || 'Cihaz';
      const fallbackPortName = dev && dev.category === 'switch'
        ? `Gi1/0/${endpoint.portIdx || '?'}`
        : dev && ['patch-panel', 'patch', 'fiber'].includes(dev.category)
          ? `Panel-${String(endpoint.portIdx || '?').padStart(2, '0')}`
          : `Port ${endpoint.portIdx || '?'}`;
      const portName = (port && (port.name || port.id)) || endpoint.portId || fallbackPortName;
      return `${deviceName} / ${portName}`;
    };
    return `${describe(cable.from)} → ${describe(cable.to)}`;
  };

  Studio3D.prototype.rebuildAllCables = function() {
    while (this.cablesGroup.children.length > 0) {
      this.cablesGroup.remove(this.cablesGroup.children[0]);
    }
    this.state.cables.forEach(c => this.buildCable3D(c));
  };
}
