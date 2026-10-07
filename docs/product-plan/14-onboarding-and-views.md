# P09 — İlk kullanım, navigasyon ve kayıtlı sunum

Araçlar → **İlk kullanım** veya Ctrl+K → **İlk kullanım** kısa rehberi açar. Atla/Kapat proje içeriğini değiştirmez; rehber kendiliğinden açılmaz. Ayrı örnek başlatılırken açık proje mevcut dayanıklı kayıt yolu üzerinden kaydedilir. Eğitim projesi yeni proje/kabin/cihaz kimlikleri, sentetik katalog ve açık örnek etiketi taşır. Müşteri ekleri örneğe kopyalanmaz.

## Örnek akışı

1. İkinci cihazı 12U'ya yerleştir; normal yerleştirme/yerleşim kontrolü kullanılır.
2. İki GE1 portunu bağla; ortak ConnectCable komutu ve bağlantı doğrulaması kullanılır.
3. Saha görünümünü incele; sentetik gözlem ve plan ayrı kalır. Gözlem düzenleme ve gerçek saha kanıtı henüz sunulmaz.
4. Sunum taslağını adlandırılmış revizyona sabitle. Bu işlem teslim onayı değildir; P10–P16 gözlem/saha/çıktı akışları ayrıca geliştirilir.

**Kendi projeme dön** örneği ayrı kayıtta saklayarak özgün projeyi açar. Rehber adımı ve dönüş proje kimliği IndexedDB meta kaydında tutulur; kapatıp tekrar açınca örneğe devam edilebilir. Her örnek işlemi açık proje kimliğini ve örnek işaretini doğrular. Kayıt/import başarısızlığında mevcut proje koruması ve hataları kullanılır.

## Çalışma tercihi ve kamera kayıtları

`workspace-state.js`, IndexedDB'nin mevcut meta deposunda `['workspace-v2', projectId]` anahtarını kullanır. Domain revizyonuna kamera veya çalışma tercihi eklenmez. **Bu projede başlangıç çalışma görünümü yap** Tasarım/Saha/Sunum tercihini açık projeye bağlar. Varsayılan Tasarım'dır. Kamera kendiliğinden değiştirilmez; açı için kayıtlı görünüm açıkça açılır.

Kayıtlı görünümler proje kimliği, kabin kimliği, kaynak belge revizyonu, 2D/3D türü, çalışma modu ve kamera değerlerini taşır. 2D'de tek/çok kabin seçimi ve zoom/pan; 3D'de kamera konumu/hedefi geri yüklenir. Renderer geçişi tamamlanmadan kamera uygulanmaz; geçiş ve bekleme sırasında proje/içerik değişirse işlem reddedilir. Eksik kabin, yabancı proje ve geçersiz kamera kaydı uygulanmaz. Boş listede kayıt oluşturma yönlendirmesi bulunur.

**Sunum revizyonuna sabitle** yeni adlandırılmış taslak revizyon yaratır ve açık kamera/çalışma görünümü tanımını `presentationViews` içinde taşır. Bu tanım tam dış yedekte revizyonla birlikte doğrulanır ve aktarılır; meta kayıt eksikse liste revizyon tanımından görünümü bulur. Proje JSON'u tam dış yedek yerine geçmez. Yerel, sabitlenmemiş kamera kayıtları ve UI tercihleri dış yedeğe dahil değildir. En fazla 20 yerel görünüm tutulur; adlandırılmış revizyonlar P07'nin 100 kayıt sınırına tabidir.

Sunum kaydının bağlı revizyonu açık çalışmadan içerik olarak farklıysa kamera uygulanmaz; kullanıcı ilgili revizyonu P07 ekranından açıkça geri yükler. Kamera açmak topolojiyi sessizce geri almaz. Sunum kaydını yönetmek için Revizyonlar eylemi kullanılır. P26 yetkilendirmesi veya gerçek teslim durumuyla karıştırılmaz.

Eski `rack-studio-saved-views-v1` kayıtlarının proje kimliği yoktur. Orijinal localStorage kaydı korunur; otomatik göç/uygulama yapılmaz ve kullanıcı bilgilendirilir. Görünüm güncel projede yeniden kaydedilebilir.

## Navigasyon ve kanıt

Komut paletinde cihaz sonucu ortak seçim paneline bağlanır; renderer bağlamına uygun odak kullanılır. Arama sonucu üretilirken proje kimliği yakalanır; proje değiştiyse eski sonuç çalıştırılmaz. Kabin/port/kablo arama ve mevcut klavye akışları korunur.

`tests/onboarding-views.test.cjs` ayrı örnek, atlama, gerçek yerleştirme/bağlantı, geri dönüş, 2D/3D açı, yabancı/eksik/bozuk/stale görünüm reddi, revizyon çıktısının dış yedeği ve meta olmadan bulunması, proje tercihi/reload, komut seçimi ve 320/390/768/1440 taşma kontrollerini çalıştırır. Rehber ve kayıtlı görünüm ekran görüntüleri `results/onboarding-*.png` / `results/saved-views-*.png` içindedir. Fiziksel dokunmatik, ekran okuyucu ve saha pilotu ayrıca doğrulanmalıdır. Reload testinde mevcut sekme lease'i açıkça bırakılarak yeniden açılış deterministik tutulur; zorla kapanma/power-loss kanıtı değildir.

Son kaynakla `npm run check` ve tam `npm test` başarılıdır: 6 aktif Vitest, 38 ürün testi, mevcut tarayıcı paketleri, 29 görsel test. Son CSS ile hedefli 3 test tekrar geçti. Günlükler `onboarding-check.log`, `onboarding-full-tests.log`, `onboarding-targeted.log`; 100 kabin / 3.000 cihaz / 20.000 kablo sentetik kontrol raporu `onboarding-performance-100.json` içindedir. Performans eşikleri değiştirilmedi.
