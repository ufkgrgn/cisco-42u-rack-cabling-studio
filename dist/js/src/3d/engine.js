/**
 * Cisco Enterprise 3D Rack & Datacenter Engine (WebGL / Three.js)
 * Modularized architecture: Core orchestrator, event loop, and viewport interaction.
 */
import { sfx } from './audio.js';
import { escapeTooltipHtml } from './helpers.js';
import { 
  CATALOG, 
  CABLE_COLORS, 
  U_HEIGHT 
} from './catalog3d.js';
import { StudioState } from './state3d.js';
import { registerRackSceneMethods } from './rack-scene-builder.js';
import { registerDeviceMeshMethods } from './device-mesh-builder.js';
import { registerCableMeshMethods } from './cable-mesh-builder.js';

// --- 3D SCENE & ENGINE ---
class Studio3D {
  constructor(container) {
    this.container = container;
    this.state = new StudioState();
    this.ledObjects = [];
    this.rackGroup = null;
    this.doorGroup = null;
    this.doorGroups = [];
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
    this.isDirty = true;
    this.interactiveTargets = [];
    this._hoverRafId = null;
    this._lastHoverEvent = null;

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
    this.updateInteractiveTargets();

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
    this.controls.addEventListener('change', () => { this.isDirty = true; });

    // High-end multi-point studio & datacenter lighting
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
      this._lastHoverEvent = e;
      if (!this._hoverRafId) {
        this._hoverRafId = requestAnimationFrame(() => {
          this._hoverRafId = null;
          if (this._lastHoverEvent) {
            this.handleHover(this._lastHoverEvent);
          }
        });
      }
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden || window.is3DMode === false) {
        this.pause();
      } else {
        this.resume();
      }
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
      const targets = (this.interactiveTargets && this.interactiveTargets.length) ? this.interactiveTargets : [this.devicesGroup, this.cablesGroup];
      const intersects = this.raycaster.intersectObjects(targets, true);
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

  updateInteractiveTargets() {
    const targets = [];
    if (this.devicesGroup) {
      this.devicesGroup.traverse(child => {
        if (child.userData && (child.userData.isPort || child.userData.isDeviceBody)) {
          targets.push(child);
        }
      });
    }
    if (this.cablesGroup) {
      this.cablesGroup.traverse(child => {
        if (child.userData && child.userData.isCable) {
          targets.push(child);
        }
      });
    }
    this.interactiveTargets = targets;
  }

  handleHover(e) {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const targets = (this.interactiveTargets && this.interactiveTargets.length) ? this.interactiveTargets : [this.devicesGroup, this.cablesGroup];
    const intersects = this.raycaster.intersectObjects(targets, true);

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
    const targets = (this.interactiveTargets && this.interactiveTargets.length) ? this.interactiveTargets : [this.devicesGroup, this.cablesGroup];
    const intersects = this.raycaster.intersectObjects(targets, true);

    for (const hit of intersects) {
      // 1. Port Click
      if (hit.object.userData && hit.object.userData.isPort) {
        const portData = hit.object.userData;

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

      // 2. Cable click reserved for double click
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

    const silentOpt = { silent: true };
    this.mountDevice('patch-cat6a-24p', 40, null, silentOpt);
    this.mountDevice('cisco-c9300-48p', 38, null, silentOpt);
    this.mountDevice('cable-manager-1u', 37, null, silentOpt);
    this.mountDevice('patch-cat6a-24p', 35, null, silentOpt);
    this.mountDevice('cisco-c9500-32qc', 33, null, silentOpt);
    this.mountDevice('cable-manager-1u', 32, null, silentOpt);
    this.mountDevice('cisco-isr4451', 28, null, silentOpt);
    this.mountDevice('dell-r750', 20, null, silentOpt);
    this.mountDevice('hpe-dl380-g10', 16, null, silentOpt);
    this.mountDevice('blank-panel-1u', 12, null, silentOpt);
    this.mountDevice('pdu-1u-8c13', 2, null, silentOpt);

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
          `Patch-P${i} ➔ Switch-P${i}`,
          '',
          silentOpt
        );
      }
    }

    if (dSwitch && dRouter) {
      this.connectPorts(
        { devId: dSwitch.id, portIdx: 48 },
        { devId: dRouter.id, portIdx: 1 },
        0xef4444,
        'Uplink-Core-to-WAN',
        '',
        silentOpt
      );
    }

    if (dSwitch && dSpine) {
      this.connectPorts(
        { devId: dSwitch.id, portIdx: 47 },
        { devId: dSpine.id, portIdx: 1 },
        0xf97316,
        '100G-Spine-Trunk',
        '',
        silentOpt
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
    if (!this.isPaused || document.hidden || window.is3DMode === false) return;
    this.isHibernated = false;
    this.isPaused = false;
    this.lastTime = performance.now();
    this.animate();
  }

  hibernate() {
    this.pause();
    this.isHibernated = true;
    this.renderer?.setSize(1, 1, false);
  }

  wake() {
    this.isHibernated = false;
    this.resume();
  }

  // --- ANIMATION LOOP (Sustained 60 FPS) ---
  markDirty() {
    this.isDirty = true;
  }

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

    let ledChanged = false;
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
            ledChanged = true;
          }
        }
      });
    }

    const controlsMoved = this.controls.update();
    if (controlsMoved || ledChanged) {
      this.isDirty = true;
    }

    if (!this.isDirty) return;

    this.renderer.render(this.scene, this.camera);
    this.isDirty = false;
  }
}

// Register modular methods onto prototype
registerRackSceneMethods(Studio3D);
registerDeviceMeshMethods(Studio3D);
registerCableMeshMethods(Studio3D);

// Export to global scope
window.Studio3D = Studio3D;
window.CATALOG_3D = CATALOG;
window.CABLE_COLORS_3D = CABLE_COLORS;

export { Studio3D };
