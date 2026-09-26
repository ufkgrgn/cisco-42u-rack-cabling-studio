import { sfx } from './audio.js';
import { 
  escapeTooltipHtml, 
  getDeviceVisualKind, 
  getDevicePortLayout,
  inferSwitchUplinks,
  disposeObject3D
} from './helpers.js';
import { 
  CATALOG, 
  U_HEIGHT, 
  RACK_WIDTH, 
  RACK_DEPTH, 
  RAIL_WIDTH 
} from './catalog3d.js';
import { createFaceplateTexture } from './textures.js';

export function registerDeviceMeshMethods(Studio3D) {
  Studio3D.prototype.findNextAvailableSlot = function(uHeight, targetRackId) {
    const rackId = targetRackId || this.state.activeRackId || (this.state.racks[0] && this.state.racks[0].id) || 'rack-1';
    const rack = this.getRack(rackId);
    const rackMaxU = rack.heightU || this.state.rackHeightU || 42;
    const rackDevices = this.state.devices.filter(d => (d.rackId || (this.state.racks[0] && this.state.racks[0].id) || 'rack-1') === rackId);

    for (let u = 1; u <= rackMaxU - uHeight + 1; u++) {
      const uEnd = u + uHeight - 1;
      const collision = rackDevices.find(d => {
        const dEnd = d.startU + d.uHeight - 1;
        return !(uEnd < d.startU || u > dEnd);
      });
      if (!collision) return u;
    }
    return null;
  };

  Studio3D.prototype.mountDevice = function(catalogId, targetU, targetRackId, options = {}) {
    const cat3D = (window.CATALOG_3D || CATALOG).find(c => c.id === catalogId);
    const cat2D = window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[catalogId];
    const item = cat3D || cat2D;
    if (!item) return false;

    const rackId = targetRackId || this.state.activeRackId || (this.state.racks[0] && this.state.racks[0].id) || 'rack-1';
    const rack = this.getRack(rackId);
    const rackMaxU = rack.heightU || this.state.rackHeightU || 42;
    const rackDevices = this.state.devices.filter(d => (d.rackId || (this.state.racks[0] && this.state.racks[0].id) || 'rack-1') === rackId);

    const uHeight = item.u || item.uHeight || 1;
    targetU = parseInt(targetU);

    const isOccupied = (u) => {
      if (!u || u < 1 || u + uHeight - 1 > rackMaxU) return true;
      const targetEnd = u + uHeight - 1;
      return !!rackDevices.find(d => {
        const dEnd = d.startU + d.uHeight - 1;
        return !(targetEnd < d.startU || u > dEnd);
      });
    };

    if (!targetU || isOccupied(targetU)) {
      const freeSlot = this.findNextAvailableSlot(uHeight, rackId);
      if (!freeSlot) {
        alert(`"${rack.name}" kabini dolu! Bu cihaz için (${uHeight}U) boş yer bulunamadı.`);
        return false;
      }
      if (targetU && targetU !== freeSlot) {
        this.showToast(`U${targetU} dolu olduğundan ilk boş pozisyon olan U${freeSlot} kullanıldı.`);
      }
      targetU = freeSlot;
    }

    const instanceId = 'dev-' + Math.random().toString(36).substr(2, 9);
    const portDefinitions = Array.isArray(item.ports) ? item.ports.map(port => ({
      id: port.id,
      name: port.name,
      type: port.type || 'rj45',
      group: port.group,
      row: port.row
    })) : [];

    const powerWatts = typeof item.powerWatts === 'number' ? item.powerWatts : (['organizer', 'accessory', 'blank', 'patch', 'fiber'].includes(item.category) ? 0 : 150);
    const heatBtu = typeof item.heatBtu === 'number' ? item.heatBtu : Math.round(powerWatts * 3.412142);

    const devData = {
      id: instanceId,
      rackId: rackId,
      catalogId: item.id || catalogId,
      name: item.name,
      hostname: item.name,
      ipAddress: '',
      macAddress: '',
      serialNumber: '',
      panelLabel: '',
      manufacturer: item.manufacturer || item.logo || (item.category === 'patch' || item.category === 'fiber' ? 'Panel' : 'Cisco'),
      category: item.category || 'switch',
      startU: targetU,
      uHeight: uHeight,
      depthMm: item.depthMm || 450,
      color: item.color || 0x243248,
      portsCount: portDefinitions.length || (Number.isFinite(Number(item.portsCount)) ? Number(item.portsCount) :
        (['organizer', 'accessory', 'blank'].includes(item.category) ? 0 : 24)),
      portType: item.portType || (portDefinitions[0] && portDefinitions[0].type) || 'rj45',
      portDefinitions,
      uplinks: inferSwitchUplinks(item),
      faceplateStyle: item.faceplateStyle || '',
      powerWatts: powerWatts,
      heatBtu: heatBtu
    };

    this.state.devices.push(devData);
    this.buildDevice3D(devData);
    this.state.pushSnapshot();
    this.state.autoSave();
    if (!options?.silent) {
      sfx.insert();
    }
    if (typeof window.renderInstalledDevicesList === 'function') {
      window.renderInstalledDevicesList();
    }
    const countEl = document.getElementById('installed-count');
    if (countEl) countEl.textContent = String(this.state.devices.length);
    if (typeof window.sync3Dto2D === 'function') {
      try { window.sync3Dto2D(); } catch (_) {}
    }
    return devData;
  };

  Studio3D.prototype.removeDevice = function(instanceId) {
    this.state.cables = this.state.cables.filter(c => c.from.devId !== instanceId && c.to.devId !== instanceId);
    this.state.devices = this.state.devices.filter(d => d.id !== instanceId);
    this.rebuildAllDevices();
    this.rebuildAllCables();
    this.state.pushSnapshot();
    this.state.autoSave();
    sfx.delete();
    if (this.selectedDeviceId === instanceId) {
      this.deselectDevice();
    }
    if (typeof window.renderInstalledDevicesList === 'function') {
      window.renderInstalledDevicesList();
    }
    const countEl = document.getElementById('installed-count');
    if (countEl) countEl.textContent = String(this.state.devices.length);
    if (typeof window.sync3Dto2D === 'function') {
      try { window.sync3Dto2D(); } catch (_) {}
    }
  };

  Studio3D.prototype.moveDevice = function(instanceId, deltaU) {
    const dev = this.state.devices.find(d => d.id === instanceId);
    if (!dev) return false;

    const newU = dev.startU + deltaU;
    if (newU < 1 || newU + dev.uHeight - 1 > this.state.rackHeightU) {
      this.showToast('Cihaz kabin sınırlarının dışına taşınamaz!');
      return false;
    }

    const collision = this.state.devices.find(d => {
      if (d.id === instanceId) return false;
      const dEnd = d.startU + d.uHeight - 1;
      const newEnd = newU + dev.uHeight - 1;
      return !(newEnd < d.startU || newU > dEnd);
    });

    if (collision) {
      this.showToast(`Taşınamaz: U${newU} pozisyonunda "${collision.name}" var!`);
      return false;
    }

    dev.startU = newU;
    this.rebuildAllDevices();
    if (this.scene && typeof this.scene.updateMatrixWorld === 'function') {
      this.scene.updateMatrixWorld(true);
    }
    this.rebuildAllCables();
    this.state.pushSnapshot();
    this.state.autoSave();
    sfx.insert();
    if (typeof window.sync3Dto2D === 'function') {
      try { window.sync3Dto2D(); } catch (_) {}
    }
    if (typeof window.renderInstalledDevicesList === 'function') {
      window.renderInstalledDevicesList();
    }
    this.showToast(`${dev.name} U${newU} pozisyonuna taşındı.`);
    return true;
  };

  Studio3D.prototype.selectDevice = function(instanceId) {
    if (this._selectionOutline) {
      if (this._selectionOutline.parent) this._selectionOutline.parent.remove(this._selectionOutline);
      disposeObject3D(this._selectionOutline);
      this._selectionOutline = null;
    }

    this.selectedDeviceId = instanceId;
    const dev = this.state.devices.find(d => d.id === instanceId);
    if (!dev) return;

    // Attach high-contrast sleek bounding box outline
    const devGroup = this.devicesGroup?.getObjectByName(instanceId);
    if (devGroup) {
      const chassisMesh = devGroup.children.find(c => c.userData?.isDeviceBody && c.geometry?.parameters);
      if (chassisMesh) {
        const p = chassisMesh.geometry.parameters;
        const boxGeo = new THREE.BoxGeometry(p.width + 0.08, p.height + 0.04, p.depth + 0.08);
        const edges = new THREE.EdgesGeometry(boxGeo);
        const lineMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2, transparent: true, opacity: 0.85 });
        const outline = new THREE.LineSegments(edges, lineMat);
        outline.position.copy(chassisMesh.position);
        outline.name = '__selection_outline__';
        devGroup.add(outline);
        this._selectionOutline = outline;
      }
    }

    const hud = document.getElementById('floating-device-hud');
    if (hud) {
      hud.style.display = 'flex';
      const nameEl = document.getElementById('floating-dev-name');
      const posEl = document.getElementById('floating-dev-pos');
      if (nameEl) nameEl.textContent = dev.name;
      if (posEl) posEl.textContent = `U${dev.startU}` + (dev.uHeight > 1 ? ` - U${dev.startU + dev.uHeight - 1}` : '') + ` (${dev.uHeight}U)`;
    }

    document.querySelectorAll('.installed-device-card').forEach(card => {
      card.classList.toggle('active', card.dataset.devId === instanceId);
    });
  };

  Studio3D.prototype.deselectDevice = function() {
    if (this._selectionOutline) {
      if (this._selectionOutline.parent) this._selectionOutline.parent.remove(this._selectionOutline);
      disposeObject3D(this._selectionOutline);
      this._selectionOutline = null;
    }

    this.selectedDeviceId = null;
    const hud = document.getElementById('floating-device-hud');
    if (hud) hud.style.display = 'none';
    document.querySelectorAll('.installed-device-card').forEach(card => {
      card.classList.remove('active');
    });
  };

  Studio3D.prototype.focusDevice = function(instanceId) {
    const dev = this.state.devices.find(d => d.id === instanceId);
    if (!dev) return;
    const rackX = this.getRackX(dev.rackId);
    const targetY = (dev.startU - 1) * U_HEIGHT + (dev.uHeight * U_HEIGHT) / 2 + 0.3;
    if (this.controls) {
      this.controls.target.set(rackX, targetY, 0);
      this.camera.position.set(rackX + 3.2, targetY + 0.8, 6.2);
      this.controls.update();
    }
    this.selectDevice(instanceId);
    this.showToast(`🔍 ${dev.name} (U${dev.startU}) odaklandı`);
  };

  Studio3D.prototype.loadTopologyFromProject = function(projectData) {
    if (!projectData) return;
    const rawRacks = (Array.isArray(projectData.racks) && projectData.racks.length > 0)
      ? projectData.racks
      : (projectData.heightU ? [projectData] : [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: 42 }]);

    if (typeof projectData.doorOpen === 'boolean') this.state.doorOpen = projectData.doorOpen;
    else if (typeof rawRacks[0].doorOpen === 'boolean') this.state.doorOpen = rawRacks[0].doorOpen;

    this.state.racks = rawRacks.map(r => ({
      id: r.id || 'rack-1',
      name: r.name || 'MDF - Dağıtım Kabini',
      heightU: r.heightU || 42
    }));

    this.state.activeRackId = projectData.activeRackId || this.state.racks[0].id;
    this.state.rackHeightU = this.state.racks[0].heightU || 42;

    const loadedDevices = [];
    rawRacks.forEach(r => {
      const rackId = r.id || 'rack-1';
      (r.devices || []).forEach(d => {
        const catId = d.catalogKey || d.catalogId;
        const catResolver = (window.RackStudio && window.RackStudio.resolveCatalogItem) ? window.RackStudio.resolveCatalogItem(catId) : null;
        const cat3D = (window.CATALOG_3D || []).find(c => c.id === catId);
        const cat2D = window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[catId];
        const catMaster = Array.isArray(window.CISCO_MASTER_CATALOG) ? window.CISCO_MASTER_CATALOG.find(m => m.id === catId) : null;
        const cat = catResolver || cat3D || cat2D || catMaster || {};
        const portDefinitions = Array.isArray(cat.ports) ? cat.ports.map(port => ({
          id: port.id,
          name: port.name,
          type: port.type || 'rj45',
          group: port.group,
          row: port.row
        })) : [];
        const uH = d.uHeight || cat.u || 1;
        const startU = d.startU !== undefined ? d.startU : (d.topU !== undefined ? d.topU - uH + 1 : 1);
        const powerWatts = typeof cat.powerWatts === 'number' ? cat.powerWatts : (['organizer', 'accessory', 'blank', 'patch', 'fiber'].includes(cat.category) ? 0 : 150);
        const heatBtu = typeof cat.heatBtu === 'number' ? cat.heatBtu : Math.round(powerWatts * 3.412142);

        loadedDevices.push({
          id: d.instanceId || d.id || ('dev-' + Math.random().toString(36).substr(2, 9)),
          rackId: d.rackId || rackId,
          catalogId: catId,
          name: d.name || cat.name || 'Donanım',
          hostname: d.hostname || d.name || cat.name || 'Donanım',
          ipAddress: d.ipAddress || '',
          macAddress: d.macAddress || '',
          serialNumber: d.serialNumber || '',
          panelLabel: d.panelLabel || '',
          manufacturer: cat.manufacturer || cat.logo || (cat.category === 'patch' || cat.category === 'fiber' ? 'Panel' : 'Cisco'),
          category: cat.category || 'switch',
          startU: Math.max(1, startU),
          uHeight: uH,
          depthMm: cat.depthMm || 450,
          color: cat.color || 0x243248,
          portsCount: portDefinitions.length || (Number.isFinite(Number(cat.portsCount)) ? Number(cat.portsCount) :
            (['organizer', 'accessory', 'blank'].includes(cat.category) ? 0 : 24)),
          portType: cat.portType || (portDefinitions[0] && portDefinitions[0].type) || 'rj45',
          portDefinitions,
          uplinks: inferSwitchUplinks(cat),
          faceplateStyle: cat.faceplateStyle || '',
          powerWatts: powerWatts,
          heatBtu: heatBtu,
          portsConfig: d.portsConfig ? JSON.parse(JSON.stringify(d.portsConfig)) : {}
        });
      });
    });
    this.state.devices = loadedDevices;

    const resolvePortIndex = (endpoint, devId) => {
      const device = this.state.devices.find(d => d.id === devId);
      if (!device) return 1;
      const catResolver = (window.RackStudio && window.RackStudio.resolveCatalogItem) ? window.RackStudio.resolveCatalogItem(device.catalogId) : null;
      const catalog = catResolver ||
        (window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[device.catalogId]) ||
        (window.CATALOG_3D || []).find(item => item.id === device.catalogId) || {};
      const ports = (device.portDefinitions && device.portDefinitions.length)
        ? device.portDefinitions
        : (catalog.ports || []);

      if (endpoint && endpoint.portId) {
        const byId = ports.findIndex(port => port.id === endpoint.portId);
        if (byId >= 0) return byId + 1;
        const byName = ports.findIndex(port => port.name === endpoint.portId || port.id === endpoint.portId.toLowerCase());
        if (byName >= 0) return byName + 1;
        if (/^p\d+$/i.test(endpoint.portId)) {
          const num = parseInt(endpoint.portId.slice(1), 10);
          if (num >= 1 && (!ports.length || num <= ports.length)) return num;
        }
      }
      const saved = Number(endpoint && endpoint.portIdx);
      if (Number.isInteger(saved) && saved >= 1 && (!ports.length || saved <= ports.length)) return saved;
      return 1;
    };

    this.state.cables = (projectData.cables || []).map(c => {
      const fromDev = (c.from && (c.from.instanceId || c.from.deviceId || c.from.devId)) || '';
      const toDev = (c.to && (c.to.instanceId || c.to.deviceId || c.to.devId)) || '';
      const devFromObj = this.state.devices.find(d => d.id === fromDev);
      const devToObj = this.state.devices.find(d => d.id === toDev);
      const fromP = resolvePortIndex(c.from, fromDev);
      const toP = resolvePortIndex(c.to, toDev);
      const fromRack = (c.from && c.from.rackId) || (devFromObj && devFromObj.rackId) || this.state.racks[0].id;
      const toRack = (c.to && c.to.rackId) || (devToObj && devToObj.rackId) || this.state.racks[0].id;

      return {
        id: c.id || ('cbl-' + Math.random().toString(36).substr(2, 9)),
        name: c.name || 'Kablo',
        note: c.note || '',
        role: c.role || '',
        ductSide: c.ductSide || 'auto',
        color: typeof c.color === 'number' ? c.color : (parseInt((c.color || '#00d2ff').replace('#', ''), 16) || 0x00d2ff),
        lengthM: c.lengthMeters || c.lengthM || 1.5,
        from: { rackId: fromRack, devId: fromDev, portIdx: fromP || 1, portId: (c.from && c.from.portId) || undefined },
        to: { rackId: toRack, devId: toDev, portIdx: toP || 1, portId: (c.to && c.to.portId) || undefined }
      };
    });

    this.buildRack(this.state.rackHeightU);
    this.rebuildAllDevices();
    this.rebuildAllCables();
    this.state.pushSnapshot();
    this.state.autoSave();
    if (typeof window.renderInstalledDevicesList === 'function') {
      window.renderInstalledDevicesList();
    }
    const countEl = document.getElementById('installed-count');
    if (countEl) countEl.textContent = String(this.state.devices.length);
  };

  Studio3D.prototype.buildDevice3D = function(dev) {
    const devGroup = new THREE.Group();
    devGroup.name = dev.id;

    const rackX = this.getRackX(dev.rackId);
    const h = dev.uHeight * U_HEIGHT - 0.03;
    const w = RAIL_WIDTH - 0.08;
    const d = Math.max(2.2, (dev.depthMm / 1000) * 8.0);
    const yPos = (dev.startU - 1) * U_HEIGHT + (dev.uHeight * U_HEIGHT) / 2 + 0.3;
    const zFront = RACK_DEPTH / 2 - 0.8;
    const zPos = zFront - d / 2;

    // 1. Galvanized Sheet Steel Main Chassis Box
    const visualKind = getDeviceVisualKind(dev);
    const chassisColors = { switch: 0x26384f, 'patch-panel': 0x18130b, 'fiber-panel': 0x111827 };
    const chassisMat = new THREE.MeshStandardMaterial({
      color: chassisColors[visualKind] || dev.color || 0x243248,
      metalness: 0.85,
      roughness: 0.25
    });
    const chassisGeo = new THREE.BoxGeometry(w, h, d);
    const chassisMesh = new THREE.Mesh(chassisGeo, chassisMat);
    chassisMesh.castShadow = true;
    chassisMesh.receiveShadow = true;
    chassisMesh.userData = { isDeviceBody: true, devId: dev.id, devName: dev.name };
    devGroup.add(chassisMesh);

    // 2. Brushed Aluminum 19" Mounting Ears (Flanges)
    const earMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.92, roughness: 0.2 });
    const earGeo = new THREE.BoxGeometry(0.24, h, 0.08);
    const leftEar = new THREE.Mesh(earGeo, earMat);
    leftEar.position.set(-w / 2 - 0.12, 0, d / 2);
    devGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeo, earMat);
    rightEar.position.set(w / 2 + 0.12, 0, d / 2);
    devGroup.add(rightEar);

    // Chrome Oval Mounting Screws
    const screwGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.06, 12);
    const screwMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.98, roughness: 0.05 });
    [-w / 2 - 0.12, w / 2 + 0.12].forEach(ex => {
      [-h / 3, h / 3].forEach(sy => {
        const s = new THREE.Mesh(screwGeo, screwMat);
        s.rotation.x = Math.PI / 2;
        s.position.set(ex, sy, d / 2 + 0.045);
        devGroup.add(s);
      });
    });

    // 3. High-Definition Procedural Front Faceplate
    const faceTex = createFaceplateTexture(dev);
    const faceMat = new THREE.MeshStandardMaterial({
      map: faceTex,
      roughness: 0.35,
      metalness: 0.7
    });
    const faceGeo = new THREE.BoxGeometry(w - 0.06, h - 0.02, 0.03);
    const face = new THREE.Mesh(faceGeo, faceMat);
    face.position.set(0, 0, d / 2 + 0.015);
    face.userData = { isDeviceBody: true, devId: dev.id, devName: dev.name };
    devGroup.add(face);

    // 4. Dynamic Blinking LEDs
    const isPassive = ['blank', 'accessory', 'organizer', 'patch-panel', 'patch', 'fiber'].includes(dev.category) ||
                      (dev.id && (dev.id.includes('blank') || dev.id.includes('organizer') || dev.id.includes('cable-manager')));
    const blocksInteractivePorts = ['blank', 'accessory', 'organizer'].includes(dev.category) ||
      /blank|organizer|cable-manager|dring/i.test(`${dev.catalogId || ''} ${dev.id || ''}`);

    if (!isPassive && (dev.portsCount > 0 || dev.category === 'router' || dev.category === 'switch' || dev.category === 'server')) {
      const numLeds = Math.min(6, dev.portsCount > 0 ? 5 : 2);
      for (let i = 0; i < numLeds; i++) {
        const ledGeo = new THREE.BoxGeometry(0.035, 0.035, 0.025);
        const isPower = i === 0;
        const color = isPower ? 0x00e5ff : 0x22c55e;
        const ledMat = new THREE.MeshStandardMaterial({
          color: color,
          emissive: color,
          emissiveIntensity: 0.9,
          roughness: 0.2
        });
        const ledMesh = new THREE.Mesh(ledGeo, ledMat);
        ledMesh.position.set(-w / 2 + 0.28 + i * 0.1, -h / 2 + 0.06, d / 2 + 0.035);
        devGroup.add(ledMesh);

        this.ledObjects.push({
          mesh: ledMesh,
          baseColor: color,
          offColor: 0x052e16,
          isPower: isPower,
          blinkTimer: Math.random() * 50
        });
      }
    }

    // 4b. 3D Metal D-Ring Cable Management Brackets
    if (dev.catalogId === 'organizer-dring-1u' || (dev.id && dev.id.includes('dring'))) {
      const ringMat = new THREE.MeshStandardMaterial({
        color: 0x18202d,
        metalness: 0.88,
        roughness: 0.28
      });
      const ringXs = [-1.6, -0.8, 0, 0.8, 1.6];
      const ringDepth = 0.55;
      const ringH = h * 0.72;

      ringXs.forEach(rx => {
        const bracketGroup = new THREE.Group();
        bracketGroup.position.set(rx, 0, d / 2 + 0.02);

        const botArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ringDepth), ringMat);
        botArm.position.set(0, -ringH / 2, ringDepth / 2);
        bracketGroup.add(botArm);

        const frontBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, ringH, 0.03), ringMat);
        frontBar.position.set(0, 0, ringDepth);
        bracketGroup.add(frontBar);

        const topArmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ringDepth * 0.38), ringMat);
        topArmLeft.position.set(0, ringH / 2, ringDepth * 0.81);
        bracketGroup.add(topArmLeft);

        const topArmBack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ringDepth * 0.38), ringMat);
        topArmBack.position.set(0, ringH / 2, ringDepth * 0.19);
        bracketGroup.add(topArmBack);

        devGroup.add(bracketGroup);
      });
    }

    // 4c. 3D Brush Pass-Through Cable Organizer (organizer-1u)
    if (dev.catalogId === 'organizer-1u' || (dev.id && (dev.id.includes('brush') || dev.id.includes('organizer-1u')))) {
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x111622,
        metalness: 0.82,
        roughness: 0.35
      });
      const bristleMat = new THREE.MeshStandardMaterial({
        color: 0x05070a,
        metalness: 0.1,
        roughness: 0.95
      });

      const brushGroup = new THREE.Group();
      brushGroup.position.set(0, 0, d / 2 + 0.015);

      const slotW = w * 0.74;
      const slotH = h * 0.46;
      const backingMesh = new THREE.Mesh(new THREE.BoxGeometry(slotW, slotH, 0.02), bristleMat);
      backingMesh.position.set(0.12, 0, 0);
      brushGroup.add(backingMesh);

      const topLip = new THREE.Mesh(new THREE.BoxGeometry(slotW + 0.08, 0.04, 0.04), frameMat);
      topLip.position.set(0.12, slotH / 2 + 0.02, 0.015);
      brushGroup.add(topLip);

      const botLip = new THREE.Mesh(new THREE.BoxGeometry(slotW + 0.08, 0.04, 0.04), frameMat);
      botLip.position.set(0.12, -slotH / 2 - 0.02, 0.015);
      brushGroup.add(botLip);

      const fiberRows = 16;
      for (let fi = 0; fi < fiberRows; fi++) {
        const fx = -slotW / 2 + 0.12 + (fi / (fiberRows - 1)) * slotW;
        const topFiber = new THREE.Mesh(new THREE.BoxGeometry(0.04, slotH * 0.46, 0.03), bristleMat);
        topFiber.position.set(fx, slotH * 0.25, 0.01);
        brushGroup.add(topFiber);

        const botFiber = new THREE.Mesh(new THREE.BoxGeometry(0.04, slotH * 0.46, 0.03), bristleMat);
        botFiber.position.set(fx, -slotH * 0.25, 0.01);
        brushGroup.add(botFiber);
      }

      devGroup.add(brushGroup);
    }

    // 4d. 3D Enterprise 2U Slotted Finger-Duct Organizer (organizer-2u)
    if (dev.catalogId === 'organizer-2u' || (dev.id && (dev.id.includes('finger') || dev.id.includes('organizer-2u')))) {
      const coverMat = new THREE.MeshStandardMaterial({
        color: 0x121824,
        metalness: 0.75,
        roughness: 0.3
      });
      const tineMat = new THREE.MeshStandardMaterial({
        color: 0x18202d,
        metalness: 0.5,
        roughness: 0.5
      });

      const ductGroup = new THREE.Group();
      ductGroup.position.set(0, 0, d / 2 + 0.02);

      const ductW = w * 0.82;
      const ductH = h * 0.88;
      const ductDepth = 0.22;

      const numTines = 18;
      for (let ti = 0; ti < numTines; ti++) {
        const tx = -ductW / 2 + 0.1 + (ti / (numTines - 1)) * ductW;
        const topTine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, ductDepth), tineMat);
        topTine.position.set(tx, ductH / 2 - 0.08, ductDepth / 2);
        ductGroup.add(topTine);

        const botTine = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, ductDepth), tineMat);
        botTine.position.set(tx, -ductH / 2 + 0.08, ductDepth / 2);
        ductGroup.add(botTine);
      }

      const coverH = ductH * 0.58;
      const coverMesh = new THREE.Mesh(new THREE.BoxGeometry(ductW + 0.06, coverH, 0.04), coverMat);
      coverMesh.position.set(0, 0, ductDepth + 0.02);
      ductGroup.add(coverMesh);

      const gripMat = new THREE.MeshStandardMaterial({ color: 0x2d3a4f, roughness: 0.2 });
      for (let gi = -2; gi <= 2; gi++) {
        const gripBar = new THREE.Mesh(new THREE.BoxGeometry(0.02, coverH * 0.45, 0.02), gripMat);
        gripBar.position.set(gi * 0.06, 0, ductDepth + 0.042);
        ductGroup.add(gripBar);
      }

      devGroup.add(ductGroup);
    }

    // 5. Interactive 3D Ports
    if (!blocksInteractivePorts && dev.portsCount > 0) {
      const layout = getDevicePortLayout(dev);
      const pCount = layout.count;
      const availableW = w - 1.72;
      const groupGap = 0.10;
      const totalColumns = layout.primaryColumns + layout.uplinkColumns + (layout.uplinks ? 1 : 0);
      const pGap = 0.018;
      const pWidth = Math.min(0.13, (availableW - pGap * totalColumns - groupGap * Math.ceil(layout.primaryColumns / 12)) / Math.max(1, totalColumns));
      const pHeight = (layout.stackedSwitch || layout.stackedPatch) ? 0.068 : 0.095;
      const startX = -w / 2 + 1.42 + (pWidth / 2);

      for (let p = 0; p < pCount; p++) {
        const portDefinition = Array.isArray(dev.portDefinitions) ? dev.portDefinitions[p] : null;
        const isUplink = p >= layout.primary;
        const effectivePortType = (portDefinition && portDefinition.type) || dev.portType;
        let row = 0;
        let column = p;
        if (isUplink) {
          const uplinkIndex = p - layout.primary;
          row = uplinkIndex % 2;
          column = layout.primaryColumns + 1 + Math.floor(uplinkIndex / 2);
        } else if (layout.stackedSwitch) {
          row = p % 2;
          column = Math.floor(p / 2);
        } else if (layout.stackedPatch) {
          row = Math.floor(p / 24);
          column = p % 24;
        }
        const blockOffset = Math.floor(column / 12) * groupGap;
        const px = startX + column * (pWidth + pGap) + blockOffset;
        const py = (layout.stackedSwitch || layout.stackedPatch || isUplink) ? (row === 0 ? 0.058 : -0.058) : 0;
        const pz = d / 2 + 0.035;

        const isFiber = effectivePortType === 'fiber-adapter' || effectivePortType === 'lc' || effectivePortType === 'sc' ||
                        dev.catalogId === 'hcs-datalight-24' || dev.catalogId === 'fiber-odf-24';
        const portGeo = new THREE.BoxGeometry(pWidth, pHeight, 0.045);

        const portCfg = (dev.portsConfig && (dev.portsConfig[p + 1] || dev.portsConfig['p' + (p + 1)])) || null;
        const isTrunk = portCfg && (portCfg.role === 'trunk' || portCfg.isTrunk);
        const customColor = portCfg && portCfg.color;
        const trunkColorNum = customColor ? parseInt(customColor.replace('#', '0x'), 16) : (isTrunk ? 0xa855f7 : null);

        const portMat = new THREE.MeshStandardMaterial({
          color: isTrunk ? (trunkColorNum || 0xa855f7) : isFiber ? 0x0284c7 : isUplink ? 0x94a3b8 : visualKind === 'patch-panel' ? 0x111827 : effectivePortType === 'qsfp28' ? 0x0ea5e9 : effectivePortType === 'c13' ? 0xef4444 : 0x374151,
          metalness: isTrunk ? 0.65 : 0.85,
          roughness: isTrunk ? 0.25 : 0.25,
          emissive: isTrunk ? (trunkColorNum || 0xa855f7) : 0x000000,
          emissiveIntensity: isTrunk ? 0.45 : 0
        });
        const portMesh = new THREE.Mesh(portGeo, portMat);
        portMesh.position.set(px, py, pz);

        const cavityGeo = new THREE.BoxGeometry(pWidth * 0.75, pHeight * 0.7, 0.02);
        const cavityMat = new THREE.MeshBasicMaterial({ color: isTrunk ? 0x150d24 : 0x090d16 });
        const cavity = new THREE.Mesh(cavityGeo, cavityMat);
        cavity.position.set(0, 0, 0.02);
        portMesh.add(cavity);

        if (visualKind === 'switch' && !isFiber) {
          const ledGeo = new THREE.BoxGeometry(pWidth * 0.22, 0.012, 0.012);
          const ledColor = isTrunk ? (trunkColorNum || 0xa855f7) : 0xf59e0b;
          const ledMat = new THREE.MeshBasicMaterial({ color: ledColor });
          const portLed = new THREE.Mesh(ledGeo, ledMat);
          portLed.position.set(0, -pHeight * 0.38, 0.032);
          portMesh.add(portLed);
        }

        portMesh.userData = {
          isPort: true,
          devId: dev.id,
          devName: dev.name,
          portIdx: p + 1,
          portType: effectivePortType,
          isUplink,
          isTrunk: !!isTrunk,
          trunkConfig: portCfg,
          worldPos: new THREE.Vector3()
        };

        devGroup.add(portMesh);
      }
    }

    // 6. Rear Faceplate
    const psuMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 });
    const psuGeo = new THREE.BoxGeometry(0.85, h * 0.75, 0.04);
    [-w / 4, w / 4].forEach(px => {
      const psu = new THREE.Mesh(psuGeo, psuMat);
      psu.position.set(px, 0, -d / 2 - 0.015);
      devGroup.add(psu);
    });

    devGroup.position.set(rackX, yPos, zPos);
    this.devicesGroup.add(devGroup);
  };

  Studio3D.prototype.rebuildAllDevices = function() {
    while (this.devicesGroup.children.length > 0) {
      const child = this.devicesGroup.children[0];
      disposeObject3D(child);
      this.devicesGroup.remove(child);
    }
    this.ledObjects = [];
    this.state.devices.forEach(d => this.buildDevice3D(Object.assign(d, { deviceLabelMode: this.state.deviceLabelMode })));
    this.updateInteractiveTargets?.();
    this.markDirty?.();
  };

  Studio3D.prototype.getPortWorldPosition = function(devId, portIdx) {
    const devGroup = this.devicesGroup.getObjectByName(devId);
    if (!devGroup) return null;

    let portMesh = null;
    devGroup.traverse(child => {
      if (child.userData && child.userData.isPort && child.userData.portIdx === portIdx) {
        portMesh = child;
      }
    });

    if (!portMesh) return null;
    const worldPos = new THREE.Vector3();
    portMesh.getWorldPosition(worldPos);
    return worldPos;
  };

  Studio3D.prototype.updateDeviceConfig = function(instanceId, config) {
    const dev = this.state.devices.find(d => d.id === instanceId);
    if (!dev) return false;

    if (config.name !== undefined) dev.name = config.name.trim() || dev.name;
    if (config.hostname !== undefined) dev.hostname = config.hostname.trim();
    if (config.ipAddress !== undefined) dev.ipAddress = config.ipAddress.trim();
    if (config.macAddress !== undefined) dev.macAddress = config.macAddress.trim();

    this.rebuildAllDevices();
    this.rebuildAllCables();
    this.state.pushSnapshot();
    this.state.autoSave();
    this.showToast(`Cihaz Güncellendi: ${dev.name}`);
    return true;
  };

  Studio3D.prototype.updateDeviceMetadata = function(instanceId, metadata) {
    return this.updateDeviceConfig(instanceId, {
      name: String(metadata.name || '').trim(),
      hostname: String(metadata.name || '').trim(),
      ipAddress: String(metadata.ipAddress || '').trim(),
      macAddress: String(metadata.macAddress || '').trim(),
      serialNumber: String(metadata.serialNumber || '').trim(),
      panelLabel: String(metadata.panelLabel || '').trim()
    });
  };

  Studio3D.prototype.setDeviceLabelMode = function(mode) {
    if (!['name', 'ip', 'mac', 'all', 'none'].includes(mode)) return false;
    this.state.deviceLabelMode = mode;
    localStorage.setItem('rack-studio-device-label-mode', mode);
    this.rebuildAllDevices();
    return true;
  };
}
