const fs = require('fs');

function updateFile(filePath, transforms) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  let normalized = content.replace(/\r\n/g, '\n');
  for (const { from, to } of transforms) {
    const fromNorm = from.replace(/\r\n/g, '\n');
    const toNorm = to.replace(/\r\n/g, '\n');
    if (!normalized.includes(fromNorm)) {
      console.warn(`[WARN] Target not found in ${filePath}:\n${fromNorm.slice(0, 80)}...`);
    } else {
      normalized = normalized.replace(fromNorm, toNorm);
    }
  }
  const result = isCrlf ? normalized.replace(/\n/g, '\r\n') : normalized;
  fs.writeFileSync(filePath, result, 'utf8');
  console.log(`Updated ${filePath}`);
}

// 1. Update index.html
updateFile('index.html', [
  {
    from: `<button class="sidebar-toggle-btn" id="btn-toggle-left-sidebar" title="Kütüphaneyi Katla / Aç (Ctrl+B)">
            ◀
          </button>`,
    to: `<button class="sidebar-toggle-btn" id="btn-toggle-left-sidebar" title="Kütüphaneyi Katla / Aç (Ctrl+B)">
            <svg class="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6"/></svg>
          </button>`
  },
  {
    from: `<button class="sidebar-toggle-btn" id="btn-toggle-right-sidebar" title="Çizelgeyi Katla / Aç">
          ▶
        </button>`,
    to: `<button class="sidebar-toggle-btn" id="btn-toggle-right-sidebar" title="Çizelgeyi Katla / Aç">
          <svg class="ui-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6"/></svg>
        </button>`
  }
]);

// 2. Update js/sidebar-controller.js
updateFile('js/sidebar-controller.js', [
  {
    from: `      if (btnToggleLeft) {
        btnToggleLeft.textContent = collapsed ? '▶' : '◀';
        btnToggleLeft.title = collapsed ? 'Kütüphaneyi Aç (Ctrl+B)' : 'Kütüphaneyi Katla (Ctrl+B)';
      }`,
    to: `      if (btnToggleLeft) {
        const iconSvg = window.getLucideIconSvg ? window.getLucideIconSvg(collapsed ? 'ChevronRight' : 'ChevronLeft', 14) : (collapsed ? '▶' : '◀');
        btnToggleLeft.innerHTML = iconSvg;
        btnToggleLeft.title = collapsed ? 'Kütüphaneyi Aç (Ctrl+B)' : 'Kütüphaneyi Katla (Ctrl+B)';
      }`
  },
  {
    from: `      if (btnToggleRight) {
        btnToggleRight.textContent = collapsed ? '◀' : '▶';
        btnToggleRight.title = collapsed ? 'Çizelgeyi Aç' : 'Çizelgeyi Katla';
      }`,
    to: `      if (btnToggleRight) {
        const iconSvg = window.getLucideIconSvg ? window.getLucideIconSvg(collapsed ? 'ChevronLeft' : 'ChevronRight', 14) : (collapsed ? '◀' : '▶');
        btnToggleRight.innerHTML = iconSvg;
        btnToggleRight.title = collapsed ? 'Çizelgeyi Aç' : 'Çizelgeyi Katla';
      }`
  },
  {
    from: `        topdeck.classList.toggle('collapsed');
        const isCollapsed = topdeck.classList.contains('collapsed');
        if (toggleIcon) toggleIcon.textContent = isCollapsed ? '▶' : '◀';`,
    to: `        topdeck.classList.toggle('collapsed');
        const isCollapsed = topdeck.classList.contains('collapsed');
        if (toggleIcon) toggleIcon.innerHTML = window.getLucideIconSvg ? window.getLucideIconSvg(isCollapsed ? 'ChevronRight' : 'ChevronLeft', 14) : (isCollapsed ? '▶' : '◀');`
  }
]);

// 3. Update js/2d/rack-structure-renderer.js
updateFile('js/2d/rack-structure-renderer.js', [
  {
    from: `        const headerPlate = document.createElement('div');
        headerPlate.className = 'rack-header-plate';
        headerPlate.dataset.rackId = rack.id;
        headerPlate.innerHTML = \`
          <div class="rack-header-top-tier">
            <span class="rack-header-title">
              <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
              <span class="rack-header-name-editable" data-rack-id="\${rack.id}" title="Adı düzenlemek için tıklayın">\${escapeHtml(rack.name)}</span>
              <span class="rack-header-rename-hint" title="Adı düzenle"></span>
            </span>
            <span class="rack-header-standard-badge" title="EIA-310-D Standart 19 İnç Kabin Çerçevesi">EIA-310-D Standard</span>
            <span class="rack-header-actions">
              <button class="rack-action-btn rack-hdr-move-left" data-rack-id="\${rack.id}" title="Kabini Sola Taşı"><span class="rack-action-icon">←</span><span class="rack-action-label">Sola</span></button>
              <button class="rack-action-btn rack-hdr-move-right" data-rack-id="\${rack.id}" title="Kabini Sağa Taşı"><span class="rack-action-icon">→</span><span class="rack-action-label">Sağa</span></button>
              <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="\${rack.id}" title="Bu kabindeki tüm kabloları temizle / sök"><span class="rack-action-label">Kablo</span></button>
              <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="\${rack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt"><span class="rack-action-label">Cihaz</span></button>
              <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="\${rack.id}" title="Kabini ve Cihazlarını Çoğalt"><span class="rack-action-label">Klon</span></button>
              \${canDelete ? \`<button class="rack-action-btn danger rack-hdr-delete" data-rack-id="\${rack.id}" title="Kabini Sil"><span class="rack-action-icon">✕</span><span class="rack-action-label">Sil</span></button>\` : ''}
            </span>
          </div>`,
    to: `        const headerPlate = document.createElement('div');
        headerPlate.className = 'rack-header-plate';
        headerPlate.dataset.rackId = rack.id;
        const iconServer = window.getLucideIconSvg ? window.getLucideIconSvg('Server', 14) : '<svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect width="20" height="8" x="2" y="2" rx="2"/><rect width="20" height="8" x="2" y="14" rx="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/></svg>';
        const iconLeft = window.getLucideIconSvg ? window.getLucideIconSvg('ArrowLeft', 12) : '←';
        const iconRight = window.getLucideIconSvg ? window.getLucideIconSvg('ArrowRight', 12) : '→';
        const iconCables = window.getLucideIconSvg ? window.getLucideIconSvg('Unplug', 12) : '';
        const iconDevices = window.getLucideIconSvg ? window.getLucideIconSvg('Trash2', 12) : '';
        const iconDuplicate = window.getLucideIconSvg ? window.getLucideIconSvg('Copy', 12) : '';
        const iconDelete = window.getLucideIconSvg ? window.getLucideIconSvg('Trash2', 12) : '✕';
        headerPlate.innerHTML = \`
          <div class="rack-header-top-tier">
            <span class="rack-header-title">
              \${iconServer}
              <span class="rack-header-name-editable" data-rack-id="\${rack.id}" title="Adı düzenlemek için tıklayın">\${escapeHtml(rack.name)}</span>
              <span class="rack-header-rename-hint" title="Adı düzenle"></span>
            </span>
            <span class="rack-header-standard-badge" title="EIA-310-D Standart 19 İnç Kabin Çerçevesi">EIA-310-D Standard</span>
            <span class="rack-header-actions">
              <button class="rack-action-btn rack-hdr-move-left" data-rack-id="\${rack.id}" title="Kabini Sola Taşı"><span class="rack-action-icon">\${iconLeft}</span><span class="rack-action-label">Sola</span></button>
              <button class="rack-action-btn rack-hdr-move-right" data-rack-id="\${rack.id}" title="Kabini Sağa Taşı"><span class="rack-action-icon">\${iconRight}</span><span class="rack-action-label">Sağa</span></button>
              <button class="rack-action-btn rack-hdr-clear-cables" data-rack-id="\${rack.id}" title="Bu kabindeki tüm kabloları temizle / sök"><span class="rack-action-icon">\${iconCables}</span><span class="rack-action-label">Kablo</span></button>
              <button class="rack-action-btn danger rack-hdr-clear-devices" data-rack-id="\${rack.id}" title="Bu kabindeki tüm cihazları ve kablolarını boşalt"><span class="rack-action-icon">\${iconDevices}</span><span class="rack-action-label">Cihaz</span></button>
              <button class="rack-action-btn rack-hdr-duplicate" data-rack-id="\${rack.id}" title="Kabini ve Cihazlarını Çoğalt"><span class="rack-action-icon">\${iconDuplicate}</span><span class="rack-action-label">Klon</span></button>
              \${canDelete ? \`<button class="rack-action-btn danger rack-hdr-delete" data-rack-id="\${rack.id}" title="Kabini Sil"><span class="rack-action-icon">\${iconDelete}</span><span class="rack-action-label">Sil</span></button>\` : ''}
            </span>
          </div>\``
  }
]);

// 4. Update css/sidebar.css
updateFile('css/sidebar.css', [
  {
    from: `.sidebar-toggle-btn {
  background: rgba(30, 41, 59, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: var(--accent-blue);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.18s ease;
  flex-shrink: 0;
}

.sidebar-toggle-btn:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: var(--accent-blue);
  color: #fff;
  transform: scale(1.05);
}`,
    to: `.sidebar-toggle-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  color: var(--text-muted);
  width: 28px;
  height: 28px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.75rem;
  font-weight: 700;
  transition: all 0.18s ease;
  flex-shrink: 0;
  box-sizing: border-box;
}

.sidebar-toggle-btn:hover {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
  transform: none;
}`
  }
]);

// 5. Update css/rack-overlays.css
updateFile('css/rack-overlays.css', [
  {
    from: `.rack-header-plate {
  position: absolute;
  top: -66px;
  left: 0;
  width: 100%;
  height: 60px;
  background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%);
  border: 1px solid #334155;
  border-bottom: 2px solid #0284c7;
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 4px 8px;
  box-sizing: border-box;
  user-select: none;
  z-index: 10;
  box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.45);
}`,
    to: `.rack-header-plate {
  position: absolute;
  top: -66px;
  left: 0;
  width: 100%;
  height: 60px;
  background: var(--bg-panel);
  border: 1px solid var(--border);
  border-bottom: 2px solid var(--accent-strong);
  border-top-left-radius: 6px;
  border-top-right-radius: 6px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 5px 8px;
  box-sizing: border-box;
  user-select: none;
  z-index: 10;
  box-shadow: 0 -4px 14px rgba(0, 0, 0, 0.25);
}`
  },
  {
    from: `.rack-header-title {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  font-weight: 800;
  color: #38bdf8;
  letter-spacing: 0.4px;
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex: 1 1 auto;
  white-space: nowrap !important;
  overflow: hidden;
}`,
    to: `.rack-header-title {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  color: var(--text-main);
  letter-spacing: 0.3px;
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1 1 auto;
  white-space: nowrap !important;
  overflow: hidden;
}
.rack-header-title svg {
  color: var(--accent-strong);
  flex-shrink: 0;
}`
  },
  {
    from: `.rack-header-standard-badge {
  font-size: 9px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace;
  font-weight: 800;
  letter-spacing: 0.6px;
  color: #38bdf8;
  background: rgba(14, 165, 233, 0.12);
  border: 1px solid rgba(56, 189, 248, 0.3);
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  flex-shrink: 0;
  white-space: nowrap !important;
}`,
    to: `.rack-header-standard-badge {
  font-size: 9px;
  font-family: var(--font-mono);
  font-weight: 700;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  padding: 1px 6px;
  border-radius: 4px;
  text-transform: uppercase;
  flex-shrink: 0;
  white-space: nowrap !important;
}`
  },
  {
    from: `.rack-telemetry-badge.pdu {
  color: #38bdf8;
  border-color: rgba(56, 189, 248, 0.3);
  background: rgba(56, 189, 248, 0.08);
}`,
    to: `.rack-telemetry-badge.pdu {
  color: var(--accent-green);
  border-color: color-mix(in srgb, var(--accent-green) 30%, transparent);
  background: color-mix(in srgb, var(--accent-green) 10%, transparent);
}`
  },
  {
    from: `.uplink-modal-footer .btn-primary {
  background: linear-gradient(135deg, #0284c7, #0369a1);
  border: 1px solid #38bdf8;
  color: #ffffff;
  border-radius: 6px;
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(2, 132, 199, 0.4);
  transition: background 0.15s, box-shadow 0.15s;
}

.uplink-modal-footer .btn-primary:hover {
  background: linear-gradient(135deg, #0369a1, #075985);
  box-shadow: 0 2px 14px rgba(56, 189, 248, 0.5);
}`,
    to: `.uplink-modal-footer .btn-primary {
  background: var(--accent-strong);
  border: 1px solid var(--accent-strong);
  color: #ffffff;
  border-radius: 6px;
  padding: 7px 16px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  transition: all 0.15s ease;
}

.uplink-modal-footer .btn-primary:hover {
  filter: brightness(1.1);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-plate {
  background: linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%);
  border-color: #cbd5e1;
  border-bottom: 2px solid #0284c7;
  box-shadow: 0 -4px 14px rgba(15, 23, 42, 0.08);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-bottom-tier {
  border-top: 1px solid rgba(100, 116, 139, 0.18);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-title {
  color: #0369a1;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-name-editable {
  color: #0f172a;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-name-editable:hover {
  background: rgba(2, 132, 199, 0.12);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-standard-badge {
  color: #0369a1;
  background: rgba(2, 132, 199, 0.1);
  border-color: rgba(2, 132, 199, 0.25);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-plate {
  background: var(--bg-panel);
  border-color: var(--border);
  border-bottom: 2px solid var(--accent-strong);
  box-shadow: 0 -4px 14px rgba(15, 23, 42, 0.08);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-bottom-tier {
  border-top: 1px solid var(--border-subtle);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-title {
  color: var(--text-main);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-name-editable {
  color: var(--text-main);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-name-editable:hover {
  background: var(--border-subtle);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-header-standard-badge {
  color: var(--text-muted);
  background: var(--bg-inset);
  border-color: var(--border-subtle);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .active-rack-target {
  box-shadow: 0 0 0 3px #0284c7, 0 16px 40px rgba(15, 23, 42, 0.2) !important;
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .active-rack-target {
  box-shadow: 0 0 0 2px var(--accent-strong), 0 16px 40px rgba(15, 23, 42, 0.15) !important;
}`
  },
  {
    from: `box-shadow: 0 0 0 3px #38bdf8, 0 20px 50px rgba(0, 0, 0, 0.8) !important;`,
    to: `box-shadow: 0 0 0 2px var(--accent-strong), 0 20px 50px rgba(0, 0, 0, 0.6) !important;`
  }
]);

// 6. Update css/rack-interactions.css
updateFile('css/rack-interactions.css', [
  {
    from: `.rack-action-btn {
  background: rgba(30, 41, 59, 0.85);
  border: 1px solid #334155;
  border-radius: 4px;
  color: #94a3b8;
  font-size: 9.5px;
  font-weight: 700;
  cursor: pointer;
  padding: 2px 5px;
  line-height: 1.2;
  white-space: nowrap;
  transition: all 0.15s;
}
.rack-action-btn.rack-hdr-move-left,
.rack-action-btn.rack-hdr-move-right {
  padding: 2px 4px;
  font-size: 10px;
}
.rack-action-btn:hover {
  background: rgba(56, 189, 248, 0.2);
  border-color: #38bdf8;
  color: #f0f9ff;
}
.rack-action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #fca5a5;
}`,
    to: `.rack-action-btn {
  background: var(--bg-elevated);
  border: 1px solid var(--border);
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 600;
  cursor: pointer;
  padding: 2px 6px;
  height: 22px;
  box-sizing: border-box;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  line-height: 1;
  white-space: nowrap;
  transition: all 0.15s ease;
}
.rack-action-btn .rack-action-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}
.rack-action-btn:hover {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
}
.rack-action-btn.danger {
  color: var(--status-danger);
  border-color: color-mix(in srgb, var(--status-danger) 35%, var(--border));
}
.rack-action-btn.danger:hover {
  background: color-mix(in srgb, var(--status-danger) 15%, transparent);
  border-color: var(--status-danger);
  color: var(--status-danger);
}`
  },
  {
    from: `.multi-rack-stage .rack-action-btn {
  width: 25px;
  min-width: 25px;
  height: 21px;
  padding: 1px 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}`,
    to: `.multi-rack-stage .rack-action-btn {
  width: 24px;
  min-width: 24px;
  height: 22px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .rack-action-btn {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-action-btn:hover {
  background: rgba(2, 132, 199, 0.12);
  border-color: #0284c7;
  color: #0284c7;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.12);
  border-color: #dc2626;
  color: #dc2626;
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .rack-action-btn {
  background: var(--bg-elevated);
  border-color: var(--border);
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-action-btn:hover {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-action-btn.danger {
  color: var(--status-danger);
  border-color: color-mix(in srgb, var(--status-danger) 35%, var(--border));
}

:is([data-theme="light"], [data-theme="high-contrast"]) .rack-action-btn.danger:hover {
  background: color-mix(in srgb, var(--status-danger) 12%, transparent);
  border-color: var(--status-danger);
  color: var(--status-danger);
}`
  },
  {
    from: `.rack-resize-handle:hover,
.rack-resize-handle.active {
  background: #0284c7;
  border-color: #38bdf8;
  box-shadow: 0 0 12px rgba(56, 189, 248, 0.5);
}`,
    to: `.rack-resize-handle:hover,
.rack-resize-handle.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .rack-resize-handle:hover,
:is([data-theme="light"], [data-theme="high-contrast"]) .rack-resize-handle.active {
  background: #0284c7;
  border-color: #0369a1;
  box-shadow: 0 0 12px rgba(2, 132, 199, 0.35);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .rack-resize-handle:hover,
:is([data-theme="light"], [data-theme="high-contrast"]) .rack-resize-handle.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}`
  }
]);

// 7. Update css/catalog-sidebar.css
updateFile('css/catalog-sidebar.css', [
  {
    from: `.quick-filter-chip {
  padding: 3px 8px;
  font-size: 0.68rem;
  font-weight: 600;
  border-radius: 12px;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  line-height: 1.3;
}

.quick-filter-chip:hover {
  background: rgba(51, 65, 85, 0.9);
  border-color: rgba(56, 189, 248, 0.4);
  color: #f1f5f9;
}

.quick-filter-chip.active {
  background: #334155;
  border-color: #475569;
  color: #f8fafc;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}`,
    to: `.quick-filter-chip {
  padding: 3px 9px;
  font-size: 0.68rem;
  font-weight: 600;
  border-radius: 12px;
  background: var(--bg-inset);
  border: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
  line-height: 1.3;
}

.quick-filter-chip:hover {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
}

.quick-filter-chip.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .quick-filter-chip {
  background: #e2e8f0;
  border-color: #cbd5e1;
  color: #475569;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .quick-filter-chip:hover {
  background: #cbd5e1;
  color: #0f172a;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .quick-filter-chip.active {
  background: #1e293b;
  border-color: #0f172a;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .quick-filter-chip {
  background: var(--bg-inset);
  border-color: var(--border);
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .quick-filter-chip:hover {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .quick-filter-chip.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}`
  },
  {
    from: `.catalog-custom-form button[type="submit"] {
  padding: 7px;
  cursor: pointer;
  border: 1px solid #38bdf8;
  border-radius: 5px;
  background: linear-gradient(135deg, #0284c7, #0369a1);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 600;
  margin-top: 4px;
  transition: all 0.15s ease;
}
.catalog-custom-form button[type="submit"]:hover {
  background: linear-gradient(135deg, #0ea5e9, #0284c7);
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
}`,
    to: `.catalog-custom-form button[type="submit"] {
  padding: 7px;
  cursor: pointer;
  border: 1px solid var(--accent-strong);
  border-radius: 5px;
  background: var(--accent-strong);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 600;
  margin-top: 4px;
  transition: all 0.15s ease;
}
.catalog-custom-form button[type="submit"]:hover {
  filter: brightness(1.1);
}`
  }
]);

// 8. Update css/catalog-modal.css
updateFile('css/catalog-modal.css', [
  {
    from: `.cisco-pill {
  background: #1e293b;
  border: 1px solid #334155;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.cisco-pill:hover {
  background: #334155;
  color: #f1f5f9;
}

.cisco-pill.active {
  background: #0284c7;
  border-color: #38bdf8;
  color: #fff;
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
}`,
    to: `.cisco-pill {
  background: var(--bg-inset);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 600;
  padding: 4px 10px;
  border-radius: 14px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.cisco-pill:hover {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
}

.cisco-pill.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-pill {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-pill:hover {
  background: #e2e8f0;
  color: #0f172a;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-pill.active {
  background: #0284c7;
  border-color: #0284c7;
  color: #ffffff;
  box-shadow: 0 2px 6px rgba(2, 132, 199, 0.25);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-pill {
  background: var(--bg-inset);
  border-color: var(--border);
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-pill:hover {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-pill.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}`
  },
  {
    from: `.btn-card-add-lib {
  flex: 1;
  padding: 6px 10px;
  background: #0284c7;
  border: 1px solid #38bdf8;
  border-radius: 5px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.btn-card-add-lib:hover {
  background: #0ea5e9;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.4);
}`,
    to: `.btn-card-add-lib {
  flex: 1;
  padding: 6px 10px;
  background: var(--accent-strong);
  border: 1px solid var(--accent-strong);
  border-radius: 5px;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}
.btn-card-add-lib:hover {
  filter: brightness(1.1);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-add-lib {
  background: #0284c7;
  border-color: #0284c7;
  color: #ffffff;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-add-lib:hover {
  background: #0369a1;
  border-color: #0369a1;
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-add-lib {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-add-lib:hover {
  filter: brightness(1.1);
}`
  }
]);

// 9. Update css/viewport.css
updateFile('css/viewport.css', [
  {
    from: `.routing-btn.active {
  background: linear-gradient(135deg, #0284c7, #0ea5e9);
  color: #fff;
  box-shadow: 0 2px 8px rgba(14, 165, 233, 0.4);
}`,
    to: `.routing-btn.active {
  background: var(--accent-strong);
  color: #ffffff;
  border: 1px solid var(--accent-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  },
  {
    from: `.rack-view-mode-btn.active {
  background: var(--bg-card);
  color: var(--text-main);
  border-color: var(--border-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
}`,
    to: `.rack-view-mode-btn.active {
  background: var(--accent-strong);
  color: #ffffff;
  border-color: var(--accent-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.rack-view-mode-btn.active .rack-view-mode-icon,
.rack-view-mode-btn.active svg {
  color: #ffffff;
  stroke: currentColor;
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .viewport-zoom-dock,
:is([data-theme="light"], [data-theme="high-contrast"]) .viewport-controls-bar {
  background: rgba(255, 255, 255, 0.92);
  border-color: rgba(8, 145, 178, 0.35);
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.1);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .viewport-zoom-dock,
:is([data-theme="light"], [data-theme="high-contrast"]) .viewport-controls-bar {
  background: var(--glass-bg-strong);
  border-color: var(--glass-border);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .routing-btn {
  color: #475569;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .routing-btn:hover {
  color: #0f172a;
  background: #e2e8f0;
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .routing-btn {
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .routing-btn:hover {
  color: var(--text-main);
  background: var(--bg-elevated);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .routing-btn.active {
  background: var(--accent-strong);
  color: #ffffff;
  border-color: var(--accent-strong);
}`
  }
]);

// 10. Update css/main.css
updateFile('css/main.css', [
  {
    from: `.btn-primary {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #f4f1ea;
}
.btn-primary:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #f4f1ea;
  filter: brightness(1.08);
}`,
    to: `.btn-primary,
.btn.primary {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
}
.btn-primary:hover,
.btn.primary:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  filter: brightness(1.08);
}`
  },
  {
    from: `.hud-btn-group .hud-btn:hover,
.hud-btn:hover {
  background: color-mix(in srgb, var(--neon-cyan) 15%, transparent);
  border-color: var(--neon-cyan);
  color: var(--neon-cyan);
}

.hud-btn-group .hud-btn.active,
.hud-btn.active,
.hud-btn.compliance-on {
  background: color-mix(in srgb, var(--neon-cyan) 20%, transparent);
  color: var(--neon-cyan);
  box-shadow: 0 0 8px var(--glow-cyan);
  font-weight: 700;
}`,
    to: `.hud-btn-group .hud-btn:hover,
.hud-btn:hover {
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  color: var(--text-main);
}

.hud-btn-group .hud-btn.active,
.hud-btn.active,
.hud-btn.compliance-on {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  },
  {
    from: `.rack-view-mode-btn.active {
  background: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}`,
    to: `.rack-view-mode-btn.active {
  background: var(--accent-strong);
  color: #ffffff;
  border: 1px solid var(--accent-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  }
]);

// 11. Update css/studio3d-chrome.css
updateFile('css/studio3d-chrome.css', [
  {
    from: `.hud-btn-group .hud-btn.active {
  background: rgba(0, 229, 255, 0.2);
  color: var(--neon-cyan);
  box-shadow: 0 0 8px rgba(0, 229, 255, 0.3);
  font-weight: 700;
}`,
    to: `.hud-btn-group .hud-btn.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  font-weight: 700;
}`
  },
  {
    from: `.hud-btn-group .hud-btn.preset-btn {
  color: #38bdf8;
  font-weight: 700;
}
.hud-btn-group .hud-btn.preset-btn:hover {
  background: rgba(56, 189, 248, 0.18);
  color: #ffffff;
}`,
    to: `.hud-btn-group .hud-btn.preset-btn {
  color: var(--text-main);
  font-weight: 600;
}
.hud-btn-group .hud-btn.preset-btn:hover {
  background: var(--bg-elevated);
  color: var(--text-main);
}`
  }
]);

// 12. Update css/editor.css
updateFile('css/editor.css', [
  {
    from: `.studio-editor button[data-command="resize"] {
  background: linear-gradient(135deg, #0284c7, #0ea5e9);
  border-color: #38bdf8;
  color: #fff;
  font-weight: 700;
  box-shadow: 0 2px 6px rgba(14, 165, 233, 0.35);
}
.studio-editor button[data-command="resize"]:hover {
  background: linear-gradient(135deg, #0369a1, #0284c7);
  border-color: #00e5ff;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
  color: #fff;
}
.studio-editor button[data-command="move"],
.studio-editor button[data-command="duplicate"] {
  background: rgba(30, 41, 59, 0.85);
  border-color: rgba(56, 189, 248, 0.3);
  color: #e2e8f0;
}
.studio-editor button[data-command="move"]:hover:not(:disabled),
.studio-editor button[data-command="duplicate"]:hover:not(:disabled) {
  background: rgba(56, 189, 248, 0.22);
  border-color: #38bdf8;
  color: #fff;
}`,
    to: `.studio-editor button[data-command="resize"] {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #fff;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}
.studio-editor button[data-command="resize"]:hover {
  filter: brightness(1.1);
}
.studio-editor button[data-command="move"],
.studio-editor button[data-command="duplicate"] {
  background: var(--bg-elevated);
  border-color: var(--border);
  color: var(--text-main);
}
.studio-editor button[data-command="move"]:hover:not(:disabled),
.studio-editor button[data-command="duplicate"]:hover:not(:disabled) {
  background: var(--bg-panel-light);
  border-color: var(--border-strong);
  color: var(--text-main);
}`
  }
]);

// 13. Update css/rack-organizers.css
updateFile('css/rack-organizers.css', [
  {
    from: `.autofill-pop-btn-submit {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  border: 1px solid #38bdf8;
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.4);
  display: flex;
  align-items: center;
  gap: 5px;
}

.autofill-pop-btn-submit:hover:not(:disabled) {
  background: linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%);
  box-shadow: 0 4px 12px rgba(14, 165, 233, 0.6);
}`,
    to: `.autofill-pop-btn-submit {
  background: var(--accent-strong);
  border: 1px solid var(--accent-strong);
  color: #ffffff;
  font-size: 11.5px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 4px;
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  gap: 5px;
}

.autofill-pop-btn-submit:hover:not(:disabled) {
  filter: brightness(1.1);
}`
  }
]);

console.log('All theme consistency transforms completed!');
