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

// Update css/catalog-sidebar.css
updateFile('css/catalog-sidebar.css', [
  {
    from: `.btn-card-quick-mount:hover {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.5) 0%, rgba(14, 165, 233, 0.25) 100%);
  border-color: #38bdf8;
  box-shadow: 0 0 10px rgba(56, 189, 248, 0.3);
  transform: translateY(-1px);
  color: #ffffff;
}

.sidebar-left [hidden] { display: none !important; }
.sidebar-left :focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }`,
    to: `.btn-card-quick-mount:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
  transform: translateY(-1px);
  color: #ffffff;
}

.sidebar-left [hidden] { display: none !important; }
.sidebar-left :focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 2px; }`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .sidebar-left .device-card:hover {
  background: #f8fafc;
  border-color: #0284c7;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .sidebar-left .device-card.active {
  border-color: #0284c7;
  background: rgba(2, 132, 199, 0.1);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .hw-card-header .device-name {
  color: #64748b;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .sidebar-left .device-card .device-u-badge {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #0284c7;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-quick-mount {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.15) 0%, rgba(14, 165, 233, 0.08) 100%);
  border-color: rgba(2, 132, 199, 0.35);
  color: #0284c7;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-quick-mount:hover {
  background: linear-gradient(135deg, rgba(2, 132, 199, 0.3) 0%, rgba(14, 165, 233, 0.15) 100%);
  border-color: #0284c7;
  color: #0284c7;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .catalog-custom details[open] {
  background: #ffffff;
  border: 1px solid #0284c7;
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .sidebar-left .device-card:hover {
  background: var(--bg-panel);
  border-color: var(--border-strong);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .sidebar-left .device-card.active {
  border-color: var(--accent-strong);
  background: var(--bg-elevated);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .hw-card-header .device-name {
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .sidebar-left .device-card .device-u-badge {
  background: var(--bg-inset);
  border-color: var(--border-subtle);
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-quick-mount {
  background: var(--bg-inset);
  border: 1px solid var(--border);
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .btn-card-quick-mount:hover {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .catalog-custom details[open] {
  background: var(--bg-panel);
  border: 1px solid var(--border-strong);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}`
  }
]);

// Update css/catalog-modal.css
updateFile('css/catalog-modal.css', [
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-modal-container {
  background: #ffffff;
  border-color: #0284c7;
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.25), 0 0 40px rgba(2, 132, 199, 0.15);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-modal-container {
  background: #ffffff;
  border-color: var(--border-strong);
  box-shadow: 0 25px 60px rgba(15, 23, 42, 0.2);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-models-total-badge {
  background: rgba(2, 132, 199, 0.1);
  color: #0284c7;
  border-color: rgba(2, 132, 199, 0.25);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-models-total-badge {
  background: var(--bg-inset);
  color: var(--text-muted);
  border-color: var(--border-subtle);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-search-box input[type="search"]:focus {
  border-color: #0284c7;
  box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.15);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-search-box input[type="search"]:focus {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-strong) 25%, transparent);
}`
  },
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card:hover {
  border-color: #0284c7;
  box-shadow: 0 6px 20px rgba(2, 132, 199, 0.15);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-name {
  color: #0f172a;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-tag {
  color: #0284c7;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-desc {
  color: #64748b;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .badge-u {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #475569;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-bezel {
  background: #f8fafc;
  border-color: #cbd5e1;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-bezel .mini-bezel-ear {
  background: #e2e8f0;
  border-color: #cbd5e1;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-bezel .mini-cisco-text {
  color: #0284c7;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .spec-chip {
  background: #f1f5f9;
  border-color: #e2e8f0;
  color: #334155;
}

:is([data-theme="light"], [data-theme="high-contrast"]) .spec-chip.poe {
  background: rgba(2, 132, 199, 0.1);
  border-color: rgba(2, 132, 199, 0.25);
  color: #0284c7;
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card:hover {
  border-color: var(--border-strong);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-name {
  color: var(--text-main);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-tag {
  color: var(--accent-strong);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-desc {
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .badge-u {
  background: var(--bg-inset);
  border-color: var(--border-subtle);
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-bezel {
  background: var(--bg-panel);
  border-color: var(--border);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-bezel .mini-bezel-ear {
  background: var(--bg-inset);
  border-color: var(--border-subtle);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .cisco-card-bezel .mini-cisco-text {
  color: var(--accent-strong);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .spec-chip {
  background: var(--bg-inset);
  border-color: var(--border-subtle);
  color: var(--text-muted);
}

:is([data-theme="light"], [data-theme="high-contrast"]) .spec-chip.poe {
  background: color-mix(in srgb, var(--accent-amber) 12%, transparent);
  border-color: color-mix(in srgb, var(--accent-amber) 30%, transparent);
  color: var(--accent-amber);
}`
  }
]);

console.log('Blue hue cleanup completed!');
