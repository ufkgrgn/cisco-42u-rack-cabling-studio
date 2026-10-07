# P11 — Saha iş akışı ve kanıt ekleri

## Kullanım

Araçlar/komut paletindeki **Saha iş akışı**, ortak 2D/3D seçim panelindeki **Saha kaydı** veya Saha görünümündeki bağlantı kartı üzerinden açılır. Kabin filtresi ve arama, cihaz/hat işlerini 30 satırlık sayfalarda gösterir. Tasarım görünümünün bağlantı kartı yoğunluğu korunur. Mobil form kaydırılabilir; kapatma başlığı sabit kalır.

Her adım teknisyen, saat dilimi içeren işlem tarihi, alınma zamanı, not, nesne kimliği ve beklenen proje revizyonuyla kaydedilir. Gelecekteki tarih, boş teknisyen, başka proje ve değişmiş işlem önizlemesi reddedilir. Sunum görünümünde geçmiş okunabilir, kayıt yapılamaz.

## Durum ve geçmiş

- Akış: geçerli **Uygulama → Etiketleme → Test**. Başarılı test için en az bir yeni fotoğraf/test eki gerekir. Test edilmedi, değerlendirilemedi, kısmi ve başarısız sonuçlar tamamlanma sayılmaz.
- Bir adımın sonucunu değiştirmek, son aynı adıma bağlanan `parentEventId` ve gerekçe ister. Özgün olay/kanıt değiştirilmez; düzeltme yeni olaydır. Aynı sonuç için yeniden kontrol kaydı alınabilir.
- Kapsam cihazın modeli/port tanımları, kabini, U konumu, yüzü ve port ayarlarını; hatta iki uç ve kablo türünü içerir. Kapsam değişirse eski test **Yeniden test gerekli** görünür. Yeni kapsamda uygulama ve etiketleme de yeniden doğrulanır. İlgisiz proje adı değişimi tek başına testi geçersiz kılmaz.
- Eski, kapsamı bulunmayan olaylar görünür; tamamlanma kanıtı olarak kabul edilmez. Undo/redo ve aynı projeye revizyon dönüşü saha olaylarını ve onların ek referanslarını korur. Geri alınan topoloji üzerinden güncel kapsam tekrar değerlendirilir. Bu davranış gözlem koleksiyonunun eski anlık belge davranışından ayrıdır.
- Kopyalama, olay/önceki olay/ek ve kapsam içindeki nesne kimliklerini birlikte taşır. 2D/3D aynı canonical koleksiyonları kullanır.

## Eklerin dayanıklılığı

`field-events.js`, `field-evidence.js` ve `field-controller.js` ayrı modüllerdir. Olay, ek referansları, SHA-256 hash'leri, komut makbuzu, proje başı ve Blob verisi aynı IndexedDB transaction'ında yazılır. Aktif çalışma ancak transaction tamamlanıp kayıt doğrulandıktan sonra güncellenir. Kota/ek yazma/hash hatasında bu olayın başı, makbuzu ve Blob'u birlikte iptal olur; yarım olay veya yeni orphan ek üretilmez. Mevcut kurtarma/yedek mekanizması korunur.

En fazla 8 ek, dosya başına 20 MB ve toplam 40 MB kabul edilir. Boş dosya, desteklenmeyen MIME ve PNG/JPEG/WebP/PDF imzasıyla uyuşmayan içerik reddedilir. İmza kontrolü dosyanın tüm içeriğinin anlamsal doğruluğunu veya ölçümün gerçekten yapıldığını kanıtlamaz. CSV/JSON/metin ve test sonucu kullanıcı tarafından değerlendirilir; otomatik test cihazı entegrasyonu değildir.

Yeni kayıtta doğrulanmış ek tamamlanmayı açar. Yenilemeden sonra **Kanıt doğrulaması gerekli** görünür; **Test kanıtını doğrula** ekleri yerel depodan okuyup boyut/MIME/SHA-256 kontrolü yapar. Eksik veya bozuk kanıt tamamlanma açmaz. Ek indirme de bu kontrolden geçer. Tam proje yedeği olay ve Blob'u birlikte taşır; yalnızca topoloji JSON'u yerel Blob yedeğinin yerine geçmez.

Dosya hazırlığı ve transaction öncesinde/sırasında aynı proje/revizyon/içerik kontrol edilir. Nadir eşzamanlı değişim transaction sonrasında görülürse, dayanıklı saha kaydı saklanır ve kullanıcı son kaydı yeniden açmaya yönlendirilir; açık çalışma üzerine sessizce yazılmaz. Aynı komut kimliği ve aynı girdi/hash tekrarlandığında ikinci olay oluşmaz. Farklı içerikle tekrar kullanım reddedilir.

## Doğrulama ve sınırlar

`tests/field-events.test.cjs` beş Headless Edge senaryosuyla adım sırası, eksik test/kanıt, gerekçeli düzeltme, uç/model değişimi, geçmiş koruması, ek yazma kesintisi, MIME/imza/hash hatası, eski/farklı proje, tekrarlı komut, offline kayıt/yenileme, 2D/3D, kopya ve dış yedek geri yüklemesini kontrol eder. Gerçek formdan uygulama/etiket/test ve dosya seçme işlemi de yürütülür. Sunumda yazma kapısı korunur.

320/390/768/1440 ve light/dark/blueprint/high-contrast görselleri `results/field-events-*.png` içindedir. Son mobil görünüm doğrudan incelendi. Tasarım görünümündeki dört tema baseline'ı korunur; bağlantı kartı saha düğmesi yalnızca Saha görünümünde görünür.

A15/A16 için yerel uygulama kanıtı, A18 için önceden yüklenmiş File URL uygulamasında ağ kesme/yerel kayıt/yenileme kanıtıdır. HTTPS/localhost asset cache, PWA kurulumu/güncellemesi ve QR P12 kapsamındadır. Uzak sistem kabulü veya ekip senkronizasyonu iddiası yoktur. Gerçek telefon, fiziksel test cihazı, ekran okuyucu ve saha pilotu ayrıca doğrulanmalıdır.

Günlükler: `field-events-check.log`, `field-events-targeted.log`, `field-events-full-tests.log`, `field-events-visual.log`, `field-events-performance.log`. Büyük proje smoke raporu `field-events-performance-100.json`; büyük saha olay koleksiyonu veya fiziksel GPU benchmark'ı değildir.

Son kaynakla `npm run check` ve tam `npm test` başarılı: 6 aktif Vitest, 48/48 ürün testi, mevcut tarayıcı paketleri ve 29/29 görsel test. Saha hedefli paket 5/5 geçti; hash hatası ve dış yedek geri yüklemesi de tam paket içinde yürütüldü. Görsel baseline veya tolerans gevşetilmedi.
