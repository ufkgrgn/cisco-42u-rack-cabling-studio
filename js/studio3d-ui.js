"use strict";
(() => {
  // js/src/3d-ui/cameraControls.js
  function initCameraControls(studio) {
    const camButtons = {
      "cam-iso": "iso",
      "cam-front": "front",
      "cam-rear": "rear",
      "cam-top": "top",
      "cam-focus": "focus"
    };
    Object.entries(camButtons).forEach(([btnId, mode]) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          document.querySelectorAll(".cam-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          studio.setCameraView(mode);
        });
      }
    });
    const btnDoor2 = document.getElementById("btn-door-toggle");
    if (btnDoor2) {
      btnDoor2.classList.toggle("active", studio.state.doorOpen);
      btnDoor2.innerHTML = studio.state.doorOpen ? "\u{1F6AA} Kapak: A\xE7\u0131k" : "\u{1F6AA} Kapak: Kapal\u0131";
      btnDoor2.addEventListener("click", () => {
        const next = !studio.state.doorOpen;
        studio.setDoorOpen(next);
        btnDoor2.classList.toggle("active", next);
        btnDoor2.innerHTML = next ? "\u{1F6AA} Kapak: A\xE7\u0131k" : "\u{1F6AA} Kapak: Kapal\u0131";
        studio.showToast(next ? "Kabin Cam Kapa\u011F\u0131 A\xE7\u0131ld\u0131" : "Kabin Cam Kapa\u011F\u0131 Kapat\u0131ld\u0131");
      });
    }
    const btnRouting = document.getElementById("btn-routing-toggle");
    if (btnRouting) {
      btnRouting.addEventListener("click", () => {
        const next = studio.state.cableRoutingMode === "catenary" ? "structured" : "catenary";
        studio.state.cableRoutingMode = next;
        studio.rebuildAllCables();
        btnRouting.innerHTML = next === "catenary" ? "\u3030\uFE0F Catenary Fizik" : "\u{1F532} Yap\u0131sal Kanal";
        studio.showToast(next === "catenary" ? "Kablolama: Yer\xE7ekimi Sarkma Fizi\u011Fi (Catenary)" : "Kablolama: 90\xB0 Yap\u0131sal Yan Kanal");
      });
    }
    const btnLighting = document.getElementById("btn-lighting-toggle");
    if (btnLighting) {
      const modes = ["studio", "datacenter", "cyberpunk"];
      const labels = {
        studio: "\u{1F4A1} St\xFCdyo I\u015F\u0131\u011F\u0131 (Net)",
        datacenter: "\u{1F3E2} Veri Merkezi",
        cyberpunk: "\u26A1 Cyberpunk Neon"
      };
      let currentIdx = 0;
      btnLighting.addEventListener("click", () => {
        currentIdx = (currentIdx + 1) % modes.length;
        const mode = modes[currentIdx];
        studio.setLightingMode(mode);
        btnLighting.innerHTML = labels[mode];
        studio.showToast(`I\u015F\u0131k Modu: ${labels[mode]}`);
      });
    }
    const uSlider = document.getElementById("rack-u-slider");
    const uDisplay = document.getElementById("rack-u-val");
    const rackNavSlider = document.getElementById("rack-nav-slider");
    if (uSlider) {
      uSlider.value = studio.state.rackHeightU;
      if (uDisplay) uDisplay.textContent = studio.state.rackHeightU + "U";
      uSlider.addEventListener("input", (e) => {
        const val = parseInt(e.target.value);
        if (uDisplay) uDisplay.textContent = val + "U";
        studio.setRackHeight(val);
        if (rackNavSlider) rackNavSlider.max = val;
      });
    }
    const dpadUp = document.getElementById("dpad-up");
    const dpadDown = document.getElementById("dpad-down");
    const dpadLeft = document.getElementById("dpad-left");
    const dpadRight = document.getElementById("dpad-right");
    const dpadReset = document.getElementById("dpad-reset");
    const navZoomIn = document.getElementById("btn-nav-zoom-in");
    const navZoomOut = document.getElementById("btn-nav-zoom-out");
    if (dpadUp) dpadUp.addEventListener("click", () => studio.panCamera(0, 1.4));
    if (dpadDown) dpadDown.addEventListener("click", () => studio.panCamera(0, -1.4));
    if (dpadLeft) dpadLeft.addEventListener("click", () => studio.panCamera(-1.4, 0));
    if (dpadRight) dpadRight.addEventListener("click", () => studio.panCamera(1.4, 0));
    if (dpadReset) dpadReset.addEventListener("click", () => studio.setCameraView("iso"));
    if (navZoomIn) navZoomIn.addEventListener("click", () => studio.zoomCamera(2.2));
    if (navZoomOut) navZoomOut.addEventListener("click", () => studio.zoomCamera(-2.2));
    if (rackNavSlider) {
      rackNavSlider.max = studio.state.rackHeightU;
      rackNavSlider.value = Math.floor(studio.state.rackHeightU / 2);
      rackNavSlider.addEventListener("input", (e) => {
        const targetU = parseInt(e.target.value);
        studio.scrollRackToU(targetU);
      });
    }
  }

  // js/src/3d-ui/catalogDrawer.js
  function initCatalogDrawer(studio) {
    const catalogList = document.getElementById("catalog-items-list");
    const searchInput2 = document.getElementById("catalog-search-input");
    let activeCategory = "all";
    function renderCatalog2(filterText = "") {
      if (!catalogList) return;
      catalogList.innerHTML = "";
      const norm = (s) => (s || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const query = norm(filterText);
      const items = window.CATALOG_3D.filter((item) => {
        const matchesCat = activeCategory === "all" || item.category === activeCategory;
        const matchesQuery = !query || norm(item.name).includes(query) || norm(item.desc).includes(query) || norm(item.manufacturer).includes(query);
        return matchesCat && matchesQuery;
      });
      if (items.length === 0) {
        catalogList.innerHTML = '<div style="padding:16px;text-align:center;color:#64748b;font-size:12px;">E\u015Fle\u015Fen donan\u0131m bulunamad\u0131.</div>';
        return;
      }
      items.forEach((item) => {
        const card = document.createElement("div");
        card.className = "catalog-card";
        const suggestedSlot = studio.findNextAvailableSlot(item.u) || 1;
        card.innerHTML = `
          <div class="catalog-card-header">
            <span class="catalog-card-name">${item.name}</span>
            <span class="catalog-card-u">${item.u}U</span>
          </div>
          <div class="catalog-card-desc">${item.desc}</div>
          <div class="catalog-card-mount">
            <span style="font-size:11px;color:#94a3b8;">U Slot:</span>
            <input type="number" class="slot-input" min="1" max="${studio.state.rackHeightU - item.u + 1}" value="${suggestedSlot}" title="Montaj yap\u0131lacak U slotu (Bo\u015F olan \xF6nerilmi\u015Ftir)">
            <button class="hud-btn btn-primary btn-mount" style="flex:1;justify-content:center;padding:4px 8px;font-size:11px;">
              \u26A1 3D Montaj
            </button>
          </div>
        `;
        const slotInput = card.querySelector(".slot-input");
        const mountBtn = card.querySelector(".btn-mount");
        mountBtn.addEventListener("click", () => {
          const targetU = parseInt(slotInput.value) || suggestedSlot;
          const res = studio.mountDevice(item.id, targetU);
          if (res) {
            studio.showToast(`${item.name} U${res.startU} pozisyonuna ba\u015Far\u0131yla monte edildi.`);
            renderCatalog2(searchInput2 ? searchInput2.value : "");
          }
        });
        catalogList.appendChild(card);
      });
    }
    if (searchInput2) {
      searchInput2.addEventListener("input", (e) => renderCatalog2(e.target.value));
    }
    document.querySelectorAll(".cat-pill").forEach((pill) => {
      pill.addEventListener("click", () => {
        document.querySelectorAll(".cat-pill").forEach((p) => p.classList.remove("active"));
        pill.classList.add("active");
        activeCategory = pill.dataset.category || "all";
        renderCatalog2(searchInput2 ? searchInput2.value : "");
      });
    });
    renderCatalog2();
    const tabBtnCatalog = document.getElementById("tab-btn-catalog");
    const tabBtnInstalled = document.getElementById("tab-btn-installed");
    const drawerViewCatalog = document.getElementById("drawer-view-catalog");
    const drawerViewInstalled = document.getElementById("drawer-view-installed");
    if (tabBtnCatalog && tabBtnInstalled) {
      tabBtnCatalog.addEventListener("click", () => {
        tabBtnCatalog.classList.add("active");
        tabBtnInstalled.classList.remove("active");
        if (drawerViewCatalog) drawerViewCatalog.style.display = "block";
        if (drawerViewInstalled) drawerViewInstalled.style.display = "none";
      });
      tabBtnInstalled.addEventListener("click", () => {
        tabBtnInstalled.classList.add("active");
        tabBtnCatalog.classList.remove("active");
        if (drawerViewCatalog) drawerViewCatalog.style.display = "none";
        if (drawerViewInstalled) drawerViewInstalled.style.display = "block";
        renderInstalledDevicesList2();
      });
    }
    const installedList = document.getElementById("installed-devices-list");
    const installedCountEl = document.getElementById("installed-count");
    function renderInstalledDevicesList2() {
      const devs = [...studio.state.devices || []];
      if (installedCountEl) installedCountEl.textContent = String(devs.length);
      if (!installedList) return;
      installedList.innerHTML = "";
      if (devs.length === 0) {
        installedList.innerHTML = '<div style="padding:24px 16px;text-align:center;color:#64748b;font-size:12px;">Kabin \u015Fu an bo\u015F.<br><span style="color:#00e5ff;cursor:pointer;font-weight:700;display:inline-block;margin-top:6px;" id="link-go-catalog">Katalogdan cihaz ekleyin \u2794</span></div>';
        document.getElementById("link-go-catalog")?.addEventListener("click", () => {
          tabBtnCatalog?.click();
        });
        return;
      }
      devs.sort((a, b) => b.startU + b.uHeight - 1 - (a.startU + a.uHeight - 1));
      devs.forEach((dev) => {
        const topU = dev.startU + dev.uHeight - 1;
        const uLabel = dev.uHeight > 1 ? `U${topU}-${dev.startU}` : `U${dev.startU}`;
        const cableCount = studio.state.cables.filter((c) => c.from.devId === dev.id || c.to.devId === dev.id).length;
        const card = document.createElement("div");
        card.className = "installed-device-card" + (studio.selectedDeviceId === dev.id ? " active" : "");
        card.dataset.devId = dev.id;
        const metaParts = [];
        if (dev.ipAddress) metaParts.push(`IP: ${dev.ipAddress}`);
        if (dev.macAddress) metaParts.push(`MAC: ${dev.macAddress}`);
        const metaHtml = metaParts.length ? `<div class="installed-card-meta" style="font-size:11px;color:#38bdf8;margin-top:3px;font-family:Consolas,monospace;">${metaParts.join(" \xB7 ")}</div>` : "";
        card.innerHTML = `
          <div class="installed-card-top">
            <span class="installed-u-pill">${uLabel}</span>
            <span class="installed-dev-title" title="${dev.name}">${dev.name}</span>
            <span class="installed-cables-badge" title="Ba\u011Fl\u0131 Kablo Say\u0131s\u0131">\u{1F50C} ${cableCount}</span>
          </div>
          <div class="installed-card-sub">${dev.manufacturer || "Cisco"} \xB7 ${dev.uHeight}U \xB7 ${dev.category || "Donan\u0131m"}</div>
          ${metaHtml}
          <div class="installed-card-actions">
            <button class="btn-inst-action btn-inst-edit" title="Donan\u0131m bilgilerini yap\u0131land\u0131r">\u270F\uFE0F D\xFCzenle</button>
            <button class="btn-inst-action btn-inst-focus" title="Cihaza Odaklan">\u{1F50D} Odaklan</button>
            <button class="btn-inst-action btn-inst-up" title="1U Yukar\u0131 Ta\u015F\u0131">\u25B2</button>
            <button class="btn-inst-action btn-inst-down" title="1U A\u015Fa\u011F\u0131 Ta\u015F\u0131">\u25BC</button>
            <button class="btn-inst-action btn-inst-dismount" title="Kabinden S\xF6k (H\u0131zl\u0131)">\u{1F5D1}\uFE0F S\xF6k</button>
          </div>
        `;
        card.querySelector(".btn-inst-edit")?.addEventListener("click", (e) => {
          e.stopPropagation();
          activeContextDevId = dev.id;
          window.DeviceMetadataEditor?.open3D(dev.id);
        });
        card.querySelector(".btn-inst-focus").addEventListener("click", (e) => {
          e.stopPropagation();
          studio.focusDevice(dev.id);
        });
        card.querySelector(".btn-inst-up").addEventListener("click", (e) => {
          e.stopPropagation();
          studio.moveDevice(dev.id, 1);
          renderInstalledDevicesList2();
        });
        card.querySelector(".btn-inst-down").addEventListener("click", (e) => {
          e.stopPropagation();
          studio.moveDevice(dev.id, -1);
          renderInstalledDevicesList2();
        });
        card.querySelector(".btn-inst-dismount").addEventListener("click", (e) => {
          e.stopPropagation();
          studio.removeDevice(dev.id);
          studio.showToast(`\u{1F5D1}\uFE0F "${dev.name}" kabinden s\xF6k\xFCld\xFC.`);
          renderInstalledDevicesList2();
          renderCatalog2(searchInput2 ? searchInput2.value : "");
        });
        card.addEventListener("click", () => {
          studio.selectDevice(dev.id);
        });
        installedList.appendChild(card);
      });
    }
    window.renderInstalledDevicesList = renderInstalledDevicesList2;
    renderInstalledDevicesList2();
    const btnDismountAll = document.getElementById("btn-dismount-all");
    if (btnDismountAll) {
      btnDismountAll.addEventListener("click", () => {
        if (studio.state.devices.length === 0) return;
        if (confirm("Kabindeki T\xDCM cihazlar\u0131 s\xF6kmek istedi\u011Finize emin misiniz?")) {
          studio.state.devices = [];
          studio.state.cables = [];
          studio.rebuildAllDevices();
          studio.rebuildAllCables();
          studio.state.pushSnapshot();
          studio.state.autoSave();
          studio.deselectDevice();
          renderInstalledDevicesList2();
          renderCatalog2(searchInput2 ? searchInput2.value : "");
          studio.showToast("Kabindeki t\xFCm cihazlar s\xF6k\xFCld\xFC (Ctrl+Z ile geri alabilirsiniz).");
        }
      });
    }
  }

  // js/src/3d-ui/deviceHud.js
  function initDeviceHud(studio) {
    document.getElementById("btn-hud-focus")?.addEventListener("click", () => {
      if (studio.selectedDeviceId) studio.focusDevice(studio.selectedDeviceId);
    });
    document.getElementById("btn-hud-config")?.addEventListener("click", () => {
      if (studio.selectedDeviceId) {
        window.DeviceMetadataEditor?.open3D(studio.selectedDeviceId);
      }
    });
    document.getElementById("btn-hud-dismount")?.addEventListener("click", () => {
      if (studio.selectedDeviceId) {
        const dev = studio.state.devices.find((d) => d.id === studio.selectedDeviceId);
        const name = dev ? dev.name : "Cihaz";
        studio.removeDevice(studio.selectedDeviceId);
        studio.showToast(`\u{1F5D1}\uFE0F "${name}" kabinden s\xF6k\xFCld\xFC.`);
        renderInstalledDevicesList();
        renderCatalog(searchInput ? searchInput.value : "");
      }
    });
    document.getElementById("btn-hud-close")?.addEventListener("click", () => {
      studio.deselectDevice();
    });
    const devContext = document.getElementById("device-context-menu");
    const devCtxTitle = document.getElementById("dev-ctx-title");
    const btnDevMoveUp = document.getElementById("btn-dev-move-up");
    const btnDevMoveDown = document.getElementById("btn-dev-move-down");
    const btnDevRemove = document.getElementById("btn-dev-remove");
    let activeContextDevId2 = null;
    window.openDeviceContext = function(devId, clientX, clientY) {
      const dev = studio.state.devices.find((d) => d.id === devId);
      if (!dev || !devContext) return;
      activeContextDevId2 = devId;
      devCtxTitle.textContent = `${dev.name} (U${dev.startU} - ${dev.uHeight}U)`;
      const posX = Math.min(clientX + 8, window.innerWidth - 220);
      const posY = Math.min(clientY + 8, window.innerHeight - 150);
      devContext.style.left = posX + "px";
      devContext.style.top = posY + "px";
      devContext.style.display = "block";
    };
    window.addEventListener("click", (e) => {
      if (devContext && !devContext.contains(e.target)) {
        devContext.style.display = "none";
      }
    });
    if (btnDevMoveUp) {
      btnDevMoveUp.addEventListener("click", () => {
        if (activeContextDevId2) {
          studio.moveDevice(activeContextDevId2, 1);
          devContext.style.display = "none";
          renderCatalog(searchInput ? searchInput.value : "");
        }
      });
    }
    if (btnDevMoveDown) {
      btnDevMoveDown.addEventListener("click", () => {
        if (activeContextDevId2) {
          studio.moveDevice(activeContextDevId2, -1);
          devContext.style.display = "none";
          renderCatalog(searchInput ? searchInput.value : "");
        }
      });
    }
    if (btnDevRemove) {
      btnDevRemove.addEventListener("click", () => {
        if (activeContextDevId2) {
          const dev = studio.state.devices.find((d) => d.id === activeContextDevId2);
          if (confirm(`"${dev ? dev.name : "Bu cihaz"}" kabinden s\xF6k\xFCls\xFCn m\xFC? (Ba\u011Fl\u0131 kablolar da s\xF6k\xFClecektir)`)) {
            studio.removeDevice(activeContextDevId2);
            devContext.style.display = "none";
            studio.showToast("Cihaz kabinden s\xF6k\xFCld\xFC.");
            renderCatalog(searchInput ? searchInput.value : "");
          }
        }
      });
    }
    const btnDevEditConfig = document.getElementById("btn-dev-edit-config");
    const modalDeviceEdit = document.getElementById("modal-device-edit");
    const btnCloseDeviceEdit = document.getElementById("btn-close-device-edit");
    const btnCancelDeviceEdit = document.getElementById("btn-cancel-device-edit");
    const btnSaveDeviceEdit = document.getElementById("btn-save-device-edit");
    const devEditHostname = document.getElementById("dev-edit-hostname");
    const devEditIp = document.getElementById("dev-edit-ip");
    const devEditMac = document.getElementById("dev-edit-mac");
    const devEditSerial = document.getElementById("dev-edit-serial");
    const devEditPanelLabel = document.getElementById("dev-edit-panel-label");
    const modalDevEditTitle = document.getElementById("modal-dev-edit-title");
    if (btnDevEditConfig && modalDeviceEdit) {
      btnDevEditConfig.addEventListener("click", () => {
        if (!activeContextDevId2) return;
        const dev = studio.state.devices.find((d) => d.id === activeContextDevId2);
        if (!dev) return;
        devContext.style.display = "none";
        window.DeviceMetadataEditor?.open3D(dev.id);
      });
      const closeDevEdit = () => {
        modalDeviceEdit.style.display = "none";
        modalDeviceEdit.dataset.source = "";
      };
      if (btnCloseDeviceEdit) btnCloseDeviceEdit.addEventListener("click", closeDevEdit);
      if (btnCancelDeviceEdit) btnCancelDeviceEdit.addEventListener("click", closeDevEdit);
      if (btnSaveDeviceEdit) {
        btnSaveDeviceEdit.addEventListener("click", () => {
          if (!activeContextDevId2) return;
          const newHostname = devEditHostname ? devEditHostname.value.trim() : "";
          const newIp = devEditIp ? devEditIp.value.trim() : "";
          const newMac = devEditMac ? devEditMac.value.trim() : "";
          const newSerial = devEditSerial ? devEditSerial.value.trim() : "";
          const newPanelLabel = devEditPanelLabel ? devEditPanelLabel.value.trim() : "";
          studio.updateDeviceMetadata(activeContextDevId2, {
            name: newHostname,
            ipAddress: newIp,
            macAddress: newMac,
            serialNumber: newSerial,
            panelLabel: newPanelLabel
          });
          renderInstalledDevicesList();
          if (typeof window.sync3Dto2D === "function") window.sync3Dto2D();
          modalDeviceEdit.dataset.source = "";
          modalDeviceEdit.style.display = "none";
        });
      }
    }
  }

  // js/src/3d-ui/cableModals.js
  function initCableModals(studio) {
    const paletteBar = document.getElementById("cable-palette-bar");
    if (paletteBar && window.CABLE_COLORS_3D) {
      window.CABLE_COLORS_3D.forEach((c, idx) => {
        const dot = document.createElement("div");
        dot.className = "color-dot" + (idx === 0 ? " active" : "");
        dot.style.backgroundColor = c.css;
        dot.title = c.name;
        dot.addEventListener("click", () => {
          document.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
          dot.classList.add("active");
          studio.state.cableColorIdx = idx;
          studio.showToast(`Kablo Rengi: ${c.name}`);
        });
        paletteBar.appendChild(dot);
      });
    }
    const cableEditModal = document.getElementById("modal-cable-edit");
    const btnCloseCableEdit = document.getElementById("btn-close-cable-edit");
    const btnCancelCableEdit = document.getElementById("btn-cancel-cable-edit");
    const btnSaveCableEdit = document.getElementById("btn-save-cable-edit");
    const btnDeleteCableModal = document.getElementById("btn-delete-cable-modal");
    const editCableNameInput = document.getElementById("edit-cable-name");
    const editCableNoteInput = document.getElementById("edit-cable-note");
    const editCablePalette = document.getElementById("edit-cable-palette");
    const editCableFromSpan = document.getElementById("edit-cable-from");
    const editCableToSpan = document.getElementById("edit-cable-to");
    const editCableLenSpan = document.getElementById("edit-cable-len");
    let activeEditCableId = null;
    let activeEditColorHex = null;
    window.openCableModal = function(cableId) {
      const cable = studio.state.cables.find((c) => c.id === cableId);
      if (!cable || !cableEditModal) return;
      activeEditCableId = cableId;
      activeEditColorHex = cable.color;
      const devFrom = studio.state.devices.find((d) => d.id === cable.from.devId);
      const devTo = studio.state.devices.find((d) => d.id === cable.to.devId);
      editCableNameInput.value = cable.name || "";
      editCableNoteInput.value = cable.note || "";
      editCableFromSpan.textContent = `${devFrom ? devFrom.name : "Bilinmeyen"} (Port #${cable.from.portIdx})`;
      editCableToSpan.textContent = `${devTo ? devTo.name : "Bilinmeyen"} (Port #${cable.to.portIdx})`;
      editCableLenSpan.textContent = `${cable.lengthM} Metre`;
      if (editCablePalette && window.CABLE_COLORS_3D) {
        editCablePalette.innerHTML = "";
        window.CABLE_COLORS_3D.forEach((c) => {
          const dot = document.createElement("div");
          dot.className = "color-dot" + (c.hex === cable.color ? " active" : "");
          dot.style.backgroundColor = c.css;
          dot.title = c.name;
          dot.addEventListener("click", () => {
            editCablePalette.querySelectorAll(".color-dot").forEach((d) => d.classList.remove("active"));
            dot.classList.add("active");
            activeEditColorHex = c.hex;
          });
          editCablePalette.appendChild(dot);
        });
      }
      cableEditModal.style.display = "flex";
      setTimeout(() => editCableNameInput.focus(), 50);
    };
    if (btnCloseCableEdit) btnCloseCableEdit.addEventListener("click", () => cableEditModal.style.display = "none");
    if (btnCancelCableEdit) btnCancelCableEdit.addEventListener("click", () => cableEditModal.style.display = "none");
    if (btnSaveCableEdit) {
      btnSaveCableEdit.addEventListener("click", () => {
        if (!activeEditCableId) return;
        const newName = editCableNameInput.value.trim();
        const newNote = editCableNoteInput.value.trim();
        studio.updateCable(activeEditCableId, {
          name: newName,
          note: newNote,
          color: activeEditColorHex
        });
        cableEditModal.style.display = "none";
      });
    }
    if (btnDeleteCableModal) {
      btnDeleteCableModal.addEventListener("click", () => {
        if (!activeEditCableId) return;
        if (confirm("Bu kablo ba\u011Flant\u0131s\u0131n\u0131 s\xF6kmek istedi\u011Finize emin misiniz?")) {
          studio.removeCable(activeEditCableId);
          cableEditModal.style.display = "none";
          studio.showToast("Kablo s\xF6k\xFCld\xFC.");
        }
      });
    }
    const btnSchedule = document.getElementById("btn-3d-schedule-modal");
    const scheduleModal = document.getElementById("modal-schedule");
    const btnCloseSchedule = document.getElementById("btn-close-schedule");
    const scheduleBody = document.getElementById("schedule-table-body");
    const btnExportCsv = document.getElementById("btn-export-csv");
    if (btnSchedule && scheduleModal) {
      btnSchedule.addEventListener("click", () => {
        if (scheduleBody) {
          scheduleBody.innerHTML = "";
          if (studio.state.cables.length === 0) {
            scheduleBody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#64748b;padding:16px;">Hen\xFCz kablo ba\u011Flant\u0131s\u0131 yap\u0131lmad\u0131.</td></tr>';
          } else {
            studio.state.cables.forEach((c, idx) => {
              const dFrom = studio.state.devices.find((d) => d.id === c.from.devId);
              const dTo = studio.state.devices.find((d) => d.id === c.to.devId);
              const tr = document.createElement("tr");
              tr.innerHTML = `
                <td>#${idx + 1}</td>
                <td><strong style="color:#38bdf8;cursor:pointer;" class="schedule-cable-name" title="\u0130smi d\xFCzenlemek i\xE7in t\u0131klay\u0131n">${c.name || "\u0130simsiz Kablo"}</strong></td>
                <td><strong>${dFrom ? dFrom.name : "Bilinmeyen"}</strong> (P${c.from.portIdx})</td>
                <td><strong>${dTo ? dTo.name : "Bilinmeyen"}</strong> (P${c.to.portIdx})</td>
                <td><span style="display:inline-block;width:12px;height:12px;border-radius:50%;background-color:#${c.color.toString(16).padStart(6, "0")};margin-right:6px;vertical-align:middle;"></span>#${c.color.toString(16).padStart(6, "0")}</td>
                <td><strong>${c.lengthM} Metre</strong></td>
                <td>
                  <button class="hud-btn btn-edit-cbl" data-id="${c.id}" style="padding:2px 6px;margin-right:4px;">\u270F\uFE0F D\xFCzenle</button>
                  <button class="hud-btn btn-del-cbl" data-id="${c.id}" style="padding:2px 6px;color:#ef4444;">S\xF6k</button>
                </td>
              `;
              tr.querySelector(".schedule-cable-name").addEventListener("click", () => {
                scheduleModal.style.display = "none";
                window.openCableModal(c.id);
              });
              tr.querySelector(".btn-edit-cbl").addEventListener("click", () => {
                scheduleModal.style.display = "none";
                window.openCableModal(c.id);
              });
              tr.querySelector(".btn-del-cbl").addEventListener("click", () => {
                studio.removeCable(c.id);
                btnSchedule.click();
              });
              scheduleBody.appendChild(tr);
            });
          }
        }
        scheduleModal.style.display = "flex";
      });
      if (btnCloseSchedule) btnCloseSchedule.addEventListener("click", () => scheduleModal.style.display = "none");
      if (btnExportCsv) {
        btnExportCsv.addEventListener("click", () => {
          let csv = "No,Kablo Ad\u0131 / Etiketi,Kaynak Cihaz,Kaynak Port,Hedef Cihaz,Hedef Port,Kablo Renk,Uzunluk (Metre),A\xE7\u0131klama\n";
          studio.state.cables.forEach((c, idx) => {
            const dFrom = studio.state.devices.find((d) => d.id === c.from.devId);
            const dTo = studio.state.devices.find((d) => d.id === c.to.devId);
            csv += `${idx + 1},"${c.name || ""}","${dFrom ? dFrom.name : ""}",${c.from.portIdx},"${dTo ? dTo.name : ""}",${c.to.portIdx},#${c.color.toString(16)},${c.lengthM},"${c.note || ""}"
`;
          });
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "kabin-kablo-metraj-cizelgesi.csv";
          a.click();
          URL.revokeObjectURL(url);
          studio.showToast("CSV Metraj Raporu \u0130ndirildi.");
        });
      }
    }
  }

  // js/src/3d-ui/wizardModal.js
  function initWizardModal(studio) {
    const btnWizard = document.getElementById("btn-3d-wizard-modal");
    const wizardModal = document.getElementById("modal-wizard");
    const btnCloseWizard = document.getElementById("btn-close-wizard");
    const btnCreateDevice = document.getElementById("btn-create-custom-device");
    if (btnWizard && wizardModal) {
      btnWizard.addEventListener("click", () => wizardModal.style.display = "flex");
      if (btnCloseWizard) btnCloseWizard.addEventListener("click", () => wizardModal.style.display = "none");
      if (btnCreateDevice) {
        btnCreateDevice.addEventListener("click", () => {
          const name = document.getElementById("wiz-name").value.trim() || "\xD6zel Donan\u0131m";
          const manufacturer = document.getElementById("wiz-manuf").value.trim() || "\xD6zel \xDCretim";
          const category = document.getElementById("wiz-cat").value;
          const uHeight = parseInt(document.getElementById("wiz-u").value) || 1;
          const depthMm = parseInt(document.getElementById("wiz-depth").value) || 450;
          const portsCount = parseInt(document.getElementById("wiz-ports").value) || 0;
          const portType = document.getElementById("wiz-port-type").value;
          const customId = "custom-" + Math.random().toString(36).substr(2, 7);
          const newItem = {
            id: customId,
            name,
            manufacturer,
            category,
            u: uHeight,
            depthMm,
            powerWatts: 350,
            color: 3359061,
            portsCount,
            portType,
            uplinks: 0,
            desc: `${uHeight}U \xD6zel Tasar\u0131m ${manufacturer} ${name}`
          };
          window.CATALOG_3D.unshift(newItem);
          renderCatalog();
          wizardModal.style.display = "none";
          studio.showToast(`Yeni Donan\u0131m Eklendi: ${name}`);
        });
      }
    }
  }

  // js/src/3d-ui/index.js
  (function() {
    "use strict";
    function initStudio3DUI() {
      const container = document.getElementById("studio3d-container");
      if (!container || !window.Studio3D) return;
      if (window.__STUDIO3D__) return;
      const studio = new window.Studio3D(container);
      window.__STUDIO3D__ = studio;
      initCameraControls(studio);
      initCatalogDrawer(studio);
      initDeviceHud(studio);
      initCableModals(studio);
      initWizardModal(studio);
      const btnPresetMdf = document.getElementById("btn-3d-preset-mdf");
      if (btnPresetMdf) {
        btnPresetMdf.addEventListener("click", () => {
          if (confirm("MDF Omurga \u015Eablonunu y\xFCklemek istiyor musunuz? Mevcut tasar\u0131m s\u0131f\u0131rlanacakt\u0131r.")) {
            studio.loadPresetMDF();
            studio.showToast("MDF Da\u011F\u0131t\u0131m \u015Eablonu Y\xFCklendi.");
            renderCatalog(searchInput ? searchInput.value : "");
          }
        });
      }
      const btnPresetIdf = document.getElementById("btn-3d-preset-idf");
      if (btnPresetIdf) {
        btnPresetIdf.addEventListener("click", () => {
          if (confirm("IDF Kat Kenar \u015Eablonunu y\xFCklemek istiyor musunuz?")) {
            studio.state.devices = [];
            studio.state.cables = [];
            studio.mountDevice("patch-cat6-48p", 38);
            studio.mountDevice("cisco-c9300-48p", 36);
            studio.mountDevice("cable-manager-1u", 35);
            studio.mountDevice("patch-cat6-48p", 33);
            studio.mountDevice("cisco-c9300-48p", 31);
            studio.mountDevice("pdu-1u-8c13", 2);
            studio.showToast("IDF Kat Kabini \u015Eablonu Y\xFCklendi.");
            renderCatalog(searchInput ? searchInput.value : "");
          }
        });
      }
      const btnPresetSite = document.getElementById("btn-3d-preset-site");
      if (btnPresetSite) {
        btnPresetSite.addEventListener("click", () => {
          if (confirm("T\xFCm Saha Topolojisini y\xFCklemek istiyor musunuz? (3D kabinde MDF \u015Fablonu y\xFCklenecektir)")) {
            studio.loadPresetMDF();
            studio.showToast("Saha Topolojisi Y\xFCklendi. \xC7oklu kabin i\xE7in 2D moduna ge\xE7ebilirsiniz.");
            renderCatalog(searchInput ? searchInput.value : "");
          }
        });
      }
      const btnUndo = document.getElementById("btn-3d-undo");
      const btnRedo = document.getElementById("btn-3d-redo");
      if (btnUndo) {
        btnUndo.addEventListener("click", () => {
          if (studio.state.undo()) {
            studio.buildRack(studio.state.rackHeightU);
            studio.rebuildAllDevices();
            studio.rebuildAllCables();
            studio.showToast("Geri Al\u0131nd\u0131 (Undo)");
            renderCatalog(searchInput ? searchInput.value : "");
          }
        });
      }
      if (btnRedo) {
        btnRedo.addEventListener("click", () => {
          if (studio.state.redo()) {
            studio.buildRack(studio.state.rackHeightU);
            studio.rebuildAllDevices();
            studio.rebuildAllCables();
            studio.showToast("Yinelendi (Redo)");
            renderCatalog(searchInput ? searchInput.value : "");
          }
        });
      }
      const btnExportJson = document.getElementById("btn-export-json-3d");
      const btnImportJson = document.getElementById("btn-import-json-3d");
      const fileImport = document.getElementById("file-import-3d");
      if (btnExportJson) {
        btnExportJson.addEventListener("click", () => {
          const payload = {
            version: "3.1.0-3D",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            rackHeightU: studio.state.rackHeightU,
            devices: studio.state.devices,
            cables: studio.state.cables
          };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `cisco-rack-studio-3d-${Date.now()}.json`;
          a.click();
          URL.revokeObjectURL(url);
          studio.showToast("3D Topoloji JSON Olarak Kaydedildi.");
        });
      }
      if (btnImportJson && fileImport) {
        btnImportJson.addEventListener("click", () => fileImport.click());
        fileImport.addEventListener("change", (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (evt) => {
            try {
              const data = JSON.parse(evt.target.result);
              if (data.devices) {
                studio.state.rackHeightU = data.rackHeightU || 42;
                studio.state.devices = data.devices || [];
                studio.state.cables = data.cables || [];
                studio.buildRack(studio.state.rackHeightU);
                studio.rebuildAllDevices();
                studio.rebuildAllCables();
                studio.state.pushSnapshot();
                renderCatalog(searchInput ? searchInput.value : "");
                studio.showToast("3D Topoloji Ba\u015Far\u0131yla Y\xFCklendi!");
              }
            } catch (err) {
              alert("Ge\xE7ersiz JSON Dosyas\u0131!");
            }
          };
          reader.readAsText(file);
        });
      }
      window.addEventListener("keydown", (e) => {
        if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
        const wrapper3D = document.getElementById("studio3d-wrapper");
        const is3DActive = wrapper3D && wrapper3D.style.display !== "none";
        if (!is3DActive) return;
        if (e.ctrlKey && e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) btnRedo && btnRedo.click();
          else btnUndo && btnUndo.click();
        } else if (e.ctrlKey && e.key.toLowerCase() === "y") {
          e.preventDefault();
          btnRedo && btnRedo.click();
        } else if (e.key === "1") {
          document.getElementById("cam-iso")?.click();
        } else if (e.key === "2") {
          document.getElementById("cam-front")?.click();
        } else if (e.key === "3") {
          document.getElementById("cam-rear")?.click();
        } else if (e.key === "4") {
          document.getElementById("cam-top")?.click();
        } else if (e.key === "5") {
          document.getElementById("cam-focus")?.click();
        } else if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          btnDoor && btnDoor.click();
        }
      });
    }
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initStudio3DUI);
    } else {
      initStudio3DUI();
    }
  })();
})();
