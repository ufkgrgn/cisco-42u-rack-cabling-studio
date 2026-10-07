# P03 — ortak komut kapısı

İlk uygulama dilimi `MoveDevice` ve `ConnectCable` işlemlerini aktif 2D arayüzden ortak kapıya taşır. Yeni modül `project-commands.js`, belge/adaptör/topology modüllerinden sonra ve editor'dan önce yüklenir. Tür sözleşmesi `types/product.d.ts`; aktif JavaScript denetimi `npm run check:product` ile ana `check` komutuna dahildir.

## Çağrı ve doğrulama

`ProjectCommands.begin()` eski editör değişikliklerini kayda geçirir ve `commandId`, `projectId`, `expectedRevision`, `expectedContent` üretir. `execute({...envelope, type, payload})` eşzamanlı hazırlanır/doğrulanır/uygulanır; tekrar giriş engellenir. Bekleyen onay sırasında değişen eski yazma yollarını da yakalamak için revizyona ek olarak içerik karşılaştırılır. Reddedilen komut yeni değişiklik veya kayıt üretmez.

Taşıma komutu hedef kabindeki ardışık hareketlerin tamamını içerir; tek undo adımıdır. Kabinler arası taşımada kablo uçlarının rackId alanları da güncellenir. Bağlantı komutunda kablo ve uç cihazların port ayarları aynı taslakta hazırlanır. Eksik/dolu port, çift kablo kimliği, U çakışması ve ağ kuralları, bütün belge üzerinde uygulamadan önce doğrulanır. Kullanıcının kamera konumu korunur.

Başarılı komut revizyonu bir artırır. Aynı kimlik ve içerik ikinci kez uygulanmaz; farklı içerikle aynı kimlik reddedilir. Makbuzlar `extensions.rackStudioCommandReceipts` içinde saklanır, geri alma ile silinmez ve mevcut yerel kayıt üzerinden yenilemeden sonra da okunur. Kapasite 10.000 makbuzdur; kayıtlar sessizce atılmaz. Belgenin 32 MB sınırı da geçerlidir. Undo/redo önceki içerikleri yeni revizyona taşır. Aynı projedeki eski editör değişiklikleri de revizyonu artırır; kamera, görünüm ve türetilen yerleşim alanları artırmaz. 3D adaptörü canlı belgenin revizyonunu ve makbuzlarını korur.

Sonuç `status: localDraft` döndürür. Bu, yerel bellekte kabul anlamındadır; IndexedDB transaction taahhüdü değildir. Mevcut editör kayıt kuyruğu başarı durumunu ayrıca gösterir. Görsel yenileme hatası kabul edilmiş domain işlemini reddedilmiş gibi göstermez; kayıt tetiklenir ve sonuçta `renderingWarning` döner. Kalıcı komut günlüğü, ortak transaction ve sekmeler arası yazma sahipliği P04 kapsamındadır.

## Mevcut yazma yollarının geçiş listesi

| Yol | Bu dilimdeki durum | Sonraki geçiş |
|---|---|---|
| Tek cihaz taşıma ve beraberindeki smart ripple | MoveDevice kapısında | P04 repository transaction |
| Etkileşimli port bağlantısı, otomatik/miras port config | ConnectCable kapısında; onay öncesi yalnızca kopyalar değişir | P04 repository transaction |
| Undo/redo | Mevcut editör history uyumluluk adaptörü; revizyon ve makbuz korunur | Kalıcı accepted-command history |
| Cihaz ekleme/kopyalama/silme, U boşluk, çoklu seçim | Mevcut yazma yolu; editör revizyon adaptörü ve bekleyen komutta içerik kontrolü | Ayrı command türleri, toplu tek commit |
| Kablo silme/renk/metadata, port ve cihaz metadata editörleri | Mevcut yazma yolu; aynı uyumluluk adaptörü | Ayrı command türleri |
| Import, preset ve snapshot restore | Bütün belge doğrulaması; mevcut load yolu | ReplaceProject/RestoreSnapshot ve proje deposu |
| 3D düzenleme/native history | Kayıpsız adaptör; canlı revizyon/makbuz koruması | P05 ortak komut kapısı entegrasyonu |

Bu liste bütün eski yazıcıların taşındığı anlamına gelmez. Yeni domain özellikleri mevcut kapıyı genişletmeli; bağımsız kayıt yolu eklememelidir.

Sonraki uygulama dilimleri: P05 `ApplyTopology` ile 3D düzenlemelerini ortak kapıya taşır (10-shared-3d-workflows.md); P06 `UpdateProjectDetails` ile metadata/konum/kabin ilişkisini doğrular (11-project-management.md); P07 `RestoreProjectDocument` ile aynı projenin tam belgesini mevcut makbuzları ve monoton revizyonu koruyarak tek undo adımında geri yükler (12-project-revisions.md). Yukarıdaki tablo P03 tesliminin tarihsel kapsamıdır.

## Kanıt

- `project-commands.test.cjs`: gerçek Edge üzerinde stale revizyon, kayda geçmemiş legacy değişiklik, farklı proje, aynı ID/farklı içerik, U çakışması, dolu port ve port-config atomik reddi; iki cihazın tek undo/redo adımı; revizyon monotonluğu; makbuzların reload ve 2D/3D geçişi sonrası korunması.
- Var olan editör/tablet/Pixi/köprü testleri gerçek UI yollarını denetler. İlk tam koşu, komut sonrası yeniden kadrajlama hatasını yakaladı; render kapısı kamerayı koruyacak şekilde düzeltildi.
- Son çıktılar `results/commands-check-final.log`, `results/commands-full-tests-final.log`, `results/commands-performance-100.json` içindedir. Bu kontroller yerel headless tarayıcı doğrulamasıdır; saha/pilot kanıtı ayrı tutulur.

P04 güncellemesi: ortak kalıcı kayıt deposu, `result.committed` ve geçerli kurtarma/yedek sözleşmesi için [09-project-repository.md](09-project-repository.md) dosyasına bakın. Yukarıdaki ilk dilim açıklamasının transaction/depo bekleme durumu bu belgeyle ilerletilmiştir.

P05 ilk dilimi: 3D sahne düzenlemeleri `ApplyTopology` komutuyla yalnızca mevcut projenin topolojisini değiştirir; belge başlığı ve saha kayıtları canlı belgeden korunur. Cihaz/port/kablo işlemleri ve preset içindeki iç içe çağrılar tek komutta birleşir. Yeni/değişen bağlantılar ağ kurallarından, tamamı yerleşim doğrulamasından geçer. Eski sahne reddedilince canlı belge sahneye yeniden yansıtılır. 3D undo/redo ortak editör geçmişini kullanır; projeksiyon yüklemeleri komut veya undo adımı oluşturmaz. Native JSON import/export ve doğrudan UI yazıcılarının son geçişi henüz açık.

P05 tamamlama dilimi: dosya, metadata/port formu, toplu sökme, IDF/MDF ve yerel katalog yazıcıları için güncel sözleşme ve kabul kanıtı [10-shared-3d-workflows.md](10-shared-3d-workflows.md) içindedir. Yukarıdaki ilk dilimin açık import/export maddeleri bu dilimle tamamlandı. İçe aktarım mevcut projeye gizli yazma yerine depo üzerinden bağımsız proje açar; aynı kimlikli belge ayrı kopyadır.
