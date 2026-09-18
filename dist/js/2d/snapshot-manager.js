/**
 * Cisco Enterprise Rack & Cabling Studio - Snapshot & Comparison Engine (F3)
 * Allows engineers to capture snapshots of racks & cabling, compare cable counts,
 * lengths, cross-connect changes, and visually restore snapshots.
 */
(function () {
  "use strict";

  const RS = window.RackStudio = window.RackStudio || {};

  // Store snapshots in memory and persist in localStorage
  const SNAPSHOT_STORAGE_KEY = "rack_studio_snapshots_v1";
  let snapshots = [];

  function loadSnapshots() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_STORAGE_KEY);
      if (raw) snapshots = JSON.parse(raw);
    } catch (_) {
      snapshots = [];
    }
  }

  function saveSnapshots() {
    try {
      localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
    } catch (_) {}
  }

  loadSnapshots();

  function captureSnapshot(customLabel) {
    const state = RS.STATE;
    if (!state || !state.racks) return null;

    const timestamp = new Date().toISOString();
    const dateFormatted = new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const label = customLabel || `Snapshot (${dateFormatted})`;
    const id = "snap-" + Date.now();

    const snapshot = {
      id,
      label,
      timestamp,
      racks: JSON.parse(JSON.stringify(state.racks)),
      cables: JSON.parse(JSON.stringify(state.cables || [])),
      activeRackId: state.activeRackId,
      viewMode: state.viewMode || "single"
    };

    snapshots.unshift(snapshot);
    if (snapshots.length > 20) snapshots.pop(); // Keep last 20 snapshots
    saveSnapshots();

    if (RS.showTemporaryTooltip) {
      RS.showTemporaryTooltip(window.innerWidth / 2, 80, `📸 Snapshot kaydedildi: "${label}"`);
    }
    renderSnapshotModalContent();
    return snapshot;
  }

  function deleteSnapshot(id) {
    snapshots = snapshots.filter(s => s.id !== id);
    saveSnapshots();
    renderSnapshotModalContent();
  }

  function restoreSnapshot(id) {
    const snap = snapshots.find(s => s.id === id);
    if (!snap) return;

    if (confirm(`"${snap.label}" snapshotına geri dönmek istediğinize emin misiniz? Mevcut bağlantılar değiştirilecek.`)) {
      if (RS.loadCustomTopology) {
        RS.loadCustomTopology({
          racks: JSON.parse(JSON.stringify(snap.racks)),
          cables: JSON.parse(JSON.stringify(snap.cables)),
          activeRackId: snap.activeRackId,
          viewMode: snap.viewMode
        });
      }
      closeSnapshotModal();
      if (RS.showTemporaryTooltip) {
        RS.showTemporaryTooltip(window.innerWidth / 2, 80, `✓ Snapshot başarıyla geri yüklendi: "${snap.label}"`);
      }
    }
  }

  function computeComparison(baseSnap) {
    const currentCables = RS.STATE.cables || [];
    const baseCables = baseSnap.cables || [];

    const baseCount = baseCables.length;
    const currentCount = currentCables.length;
    const diffCount = currentCount - baseCount;

    const baseLen = baseCables.reduce((acc, c) => acc + (c.lengthMeters || 1.0), 0);
    const currentLen = currentCables.reduce((acc, c) => acc + (c.lengthMeters || 1.0), 0);
    const diffLen = currentLen - baseLen;

    // Cross-rack cable count
    const baseCross = baseCables.filter(c => c.from.rackId !== c.to.rackId).length;
    const currentCross = currentCables.filter(c => c.from.rackId !== c.to.rackId).length;
    const diffCross = currentCross - baseCross;

    return {
      baseCount, currentCount, diffCount,
      baseLen: baseLen.toFixed(1), currentLen: currentLen.toFixed(1), diffLen: diffLen.toFixed(1),
      baseCross, currentCross, diffCross
    };
  }

  function openSnapshotModal() {
    let modal = document.getElementById("modal-snapshot");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "modal-snapshot";
      modal.className = "studio-modal";
      modal.style.display = "flex";
      modal.style.zIndex = "9999";
      modal.innerHTML = `
        <div class="studio-modal-card" style="width: 640px; max-width: 95vw; background: #0f172a; border: 1px solid #1e3a5f; border-radius: 10px; box-shadow: 0 25px 60px rgba(0,0,0,0.85); overflow: hidden; display: flex; flex-direction: column;">
          <div class="modal-header" style="padding: 14px 18px; background: linear-gradient(180deg, #1e293b, #0f172a); border-bottom: 1px solid #334155; display: flex; justify-content: space-between; align-items: center;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-size:18px;">📸</span>
              <h2 style="font-size:14px; font-weight:800; color:#38bdf8; margin:0; letter-spacing:0.5px;">KABİN SNAPSHOT & KARŞILAŞTIRMA SİSTEMİ</h2>
            </div>
            <button class="hud-btn" id="btn-close-snapshot-modal" style="cursor:pointer;">✕</button>
          </div>
          <div class="modal-body" id="snapshot-modal-body" style="padding: 16px; overflow-y: auto; max-height: 65vh;">
            <!-- Rendered dynamically -->
          </div>
          <div class="modal-footer" style="padding: 12px 18px; background: #090d16; border-top: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center;">
            <button class="hud-btn btn-primary" id="btn-create-snapshot" style="background:#0284c7; border:1px solid #38bdf8; color:#fff; font-weight:700; cursor:pointer;">📸 Yeni Snapshot Al</button>
            <button class="hud-btn" id="btn-close-snapshot-footer" style="cursor:pointer;">Kapat</button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector("#btn-close-snapshot-modal").addEventListener("click", closeSnapshotModal);
      modal.querySelector("#btn-close-snapshot-footer").addEventListener("click", closeSnapshotModal);
      modal.querySelector("#btn-create-snapshot").addEventListener("click", () => {
        const name = prompt("Snapshot Açıklaması (Opsiyonel):", "");
        captureSnapshot(name ? name.trim() : null);
      });
      modal.addEventListener("click", (e) => {
        if (e.target === modal) closeSnapshotModal();
      });
    } else {
      modal.style.display = "flex";
    }

    renderSnapshotModalContent();
  }

  function closeSnapshotModal() {
    const modal = document.getElementById("modal-snapshot");
    if (modal) modal.style.display = "none";
  }

  function renderSnapshotModalContent() {
    const body = document.getElementById("snapshot-modal-body");
    if (!body) return;

    if (snapshots.length === 0) {
      body.innerHTML = `
        <div style="text-align: center; padding: 40px 20px; color: #64748b;">
          <div style="font-size: 36px; margin-bottom: 8px;">📷</div>
          <p style="font-size: 13px; font-weight: 600; color: #94a3b8; margin: 0 0 6px 0;">Henüz kaydedilmiş bir snapshot bulunmuyor.</p>
          <p style="font-size: 11px; margin: 0;">Mevcut kablolama durumunu dondurmak ve daha sonra karşılaştırma yapabilmek için "Yeni Snapshot Al" butonuna tıklayın.</p>
        </div>
      `;
      return;
    }

    const itemsHtml = snapshots.map((s, idx) => {
      const comp = computeComparison(s);
      const diffColor = comp.diffCount < 0 ? "#22c55e" : (comp.diffCount > 0 ? "#f97316" : "#94a3b8");
      const diffSign = comp.diffCount > 0 ? "+" : "";
      const lenColor = parseFloat(comp.diffLen) < 0 ? "#22c55e" : (parseFloat(comp.diffLen) > 0 ? "#f97316" : "#94a3b8");
      const lenSign = parseFloat(comp.diffLen) > 0 ? "+" : "";

      return `
        <div style="background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 12px; font-weight: 800; color: #f0f9ff;">${s.label}</span>
              <span style="font-size: 10px; color: #64748b; margin-left: 8px;">${new Date(s.timestamp).toLocaleString("tr-TR")}</span>
            </div>
            <div style="display: flex; gap: 6px;">
              <button class="snap-restore-btn" data-id="${s.id}" style="background:#0284c7; border:none; border-radius:4px; color:#fff; font-size:10px; font-weight:700; padding:3px 8px; cursor:pointer;">↺ Geri Yükle</button>
              <button class="snap-del-btn" data-id="${s.id}" style="background:rgba(239,68,68,0.2); border:1px solid #ef4444; border-radius:4px; color:#fca5a5; font-size:10px; font-weight:700; padding:3px 8px; cursor:pointer;">✕</button>
            </div>
          </div>

          <!-- Comparison Metrics Table -->
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; background: #0f172a; padding: 8px 10px; border-radius: 6px; font-size: 11px;">
            <div>
              <div style="color: #64748b; font-size: 9.5px; font-weight: 700;">TOPLAM KABLO</div>
              <div style="font-weight: 800; color: #e2e8f0;">${comp.baseCount} ➔ ${comp.currentCount} <span style="color: ${diffColor};">(${diffSign}${comp.diffCount})</span></div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9.5px; font-weight: 700;">TOPLAM METRAJ</div>
              <div style="font-weight: 800; color: #e2e8f0;">${comp.baseLen}m ➔ ${comp.currentLen}m <span style="color: ${lenColor};">(${lenSign}${comp.diffLen}m)</span></div>
            </div>
            <div>
              <div style="color: #64748b; font-size: 9.5px; font-weight: 700;">KABİNLER ARASI</div>
              <div style="font-weight: 800; color: #e2e8f0;">${comp.baseCross} ➔ ${comp.currentCross}</div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    body.innerHTML = itemsHtml;

    body.querySelectorAll(".snap-restore-btn").forEach(btn => {
      btn.addEventListener("click", () => restoreSnapshot(btn.dataset.id));
    });
    body.querySelectorAll(".snap-del-btn").forEach(btn => {
      btn.addEventListener("click", () => deleteSnapshot(btn.dataset.id));
    });
  }

  RS.captureSnapshot = captureSnapshot;
  RS.openSnapshotModal = openSnapshotModal;
  RS.closeSnapshotModal = closeSnapshotModal;
})();
