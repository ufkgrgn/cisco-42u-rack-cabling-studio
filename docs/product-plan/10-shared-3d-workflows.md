# P05 — ortak 2D/3D proje ve dosya akışları

3D domain düzenlemeleri `ProjectCommands.ApplyTopology` üzerinden canlı belgeye uygulanır. Saha kayıtları, metadata ve bilinmeyen belge alanları sahneden yeniden kurulmaz. Port/cihaz/kablo, çoklu sökme ve MDF/IDF şablonunun iç içe çağrıları tek komut/revizyon/undo sınırındadır. Şablon içindeki başarısız yerleştirme bütün sahneyi geri yükler. Kamera ve sahne projeksiyonu domain komutu oluşturmaz.

`project-command-bridge.js` ortak işlem sınırı; `project-presets.js` MDF yerleştirme/bağlantı planı; `project-file-controls.js` dosya UI ve eski 3D migration sınırıdır. 3D UI koordinatörü bu modülleri bağlar. Metadata ve port formu yalnızca aktif görünümün yazıcısına gider; ikinci gizli görünüm bağımsız değişiklik yapmaz.

## JSON dosyası

- Dışa aktarım `ProjectDocument` v1 belgesinin tamamını indirir: plan, metadata, saha kayıtları, katalog, uzunluk alanları, ek referansları ve uzantılar. Bu dosya eklerin binary içeriğini taşımaz; ekleri de içeren depo yedeği P04 proje yedekleme akışındadır.
- İçe aktarım 32 MB byte sınırını, sürümü, güvenli anahtar/derinlik sınırlarını ve bütün yerleşim/port eşlemesini doğrular. Geçersiz dosya açık projeyi değiştirmez. Açılırken yapılan düzenleme eski okuma sonucuyla silinmez.
- Önce mevcut proje dayanıklı kayda alınır. Gelen belge bağımsız depo kaydına yazılmadan aktif belge değiştirilmez. Başka sekmenin writer lease/kayıt çatışması önceki projeyi korur.
- Yeni kimlikli proje kendi kimliğiyle açılır. Aynı kimlikli kayıt varsa dosya yeni UUID ile **ayrı kopya** olarak açılır: koleksiyonların açık `projectId` ve project entity referansları remap edilir; eski proje korunur, kopyanın komut makbuzları sıfırlanır. Orijinal kimlik `metadata.sourceProjectId` içinde tutulur. Önceki projenin undo geçmişi yeni projeye taşınmaz.
- `3.1.0-3D` dosyaları sınırlandırılmış migration ile açılır. Özgün payload `extensions.native3DImport` içinde kalır. Eski 3D modelin U/port tanımı ortak modelle uyuşmuyorsa eski fiziksel tanım proje içi yerel modele dönüştürülür. Tanımsız model veya çözümlenemeyen/dolu port reddedilir; sessizce ilk porta bağlanmaz.

## Kabul kanıtı ve sınırlar

- `project-roundtrip.test.cjs`: A08/A41 için on görünüm geçişi, bütün maddi fixture alanları, siyah renk/sıfır uzunluk, custom katalog, saha kayıtları, kayıt/reload, ortak undo/redo ve kamera/domain ayrımı.
- `project-3d-workflows.test.cjs`: gerçek Edge JSON download/dosya seçimi, kimlik çakışmasında ayrı kopya, bozuk sürüm/port reddi, eski native dosya ve 2U panel migration, yavaş okuma sırasında düzenleme, metadata/port formu, sayısal olmayan port kimliği, sıfırlama, toplu sökme, IDF/MDF ve ortak undo, yerel katalog ve reload.
- 32 MB UI size sınırı testinde File.size enjeksiyonu kullanılır; model parserının kendi byte/depth/güvenli anahtar sınırları veri testlerinde ayrıca denetlenir. Sihirbazın mevcut gizli başlatma düğmesi görünür yapılmadı; mevcut handler programatik tetiklenerek katalog kalıcılığı test edildi.
- 100 kabin / 3.000 cihaz / 20.000 kablo kontrolü sentetik 2D smoke ölçümüdür. Fiziksel GPU, güç kesintisi ve saha pilotu kanıtı değildir.

Günlükler: `results/shared-3d-completion-check.log`, `results/shared-3d-completion-full-tests.log`, `results/shared-3d-workflows.log`, `results/shared-3d-completion-performance-100.json`.
