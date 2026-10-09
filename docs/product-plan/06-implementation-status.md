# Uygulama kaydı

Tarih: 2026-10-06. Başlangıç Git HEAD: `051e1de`. Çalışma ağacında önceden bulunan dist, performans ve scratch değişiklikleri korunmuştur.

Planın tamamı bitmiş değildir. Aşağıdaki durumlar doğrulanan uygulama kapsamını gösterir.

| Paket | Durum | Kanıt / kalan iş |
|---|---|---|
| P00 | Başlangıç sorunları düzeltildi; saha kanıtı ayrı | Derleme, birim ve tarayıcı kontrolleri geçti. Başlangıçtaki görsel/performans sorunlarının düzeltme kanıtları aşağıda. |
| P01 | Devam ediyor | Aktif script üzerinde model testleri ve gerçek Edge/IndexedDB kurtarma testi günlük test komutuna eklendi. Köprü testi dist yerine aktif index.html kullanıyor. Diğer kabul fixture'ları henüz yok. |
| P02 | Veri sözleşmesi ve serializer dilimi uygulandı | Kayıt türleri/ilişkileri/sınırları, eski gözlem göçü, tek kabin migration, import boyut/sürüm kontrolü ve ortak kayıt yolları uygulandı. Türler ve tam fixture eklendi. A01/A02 UI ve P04 arşiv/depo kabul maddeleri henüz açık; ayrıntı 07-project-document-v1.md içinde. |
| P03 | İlk komut dilimi uygulandı | MoveDevice/ConnectCable aktif UI kapısında; revizyon/içerik kontrolü, idempotency, tek undo, makbuz korunması ve checkJs geçti. Eski yazıcıların geçiş listesi 08-project-commands.md içinde. |
| P04 | Yerel depo/kurtarma/yedek dilimi uygulandı | Proje bazlı atomik başlık+revizyon+log+ek, writer lease/CAS, kaynak seçimi, arşiv açma ve tam dış yedek geçti. Fiziksel güç kaybı/disk kotası kanıtı açık; sözleşme 09-project-repository.md içinde. |
| P05 | Kayıpsız adaptör dilimi uygulandı; komut geçişi bekliyor | 3D bridge/autosave ortak adaptörü kullanıyor. Tam fixture ile on geçiş, 3D değişikliği/yenileme, port reddi, boş native recovery ve kamera/domain ayrımı doğrulandı. Ortak repository kayıt yolu aktif; bütün 3D yazıcıların komut entegrasyonu P05 kapsamında açık. |
| P06–P12 | Uygulama dilimleri doğrulandı | Proje yönetimi, revizyon, ortak çalışma görünümleri, ilk kullanım, gözlem/saha kanıtı, QR ve offline; aşağıdaki güncel kayıtlar. Fiziksel pilot kapıları açık. |
| P13–P16 | Yazılım dilimi uygulandı | Teslim merkezi, dondurulmuş rapor/PDF, BOM, iki uçlu QR etiket, seçilmiş kanıtlarla manifestli ZIP ve teslim/kabul geçmişi; 18-delivery-reports-bom-labels.md. A23 gerçek baskı/telefon açık. |
| P17–P31 | Bekliyor | Ayrıntılı görevler 03-work-packages.md içinde. |

## Başlangıç sorunları

- Dört tema ekran görüntüsü referans ile uyuşmuyor. Referanslar otomatik güncellenmedi; görsel inceleme gerekiyor.
- Görsel kabin boyutlandırma sürükleme testi 38U beklerken 42U gördü.
- Komut arama testi `Komut ara` alanını bulamadı.
- 100 kabin sentetik testinde kablo stil güncellemesi performans eşiğini aştı. Bu bir gerçek cihaz FPS ölçümü değildir.

Ham çıktılar `results/baseline-tests.log`, `results/baseline-performance-1.json`, `results/baseline-performance-10.json` ve `results/baseline-performance-100.log` içinde. 100 kabin testi başarısız olduğundan başarılı sonuç JSON'u oluşmadı.

## Sonraki uygulama sırası

1. P05 3D düzenlemeyi ortak komut kapısına taşı.
2. P03 geçiş listesindeki eski yazıcıları ortak kapıya sırayla taşı.
3. P06 tam proje ana ekranına ve P07 adlandırılmış revizyon akışına geç.

Henüz saha, yazıcı, NetBox hesabı, sunucu veya üç kullanıcılı pilot doğrulaması yapılmadı. Bu kabul maddeleri tamamlandı olarak işaretlenemez.

## İkinci uygulama adımı — P00 düzeltmeleri

- Kabin ekrana sığdırılırken alt sürükleme tutamacı kamera düğmelerinin altında kalıyordu. Kamera araç çubuğunun yüksekliğine göre dikey boşluk ayrıldı. Görsel test gerçek pointer hedefini de doğruluyor; sürükleme önizlemesi ve tek geri alma geçiyor.
- Komut paletinin erişilebilir rolü `combobox`; testin eski `textbox` seçicisi düzeltildi. Donanım ve kablo araması doğrulandı.
- Dört 2D tema referansı önceki ikon ve satır düzeni değişikliklerinden geri kalmıştı. Eski/yeni görünüm incelendi ve referanslar güncellendi. 3D referansları değişmedi.
- Geometri dışa aktarım testi şema v1 içindeki `topology.portGeometryOverrides` yoluna uyarlandı ve ihraç edilen belgeyi tekrar yükleyerek kontrol ediyor.
- Pixi kablo çizimi sırasını koruyan 32 kabloluk gruplara ayrıldı. Renk değişimi ve silme, yalnızca etkilenen grupları yeniden hazırlıyor. Performans eşikleri yükseltilmedi.
- Son 100 kabin / 3.000 cihaz / 20.000 kablo kontrolünde stil güncellemesi **5,5 ms**, silme **15,9 ms**; renk değişiminde yeniden çizilen kablo sayısı **20**. Önceki stil ölçümü **33 ms** idi. Bunlar sentetik Headless Edge sonuçlarıdır.
- Tek kabin ve 10 kabinin birlikte gösterildiği performans kontrolleri geçti. İlk çoklu görünüm denemesinde silme 58,5 ms ile başarısızdı; aynı grup yaklaşımı silme yoluna da uygulanıp yeniden kontrol edildi.
- `node tests/pixi-cabling-interaction.test.cjs` ve `npm run check` geçti. Günlük birim/kurtarma/tarayıcı kontrolleri `results/followup-tests.log` içinde; bu ilk birleşik koşuda geometri testinin eski şema seçicisi yakalandı ve düzeltildi. Son tam görsel koşu **29/29 geçti**; `results/followup-visual-final.log` içinde.

Kanıtlar: `results/fixed-performance-100.json`, `results/fixed-performance-1.json`, `results/fixed-performance-10-multi.json`, `results/profile-performance-100.log`, `results/followup-visual-final.log`. Proje şeması, komut kuyruğu, çoklu proje deposu ve kalan ürün paketlerinin durumları değişmedi.

## Üçüncü uygulama adımı — P02 ve kayıt sınırları

- `project-records.js`, `project-adapters.js` ve `types/product.d.ts` eklendi; `project-document.js` sınırları ve migration tamamlandı. Format 07-project-document-v1.md içinde.
- 3D autosave/köprüdeki bağımsız alan eşleme listeleri kaldırıldı. Tam belge yeni snapshotlarda da kullanılıyor. Mevcut IDB kaydı yeniden okunarak doğrulanıyor.
- Belirsiz port için sessiz yeniden atama kaldırıldı; dönüşüm başarısızsa mevcut görünüm/proje korunuyor.
- On geçiş testi, 3D render yolunun sıfır kablo uzunluğunu tahminle değiştirdiğini yakaladı. Renderer artık mevcut değeri ve interrack uzunluklarını değiştirmiyor. Siyah kablo rengi de sayısal sıfır olarak korunuyor.
- Saf model ve browser veri paketi: **12/12 geçti**. Son tam günlük test koşusu `results/data-contract-tests-final.log` içinde; birim/tarayıcı kontrolleri ve **29/29 görsel test geçti**. `npm run check` ve tür sözleşmesinin bağımsız `tsc --noEmit` kontrolü geçti.
- 100 kabin / 20.000 kablo sentetik performans kontrolü ortak veri değişikliklerinden sonra geçti: `results/data-contract-performance-100.json`. Fiziksel GPU/saha sonucu olarak sunulmaz.
- P03/P04 komut, monoton revizyon, çoklu proje, sekme kiraları, blob deposu ve transaction atomikliği henüz uygulanmadı. P11 tamamlanmış saha olayı zorunlulukları da bu validatorın dışında kalıyor.


## Dördüncü uygulama adımı — P03 komut kapısı

- Aktif 2D cihaz taşıma ve etkileşimli bağlantı, `ProjectCommands` üzerinden doğrulanır. Smart ripple içindeki hareketler tek undo adımıdır. Kablo ile otomatik/miras port ayarları aynı taslakta hazırlanır; reddedilen bağlantı cihaz ayarını değiştirmez.
- Eski revizyon, kayda geçmemiş eski UI değişikliği, farklı proje, U/port çakışması ve aynı kimlik/farklı içerik reddedilir. Aynı komut yenilemeden ve undo'dan sonra ikinci kez uygulanmaz.
- Undo/redo içerik geri yüklerken revizyonu artırır ve makbuzları korur. 3D adaptörü canlı revizyon/makbuzları geriye taşımaz. Kamera/görünüm ve türetilen alanlar domain revizyonunu artırmaz.
- Yeni command union ve aktif JavaScript `checkJs` denetimi ana `npm run check` içine alındı. Eski işlemler için uyumluluk/geçiş tablosu ve `localDraft`/kalıcı kayıt ayrımı 08-project-commands.md içinde.
- İlk tam koşu Pixi'nin ikinci kablosunda hata yakaladı: ortak load yolu kamerayı tekrar kadrajlıyordu. Komut uygulaması görünümü koruyarak yenileniyor; aynı gerçek pointer testi tekrar geçti.
- Son `npm run check` ve `npm test` geçti: 6 aktif Vitest, 13 ürün/veri/komut testi, mevcut tarayıcı paketleri, 29/29 görsel test. Kanıt: `results/commands-check-final.log`, `results/commands-full-tests-final.log`.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik performans kontrolü geçti (`results/commands-performance-100.json`). Eşikler değiştirilmedi. Bu kontrol ortak kapıda 20.000 ayrı komut throughput ölçümü veya saha/pilot kanıtı değildir.

P04 transaction/depo ve P05 bütün 3D yazıcılarının komut geçişi açık kalıyor. Bütün eski yazma yolları tamamlandı olarak işaretlenmedi.


## Beşinci uygulama adımı — P04 yerel depo

- `project-storage-idb.js`, `project-repository.js`, `project-archive.js`, `project-recovery-ui.js` eklendi. IndexedDB v2 upgrade eski current kaydını korur; proje bazlı başlık/revizyon/log/ek aynı transaction'da yazılır. Editör artık ortak depoyu kullanır.
- Tekrarlanan komutun dayanıklı sonucu Promise ile izlenir. Writer lease ve storageVersion çatışmasında açık taslak korunur; başka sekmenin kaydı değişmez. Tekrar kayıtta aynı belge yeni storageVersion oluşturmaz.
- Çakışan legacy kaynaklar seçim ekranında gösterilir; migration deterministik ve raw kaynaklar doğrulanmış kurtarma kaydında saklanır. Açılırken yapılan düzenleme kurtarma ile silinmez. Proje değişiminde önceki history temizlenir.
- Araçlar menüsüne proje kayıtları/yedek erişimi eklendi. Arşiv yeniden açılabilir; tam JSON yedeği iki projeyi log, revizyon ve ekleriyle yeni bir depoya geri yükler. Var olan kimlik üzerine yazma ve değişmiş SHA-256 reddedilir.
- Son `npm run check` ve tam `npm test` geçti: 6 aktif Vitest, **21/21 ürün/veri/depo testi**, mevcut tarayıcı paketleri ve **29/29 görsel test**. Son erişilebilir dialog adı ve dayanıklı komut tekrarı kontrolleri `results/repository-ui-final.log` içinde ayrıca geçti.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik performans kontrolü geçti. Eşikler değiştirilmedi; rapor `results/repository-performance-100.json` içinde.
- Kota/transaction abort testleri üretim modüllerinde hata enjeksiyonudur. Gerçek iki sekme, seçim ekranı ve açılırken düzenleme Edge üzerinde doğrulandı. Fiziksel güç kesintisi/disk dolması ve saha kanıtı tamamlandı olarak işaretlenmedi.

Sınırlar, store anahtarları ve draft/durable ayrımı 09-project-repository.md içinde. P05 bütün 3D yazıcıların komut geçişi ve P06 tam proje ana ekranı sıradadır.

## Altıncı uygulama adımı — P05 ortak 3D düzenleme, ilk dilim

- Modüler `project-command-bridge.js` sahne projeksiyonunu düzenlemeden ayırır. Taşıma, ekleme/silme, port ve cihaz ayarı, kablo düzenlemesi ve preset çağrıları ortak `ApplyTopology` kapısına bağlandı. İç içe işlemler tek revizyon/undo adımıdır; başarı mesajları doğrulama sonrasına bırakılır.
- Ortak belge başlığı ve saha kayıtları korunur. Eski içerik/revizyon veya geçersiz port reddinde sahne güncel belgeden yeniden kurulur. Compatibility cache kotası, kabul edilmiş domain komutunu geri almaz; ayrı `lastCacheError` alanında tutulur.
- 3D undo/redo ortak geçmişi kullanır. Kamera/projeksiyon no-op işlemleri revizyon oluşturmaz. İki görünümün Ctrl+Z dinleyicilerinin aynı anda çalışması engellendi.
- Edge testi: gerçek 3D taşıma, tek makbuz, ortak undo/redo, stale sahne reddi, kablo/port ayarlarının tek undo adımı, siyah renk ve saha kayıtlarının korunması. On görünüm geçişi ve reload testleri de korundu. Çıktılar `results/shared-3d-check.log`, `results/shared-3d-targeted.log`, `results/shared-3d-full-tests.log` içinde.
- P05 tamamen kapatılmadı: native JSON import/export ve doğrudan UI yazıcılarının son geçişi, metadata alanlarının tam düzenleme kapsamı ve bu yolların özel regresyonları sıradaki dilimdir. Saha/GPU doğrulaması yapılmış sayılmaz.
- Tam görsel koşu yükseklik sürgüsünde mevcut bağlantılara eklenen varsayılan `face` alanının yeni bağlantı sanılmasını ve projeksiyonda port kalibrasyonu uyumluluk kaydının yenilenmemesini yakaladı. Varsayılan yüz eşdeğerliği ve komutsuz cache projeksiyonu düzeltildi; iki regresyon yeniden geçti.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik performans kontrolü geçti: `results/shared-3d-performance-100.json`; doğrulama 20,5 ms, import 655,6 ms. Eşikler değiştirilmedi. Bu test 3D komut throughput veya fiziksel GPU/saha kanıtı değildir.
- Son `npm run check` ve `npm test` geçti: 6 aktif Vitest, 22/22 ürün/veri/depo testi, mevcut tarayıcı paketleri ve 29/29 görsel test. Son 3D kaynak değişikliklerinden sonra bundle yenilendi; ayrı 4/4 Edge hedefli test de geçti.

## Yedinci uygulama adımı — P05 dosya ve UI geçişinin tamamlanması

- 3D JSON tam v1 belgeyi taşır. İçe aktarım doğrulanmış, ayrı ve dayanıklı proje kaydı açar; aynı kimlik ayrı UUID kopyasıdır, açık projenin kaydı/history'si korunur. Yavaş dosya okuması sırasında yapılan düzenleme eski sonuçla silinmez. Eski `3.1.0-3D` dosyaları ve eski 2U panel yerel modeli kayıpsız migrate edilir.
- Port formunun aynı anda iki görünümü yazması, metadata formunun ikinci save listener'ı ve form açarken legacy port alanlarının silinmesi giderildi. Seri numarası/panel etiketi artık uygulanır; boş hostname ve asset tag korunur. Kararlı/sayısal olmayan port kimliğiyle düzenle/reset/reload doğrulandı.
- Toplu sökme ve IDF tek komuttur. Özel cihaz sihirbazının mevcut handler'ı modeli ortak proje kataloğuna kaydeder. MDF planı ayrı modüle taşındı; gerçek katalog kimlikleri/U/port tanımlarıyla 11 cihaz ve 8 kablo tek işlemde kurulur. İşlem başarısızsa sahne geri yüklenir. Katalog alias hatası targeted preset testinde yakalanıp giderildi.
- Ayrı workflow paketi 3/3 Edge testi geçti; önceki on 2D/3D geçişi ve kamera kabul testleri korunuyor. Ayrıntılar ve doğrulama sınırları `10-shared-3d-workflows.md` içinde. P05 A08/A41 uygulama kabulü bu iki dilimle karşılanıyor; saha/pilot doğrulaması tamamlandı sayılmaz. Sıradaki paket P06 proje ekranı ve saha hiyerarşisi.
- Son kaynak/bundle ile `npm run check` ve tam `npm test` geçti: 6 aktif Vitest, **25/25 ürün/veri/depo/workflow testi**, mevcut tarayıcı paketleri, **29/29 görsel test**. Günlükler `results/shared-3d-completion-check.log`, `results/shared-3d-completion-full-tests.log` içinde. 100 kabin / 3.000 cihaz / 20.000 kablo sentetik kontrolü de geçti (`results/shared-3d-completion-performance-100.json`); eşikler değiştirilmedi, fiziksel GPU/saha kanıtı değildir.

## Sekizinci uygulama adımı — P06 proje yönetimi ve saha hiyerarşisi

- Modüler proje yönetimi ekranı oluşturma, açma, çoğaltma, müşteri/ad/durum araması, arşiv ve tam yedek erişimi sunar. Müşteri/sorumlu/durum/hedef tarih bilgileri ve saha/bina/kat/oda ağacı düzenlenir; kabinler odalara bağlanır, ağaçtan kabine gidilir.
- `UpdateProjectDetails` bütün belgeyi mutasyondan önce doğrular. Döngülü/eksik ebeveyn, atanmış oda silme, yanlış kabin konumu ve geçersiz tarih mevcut belgeyi değiştirmeden reddedilir. Kaydedilmemiş form proje geçişinde korunur; açıkça kaydetme veya formu bırakma gerekir. Asenkron açılırken düzenleme eski sonuçla silinmez.
- Çoğaltma kaynak belge ve ekleri aynı transaction snapshot'ından okur. Entity/blob UUID'leri ve bilinen iç referanslar yenilenir; belge ve ekler birlikte commit edilir. Kaynak proje değişmez. Özgün raw/observed kanıt ve bilinmeyen uzantı referanslarının yorumlanma sınırları `11-project-management.md` içinde belirtilir.
- Hedefli 3/3 Edge testi geçti: oluşturma/arama/arşiv, dört seviyeli ilişki/reload, form koruması, UUID/yerel blob kopyası, kaynak izolasyonu, doğrulama reddi ve açılırken düzenleme. 320/390 piksel taşma/Escape kontrolleri ve son ekran görüntüleri kaydedildi; fiziksel mobil cihaz/ekran okuyucu/saha doğrulaması tamamlandı sayılmaz.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik performans kontrolü geçti; rapor `results/project-manager-performance-100.json`. Eşikler değiştirilmedi. P06 uygulama kapsamı ve kanıt sınırları `11-project-management.md` içinde; sonraki paket P07 adlandırılmış revizyonlar ve nesne/alan bazlı fark ekranıdır.
- Son form koruması değişikliğinden sonra `npm run check` ve tam `npm test` yeniden geçti: 6 aktif Vitest, **28/28 ürün/veri/depo/workflow testi**, mevcut tarayıcı paketleri ve **29/29 görsel test**. Kanıtlar `results/project-manager-check.log` ve `results/project-manager-full-tests.log` içindedir.

## Dokuzuncu uygulama adımı — P07 revizyon ve alan bazlı fark

- `project-revisions.js`, `project-diff.js`, `revision-controller.js` ve tema uyumlu CSS eklendi. Anlık görüntü düğmesi yeni revizyon ekranını açar; ad/açıklama/taslak-onay-teslim etiketi ve tek karşılaştırma temeli kaydedilir. Otomatik depo revizyonları ayrı kalır; liste yalnızca ilgili projenin adlandırılmış anahtar aralığını okur.
- Cihaz/konum/port/kablo/proje/saha/katalog/uzantı farkı kimlik ve alan bazında gösterilir. Kamera, makbuz ve varsayılan alan eşdeğerliği yanlış içerik farkı oluşturmaz. İki revizyon veya açık çalışma karşılaştırılır; canlı nesneden kabin/cihaza gidilir, silinen nesnenin alanları fark kaydında incelenir.
- Tam belgeye geri dönüş `RestoreProjectDocument` ortak komutuyla tek undo/redo adımıdır. Güncel komut makbuzları ve monoton revizyon korunur; özel katalog ve saha/teslim/ek referansları seçili kayıttan geri gelir. 3D sahne aynı belgeden yenilenir. Eski zarf yeni düzenlemeyi silemez.
- Legacy snapshot seçilerek ayrı kaynak bilgisiyle aktarılır; orijinal localStorage kaydı korunur. Yabancı proje ve eksik ek reddedilir. Tam dış yedek adlandırılmış kayıtları/temeli ve referans verilen ekleri içerir; import SHA-256 ve kayıt sınırlarını doğrular.
- Hedefli revizyon/roundtrip paketi **8/8 geçti**. Transaction abort sırasında eski temel korunur; etiket/reload/yedek, dört tema, 320/390 piksel taşma/Escape, cihaz odağı ve 3D geri yükleme kontrol edildi. A09/A10 yerel uygulama kanıtı ve sınırlar `12-project-revisions.md` içinde; fiziksel cihaz/ekran okuyucu/güç kesintisi/saha pilotu tamamlandı sayılmaz. Sonraki paket P08 tasarım/saha/sunum görünümleri ve sağ paneldir.
- Son kaynakla `npm run check` ve tam `npm test` geçti: 6 aktif Vitest, **32/32 ürün/veri/depo/workflow/revizyon testi**, mevcut tarayıcı paketleri ve **29/29 görsel test**. İlk derleme denemesinde Windows'un geçici bundle dosyası kilidi yeniden deneyince kalktı; kontrol başarılı tamamlandı. Günlükler `results/revisions-check.log`, `results/revisions-targeted.log` ve `results/revisions-full-tests.log` içindedir.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik kontrolü geçti; eşikler değiştirilmedi. Rapor `results/revisions-performance-100.json` içindedir. Bu 2D smoke ölçümü adlandırılmış revizyon listesinin büyük veri benchmark'ı veya gerçek GPU/saha kanıtı değildir.

## Onuncu uygulama adımı — P08 çalışma görünümleri ve ortak seçim

- Tasarım/Saha/Sunum seçicisi 2D/3D renderer düğmelerinden ayrıdır. Geçiş domain içeriğini/revizyonu değiştirmez; Saha bağlantı/seçim alanını öne çıkarır, Sunum düzenleme araçlarını sadeleştirir. Tasarıma dönüş önceki panel durumunu geri getirir. Kayıt ve görünüm durumu metinle gösterilir.
- Modüler ortak seçim paneli canonical cihaz, kabin/oda/U, IP/varlık/seri ve port durumlarını iki rendererde gösterir. Mevcut metadata formuna doğru kaynak/cihaz kimliğiyle gider; mobil seçim penceresi form açılmadan kapanır. Kablo uçları, planlanan/ölçülen metraj ve gözlem sayısı ayrı gösterilir. Sıfır değer kaybolmaz; mobil port seçici korunur.
- Sunumda silme/taşıma/undo kısayolları ve yaygın 3D mutatör yolları engellenir. Bu kullanıcı arayüzü davranışı P26 yetkilendirmesi veya bütün programatik API'ler için güvenlik sınırı değildir. Modlar yeniden açılışta Tasarım ile başlar; kayıtlı tercihler P09'dadır.
- Ek mobil kontrol eski kablo HUD'ının araçlara tıklarken cihaz seçimini kablo temizleme olayıyla silmesini yakaladı. Türü belirtilmiş seçim temizliği ve seçim/araç menüsünün dış tıklama istisnası düzeltildi. 3D paneli üst çubuğun altında konumlandırıldı. Son CSS ile 320/390/768/1440 görselleri ve 390/1440 3D seçim görselleri üretildi.
- Kapsam, A11/A41 yerel kabul kanıtı ve doğrulama sınırları `13-workflow-views.md` içindedir. Fiziksel dokunmatik cihaz/ekran okuyucu/saha pilotu tamamlandı sayılmaz. Sıradaki paket P09 ilk kullanım, navigasyon ve kayıtlı sunumdur.
- Son kaynakla `npm run check` ve tam `npm test` geçti: 6 aktif Vitest, **35/35 ürün testi**, mevcut tarayıcı paketleri ve **29/29 görsel test**. Hedefli P08 paketi **3/3** başarılıdır. Günlükler `results/workflow-check.log`, `results/workflow-targeted.log` ve `results/workflow-full-tests.log` içindedir.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik performans kontrolü geçti; eşikler değiştirilmedi. Rapor `results/workflow-performance-100.json`. Gerçek GPU ve saha performansı ayrıca doğrulanmalıdır.

## On birinci uygulama adımı — P09 ilk kullanım, navigasyon ve sunum kayıtları

- `onboarding-controller.js` ve ayrı `onboarding-example.js` fixture'ı eklendi. Araçlar/komut paletinden açılan rehber atlanabilir; açık proje kaydedildikten sonra yeni kimlikli örnek açılır. Normal cihaz yerleştirme ve ortak ConnectCable komutu çalışır; sentetik gözlem ayrımı ve revizyona bağlı sunum taslağı gösterilir. Kendi projeme dön örneği ayrı saklayarak özgün belgeyi açar. Saha kaydı düzenleme ve gerçek teslim sonraki paketler olarak açıkça belirtilir.
- `workspace-state.js` proje kimliğiyle IndexedDB meta kaydı kullanır. Başlangıç çalışma modu açık kullanıcı eylemiyle hatırlanır; kamera otomatik değişmez. 2D/3D bookmark'lar proje/kabin/kamera doğrulaması yapar; renderer aktarımı ve proje/içerik kontrolünden sonra uygulanır. Kamera geri yüklemesinden sonra otomatik fit'in açıyı değiştirme sırası düzeltildi.
- Sunum kaydı yeni adlandırılmış revizyonun `presentationViews` çıktı tanımıdır; tam dış yedekte korunur ve doğrulanır. Meta eksikse revizyon kaydından bulunur. Farklı açık içerikte revizyon ekranına yönlendirir; sessiz topoloji geri dönüşü yoktur. Eski kimliksiz localStorage kayıtları korunur ve otomatik uygulanmaz. Yerel bookmark/UI tercihleri tam dış yedeğe dahil değildir.
- Komut paleti cihaz sonucu ortak seçim paneline bağlandı; eski projede üretilen sonuç başka projede çalıştırılmaz. Boş görünüm listesi ve rehber girişinde yönlendirme bulunur. Son CSS ile 320/390/768/1440 rehber/görünüm görüntüleri üretildi ve mobil görüntüler incelendi.
- `npm run check` ve tam `npm test` geçti: 6 aktif Vitest, **38/38 ürün testi**, mevcut tarayıcı paketleri ve **29/29 görsel test**. Son CSS ile hedefli **3/3** test yeniden geçti. Günlükler `results/onboarding-check.log`, `results/onboarding-full-tests.log`, `results/onboarding-targeted.log` içindedir.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik performans kontrolü mevcut eşiklerle geçti; rapor `results/onboarding-performance-100.json`. Fiziksel dokunmatik/ekran okuyucu/GPU/saha pilotu kanıtı değildir. A12/A11 yerel kapsamı ve kayıt sınırları `14-onboarding-and-views.md` içinde; sıradaki paket P10 gözlem geçmişi ve plan/gözlem farkıdır.

## On ikinci uygulama adımı — P10 gözlem geçmişi ve plan farkları

- `field-observations.js` domain işlemleri ve ayrı `field-observation-controller.js`/CSS eklendi. Cihaz/port/bağlantı gözlemleri kaynak, ham/normalize veri, toplanma/alınma zamanı ve içerik hash'iyle geçmişte tutulur. Eski observed cihaz/port alanı açık göçle veya ilk yeni import komutuyla korunur; eski kayıtlar silinmez. Compatibility observed özeti kaynak kanıtının yerine geçmez.
- Envanter CSV/JSON akışı ortak ImportObservations komutuna taşındı. Aynı kaynak tekrar import edilince yeni kayıt/revizyon üretilmez. Bulunamayan/çoklu cihaz veya geçersiz port eşlemesi incelemeye saklanır; kullanıcı eşlemesi parentObservationId ile yeni düzeltme kaydıdır. Proje kopyasında aday ve önceki gözlem referansları remap edilir; ham kaynak korunur.
- Fark paneli yalnızca seçilen alanları ApplyObservationDifferences ile plana aktarır. Eski tarihli kayıt açıkça belirtilir ve her uygulamada onay gerektirir. Operasyonel port durumu plan alanı olarak uygulanmaz. Bilinmeyen/fiziksel yeniden yerleşim isteyen model, geçersiz kablo ucu, farklı proje ve güncelliğini yitirmiş önizleme reddedilir. 2D/3D aynı geçmişi kullanır; Sunum modunda mutasyon yolları engellenir.
- Geçmiş araç/komut paleti, metadata formu ve ortak seçim panelinden açılır. Kaynak filtresi, 50 kayıtlık sayfalama, boş durum ve ham veri ayrıntısı eklendi; ana ekranda kullanıcıya anlaşılır alan adları gösterilir. Proje denetimi güncel alan farklarını/incelemeyi gösterir ve geçmiş kaydına gider.
- Tam testte mobil bağlantı panelinin kapatılmasından sonra kablo seçiminin kalabildiği yakalandı. Kapat düğmesi seçimi açıkça temizler; dış tıklama zamanlamasına bağımlılık kaldırıldı. İlgili mobil regresyon tek başına geçti. Son 320/390/768/1440 ve dört tema görselleri kaydedildi. A13/A14 kapsamı ve sınırlar `15-field-observations.md` içinde; sıradaki paket P11 saha iş akışı ve kanıt ekleridir.
- Son kaynakla `npm run check` ve tam `npm test` geçti: 6 aktif Vitest, **43/43 ürün testi**, mevcut tarayıcı paketleri ve **29/29 görsel test**. Bilinmeyen model reddi eklenerek hedefli **5/5** paket son kaynakla tekrar geçti. Günlükler `results/observations-check.log`, `results/observations-full-tests.log`, `results/observations-targeted.log` ve `results/observations-mobile-regression.log` içindedir.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik kontrolü mevcut eşiklerle geçti; rapor `results/observations-performance-100.json`. Bu 2D smoke ölçümü büyük gözlem koleksiyonu benchmark'ı, gerçek GPU veya saha performansı kanıtı değildir. Fiziksel dokunmatik, ekran okuyucu ve gerçek saha envanteri pilotu açık kalır.

## On üçüncü adım — P11 saha iş akışı ve kanıt ekleri

- Ayrı `field-events.js`, `field-evidence.js`, `field-controller.js` ve CSS eklendi. Kabin/cihaz/hat listesi, arama/sayfalama, teknisyen/tarih/not, uygulama/etiket/test sonucu ve yerel ek indirme çalışır. Araç paleti, ortak 2D/3D seçim paneli ve Saha görünümündeki bağlantı kartı aynı ekrana açılır; tasarım kartlarının yoğunluğu korunur.
- Başarılı uygulama ve etiketleme olmadan test kaydı, kanıtsız başarılı test ve gerekçesiz sonuç değişimi reddedilir. Başarısız/kısmi/değerlendirilemedi/test edilmedi ayrı sonuçlardır. Uç/model/konum/port ayarı kapsamı değişince yeniden test gerekir. Özgün olay/ekler düzeltmede, undo/redo ve revizyon dönüşünde korunur; kopya referansları remap edilir.
- Olay/ref/Blob/makbuz/proje başı tek transaction'la dayanıklı kayda alınır; aktif çalışma bundan sonra güncellenir. Ek türü/boyutu/imzası/hash, kota kesintisi ve değişmiş/farklı proje kontrol edilir. Aynı komut tekrarında ikinci olay yoktur. Yenilemede yerel kanıt yeniden doğrulanmadan tamamlanma açılmaz; eksik veya bozuk Blob başarı sayılmaz. Dış yedek saha geçmişi ve ekleri birlikte geri yükler.
- Headless Edge saha testleri **5/5** geçti. Gerçek formdaki uygulama/etiket/test ve dosya seçimi yürütüldü; 320/390/768/1440 ve dört tema görselleri kaydedildi. Son mobil görsel doğrudan incelendi. A15/A16 yerel kanıtı ve A18 File URL offline kayıt/yenileme sınırı `16-field-workflow-and-evidence.md` içinde; PWA/cache/güncelleme, QR ve gerçek telefon pilotu P12 ile ayrıca ele alınır.
- Son kaynakla `npm run check` ve tam `npm test` geçti: **6 aktif Vitest**, **48/48 ürün testi**, mevcut tarayıcı paketleri ve **29/29 görsel test**. İlk görsel kontrolde saha kartı düğmesinin tasarım kartlarını büyüttüğü görüldü; düğme Saha görünümüne bağlandı. Baseline/tolerans değiştirilmeden dört tema dahil bütün görsel paket ve ardından tam paket tekrar geçti. Günlükler `results/field-events-check.log`, `results/field-events-full-tests.log`, `results/field-events-targeted.log`, `results/field-events-visual.log` içindedir.
- 100 kabin / 3.000 cihaz / 20.000 kablo sentetik smoke kontrolü mevcut eşiklerle geçti; `results/field-events-performance-100.json`, hata listesi boş. Bu ölçüm büyük saha olay/ek koleksiyonu veya fiziksel GPU benchmark'ı değildir. Sıradaki paket **P12 QR kimliği ve çevrimdışı saha erişimi**.

## On dördüncü adım — P12 QR kimliği ve çevrimdışı saha erişimi

- `field-qr.js`, ayrı QR controller ve `field-offline.js` eklendi. Sürümlü proje/kabin/cihaz/hat kimliği açık yerel projede çözülür. Yanlış proje/sürüm/kaldırılmış nesne ve URL reddedilir; uzak veri otomatik alınmaz. Yerel QR üretme/PNG, elle giriş, fotoğraf ve kamera akışları araç paleti/ortak seçim paneline bağlandı. Kamera reddi ve geç gelen stream temizliği korunur; decoder/encoder sabit sürümler ve lisanslarıyla yerelde paketlenir.
- İstek üzerine HTTPS/localhost worker kurulumu, içerik hash'li asset listesi, dosya varlığı doğrulaması ve açık güncelleme akışı eklendi. Kurulum kesintisinde yeni yarım cache silinir, çalışan eski sürüm korunur. Ağsız yenilemede uygulama/QR/yerel saha kaydı çalışır. File URL desteği ayrı ve dürüst durumla gösterilir. Cache, proje/ek yedeği veya uzak kabul/senkronizasyon değildir.
- Güncelleme önce kaydı bekler; açık form/işlem, diğer sekme veya değişen içerikte yeniden yüklemeyi engeller. Kabul edilen güncellemede controller geçişi ve lease bırakma sonrası yeniden açılır; proje korunur. Manifest/192–512 ikonlar/worker üretim paketine eklenir. `dist/` içindeki **407 asset** kaynakla byte eşit, eksik dosya yoktur.
- `npm run check`, `npm run build`, tam `npm test` geçti: **6 aktif Vitest, 53/53 ürün testi, mevcut tarayıcı paketleri, 29/29 görsel test**. Hedefli **5/5** senaryo son kaynakta genişletilmiş sentetik kamera ve başarısız yeni cache kontrolüyle geçti. Son 320/390/768/1440 ve dört tema QR görselleri kaydedildi; 390px görsel incelendi. Baseline/tolerans değiştirilmedi. Günlükler `results/qr-offline-{check,build,full-tests,targeted,performance}.log` içindedir.
- 100 kabin / 3.000 cihaz / 20.000 kablo smoke kontrolü mevcut eşiklerle geçti; `results/qr-offline-performance-100.json`, hata listesi boş. A17 basılı QR/gerçek telefon ve A18 fiziksel mobil PWA pilotu açık doğrulamalardır; ayrıntı `17-field-qr-and-offline.md`. Sıradaki paket **P13 teslim raporu modeli ve görsel çıktı**.


## P13–P16 — ortak teslim merkezi (7 Ekim 2026)

- Araç menüsü/komut paletine Teslim merkezi eklendi. Güncel dayanıklı kayıt veya adlandırılmış revizyon immutable rapor modeline alınır. Firma/proje/revizyon, ön/arka kabin görünümleri, envanter, bağlantı uçları, gözlemler ve açık işler HTML/PDF/SVG/CSV içinde aynı belgeden üretilir. Sonradan yapılan canlı düzenleme eski çıktıyı değiştirmez.
- BOM, açık cihaz/aksesuar/transceiver miktarlarını kimliklere izler; aynı port transceiver bildirimi ikinci kez sayılmaz. Tahmin/ölçüm/satın alma ayrıdır; sıfır korunur, bilinmeyen uzunluk kesin toplama veya 1 m varsayımına dönüşmez. Fire/standart boylar/birim fiyat/para birimi kullanıcı ayarıdır; eksik fiyatlar ara toplamda belirtilir.
- Kabin QR etiketleri ve kablo A/B çiftleri, mm ölçüsü/punto/kenar boşluğu ve sığma kontrolüyle üretilir. Görünen ad/uç kısaltılabilir; tam bilgi JSON/title içinde, değişmeyen kimlik yazıda ve QR içinde korunur. 11 sayfalık etiket fixture'ında 6 kabin + 120 uç etiketi eksiksizdir.
- ZIP; manifest+tam proje+yerel model tanımları+seçilen kanıtlar+PDF/HTML/SVG/CSV/etiket/görünüm/lisanslar ve bağımsız salt okunur görüntüleyici içerir. Hash, path, açılmış boyut, referans ve teknik durum kontrollerinden geçer. Seçilmeyen kanıtlar eksik olarak gösterilir. Aynı kimlikte var olan proje üzerine yazılmaz.
- Teslim başlığı, komut makbuzu ve gerçek ZIP baytlarını taşıyan named revision tek transaction'la yazılır. Abort/kota/çakışmada teslim eklenmez. Geçmişten aynı ZIP indirilir; tam proje yedeğinde baytlar/hash/manifest korunur. Undo/restore geçmişi silmez; kopya kaynak projeye ait teslim olarak işaretlenir. Kabul ayrı kullanıcı beyanıdır; elektronik imza değildir. Paket/açılmış içerik 24 MiB, proje başına kodlanmış paket geçmişi 48 MiB ile sınırlıdır.
- `npm run check`, `npm run build`, tam `npm test`: 6 aktif Vitest, **60/60 ürün testi**, mevcut tarayıcı paketleri ve **29/29 görsel test** geçti. Son hedefli **10/10** koşu (7 teslim kabulü + 3 proje yönetimi testi) gerçek indirmeleri, 2D/3D/sunum korumasını, dört tema ve 320/390/768/1440 genişliklerini içerir. Baseline/tolerans değiştirilmedi. Son 26 sayfalık rapor ve 11 sayfalık etiket PDF'si Poppler ile render edilip incelendi; Türkçe, ilk/son kimlikler ve etiket sayısı metin çıkarımıyla da kontrol edildi.
- Paralel ürün testleriyle ilk 10-kabin performans koşusunda hover ortalaması 2,636 ms ile 2,5 ms eşiğini aştı (`performance.log`). İzole 10-kabin koşusu aynı eşikle geçti (`performance-isolated.log`). Ardından **100 kabin / 3.000 cihaz / 20.000 kablo** izole smoke koşusu geçti; hata listesi boş (`performance-100.json`). Bunlar fiziksel GPU veya saha FPS sertifikası değildir.
- Kanıtlar `results/p13-p16/` içindedir: `check.log`, `build.log`, `tests.log`, `targeted.log`, performans günlükleri, PDF/ZIP fixture'ları ve render/tema görüntüleri. Kullanım/sınırlar: `18-delivery-reports-bom-labels.md`. A19–A22/A24 yerel kabul senaryoları doğrulandı; **A23 gerçek yazıcı ile %100 ölçü ve basılı QR'nin telefonla okunması açık**. Sırada **P17 kaynaklı mühendislik kataloğu**.

## P22–P31 — 8 Ekim 2026

SQLite masaüstü, NSIS yapılandırması, NetBox/AI pilotu, yerel ekip sunucusu, Yjs açıklamalar, çevrimdışı çatışma, pilot/sürüm/teşhis ve bakım dilimleri eklendi. Güncel paket/kanıt matrisi [24-p22-p31-status.md](24-p22-p31-status.md), yerel kurulum [22-local-workspace.md](22-local-workspace.md), kullanım/bakım [23-user-guide-and-maintenance.md](23-user-guide-and-maintenance.md). Gerçek saha ve kurulum kabulü açık; kaynak eklenmesi bütün planın kabulünün tamamlandığı anlamına gelmez.
