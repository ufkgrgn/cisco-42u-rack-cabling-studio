/**
 * Cisco Enterprise Rack & Cabling Studio - Preset Hover Wireframe Preview
 */
(function () {
  "use strict";

  const RS = window.RackStudio = window.RackStudio || {};

  const CATEGORY_COLORS = {
    router:          { bg: "#7c3aed", label: "#e9d5ff" },
    "fiber-switch":  { bg: "#0891b2", label: "#a5f3fc" },
    switch:          { bg: "#1d4ed8", label: "#bfdbfe" },
    compact:         { bg: "#1e40af", label: "#dbeafe" },
    patch:           { bg: "#374151", label: "#d1d5db" },
    fiber:           { bg: "#b45309", label: "#fde68a" },
    pdu:             { bg: "#065f46", label: "#a7f3d0" },
    organizer:       { bg: "#1f2937", label: "#6b7280" },
    blank:           { bg: "#111827", label: "#374151" },
  };

  const PRESET_DATA = {
    mdf: {
      title: "MDF — Ana Dağıtım Kabini",
      racks: [{
        name: "MDF - Ana Dağıtım & WAN Omurga", heightU: 42,
        devices: [
          { u: 1, label: "ODF 24-port LC",   category: "fiber" },
          { u: 1, label: "Cable Org.",        category: "organizer" },
          { u: 1, label: "ISR 4431 Router",  category: "router" },
          { u: 1, label: "ISR 4431 Router",  category: "router" },
          { u: 1, label: "Cable Org.",        category: "organizer" },
          { u: 2, label: "3850-24S Fiber SW", category: "fiber-switch" },
          { u: 2, label: "3850-24S Fiber SW", category: "fiber-switch" },
          { u: 2, label: "Cable Org. 2U",     category: "organizer" },
          { u: 2, label: "C9300L-24P Core",   category: "switch" },
          { u: 1, label: "Cat6 Patch 24p",    category: "patch" },
          { u: 1, label: "Cable Org.",        category: "organizer" },
          { u: 1, label: "C9200L-24P",        category: "switch" },
          { u: 1, label: "Cat6 Patch 24p",    category: "patch" },
        ]
      }]
    },
    idf: {
      title: "IDF — Kat Erişim Kabini",
      racks: [{
        name: "IDF-1 - Kat 1 Kenar Erişim", heightU: 42,
        devices: [
          { u: 1, label: "ODF 24-port LC",   category: "fiber" },
          { u: 1, label: "Cable Org.",        category: "organizer" },
          { u: 1, label: "Cat6 Patch 24p",    category: "patch" },
          { u: 1, label: "2960X-24PS PoE",   category: "switch" },
          { u: 1, label: "Cable Org.",        category: "organizer" },
          { u: 1, label: "Cat6 Patch 24p",    category: "patch" },
          { u: 1, label: "2960-24PC PoE",     category: "switch" },
          { u: 2, label: "Cable Org. 2U",     category: "organizer" },
          { u: 1, label: "Cat6 Patch 48p",    category: "patch" },
          { u: 1, label: "2960-24PC PoE",     category: "switch" },
          { u: 1, label: "Cable Org.",        category: "organizer" },
          { u: 1, label: "2960-24TC",         category: "switch" },
        ]
      }]
    },
    site: {
      title: "Tam Saha — MDF + IDF-1 + IDF-2",
      racks: [
        {
          name: "MDF - Ana Dağıtım & Omurga", heightU: 42,
          devices: [
            { u: 1, label: "ODF 24-port LC",   category: "fiber" },
            { u: 1, label: "ISR 4431 × 2",     category: "router" },
            { u: 2, label: "3850-24S × 2",     category: "fiber-switch" },
            { u: 2, label: "C9300L-24P",       category: "switch" },
            { u: 1, label: "Cat6 Patch",        category: "patch" },
          ]
        },
        {
          name: "IDF-1 - Kat 1", heightU: 42,
          devices: [
            { u: 1, label: "ODF 24-port LC",   category: "fiber" },
            { u: 1, label: "Cat6 Patch × 2",   category: "patch" },
            { u: 1, label: "2960X-24PS",       category: "switch" },
            { u: 1, label: "2960-24PC",         category: "switch" },
          ]
        },
        {
          name: "IDF-2 - Kat 2", heightU: 42,
          devices: [
            { u: 1, label: "ODF 24-port LC",   category: "fiber" },
            { u: 1, label: "Cat6 Patch × 2",   category: "patch" },
            { u: 1, label: "2960XR-24PS",      category: "switch" },
            { u: 1, label: "2960-24PC",         category: "switch" },
          ]
        }
      ]
    }
  };

  function getOrCreatePopup() {
    let popup = document.getElementById("preset-preview-popup");
    if (!popup) {
      popup = document.createElement("div");
      popup.id = "preset-preview-popup";
      popup.style.position = "fixed";
      popup.style.zIndex = "999999";
      popup.style.display = "none";
      popup.style.background = "rgba(15, 23, 42, 0.97)";
      popup.style.backdropFilter = "blur(16px)";
      popup.style.border = "1px solid rgba(56, 189, 248, 0.4)";
      popup.style.borderRadius = "10px";
      popup.style.boxShadow = "0 24px 50px rgba(0, 0, 0, 0.75), 0 0 25px rgba(56, 189, 248, 0.2)";
      popup.style.pointerEvents = "auto";
      popup.style.maxWidth = "580px";
      popup.style.color = "#f8fafc";
      popup.style.fontFamily = "system-ui, -apple-system, sans-serif";
      document.body.appendChild(popup);
    }
    return popup;
  }

  function renderMiniRack(rackDef) {
    const chips = rackDef.devices.map(d => {
      const col = CATEGORY_COLORS[d.category] || CATEGORY_COLORS.blank;
      const h = Math.max(14, d.u * 15);
      return `<div style="background:${col.bg};color:${col.label};font-size:9px;font-weight:700;height:${h}px;display:flex;align-items:center;justify-content:space-between;padding:0 6px;border-radius:3px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;border-left:2px solid rgba(255,255,255,0.25);">` +
        `<span style="overflow:hidden;text-overflow:ellipsis;max-width:120px;">${d.label}</span>` +
        `<span style="font-size:7.5px;opacity:0.75;margin-left:4px;font-family:monospace;font-weight:800;">${d.u}U</span>` +
        `</div>`;
    }).join("");

    return `<div style="flex:1;min-width:145px;max-width:175px;">` +
      `<div style="font-size:9.5px;font-weight:800;color:#38bdf8;margin-bottom:5px;letter-spacing:0.3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${rackDef.name}</div>` +
      `<div style="background:#090d16;border:1px solid #1e293b;border-radius:6px;padding:6px 5px;position:relative;box-shadow:inset 0 2px 8px rgba(0,0,0,0.6);">` +
      `<div style="margin:0 2px;">${chips}</div>` +
      `</div></div>`;
  }

  function showPresetPopup(presetKey, anchorEl) {
    const popup = getOrCreatePopup();
    const data = PRESET_DATA[presetKey];
    if (!data) return;

    const racksHtml = data.racks.map(renderMiniRack).join("");
    popup.innerHTML = `
      <div style="padding:14px 16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;border-bottom:1px solid rgba(56,189,248,0.2);padding-bottom:8px;">
          <div>
            <div style="font-size:12.5px;font-weight:800;color:#f8fafc;">📦 ${data.title}</div>
            <div style="font-size:10px;color:#94a3b8;margin-top:2px;">Önizleme wireframe şeması</div>
          </div>
          <span style="font-size:9.5px;font-weight:700;color:#38bdf8;background:rgba(56,189,248,0.12);border:1px solid rgba(56,189,248,0.3);border-radius:4px;padding:2px 7px;white-space:nowrap;">
            ${data.racks.length} Kabin · 42U
          </span>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:nowrap;overflow-x:auto;padding-bottom:4px;margin-bottom:10px;">
          ${racksHtml}
        </div>
        <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:10px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:9px;color:#64748b;">Mevcut topoloji sıfırlanacaktır</span>
          <button class="preset-preview-load-btn" data-preset="${presetKey}" style="background:linear-gradient(135deg,#0284c7,#0ea5e9);border:none;color:#ffffff;font-size:11px;font-weight:700;padding:5px 14px;border-radius:5px;cursor:pointer;box-shadow:0 2px 10px rgba(14,165,233,0.4);">
            ⚡ Şablonu Yükle
          </button>
        </div>
      </div>
    `;

    const rect = anchorEl.getBoundingClientRect();
    popup.style.display = "block";
    popup.style.opacity = "1";

    const popupW = popup.offsetWidth || 480;
    const popupH = popup.offsetHeight || 280;
    const spaceBelow = window.innerHeight - rect.bottom;

    if (spaceBelow < popupH && rect.top > popupH) {
      popup.style.top = Math.max(8, rect.top - popupH - 8) + "px";
    } else {
      popup.style.top = (rect.bottom + 8) + "px";
    }

    const left = Math.max(12, Math.min(window.innerWidth - popupW - 16, rect.left));
    popup.style.left = left + "px";

    popup.querySelectorAll(".preset-preview-load-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        hidePresetPopup();
        const key = btn.dataset.preset;
        if (key === "mdf" && RS.loadMdfPreset) RS.loadMdfPreset();
        else if (key === "idf" && RS.loadIdfPreset) RS.loadIdfPreset();
        else if (key === "site" && RS.loadFullSitePreset) RS.loadFullSitePreset();
        document.dispatchEvent(new CustomEvent('rackstudio:change', { bubbles: true, detail: { immediate: true } }));
      });
    });
  }

  function hidePresetPopup() {
    const popup = document.getElementById("preset-preview-popup");
    if (popup) popup.style.display = "none";
  }

  function initPresetPreview() {
    let hideTimer = null;

    function handleEnter(el, presetKey) {
      clearTimeout(hideTimer);
      if (!window.is3DMode) showPresetPopup(presetKey, el);
    }

    function handleLeave() {
      hideTimer = setTimeout(hidePresetPopup, 280);
    }

    // Direct event delegation for any preset trigger
    document.addEventListener("mouseover", (e) => {
      const trigger = e.target.closest("#btn-preset-mdf, #btn-preset-idf, #btn-preset-site, #btn-3d-preset-mdf, #btn-3d-preset-idf, #btn-3d-preset-site, .preset-btn-wrap");
      if (trigger) {
        let key = trigger.dataset.preset;
        if (!key) {
          if (trigger.id.includes("mdf")) key = "mdf";
          else if (trigger.id.includes("idf")) key = "idf";
          else if (trigger.id.includes("site")) key = "site";
        }
        if (key) handleEnter(trigger, key);
      }
    });

    document.addEventListener("mouseout", (e) => {
      const trigger = e.target.closest("#btn-preset-mdf, #btn-preset-idf, #btn-preset-site, #btn-3d-preset-mdf, #btn-3d-preset-idf, #btn-3d-preset-site, .preset-btn-wrap");
      if (trigger) handleLeave();
    });

    // Ensure popup itself handles hover
    const popup = getOrCreatePopup();
    popup.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    popup.addEventListener("mouseleave", () => handleLeave());

    // Hide on click outside or escape key
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#preset-preview-popup") && !e.target.closest("#btn-preset-mdf, #btn-preset-idf, #btn-preset-site, #btn-3d-preset-mdf, #btn-3d-preset-idf, #btn-3d-preset-site, .preset-btn-wrap")) {
        hidePresetPopup();
      }
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") hidePresetPopup();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPresetPreview);
  } else {
    initPresetPreview();
  }

  RS.presetPreview = { show: showPresetPopup, hide: hidePresetPopup };
})();
