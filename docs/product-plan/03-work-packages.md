# Uygulanabilir iş paketleri

P00–P31 toplam 32 pakettir. Bütün paketlerin ilk durumu **planlandı**. Sorumlu roller uzmanlık ve dosya sahipliğini tanımlar; otomatik agent veya ayrı chat oluşturma talimatı değildir.

`Yeni:` ile verilen dosyalar önerilen hedeflerdir. Aynı dosyanın birden fazla pakette kullanılması o dosyada eşzamanlı bağımsız değişiklik yapılabileceği anlamına gelmez. Özellikle `state.js`, `editor.js`, `topology-io.js`, `studio-bridge.js`, `index.html`, `package.json` ve veri tiplerinin tek entegrasyon sahibi olmalıdır.

Her pakette: ilgili kabul senaryosu çalıştırılır; değişen aktif kaynak için test yazılır veya mevcut test genişletilir; [doğrulama belgesindeki](04-validation-and-release.md) orantılı kapılar uygulanır. Saf dokümantasyon veya düşük etkili görsel değişiklikte uygulamayı taklit eden test üretilmez. Teslim notu değişiklik, kanıt, kalan sınır ve sıradaki paket bilgisini içerir.

## F0 — başlangıç kanıtı

### P00 — aktif ürün ve veri tabanı envanteri

- **Sorumlu:** entegrasyon/QA. **Bağımlılık:** yok.
- **Dosya kapsamı:** `package.json`, `index.html`, `scripts/`, `tests/`, `docs/test-audit.md`; yeni `docs/product-plan/baseline.md`.
- **İş:** HEAD ve çalışma ağacı kaydı; aktif/prototip kaynak ayrımı; mevcut testleri sonuçlarıyla sınıflandır; 1/10/100 kabin ölçümünün fixture ve donanımını kaydet; mevcut depolama kaynaklarını belgelemek için örnek projeler oluştur.
- **Çıktı:** başlangıç raporu ve sürüm/girdi fingerprintleri. Gerçek kullanıcı verisi fixture yapılmaz; anonimleştirilmiş kopya kullanılır.
- **Kabul:** A41; başarısız mevcut testler açık hata kaydıdır, başarılı sayılmaz. Sonraki efor tahminleri bu rapordan güncellenir.

### P01 — aktif veri ve regresyon fixture seti

- **Sorumlu:** QA. **Bağımlılık:** P00.
- **Dosya kapsamı:** mevcut `tests/editor.test.cjs`, `tests/bridge-sync.test.cjs`, `tests/studio.test.cjs`; yeni `tests/fixtures/product/` ve aktif modül testleri; `package.json`.
- **İş:** küçük, özel kataloglu, pasif panel geçişli, gözlemli, ön/arka portlu, bozuk, yeni-sürüm ve çok kabinli proje fixture'ları. Assertionlar aktif ürünü çalıştırır. Yeni testlerin günlük komutlara gerçekten dahil olduğunu göster.
- **Çıktı:** fixture manifesti, beklenen semantic alanlar ve başlangıç sonuçları.
- **Kabul:** A03/A04/A08 için girdi ve beklenen semantic alan manifesti; A41 için aktif harness ve mevcut davranış sonuçları. P01 bu hazırlık tamamlanınca kapanır. Henüz uygulanmamış özellik sonuçları pending kalır ve ilgili ürün paketinde yürütülür; P01 fixture hazırlığı onların geçtiği anlamına gelmez.

## F1 — ortak proje temeli

### P02 — belge şeması ve kayıpsız migration

- **Sorumlu:** domain/veri. **Bağımlılık:** P01.
- **Dosya kapsamı:** `js/2d/topology-io.js`; yeni `project-schema.js`, `project-migrations.js`, `types/product.d.ts`; `src/core/persistence/` yalnızca yeniden kullanım incelemesi.
- **İş:** ProjectDocument/Observation/FieldEvent/Evidence/Revision sözleşmeleri; legacy format eşlemesi; eşsiz kimlikler ve bilinmeyen alan/sürüm politikası; limitli import. Belge sürümü ile uygulama sürümünü ayır.
- **Çıktı:** sürümlü serializer/validator/migrator ve fixture dönüşüm tablosu.
- **Kabul:** A01–A04. Geçersiz giriş açık projeyi değiştirmez; özel katalog/port bilgileri kayıpsız korunur.

### P03 — ortak komut kapısı ve tip denetimi

- **Sorumlu:** domain/entegrasyon. **Bağımlılık:** P02.
- **Dosya kapsamı:** `js/editor.js`, `js/2d/device-actions.js`, `cable-actions.js`, `port-interaction-handler.js`, `js/ui-actions.js`; yeni `project-commands.js`, `tsconfig.active-product.json`.
- **İş:** commandId, expectedRevision, doğrulama, idempotency, undo/redo ve invalidation sözleşmesi; aktif modülleri sırayla TypeScript checkJs kapsamına al. Yeni modüllerin yükleme sırasını belirle ve doğrudan state yazma geçiş listesini tut.
- **Çıktı:** çalışan küçük örnek olarak MoveDevice ve ConnectCable; diğer mevcut işlemler için taşıma listesi ve uyumluluk adaptörü.
- **Kabul:** A03, A05, A41. Bir toplu işlem tek geri-alma adımı; reddedilen işlem topolojiyi değiştirmez. Yeni özellikler ayrı veri yazma yolu açmaz.

### P04 — çoklu proje repository, kurtarma ve dış yedek

- **Sorumlu:** persistence. **Bağımlılık:** P02, P03.
- **Dosya kapsamı:** `js/editor.js`, `js/2d/topology-io.js`; yeni `project-repository.js`, `project-storage-idb.js`.
- **İş:** projects/log/revisions/evidence store'ları; atomik commit; writer lease; birden çok legacy kurtarma adayının seçimi; idempotent geçiş; arşivleme ve tam dış yedek. Ek boyutu ve archive limitlerini tanımla.
- **Çıktı:** repository sözleşmesi ve recovery ekranı. Depolama dolduğunda taslak/son dayanıklı kayıt ayrımı.
- **Kabul:** A04–A07. İşlem ortasında kapanma, quota hatası, açılırken yapılan düzenleme ve iki sekme senaryoları. Eski kayıt doğrulanmış yeni yedek olmadan silinmez.

### P05 — ortak verinin 2D/3D korunması

- **Sorumlu:** 2D/3D entegrasyon. **Bağımlılık:** P02–P04.
- **Dosya kapsamı:** `js/2d/state.js`, `js/studio-bridge.js`, `js/src/3d/state3d.js`, `js/src/3d/engine.js`; yeni `project-adapters.js`; `tests/bridge-sync.test.cjs`.
- **İş:** 3D değişikliklerini patch/komutla kanonik projeye uygula; metadata/saha/katalog alanlarını yeniden oluşturarak düşürme. Kararlı port kimliği, çözülmemiş eşleme ve kamera/domain ayrımı.
- **Çıktı:** aynı belge üzerinde iki görünüm ve bütün alanların gidiş dönüşü matrisi.
- **Kabul:** A08, A41. On adet 2D↔3D geçişinden sonra fixture alanları eşdeğer; kamera hareketi revizyon/kayıt üretmez.

### P06 — proje listesi ve saha hiyerarşisi

- **Sorumlu:** UI + domain. **Bağımlılık:** P04, P05.
- **Dosya kapsamı:** `index.html`, `js/topbar-controller.js`, `js/2d/rack-manager.js`; yeni `js/project-manager.js`, `css/project-manager.css`.
- **İş:** oluştur/aç/çoğalt/ara/arşivle/yedekle; müşteri/saha/bina/kat/oda metadata; kabin bağları; proje durum ve tarihleri. UUID ve iç referans remapping; kaydedilmemiş proje değiştirme akışı.
- **Çıktı:** yerel projeler ekranı ve sahaya göre kabin ağacı.
- **Kabul:** A01, A02, A07. Bir proje düzenlemesi diğerinin metadata/ek/revizyon/görünümünü değiştirmez.

## F2 — revizyon ve arayüz

### P07 — adlandırılmış revizyon ve semantic fark

- **Sorumlu:** domain + UI. **Bağımlılık:** P04–P06.
- **Dosya kapsamı:** `js/2d/snapshot-manager.js`; yeni `project-revisions.js`, `project-diff.js`, `js/revision-controller.js`.
- **İş:** taslak/onay/teslim etiketi, açıklama ve baseline; cihaz/konum/port/kablo/metadata farkı; eklenen/değişen/silinen nesneye git; tek komutla revizyon geri yükleme. Eski snapshotları ayrı kaynakla içe al.
- **Çıktı:** revizyon listesi ve değişiklik paneli.
- **Kabul:** A09–A10. Farkı olmayan nesne değişti diye gösterilmez; geri dönüş özel katalog ve saha referanslarını da kapsar.

### P08 — tasarım/saha/sunum görünümleri ve sağ panel

- **Sorumlu:** UI/erişilebilirlik. **Bağımlılık:** P03, P06; revizyon bölümü için P07.
- **Dosya kapsamı:** `index.html`, `js/instrument-shell.js`, `js/mobile-workflow.js`, `js/ui-actions.js`, metadata/port controllerları; yeni `js/workflow-views.js`; ilgili theme/inspector/mobile CSS.
- **İş:** işe göre araç yoğunluğu; tutarlı seçim paneli; kritik işlemler için metin; durumun renkten bağımsız gösterimi; klavye/fokus/Escape/dokunma; 2D/3D görünüm ile çalışma modu ayrı kontrol.
- **Çıktı:** üç görünümün aynı projeyle çalışan ekranları.
- **Kabul:** A11, A41. 390/768/1440 piksel ve 320 piksel taşma kontrolü; son CSS değişikliğinden sonra yeni görüntü. 3D seçiminin metadata paneliyle uyumu.

### P09 — ilk kullanım, navigasyon ve kayıtlı sunum

- **Sorumlu:** ürün/UI. **Bağımlılık:** P08.
- **Dosya kapsamı:** `js/command-palette.js`, `js/saved-views.js`, `js/2d/presets.js`; yeni `js/onboarding-controller.js` ve ayrı örnek proje fixture'ı.
- **İş:** cihaz yerleştir/bağla/saha kaydı/teslim akışı; atla/yeniden aç; örnek proje ayrımı; boş durumlar; kayıtlı 2D/3D açıların proje/teslim revizyonuna bağlanması.
- **Çıktı:** kısa yönlendirme ve sunum bookmark akışı.
- **Kabul:** A12, A11. İlk kullanım mevcut projeyi üzerine yazmaz; farklı projedeki görünüm yanlış kabine götürmez.

## F3 — saha ve teslim

### P10 — gözlem geçmişi ve plan/gözlem farkı

- **Sorumlu:** domain/import. **Bağımlılık:** P02–P04, P08.
- **Dosya kapsamı:** `js/inventory-import.js`, `js/project-checks.js`, `js/device-metadata-editor.js`; yeni `field-observations.js`.
- **İş:** cihaz/port/bağlantı gözlem modeli; dosya/kaynak/zaman; ham ve normalize veri; belirsiz eşleme; idempotent import; seçilen farkla plan güncelleme. Mevcut observed alanını migration ile geçmişe taşı.
- **Çıktı:** kaynak bazlı gözlem zaman çizgisi ve fark paneli.
- **Kabul:** A13–A14. Yeni gözlem eskisini silmez; plan ancak ayrı kullanıcı işlemiyle değişir; tarihi eski gözlem açık gösterilir.

### P11 — saha iş akışı ve kanıt ekleri

- **Sorumlu:** domain + saha UI. **Bağımlılık:** P04, P08, P10.
- **Dosya kapsamı:** `js/mobile-workflow.js`, `js/2d/schedule-table.js`; yeni `field-events.js`, `js/field-controller.js`, ek repository adapteri.
- **İş:** uygulandı/etiket/test sonucu olayları; teknisyen adı, tarih, not ve fotoğraf/test eki; başarısız/değerlendirilemedi; gerekçeli düzeltme; uç veya model değişince yeniden test gereksinimi.
- **Çıktı:** kabin/hat iş listesi ve tek elle kayıt.
- **Kabul:** A15–A16, A18. Eksik test başarılı görünmez; eki kaydetme hatası olayı tamamlanmış göstermez; eski kanıt korunur.

### P12 — QR kimliği ve çevrimdışı saha erişimi

- **Sorumlu:** saha/platform. **Bağımlılık:** P06, P11.
- **Dosya kapsamı:** yeni `js/field-qr.js`, `js/field-offline.js`, yerel QR decoder dependency/asset; `js/mobile-workflow.js`, `index.html`; gerekiyorsa manifest ve service worker.
- **İş:** sürümlü proje/kabin/kablo kimliği payload; yüklü projede çözümle; kamera/elle giriş; tekrar tıklamaya dayanıklı kayıt; HTTPS/localhost PWA asset cache ve güncelleme akışı. File URL desteği ayrı test hedefidir.
- **Çıktı:** izin reddinde çalışan alternatif erişim ve ağ olmadan önceden yüklenmiş saha ekranı.
- **Kabul:** A17–A18. Kamera API desteği varsayılmaz; yanlış projeye ait QR açık hata verir; QR otomatik uzaktaki veri indirmez veya kimlik doğrulama yerine geçmez.

### P13 — teslim raporu modeli ve görsel çıktı

- **Sorumlu:** rapor/UI. **Bağımlılık:** P07, P08, P10.
- **Dosya kapsamı:** `js/field-sheet.js`, `js/2d/schedule-table.js`, `topology-io.js`; yeni `report-model.js`, `js/report-controller.js`, `css/report-print.css`.
- **İş:** seçilmiş revizyondan immutable rapor modeli; firma/proje/revizyon başlığı; rack görünümü, envanter, bağlantı, gözlem ve açık işler. Print preview/PDF ve SVG/CSV çıktıları; uzun tablolar ve Türkçe karakterler.
- **Çıktı:** sabit veriye bağlı teslim raporu önizlemesi ve yazdırılabilir HTML.
- **Kabul:** A19–A20. Çok sayfalı PDF için gerçek render incelemesi; tarayıcı yazdırma ile otomatik PDF dosya üretimi aynı tamamlanma iddiası değildir.

### P14 — malzeme listesi ve uzunluk semantiği

- **Sorumlu:** domain/metraj. **Bağımlılık:** P02, P13.
- **Dosya kapsamı:** `js/2d/cable-routing.js`, `schedule-table.js`; yeni `bom-engine.js`; rapor modeli.
- **İş:** model/aksesuar/transceiver/kablo adetleri; tahmini güzergâh, saha ölçümü ve satın alma boyu; kaynak ve tolerans; standart boy seçenekleri ve kullanıcı fire ayarı. Bilinmeyen miktar/metraj ayrı satır.
- **Çıktı:** izlenebilir malzeme özeti ve CSV; varsa birim fiyat kullanıcı girer, fiyatlar otomatik güncel kabul edilmez.
- **Kabul:** A21–A22. Aynı kablo iki kez sayılmaz; kaynaksız uzunluk 1 metre gibi varsayımla kesin toplam yapılmaz.

### P15 — kablo/kabin etiketleri

- **Sorumlu:** çıktı/UX. **Bağımlılık:** P12–P14.
- **Dosya kapsamı:** yeni `label-model.js`, `js/label-controller.js`, `css/labels-print.css`; QR payload ve rapor modeli.
- **İş:** değişmez kimlik + kullanıcı etiketi; kaynak/hedef uç etiketi çifti; ölçü/punto/kenar boşluğu önizlemesi; kabin QR ve kablo kodu; uzun isimde okunur kısaltma, asıl bilgi korunur.
- **Çıktı:** A4 ve tanımlı etiket boyları için yazdırılabilir şablonlar.
- **Kabul:** A23. Baskı yüzde 100 ölçekle ölçülür; gerçek basılan QR telefonda okunur; uçlar karışmaz.

### P16 — revizyonu donduran tam teslim paketi

- **Sorumlu:** domain/rapor/entegrasyon. **Bağımlılık:** P07, P11, P13–P15.
- **Dosya kapsamı:** yeni `js/handover-controller.js`, arşiv/export adapteri; `project-repository.js`, rapor/etiket/saved-view tanımları.
- **İş:** revizyon seçimi, açık iş listesi, teknik tamamlanma ve teslim kabulünün ayrımı; manifest+proje+ekler+PDF/SVG/CSV/etiketler; kişisel eklerin seçimi; sabit revizyonlu çevrimdışı salt-okunur izleyici.
- **Çıktı:** kendi başına yeniden açılabilir teslim paketi ve teslim geçmişi.
- **Kabul:** A24, A19–A20. Sonraki düzenleme eski teslimi değiştirmez; paket import edildiğinde ilgili ek/model/kimlikler korunur. “Kabul” kaydı elektronik imza hizmeti gibi sunulmaz.

## F4 — mühendislik yardımcıları

### P17 — katalog kaynakları ve sürümleme

- **Sorumlu:** katalog/veri. **Bağımlılık:** P02, P06.
- **Dosya kapsamı:** Cisco/generic kataloglar, `js/catalog-ui.js`, `js/catalog-stencil-resolver.js`, `js/port-calibrator.js`; yeni kaynak manifesti.
- **İş:** manufacturer/model/SKU/source/date/modelVersion; fiziksel ve teknik doğrulama seviyeleri; üretici belgesi ve yerel kalibrasyon ayrımı; kullanılan modelleri projede sabitle. Bir küçük Cisco + generic pilot kümesiyle başlayıp ikinci üretici veri paketi ekle.
- **Çıktı:** kaynaklı katalog kartları ve kontrollü katalog güncelleme farkı.
- **Kabul:** A25. Global güncelleme projedeki port kimliğini/sayısını sessizce değiştirmez; doğrulanmayan alanlar görünürdür.

### P18 — modül/transceiver ve fiziksel uyumluluk

- **Sorumlu:** network/domain. **Bağımlılık:** P03, P17.
- **Dosya kapsamı:** `js/2d/network-rules.js`, kataloglar, `js/port-config-editor.js`; yeni yetenek/uyumluluk veri modülü.
- **İş:** port kafesi/modül/transceiver/connector/media/speed ve bilinen fiber mesafe verileri; combo port ilişki ve modül yuvası; değişiklik önizlemesi; mevcut kabloların yeniden denetimi.
- **Çıktı:** kaynaklı deterministik uyumluluk sonucu allowed/blocked/unknown.
- **Kabul:** A26. Katalogda olmayan veri uyumlu diye kabul edilmez; hata nedeni ve kaynak alanı gösterilir. Ağ kuralları AI'ya devredilmez.

### P19 — PoE ve güç kapasite bütçesi

- **Sorumlu:** domain/katalog. **Bağımlılık:** P17–P18.
- **Dosya kapsamı:** katalog güç bilgileri ve port config; yeni `js/2d/power-budget.js`; sağ panel/denetim UI.
- **İş:** tanımlı toplam/per-port PoE bütçesi, planlanan tüketim ve kaynak; bilinen PSU/PDU bağlantıları ve A/B grupları; kapasite özeti. Güç birimlerini ve nameplate/typical değerleri ayır.
- **Çıktı:** açıklanabilir kapasite tablosu ve eksik veri işaretleri.
- **Kabul:** A27. Eksik tüketim sıfır sayılmaz; aynı cihaz/tüketim iki kez eklenmez; belge kaynağı olmadan sayısal uyumluluk sonucu üretilmez.

### P20 — açıklayan ve çözüme götüren denetim

- **Sorumlu:** domain/UI. **Bağımlılık:** P18–P19.
- **Dosya kapsamı:** `js/project-checks.js`, `network-rules.js`; yeni ortak issue modeli; nesne paneli.
- **İş:** kararlı issueId/severity/affectedEntity/source/fixCandidates; filtre ve nesneye git; tekrar kontrol; düzeltme önizlemesi/komutu; eksik veriyle ihlal ayrımı. Kaynak değişince eski issue sonucu geçersizleşir.
- **Çıktı:** proje kontrol paneli ve deterministik düzeltme seçenekleri.
- **Kabul:** A28. Yanlış veya belirsiz kontrol sonucu sessiz otomatik düzeltmeye neden olmaz; bağlantı/yerleşim kuralları korunur.

### P21 — senaryo dalları ve fiziksel etki analizi

- **Sorumlu:** domain/graph + UI. **Bağımlılık:** P07, P14, P20.
- **Dosya kapsamı:** `js/circuit-trace.js`, snapshot ve BOM adapterleri; yeni `scenario-engine.js`, `js/scenario-controller.js`.
- **İş:** baseline revizyondan dal; switch değiştirme/taşıma/kablo kaldırma adayları; U/port/malzeme/metraj farkı; belgelenmiş pasif geçişte bozulan fiziksel yollar. Ana proje apply öncesi korunur.
- **Çıktı:** iki alternatifin karşılaştırması ve tek işlemle uygulama.
- **Kabul:** A29–A30. Eksik graph kenarı unknown; canlı servis kesintisi iddiası yok; değişen ana revizyonla senaryo eski haliyle uygulanmaz.

## F5 — masaüstü ve entegrasyonlar

### P22 — Tauri SQLite repository

- **Sorumlu:** Rust/platform + persistence. **Bağımlılık:** P02, P04, P05.
- **Dosya kapsamı:** `src-tauri/Cargo.toml`, `src/lib.rs`, capability; yeni `src-tauri/src/project_repository.rs`, migrations ve frontend repository adapteri.
- **İş:** SQL eklentisi/alternatif Rust repository seçimi; SQLite transaction/migration; ek dosyası staging/reconciliation; aynı repository sözleşmesi ve browser↔desktop arşiv gidiş dönüşü. NetBox/Jev için native secret sağlayıcı sözleşmesi kur; anahtar proje/JSON/log dışında korunur. Sürüm uygun Rust toolchain seçilir.
- **Çıktı:** internet olmadan çalışan Windows proje arşivi.
- **Kabul:** A31, A06. DB/dosya commit ortası kapanma, migration kesintisi ve geçersiz arşiv; IDB ile semantic eşdeğer sonuçlar.

### P23 — Windows dağıtımı ve ürün kimliği

- **Sorumlu:** platform/release. **Bağımlılık:** P08, P16, P22.
- **Dosya kapsamı:** `src-tauri/tauri.conf.json`, Cargo/package version, `scripts/build-tauri.cjs`, ikonlar ve dağıtım dokümanı.
- **İş:** tutarlı isim/identifier/version; pencere davranışı; NSIS mevcut hedefiyle paket; WebView2 var/yok/offline dağıtım yolu; dar capability/CSP doğrulaması; upgrade ve geri dönüşte veri korunması. Portable seçenek yalnızca ayrı temiz makine testiyle etiketlenir.
- **Çıktı:** tekrar üretilebilir paket ve kurulum matrisi. İmzalama/güncelleme altyapısı birinci paket kabulünden sonra tanımlanır; imzasız paket imzalı diye sunulmaz.
- **Kabul:** A32, A43. Temiz Windows 11 x64'te aç/çiz/kaydet/kapat/aç/teslim; build başarısı kurulum kanıtı sayılmaz.

### P24 — NetBox salt-okunur içe alma

- **Sorumlu:** entegrasyon. **Bağımlılık:** P03, P10, P17; canlı credential taşıması için P22 veya P26. Anonim response fixture aşaması native/server transportu beklemez.
- **Dosya kapsamı:** yeni `js/integrations/netbox-adapter.js`, eşleme/gözlem controllerı; P22 native veya P26 sunucu credential adapteri.
- **İş:** kurulum adresi/izin kapsamı; site/rack/device/interface/cable adayları; pagination, rate/timeout/yeniden deneme; dış ID ve model/port eşleme; önizleme ve seçili gözlem import. Browser'da token frontend bundle'a konmaz; ilk bağlı pilot Tauri üzerinden yapılabilir.
- **Çıktı:** tekrar çalıştırılabilir içe alma ve fark paneli.
- **Kabul:** A33–A34, A13. Çoklu/eksik model eşlemesi review; yarım fetch tam envanter olarak kaydedilmez; bu paket NetBox'a POST/PATCH/DELETE yapmaz.

### P25 — Jev katalog sıralama pilotu

- **Sorumlu:** arama/AI + QA. **Bağımlılık:** P03, P17; canlı credential taşıması için P22 veya P26.
- **Dosya kapsamı:** aktif `js/catalog-ui.js`; yeni `js/integrations/catalog-reranker.js`, anonim sorgu değerlendirme fixture'ları ve backend endpoint/komut adapteri.
- **İş:** deterministik teknik filtre → mevcut aday shortlist → anlamsal uygunluk sıralaması; no-match; değerlendirme seti; süre/maliyet/cache/fallback. Katalog kaynakları soru state'ine dahil edilir; gizli müşteri topolojisi gönderilmez.
- **Çıktı:** açılıp kapanabilen özellik ve baseline karşılaştırma raporu.
- **Kabul:** A35–A36. Network yokken arama çalışır; aday kümesi dışında donanım özellikleri üretmez; geciken cevap değişen sorgu/kataloğa uygulanmaz. Ürün açma ölçütleri teknoloji belgesindedir.

## F6 — ekip çalışması

### P26 — firma/proje yetkili sunucu temeli

- **Sorumlu:** backend/platform. **Bağımlılık:** P03, P07, P11, P16.
- **Dosya kapsamı:** yeni `server/` projesi, tenant/project/ACL/command/revision/evidence endpointleri; ortak client repository portu.
- **İş:** backend/hosting/auth karar kaydı; firma izolasyonu; owner/designer/technician/viewer rollerinin eylem tablosu; sunucu revizyonu ve idempotent transaction; ek ve export erişimi; izleyici paylaşımı ve erişim iptali.
- **Çıktı:** iki ayrı firmayla sınanmış yetkili proje API'si.
- **Kabul:** A37. Kullanıcı-proje ve firma sınırı request/ek/export/WebSocket seviyesinde; yetki UI gizlemeye dayanmaz. Yerel kişi adı doğrulanmış kimlik yerine kullanılmaz.

### P27 — Yjs ile birlikte çalışma ve topoloji işlemleri

- **Sorumlu:** collaboration/backend. **Bağımlılık:** P26, P07, P20.
- **Dosya kapsamı:** yeni Yjs provider ve workspace adapterleri; server accepted-command yayını; ortak komut kapısı.
- **İş:** açıklama/annotation eşzamanlılığı, presence ve proje odaları; topoloji komutlarını sunucuda seri doğrulama; revision-aware istemci güncellemesi; yeniden bağlanma ve tekrar gönderimde idempotency.
- **Çıktı:** iki istemcinin aynı projede kontrollü çalışması.
- **Kabul:** A38, A40. Aynı U/port rekabetinde geçersiz ortak state oluşmaz; remote operasyonları undo ile silme engellenir. Yjs yakınsaması domain kabulünün yerine geçmez.

### P28 — çevrimdışı taslak ve çatışma çözümü

- **Sorumlu:** collaboration/persistence + UI. **Bağımlılık:** P04, P27.
- **Dosya kapsamı:** outbox, revision/diff adapteri, çatışma UI; server komut önkoşulları.
- **İş:** offline taslak/outbox; yeniden bağlanırken rebase; yerleşim/port/silinmiş nesne/yetki iptali çatışmaları; taslağı dış yedekleme; server kabulü sonrası yerel checkpoint.
- **Çıktı:** çakışma başına uygulanabilir seçimler ve gözlemlenebilir sync durumu.
- **Kabul:** A39–A40. Bekleyen taslak kabul edilmiş proje diye görünmez; ağ kopması/tekrar bağlanma veri çoğaltmaz; silinmiş nesne sessizce canlanmaz.

## F7 — pilot, sürüm ve destek

### P29 — gerçek saha pilotu

- **Sorumlu:** ürün/saha + QA. **Bağımlılık:** S1 için P00–P16; masaüstü için P22–P23; ekip için P26–P28.
- **Dosya kapsamı:** yeni `docs/product-plan/pilot-results.md`; anonim fixture ve tekrar edilebilir hata senaryoları.
- **İş:** hedef 3 kullanıcı ve en az 2 gerçek proje; mevcut yöntem ile hazırlama/uygulama/teslim süresini karşılaştır; QR/etiket/telefonda kanıt; hata ve kullanıcı yardımı sayısı. Kullanıcı/saha erişimi yoksa lab sonucu saha pilotu sayılmaz.
- **Çıktı:** ölçüm, görüşme notları, blocker ve ürün kararları. F3 sonrası erken çalışır; genişlemelerde yeniden yapılır.
- **Kabul:** A42. Veri kaybı blocker; bütün kritik görevler kullanıcı tarafından tamamlanır; ölçüm azsa sonuç sınırlı diye raporlanır.

### P30 — sürüm kapısı, kılavuz ve teşhis

- **Sorumlu:** release/QA. **Bağımlılık:** S1 için P00–P16 ve P29; S2 için ayrıca P17–P25; S3 için ayrıca P26–P28.
- **Dosya kapsamı:** build/release manifesti, ürün kılavuzu, release notes, aktif test raporu; isteğe bağlı teşhis dışa aktarma.
- **İş:** kaynak/üretim varlık fingerprintleri; eski proje açma; kurtarma; ilk kullanım; bilinen sınırlamalar; hata mesajları. Teşhis verisi yerel ve kullanıcı seçimiyle paylaşılabilir; müşteri topolojisi/secret varsayılan loga girmez.
- **Çıktı:** S1/S2/S3 için ayrı yayın adayı ve kanıt matrisi.
- **Kabul:** A41, A43. Bir kapının başarısızlığı diğer başarılı metriklerle kapatılmaz. Yayın/push bu plan yazımı kapsamında gerçekleştirilmez.
- **Sürüm kapanışı:** P30 yayın adayını hazırlar; P31 bakım kontrolleri ve G6 sonrası nihai sürüm kapanır. Bakım sırasında kaynak değişirse ilgili kapılar yeni fingerprint için tekrar yürütülür.

### P31 — veri yaşam döngüsü ve bakım

- **Sorumlu:** ürün/persistence/platform. **Bağımlılık:** P04, P16, P30; server retention için P26.
- **Dosya kapsamı:** repository retention/reconciliation, katalog güncelleme politikası, destek/backup dokümanı.
- **İş:** arşiv/geri yükleme/kalıcı silme; revizyon ve ek saklama limitleri; referanslı ekleri koruma; yedek geri açma tatbikatı; katalog güncelleme ve sonraki şema göçü prosedürü. Yerel, server ve dış teslim kopyalarının yaşam döngüsü ayrı açıklanır.
- **Çıktı:** sürdürülebilir bakım ve kullanıcıya anlaşılır veri yönetimi.
- **Kabul:** A44. Aktif referanslı ek temizlenmez; başarısız migration ham veriyi korur; kullanıcı dış yedeğini yeni ortamda geri açabilir.

## İlk uygulama oturumu için kesin sıra

1. P00 raporu ve mevcut hata listesi.
2. P01 aktif fixture/test envanteri.
3. P02 belge sözleşmesi; küçük fixture dönüşümüyle ilk uçtan uca kanıt.
4. P03 ortak işlem kapısı ve P04 repository; MoveDevice/ConnectCable/save/reopen dilimi.
5. P05 bütün maddi alanlarla 2D/3D gidiş dönüşü.
6. P06–P09 proje/arayüz/revizyon dilimi.
7. P10–P16 sahada kayıt ve dondurulmuş teslim; erken P29 pilotu.

F4/F5 paketleri yalnızca tabloda belirtilen bağımlılıklar sağlandığında başlar. Aynı kritik dosyanın veya şemanın sahipliği ayrılmadan eşzamanlı uygulama yapılmaz. P26–P28 için server hosting/auth kararını P26 çalışma başlangıcında netleştirmek yeterlidir; bu seçim yerel ürünün geliştirmesini durdurmaz.
