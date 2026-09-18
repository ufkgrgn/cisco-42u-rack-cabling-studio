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

  function renderMiniRack(rackDef) {
    const chips = rackDef.devices.map(d => {
      const col = CATEGORY_COLORS[d.category] || CATEGORY_COLORS.blank;
      const h = Math.max(12, d.u * 14);
      return "<div style=\"background:" + col.bg + ";color:" + col.label + ";font-size:9px;font-weight:700;height:" + h + "px;display:flex;align-items:center;padding:0 5px;border-radius:2px;margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:150px;border-left:2px solid rgba(255,255,255,0.2);\">" + d.label + "</div>";
    }).join("");
    return "<div style=\"margin-bottom:12px;\"><div style=\"font-size:9.5px;font-weight:700;color:#94a3b8;margin-bottom:4px;letter-spacing:0.4px;text-transform:uppercase;\">" + rackDef.name + "</div><div style=\"background:#0f172a;border:1px solid #334155;border-radius:4px;padding:6px 5px;min-width:160px;max-width:160px;\">" + chips + "</div></div>";
  }

  function showPresetPopup(presetKey, anchorEl) {
    const popup = document.getElementById("preset-preview-popup");
    if (!popup) return;
    const data = PRESET_DATA[presetKey];
    if (!data) return;
    const racksHtml = data.racks.map(renderMiniRack).join("");
    popup.innerHTML = "<div style=\"padding:12px 14px;\"><div style=\"font-size:12px;font-weight:800;color:#38bdf8;margin-bottom:10px;border-bottom:1px solid #1e3a5f;padding-bottom:6px;\">📦 " + data.title + "</div><div style=\"display:flex;gap:10px;flex-wrap:wrap;\">" + racksHtml + "</div><div style=\"margin-top:10px;border-top:1px solid #1e293b;padding-top:8px;display:flex;gap:6px;\"><button class=\"preset-preview-load-btn\" data-preset=\"" + presetKey + "\" style=\"background:#1e3a5f;border:1px solid #38bdf8;color:#38bdf8;font-size:10px;font-weight:700;padding:4px 10px;border-radius:4px;cursor:pointer;\">⚡ Yükle</button><span style=\"font-size:9px;color:#64748b;align-self:center;\">veya butona tıklayın</span></div></div>";
    const rect = anchorEl.getBoundingClientRect();
    popup.style.display = "block";
    const popupH = 300;
    const spaceBelow = window.innerHeight - rect.bottom;
    popup.style.top = (spaceBelow < popupH ? (rect.top - popupH - 8) : (rect.bottom + 8)) + "px";
    popup.style.left = Math.max(8, rect.left) + "px";
    popup.querySelectorAll(".preset-preview-load-btn").forEach(function(btn) {
      btn.addEventListener("click", function() {
        hidePresetPopup();
        var key = btn.dataset.preset;
        if (key === "mdf" && RS.loadMdfPreset) RS.loadMdfPreset();
        else if (key === "idf" && RS.loadIdfPreset) RS.loadIdfPreset();
        else if (key === "site" && RS.loadFullSitePreset) RS.loadFullSitePreset();
      });
    });
  }

  function hidePresetPopup() {
    var popup = document.getElementById("preset-preview-popup");
    if (popup) popup.style.display = "none";
  }

  function initPresetPreview() {
    var hideTimer = null;
    function bindTarget(el, presetKey) {
      if (!el) return;
      el.addEventListener("mouseenter", function() {
        clearTimeout(hideTimer);
        if (!window.is3DMode) showPresetPopup(presetKey, el);
      });
      el.addEventListener("mouseleave", function() {
        hideTimer = setTimeout(hidePresetPopup, 250);
      });
    }

    document.querySelectorAll(".preset-btn-wrap").forEach(function(wrap) {
      bindTarget(wrap, wrap.dataset.preset);
    });

    bindTarget(document.getElementById("btn-3d-preset-mdf"), "mdf");
    bindTarget(document.getElementById("btn-3d-preset-idf"), "idf");
    bindTarget(document.getElementById("btn-3d-preset-site"), "site");

    var popup = document.getElementById("preset-preview-popup");
    if (popup) {
      popup.addEventListener("mouseenter", function() { clearTimeout(hideTimer); });
      popup.addEventListener("mouseleave", function() { hideTimer = setTimeout(hidePresetPopup, 250); });
    }
    document.addEventListener("click", function(e) {
      if (!e.target.closest(".preset-btn-wrap") && !e.target.closest("#preset-preview-popup") && !e.target.closest(".preset-btn")) hidePresetPopup();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPresetPreview);
  } else {
    initPresetPreview();
  }

  RS.presetPreview = { show: showPresetPopup, hide: hidePresetPopup };
})();
