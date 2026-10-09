# Rack Studio çalışma alanı

Onaylanan yerleşim mevcut 2D ve 3D düzenleyicilere uygulandı. Proje, donanım, bağlantı ve kayıt işlemleri mevcut modüllerde çalışır; çalışma alanı denetleyicisi gerçek kontrolleri ortak yerleşime taşır.

## Yerleşim ve kullanım

- **1200 px ve üzeri:** solda donanım kataloğu, ortada kabin, sağda Seçim / Cihazlar / Bağlantılar sekmeleri.
- **768–1199 px:** katalog ve özellikler gerektiğinde açılır; aynı anda tek panel görünür.
- **767 px ve altı:** alttaki Donanım / Görünüm / Seçim düğmeleri panel açar. Etkin kabin gösterilir; geniş ekrana dönünce önceki yan yana görünüm geri gelir. Kısa yatay ekranlarda panel üst sınırdan açılır.
- **Görünüm:** ön/arka yüz, 2D/3D, kablo ve port numarası seçenekleri. Telefonda 2D/3D burada bulunur.
- **Menü:** geri alma, yeniden yapma, komut arama ve mevcut proje, saha, teslim araçları. Telefonda üst çubuktan gizlenen işlemler burada kullanılabilir.
- **Yardım:** başlangıç rehberi, işlev açıklamaları, terimler ve kısayollar.

Yakınlaştırma çubuğunun kendine ayrılmış alanı vardır. Cihaz eylemleri seçim panelinin başında bulunur. Masaüstünde seçilen cihazın yanında aynı gerçek işlemleri çağıran hızlı düğmeler de gösterilir; dar ve dokunmatik ekranlarda seçim paneli kullanılır. Açık menü veya panel sahnenin tıklama ve yakınlaştırma hareketlerini durdurur. Escape paneli kapatır ve odağı açan kontrole döndürür. Seçim göstergeleri kenarlık ve alt çizgi kullanır; hareket azaltma tercihi desteklenir.

Başlangıç rehberi iki çizim görünümünde de kendine ayrılmış alanda açılır. Daraltma, kapatma ve kendi projesine dönme ayrı işlemlerdir. Eğitim ayrı örnek projede ilerler; otomatik örnek ve elle yapılan eylemler aynı gerçek proje işlemlerini kullanır.

## Modül sahipliği

- `js/workspace-shell.js`: ortak yerleşim, panel sahipliği, sekmeler ve ekran boyutuna uyarlama.
- `css/workspace-shell.css`: yeni çalışma alanı bileşenleri; ortak renkler `css/theme-tokens.css` üzerinden alınır.
- `js/ui-actions.js`: gerçek kontrolün kullanılabilirliği ve seçili durumu.
- `js/ui-interactions.js`: menü/panel odak ve sahne etkileşimi düzeni.
- `js/help-catalog.js` / `js/help-controller.js`: çevrimdışı içerik ve gösterim; `RackStudio.Help.open(topicId)` ve `data-help-id` bağlantıları.
- `js/workflow-selection.js`: seçilen gerçek cihazın özellikleri ve eylemleri.
- `js/src/3d/engine.js`: tuvalin kapladığı alan değişince boyutu ve projeksiyonu günceller, hemen yeniden çizer.

Sekme tercihi ayrı `rackstudio-workspace-ui` kaydındadır. Açık mobil panel yeniden yüklemede geri getirilmez. Proje biçimi değişmez.

## Doğrulama kapsamı

2026-10-09 tarihinde `npm run check`, `npm run test:unit`, `npm run test:legacy` ve ilgili 14 Playwright görsel testi başarıyla tamamlandı. Yeni `npm run test:workspace-ui` paketi birim doğrulama akışına eklenmiştir. Görsel karşılaştırmalar son değişikliklerden sonra referans güncellemeden yeniden geçti.

Yeni paket dört temayı ve iki çizim görünümünü 320, 390, 540, 767, 768, 1024, 1199, 1200 ve 1440 px genişliklerde kontrol eder. Araçların çakışması, ekran dışına taşma, dokunma hedefleri, tek panel sahipliği, Escape/odak, hızlı menü değişimi ve hareket azaltma denetlenir. 3D görüntü alınmadan önce yeni boyutta gerçekten çizim yapıldığı beklenir.

Telefon boyutunda gerçek proje iş akışı denemesi cihaz yerleştirme, kaynak/hedef port seçimi, bağlantı oluşturma, geri alma, yeniden yapma, kayıt ve geniş ekran görünümünü geri getirmeyi içerir. Yardım doğrulamaları dört tema ve dört genişlikte çalışır; ayrı örneği kapatma/tamamlama ve özgün projeye dönme kontrol edilir.

Son ekran görüntüleri `docs/product-plan/results/workspace-shell/` altında bulunur. Bu çalışma ilgili 14 görsel testi kapsar; eski görsel paketin tamamı için başarı iddiası içermez. Kontroller masaüstü Edge üzerinde otomatik yapılır; fiziksel telefon ve ekran okuyucu doğrulaması ayrı kalır.


## Donanım ve bağlantı ayrıntıları

Donanım kartlarında U yüksekliği önizlemenin sağ üstünde, model adı önizlemenin üstünde rozet olarak gösterilir. Uzun adlar görseli büyütmeden kısaltılır; tam ad erişilebilir içerikte ve seçim ayrıntısında korunur. Teknik rozetler aşağı açılan ayrıntı alanında gösterilir. Ekle düğmesi önizleme üzerine gelince veya klavye odağında açılır; telefonda ve dokunmatik işaretçide sürekli görünür. Dokunmatik ekleme mevcut kabin/U seçimi penceresini açar. Yardım arama satırına taşınmıştır.

Filtre şeridi yatay kaydırmayı, fare tekerleğini ve klavye odağına ilerlemeyi destekler. Kategori başlıkları klavyeyle açılıp kapanır ve açık durumunu bildirir.

Bağlantı sayacı ayrı satırdadır; U sırası, Panel ve Switch üç eşit sekmede gösterilir. Switch ağacındaki bağlantılar kaynak port, hedef ve rol/metraj/işlem için hizalı satırlar kullanır. Uzun hedef adı kısalırken hedef port hedef cihaz adının yanında ayrı bir alanda görünür. Sağ panelin masaüstü genişliği 300 px olarak korunur.

Yardım penceresi başlık, bölüm gezintisi ve dört aşamalı açıklama kartlarıyla düzenlenmiştir. Yakınlaştırma ve uzaklaştırmada yönü büyüteç simgesi gösterir; fazladan artı/eksi metni bulunmaz.

Ek doğrulama `tests/workspace-refinements.test.cjs` ile dört tema ve 1440/768/390/320 px genişliklerde katalog, üç bağlantı görünümü ve yardım taşmasını denetler. Gerçek cihaz tıklaması, otomatik bağlantı penceresinin açılması, telefon boyutunda Ekle penceresi ve port ayarları da kontrol edilir. Yeni görüntüler `docs/product-plan/results/workspace-refinements/` altında tutulur. Görsel referanslar kasıtlı kart değişikliklerine göre yenilenir; ardından ilgili görsel testler referans güncellemeden tekrar çalıştırılır.


Model rozeti artık önizlemenin üst kısmındadır. Fare ile kartın üzerine gelince ve klavye odağında tam model adı ile teknik bilgiler aşağı açılır. Model rozeti seçilince ayrıntı açık tutulur; dokunmatik ekranda aynı rozete ikinci dokunuş ayrıntıyı kapatır. Gerçek stencil önizlemesi açık bir kullanıcı işlemiyle yüklenir; ayrıntı açılırken özgün SVG indirilmez. Görsel üzerindeki Ekle düğmesi ve sürükleme/yerleştirme işlemleri korunur.

Doluluk kutusunun başlığı görünümdeki kabin sayısını ve toplam U kapasitesini gösterir. Birden fazla kabin görünümünde bütün görünür kabinlerin toplamı, tek kabin görünümünde kabin adı belirtilir. Cihaz/dolu/boş sayıları bu başlığa bağlıdır. Switch bağlantılarında kaynak port, hedef U/model/port ve kablo rolü/metraj/sökme işlemi ayrı ve hizalı satırlarda gösterilir; uzun cihaz adı kısalırken port adı görünür kalır.
