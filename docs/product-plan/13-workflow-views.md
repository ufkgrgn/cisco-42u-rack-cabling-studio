# P08 — Çalışma görünümleri ve ortak seçim bilgileri

Araçlar → **Çalışma görünümü**: Tasarım, Saha veya Sunum seçilir. Bu seçim 2D/3D düğmesinden ayrıdır; aynı açık proje, revizyon, katalog ve saha kayıtları kullanılır. Çalışma görünümü proje belgesine yazılmaz. Varsayılan Tasarım'dır; P09 ile proje bazında açıkça kaydedilen başlangıç tercihi kullanılabilir. Ayrıntılar `14-onboarding-and-views.md` içinde.

## Görünümler

- **Tasarım:** mevcut donanım, bağlantı ve düzenleme araçları korunur. Önceki yan panel durumu diğer modlardan dönünce geri gelir.
- **Saha:** kütüphane küçülür; masaüstünde bağlantı listesi ve seçim bilgileri öne çıkar. Mobilde bağlantılar/Seçim ve Araçlar → Seçim bilgileri erişilebilir. Plan ile saha gözleminin ayrı olduğu metinle belirtilir. Henüz uygulanmayan saha olaylarını tamamlanmış gibi göstermez.
- **Sunum:** düzenleme/preset/metraj araçları sadeleştirilir; kamera, 2D/3D, proje bilgileri ve seçim incelemesi kalır. Yaygın silme/taşıma/undo kısayolları engellenir. 3D cihaz/kablo mutatörlerinin kullanıcı yolları da sunumda işlem uygulamaz. Bu arayüz davranışı yetkilendirme veya bütün programatik API'ler için salt okunur güvenlik sınırı değildir; P26 ayrı kapsamdır.

Saha/Sunum durum satırı çalışma modunu ve editörün kayıt sonucunu metinle gösterir. Kayıt hatası veya korunmuş taslak yalnızca renkle anlatılmaz. Mod değişimi kimlik/revizyon/domain içerik değiştirmez; yerleşim geçişi için mevcut resize akışı kullanılır.

## Ortak seçim paneli

2D cihaz seçimi/kablo vurgusu ile 3D cihaz/kablo seçimi türü belirtilmiş ortak seçim olayına bağlanır. Bir kablo vurgusunun temizlenmesi seçili cihazı silmez; bir cihazın seçimi kaldırılırken seçili kablo korunur. Proje değişince eski kimlik gösterilmez.

Panel canonical belgeden cihaz/model/kabin/oda/U, IP, varlık etiketi, seri numarası ve port doluluk/rol/VLAN bilgilerini okur. Gözlem sayısı plan değerlerinden ayrı belirtilir. Kablo için kaynak/hedef ve planlanan/ölçülen uzunluk gösterilir; sıfır değer kaybolmaz. Masaüstü 2D'de sağ listede, 3D'de üst araç çubuğunun altındaki sağ panelde, mobilde erişilebilir seçim penceresinde aynı içerik kullanılır.

**Cihaz bilgilerini düzenle**, renderer bağlamına uygun mevcut metadata formunu doğru cihaz kimliğiyle açar. Mobil seçim dialogu form açılmadan kapanır. Odak ve kablo uçlarına gitme eylemleri, mevcut kamera API'lerini kullanır. Port seçerek bağlantı kurma akışı korunur. Escape native seçim dialogunu kapatır ve odağı açan düğmeye geri verir. Görünüm değişirken gizlenen araçta odak kalmaz.

## Modül sınırları

`workflow-views.js` çalışma modu/araç yoğunluğu; `workflow-selection.js` ortak seçim ve sunum; `js/src/3d-ui/workflow-selection.js` 3D olay/işlem adaptörüdür. 2D editör ve kablo modülündeki küçük olay çıkışları eski etkileşimleri korur. Yeni modüller ayrı yüklenir; 3D adaptörü mevcut bundle akışına dahildir.

## Kanıt

`tests/workflow-views.test.cjs`: mod geçişlerinde domain ve renderer ayrımı, gerçek 2D seçim, 3D seçimden metadata düzenleme, portlar, silme/undo engeli, proje değişimi, mobil 3D seçim penceresi, Escape/odak, port seçici, 320/390/768/1440 piksel taşma kontrolleri. P08 A11/A41 için yerel Headless Edge kanıtıdır.

Son CSS ile görüntüler `results/workflow-{design,field,presentation}-{320,390,768,1440}.png`, `workflow-selection-390.png`, `workflow-selection-3d-{390,1440}.png` içinde. Günlükler `workflow-check.log`, `workflow-targeted.log`, `workflow-full-tests.log`. Fiziksel dokunmatik cihaz, ekran okuyucu ve saha pilotu ayrıca doğrulanmalıdır.

Son kaynakla `npm run check` ve tam `npm test` geçti: 6 aktif Vitest, 35/35 ürün testi, mevcut tarayıcı paketleri ve 29/29 görsel test. Hedefli P08 paketi 3/3 geçti. 100 kabin / 3.000 cihaz / 20.000 kablo sentetik kontrolü mevcut eşiklerle başarılıdır; rapor `results/workflow-performance-100.json`. Bu ölçüm gerçek GPU veya saha performansı kanıtı değildir.
