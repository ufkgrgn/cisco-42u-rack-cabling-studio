# P06 — Proje yönetimi ve saha hiyerarşisi

Araçlar → proje kayıtları, yerel projelerin oluşturma, açma, çoğaltma, arama ve arşiv akışlarını sunar. Mevcut tam dış yedek ve kurtarma kayıtlarına erişim korunur. Açık proje önce başka bir projeye geçilerek arşivlenir.

## Proje bilgileri ve konumlar

Proje adı, müşteri, sorumlu, durum ve hedef tarih düzenlenebilir; oluşturma/güncelleme tarihleri gösterilir. Saha → bina → kat → oda ağacı ve kabin–oda bağlantıları tek `UpdateProjectDetails` komutuyla değişir. Atanmayan kabinler ayrı gösterilir; ağaçtaki kabin seçilerek editöre gidilir.

Komut, bütün belgeyi mutasyondan önce doğrular. Eksik ebeveyn, döngü, geçersiz seviye, atanmış odanın silinmesi, oda yerine sahaya kabin bağlanması ve geçersiz takvim tarihi reddedilir. Başarısız işlem mevcut belgeyi değiştirmez. Eski türü belirtilmemiş konum kayıtlarının uyumluluğu korunur.

Kaydedilmemiş form varken proje oluşturma/açma/çoğaltma ve kabine geçiş engellenir. Kullanıcı bilgileri kaydedebilir veya açıkça formu bırakıp güncel belgeyi yükleyebilir. Asenkron proje okuması sırasında editörde yapılan değişiklik, eski okuma sonucuyla silinmez. Kayıt hatasında form korunur.

## Çoğaltma sözleşmesi

- Kaynak başlık ve yerel ekler aynı IndexedDB okuma transaction'ından alınır. Kopyanın belgesi ve referans verdiği bloblar aynı commit içinde saklanır; eksik ek kopyalamayı durdurur.
- Proje, konum, kabin, cihaz, kablo, gözlem, saha olayı, kanıt, teslim ve entegrasyon kayıtlarına yeni UUID verilir. Bilinen tekil/çoğul referans alanları ve türü belirtilmiş entity referansları yeni kimliklere bağlanır. Blob kimlikleri de yenilenir.
- Katalog/model ve port kimlikleri korunur. `raw`, `observed` ve `native3DImport` özgün kaynak kanıtıdır; bunların içeriği yeniden yazılmaz. Bilinmeyen uzantılardaki serbest metinler veya özel referans alanları otomatik yorumlanmaz.
- `metadata.sourceProjectId` kaynağı gösterir. Komut makbuzları temizlenir; geçmiş saha/teslim revizyon referansları geçerli kalsın diye belge revizyonu korunur. Kaynak kaydı, kaynak ekleri ve kaynak history'si kopyaya taşınmaz/değiştirilmez.

## Kabul kanıtı

`tests/project-manager.test.cjs` gerçek Headless Edge üzerinde oluşturma/arama/arşiv, dört seviyeli konum ve kabin ilişkisi, reload, form koruması, kaynak değiştirmeyen UUID/ek çoğaltması, geçersiz ilişkiler ve açılırken düzenleme senaryolarını doğrular. P06'nın A01/A02/A07 kapsamına ilişkin uygulama kanıtıdır; bütün ürün kabul senaryolarının tamamlandığı anlamına gelmez.

320 ve 390 piksel ekranlarda yatay taşma ve Escape ile kapanma kontrol edildi; son ekran görüntüleri `results/project-manager-{320,390}.png` ve `results/project-manager-{320,390}-details.png` içindedir. Fiziksel mobil cihaz, ekran okuyucu ve saha pilotu ayrıca doğrulanmalıdır.

Doğrulama günlükleri: `results/project-manager-check.log`, `results/project-manager-targeted.log`, `results/project-manager-full-tests.log`. 100 kabin / 3.000 cihaz / 20.000 kablo sentetik performans raporu `results/project-manager-performance-100.json` içindedir; gerçek GPU veya saha akıcılığı kanıtı değildir.
