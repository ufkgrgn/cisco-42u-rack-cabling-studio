# Teknoloji kararları ve kaynaklar

Durum: 6 Ekim 2026 plan kararları. Paket içinde verilen davranış hedefleri uygulanmış özellik veya performans garantisi değildir. Sürüm sabitleme ilgili paket başında lockfile/Rust toolchain ve resmi belgeyle yapılır.

## T01 — mevcut renderer ve modülleri koru

PixiJS/Three.js ve canonical 2D modüller sürdürülür. GPU/framework değişimi bu ürün kapsamının önkoşulu değildir. UI, domain işlem ve persistence sınırları iyileştirilir. Kamera/pan/zoom hattına ağ, kayıt ve AI işi girmez. Renderer değişikliği ancak aynı fixture/donanım ölçümüyle ayrı karar olur.

## T02 — TypeScript'i aktif ürüne kademeli uygula

İlk uygulama JSDoc + `allowJs/checkJs`, dar tip sözleşmeleri ve bağımsız typecheck configidir. Bu, direkt yüklenen JS modüllerinin çalışma biçimini korur. Ayrı `src/` prototipini bütünüyle aktive etmek seçilmedi. Prototipteki şema/WAL fikirlerinin yeniden kullanımı aktif fixture uyumu ve dar sınırlar üzerinden yapılır. P03 çıktısı derleme dönüşümünden önce tip güvenliği sağlar.

## T03 — tarayıcıda IndexedDB, ortak repository

Aktif editor zaten IndexedDB kullanır; bu teknoloji yeniden eklenmez. P04 proje kimliği, revision/log/ek store'ları, atomiklik ve kurtarma sözleşmesini geliştirir. `idb` dependency'si mevcut; API ergonomisi için kullanılabilir, fakat IDB transaction yaşam döngüsü ve hata testlerinin yerine geçmez. localStorage küçük tercih/legacy recovery alanıyla sınırlanır. Tarayıcı depolaması bağımsız dış yedek yerine sayılmaz.

## T04 — Windows'ta Tauri 2 ve SQLite

Tauri yapılandırması mevcut NSIS paket hedefini ve dialog/fs eklentilerini içerir; mevcut Rust girişinde SQL eklentisi başlatılmıyor. P22 ortak repository için SQLite ekler; migration/transaction/ek reconciliation testleri zorunludur. Resmi SQL eklentisi SQLite driver ve migration desteği sunar; güncel toolchain gereksinimi entegrasyon başında doğrulanır. [Tauri SQL](https://v2.tauri.app/plugin/sql/)

P23 Windows dağıtımında WebView2 bulunan ve bulunmayan ortamı ayrı sınar. Resmi dağıtım seçenekleri internet bağımlılığı ve paket boyutu bakımından farklıdır; offline installer/fixed runtime tercihi temiz makine testinden sonra sabitlenir. Tauri veya NSIS kullanımı tek başına portable/kurulumsuz dağıtım kanıtı değildir. [Tauri Windows installer](https://v2.tauri.app/distribute/windows-installer/)

SQL/Rust backend erişimi yalnızca gerekli capability/komutlara açılır; frontend'e sınırsız dosya veya veritabanı yüzeyi verilmez. User project files ve secrets ürünün açık proje JSON'undan ayrıdır.

## T05 — QR/PWA ve mobil saha

QR bir entity kimlik taşıyıcısıdır. Yerel kütüphane assetiyle decoder üretildiği build'de paketlenir; kamera izni ve platform desteği kontrol edilir. Elle giriş daima kullanılabilir. HTTPS/localhost service worker hedefi ve doğrudan file URL kullanımı ayrı kabul hedefleridir; çevrimdışı çalışma iddiası asset/proje cache ve gerçek yeniden açma kanıtı gerektirir.

Android/Tauri komutunun repoda bulunması Android paketinin saha için doğrulandığı anlamına gelmez. İlk mobil hedef browser/PWA akışıdır; native Android dağıtımı P12/P23 sonrası ayrı platform matrisiyle genişler.

## T06 — NetBox'u gözlem kaynağı olarak bağla

Resmi API site/rack/device/interface nesnelerine erişim ve pagination sağlar. P24 dış ID'leri kurulum + saha + model bağlamıyla eşler; import sonucu mevcut gözlem sözleşmesine girer. İlk prototip anonim NetBox response fixture'larıyla; canlı pilot Tauri credential adapteri veya yetkili backend üzerinden. [NetBox REST API](https://netboxlabs.com/docs/netbox/integrations/rest-api/)

API modeli hedef kurulumun schema/version'una karşı doğrulanır. İçe alma işi tamamlanmadan eksik response topluluğu tam saha envanteri diye uygulanmaz. İlk sürüm salt okunurdur; POST/PATCH/DELETE ve otomatik cihaz yönetimi bu paket kapsamına girmez.

## T07 — Jev'i katalog adaylarının sıralanmasında dene

Akış: teknik filtre → mevcut katalog shortlist → sorgu-aday uygunluk değerlendirmesi → sıralı sonuç veya no-match. TypeSafe resmi yeniden sıralama örneği bu iki aşamalı yaklaşımı gösterir; örneğin başka bir alandaki başarı sayıları bu projenin beklenen doğruluğu olarak kullanılmaz. [TypeSafe yeniden sıralama](https://docs.typesafe.ai/cookbooks/rerank_typesafe), [resmi belge indeksi](https://docs.typesafe.ai/llms.txt)

İlk değerlendirme en az 60 TR/EN sorgu: tam SKU, teknik tarif, eşanlamlı, typo, birden fazla uygun aday ve no-match. Teknik constraint ihlali sıfır olmalı. Teknik tarif grubunda Top-3 doğru aday oranında en az 10 yüzde puan artış ilk yayın hedefidir; exact-SKU davranışı bozulmamalı. Zaman aşımı için ilk hedef 1.5 saniye; baseline araması sonucu kullanıcıya hemen gösterilir. Maliyet ve gerçek p95 gecikme raporlanır; bunlar model garantisi değildir. Eşikler pilot seti ve ayrı held-out sorgularla değerlendirilir.

Jev render, geometrik yerleşim, kesin uyumluluk, persistence veya saha doğrulama kararının sahibi değildir. Teknik özellik uydurmaz; yalnızca verilen aday ve kaynak üzerinden sıralar. API key native credential sağlayıcıda veya sunucudadır. Tarayıcı-only S1'de güvenli backend yoksa AI kapalıdır; arama çalışır.

## T08 — Yjs ve authoritative topoloji işlemlerini birleştir

Yjs provider ve `y-indexeddb` çevrimdışı ortak veri saklama yaklaşımını destekler. Bu, bağımsız alanlarda açıklama/not birlikte çalışması için uygundur. Presence proje verisinin kalıcı parçası değildir. [Yjs çevrimdışı çalışma](https://docs.yjs.dev/getting-started/allowing-offline-editing)

Fiziksel topolojide iki cihaz aynı U alanını veya iki kablo aynı portu kullanamaz. Yjs veri yakınsaması bu kuralı kendiliğinden garanti etmez. P26–P28 topolojiyi server command/revision transactionlarıyla kabul eder; offline değişiklikler taslaktır. Yjs ortak açıklama/farkındalık yüzeyini taşır; server kabulündeki domain eventleriyle UI güncellenir. Offline topoloji rebase ve local undo politikası uygulama kodundadır.

Başlangıç backend önerisi TypeScript/Node ve PostgreSQL, Yjs için kimlikli provider'dır. Auth/hosting ve ihtiyaç duyulan ops yükü P26'da küçük bir dikey dilimle doğrulanır; server dağıtımı bu doküman yazımı sırasında yapılmaz. Auth, tenant ve ek erişimi olmadan paylaşılan proje özelliği açılmaz.

## T09 — rapor ve etiket üretimi

Önce immutable report model + print CSS + SVG/CSV. Browser'ın Save as PDF akışı ilk PDF hedefidir; otomatik dosya adıyla programatik PDF indirmesi ayrı tamamlanma maddesidir. P13 font/sayfa/etiket ölçüsünü gerçek render/baskıyla doğrular; ihtiyaç varsa hedef platformla uyumlu PDF kütüphanesi küçük spike sonrası seçilir. Her çıktı aynı frozen revision verisinden üretilir.

Tam arşiv için JSON manifest ve ek paketleme kütüphanesi P16'da boyut/yol güvenliği, lisans ve offline build desteğiyle seçilir. Sırf dependency seçmek için rapor modelini bekletmek gerekmez.

## Açık karar kayıtları ve çözüm zamanı

| Karar | Varsayılan | Son çözüm zamanı | Geliştirmeyi etkileyen çıktı |
|---|---|---|---|
| İlk kullanıcı | Teknisyen/küçük IT/entegratör | P00 pilot görüşmesi | Görev ve fixture önceliği |
| Ürün adı | Rack Studio çalışma adı | P23 | Paket adları/ikon/identifier tutarlılığı |
| Tip/runtime validator | Aktif JS typecheck + ortak validator | P02–P03 | Aktif script yükleme ve schema sözleşmesi |
| PDF yolu | Print preview / Save as PDF | P13 spike | PDF/baskı kabul çıktısı |
| QR/ZIP kütüphanesi | Küçük, yerel asset, lisansı açık | P12/P16 | Offline build ve limit testleri |
| Windows runtime/paket | Mevcut NSIS; offline ihtiyaç matrisi | P23 | Temiz makine installer kanıtı |
| NetBox/Jev credentials | Tauri backend; browser için server | P24/P25 canlı pilotu | Secret ve network sınırı |
| Backend/auth/hosting | TS/Node + PostgreSQL; proje ACL | P26 | İşleyen yetkili proje dikey dilimi |
| İlk marka kapsamı | Küçük kaynaklı Cisco/generic küme | P17 | Model source/version ve ikinci üretici paketi |

Bu kararlar planı uygulanabilir kılmak için varsayılanlarla ilerler. Zamanı geldiğinde maddi fark çıkarsa karar kaydı ve ilgili bağımlılık/kabul senaryosu birlikte güncellenir; kapsamın geri kalanı yeniden başlatılmaz.
