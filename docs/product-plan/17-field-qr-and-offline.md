# P12 — QR kimliği ve çevrimdışı saha erişimi

Tarih: 7 Ekim 2026.

## QR erişimi

Araçlar/komut paletinden **Saha QR kodu** açılır. Ortak 2D/3D seçim panelindeki aynı düğme seçili cihaz/hat için kod üretir. İlk 500 nesne hedef seçicisinde sunulur; büyük projede doğrudan seçili nesne düğmesi kullanılır. Proje, kabin, cihaz ve hat kimlikleri desteklenir. Kabin kodu saha iş listesini ilgili kabine filtreler; cihaz/hat kodu ilgili kaydı açar.

Payload `RSQR1:` ve URL-encoded JSON içerir: `v`, `projectId`, `kind`, `id`. Sürüm, boyut, kimlik biçimi, açık proje ve nesnenin halen mevcut olması çözümlemeden önce kontrol edilir. Kod başka projeye aitse açık hata gösterilir; proje otomatik açılmaz/indirilmez. URL, keyfi komut, kimlik doğrulama veya uzaktan veri aktarımı değildir. Silinmiş nesne kodu hata verir. Kopyalanan projenin kimlikleri farklı olduğundan eski kod kopyayı açmaz.

Kod sabit siyah/beyaz, dört modüllük quiet zone ve M hata düzeltmesiyle yerelde üretilir; PNG indirilebilir. Üretilen kodun ham kimliği kopyalanabilir. Elle giriş, yerel QR fotoğrafı veya kullanıcı isteğiyle kamera okunur. Kamera API'si/secure context kontrol edilir; izin reddinde alternatifler açık kalır. Kapatma/durdurma, geç gelen kamera izni ve kamera oturumu değişimi kaynakları temizler. Aynı ekran tekrar açılmaz, aynı tarama ikinci ekran veya saha olayı oluşturmaz. QR erişimi yalnızca gezinmedir; saha komutlarının P11 idempotency kapısı değişmez.

Yerel decoder [jsQR 1.4.0](https://github.com/cozmo/jsQR), üretici [qrcode-generator 1.4.4](https://github.com/kazuhikoarase/qrcode-generator) sürümlerine sabitlenmiştir. `js/vendor/` altında kaynaklar ve Apache-2.0/MIT lisans metinleri bulunur. Çalışma sırasında CDN/QR servisi kullanılmaz. Fotoğraf 20 MB ile sınırlıdır; decoder görüntüyü en fazla 1536 piksele ölçekler. Küçük/hasarlı/uzak QR'ın fiziksel okunabilirliği otomatik fixture başarısıyla garanti edilmez.

## Çevrimdışı hazırlık

**Çevrimdışı saha → Çevrimdışı hazırla**, önce projeyi dayanıklı kayda alır; sonra kullanıcı isteğiyle worker kurar. Sayfa açılışı kendiliğinden yeni worker kurmaz. HTTPS veya localhost gereklidir; [Service Worker çalışma koşulları](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers) esas alınır. File URL kullanımında yerel kayıt, QR üretme/elle/fotoğraf okuma çalışır; uygulama cache'i hazırlanmış diye gösterilmez. Kamera erişimi çalışma ortamına bağlıdır.

`npm run bundle` vendor dosyalarını kopyalar ve `scripts/build-field-offline.cjs` ile SHA-256 içerik tabanlı release kimliği/407 dosyalık liste üretir. Aktif modüler scriptler, CSS, yerel font/görsel varlıkları, index ve manifest cache'e alınır. Bir dosya bile yüklenemezse yeni sürüm kurulmaz ve yarım cache silinir. Asset dosyaları bu release kapsamında cache-first okunur; cache listesi dışındaki istekler, uzak adresler ve proje verileri cache'e eklenmez. Projeler/ekler mevcut IndexedDB deposunda kalır.

**Durumu doğrula**, worker'dan listedeki her dosyanın varlığını kontrol eder. Ağ durumu ile cache hazır olması ayrı bilgi olarak gösterilir. Önceden hazırlanmış HTTP uygulaması ağ kesikken yeniden açılabilir; saha kaydı ve QR yerelde kullanılabilir. Cache veya IndexedDB tarayıcı tarafından silinir/evict edilirse bu garanti devam etmez; uygulama önbelleği dış proje yedeğinin yerine geçmez. File URL, localhost, HTTPS adresleri ve farklı cihazlar ayrı depolama alanlarıdır. Uzak kabul/senkronizasyon iddiası yoktur.

## Güncelleme ve paketleme

Yeni worker otomatik `skipWaiting` yapmaz. **Güncellemeyi kaydet ve yeniden aç** proje kaydını bekler, içerik değişimini kontrol eder ve açık saha/QR/form işlemi varsa reddeder. Başka uygulama sekmesi varken worker aktivasyonu da reddedilir. Kabul sonrası controller değişimi beklenir; kaydın değişmediği tekrar doğrulanır, sekme yazma lease'i bırakılır ve uygulama yeniden açılır. Başarısız yeni cache kurulumu çalışan önceki sürümü korur. Eski cache sürümleri korunur; proje deposu güncellemede silinmez.

Manifest, 192/512 PNG ikonlar ve worker `dist/` içine taşınır. Kaynak asset listesiyle paketlenen 407 dosyanın varlığı ve byte eşitliği ayrıca kontrol edildi. Bu tarayıcı kurulum altyapısıdır; gerçek telefon PWA kurulum/izin/cihaz depolama davranışı pilot kapsamında kalır. Hazırlanmış uygulama dosyası değişiklikleri için bundle/build ve açık güncelleme akışı gerekir; cache hazırlanmamış normal 2D geliştirme akışı sürer.

## Yerel kanıt

`tests/field-qr-offline.test.cjs` hedefli **5/5** geçti: proje/kabin/cihaz/hat QR roundtrip; yanlış sürüm/proje/kaldırılmış nesne ve URL reddi; elle/fotoğraf gezinme; kamera reddi, geç izin temizliği ve sentetik canlı kamera görüntüsünden okuma; File URL ayrımı; gerçek localhost worker kurulumundan sonra ağ kesme/yenileme/yerel saha kaydı; açık form/diğer sekme koruması, açık sürüm geçişi ve başarısız yeni cache kurulumu.

`npm run check`, `npm run build` ve tam `npm test` başarılı: **6 aktif Vitest, 53/53 ürün testi, mevcut tarayıcı paketleri, 29/29 görsel test**. Son hedefli koşuda sentetik kamera ve başarısız cache kurulum kontrolleri ayrıca genişletildi. 320/390/768/1440 ve dört tema görselleri `results/qr-*.png` içinde; son 390px görsel doğrudan incelendi. Büyük proje smoke kontrolü mevcut eşiklerle 100 kabin / 3.000 cihaz / 20.000 kabloda başarılı, hata listesi boş; büyük QR/olay koleksiyonu veya fiziksel GPU benchmark'ı değildir.

Günlükler `qr-offline-check.log`, `qr-offline-build.log`, `qr-offline-full-tests.log`, `qr-offline-targeted.log`, `qr-offline-performance.log`; rapor `qr-offline-performance-100.json`. A17'nin basılmış QR ile gerçek telefon/kamera pilotu ve A18'in gerçek mobil PWA kurulumu/güncellemesi açık kalır. Headless kamera testi fiziksel optik/saha kanıtı sayılmaz.
