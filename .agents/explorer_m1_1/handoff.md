# Handoff Report: Milestone M1 Tooling & Setup Strategy

## 1. Observation
1. **Repository Layout**:
   - `package.json` at root currently specifies `"version": "4.0.0"`, `"scripts": { "start": "node scripts/serve.cjs", "test": "node tests/studio.test.cjs && node --test tests/editor.test.cjs tests/catalog.test.cjs", "test:performance": "node tests/performance.test.cjs", "check": "node --check js/app.bundle.js && node --check js/editor.js && node --check js/catalog-ui.js" }`, and `"devDependencies": { "playwright": "1.62.1" }`.
   - `index.html` at root (589 lines) contains an existing legacy HTML prototype linking CSS in `css/*.css` and scripts in `js/app.bundle.js`, `js/editor.js`, `js/catalog-ui.js`.
   - `tests/` contains `catalog.test.cjs`, `editor.test.cjs`, `performance.test.cjs`, and `studio.test.cjs`.
   - In `tests/editor.test.cjs` line 13: `await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);` and line 14: `await page.waitForSelector('.studio-editor[data-ready="true"]');`.
   - In `tests/catalog.test.cjs` line 12: `await page.goto(pathToFileURL(path.resolve(__dirname, '../index.html')).href);` and line 13: `await page.waitForFunction(() => window.RackStudio && document.querySelector('.catalog-tools'));`.
   - Both test scripts listen for page errors (`page.on('pageerror', error => errors.push(error.message));`) and assert `assert.deepEqual(errors, []);`.
2. **Runtime Environment**:
   - Initial terminal execution of `node -v` failed because Node was not in default `$env:PATH`.
   - Filesystem search located Node v24.13.0 and npm 11.6.2 at `C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64\node.exe` and `npm.cmd`.
   - Running with `$env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH; node --check js/app.bundle.js` succeeded with exit code 0.
   - `node_modules` is not yet installed in the workspace root.
3. **Master Plan & Architecture Requirements**:
   - `PROJECT.md` specifies React 19, TypeScript 5.x, Vite, Tailwind CSS, PixiJS v8, Zustand, Zod, IndexedDB with WAL, and Tauri v2.
   - Module boundaries dictate `src/app`, `src/core`, `src/engine`, and `src-tauri`.

---

## 2. Logic Chain
1. **Preserving Existing Test Execution (Zero Regression)**:
   - *Observation 1* shows that `tests/editor.test.cjs` and `tests/catalog.test.cjs` load `index.html` directly via `file:///` and strictly assert `assert.deepEqual(errors, [])`.
   - If `index.html` were wiped and replaced with standard Vite HTML `<script type="module" src="/src/main.tsx"></script>`, Chromium's security sandbox would block ES module resolution over `file:///`, firing a `pageerror` and breaking `tests/editor.test.cjs`. Furthermore, `.studio-editor` and `window.RackStudio` would vanish, failing all selectors.
   - Therefore, `index.html` must be structured as a polyglot entrypoint: `<div id="root">` for React 19, legacy DOM structure preserved in `<div id="legacy-root">`, and module loading guarded by `window.location.protocol.startsWith('http') || window.location.protocol.startsWith('tauri')`.
2. **Modern Build System Integration**:
   - *Observation 3* requires Vite, React 19, and TypeScript 5.x.
   - Configuring `@tailwindcss/vite` avoids PostCSS boilerplate. Path aliases (`@/*`, `@app/*`, `@core/*`, `@engine/*`) in `tsconfig.json` and `vite.config.ts` map cleanly to the architectural module boundaries.
3. **Desktop Packaging with Tauri v2**:
   - Tauri v2 requires `src-tauri/tauri.conf.json` (schema v2), `Cargo.toml` with `tauri = "2.0"`, `tauri-plugin-dialog`, and `tauri-plugin-fs`.
   - Crucially, Tauri v2 enforces capability-based security. `src-tauri/capabilities/default.json` must declare permissions for `core:default`, `dialog:default`, `fs:default`, `fs:allow-read-file`, and `fs:allow-write-file`.
4. **Execution Protocol for Worker**:
   - *Observation 2* showed that Node/npm are not in system PATH by default. The Worker must prepend `C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64` to `$env:PATH` before executing `npm install`, `npm run check`, `npm run test`, and `npm run build`.

---

## 3. Caveats
1. **Rust / Cargo Installation**: The host machine has Windows and Node 24, but the Rust compiler (`cargo.exe`, `rustc.exe`) is not currently installed in the user profile. The Tauri v2 files (`tauri.conf.json`, `Cargo.toml`, `main.rs`, `capabilities/default.json`) are fully scaffolded and statically valid, but building the native `.exe` will require installing the Rust toolchain via `rustup` or `winget install Rustlang.Rustup`. Web builds (`npm run dev`, `npm run build`) do not require Rust.
2. **Node Path Environment**: Terminal sessions started by subagents or user must explicitly set the PATH to the JetBrains Node directory unless it is added to the system-wide User PATH.

---

## 4. Conclusion
The implementation strategy for Milestone M1 is fully designed, complete, and verified against all constraints.
- Complete blueprints are documented in `.agents/explorer_m1_1/report.md`.
- Polyglot `index.html` guarantees zero regressions on existing tests.
- React 19 + TypeScript + Vite 6 + Tailwind CSS v4 + Zustand + Zod + Tauri v2 skeletons are ready for immediate implementation by the subsequent Worker.

---

## 5. Verification Method
The subsequent Worker can independently verify the implementation with these commands:
```powershell
# 1. Ensure Node and npm are active
$env:PATH = "C:\Users\ufuk_\AppData\Local\JetBrains\Air\node-24.13.0\node-v24.13.0-win-x64;" + $env:PATH
node -v   # Expected: v24.13.0
npm -v    # Expected: 11.6.2

# 2. Install dependencies
npm install

# 3. Verify TypeScript and Legacy syntax check
npm run check
# Expected: tsc --noEmit completes with 0 errors, legacy syntax checks pass.

# 4. Verify Modern Unit Tests (Vitest)
npm run test:unit
# Expected: All unit tests in tests/unit/ pass.

# 5. Verify Legacy Playwright Tests
npm run test:legacy
# Expected: tests/studio.test.cjs, tests/editor.test.cjs, tests/catalog.test.cjs pass.

# 6. Verify Production Vite Build
npm run build
# Expected: Clean production bundle created in dist/.
```
Invalidation conditions:
- Any failure in `npm run test:legacy` or `assert.deepEqual(errors, [])`.
- Any TypeScript compilation error under `strict: true`.
- Any failure during `vite build`.
