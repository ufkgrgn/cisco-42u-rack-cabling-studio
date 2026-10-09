# Rack Studio 4.0.0 — kullanım, destek ve bakım

1. Proje kayıtlarından yeni proje açın; saha/bina/kat/oda ve kabin bağlantılarını kaydedin. Tasarım görünümünde cihaz/kablo planını oluşturun. Kayıt durumu dayanıklı kaydı göstermeden işi kapatmayın.
2. Önce adlandırılmış revizyon, ardından saha görünümü. Uygulama → etiket → test sırası; başarılı testte gerçek kanıt dosyası gerekir. Gözlem plan değildir; fark ekranında seçilen alanları onaylayın.
3. Teslimi dondurun; malzeme, etiket, PDF/ZIP ve revizyon referansını kontrol edin. Tam dış yedek alın ve ayrı tarayıcı profili/desktop depoda yeniden açın.
4. Ekip ekranında doğrulanmış erişim token'ıyla bağlanın. Sunucuda kabul edilmiş projeyi açın; yerel düzenlemeyi bekleyen taslağa ekleyin; farkları inceleyip gönderin. “Bekleyen” veya “yerel taslak” sunucu kabulü değildir. Ağ geri gelince açıklamalar tekrar bağlanır; topoloji taslağını açıkça gönderin. Çatışmada sunucu/yerel seçimini nesne/alan başına yapın. Silinen nesne için sunucu değerini koruyun; aynı U/port fiziksel çatışmasını yerel taslakta düzeltin.
5. Destekte Araçlar → Yerel teşhis yalnızca sürüm, platform/depo ve sayısal kayıt/kuyruk sayısını önizler/indirir. Topoloji, müşteri adı/kimliği, ham hata, sorgu, fotoğraf ve secret içermez; kendiliğinden gönderilmez. Gerekli proje yedeğini kullanıcı ayrıca seçer.

## Yaşam döngüsü

Yerel arşiv düzenlemeyi kapatır, arşivden çıkarma açar. Aktif projeyi arşivlemek/silmek için başka proje açın. Kalıcı silme arşivlenmiş projede tam proje adı ister, başka yazıcı lease'i ve bekleyen ekip taslağı varsa reddeder. Yerel head/revizyon/log/ek/ilgili meta birlikte silinir. Kurtarma orijinalleri ayrı tutulur. Sunucuda arşiv ve geri açma bağımsızdır; arşiv paylaşımları iptal eder, kabul edilmiş tasarım güncellemelerini engeller. Sunucu kalıcı silmesi üyelik/revizyon/komut/ek/açıklama/paylaşımı SQL cascade ile kaldırır. Yerel kayıt, sunucu kayıt ve dış teslim/yedek üç ayrı kopyadır; birindeki silme diğerlerini silmez.

Bakım varsayılanı son 100 sayısal yerel revizyonu tutar; adlandırılmış/dondurulmuş teslim revizyonlarını silmez. Head, saklanan revizyon ve bekleyen taslak tarafından referanslanan ek korunur. Komut makbuzu/logu değişmez. Sunucu son 100 revizyonu korur; idempotent komut sonuçlarındaki ekler de korunur. Otomatik zamanlanmış silme yapılmaz; bakım ekranından açıkça başlatılır. Yerel 1000 kayıt, 100 teslim ve 48 MB teslim geçmişi sınırları mevcut kalır; storageVersion bakımda sıfırlanmaz. Sınıra ulaşmadan dış yedek ve ayrı yeni proje oluşturun. Şema göçü başarısızsa mevcut veriye eski sürümle dönün; ham SQLite/ekler üzerinde elle temizlik yapmayın.

Yedek tatbikatı: dış yedeği indir → başka boş profil/native test deposunda import → proje kimliği/revizyon/log/ek SHA-256 karşılaştır → 2D/3D aç → teslimi tekrar görüntüle. `test:extensions` temiz IDB depoya geri açmayı, `test:native` IDB → gerçek SQLite → IDB arşiv eşitliğini ölçer. Gerçek ayrı Windows kurulumu/cihaz tatbikatı ayrıca kaydedilir. Yedek dosyalarının saklama/silme süresi işletmenin kararıdır; uygulama dış dosyayı silemez.

Katalog güncellemesi: üretici kaynağı/tarih, modelVersion, değişen/bilinmeyen alanları kaydedin; eski projelerin pinned catalogContext tanımlarını kendiliğinden değiştirmeyin. Test fixture eski tanımla yeniden açılmalı. Güncel modeli tasarıma açık mühendislik değişikliği/revizyonla taşıyın. SQLite/PostgreSQL sonraki göçleri yeni sıralı sürüm dosyasıyla ve önceki verinin tam yedeğiyle test edin; yayınlanmış migration dosyasını değiştirmeyin. Destekleyen sürümden daha yeni şema fail-closed açılır.

## Sürüm adayı

`npm run release:check -- check|product|unit|legacy|native|workspace|features|performance|build|installer|audit` komutları sonuç/log/fingerprint makbuzu yazar. Kaynak değişince eski makbuz geçerli sayılmaz. `npm run release:manifest` kaynak ve üretim/NSIS hashlerini ve S1/S2/S3 ayrı kapılarını oluşturur. Saha pilotu, gerçek Windows kurulum matrisi, canlı AI/NetBox ve Compose/OIDC smoke yerel testlerle kapatılmaz. Dış kanıtlar açıkken `releaseApproved=false` kalır. Bu çalışma GitHub yayını/push yapmaz.
