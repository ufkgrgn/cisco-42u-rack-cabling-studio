# Test envanteri ve çalıştırma politikası

27 Eylül 2026 itibarıyla aktif ürün girişi `index.html` içindeki `js/2d/*.js`, `js/studio-bridge.js` ve üretilmiş `js/studio3d*.js` betikleridir. `src/main.tsx` bu sayfaya bağlanmıyor. `src/` ağacı derlenebilir ayrı bir uygulama/prototip olarak saklanıyor; onun testlerinin geçmesi aktif 2D/3D ekranını doğrulamaz.

## Günlük kapı

`npm test` sırasıyla aktif kaynak birim testlerini, gerçek tarayıcı akışlarını ve dokuz görsel/erişilebilirlik senaryosunu çalıştırır. `npm run test:all-unit` eski 352 testlik Vitest kümesini ayrıca çalıştırır. `test:legacy`, uyumluluk için `test:browser` takma adıdır; eski bir arayüzün adı değildir. `npm run test:performance` ve `tests/e2e/runner.cjs` otomatik günlük kapıya dahil değildir; ayrı kapsam ve ölçüm gerektirir.

Bu değişiklik hiçbir tarihsel test dosyasını silmez. Önce yeni aktif karşılıklarını yazıp sonra kopya/maket testleri emekliye ayırmak, davranış boşluğu yaratmamak için seçildi.

## Vitest dosyaları

Sayılar önceki 352 testlik koşudaki `it`/`test` bildirimleridir. Yeni `network-rules-active.test.ts` üç test ekler.

| Dosya (`tests/unit/` altında, aksi belirtilmedikçe) | Test | Sınıf | Karar |
|---|---:|---|---|
| `device-scene-registry.test.ts` | 3 | Aktif `js/2d` kaynağını çalıştırır | Günlük kapıda tut |
| `network-rules-active.test.ts` | 3 | Aktif `js/2d` kaynağını çalıştırır | Günlük kapıda tut |
| `autofill.test.ts` | 4 | Test içi uygulama | Gerçek `switch-autofill.js` akışına taşı |
| `cable-load-balancing.test.ts` | 7 | Test içi uygulama | Gerçek kablo yönlendirmesine taşı |
| `cables-pixi-renderer.test.ts` | 7 | Sahte `RackStudio` davranışı | Tarayıcıdaki Pixi etkileşim testiyle değiştir |
| `field-metrology-telemetry.test.ts` | 8 | Test içi formüller | Gerçek metraj/telemetri API’sine taşı |
| `network-compliance.test.ts` | 28 | Kopya ağ kuralları | Kritik üç kural taşındı; kalan senaryoları gerçek modüle taşı |
| `pixi-cabin-scene.test.ts` | 3 | Test içinde yazılmış sahne modülü | Gerçek `pixi-cabin-scene.js` kaynağını çalıştır |
| `port-config-resolution.test.ts` | 11 | Test içi çözümleyici | Gerçek port yapılandırmasına taşı |
| `smart-focus-camera.test.ts` | 7 | Test içi easing/kamera mantığı | Gerçek zoom yöneticisine taşı |
| `camera-adversarial.test.ts` | 26 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `camera.test.ts` | 15 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `catalog-schema.test.ts` | 8 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `catalog.test.ts` | 7 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `challenger_m3_2_adversarial.test.ts` | 21 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `challenger_m3_recheck_1.test.ts` | 18 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `challenger_m3_recheck_2_adversarial.test.ts` | 25 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `command.test.ts` | 8 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `custom-device-io.test.ts` | 8 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `custom-device-wizard.test.ts` | 7 | Test içi işlev; `src/` tipleri | Prototip kümesinde tut; gerçek sihirbazı ayrıca sınamadan aktif sayma |
| `migration.test.ts` | 3 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `persistence.test.ts` | 9 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `placement-adversarial.test.ts` | 25 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `placement.test.ts` | 32 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `scene.test.ts` | 9 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `searchEngine.test.ts` | 16 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `state.test.ts` | 5 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `touch-camera.test.ts` | 5 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `benchmarks/adversarial_m2_2.test.ts` | 14 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `benchmarks/challenger_m2_recheck_2.test.ts` | 10 | Ayrı `src/` ağacı | Prototip kümesinde tut |
| `benchmarks/fps.test.ts` | 1 | Sentetik `src/` ölçümü | Donanım FPS kanıtı olarak kullanma |
| `benchmarks/search-scale.test.ts` | 2 | Sentetik `src/` ölçümü | Aktif katalog gecikmesi olarak kullanma |

Önceki 352 test: 3 aktif kaynak testi, 75 kopya/maket testi ve 274 ayrı `src/` testi. Yeni üç aktif testle Vitest toplamı 355 olur; günlük birim kapısı altı gerçek kaynak testi çalıştırır. Bu sınıflandırma dosya düzeyindedir; tek tek 352 iddianın ürün gereksinimi olarak onaylandığı anlamına gelmez.

## Tarayıcı ve görsel dosyalar

| Dosya (`tests/` altında) | Sınadığı aktif akış | Karar |
|---|---|---|
| `studio.test.cjs` | Rack montajı, çakışma, atomik içe aktarma, Visio SVG | Tut; ekran görüntüsü yan etkisini ileride geçici çıktıya taşı |
| `editor.test.cjs` | Rack düzenleme, taşıma, geçmiş, depolama geçişi, tablet | Tut |
| `catalog.test.cjs` | Katalog arama/favori/özel donanım | Tut |
| `catalog-touch-preview.test.cjs` | Dokunma ve katalog önizlemesi | Tut |
| `tablet-gestures-smart-shift.test.cjs` | Tablet yerleştirme ve hareket | Tut |
| `pixi-cabling-interaction.test.cjs` | Gerçek Pixi port/kablo etkileşimi | Tut |
| `bridge-sync.test.cjs` | 2D↔3D veri gidiş dönüşü | Tut |
| `visual-upgrade.spec.cjs` | Dört tema, iki küçük ekran, panel erişimi, 3D geometri/kamera, pan çözünürlüğü | Tut; maskeli rack/3D sahne için ayrı görsel kontrol ekle |

`tests/e2e/tier1`–`tier4` dosyaları ayrı `runner.cjs` ile başlatılıyor ve günlük kapıda yok. Bunların 327 statik senaryo bildirimi, çalıştırılmış veya güncel kabul edilmiş senaryo sayısı değildir. Yeni davranışları günlük kapıya taşımadan önce her senaryonun aktif DOM/API ile uyumu ve çakışması ayrıca incelenmeli.

## Sonraki test dönüşümleri

1. Ağ kurallarındaki kalan önemli sınır durumlarını gerçek `NetworkRules` ile sınayıp kopya 28 testi kaldır.
2. Port çözümleme, otomatik kablolama ve metraj için gerçek modül testleri ekle; test içi formülleri kaldır.
3. Maskelenen 2D rack ve 3D sahne için kararlı, sahnenin kendisini doğrulayan seçili görüntü testleri ekle.
4. `src/` ürün olarak kullanılacaksa ayrı giriş noktası ve dağıtım hedefini tanımla; kullanılmayacaksa kod ve testleri ayrı bir temizlik kararında kaldır.
