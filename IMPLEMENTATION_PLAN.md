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

## Kaynak düzeni

Bu sürümde çalışan çekirdeğin kaynağı js/app.bundle.js dosyasıdır; ismine rağmen elle bakımı yapılan bağımsız giriş dosyasıdır. Eski js/app.js, rack.js vb. ES modülleri index.html tarafından yüklenmez. Yeni modüller RackStudio API'si üzerinden bağlanır. Eski dosyalar geçiş referansı olarak korunur; iki ayrı kaynağa aynı değişiklik yazılmaz.
