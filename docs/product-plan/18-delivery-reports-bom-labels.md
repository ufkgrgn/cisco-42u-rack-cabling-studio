# P13–P16: rapor, malzeme, etiket ve teslim

7 Ekim 2026. Aktif araç menüsü ve komut paletindeki **Teslim merkezi** ortak giriş noktasıdır. 2D/3D görünümünde çalışır. Sunum görünümünde çıktı okunabilir; teslim/kabul kaydı ve içe aktarım için Tasarım/Saha gerekir.

## Kullanım

1. Güncel dayanıklı kayıt veya adlandırılmış revizyonu seçip **Revizyonu dondur** düğmesine basın. Canlı projede sonraki değişiklikler bu raporu değiştirmez; başka bir kaynak için yeniden dondurun.
2. Firma bilgisi, fire, standart metraj, para birimi ve kalem bazlı birim fiyatları girin. Rapor/PDF, kablo CSV, malzeme CSV ve kabin SVG indirin.
3. Etiket genişlik/yükseklik, punto ve A4 kenar boşluğunu ayarlayıp etiket önizlemesini açın. HTML çıktıyı tarayıcıda **%100 / gerçek boyut** ile yazdırın. Sığmayan kimlik/metin için çıktı reddedilir; ölçüyü artırın veya puntoyu azaltın.
4. ZIP'e alınacak doğrulanmış kanıtları işaretleyin. Varsayılan seçim boştur. **Teslim ZIP oluştur ve kaydet**, paketi ve revizyonunu kalıcı teslim geçmişine birlikte yazar; tamamlanan dosyayı indirir.
5. Geçmişten aynı ZIP baytlarını tekrar indirebilirsiniz. Kabul eden ve açıklama ile **Kabul beyanını kaydet**, önceki paketi değiştirmeden ayrı kayıt ekler. Teknik tamamlanma, teslim dosyası oluşturulması ve kabul farklı durumlardır. Kabul beyanı elektronik imza değildir.

## P13: tek veri kaynağı

`report-model.js` dayanıklı başlık/kanıtları okur, seçilen belgeyi kopyalar, kullanılan katalog modellerini belgeye dahil eder, ek SHA-256 değerlerini kontrol eder ve bütün rapor modelini dondurur. Eksik/değişmiş kanıtlar, eşleşme bekleyen gözlemler ve tamamlanmamış saha nesneleri açık işlerdir. PDF, HTML, SVG, CSV ve etiketler aynı sabit kimlik/revizyonu kullanır.

`report-output.js` bağımsız yazdırılabilir HTML, kabin SVG ve UTF-8 CSV üretir; HTML kaçışı ve CSV formül koruması uygular. `report-pdf.js`, yerel pdfmake ve Roboto fontlarıyla Türkçe, A4, tekrarlanan tablo başlıkları ve sayfa numaraları üretir. PDF üretimi ağ bağlantısı gerektirmez. Kayıtlı sunum görünümü metadata'sı `views.json` ile korunur; rapordaki kabin diyagramı kanonik yerleşimdir.

## P14: hesap ilkeleri

- Cihaz modelleri nesne kimlikleriyle sayılır. `device.accessories[]` ve `device.transceivers[]` kayıtlarının açık `quantity` değerleri kullanılır. `portsConfig[portId].transceiver` kayıtları da sayılır; aynı `portId` cihaz transceiver listesinde varsa ikinci kez sayılmaz. Miktarı belirtilmeyen aksesuarlar ayrı bilinmeyenler listesindedir. Katalogdan takılı olduğu kanıtlanmayan modül/transceiver türetilmez; mühendislik katalog kapsamı P17'dir.
- Kablo kimliği yalnız bir kez sayılır. Tahmini, ölçülmüş ve satın alınmış metraj ayrı tutulur; her toplam bilinen/bilinmeyen hat sayısını içerir. Sıfır geçerli değerdir. Eski `lengthMeters`, bu üç alana otomatik çevrilmez.
- Satın alma boyu açıkça girilmişse önceliklidir. Aksi halde ölçüm, yoksa tahmin üzerine fire uygulanır ve yeterli en kısa standart boy önerilir. Standartları aşan boy özel boydur. Hiç metraj yoksa `Bilinmiyor`; 1 m varsayımı yapılmaz.
- Her satır kaynak cihaz/kablo kimliklerine izlenebilir. Birim fiyatlar yalnız kullanıcı girdisidir. Fiyatı eksik satırlar belirtilir; toplam, yalnız fiyatlı kalemlerin ara toplamıdır. Piyasa fiyatı veya satın alma emri değildir.

## P15: iki uçlu etiket

`label-model.js` kabin etiketleri ve kablo A/B çifti üretir. A'nın yerel ucu B'nin karşı ucudur. Tam kullanıcı adı, iki tam uç ve değişmeyen nesne kimliği JSON modelinde korunur; dar etikette görünen ad/uç kısalır. Kimlik ve revizyon basılı alt satırda, proje/nesne kimliği QR içinde kalır. HTML'de fiziksel mm ölçüsü, QR boşlukları ve sayfa kırma kuralları kullanılır. Ekran pikseli ve PDF ölçüsü gerçek yazıcının ölçek/kenar boşluğu kanıtı değildir.

## P16: manifest ve atomik geçmiş

ZIP içeriği: `manifest.json`, tam `project.json` ve kullanılan modeller, `report.pdf`, `report.html`, `cables.csv`, `bom.csv`, `labels.html`, tam `labels.json`, `views.json`, bağımlılık/font lisansları, bütün kabin SVG'leri, seçilen kanıt baytları ve bağımsız `viewer.html`. ZIP açıldıktan sonra `viewer.html` normal tarayıcıda çevrimdışı ve salt okunur görüntülenir; uygulama veya uzak servis gerekmez. Dosyalar manifestte boyut ve SHA-256 ile listelenir. SHA-256 içerik bütünlüğü kontrolüdür; gönderen kimliğini doğrulayan imza değildir.

Kanıt seçimi yalnız dosya içeriğini sınırlar: tam proje referansları, gözlem kaynakları ve diğer belge metadata'sı pakette kalır. Seçilmemiş kanıt referansları açık iş olarak korunur; teknik tamamlanma yeniden hesaplanır. Paket içe aktarımı modelleri, kimlikleri ve referansları değiştirmez, yalnız seçilen ekleri yerel depoya yazar. Aynı proje kimliği varsa üzerine yazılmaz; ayrı çalışma alanı kullanılmalıdır. Eksik kanıtlı içe aktarım, bütün kanıtlar bulunmadan tam proje yedeği oluşturmanın mevcut kontrolünü kaldırmaz.

Paket baytları base64 olarak adlandırılmış teslim revizyonunda saklanır. Güncel başlık, komut makbuzu, normal revizyon ve bu teslim revizyonu tek IndexedDB transaction'ında yazılır. Abort/kota/çakışma hatasında kaydedilmiş teslim görünmez. Kayıt sınırları: ZIP ve açılmış toplam içerik 24 MiB; bir projedeki kodlanmış paket geçmişi 48 MiB; 100 adlandırılmış revizyon. Sınırda açık hata verilir; eski teslimler otomatik silinmez. Tam dış yedek bu paket baytlarını da korur ve hash/manifest doğrulaması yapar.

Undo ve revizyon geri yükleme teslim/kabul geçmişini silmez. Proje kopyası geçmiş kaydını kaynak proje olarak işaretler; kopyada eski paket yeniden teslim edilmiş sayılmaz ve kabul kaydı üretilemez. Kabul, hazırlanmış teslim kimliğine bağlı tek, ayrı yerel beyandır.

## Doğrulama ve kalan saha kanıtı

`tests/product-delivery.test.cjs`: seçilen adlandırılmış revizyonun sonradan yapılan düzenlemelerden ayrılması; HTML/CSV güvenliği; sıfır/bilinmeyen metraj; açık aksesuar/transceiver miktarı ve fiyat; A/B etiket/QR/mm; seçilen eklerle ZIP bütünlüğü ve yeni alana kayıpsız aktarım; bozuk paketin reddi; transaction abort; değişmeyen ZIP; ayrı kabul ve yedekte paket; 2D/3D/sunum, dört tema, gerçek dosya indirme ve 320/390/768/1440 yerleşimi.

`results/p13-p16/report.pdf` altı kabin, 120 cihaz, 60 hat ve açık işler içeren 26 sayfalık kabul fixture'ıdır; Poppler görüntülerinde bütün sayfalar incelendi. Türkçe firma/cihaz metni, ilk/son cihaz ve kablo kimlikleri metin çıkarımıyla da doğrulandı. `labels.pdf` ve 11 sayfalık `labels-multipage.pdf`, mm ölçülü etiket HTML'sinin Chromium yazdırma çıktılarıdır. İkinci çıktıda 6 kabin etiketi ve 60 hattın 120 A/B etiketi eksiksizdir. Gerçek yazıcıyla %100 boyut ve basılı QR'nin telefonla okunması **A23 kapsamında açık**; fiziksel kabul/tanık ve elektronik imza uygulanmış sayılmaz.

Yerel bağımlılıklar: [pdfmake client API](https://pdfmake.github.io/docs/0.1/getting-started/client-side/) ve [fflate](https://github.com/101arrowz/fflate). Bundle komutu dosyaları ve lisansları `js/vendor/` içine alır; offline worker ve dist bunları paketler.

Sıradaki paket: **P17 kaynaklı mühendislik kataloğu**.

Roboto font lisansı: [Google Fonts Roboto Apache-2.0](https://raw.githubusercontent.com/googlefonts/roboto-2/main/LICENSE); metni yerel assets/licenses dizininde ve teslim ZIP'inde saklanır.
