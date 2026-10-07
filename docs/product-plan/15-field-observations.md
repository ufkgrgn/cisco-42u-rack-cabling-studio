# P10 — Gözlem geçmişi ve plan/gözlem farkı

Araçlar/komut paleti → **Gözlem geçmişi**; cihaz etiketi formu veya 2D/3D ortak seçim paneli → **Gözlem geçmişi** aynı kaynak kayıtlarını açar. Liste kaynak/cihaz/port/tarih ile aranır ve 50 kayıtlık sayfalara ayrılır. Farklar varsayılan işaretlenmez; ham/normalize veri ve kaynak özeti ayrı gösterilir. Plan ancak **Seçilen farkları plana uygula** işlemiyle değişir.

## Gözlem sözleşmesi

`observations` koleksiyonunun yeni kayıtları `observationVersion: 1` taşır. `entityRef` cihaz veya bağlantıya; `subject.kind` cihaz/port/bağlantı ayrımına işaret eder. Port gözlemi cihaz referansı ve `subject.portId` taşır. Kaynak sistem/dosya/SHA-256, özgün `raw`, tanınan alanların `normalized` görünümü, isteğe bağlı `collectedAt` ve ayrı `receivedAt` kaydedilir. Toplanma zamanı yoksa alınma zamanı kaynak ölçüm zamanı diye sunulmaz. Bilinmeyen JSON/CSV alanları ham veride korunur; 2000 karakteri aşan tanınmış alan veya geçersiz tarih/metraj sessizce kesilmez, hata verir.

`mapping.status`: matched, ambiguous veya unmatched. Kimlik bulunamazsa instanceId başka tanımlayıcıya otomatik düşürülmez; tekil seri/ad eşlemesi ve katalog port kontrolü kullanılır. Eşleşmeyen/çoklu eşleşen satırlar inceleme kaydı olarak saklanabilir. Kullanıcının hedef seçmesi özgün kaydı değiştirmez; `parentObservationId` ile yeni eşleme kaydı ekler. Plana aktarma bundan ayrı kalır. Proje kopyalanınca aday kimlikleri ve düzeltmenin önceki kayıt bağlantısı yeni kimliklere taşınır; ham kaynak kimlikleri korunur.

İçe alma 5 MB dosya / 5000 satır sınırındadır. Dosya içeriği hash'i, dosya adı, satır konumu ve özgün satır içeriği kayıt kimliğini belirler. Aynı kaynak dosyanın tekrar alınması yeni kayıt/revizyon yaratmaz; kopyalanmış kayıtta içerik hash'i de tekrar kontrolüne katılır. Dosya adı veya dosya içeriği değişirse farklı kaynak kaydıdır. SHA-256 burada tekrar/provenans tanımıdır, kaynağın doğruluğunun sertifikası değildir. Proje belge boyutu ve 50.000 gözlem sınırı da korunur.

## Göç ve uyumluluk

**Eski gözlemleri geçmişe taşı** mevcut `device.observed` cihaz/port bilgilerini kaynak ham verisiyle yeni kayıt biçimine taşır. İlk yeni içe almada gerekli eski alanlar aynı komut içinde korunur. Geçmişteki eski kayıtlar silinmez; tekrar göç kayıt üretmez. Bilinmeyen eski portlar incelemeye ayrılır. Belge açmak/okumak kendiliğinden göç komutu çalıştırmaz.

`device.observed` eski rendererlerle uyumlu bir özet olarak geçmişten türetilir; tarih sırası ile gelen alanları birleştirir. Gerçek kanıt `observations` içindeki ayrı kaynak kayıtlarıdır. Eksik alan yeni gözlemde gelmedi diye plandan veya eski gözlemden silinmez. JSON'da açık null temizleme isteği olabilir; CSV'de mevcut description/vlan sütununun boş değeri fark olarak sunulur. Özellikle operasyonel port status alanı yalnızca saha durumu olarak gösterilir, plana uygulanamaz.

## Ayrı plan işlemi

`ImportObservations` gözlem ekler ve uyumluluk özetini günceller; cihaz adı/IP/model/port planını veya kablo planını değiştirmez. `ApplyObservationDifferences` gözlem kimliği ve işaretlenen alanları taşır. Ortak komut zarfı proje/revizyon/içerik değişimlerini reddeder; yerleşim ve bağlantı doğrulaması geçmeden plan kabul edilmez. Cihaz modeli ancak bilinen, aynı U yüksekliğinde model ve uyumlu mevcut bağlantılarla uygulanabilir; fiziksel yeniden yerleştirme gerektiren model değişimi reddedilir. Kablo uçları bağlantı kuralları ve bütün topoloji üzerinden doğrulanır.

30 günden eski veya aynı hedef/port için daha yeni kayıt bulunan tarihli gözlem **Eski gözlem** olarak görünür. Eski farkın her uygulanışında ayrı onay işaretlenir. Tarihi belirsiz kayda sahte güncellik atanmaz. Bekleyen önizleme sırasında proje/içerik değişirse yeniden dosya seçme veya ekranı açma gerekir. Sunum modunda içe alma, eşleme/göç ve plan değişimi engellenir.

Kaynak geçmişi forward işlemlerde eklenir; seçili fark gözlem kaydını değiştirmez. Proje undo/redo veya revizyon geri dönüşü mevcut anlık belge davranışını kullanır; bu arayüz silinemez bir harici audit servisi değildir. Komut makbuzları seçilen gözlem ve alanları içerir. Kayıt başarısızlığı başarı diye gösterilmez; mevcut yerel taslak/kurtarma mekanizması korunur.

Proje denetimi en güncel gelen alanı kullanır; eski alan farkını yeni eşit değerin arkasından tekrar yükseltmez. Çözülen inceleme kaydının özgün satırı korunur, aktif eşleme uyarısı tekrar sayılmaz. Fark veya inceleme uyarısından ilgili geçmiş kaydına gidilebilir. 2D/3D aynı canonical koleksiyonu taşır.

## Yerel kabul kanıtı

`tests/field-observations.test.cjs`: kaynak/ham/zaman, tekrarlı import, eski veri, ayrı IP/VLAN uygulama, değişmeyen alanlar, eşleme düzeltmesi, kopya referansları, proje değişimi, eski cihaz/port göçü, kablo ucu reddi, stale zarf, reload, 2D/3D ve Sunum koruması. 320/390/768/1440 ve light/dark/blueprint/high-contrast görselleri `results/observations-*.png` içinde. A13/A14 için yerel Headless Edge kanıtıdır; fiziksel dokunmatik, ekran okuyucu, gerçek kaynak envanteri ve saha pilotu ayrıca doğrulanmalıdır.

Son kaynakla derleme/söz dizimi/tip kontrolü ve tam `npm test` geçti: 6 aktif Vitest, 43 ürün testi, mevcut tarayıcı paketleri ve 29 görsel test. Hedefli 5 test, bilinmeyen model reddiyle birlikte son kaynakta tekrar geçti. Mobil bağlantı paneli kapatma seçim temizliği regresyonu doğrulandı. Günlükler `observations-check.log`, `observations-full-tests.log`, `observations-targeted.log`, `observations-mobile-regression.log` içindedir. Mevcut eşiklerle 100 kabin / 3.000 cihaz / 20.000 kablo sentetik kontrolü başarılıdır; `observations-performance-100.json`. Bu rapor büyük gözlem koleksiyonu veya fiziksel GPU benchmark'ı değildir.
