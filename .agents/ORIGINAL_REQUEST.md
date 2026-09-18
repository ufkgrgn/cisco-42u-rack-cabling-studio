# Original User Request

## 2026-09-14T19:12:21Z

Build a production-grade, 60 FPS Digital Rack Cabin Studio on a modern React + TypeScript + PixiJS v8 + Tauri stack, featuring dynamic variable U-height racks (1-60U), silky smooth drag-and-drop hardware placement, port-to-port cable routing, and an extensible legacy & modern hardware catalog.

Working directory: d:\cisco\cisco-42u-rack-cabling-studio
Integrity mode: development

## Requirements

### R1. Ultra-Fluid GPU Canvas & 60 FPS Viewport Engine
- Implement a 2D rendering canvas powered by PixiJS v8 (WebGL/WebGPU) with an intuitive React + TypeScript UI layer.
- Ensure butter-smooth multi-rack navigation, infinite canvas pan/zoom, and real-time device dragging with ghost previews and slot snapping at a sustained 60 FPS.
- Keep the render loop decoupled from heavy business logic and DOM manipulations so that viewport transformations incur zero layout thrashing.

### R2. Dynamic Variable U-Height & Conflict-Free Placement Engine
- Support arbitrary rack dimensions from 1U up to 60U (and beyond) with front/rear mount viewpoints.
- Enforce strict placement validation: prevent physical device collisions, prohibit rack height shrinkages that clip occupied units, and provide instant visual feedback.
- Guarantee that hardware moves and rearrangements preserve hardware identity, attached port endpoints, and cabling topologies.

### R3. Extensible Legacy & Modern Hardware Catalog with Custom Device Wizard
- Provide a structured catalog schema supporting both modern and legacy equipment (switches, patch panels, servers, PDUs, cable organizers) with physical dimensions, port matrices, transceivers, and power specifications.
- Include a zero-code wizard and import format (JSON/YAML) enabling users and enterprises to add custom hardware definitions without modifying the core codebase.
- Provide sub-100ms fuzzy search and filtering across manufacturers, port types, PoE capability, and unit heights.

### R4. Intelligent Cabling & Inter-Rack Connectivity
- Support port-to-port connections with realistic cable tracing, color coding, category tagging (fiber, copper, DAC, power), and auto-bundling at zoomed-out scales.
- Fully support inter-rack cross-connects and patch panel links with persistent endpoint references.
- Display cable schedules, connection summaries, and connection validation warnings (e.g. connector mismatch or capacity exhaustion).

### R5. Project State, Command History & Cross-Platform Packaging
- Comprehensive undo/redo command architecture (Ctrl+Z / Ctrl+Y) covering all placement, deletion, rack resize, and cabling operations.
- Local offline auto-save via IndexedDB with crash recovery and reliable JSON project export/import with schema migration for legacy files.
- Packageable as a high-performance desktop app via Tauri alongside modern web/PWA browser support.

## Acceptance Criteria

### Performance & Responsiveness
- [ ] Pan, zoom, and hardware drag interactions sustain 60 FPS (p95 frame time <= 16.6ms) on standard desktop hardware with at least 10 fully populated 42U racks visible.
- [ ] Viewport navigation and dragging produce zero frame freezes exceeding 20ms.
- [ ] Hardware catalog search across 1,000+ devices updates results in under 50ms.

### Placement & Rack Flexibility
- [ ] Rack U-height can be adjusted dynamically between 1U and 60U; resizing down is blocked or alerted if occupied slots would be truncated.
- [ ] Device drag-and-drop snaps accurately to rack unit boundaries with clear collision highlighting.
- [ ] Moving a device retains its unique IDs and all connected cables seamlessly update their coordinates.

### Catalog & Custom Hardware
- [ ] Legacy and modern network devices from existing catalog and templates are completely migrated and accessible.
- [ ] User can define a new custom device through the UI with custom U-size and port layout, and immediately place it into any rack.

### Cabling & Data Integrity
- [ ] Both intra-rack and inter-rack cables render accurately and update dynamically during rack or device repositioning.
- [ ] Full undo and redo correctly reverses and reapplies any sequence of modifications.
- [ ] Exported project files can be re-imported with 100% data fidelity, and invalid or corrupted files are caught cleanly without corrupting active workspace.
- [ ] Automated end-to-end and unit tests pass cleanly for core placement rules, state history, and catalog searches.

## 2026-09-18T06:50:08Z

Requested team: Tam Kapsamlı Ekip (Full Team) — 360 derece mimari kontrol, çoklu ajanlı analiz ve regresyon onarımı

Cisco 42U Rack Cabling Studio için 360 derece uçtan uca hata denetimi, regresyon analizi ve kararlılık denetimi gerçekleştirilmesi; port bağlantı doğrulama mekanizmalarının, medya uyuşmazlık kurallarının (RJ45/SFP/SC), switch-to-switch loop/uplink kontrollerinin ve patch panel renk senkronizasyonunun eksiksiz çalışır hale getirilmesi ve mevcut test suite hatalarının giderilmesi.

Working directory: c:\Users\ufuk_\Documents\antigravity\fearless-einstein
Integrity mode: development

## Requirements

### R1. Port Bağlantı ve Fiziksel Medya Uyumluluk Doğrulaması
Kablo bağlama işlemi sırasında port türleri (Bakır RJ45, SFP/SFP+/QSFP, Optik LC/SC) arasındaki medya uyumluluk kontrolleri tutarlı ve net çalışmalıdır. Fare portun üzerindeyken gösterilen tooltip durumu (uygunluk/ret/uyarı) ile porta tıklandığında uygulanan bağlantı mantığı birebir örtüşmelidir. Farklı switch modelleri (Cisco Nexus, Catalyst 9500, Catalyst 2960/3850) ve patch paneller arasındaki meşru bağlantı senaryoları (SFP optik bağlantıları, SC/LC fiber aktarmaları, bakır patch bağlantıları) engellenmemelidir.

### R2. Loop Koruması, Switchler Arası Erişim ve Uplink Modeli Kalibrasyonu
Aynı aktif cihaz üzerindeki zararlı fiziksel döngüler (self-loop) engellenmeye devam ederken; iki switch arasındaki bağlantılarda veya uplink kurulumunda kullanıcının standart access bağlantısı kurabilmesine veya trunk modunu onaylayabilmesine olanak tanınmalıdır. Döngü koruma mekanizmaları normal erişim portu operasyonlarını kilitlememeli ve onay pencerelerinde mantıksal çıkmazlar bulunmamalıdır.

### R3. Yapısal Kablolama ve Patch Panel - Switch Entegrasyonu
Cat6 RJ45 patch paneller, OS2 LC, OM4 LC ve OS2 SC fiber paneller (ODF) ile switchler arasındaki kablolamada; port renkleri, rol rozetleri ve VLAN tanımlamaları iki yönlü senkronize çalışmalıdır. Pasif paneller üzerindeki portlar ve bağlantılar doğru kimlik ve renklerle görselleştirilmelidir.

### R4. Kapsamlı Test Suite Regresyonlarının Giderilmesi ve Performans
Projede mevcut olan tests/studio.test.cjs (Visio SVG dışa aktarımında kablo kimliği ve uzunluk hesaplama uyumsuzluğu) hatası giderilmeli; npm test, npm run test:legacy, npm run test:unit ve npm run check komutlarının tamamı sıfır hata ile geçmelidir. Tarayıcı konsolunda istisna üretilmemeli ve sistem kararlı çalışmalıdır.

## Verification Resources
- npm run check: TypeScript ve modül sözdizimi doğrulama.
- npm run test:legacy: Playwright headless browser E2E testleri (tests/studio.test.cjs, tests/editor.test.cjs, tests/catalog.test.cjs).
- npm run test:unit: Vitest birim ve benchmark testleri (25 test dosyası, 319+ test).
- npm test: Tam otomatik entegrasyon ve regresyon koşumu.

## Acceptance Criteria

### Otomatik Doğrulama (Automated Checks)
- [ ] npm run check komutu 0 hata ile tamamlanmalıdır.
- [ ] npm run test:legacy komutu başarıyla çalışmalı ve tüm testler (100%) yeşile dönmelidir.
- [ ] npm run test:unit komutu 319+ testin tamamında başarıyla geçmelidir.
- [ ] npm test komutu exit code 0 ile tamamlanmalıdır.

### İşlevsel ve Arayüz Doğrulaması (Functional Checks)
- [ ] Tooltip üzerinde yeşil "Bağlamak için tıklayın" görünen her geçerli bağlantı, tıklandığında hata vermeksizin başarıyla kablo oluşturmalıdır.
- [ ] Switch-to-switch kablolama tetiklendiğinde modal arayüzü kullanıcıya Trunk veya Standart Access seçeneklerini sunmalı, işlem kilitlenmemelidir.
- [ ] Patch panel ile switch arasındaki kablolarda renk ve port rolü görsel olarak doğru yansıtılmalıdır.
- [ ] Kablo oluşturma, silme, kabin değiştirme ve JSON/SVG import/export işlemlerinde hiçbir console.error veya yakalanmamış istisna oluşmamalıdır.
