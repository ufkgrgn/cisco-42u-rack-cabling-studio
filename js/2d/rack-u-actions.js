/**
 * Cisco Enterprise Rack & Cabling Studio - Rack U-Actions & Stage Interaction
 * Handles rack stage event delegation (click, dblclick, drag-and-drop, U space insertion/collapse),
 * floating "+" rack creation buttons, and bottom rack resize handle gestures.
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};
  const STATE = RS.STATE;
  const dom = RS.dom;
  const HARDWARE_CATALOG = RS.HARDWARE_CATALOG;
  const ZOOM_STATE = RS.ZOOM_STATE;

  const getActiveRack = () => (RS.getActiveRack ? RS.getActiveRack() : RS.STATE?.racks?.[0]);
  const escapeHtml = val => (RS.escapeHtml ? RS.escapeHtml(val) : String(val ?? ''));
  const showTemporaryTooltip = (...args) => RS.showTemporaryTooltip && RS.showTemporaryTooltip(...args);
  const highlightDropSlots = (...args) => RS.highlightDropSlots && RS.highlightDropSlots(...args);

  /**
   * Injects two floating "+" buttons into the viewport canvas (parent of rack-stage)
   * so they sit beside the rack without being affected by the zoom/pan transform.
   */
  function _injectFloatingRackButtons(activeRack) {
    const canvas = dom.viewportCanvas || document.getElementById('viewport-canvas');
    if (!canvas) return;

    // Remove previously injected floating buttons
    canvas.querySelectorAll('.rack-float-add-btn').forEach(b => b.remove());

    function makeAddBtn(direction) {
      const btn = document.createElement('button');
      btn.className = 'rack-float-add-btn rack-float-add-' + direction;
      btn.title = direction === 'left' ? 'Sola Yeni Kabin Ekle' : 'Sağa Yeni Kabin Ekle';
      btn.textContent = '+';
      btn.addEventListener('click', () => {
        if (!RS.addNewRack) return;
        const newRack = RS.addNewRack();
        if (newRack && direction === 'left') {
          const newIdx = STATE.racks.findIndex(r => r.id === newRack.id);
          const activeIdx = STATE.racks.findIndex(r => r.id === activeRack.id);
          if (newIdx !== -1 && activeIdx !== -1) {
            STATE.racks.splice(newIdx, 1);
            const insertAt = STATE.racks.findIndex(r => r.id === activeRack.id);
            STATE.racks.splice(insertAt, 0, newRack);
            if (RS.renderRackTabs) RS.renderRackTabs();
          }
        }
        // Switch to multi mode so both racks are visible
        if (RS.setViewMode) {
          RS.setViewMode('multi');
        } else {
          STATE.viewMode = 'multi';
          const modeToggle = document.getElementById('btn-view-mode-multi') || document.getElementById('btn-view-multi');
          if (modeToggle) modeToggle.click();
          else if (RS.renderRackRailsAndSlots) RS.renderRackRailsAndSlots(STATE.onSlotClick);
        }
      });
      return btn;
    }

    canvas.appendChild(makeAddBtn('left'));
    canvas.appendChild(makeAddBtn('right'));
  }

  /**
   * Binds pointer events on a rack's bottom resize handle to allow dragging to change U height (12U-60U).
   */
  function _bindRackResizeHandle(handleEl, rack) {
    if (!handleEl || !rack) return;
    let startY = 0;
    let startU = 0;
    let isDragging = false;

    const onPointerMove = e => {
      if (!isDragging) return;
      const deltaY = e.clientY - startY;
      const uHeightPx = 32 * (ZOOM_STATE.scale || 1);
      const deltaU = Math.round(deltaY / uHeightPx);
      const targetU = Math.max(12, Math.min(60, startU + deltaU));

      if (RS.showTemporaryTooltip) {
        RS.showTemporaryTooltip(e.clientX, e.clientY - 30, `📐 Kabin Boyutu: ${targetU}U (Bırakıldığında uygulanır)`);
      }
    };

    const onPointerUp = e => {
      if (!isDragging) return;
      isDragging = false;
      handleEl.classList.remove('active');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);

      const deltaY = e.clientY - startY;
      const uHeightPx = 32 * (ZOOM_STATE.scale || 1);
      const deltaU = Math.round(deltaY / uHeightPx);
      const targetU = Math.max(12, Math.min(60, startU + deltaU));

      if (targetU !== startU && RS.resizeRackHeight) {
        RS.resizeRackHeight(rack.id, targetU);
      }
    };

    handleEl.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      isDragging = true;
      startY = e.clientY;
      startU = rack.heightU || 42;
      handleEl.classList.add('active');
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
    });
  }

  function resolveDropSlot(e) {
    const direct = e.target?.closest?.('.rack-slot[data-u], .rack-unit[data-u]');
    if (direct) {
      return {
        element: direct,
        u: Number(direct.dataset.u),
        rackId: direct.dataset.rackId || direct.closest('.rack-container')?.dataset.rackId || getActiveRack()?.id
      };
    }

    const stack = typeof document.elementsFromPoint === 'function'
      ? document.elementsFromPoint(e.clientX, e.clientY)
      : [];
    const stackedSlot = stack.map(el => el.closest?.('.rack-slot[data-u], .rack-unit[data-u]')).find(Boolean);
    if (stackedSlot) {
      return {
        element: stackedSlot,
        u: Number(stackedSlot.dataset.u),
        rackId: stackedSlot.dataset.rackId || stackedSlot.closest('.rack-container')?.dataset.rackId || getActiveRack()?.id
      };
    }

    const container = e.target?.closest?.('.rack-container') ||
      stack.map(el => el.closest?.('.rack-container')).find(Boolean);
    if (!container) return null;
    let nearest = null;
    let nearestDistance = Infinity;
    container.querySelectorAll('.rack-slot[data-u]').forEach(slot => {
      const rect = slot.getBoundingClientRect();
      const distance = Math.abs(e.clientY - (rect.top + rect.height / 2));
      if (distance < nearestDistance) {
        nearest = slot;
        nearestDistance = distance;
      }
    });
    return nearest ? {
      element: nearest,
      u: Number(nearest.dataset.u),
      rackId: nearest.dataset.rackId || container.dataset.rackId || getActiveRack()?.id
    } : null;
  }

  let uActionMenu = null;
  function hideUActionMenu() {
    if (uActionMenu) {
      uActionMenu.remove();
      uActionMenu = null;
    }
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('click', e => {
      if (uActionMenu && !e.target.closest('#rack-u-action-menu')) {
        hideUActionMenu();
      }
    });
  }

  // Event delegation at #rack-stage for slots and mounted devices
  function ensureRackStageDelegation() {
    const stage = dom.rackStage || document.getElementById('rack-stage');
    if (!stage || stage.__RACK_STAGE_DELEGATED__) return;
    stage.__RACK_STAGE_DELEGATED__ = true;

    // Single click on rack slot or u-label
    stage.addEventListener('click', e => {
      const uLabel = e.target.closest('.u-label');
      if (uLabel) {
        if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
        e.stopPropagation();
        e.preventDefault();
        hideUActionMenu();
        const targetU = Number(uLabel.dataset.u || uLabel.textContent.trim());
        const rackId = uLabel.dataset.rackId || uLabel.closest('.rack-container')?.dataset.rackId || (getActiveRack() ? getActiveRack().id : undefined);
        const rack = (RS.getRackById ? RS.getRackById(rackId) : null) || STATE.racks?.find(r => r.id === rackId) || getActiveRack();

        const rect = uLabel.getBoundingClientRect();
        uActionMenu = document.createElement('div');
        uActionMenu.id = 'rack-u-action-menu';
        uActionMenu.className = 'rack-u-action-menu';
        uActionMenu.innerHTML = `
          <div style="padding: 4px 8px; font-weight: bold; color: #94a3b8; border-bottom: 1px solid #334155;">U ${targetU} (${escapeHtml(rack?.name || 'Kabin')})</div>
          <button data-u-action="insert-1u">➕ Araya 1U Boşluk Aç</button>
          <button data-u-action="collapse-1u">➖ Boşluğu Kapat (1U Çek)</button>
          <button data-u-action="multiselect">☑️ Çoklu Seçimi Başlat</button>
        `;
        uActionMenu.style.top = `${Math.min(window.innerHeight - 150, Math.max(10, rect.top))}px`;
        uActionMenu.style.left = `${Math.min(window.innerWidth - 200, rect.right + 8)}px`;
        document.body.appendChild(uActionMenu);

        uActionMenu.addEventListener('click', evt => {
          const btn = evt.target.closest('[data-u-action]');
          if (!btn) return;
          const action = btn.dataset.uAction;
          if (action === 'insert-1u') {
            RS.insertUSpace?.(rackId, targetU, 1);
          } else if (action === 'collapse-1u') {
            RS.collapseUSpace?.(rackId, targetU, 1);
          } else if (action === 'multiselect') {
            RS.setMultiSelectMode?.(true);
            RS.showTemporaryTooltip?.(rect.left, rect.top - 30, 'Çoklu seçim modu açık. Cihazlara dokunarak seçin.');
          }
          hideUActionMenu();
        });
        return;
      }

      const slot = e.target.closest('.rack-slot');
      if (slot && !e.target.closest('.mounted-device')) {
        if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
        if (STATE.selectedLibraryItem) {
          const u = Number(slot.dataset.u);
          const rackId = slot.dataset.rackId || (getActiveRack() ? getActiveRack().id : undefined);
          const touchPlacement = window.matchMedia?.('(hover: none), (pointer: coarse)')?.matches || window.innerWidth <= 1024;
          if (touchPlacement && typeof window.mountDeviceFromAction === 'function') {
            e.preventDefault();
            e.stopPropagation();
            window.mountDeviceFromAction(STATE.selectedLibraryItem, u, e, rackId);
            return;
          }
          const rack = (RS.getRackById ? RS.getRackById(rackId) : null) || STATE.racks?.find(r => r.id === rackId) || getActiveRack();
          const item = (RS.resolveCatalogItem ? RS.resolveCatalogItem(STATE.selectedLibraryItem) : null) || HARDWARE_CATALOG[STATE.selectedLibraryItem] || (RS.catalog && RS.catalog[STATE.selectedLibraryItem]) || (STATE.customCatalog && STATE.customCatalog[STATE.selectedLibraryItem]);
          const name = item ? item.name : 'Donanım';
          showTemporaryTooltip(e.clientX, e.clientY, `[${name}] eklemek için [${rack ? rack.name : 'Kabin'}] U${u} yuvasına ÇİFT TIKLAYIN veya sürükleyip bırakın.`);
        }
      }
    });

    // Double click on rack slot
    stage.addEventListener('dblclick', e => {
      const slot = e.target.closest('.rack-slot');
      if (slot && !e.target.closest('.mounted-device')) {
        e.stopPropagation();
        if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
        const u = Number(slot.dataset.u);
        const rackId = slot.dataset.rackId || (getActiveRack() ? getActiveRack().id : undefined);
        if (typeof window.handleSlotDoubleClick === 'function') {
          window.handleSlotDoubleClick(u, e, rackId);
        } else if (typeof window.mountDeviceFromAction === 'function' && STATE.selectedLibraryItem) {
          window.mountDeviceFromAction(STATE.selectedLibraryItem, u, e, rackId);
        }
      }
    });

    // Dragover on rack stage / slots
    stage.addEventListener('dragover', e => {
      const target = resolveDropSlot(e);
      if (target && Number.isInteger(target.u)) {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
        const draggedDev = window.__RACK_DRAGGED_DEVICE__ || STATE.selectedLibraryItem;
        highlightDropSlots(target.u, draggedDev, true, target.rackId);
      }
    });

    // Dragleave on rack stage / slots
    stage.addEventListener('dragleave', e => {
      if (!e.relatedTarget || !stage.contains(e.relatedTarget)) highlightDropSlots(null, null, false);
    });

    // Drop on rack slot / rails
    stage.addEventListener('drop', e => {
      const target = resolveDropSlot(e);
      if (target && Number.isInteger(target.u)) {
        e.preventDefault();
        e.stopPropagation();
        highlightDropSlots(null, null, false);
        const devId = e.dataTransfer?.getData('application/x-rack-device') ||
                      e.dataTransfer?.getData('text/plain') ||
                      window.__RACK_DRAGGED_DEVICE__ ||
                      STATE.selectedLibraryItem;
        window.__RACK_DRAGGED_DEVICE__ = null;
        if (!devId) return;
        if (typeof window.mountDeviceFromAction === 'function') {
          window.mountDeviceFromAction(devId, target.u, e, target.rackId);
        } else if (typeof RS.mountDeviceAt === 'function') {
          RS.mountDeviceAt(devId, target.u, target.rackId);
        }
      }
    });
  }

  RS._injectFloatingRackButtons = _injectFloatingRackButtons;
  RS._bindRackResizeHandle = _bindRackResizeHandle;
  RS.resolveDropSlot = resolveDropSlot;
  RS.ensureRackStageDelegation = ensureRackStageDelegation;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', ensureRackStageDelegation);
    } else {
      ensureRackStageDelegation();
    }
  }
})();
