const fs = require('fs');

function updateFile(filePath, transforms) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCrlf = content.includes('\r\n');
  let normalized = content.replace(/\r\n/g, '\n');
  for (const { from, to, warn } of transforms) {
    const fromNorm = from.replace(/\r\n/g, '\n');
    const toNorm = to.replace(/\r\n/g, '\n');
    if (!normalized.includes(fromNorm)) {
      if (!warn) console.warn(`[WARN] Target not found in ${filePath}:\n${fromNorm.slice(0, 80)}`);
    } else {
      normalized = normalized.replace(fromNorm, toNorm);
    }
  }
  const result = isCrlf ? normalized.replace(/\n/g, '\r\n') : normalized;
  fs.writeFileSync(filePath, result, 'utf8');
  console.log(`Updated ${filePath}`);
}

// 1. Fix rack-tab active — replace neon-cyan with accent tokens
updateFile('css/viewport.css', [
  {
    from: `.rack-tab-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: color-mix(in srgb, var(--neon-cyan) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--neon-cyan) 22%, transparent);
  color: var(--neon-cyan);
  font-size: 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}`,
    to: `.rack-tab-index {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  background: var(--bg-inset);
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 10px;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}`
  },
  {
    from: `.rack-tab:hover {
  background: color-mix(in srgb, var(--accent-blue) 14%, transparent);
  color: var(--text-main);
  border-color: color-mix(in srgb, var(--accent-blue) 35%, transparent);
}

.rack-tab.active {
  background: color-mix(in srgb, var(--accent-blue) 18%, transparent);
  color: var(--accent-blue);
  border-color: var(--accent-blue);
  box-shadow: 0 0 12px var(--glow-cyan);
}

.rack-tab.active .rack-tab-index {
  background: color-mix(in srgb, var(--accent-blue) 28%, transparent);
  border-color: var(--accent-blue);
  color: var(--accent-blue);
}

.rack-tab.active .rack-tab-meta {
  color: color-mix(in srgb, var(--accent-blue) 80%, var(--text-muted));
}`,
    to: `.rack-tab:hover {
  background: var(--bg-panel-light);
  color: var(--text-main);
  border-color: var(--border-strong);
}

.rack-tab.active {
  background: var(--accent-strong);
  color: #ffffff;
  border-color: var(--accent-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.rack-tab.active .rack-tab-index {
  background: rgba(255, 255, 255, 0.2);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
}

.rack-tab.active .rack-tab-meta {
  color: rgba(255, 255, 255, 0.75);
}`
  }
]);

// 2. Fix rail-btn.active — neon-cyan → accent tokens
updateFile('css/sidebar.css', [
  {
    from: `.rail-btn.active {
  color: var(--neon-cyan);
  background: color-mix(in srgb, var(--neon-cyan) 12%, transparent);
  border-color: color-mix(in srgb, var(--neon-cyan) 35%, transparent);
  box-shadow: inset 0 0 6px var(--glow-cyan);
}

.rail-btn.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2.5px;
  background: var(--neon-cyan);
  border-radius: 0 2px 2px 0;
}`,
    to: `.rail-btn.active {
  color: var(--text-main);
  background: var(--bg-elevated);
  border-color: var(--border-strong);
  box-shadow: none;
}

.rail-btn.active::before {
  content: "";
  position: absolute;
  left: 0;
  top: 6px;
  bottom: 6px;
  width: 2.5px;
  background: var(--accent-strong);
  border-radius: 0 2px 2px 0;
}`
  }
]);

// 3. Fix catalog-mode-btn.active — hardcoded colors → theme tokens
updateFile('css/catalog-inspector.css', [
  {
    from: `.catalog-mode-btn.active {
  background: #334155;
  border-color: #475569;
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
}`,
    to: `.catalog-mode-btn.active {
  background: var(--accent-strong);
  border-color: var(--accent-strong);
  color: #ffffff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  },
  {
    from: `.catalog-mode-btn:hover:not(.active) {
  background: rgba(255, 255, 255, 0.1);
  color: #f1f5f9;
  border-color: rgba(255, 255, 255, 0.2);
}`,
    to: `.catalog-mode-btn:hover:not(.active) {
  background: var(--bg-elevated);
  color: var(--text-main);
  border-color: var(--border-strong);
}`
  }
]);

// 4. Fix sort-tab-btn.active in schedule-role-picker.css
updateFile('css/schedule-role-picker.css', [
  {
    from: `.sort-tab-btn.active {
  background: #0284c7;
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 4px rgba(2, 132, 199, 0.4);
}`,
    to: `.sort-tab-btn.active {
  background: var(--accent-strong);
  color: #ffffff;
  font-weight: 700;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  }
]);

// 5. Fix segmented-btn.active in main.css and studio3d-chrome.css
updateFile('css/main.css', [
  {
    from: `.segmented-btn.active {
  background: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}`,
    to: `.segmented-btn.active {
  background: var(--accent-strong);
  color: #ffffff;
  border: 1px solid var(--accent-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  }
]);

updateFile('css/studio3d-chrome.css', [
  {
    from: `.segmented-btn.active {
  background: var(--bg-card);
  color: var(--text-main);
  border: 1px solid var(--border-medium);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
}`,
    to: `.segmented-btn.active {
  background: var(--accent-strong);
  color: #ffffff;
  border: 1px solid var(--accent-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}`
  }
]);

// 6. Update sidebar-toggle-btn light theme overrides in sidebar.css
// Remove `var(--mini-cisco-text)` blue if present
const sidebarContent = fs.readFileSync('css/sidebar.css', 'utf8');
if (sidebarContent.includes('var(--accent-blue)') || sidebarContent.includes('#38bdf8') || sidebarContent.includes('#0284c7')) {
  updateFile('css/sidebar.css', [
    {
      from: `.mini-cisco-text {
  font-size: 5px;
  font-weight: 900;
  color: var(--accent-blue);
  letter-spacing: 0.5px;
  font-family: ui-sans-serif, system-ui, sans-serif;
  line-height: 1;
}`,
      to: `.mini-cisco-text {
  font-size: 5px;
  font-weight: 900;
  color: var(--text-muted);
  letter-spacing: 0.5px;
  font-family: ui-sans-serif, system-ui, sans-serif;
  line-height: 1;
}`,
      warn: true
    },
    {
      from: `.mini-sfp-cage {
  width: 4px;
  height: 6px;
  background: #040810;
  border: 0.5px solid #38bdf8;
  border-radius: 0.5px;
}`,
      to: `.mini-sfp-cage {
  width: 4px;
  height: 6px;
  background: #040810;
  border: 0.5px solid var(--border);
  border-radius: 0.5px;
}`,
      warn: true
    },
    {
      from: `.mini-sc-block {
  width: 7px;
  height: 6px;
  background: #0284c7;
  border: 0.5px solid #38bdf8;
  border-radius: 0.5px;
}`,
      to: `.mini-sc-block {
  width: 7px;
  height: 6px;
  background: var(--accent-strong);
  border: 0.5px solid var(--border);
  border-radius: 0.5px;
}`,
      warn: true
    },
    {
      from: `.mini-os2-block {
  width: 6px;
  height: 6px;
  background: #0284c7;
  border-radius: 0.5px;
}`,
      to: `.mini-os2-block {
  width: 6px;
  height: 6px;
  background: var(--accent-strong);
  border-radius: 0.5px;
}`,
      warn: true
    },
    {
      from: `.mini-odf-block {
  width: 6px;
  height: 6px;
  background: #0891b2;
  border-radius: 0.5px;
}`,
      to: `.mini-odf-block {
  width: 6px;
  height: 6px;
  background: var(--accent-strong);
  border-radius: 0.5px;
}`,
      warn: true
    },
    // device-card.device-u-badge
    {
      from: `.device-card .device-u-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: rgba(36, 48, 72, 0.7);
  border: 1px solid rgba(56, 189, 248, 0.25);
  color: var(--accent-blue);
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-left: auto;
}`,
      to: `.device-card .device-u-badge {
  font-size: 0.65rem;
  font-weight: 700;
  background: var(--bg-inset);
  border: 1px solid var(--border-subtle);
  color: var(--text-muted);
  padding: 1px 5px;
  border-radius: 3px;
  flex-shrink: 0;
  margin-left: auto;
}`,
      warn: true
    }
  ]);
}

// 7. Fix search focus outline in catalog-sidebar.css
updateFile('css/catalog-sidebar.css', [
  {
    from: `:is([data-theme="light"], [data-theme="high-contrast"]) .catalog-search-bar input[type="search"]:focus {
  border-color: var(--accent-blue);
  box-shadow: 0 0 0 2px rgba(2, 132, 199, 0.2);
}`,
    to: `:is([data-theme="light"], [data-theme="high-contrast"]) .catalog-search-bar input[type="search"]:focus {
  border-color: var(--accent-strong);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--accent-strong) 25%, transparent);
}`
  }
]);

console.log('Active-state consistency pass completed!');
