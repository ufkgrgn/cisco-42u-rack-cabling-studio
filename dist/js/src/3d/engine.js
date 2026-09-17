/**
 * Cisco Enterprise 3D Rack & Datacenter Engine (WebGL / Three.js)
 */
import { sfx } from './audio.js';
import { 
  escapeTooltipHtml, 
  getDeviceVisualKind, 
  getDevicePortLayout 
} from './helpers.js';
import { 
  CATALOG, 
  CABLE_COLORS, 
  U_HEIGHT, 
  RACK_WIDTH, 
  RACK_DEPTH, 
  RAIL_WIDTH 
} from './catalog3d.js';
import { 
  createFloorTexture, 
  createRailTexture, 
  createFaceplateTexture 
} from './textures.js';
import { StudioState } from './state3d.js';

// --- 3D SCENE & ENGINE ---
  class Studio3D {
    constructor(container) {
      this.container = container;
      this.state = new StudioState();
      this.ledObjects = [];
      this.rackGroup = null;
      this.doorGroup = null;
      this.devicesGroup = null;
      this.cablesGroup = null;
      this.lights = {};
      this.raycaster = new THREE.Raycaster();
      this.mouse = new THREE.Vector2();
      this.hoveredPortMesh = null;
      this.fps = 60;
      this.lastTime = performance.now();
      this.frameCount = 0;
      this.selectedDeviceId = null;

      this.initThree();
      this.setPerformanceMode(this.state.performanceMode, false);
      this.buildDatacenterRoom();
      this.initEvents();

      // Check canonical 2D project state first to ensure parity, then auto-save, then fallback
      let initialLoaded = false;
      try {
        const canonical = localStorage.getItem('cisco-rack-studio-project') || localStorage.getItem('rack-studio-project-v2');
        if (canonical) {
          const parsed = JSON.parse(canonical);
          if (parsed && (parsed.racks || parsed.devices)) {
            this.loadTopologyFromProject(parsed);
            initialLoaded = true;
          }
        }
      } catch (e) {}

      if (!initialLoaded && this.state.loadAutoSave()) {
        this.buildRack(this.state.rackHeightU);
        this.rebuildAllDevices();
        this.rebuildAllCables();
        this.state.pushSnapshot();
        initialLoaded = true;
      }

      if (!initialLoaded && !navigator.webdriver) {
        this.buildRack(this.state.rackHeightU);
        this.loadPresetMDF();
      } else if (!initialLoaded) {
        this.buildRack(this.state.rackHeightU);
      }

      if (this.container.closest('#studio3d-wrapper')?.style.display === 'none') {
        this.isPaused = true;
      } else {
        this.animate();
      }
    }

    initThree() {
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;

      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0x0c1322);
      this.scene.fog = new THREE.FogExp2(0x0c1322, 0.012);

      const midY = (this.state.rackHeightU * U_HEIGHT) / 2 + 0.3;
      this.camera = new THREE.PerspectiveCamera(44, w / h, 0.1, 1000);
      this.camera.position.set(7.5, midY + 1.8, 12.0);

      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
      this.renderer.setSize(w, h);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = THREE.PCFShadowMap;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.25;

      this.isPaused = false;
      this.animFrameId = null;
      this.lastLedUpdate = 0;
      this.lastRenderTime = 0;
      this.targetFrameInterval = 1000 / 45;
      this.ledUpdateInterval = 200;

      this.container.appendChild(this.renderer.domElement);

      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.06;
      this.controls.maxPolarAngle = Math.PI / 2 + 0.05;
      this.controls.minDistance = 2.5;
      this.controls.maxDistance = 45;
      this.controls.target.set(0, midY, 0);

      // --- HIGH-END MULTI-POINT STUDIO & DATACENTER LIGHTING ---
      this.lights.ambient = new THREE.AmbientLight(0xffffff, 1.4);
      this.scene.add(this.lights.ambient);

      this.lights.hemi = new THREE.HemisphereLight(0xf0f9ff, 0x1e293b, 1.7);
      this.lights.hemi.position.set(0, 30, 0);
      this.scene.add(this.lights.hemi);

      this.lights.keyLight = new THREE.DirectionalLight(0xfffdf0, 2.6);
      this.lights.keyLight.position.set(8, 22, 16);
      this.lights.keyLight.castShadow = true;
      this.lights.keyLight.shadow.mapSize.width = 1024;
      this.lights.keyLight.shadow.mapSize.height = 1024;
      this.lights.keyLight.shadow.bias = -0.0001;
      this.scene.add(this.lights.keyLight);

      this.lights.fillLight = new THREE.DirectionalLight(0xe0f2fe, 1.8);
      this.lights.fillLight.position.set(-10, 16, 14);
      this.scene.add(this.lights.fillLight);

      this.lights.rackInternalLight = new THREE.PointLight(0xffffff, 2.5, 35, 1.1);
      this.lights.rackInternalLight.position.set(0, midY + 4, 3.6);
      this.scene.add(this.lights.rackInternalLight);

      this.lights.cyanRim = new THREE.DirectionalLight(0x00e5ff, 1.6);
      this.lights.cyanRim.position.set(-14, 16, -12);
      this.scene.add(this.lights.cyanRim);

      this.lights.amberRim = new THREE.DirectionalLight(0xf59e0b, 1.2);
      this.lights.amberRim.position.set(14, 12, -12);
      this.scene.add(this.lights.amberRim);

      this.rackGroup = new THREE.Group();
      this.devicesGroup = new THREE.Group();
      this.cablesGroup = new THREE.Group();
      this.scene.add(this.rackGroup);
      this.scene.add(this.devicesGroup);
      this.scene.add(this.cablesGroup);
    }

    setLightingMode(mode) {
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
      } else if (mode === 'cyberpunk') {
        this.scene.background.setHex(0x050811);
        this.scene.fog.color.setHex(0x050811);
        this.lights.ambient.intensity = 0.8;
        this.lights.hemi.intensity = 1.0;
        this.lights.keyLight.intensity = 1.8;
        this.lights.fillLight.intensity = 1.2;
        this.lights.rackInternalLight.intensity = 1.8;
        this.lights.cyanRim.intensity = 2.8;
        this.lights.amberRim.intensity = 2.2;
        this.renderer.toneMappingExposure = 1.15;
      }
      this.state.autoSave();
      sfx.toggle();
    }

    buildDatacenterRoom() {
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
        color: 0x334155,
        metalness: 0.85,
        roughness: 0.25
      });
      const ventTile = new THREE.Mesh(ventGeo, ventMat);
      ventTile.position.set(0, 0.02, 5.5);
      ventTile.receiveShadow = true;
      this.scene.add(ventTile);

      const grid = new THREE.GridHelper(floorSize, 60, 0x0ea5e9, 0x1e293b);
      grid.position.y = 0.03;
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

      const trayMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.3 });
      for (let z = -20; z <= 20; z += 10) {
        const ladderGeo = new THREE.BoxGeometry(40, 0.25, 1.4);
        const ladder = new THREE.Mesh(ladderGeo, trayMat);
        ladder.position.set(0, 23.5, z);
        this.scene.add(ladder);

        const bundleGeo = new THREE.CylinderGeometry(0.12, 0.12, 40, 8);
        const bundleMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 });
        const bundle = new THREE.Mesh(bundleGeo, bundleMat);
        bundle.rotation.z = Math.PI / 2;
        bundle.position.set(0, 23.7, z);
        this.scene.add(bundle);
      }

      this.buildGhostRack(-9.5, 42);
      this.buildGhostRack(9.5, 42);
    }

    buildGhostRack(xPos, uCount) {
      const gGroup = new THREE.Group();
      const h = uCount * U_HEIGHT;
      const mat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
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
      const beaconMat = new THREE.MeshBasicMaterial({ color: xPos < 0 ? 0x10b981 : 0x00e5ff });
      const beacon = new THREE.Mesh(beaconGeo, beaconMat);
      beacon.position.set(0, h + 0.5, 0);
      gGroup.add(beacon);

      gGroup.position.set(xPos, 0, 0);
      this.scene.add(gGroup);
    }

    buildRack(uHeight) {
      while (this.rackGroup.children.length > 0) {
        this.rackGroup.remove(this.rackGroup.children[0]);
      }
      this.doorGroup = null;

      const totalH = uHeight * U_HEIGHT;
      const frameMat = new THREE.MeshStandardMaterial({
        color: 0x1e2634,
        roughness: 0.35,
        metalness: 0.8
      });

      const pillarGeo = new THREE.BoxGeometry(0.32, totalH + 0.4, 0.32);
      const halfW = (RACK_WIDTH - 0.3) / 2;
      const halfD = (RACK_DEPTH - 0.3) / 2;
      const pillarY = (totalH + 0.4) / 2;

      [[-halfW, -halfD], [halfW, -halfD], [-halfW, halfD], [halfW, halfD]].forEach(([px, pz]) => {
        const pillar = new THREE.Mesh(pillarGeo, frameMat);
        pillar.position.set(px, pillarY, pz);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.rackGroup.add(pillar);
      });

      const plateGeo = new THREE.BoxGeometry(RACK_WIDTH, 0.3, RACK_DEPTH);
      const basePlate = new THREE.Mesh(plateGeo, frameMat);
      basePlate.position.set(0, 0.15, 0);
      this.rackGroup.add(basePlate);

      const topPlate = new THREE.Mesh(plateGeo, frameMat);
      topPlate.position.set(0, totalH + 0.35, 0);
      this.rackGroup.add(topPlate);

      const sideMat = new THREE.MeshStandardMaterial({ color: 0x242d3c, roughness: 0.5, metalness: 0.7 });
      const sideGeo = new THREE.BoxGeometry(0.08, totalH, RACK_DEPTH - 0.6);
      const leftSide = new THREE.Mesh(sideGeo, sideMat);
      leftSide.position.set(-halfW - 0.08, totalH / 2 + 0.3, 0);
      this.rackGroup.add(leftSide);

      const rightSide = new THREE.Mesh(sideGeo, sideMat);
      rightSide.position.set(halfW + 0.08, totalH / 2 + 0.3, 0);
      this.rackGroup.add(rightSide);

      const railGeo = new THREE.BoxGeometry(0.32, totalH, 0.28);
      const railFrontZ = halfD - 0.8;
      const railRearZ = -halfD + 0.8;
      const railHalfW = RAIL_WIDTH / 2;

      const railTex = createRailTexture(uHeight);
      const frontRailMat = new THREE.MeshStandardMaterial({
        map: railTex,
        roughness: 0.3,
        metalness: 0.85
      });
      const rearRailMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        roughness: 0.3,
        metalness: 0.85
      });

      const fLeftRail = new THREE.Mesh(railGeo, frontRailMat);
      fLeftRail.position.set(-railHalfW, totalH / 2 + 0.3, railFrontZ);
      fLeftRail.castShadow = true;
      this.rackGroup.add(fLeftRail);

      const fRightRail = new THREE.Mesh(railGeo, frontRailMat);
      fRightRail.position.set(railHalfW, totalH / 2 + 0.3, railFrontZ);
      fRightRail.castShadow = true;
      this.rackGroup.add(fRightRail);

      const rLeftRail = new THREE.Mesh(railGeo, rearRailMat);
      rLeftRail.position.set(-railHalfW, totalH / 2 + 0.3, railRearZ);
      this.rackGroup.add(rLeftRail);

      const rRightRail = new THREE.Mesh(railGeo, rearRailMat);
      rRightRail.position.set(railHalfW, totalH / 2 + 0.3, railRearZ);
      this.rackGroup.add(rRightRail);

      this.doorGroup = new THREE.Group();
      this.doorGroup.position.set(-halfW, 0, halfD + 0.15);

      const glassGeo = new THREE.BoxGeometry(RACK_WIDTH - 0.4, totalH - 0.2, 0.05);
      const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x1e293b,
        metalness: 0.1,
        roughness: 0.08,
        transmission: 0.82,
        transparent: true,
        opacity: 0.85,
        reflectivity: 0.95
      });
      const glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(RACK_WIDTH / 2 - 0.2, totalH / 2 + 0.3, 0);
      this.doorGroup.add(glassMesh);

      const handleMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.05 });
      const handleGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.9, 16);
      const handle = new THREE.Mesh(handleGeo, handleMat);
      handle.position.set(RACK_WIDTH - 0.6, totalH / 2 + 0.3, 0.1);
      this.doorGroup.add(handle);

      this.rackGroup.add(this.doorGroup);
      this.doorGroup.rotation.y = this.state.doorOpen ? -Math.PI * 0.65 : 0;

      const badgeGeo = new THREE.BoxGeometry(2.4, 0.24, 0.06);
      const badgeMat = new THREE.MeshStandardMaterial({
        color: 0x0284c7,
        emissive: 0x00e5ff,
        emissiveIntensity: 0.6,
        roughness: 0.2
      });
      const badge = new THREE.Mesh(badgeGeo, badgeMat);
      badge.position.set(0, totalH + 0.35, halfD + 0.1);
      this.rackGroup.add(badge);

      if (this.controls) {
        this.controls.target.set(0, totalH / 2 + 0.3, 0);
      }
      if (this.lights.rackInternalLight) {
        this.lights.rackInternalLight.position.set(0, totalH / 2 + 3.0, 3.6);
      }
    }

    setDoorOpen(isOpen) {
      this.state.doorOpen = Boolean(isOpen);
      if (this.doorGroup) {
        const targetRot = this.state.doorOpen ? -Math.PI * 0.65 : 0;
        this.doorGroup.rotation.y = targetRot;
      }
      this.state.autoSave();
      sfx.toggle();
    }

    setRackHeight(newU) {
      newU = Math.max(12, Math.min(60, parseInt(newU) || 42));
      const maxOccupiedU = this.state.devices.reduce((max, d) => Math.max(max, d.startU + d.uHeight - 1), 0);
      if (newU < maxOccupiedU) {
        alert(`Kabin U yüksekliği küçültülemez! U${maxOccupiedU} pozisyonunda cihaz bulunmaktadır.`);
        return false;
      }
      this.state.rackHeightU = newU;
      this.buildRack(newU);
      this.rebuildAllDevices();
      this.rebuildAllCables();
      this.state.pushSnapshot();
      return true;
    }

    // --- SMART FREE SLOT FINDER ---
    findNextAvailableSlot(uHeight) {
      for (let u = 1; u <= this.state.rackHeightU - uHeight + 1; u++) {
        const uEnd = u + uHeight - 1;
        const collision = this.state.devices.find(d => {
          const dEnd = d.startU + d.uHeight - 1;
          return !(uEnd < d.startU || u > dEnd);
        });
        if (!collision) return u;
      }
      return null;
    }

    // --- 3D HARDWARE CHASSIS GENERATION ---
    mountDevice(catalogId, targetU) {
      const item = CATALOG.find(c => c.id === catalogId);
      if (!item) return false;

      const uHeight = item.u;
      targetU = parseInt(targetU);

      // Smart slot fallback: if requested slot is invalid or occupied, find first free slot!
      const isOccupied = (u) => {
        if (!u || u < 1 || u + uHeight - 1 > this.state.rackHeightU) return true;
        const targetEnd = u + uHeight - 1;
        return !!this.state.devices.find(d => {
          const dEnd = d.startU + d.uHeight - 1;
          return !(targetEnd < d.startU || u > dEnd);
        });
      };

      if (!targetU || isOccupied(targetU)) {
        const freeSlot = this.findNextAvailableSlot(uHeight);
        if (!freeSlot) {
          alert(`Kabin dolu! Bu cihaz için (${uHeight}U) boş yer bulunamadı. Lütfen kabin yüksekliğini artırın.`);
          return false;
        }
        if (targetU && targetU !== freeSlot) {
          this.showToast(`U${targetU} dolu olduğundan ilk boş pozisyon olan U${freeSlot} kullanıldı.`);
        }
        targetU = freeSlot;
      }

      const instanceId = 'dev-' + Math.random().toString(36).substr(2, 9);
      const devData = {
        id: instanceId,
        catalogId: item.id,
        name: item.name,
        hostname: item.name,
        ipAddress: '',
        macAddress: '',
        serialNumber: '',
        panelLabel: '',
        manufacturer: item.manufacturer,
        category: item.category,
        startU: targetU,
        uHeight: uHeight,
        depthMm: item.depthMm,
        color: item.color,
        portsCount: item.portsCount,
        portType: item.portType,
        uplinks: item.uplinks,
        faceplateStyle: item.faceplateStyle || ''
      };

      this.state.devices.push(devData);
      this.buildDevice3D(devData);
      this.state.pushSnapshot();
      this.state.autoSave();
      sfx.insert();
      if (typeof window.renderInstalledDevicesList === 'function') {
        window.renderInstalledDevicesList();
      }
      const countEl = document.getElementById('installed-count');
      if (countEl) countEl.textContent = String(this.state.devices.length);
      return devData;
    }

    removeDevice(instanceId) {
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
    }

    moveDevice(instanceId, deltaU) {
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
      this.rebuildAllCables();
      this.state.pushSnapshot();
      this.state.autoSave();
      sfx.insert();
      if (typeof window.renderInstalledDevicesList === 'function') {
        window.renderInstalledDevicesList();
      }
      this.showToast(`${dev.name} U${newU} pozisyonuna taşındı.`);
      return true;
    }

    selectDevice(instanceId) {
      this.selectedDeviceId = instanceId;
      const dev = this.state.devices.find(d => d.id === instanceId);
      if (!dev) return;

      // Update floating device HUD
      const hud = document.getElementById('floating-device-hud');
      if (hud) {
        hud.style.display = 'flex';
        const nameEl = document.getElementById('floating-dev-name');
        const posEl = document.getElementById('floating-dev-pos');
        if (nameEl) nameEl.textContent = dev.name;
        if (posEl) posEl.textContent = `U${dev.startU}` + (dev.uHeight > 1 ? ` - U${dev.startU + dev.uHeight - 1}` : '') + ` (${dev.uHeight}U)`;
      }

      // Highlight active card in installed drawer
      document.querySelectorAll('.installed-device-card').forEach(card => {
        card.classList.toggle('active', card.dataset.devId === instanceId);
      });
    }

    deselectDevice() {
      this.selectedDeviceId = null;
      const hud = document.getElementById('floating-device-hud');
      if (hud) hud.style.display = 'none';
      document.querySelectorAll('.installed-device-card').forEach(card => {
        card.classList.remove('active');
      });
    }

    focusDevice(instanceId) {
      const dev = this.state.devices.find(d => d.id === instanceId);
      if (!dev) return;
      const targetY = (dev.startU - 1) * U_HEIGHT + (dev.uHeight * U_HEIGHT) / 2 + 0.3;
      if (this.controls) {
        this.controls.target.set(0, targetY, 0);
        this.camera.position.set(3.2, targetY + 0.8, 6.2);
        this.controls.update();
      }
      this.selectDevice(instanceId);
      this.showToast(`🔍 ${dev.name} (U${dev.startU}) odaklandı`);
    }

    loadTopologyFromProject(projectData) {
      if (!projectData) return;
      const rack = (projectData.racks && projectData.racks[0]) || projectData;
      if (!rack) return;

      if (typeof projectData.doorOpen === 'boolean') this.state.doorOpen = projectData.doorOpen;
      else if (typeof rack.doorOpen === 'boolean') this.state.doorOpen = rack.doorOpen;
      this.state.rackHeightU = rack.heightU || 42;
      this.state.devices = (rack.devices || []).map(d => {
        const catId = d.catalogKey || d.catalogId;
        const cat3D = (window.CATALOG_3D || []).find(c => c.id === catId);
        const cat2D = window.RackStudio && window.RackStudio.catalog && window.RackStudio.catalog[catId];
        const cat = cat3D || cat2D || {};
        const portDefinitions = Array.isArray(cat.ports) ? cat.ports.map(port => ({
          id: port.id,
          name: port.name,
          type: port.type || 'rj45',
          group: port.group,
          row: port.row
        })) : [];
        const uH = d.uHeight || cat.u || 1;
        const startU = d.startU !== undefined ? d.startU : (d.topU !== undefined ? d.topU - uH + 1 : 1);
        return {
          id: d.instanceId || d.id || ('dev-' + Math.random().toString(36).substr(2, 9)),
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
          faceplateStyle: cat.faceplateStyle || ''
        };
      });

      const resolvePortIndex = (endpoint, devId) => {
        const device = this.state.devices.find(d => d.id === devId);
        const catalog = (window.RackStudio && window.RackStudio.catalog && device && window.RackStudio.catalog[device.catalogId]) ||
          (window.CATALOG_3D || []).find(item => device && item.id === device.catalogId) || {};
        const ports = catalog.ports || [];
        const byId = ports.findIndex(port => port.id === (endpoint && endpoint.portId));
        if (byId >= 0) return byId + 1;
        const saved = Number(endpoint && endpoint.portIdx);
        if (Number.isInteger(saved) && saved >= 1 && (!ports.length || saved <= ports.length)) return saved;
        return 1;
      };

      this.state.cables = (projectData.cables || []).map(c => {
        const fromDev = (c.from && (c.from.instanceId || c.from.deviceId || c.from.devId)) || '';
        const toDev = (c.to && (c.to.instanceId || c.to.deviceId || c.to.devId)) || '';
        const fromP = resolvePortIndex(c.from, fromDev);
        const toP = resolvePortIndex(c.to, toDev);
        return {
          id: c.id || ('cbl-' + Math.random().toString(36).substr(2, 9)),
          name: c.name || 'Kablo',
          note: c.note || '',
          color: typeof c.color === 'number' ? c.color : (parseInt((c.color || '#00d2ff').replace('#', ''), 16) || 0x00d2ff),
          lengthM: c.lengthMeters || c.lengthM || 1.5,
          from: { devId: fromDev, portIdx: fromP || 1, portId: (c.from && c.from.portId) || undefined },
          to: { devId: toDev, portIdx: toP || 1, portId: (c.to && c.to.portId) || undefined }
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
    }

    buildDevice3D(dev) {
      const devGroup = new THREE.Group();
      devGroup.name = dev.id;

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

      // 4. Dynamic Blinking LEDs (Restricted to FAR LEFT: x from -2.14 to -1.6, bottom row)
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
          // Positioned under the brand badge on bottom-left - NO OVERLAP WITH PORTS OR TEXT!
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

      // 4b. 3D Metal D-Ring Cable Management Brackets (Matching user reference photo)
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

          // Bottom support arm extending forward
          const botArm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ringDepth), ringMat);
          botArm.position.set(0, -ringH / 2, ringDepth / 2);
          bracketGroup.add(botArm);

          // Front vertical retaining bar
          const frontBar = new THREE.Mesh(new THREE.BoxGeometry(0.06, ringH, 0.03), ringMat);
          frontBar.position.set(0, 0, ringDepth);
          bracketGroup.add(frontBar);

          // Top retaining arms with open slot (lip) for feeding cables in
          const topArmLeft = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ringDepth * 0.38), ringMat);
          topArmLeft.position.set(0, ringH / 2, ringDepth * 0.81);
          bracketGroup.add(topArmLeft);

          const topArmBack = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.03, ringDepth * 0.38), ringMat);
          topArmBack.position.set(0, ringH / 2, ringDepth * 0.19);
          bracketGroup.add(topArmBack);

          devGroup.add(bracketGroup);
        });
      }

      // 5. Interactive 3D Ports (Strictly positioned from x = -0.65 to +2.0, ZERO overlap with left brand text!)
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

          // Port role & custom trunk configuration
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

      devGroup.position.set(0, yPos, zPos);
      this.devicesGroup.add(devGroup);
    }

    rebuildAllDevices() {
      while (this.devicesGroup.children.length > 0) {
        this.devicesGroup.remove(this.devicesGroup.children[0]);
      }
      this.ledObjects = [];
      this.state.devices.forEach(d => this.buildDevice3D(Object.assign(d, { deviceLabelMode: this.state.deviceLabelMode })));
    }

    // --- 3D CABLING WITH PHYSICS GRAVITY SAG & NAMING ---
    getPortWorldPosition(devId, portIdx) {
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
    }

    connectPorts(from, to, colorHex, customName, customNote) {
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
    }

    updatePortConfig(devId, portIdx, config) {
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
    }

    updateCable(cableId, data) {
      const cable = this.state.cables.find(c => c.id === cableId);
      if (!cable) return false;

      if (data.name !== undefined) cable.name = data.name.trim() || cable.name;
      if (data.note !== undefined) cable.note = data.note.trim();
      if (data.color !== undefined) cable.color = data.color;

      this.rebuildAllCables();
      this.state.pushSnapshot();
      this.showToast(`Kablo Güncellendi: "${cable.name}"`);
      return true;
    }

    removeCable(cableId) {
      this.state.cables = this.state.cables.filter(c => c.id !== cableId);
      this.rebuildAllCables();
      this.state.pushSnapshot();
      sfx.delete();
    }

    updateDeviceConfig(instanceId, config) {
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
    }

    setPerformanceMode(mode, persist = true) {
      const profiles = {
        eco: { pixelRatio: 0.75, fps: 30, shadows: false, shadowSize: 256, ledMs: 500, damping: false },
        balanced: { pixelRatio: 1, fps: 45, shadows: true, shadowSize: 512, ledMs: 200, damping: true },
        quality: { pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5), fps: 60, shadows: true, shadowSize: 1024, ledMs: 100, damping: true }
      };
      const selectedMode = Object.hasOwn(profiles, mode) ? mode : 'balanced';
      const profile = profiles[selectedMode];
      this.state.performanceMode = selectedMode;
      this.renderer.setPixelRatio(profile.pixelRatio);
      this.renderer.shadowMap.enabled = profile.shadows;
      this.targetFrameInterval = 1000 / profile.fps;
      this.ledUpdateInterval = profile.ledMs;
      if (this.controls) this.controls.enableDamping = profile.damping;
      if (this.lights.keyLight) {
        this.lights.keyLight.castShadow = profile.shadows;
        if (this.lights.keyLight.shadow.mapSize.width !== profile.shadowSize) {
          this.lights.keyLight.shadow.mapSize.set(profile.shadowSize, profile.shadowSize);
          if (this.lights.keyLight.shadow.map) this.lights.keyLight.shadow.map.dispose();
          this.lights.keyLight.shadow.map = null;
        }
      }
      this.renderer.setSize(this.container.clientWidth || window.innerWidth, this.container.clientHeight || window.innerHeight);
      if (persist) {
        localStorage.setItem('rack-studio-3d-performance-mode', selectedMode);
        this.state.autoSave();
        this.showToast(`3D kalite profili: ${selectedMode === 'eco' ? 'Ekonomi' : selectedMode === 'quality' ? 'Yüksek' : 'Dengeli'}`);
      }
      return selectedMode;
    }

    updateDeviceMetadata(instanceId, metadata) {
      return this.updateDeviceConfig(instanceId, {
        name: String(metadata.name || '').trim(),
        hostname: String(metadata.name || '').trim(),
        ipAddress: String(metadata.ipAddress || '').trim(),
        macAddress: String(metadata.macAddress || '').trim(),
        serialNumber: String(metadata.serialNumber || '').trim(),
        panelLabel: String(metadata.panelLabel || '').trim()
      });
    }

    setDeviceLabelMode(mode) {
      if (!['name', 'ip', 'mac', 'all', 'none'].includes(mode)) return false;
      this.state.deviceLabelMode = mode;
      localStorage.setItem('rack-studio-device-label-mode', mode);
      this.rebuildAllDevices();
      return true;
    }

    buildCable3D(cable) {
      const pA = this.getPortWorldPosition(cable.from.devId, cable.from.portIdx);
      const pB = this.getPortWorldPosition(cable.to.devId, cable.to.portIdx);
      if (!pA || !pB) return;

      // Realistic RJ45 strain-relief boot collar extending straight out of the port
      const bootMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7, metalness: 0.15 });
      const bootGeo = new THREE.BoxGeometry(0.065, 0.055, 0.12);

      const bootA = new THREE.Mesh(bootGeo, bootMat);
      bootA.position.copy(pA).add(new THREE.Vector3(0, 0, 0.06));
      this.cablesGroup.add(bootA);

      const bootB = new THREE.Mesh(bootGeo, bootMat);
      bootB.position.copy(pB).add(new THREE.Vector3(0, 0, 0.06));
      this.cablesGroup.add(bootB);

      // Anti-clipping depth and sag staggering based on port indices
      const portIdxHash = (cable.from.portIdx || 1) * 7 + (cable.to.portIdx || 1) * 3;
      const zStagger = ((portIdxHash % 7) - 3) * 0.035; // distinct forward depth per port
      const sagStagger = ((portIdxHash % 5) - 2) * 0.02;

      const dy = Math.abs(pA.y - pB.y);
      const isNearU = dy <= U_HEIGHT * 2.2; // 1U to 2U adjacent run
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

      // Bilateral Dressing Rule (Enterprise standard):
      // 24-Port Switch / Panel: 1-12 Left (-1), 13-24 Right (+1)
      // 48-Port Switch: 1-24 Left (-1), 25-48 Right (+1)
      const getPortSideSign = (portIdx, totalPorts) => {
        const mid = Math.ceil(totalPorts / 2);
        return portIdx <= mid ? -1 : 1;
      };
      const sideSignA = getPortSideSign(portIdxA, pCountA);
      const sideSignB = getPortSideSign(portIdxB, pCountB);

      // Dedicated Left/Right D-Ring Alignment (Excludes center X=0 so no cables drop vertically down the middle)
      const getNearestRingX = (px, sideSign) => {
        const candidates = sideSign < 0 ? [-1.6, -0.8] : [0.8, 1.6];
        let best = candidates[0];
        let minD = Math.abs(px - best);
        for (let i = 1; i < candidates.length; i++) {
          const d = Math.abs(px - candidates[i]);
          if (d < minD) {
            minD = d;
            best = candidates[i];
          }
        }
        return best;
      };
      const ringXA = getNearestRingX(pA.x, sideSignA);
      const ringXB = getNearestRingX(pB.x, sideSignB);

      // Converts sharp 90-degree corner waypoints into smooth circular fillets (prevents Catmull-Rom kinks)
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

          // If collinear or 180 reverse, preserve without bevel
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
      // 1. Port A exit (straight out of boot with strain relief)
      rawPoints.push(pA.clone());
      const pAOut = pA.clone().add(new THREE.Vector3(0, 0, 0.12));
      rawPoints.push(pAOut);

      if (this.state.cableRoutingMode === 'structured' && organizerYs.length) {
        const ringLaneY = ((portIdxHash % 7) - 3) * 0.016;
        const ringLaneZ = ((portIdxHash % 5) - 2) * 0.018;
        const entryY = organizerYs[0] + ringLaneY;
        const exitY = organizerYs[organizerYs.length - 1] + ringLaneY;

        // Side channels are strictly outside the 19" equipment rail width
        const sideXA = sideSignA * (RAIL_WIDTH / 2 + 0.24 + ((portIdxHash % 6) - 2.5) * 0.025);
        const ringChannelZ = Math.max(pA.z, pB.z) + 0.26 + ringLaneZ;
        const frontTransitionZ = Math.max(pA.z, pB.z) + 0.16;

        // 1. Straight vertical waterfall drop from Port A at column X = pA.x into tray
        const dropSignA = pA.y >= entryY ? 1 : -1;
        rawPoints.push(new THREE.Vector3(pA.x, entryY + dropSignA * 0.08, frontTransitionZ));
        rawPoints.push(new THREE.Vector3(pA.x, entryY, ringChannelZ));

        // 2. Horizontal sweep inside D-Ring tray A to assigned ring bracket
        rawPoints.push(new THREE.Vector3(ringXA, entryY, ringChannelZ));

        // 3. Horizontal sweep to the side vertical wire manager (outside the rack rails)
        rawPoints.push(new THREE.Vector3(sideXA, entryY, ringChannelZ));

        // 4. Pure vertical drop/rise in the side vertical wire manager (ONLY if different U heights)
        if (Math.abs(entryY - exitY) > 0.05) {
          rawPoints.push(new THREE.Vector3(sideXA, exitY, ringChannelZ));
        }

        // 5. At destination tray (exitY): horizontal sweep from sideXA to target ringXB
        rawPoints.push(new THREE.Vector3(ringXB, exitY, ringChannelZ));

        // 6. Horizontal sweep to target port column X = pB.x
        rawPoints.push(new THREE.Vector3(pB.x, exitY, ringChannelZ));

        // 7. Straight vertical rise/drop from tray into Port B at column X = pB.x
        const dropSignB = pB.y >= exitY ? 1 : -1;
        rawPoints.push(new THREE.Vector3(pB.x, exitY + dropSignB * 0.08, frontTransitionZ));
      } else if (isNearU) {
        // Natural drape between adjacent units (graceful catenary loop)
        const midX = (pA.x + pB.x) / 2;
        const midY = Math.min(pA.y, pB.y);
        const naturalSag = Math.min(0.24, 0.08 + dy * 0.15) + sagStagger;
        const forwardClearance = Math.max(pA.z, pB.z) + 0.16 + zStagger;

        rawPoints.push(new THREE.Vector3(pA.x + (midX - pA.x) * 0.3, pA.y - naturalSag * 0.6, forwardClearance));
        rawPoints.push(new THREE.Vector3(midX, midY - naturalSag, forwardClearance + 0.02));
        rawPoints.push(new THREE.Vector3(pB.x + (midX - pB.x) * 0.3, pB.y - naturalSag * 0.6, forwardClearance));
      } else if (this.state.cableRoutingMode === 'structured') {
        // Structured cabling through vertical channel without D-rings
        const chosenSide = sideSignA;
        const sideX = chosenSide * (RAIL_WIDTH / 2 + 0.22 + ((portIdxHash % 6) - 2.5) * 0.03);
        const zChannel = Math.max(pA.z, pB.z) + 0.20 + zStagger;
        const midY = (pA.y + pB.y) / 2;

        rawPoints.push(new THREE.Vector3(sideX - chosenSide * 0.2, pA.y - 0.08, zChannel));
        rawPoints.push(new THREE.Vector3(sideX, pA.y - 0.15, zChannel));
        rawPoints.push(new THREE.Vector3(sideX, midY, zChannel + 0.02));
        rawPoints.push(new THREE.Vector3(sideX, pB.y - 0.15, zChannel));
        rawPoints.push(new THREE.Vector3(sideX - chosenSide * 0.2, pB.y - 0.08, zChannel));
      } else {
        // Direct catenary run
        const mid = new THREE.Vector3().addVectors(pA, pB).multiplyScalar(0.5);
        const sag = Math.min(1.2, dy * 0.22 + 0.2) + sagStagger;
        const forwardClearance = Math.max(pA.z, pB.z) + 0.22 + zStagger;
        rawPoints.push(new THREE.Vector3(mid.x, mid.y - sag, forwardClearance));
      }

      // Target port entry (straight into boot)
      const pBOut = pB.clone().add(new THREE.Vector3(0, 0, 0.12));
      rawPoints.push(pBOut);
      rawPoints.push(pB.clone());

      // Convert sharp angles into filleted circular bevels
      const points = filletPath(rawPoints, 0.075);

      // Centripetal catmull-rom curve guarantees zero self-intersecting loops and smooth curvature
      const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.5);
      const curveLen = curve.getLength();
      
      // Slender realistic patch cord with 12 radial segments for a silky-smooth cylindrical profile
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
    }

    getCableEndpointLabel(cable) {
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
    }

    rebuildAllCables() {
      while (this.cablesGroup.children.length > 0) {
        this.cablesGroup.remove(this.cablesGroup.children[0]);
      }
      this.state.cables.forEach(c => this.buildCable3D(c));
    }

    // --- NAVIGATION API (D-Pad, Zoom, Vertical Pan) ---
    panCamera(deltaX, deltaY) {
      this.camera.position.x += deltaX;
      this.controls.target.x += deltaX;
      this.camera.position.y += deltaY;
      this.controls.target.y += deltaY;
      this.controls.update();
    }

    zoomCamera(deltaZoom) {
      const dir = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).normalize();
      this.camera.position.addScaledVector(dir, deltaZoom);
      this.controls.update();
    }

    scrollRackToU(targetU) {
      targetU = Math.max(1, Math.min(this.state.rackHeightU, targetU));
      const targetY = (targetU - 0.5) * U_HEIGHT + 0.3;
      const curDiff = this.camera.position.y - this.controls.target.y;
      this.controls.target.y = targetY;
      this.camera.position.y = targetY + curDiff;
      this.controls.update();
    }

    // --- INTERACTION & RAYCASTING ---
    initEvents() {
      const dom = this.renderer.domElement;

      window.addEventListener('resize', () => {
        const w = this.container.clientWidth;
        const h = this.container.clientHeight;
        if (!w || !h || (w === this._lastW && h === this._lastH)) return;
        this._lastW = w;
        this._lastH = h;
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      });

      dom.addEventListener('mousemove', (e) => {
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.handleHover(e);
      });

      dom.addEventListener('click', (e) => {
        this.handleClick(e);
      });

      dom.addEventListener('dblclick', (e) => {
        this.handleDoubleClick(e);
      });

      let isSpaceDown = false;
      dom.addEventListener('mousedown', () => {
        if (isSpaceDown) dom.style.cursor = 'grabbing';
      });
      dom.addEventListener('mouseup', () => {
        if (isSpaceDown) dom.style.cursor = 'grab';
      });
      window.addEventListener('keydown', (e) => {
        if ((e.code === 'Delete' || e.code === 'Backspace') && this.selectedDeviceId && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
          e.preventDefault();
          const dev = this.state.devices.find(d => d.id === this.selectedDeviceId);
          const devName = dev ? dev.name : 'Cihaz';
          this.removeDevice(this.selectedDeviceId);
          this.showToast(`🗑️ "${devName}" kabinden söküldü.`);
          return;
        }
        if (e.code === 'Escape') {
          this.deselectDevice();
        }
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
          e.preventDefault();
          if (!isSpaceDown) {
            isSpaceDown = true;
            this.controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
            dom.style.cursor = 'grab';
          }
        }
      });

      window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
          isSpaceDown = false;
          this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
          dom.style.cursor = 'default';
        }
      });

      window.addEventListener('blur', () => {
        if (isSpaceDown) {
          isSpaceDown = false;
          this.controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
          dom.style.cursor = 'default';
        }
      });

      dom.addEventListener('mousedown', (e) => {
        if (isSpaceDown && e.button === 0) {
          dom.style.cursor = 'grabbing';
        }
      });

      dom.addEventListener('mouseup', () => {
        if (isSpaceDown) {
          dom.style.cursor = 'grab';
        }
      });

      // Shift + Wheel to scroll rack up & down smoothly
      dom.addEventListener('wheel', (e) => {
        if (e.shiftKey) {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -1.0 : 1.0;
          this.panCamera(0, delta);
        }
      }, { passive: false });

      // Right-click (Context Menu) on port opens Port Configuration Modal
      dom.addEventListener('contextmenu', (e) => {
        const rect = dom.getBoundingClientRect();
        this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this.raycaster.setFromCamera(this.mouse, this.camera);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);
        for (const hit of intersects) {
          if (hit.object.userData && hit.object.userData.isPort) {
            e.preventDefault();
            e.stopPropagation();
            sfx.click();
            if (window.PortConfigEditor) {
              window.PortConfigEditor.open(hit.object.userData.devId, hit.object.userData.portIdx, '3d');
            }
            return;
          }
        }
      });
    }

    handleHover(e) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);

      let foundPort = null;
      let foundCable = null;

      for (const hit of intersects) {
        if (hit.object.userData && hit.object.userData.isPort) {
          foundPort = hit.object;
          break;
        }
        if (hit.object.userData && hit.object.userData.isCable) {
          foundCable = hit.object;
          break;
        }
      }

      if (this.hoveredPortMesh && this.hoveredPortMesh !== foundPort) {
        const isFirstSelected = this.state.activePort &&
          this.hoveredPortMesh.userData.devId === this.state.activePort.devId &&
          this.hoveredPortMesh.userData.portIdx === this.state.activePort.portIdx;

        if (!isFirstSelected) {
          const isTrunk = this.hoveredPortMesh.userData.isTrunk;
          const cfgColor = this.hoveredPortMesh.userData.trunkConfig && this.hoveredPortMesh.userData.trunkConfig.color;
          const normalEmissive = isTrunk ? (cfgColor ? parseInt(cfgColor.replace('#', '0x'), 16) : 0xa855f7) : 0x000000;
          this.hoveredPortMesh.material.emissive.setHex(normalEmissive);
          this.hoveredPortMesh.material.emissiveIntensity = isTrunk ? 0.45 : 0;
        }
        this.hoveredPortMesh = null;
      }

      const tooltip = document.getElementById('studio-tooltip');
      if (foundPort) {
        document.body.style.cursor = 'pointer';
        foundPort.material.emissive.setHex(0x00e5ff);
        foundPort.material.emissiveIntensity = 0.9;
        this.hoveredPortMesh = foundPort;

        const dName = foundPort.userData.devName;
        const pIdx = foundPort.userData.portIdx;
        const pType = (foundPort.userData.portType || 'rj45').toUpperCase();
        const isTrunk = foundPort.userData.isTrunk;
        const pCfg = foundPort.userData.trunkConfig;

        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.style.left = (e.clientX + 16) + 'px';
          tooltip.style.top = (e.clientY + 16) + 'px';

          let trunkBanner = '';
          if (isTrunk && pCfg) {
            const tColor = pCfg.color || '#a855f7';
            const ciscoLabel = pCfg.ciscoName ? ` · <span style="font-family:monospace; color:#ffffff;">${escapeTooltipHtml(pCfg.ciscoName)}</span>` : '';
            const vlanLabel = pCfg.vlan ? `<div style="font-size:11px; color:#e2e8f0; margin-top:2px;"><b>VLAN:</b> ${escapeTooltipHtml(pCfg.vlan)}</div>` : '';
            const descLabel = pCfg.description ? `<div style="font-size:11px; color:#94a3b8; font-style:italic;">"${escapeTooltipHtml(pCfg.description)}"</div>` : '';
            trunkBanner = `
              <div style="background:rgba(168,85,247,0.15); border-left:3px solid ${tColor}; padding:3px 6px; margin:4px 0; border-radius:2px;">
                <span style="color:${tColor}; font-weight:bold; font-size:11px;">⚡ 802.1Q TRUNK${ciscoLabel}</span>
                ${vlanLabel}
                ${descLabel}
              </div>
            `;
          }

          tooltip.innerHTML = `<strong>${escapeTooltipHtml(dName)}</strong><br>Port #${pIdx} (${pType})${trunkBanner}<span style="color:#00e5ff;font-size:11px;">Bağla: Sol Tık · Yapılandır: <b>Sağ Tık / Shift+Tık</b></span>`;
        }
      } else if (foundCable) {
        document.body.style.cursor = 'pointer';
        if (tooltip) {
          tooltip.style.display = 'block';
          tooltip.style.left = (e.clientX + 16) + 'px';
          tooltip.style.top = (e.clientY + 16) + 'px';
          const cName = foundCable.userData.cableName || 'Kablo';
          const cLen = foundCable.userData.lengthM || 0;
          const endpointLabel = foundCable.userData.endpointLabel || 'Uç bilgisi bulunamadı';
          tooltip.innerHTML = `<strong>🏷️ ${escapeTooltipHtml(cName)}</strong><br><span style="color:#00e5ff;font-weight:700;">${escapeTooltipHtml(endpointLabel)}</span><br>Uzunluk: ${Number(cLen).toFixed(1)}m<br><span style="color:#f59e0b;font-size:11px;">Düzenlemek için çift tıklayın</span>`;
        }
      } else {
        document.body.style.cursor = 'default';
        if (tooltip) tooltip.style.display = 'none';
      }
    }

    handleClick(e) {
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const intersects = this.raycaster.intersectObjects(this.scene.children, true);

      for (const hit of intersects) {
        // 1. Port Click
        if (hit.object.userData && hit.object.userData.isPort) {
          const portData = hit.object.userData;

          // Shift + Click opens Port Configuration Modal
          if (e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            sfx.click();
            if (window.PortConfigEditor) {
              window.PortConfigEditor.open(portData.devId, portData.portIdx, '3d');
            }
            return;
          }

          if (!this.state.activePort) {
            this.state.activePort = { devId: portData.devId, portIdx: portData.portIdx };
            hit.object.material.emissive.setHex(0xf59e0b);
            hit.object.material.emissiveIntensity = 1.0;
            sfx.click();
            this.showToast(`1. Uç: ${portData.devName} (Port ${portData.portIdx}). Şimdi 2. uca tıklayın.`);
          } else {
            const from = this.state.activePort;
            const to = { devId: portData.devId, portIdx: portData.portIdx };
            this.state.activePort = null;
            const cable = this.connectPorts(from, to);
            if (cable) {
              this.showToast(`Bağlantı Kuruldu: ${cable.name} (${cable.lengthM}m)`);
            }
          }
          return;
        }

        // 2. Cable single-click is reserved for hover/selection feedback.
        // Editing is deliberately handled by handleDoubleClick.
        if (hit.object.userData && hit.object.userData.isCable) {
          sfx.click();
          return;
        }

        // 3. Device Body Click -> Select device and open Context
        if (hit.object.userData && hit.object.userData.isDeviceBody) {
          const devId = hit.object.userData.devId;
          this.selectDevice(devId);
          sfx.click();
          if (window.openDeviceContext) {
            window.openDeviceContext(devId, e.clientX, e.clientY);
          }
          return;
        }
      }

      // Clicked on empty background -> deselect
      this.deselectDevice();
      const devContext = document.getElementById('device-context-toolbar');
      if (devContext) devContext.style.display = 'none';
    }

    handleDoubleClick(e) {
      const rect = this.renderer.domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.raycaster.setFromCamera(this.mouse, this.camera);
      const hit = this.raycaster.intersectObjects(this.cablesGroup.children, true)
        .find(item => item.object.userData && item.object.userData.isCable);
      if (!hit) return;

      e.preventDefault();
      e.stopPropagation();
      sfx.click();
      if (window.openCableModal) {
        window.openCableModal(hit.object.userData.cableId);
      }
    }

    showToast(msg) {
      const toast = document.getElementById('studio-toast');
      if (toast) {
        toast.textContent = msg;
        toast.style.display = 'block';
        toast.style.opacity = '1';
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => {
          toast.style.opacity = '0';
          setTimeout(() => toast.style.display = 'none', 300);
        }, 3500);
      }
    }

    // --- PRESETS ---
    loadPresetMDF() {
      this.state.devices = [];
      this.state.cables = [];

      this.mountDevice('patch-cat6a-24p', 40);
      this.mountDevice('cisco-c9300-48p', 38);
      this.mountDevice('cable-manager-1u', 37);
      this.mountDevice('patch-cat6a-24p', 35);
      this.mountDevice('cisco-c9500-32qc', 33);
      this.mountDevice('cable-manager-1u', 32);
      this.mountDevice('cisco-isr4451', 28);
      this.mountDevice('dell-r750', 20);
      this.mountDevice('hpe-dl380-g10', 16);
      this.mountDevice('blank-panel-1u', 12);
      this.mountDevice('pdu-1u-8c13', 2);

      const dPatch = this.state.devices.find(d => d.catalogId === 'patch-cat6a-24p');
      const dSwitch = this.state.devices.find(d => d.catalogId === 'cisco-c9300-48p');
      const dRouter = this.state.devices.find(d => d.catalogId === 'cisco-isr4451');
      const dSpine = this.state.devices.find(d => d.catalogId === 'cisco-c9500-32qc');

      if (dPatch && dSwitch) {
        for (let i = 1; i <= 6; i++) {
          this.connectPorts(
            { devId: dPatch.id, portIdx: i },
            { devId: dSwitch.id, portIdx: i },
            CABLE_COLORS[(i - 1) % CABLE_COLORS.length].hex,
            `Patch-P${i} ➔ Switch-P${i}`
          );
        }
      }

      if (dSwitch && dRouter) {
        this.connectPorts(
          { devId: dSwitch.id, portIdx: 48 },
          { devId: dRouter.id, portIdx: 1 },
          0xef4444,
          'Uplink-Core-to-WAN'
        );
      }

      if (dSwitch && dSpine) {
        this.connectPorts(
          { devId: dSwitch.id, portIdx: 47 },
          { devId: dSpine.id, portIdx: 1 },
          0xf97316,
          '100G-Spine-Trunk'
        );
      }

      this.state.pushSnapshot();
    }

    // --- CAMERA PRESET VIEWS ---
    setCameraView(mode) {
      const midY = (this.state.rackHeightU * U_HEIGHT) / 2 + 0.3;
      switch (mode) {
        case 'front':
          this.camera.position.set(0, midY, 11.5);
          this.controls.target.set(0, midY, 0);
          break;
        case 'rear':
          this.camera.position.set(0, midY, -11.5);
          this.controls.target.set(0, midY, 0);
          break;
        case 'iso':
          this.camera.position.set(7.5, midY + 1.8, 12.0);
          this.controls.target.set(0, midY, 0);
          break;
        case 'top':
          this.camera.position.set(0, midY + 14.0, 0.1);
          this.controls.target.set(0, midY, 0);
          break;
        case 'focus':
          this.camera.position.set(0, midY + 4.2, 5.8);
          this.controls.target.set(0, midY + 4.2, 0);
          break;
      }
      this.controls.update();
      sfx.click();
    }

    pause() {
      this.isPaused = true;
      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
        this.animFrameId = null;
      }
    }

    resume() {
      if (!this.isPaused) return;
      this.isPaused = false;
      this.lastTime = performance.now();
      this.animate();
    }

    // --- ANIMATION LOOP (Sustained 60 FPS) ---
    animate() {
      if (this.isPaused) return;
      this.animFrameId = requestAnimationFrame(() => this.animate());

      const now = performance.now();
      if (now - this.lastRenderTime < this.targetFrameInterval) return;
      this.lastRenderTime = now;
      this.frameCount++;
      if (now - this.lastTime >= 1000) {
        this.fps = Math.round((this.frameCount * 1000) / (now - this.lastTime));
        this.frameCount = 0;
        this.lastTime = now;
        const fpsEl = document.getElementById('fps-counter');
        if (fpsEl) fpsEl.textContent = this.fps + ' FPS';
      }

      // Throttle LED updates to every 100ms (10 FPS update rate) instead of every frame
      if (now - this.lastLedUpdate >= this.ledUpdateInterval) {
        this.lastLedUpdate = now;
        this.ledObjects.forEach(led => {
          if (!led.isPower) {
            led.blinkTimer--;
            if (led.blinkTimer <= 0) {
              const isOn = led.mesh.material.color.getHex() === led.baseColor;
              led.mesh.material.color.setHex(isOn ? led.offColor : led.baseColor);
              led.mesh.material.emissive.setHex(isOn ? led.offColor : led.baseColor);
              led.blinkTimer = Math.floor(Math.random() * 5) + 1;
            }
          }
        });
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    }
  }

  // Export to global scope
  window.Studio3D = Studio3D;
  window.CATALOG_3D = CATALOG;
  window.CABLE_COLORS_3D = CABLE_COLORS;

// Export to global window scope for compatibility
window.Studio3D = Studio3D;
window.CATALOG_3D = CATALOG;
window.CABLE_COLORS_3D = CABLE_COLORS;

export { Studio3D };
