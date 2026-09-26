import { sfx } from './audio.js';
import { 
  U_HEIGHT, 
  RACK_WIDTH, 
  RACK_DEPTH
} from './catalog3d.js';
import { 
  createFloorTexture,
  createRackHeaderBadgeTexture 
} from './textures.js';

export function registerRackSceneMethods(Studio3D) {
  Studio3D.prototype.setLightingMode = function(mode) {
    if (mode !== 'studio' && mode !== 'datacenter') mode = 'studio';
    this.state.lightingMode = mode;
    if (mode === 'studio') {
      this.scene.background.setHex(0x111827);
      this.scene.fog.color.setHex(0x111827);
      this.lights.ambient.intensity = 1.9;
      this.lights.hemi.intensity = 2.0;
      this.lights.keyLight.intensity = 3.0;
      this.lights.fillLight.intensity = 2.2;
      this.lights.rackInternalLight.intensity = 3.0;
      this.lights.cyanRim.intensity = 0.8;
      this.lights.amberRim.intensity = 0.6;
      this.renderer.toneMappingExposure = 1.35;
    } else if (mode === 'datacenter') {
      this.scene.background.setHex(0x0c1322);
      this.scene.fog.color.setHex(0x0c1322);
      this.lights.ambient.intensity = 1.4;
      this.lights.hemi.intensity = 1.7;
      this.lights.keyLight.intensity = 2.6;
      this.lights.fillLight.intensity = 1.8;
      this.lights.rackInternalLight.intensity = 2.4;
      this.lights.cyanRim.intensity = 1.6;
      this.lights.amberRim.intensity = 1.2;
      this.renderer.toneMappingExposure = 1.25;
    }
    this.applyVisualTheme(document.documentElement.getAttribute('data-theme'));
    this.state.autoSave();
    sfx.toggle();
  };

  Studio3D.prototype.buildDatacenterRoom = function() {
    const floorSize = 120;
    const floorGeo = new THREE.PlaneGeometry(floorSize, floorSize);
    const floorMat = new THREE.MeshStandardMaterial({
      map: createFloorTexture(),
      roughness: 0.35,
      metalness: 0.65
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ventGeo = new THREE.BoxGeometry(RACK_WIDTH + 1.2, 0.05, 3.6);
    const ventMat = new THREE.MeshStandardMaterial({
      color: 0x454e52,
      metalness: 0.85,
      roughness: 0.25
    });
    const ventTile = new THREE.Mesh(ventGeo, ventMat);
    ventTile.position.set(0, 0.02, 5.5);
    ventTile.receiveShadow = true;
    this.scene.add(ventTile);

    const grid = new THREE.GridHelper(floorSize, 60, 0x475569, 0x334155);
    grid.position.y = 0.03;
    grid.material.transparent = true;
    grid.material.opacity = 0.12;
    this.scene.add(grid);

    const lightPanelMat = new THREE.MeshBasicMaterial({ color: 0xf8fafc });
    for (let z = -15; z <= 15; z += 10) {
      [-8, 0, 8].forEach(x => {
        const lpGeo = new THREE.BoxGeometry(4.0, 0.2, 1.2);
        const lp = new THREE.Mesh(lpGeo, lightPanelMat);
        lp.position.set(x, 24, z);
        this.scene.add(lp);
      });
    }

    this.ghostRacksGroup = new THREE.Group();
    this.ghostRacksGroup.name = 'ghost_racks_group';
    this.scene.add(this.ghostRacksGroup);
    this.updateGhostRacks();
  };

  Studio3D.prototype.updateGhostRacks = function() {
    if (!this.ghostRacksGroup) return;
    while (this.ghostRacksGroup.children.length > 0) {
      this.ghostRacksGroup.remove(this.ghostRacksGroup.children[0]);
    }
  };

  Studio3D.prototype.buildGhostRack = function(xPos, uCount) {
    const gGroup = new THREE.Group();
    const h = uCount * U_HEIGHT;
    const mat = new THREE.MeshStandardMaterial({
      color: 0x303a3e,
      metalness: 0.8,
      roughness: 0.4,
      transparent: true,
      opacity: 0.7
    });
    const frame = new THREE.BoxGeometry(RACK_WIDTH, h, RACK_DEPTH);
    const m = new THREE.Mesh(frame, mat);
    m.position.y = h / 2 + 0.3;
    gGroup.add(m);

    const beaconGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.4, 12);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0xb2c1c5 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0, h + 0.5, 0);
    gGroup.add(beacon);

    gGroup.position.set(xPos, 0, 0);
    this.ghostRacksGroup.add(gGroup);
  };

  Studio3D.prototype.getRack = function(rackId) {
    const racks = (Array.isArray(this.state.racks) && this.state.racks.length > 0)
      ? this.state.racks
      : [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: this.state.rackHeightU || 42 }];
    return racks.find(r => r.id === rackId) || racks[0];
  };

  Studio3D.prototype.getRackX = function(rackId) {
    const racks = (Array.isArray(this.state.racks) && this.state.racks.length > 0)
      ? this.state.racks
      : [{ id: 'rack-1' }];
    const idx = racks.findIndex(r => r.id === rackId);
    const validIdx = idx >= 0 ? idx : 0;
    const spacing = 6.4;
    const startX = -((racks.length - 1) * spacing) / 2;
    return startX + validIdx * spacing;
  };

  Studio3D.prototype.focusRack = function(rackId) {
    const rack = this.getRack(rackId);
    this.fitCameraToRacks('iso', rack.id);
    this.state.activeRackId = rack.id;
    this.showToast(`🔍 ${rack.name} odaklandı`);
  };

  Studio3D.prototype.buildRack = function(uHeight) {
    const disposedGeometries = new Set();
    const disposedMaterials = new Set();
    const disposedTextures = new Set();
    this.rackGroup.traverse(object => {
      if (object === this.rackGroup) return;
      if (object.geometry && !disposedGeometries.has(object.geometry)) {
        object.geometry.dispose();
        disposedGeometries.add(object.geometry);
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        if (!material || disposedMaterials.has(material)) return;
        if (material.map && !disposedTextures.has(material.map)) {
          material.map.dispose();
          disposedTextures.add(material.map);
        }
        material.dispose();
        disposedMaterials.add(material);
      });
    });
    while (this.rackGroup.children.length > 0) {
      this.rackGroup.remove(this.rackGroup.children[0]);
    }
    this.doorGroup = null;
    this.doorGroups = [];

    const racks = (Array.isArray(this.state.racks) && this.state.racks.length > 0)
      ? this.state.racks
      : [{ id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: uHeight || this.state.rackHeightU || 42 }];

    const spacing = 6.4;
    const numRacks = racks.length;
    const startX = -((numRacks - 1) * spacing) / 2;

    let maxTotalH = 0;

    racks.forEach((rack, idx) => {
      const rackU = rack.heightU || uHeight || this.state.rackHeightU || 42;
      const totalH = rackU * U_HEIGHT;
      if (totalH > maxTotalH) maxTotalH = totalH;

      const rackX = startX + idx * spacing;
      const singleRackGroup = new THREE.Group();
      singleRackGroup.name = `rack_enclosure_${rack.id}`;
      singleRackGroup.position.set(rackX, 0, 0);

      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x2c3338,
        roughness: 0.35,
        metalness: 0.8
      });

      const pillarGeo = new THREE.BoxGeometry(0.32, totalH + 0.4, 0.32);
      const halfW = (RACK_WIDTH - 0.3) / 2;
      const halfD = (RACK_DEPTH - 0.3) / 2;
      const pillarY = totalH / 2 + 0.2;

      [
        [-halfW, pillarY, -halfD],
        [ halfW, pillarY, -halfD],
        [-halfW, pillarY,  halfD],
        [ halfW, pillarY,  halfD]
      ].forEach(pos => {
        const pillar = new THREE.Mesh(pillarGeo, frameMat);
        pillar.position.set(...pos);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        singleRackGroup.add(pillar);
      });

      const railMat = new THREE.MeshStandardMaterial({
        color: 0x68747a,
        roughness: 0.62,
        metalness: 0.5
      });

      const railH = totalH;
      const railGeo = new THREE.BoxGeometry(0.16, railH, 0.12);
      const railX = RACK_WIDTH / 2 - 0.34;
      const railZ = RACK_DEPTH / 2 - 0.5;

      const railL = new THREE.Mesh(railGeo, railMat);
      railL.position.set(-railX, railH / 2 + 0.2, railZ);
      singleRackGroup.add(railL);

      const railR = new THREE.Mesh(railGeo, railMat);
      railR.position.set(railX, railH / 2 + 0.2, railZ);
      singleRackGroup.add(railR);

      const railBL = new THREE.Mesh(railGeo, railMat);
      railBL.position.set(-railX, railH / 2 + 0.2, -railZ);
      singleRackGroup.add(railBL);

      const railBR = new THREE.Mesh(railGeo, railMat);
      railBR.position.set(railX, railH / 2 + 0.2, -railZ);
      singleRackGroup.add(railBR);

      // Numbers sit outside the mounting aperture, so they cannot mask ports.
      for (let unit = 5; unit <= rackU; unit += 5) {
        const markerCanvas = document.createElement('canvas');
        markerCanvas.width = 128;
        markerCanvas.height = 64;
        const markerContext = markerCanvas.getContext('2d');
        markerContext.fillStyle = '#263747';
        markerContext.fillRect(0, 0, 128, 64);
        markerContext.fillStyle = '#f5f7fa';
        markerContext.font = '600 34px sans-serif';
        markerContext.textAlign = 'center';
        markerContext.textBaseline = 'middle';
        markerContext.fillText(`U${unit}`, 64, 32);
        const markerTexture = new THREE.CanvasTexture(markerCanvas);
        const markerMaterial = new THREE.MeshBasicMaterial({ map: markerTexture, depthWrite: false });
        const marker = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.18), markerMaterial);
        marker.position.set(-RACK_WIDTH / 2 - 0.2, (unit - 0.5) * U_HEIGHT + 0.3, railZ + 0.09);
        singleRackGroup.add(marker);
      }

      const roofFloorGeo = new THREE.BoxGeometry(RACK_WIDTH, 0.2, RACK_DEPTH);
      const roof = new THREE.Mesh(roofFloorGeo, frameMat);
      roof.position.set(0, totalH + 0.3, 0);
      singleRackGroup.add(roof);

      const badgeTex = createRackHeaderBadgeTexture(rack.name || `KABİN #${idx + 1}`, rackU);
      const badgeMat = new THREE.MeshStandardMaterial({
        map: badgeTex,
        roughness: 0.2,
        metalness: 0.8
      });
      const badgeGeo = new THREE.PlaneGeometry(RACK_WIDTH - 0.6, 0.55);
      const badgeMesh = new THREE.Mesh(badgeGeo, badgeMat);
      badgeMesh.position.set(0, totalH + 0.3, RACK_DEPTH / 2 + 0.02);
      singleRackGroup.add(badgeMesh);

      const floor = new THREE.Mesh(roofFloorGeo, frameMat);
      floor.position.set(0, 0.1, 0);
      singleRackGroup.add(floor);

      const sideMeshGeo = new THREE.BoxGeometry(0.04, totalH, RACK_DEPTH - 0.6);
      const sideMat = new THREE.MeshStandardMaterial({
        color: 0x20282c,
        roughness: 0.6,
        metalness: 0.5,
        wireframe: false
      });
      const sideL = new THREE.Mesh(sideMeshGeo, sideMat);
      sideL.position.set(-RACK_WIDTH / 2 + 0.05, totalH / 2 + 0.2, 0);
      singleRackGroup.add(sideL);

      const sideR = new THREE.Mesh(sideMeshGeo, sideMat);
      sideR.position.set(RACK_WIDTH / 2 - 0.05, totalH / 2 + 0.2, 0);
      singleRackGroup.add(sideR);

      const singleDoorGroup = new THREE.Group();
      singleDoorGroup.name = `door_group_${rack.id}`;
      singleDoorGroup.position.set(-RACK_WIDTH / 2, 0, RACK_DEPTH / 2 + 0.05);

      const glassGeo = new THREE.BoxGeometry(RACK_WIDTH - 0.4, totalH, 0.04);
      const glassMat = new THREE.MeshBasicMaterial({
        color: 0x9cb9ca,
        transparent: true,
        opacity: 0.08,
        depthWrite: false
      });
      const glass = new THREE.Mesh(glassGeo, glassMat);
      glass.position.set(RACK_WIDTH / 2, totalH / 2 + 0.2, 0);
      singleDoorGroup.add(glass);

      const doorFrameMat = new THREE.MeshStandardMaterial({ color: 0x626e73, metalness: 0.55, roughness: 0.48 });
      const handleGeo = new THREE.BoxGeometry(0.12, 1.8, 0.16);
      const handle = new THREE.Mesh(handleGeo, doorFrameMat);
      handle.position.set(RACK_WIDTH - 0.35, totalH / 2 + 0.2, 0.12);
      singleDoorGroup.add(handle);

      singleRackGroup.add(singleDoorGroup);
      this.doorGroups.push(singleDoorGroup);

      if (idx === 0) {
        this.doorGroup = singleDoorGroup;
      }

      this.rackGroup.add(singleRackGroup);
    });

    if (numRacks > 1) {
      const traySpan = (numRacks - 1) * spacing + RACK_WIDTH + 1.2;
      const trayY = maxTotalH + 0.65;
      const trayZ = 0;

      const trayGroup = new THREE.Group();
      trayGroup.name = 'overhead_cable_tray';

      const railGeo = new THREE.BoxGeometry(traySpan, 0.08, 0.08);
      const trayMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.85, roughness: 0.25 });

      const frontRail = new THREE.Mesh(railGeo, trayMat);
      frontRail.position.set(0, trayY, trayZ + 0.9);
      trayGroup.add(frontRail);

      const rearRail = new THREE.Mesh(railGeo, trayMat);
      rearRail.position.set(0, trayY, trayZ - 0.9);
      trayGroup.add(rearRail);

      const rungGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.8, 12);
      const rungMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
      const stepRung = 0.6;
      const countRungs = Math.floor(traySpan / stepRung);
      const rungStartX = -traySpan / 2 + stepRung / 2;

      for (let r = 0; r <= countRungs; r++) {
        const rx = rungStartX + r * stepRung;
        if (rx <= traySpan / 2) {
          const rung = new THREE.Mesh(rungGeo, rungMat);
          rung.rotation.x = Math.PI / 2;
          rung.position.set(rx, trayY - 0.04, trayZ);
          trayGroup.add(rung);
        }
      }

      this.rackGroup.add(trayGroup);
    }

    if (this.controls) {
      const activeX = this.getRackX(this.state.activeRackId);
      this.controls.target.set(activeX, maxTotalH / 2 + 0.3, 0);
    }
    if (this.lights.rackInternalLight) {
      this.lights.rackInternalLight.position.set(0, maxTotalH / 2 + 3.0, 3.6);
    }
    this.updateGhostRacks();
  };

  Studio3D.prototype.setDoorOpen = function(isOpen) {
    this.state.doorOpen = Boolean(isOpen);
    const targetRot = this.state.doorOpen ? -Math.PI * 0.65 : 0;
    if (Array.isArray(this.doorGroups) && this.doorGroups.length > 0) {
      this.doorGroups.forEach(dg => {
        dg.rotation.y = targetRot;
      });
    } else if (this.doorGroup) {
      this.doorGroup.rotation.y = targetRot;
    }
    this.state.autoSave();
    sfx.toggle();
  };

  Studio3D.prototype.setRackHeight = function(newU) {
    newU = Math.max(12, Math.min(60, parseInt(newU) || 42));
    const maxOccupiedU = this.state.devices.reduce((max, d) => Math.max(max, d.startU + d.uHeight - 1), 0);
    if (newU < maxOccupiedU) {
      alert(`Kabin U yüksekliği küçültülemez! U${maxOccupiedU} pozisyonunda cihaz bulunmaktadır.`);
      return false;
    }
    this.state.rackHeightU = newU;
    if (Array.isArray(this.state.racks)) {
      const active = this.state.racks.find(r => r.id === this.state.activeRackId) || this.state.racks[0];
      if (active) active.heightU = newU;
    }
    this.buildRack(newU);
    this.rebuildAllDevices();
    this.rebuildAllCables();
    this.state.pushSnapshot();
    if (typeof window.sync3Dto2D === 'function') {
      try { window.sync3Dto2D(); } catch (_) {}
    }
    return true;
  };
}
