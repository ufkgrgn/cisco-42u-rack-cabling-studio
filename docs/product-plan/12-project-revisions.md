# P07 — Adlandırılmış revizyonlar ve alan bazlı fark

Araçlar → Anlık görüntü, yeni **Proje revizyonları** ekranını açar. Revizyon adı, açıklama, taslak/onaylı/teslim etiketi ve karşılaştırma temeli seçilir. Etiketler yerel kullanıcı beyanıdır; yetkili onay veya imzalı teslim P26/P30 kapsamındadır.

## Kayıt ve geri dönüş

- Otomatik depo kayıtları korunur. Adlandırılmış revizyonlar aynı `revisions` store'unda `[projectId, named-UUID]` anahtarıyla ayrı tutulur. Her kayıt tam ProjectDocument, storageVersion, kaynak ve tarih taşır. Proje başına en fazla 100 kayıt ve tek karşılaştırma temeli vardır.
- Önce çalışma dayanıklı kayda alınır. Başlık sürümü, writer lease, açık proje/içerik ve referans verilen yerel ekler transaction içinde kontrol edilir. Temel seçiminin değiştirilmesi ve yeni revizyon birlikte yazılır; abort/kota durumunda önceki temel korunur.
- Liste yalnızca ilgili projenin adlandırılmış anahtar aralığını okur; diğer projelerin ve otomatik revizyonların belgeleri liste için yüklenmez.
- Geri yükleme `RestoreProjectDocument` komutudur. Aynı proje kimliği, güncel içerik/revizyon zarfı ve tam belge doğrulanır. Kabin/cihaz/kablo, özel katalog, konum, metadata, saha/teslim/entegrasyon kayıtları ve uzantılar seçili revizyona döner. Komut makbuzları korunur, revizyon monoton artar; tek undo/redo adımı oluşur. Önceki içerik otomatik dayanıklı kayıt ve geri alma geçmişinde kalır.
- 3D açıkken ortak belge ve sahne birlikte yenilenir. Eski karşılaştırma üzerinden geri yükleme yeni düzenlemeyi silmez; işlem reddedilir ve karşılaştırma yenilenir. Kayıt hatası durumunda editörün mevcut taslak/dayanıklı ayrımı sürer.
- Tam dış yedek adlandırılmış kayıtları, temel etiketini ve eski revizyonların referans verdiği yerel ekleri içerir. İçe aktarım kaynak kimliği, kayıt sınırları, ek boyut/MIME ve SHA-256 doğrular. Düz proje JSON'u depo revizyon geçmişini veya binary ekleri taşımaz.

## Karşılaştırma

Temel ve hedef olarak iki revizyon veya açık çalışma seçilir. Nesneler koleksiyon sırasıyla değil kimlikle eşleşir. Cihazın kabin/U/metadata değişiklikleri, konum ilişkileri, port yapılandırması, kablo uçları/uzunlukları/renkleri, özel katalog, saha kayıtları ve uzantılar önce/sonra alanlarıyla gösterilir. Eksik değer, boş değer ve sıfır ayrı tutulur.

Kamera/aktif kabin/kapı durumu, komut makbuzları, revizyon sayacı, türetilmiş U doluluk dizisi ve metadata güncelleme zamanı içerik farkı sayılmaz. Ortak komut sözleşmesindeki varsayılan alan eşdeğerliği kullanılır. Kimlikli koleksiyonların yeniden sıralanması yanlış nesne değişikliği oluşturmaz; nesne içindeki diğer dizilerin sırası anlamlı kabul edilir.

Güncel hedefteki cihaz, port, kablo veya kabin değişikliğinden editördeki ilgili kabin/cihaza gidilebilir. Silinen veya tarihsel nesneler, genişletilebilir fark kaydındaki alanlarıyla incelenir; silinen nesneye canlı editörde varmış gibi gidilmez.

## Eski snapshot kaynağı

`rack_studio_snapshots_v1` silinmez veya otomatik başka projeye bağlanmaz. Kullanıcı kaydı seçerek yeni adlandırılmış revizyona aktarır; kaynak kimliği/tarihi ayrı tutulur. Tam belge başka projeye aitse aktarım reddedilir. Topoloji-only eski snapshot, açık projenin metadata/katalog/saha bağlamı içinde doğrulanır; uyumsuz referans veya eksik yerel ek varsa kayıt yapılmaz. Eski `captureSnapshot` API'si uyumluluk için korunur; yeni kullanıcı ekranı dayanıklı revizyon akışını kullanır.

## Kanıt ve sınırlar

`tests/project-revisions.test.cjs`: kimlik ve alan farkları, kamera/varsayılan/sıra eşdeğerliği, sıfır uzunluk, etiket/temel kalıcılığı, tam kapsamlı geri dönüş ve tek undo/redo, ekleriyle yedek aktarımı, kaynak koruyan legacy import, transaction abort, eski zarf reddi, dört tema, 320/390 piksel taşma, cihaz odağı, 3D geri yükleme ve Escape.

`project-roundtrip.test.cjs` on 2D/3D geçişi, düzenleme, legacy snapshot yakalama ve reload kapsamını korur; yeni revizyon geri yükleme ve legacy aktarım kontrolleri ayrı revizyon paketindedir. A09/A10 için yerel uygulama kanıtıdır. Fiziksel cihaz, ekran okuyucu, güç kesintisi veya saha pilotunun tamamlandığı iddia edilmez.

Günlükler: `results/revisions-check.log`, `results/revisions-targeted.log`, `results/revisions-full-tests.log`. Görseller: `results/revisions-{light,dark,blueprint,high-contrast}.png`, `results/revisions-{320,390}.png` ve `results/revisions-{320,390}-diff.png`.

Son kontrol: `npm run check`, 6 Vitest + 32 ürün testi + mevcut tarayıcı paketleri + 29 görsel test geçti. 100 kabin / 3.000 cihaz / 20.000 kablo sentetik 2D smoke kontrolü de geçti (`results/revisions-performance-100.json`); revizyon listesinin büyük veri performansı ve fiziksel GPU/saha davranışı ayrıca ölçülmelidir.
