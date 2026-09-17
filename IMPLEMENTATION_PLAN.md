# Rack Studio — uygulanabilir geliştirme planı

Bu teslimat mevcut uygulamayı çalışır tutarak editör temelini tamamlar. Büyük framework/GPU geçişi, ölçüm olmadan yapılmaz. Kullanıcının mevcut dosyaları korunur.

## İş paketleri ve sorumluluklar

1. Çekirdek agent: değişken 1–60U kabin, tek doğrulanmış yerleşim akışı, güvenli JSON aktarımı, dinamik çizim/çıktı, ortak RackStudio API.
2. Editör agent: cihaz seçimi/taşıma/çoğaltma, U ve kabin düzenleme, sürükleme, undo/redo, yerel otomatik kayıt.
3. Katalog agent: normalize arama, filtreler, favoriler, kod yazmadan özel donanım ekleme.
4. Ana agent: entegrasyon, gerçek tarayıcı testleri, veri bütünlüğü kontrolleri, dokümantasyon ve bulunan hataların düzeltilmesi.

## Bu sürümün kabul kriterleri

- Kabin yüksekliği değişir; dolu alan kesilemez. Çakışan veya sınır dışı cihaz taşınamaz.
- Taşınan cihazın kimliği ve kabloları korunur; kabinler arası taşıma uç referanslarını günceller.
- İşlemler geri/ileri alınır. Sayfa yenilendiğinde kayıtlı proje kurtarılır; kayıt başarısızlığı görünürdür.
- Model araması ve özel cihaz tanımı çalışır. Özel modeller JSON ve yerel kayıtta korunur.
- Bozuk içe aktarım açık projeyi değiştirmez; legacy veriler doğrulanarak dönüştürülür.
- Mevcut MDF/IDF şablonları, port kablolama ve SVG/JSON aktarımı çalışmaya devam eder.
- JavaScript sözdizimi, gerçek tarayıcı işlev testleri ve etkileşim ölçümü raporlanır.

## Sonraki üretim kapıları

Bu iş paketleri 60 FPS veya kurumsal çok kullanıcılı ürün sertifikası değildir. Aşağıdaki işler ayrı kabul kapılarıdır:

- Aynı sentetik sahnede DOM/SVG ve PixiJS prototipi: 1/10 görünür kabin ve 100 kabinlik veri seti; p95 kare süresi, kaçırılan kare, giriş gecikmesi, bellek. Ölçümle renderer seçimi.
- TypeScript domain/commands/renderer/persistence paketlerine ayrıştırma ve IndexedDB transaction günlüğü; mevcut JSON fixture'larıyla kayıpsız geçiş.
- Sanallaştırılmış çoklu kabin sahnesi, ayrıntı seviyeleri, worker arama ve büyük dosya işleme; referans donanımda 60 Hz kabul testi.
- Kaynakları doğrulanmış üretici katalogları, modül/transceiver modeli, fiziksel uyumluluk, toplu port eşleme.
- Firma izolasyonu, rol yetkileri, revizyonlar, paylaşım ve eşzamanlı çakışma çözümü.
- Web/PWA ve Tauri paketleri; platform, erişilebilirlik ve uzun süreli kurtarma testleri.

## Kaynak düzeni ve Mimari Rehberi (AI Agent ve Geliştirici Kılavuzu)

- **2D Rack Studio Çekirdeği:** Canonical (ana) kaynak `js/2d/` klasörüdür. `index.html` ve `dist/index.html` doğrudan bu modülleri sırayla yükler:
  - `js/2d/utils.js`: Temel yardımcılar (`escapeHtml`, `portKey`, bildirim baloncuğu)
  - `js/2d/catalog.js`: Donanım modelleri ve katalog özellikleri (`HARDWARE_CATALOG`)
  - `js/2d/state.js`: Çoklu kabin reaktif state ve DOM referansları (`STATE`, `dom`, `getActiveRack`)
  - `js/2d/zoom-manager.js`: Tuval yakınlaştırma, kaydırma ve ekrana sığdırma (`fitRackToScreen`)
  - `js/2d/rack-manager.js`: Çoklu kabin sekmeleri, kabin ekleme/silme/değiştirme
  - `js/2d/rack-renderer.js`: 42U ray slotları, cihaz yerleşimi (`mountDeviceAt`) ve ön panel çizimleri
  - `js/2d/cabling-engine.js`: SVG Bézier ve ortogonal D-ring kanal rotalaması (`renderAllCables`)
  - `js/2d/schedule-table.js`: Kablo bağlantı çizelgesi tablosu ve rol seçici popover
  - `js/2d/topology-io.js`: JSON topoloji dışa/içe aktarımı (`loadCustomTopology`), Visio SVG çıktısı
  - `js/2d/presets.js`: MDF, IDF ve Tam Saha hazır topoloji şablonları
  - `js/2d/app.js`: Olay koordinatörü, sürükle-bırak entegrasyonu ve `window.RackStudio` export'u

- **UI ve Modal Kontrolcüleri:** `js/` kök dizininde tekil sorumluluklu ayrık dosyalar:
  - `js/port-config-editor.js`, `js/device-metadata-editor.js`, `js/topbar-controller.js`, `js/sidebar-controller.js`, `js/studio-bridge.js`

- **3D Stüdyo Modülleri:** Kaynaklar `js/src/3d/` ve `js/src/3d-ui/` altındadır (`npm run bundle` ile `js/studio3d.js` ve `js/studio3d-ui.js` üretilir).

- **ÖNEMLİ KURAL (AI Agent Uyarısı):** Eski `app.bundle.js` tamamen silinmiştir ve projeden çıkarılmıştır. Hiçbir yapay zeka ajanı veya geliştirici `app.bundle.js` oluşturmamalı veya aramamalıdır. Tüm 2D geliştirmeleri doğrudan `js/2d/` altındaki ayrıştırılmış dosyalarda yapılmalıdır.
