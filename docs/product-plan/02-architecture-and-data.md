# Mimari ve veri sözleşmesi

Bu belge hedef mimaridir. Önerilen yeni dosyalar henüz mevcut değildir. Mevcut semboller entegrasyon noktasıdır; bir modülün burada anılması onun yeni gereksinimleri karşıladığı anlamına gelmez.

## 1. Korunan sınırlar

- Canonical 2D çalışma alanı `js/2d/`; mevcut controller dosyaları `js/` altındadır. 3D kaynakları ve bilinen build akışı korunur.
- `index.html` modülleri ayrı script olarak yüklemeye devam eder. Yasaklanan monolitik 2D bundle oluşturulmaz.
- `src/` içindeki React/TypeScript prototipi otomatik olarak aktif ürünün yerine geçirilmez. Şema, IndexedDB/WAL ve migration fikirleri fixture uyumu doğrulanarak yeniden kullanılabilir.
- Pixi/Three render döngüleri proje kaydı, katalog AI isteği veya sunucu senkronizasyonu çalıştırmaz. Kameranın hareketi domain revizyonu oluşturmaz.
- Domain veri sahibi ortaktır; 2D ve 3D bunu görüntüleyen veya doğrulanmış komut gönderen adaptörlerdir.

## 2. Aktif kaynaklarda TypeScript yaklaşımı

İlk adım yeni ve ayrıştırılmış `js/2d/` modüllerinde JSDoc tipleri, ortak `js/2d/types/product.d.ts` ve `tsconfig.active-product.json` ile TypeScript denetimidir. `allowJs/checkJs` yalnızca kapsama alınan aktif modüllere uygulanır. Mevcut JS çalışma formatı ve doğrudan script yükleme korunur.

Saf TypeScript kaynaklarına daha sonra geçilecekse her modül ayrı çıktı verir; yükleme sırası ve sıfır-build mevcut 2D düzenleme akışı için ayrı karar kaydı ve test gerekir. P03 tam framework/renderer geçişi içermez. Zod gibi runtime doğrulama bağımlılığının paket listesinde bulunması klasik scriptlerde hazır olduğu anlamına gelmez; P02 erişim ve dağıtım yöntemini belirler. İlk sözleşme aktif topoloji doğrulayıcısını saran sürümlü validator olabilir.

## 3. Hedef modüller

| Sorumluluk | Önerilen yeni yol | Mevcut entegrasyon |
|---|---|---|
| Belge ve alan doğrulama | `js/2d/project-schema.js`, `project-migrations.js` | `topology-io.js`, mevcut katalog doğrulama |
| İşlem kuyruğu ve değişiklik | `js/2d/project-commands.js` | `editor.js`, cihaz/kablo eylemleri, bridge |
| Ortak repository | `js/2d/project-repository.js` | Editörün IndexedDB/kurtarma yolları |
| IDB veri adapteri | `js/2d/project-storage-idb.js` | `rack-studio` mevcut verisinin geçişi |
| Kanonik görünüm adaptörleri | `js/2d/project-adapters.js` | `state.js`, `studio-bridge.js`, 3D state |
| Revizyon ve senaryo | `js/2d/project-revisions.js`, `project-diff.js`, `scenario-engine.js` | Snapshot, devre izi |
| Gözlem ve saha geçmişi | `js/2d/field-observations.js`, `field-events.js` | Envanter, metadata, mobile workflow |
| Çıktı veri ve kuralları | `js/2d/report-model.js`, `bom-engine.js`, `label-model.js` | Saha kartı, schedule, routing |
| Ekran controllerları | `js/project-manager.js`, `workflow-views.js`, `field-controller.js`, `handover-controller.js` | Üst bar, sağ panel, mobile workflow |
| Dış sistem adapterleri | `js/integrations/netbox-adapter.js`, `catalog-reranker.js` | Gözlem ve katalog arama |
| Windows repository | `src-tauri/src/project_repository.rs` | `src-tauri/src/lib.rs`, capability, SQLite |
| Ekip servisi | `server/` altında proje/komut/yetki/senkronizasyon modülleri | P26 kararı sonrası yeni dağıtım hedefi |

Yeni 2D modüller `window.RackStudio` üzerinde dar API yayımlar; indeks yükleme sırası sözleşmesi P03'te sabitlenir. Tek dosyada controller, saklama ve renderer sorumluluğu biriktirilmez. Repository/değişiklik sözleşmesi tamamlanmadan UI ve entegrasyonlar kendi veri yazma yollarını açmaz.

## 4. Ortak ProjectDocument

Yeni belge biçiminin `schemaVersion` değeri uygulama sürümünden bağımsızdır. Mevcut `3.0.0` ve `4.0-studio` etiketleri P02 fixture listesinden belirlenen legacy girişlerdir. Bunların anlamı tahmin edilerek birleştirilmez.

| Alan | İçerik | Geçerli olma kuralı |
|---|---|---|
| `schemaVersion` | Yeni belge sözleşmesinin sayısal sürümü | Bilinen migrator veya açık sürüm hatası |
| `projectId` | Değişmez UUID | Çoğaltma yeni proje kimliği üretir |
| `revision` | Dayanıklı işlem sıra numarası | Başarılı domain işlemi artırır |
| `metadata` | Ad, müşteri bilgisi, sorumlu, durum, tarihler | Metin/tarih sınırları; yerel kişi kimliği türü |
| `locations` | Saha → bina → kat → oda hiyerarşisi | Geçerli üst ilişki; döngü yok |
| `topology` | Rack/device/cable ve kimlikli uçlar | ID/U/port/uyumluluk bütünlüğü |
| `catalogContext` | Kullanılan model sürümleri, özel katalog, kaynaklar | Mevcut proje için model çözümlemesi kararlı |
| `geometryOverrides` | Yerel kalibrasyon ve kaynağı | Doğrulanmış üretici verisiyle karıştırılmaz |
| `observations` | Kaynaklı ham/normalize gözlemler | Planı değiştirmez; entity eşleme açık |
| `fieldEvents` | Uygulama, etiket, test, düzeltme olayları | Geçiş ve revizyon önkoşulları |
| `evidenceRefs` | Fotoğraf/test eki metadata ve blob referansı | Proje sınırı, boyut/tür ve hash |
| `handoverRecords` | Dondurulmuş revizyon, açık işler, teslim durumu | Revizyon değişince kayıt değişmez |
| `integrationMappings` | Kaynak sistem + dış ID + iç entity ID | Kurulum/tenant/saha ile isim alanı |
| `extensions` | Sürümle tanımlı ek metadata | Boyut sınırlı; kayıt/çıktı gidiş dönüşünde korunur |

Revizyon kayıtları, büyük bloblar ve senaryo dalları repository'de ayrı saklanır. Açık projenin belleğine bütün revizyonlar ve fotoğraflar yüklenmez. Cihaz veya kablo taşınması entity kimliğini değiştirmez; projeyi çoğaltmak bütün iç referansları yeniden eşler.

UI tercihi/kamera/aktif seçim `WorkspaceViewState` içinde proje kimliğine bağlıdır; domain revizyonu değildir. Müşteriye gönderilecek kayıtlı sunum görünümü revizyona eklenen açık bir çıktı tanımıdır. Geçici DOM/Pixi/Three referansları belgeye girmez.

## 5. Tek işlem akışı

```text
Controller / 2D / 3D / import / senaryo
    → prepareCommand(commandId, projectId, expectedRevision, payload)
    → normalize + schema + yerleşim + port + domain doğrulaması
    → fark önizlemesi (toplu/değiştirici import/senaryo için)
    → ortak seri işlem kuyruğu
    → repository transaction: belge + işlem kaydı + yeni ek referansları
    → dayanıklı commit sonucu
    → kanonik state/görünüm adaptörü + sınırlı renderer invalidation
```

Her komut hedef proje ve beklenen revizyon taşır. Örnekler: CreateProject, MoveDevice, ConnectCable, UpdatePlannedMetadata, ImportObservations, RecordFieldEvent, CreateRevision, RestoreRevision, ApplyScenario. Çift tıklama/yeniden gönderim aynı `commandId` ile ikinci kez uygulanmaz.

Kritik kurallar: çakışan U yerleşimi, portun iki kez kullanılması, geçersiz uç/model, başka projeye yazma ve eski revizyona kör uygulama reddedilir. Undo/redo da aynı belge sözleşmesini kullanır. Bir toplu işlem tek geri-alma adımıdır; saha olayı iptali eski kaydı silmek yerine düzeltme kaydı üretir.

Mevcut state doğrudan değiştiren işlemler paket paket bu kapıya taşınır. Geçiş sırasında uyumluluk adaptörü vardır; yeni özelliklerin doğrudan state veya localStorage yazması engellenir. Sürüm testleri henüz taşınmamış yolların da ortak serializer ve doğrulamayı kullandığını kanıtlar.

Kayıt başarısı transaction tamamlandıktan sonra gösterilir. Başarısız işlem için önceki dayanıklı state korunur; kurtarılabilir taslak varsa ayrı gösterilir. Bellekte görülen değişiklik, sessizce kaydedilmiş sayılmaz. Yerel-only kullanıcıda iki sekme aynı proje için writer lease/revizyon kontrolüyle çalışır; ikinci sekme güvenli salt-okunur veya açık çatışma akışına girer.

## 6. Repository ve depolama

Ortak API: listProjects, loadProject, commitCommand, createRevision, listRevisions, readEvidence, exportArchive, archiveProject, recover. İşlemler sürüm/kimlik/atomiklik bakımından aynı sonuç sözleşmesini döndürür. IDB ve SQLite iç şemalarının birebir aynı olması gerekmez.

Tarayıcı hedef store'ları: projects, commandLog, revisions, observations, evidence, integrationMappings, workspaceViews, migrations. Commit için gereken belge, log ve referanslar tek transaction kapsamındadır. Büyük blobun hazırlanması UI'da tamamlanmış kayıt gibi gösterilmez; referans ancak başarılı kayıtla yayımlanır.

Windows hedefi SQLite transactionları ve yönetilen ek dizinidir. Dosya/DB arasında tek ACID transaction olmadığı için ek dosya staging → hash/doğrulama → DB referansı commit → sonlandırma akışı ve açılış reconciliation vardır. Geçici/orphan ek temizliği yalnızca referans kontrolünden sonra yapılır. SQLite sürümü P22'de repository uyumluluk testleriyle seçilir.

Legacy geçiş kaynakları: `rack-studio` IDB mevcut projesi; `rack-studio-project-v2`; `cisco-rack-studio-project`; `rackstudio_2d_autosave`; snapshot ve kayıtlı görünüm anahtarları. Birden fazla aday varsa zaman/version etiketine kör güvenmek yerine kaynakları ayrı kurtarma adayı göster. Şema doğrulaması başarısız veriyi silme; ham yedeği koru. Yeni kaydı okuyup eşdeğerlik doğrulanmadan eski kaydı kaldırma. Tekrarlanan geçiş yeni kopyalar üretmez.

Geçişler saf ve sürümlüdür; her adımın fixture girişi/çıkışı vardır. Bilinmeyen daha yeni belge desteklenmeyen sürüm olarak gösterilir ve açık proje değişmez. Sürüm düşürme önce tam dış yedek ve uyumluluk kontrolü gerektirir.

JSON aktarımı taşınabilir temel biçimdir. Tam proje arşivi belge + manifest + gerekli ekler + kullanılan özel katalog + teslim/sunum tanımlarını içerir. Boyut, ek sayısı ve sıkıştırılmış dosya limitleri P04/P16'da tanımlanır; yol taşması ve dış kaynak indirme engellenir. Hash bütünlük kontrolüdür; kişinin kimliğini veya saha doğruluğunu kanıtlamaz.

## 7. 2D/3D gidiş dönüşü

Kanonik belgenin hangi alanının renderer'a gerektiği açık şema ile belirlenir. 3D yalnızca değişen entity alanları için komut döndürür; diğer proje/saha/ek/katalog alanlarını yeniden kurarak silmez. Port dönüşümü kararlı port kimliğini kullanır. Belirsiz port eşlemesi ilk boş porta sessizce atanmaz; kullanıcıya çözülmemiş eşleme olarak sunulur.

P05 kanıt kapsamı: özel cihaz, asset/serial/IP bilgileri, ön/arka yüz, port config, pasif panel geçişi, gözlem, saha olayları, katalog kaynak/sürüm, geometry override, tahmini/ölçülen metraj, ek referansı ve proje/revizyon kimliği. Kamera ve sunum değişikliği bu bilgileri değiştirmez.

## 8. Gözlem, katalog ve senaryolar

Ham gözlem kaynak ve tarihleriyle saklanır; normalize edilmiş değer ve entity eşleme ayrı sonuçtur. Aynı kaynak/aynı içerik tekrarlandığında idempotent import uygulanır. Belirsiz veya çoklu eşleme review gerektirir. Daha yeni gözlem eski gözlemi silemez.

Katalog modeli kullanılan sürüm ve kaynakla sabitlenir. Global katalog güncellemesi açık projenin port sayısını veya uyumluluğunu sessizce değiştirmez. Kullanıcı güncelleme farkını görür; göç işlemi komutla uygulanır.

Senaryo ana belgenin adlandırılmış revizyonundan dallanır. Yerleşim, bağlantı ve malzeme farklarını ortak doğrulayıcı hesaplar. Ana proje senaryo önizlemesinden etkilenmez; apply sırasında beklenen revizyon yeniden kontrol edilir. Fiziksel graph pasif geçişleri ve kayıtlı kabloları kullanır; eksik eşleme sonucu unknown olur.

## 9. Ekip mimarisi

Sunucu firma/proje üyeliği, rol, acceptedRevision ve authoritative commandLog sahibidir. Önerilen backend başlangıcı TypeScript/Node ve PostgreSQL'dir; hosting, kimlik sağlayıcı ve maliyet P26 kısa karar kaydıyla sabitlenir. Yerel repository portu sayesinde browser ve Tauri çekirdeği sunucuya bağımlı hale gelmez.

Yjs açıklamalar, birlikte çalışma farkındalığı ve ortak çalışma yüzeylerinde kullanılır. Topoloji için CRDT yakınsaması U/port kurallarının sağlandığı anlamına gelmez. Topoloji değişiklikleri sunucuda beklenen revizyon/domain doğrulamasından geçer; kabul edilen komut ve revizyon istemcilere yayımlanır. Yjs authoritative topoloji store'unun yerine konmaz.

Çevrimdışı istemci komutları yerel taslak/outbox'ta saklar. Yeniden bağlanınca güncel kabul edilmiş revizyon üzerinde rebase/önkoşul kontrolü yapılır. Çakışan yerleşim veya port bağlantısı açık seçeneklerle çözülür; son yazan kazansın kuralı fiziksel topolojiye uygulanmaz. Paylaşılan undo diğer kullanıcının değişikliğini silmez; yerel komuta bağlı doğrulanan ters işlem gönderir.

Yerel-only projede `revision` dayanıklı yerel belge sürümüdür. Ekip projesinde kanonik belge `acceptedRevision` ile sunucudan kabul edilmiş sürümü taşır; offline çalışma ayrı `DraftDocument` içinde `baseAcceptedRevision`, `localSequence`, komutlar ve geçici projection tutar. Taslak kayıt sonucu `localDraft`, sunucu commit sonucu `accepted` olarak döner. Offline sayaç sunucu revizyonu gibi kullanılmaz; outbox yeniden bağlanınca sırayla güncel önkoşula karşı değerlendirilir. Repository adapteri bu iki kayıt sonucunu UI'a açık biçimde iletir.

Yerel kişi adı bir kurumsal audit kimliği değildir. Sunucu olayları kimlik/yetki kontrolünden sonra alır; client timestamp ile server timestamp ayrı tutulur. Proje ekleri, salt-okunur paylaşım ve export da aynı ACL kapsamındadır. Yetki iptali cihazda daha önce indirilmiş veriyi geri alma garantisi olarak sunulmaz; sonraki erişim ve sync reddedilir.

Başlangıç rol sözleşmesi aşağıdadır. Her rol kendi firmasının üyesi olduğu projelerle sınırlıdır; sunucu her işlemde izin denetler.

| Eylem | Owner | Designer | Technician | Viewer |
|---|---|---|---|---|
| Yetki/üyelik/paylaşım yönetimi | Evet | Hayır | Hayır | Hayır |
| Plan/yerleşim/bağlantı düzenleme | Evet | Evet | Değişiklik önerisi | Hayır |
| Gözlem/saha olayı/kanıt ekleme | Evet | Evet | Evet | Hayır |
| Revizyon/senaryo uygulama | Evet | Evet | Hayır | Hayır |
| Teslim hazırlama/dondurma | Evet | Evet | Hayır | Hayır |
| Salt-okunur erişim | Evet | Evet | Evet | Paylaşılan revizyon |
| Tam arşiv/kişisel kanıt export | Evet | Proje export izniyle | Hayır | Hayır |
| Arşivleme/kalıcı silme | Evet | Hayır | Hayır | Hayır |

Teslim kabulü belirli revizyon için ayrı yetkili işlem/kayıttır; viewer rolü tek başına müşteri kabul yetkisi vermez. Firma üyesi olmayan izleyici paylaşımının token/süre/izin kapsamı P26'da tanımlanır; tam arşiv ve kanıt indirimi varsayılan değildir.

## 10. Mevcut kaynak kanıtı

| Güncel kaynak | Planı etkileyen gözlem |
|---|---|
| [Editor](../../js/editor.js) | `snapshot`, `save`, `restore`; tek current IDB kaydı, geri alma ve kurtarma |
| [Topology IO](../../js/2d/topology-io.js) | Doğrulama, JSON, localStorage autosave; bağımsız serializer |
| [Snapshot](../../js/2d/snapshot-manager.js) | Racks/cables snapshot ve toplamsal karşılaştırma |
| [Bridge](../../js/studio-bridge.js) | `sync3Dto2D` alan eşleme ve legacy belge kurma; `sync2Dto3D` projeksiyon |
| [Inventory](../../js/inventory-import.js) | Cihaz observed alanı ve dosya/tarih kaydı |
| [Circuit trace](../../js/circuit-trace.js) | Açık pasif panel eşlemeleri üzerinden fiziksel iz |
| [Prototip persistence](../../src/core/persistence/indexeddb.ts) | Ayrı DB'de snapshot/WAL taslağı; aktif ürüne hazır entegrasyon sayılmaz |

Bu tabloda gelecekteki veri kaybının kesin oluştuğu iddia edilmez. Farklı serializer/adapter sınırları için açık sözleşme ve gidiş dönüşü testi gereksinimi tanımlanır.
