# Doğrulama, pilot ve sürüm kapıları

Bu belgedeki A01–A44 **planlanan kabul senaryolarıdır**; çalıştırılmış test sonuçları değildir. Her sonuç source/build fingerprint, fixture kimliği, ortam, zaman ve kanıt dosyasıyla kaydedilir. P00 mevcut durumun gerçek başlangıç raporunu üretir.

## 1. Kanıt düzeyleri

1. **Kaynak/tip:** tip denetimi, aktif validator/komut/persistence kaynaklarının anlamlı testleri.
2. **Tarayıcı:** gerçek `index.html` modülleri, gerçek kullanıcı akışı, state ve çıktı karşılaştırması.
3. **Görsel/platform:** son değişiklikten sonra ekran, PDF/etiket renderı, temiz Windows kurulum ve gerçek dokunmatik cihaz.
4. **Saha:** gerçek kabin, etiket, test sonucu ve işi yapan kullanıcı gözlemi.

Birinci düzey dördüncü düzeyin yerine geçmez. Ayrı `src/` prototipinin testi aktif ürün test sayısına dahil edilmez. Sentetik benchmark gerçek donanımın bütün senaryolarda 60 FPS çalışacağını kanıtlamaz. Yerel etiketli kişi kaydı kurumsal kimlik doğrulama sayılmaz.

## 2. Kabul senaryoları

| ID | Girdi / işlem | Beklenen sonuç ve gerekli kanıt |
|---|---|---|
| A01 | Proje oluştur; müşteri/saha/kat/oda/kabin bağla; kapat/aç | Kimlik ve ilişkiler korunur, geçersiz hiyerarşi reddedilir; aktif browser + serializer |
| A02 | Özel cihaz/bağlantı/ek içeren projeyi çoğalt | Yeni proje ve iç entity kimlikleri; bütün referanslar yeni kopyaya bağlı; eski proje değişmez |
| A03 | Legacy, özel kataloglu, gözlemli ve ön/arka portlu fixture import/export | Sürüm göçü semantic eşdeğer; bilinmeyen yeni sürüm açık hata; değer/ID/ek referansı korunur |
| A04 | Bozuk JSON, geçersiz U/port, çakışan ID, fazla büyük arşiv | Açık proje değişmez; anlaşılır hata; raw kurtarma adayı korunur; yol taşması reddedilir |
| A05 | Aynı commandId iki kez; eski expectedRevision; toplu taşıma + undo | Tek commit, eski işlem reddi, tek geri-alma adımı; log/belge tutarlı |
| A06 | Commit/kurtarma sırasında kapat; quota/abort; iki sekme; açılırken düzenle | Son dayanıklı state veya açık taslak; yanlış başarılı kayıt yok; writer/revizyon çatışması görünür |
| A07 | İki projede metadata/ek/revizyon/görünüm düzenle ve arşivle | Proje izolasyonu; arşiv geri açılır; kaydedilmemiş çalışma korunur |
| A08 | Bütün maddi alanlarla on kez 2D↔3D; bir değişiklik ve kamera hareketi | Entity/port/özel katalog/saha/ek/proje kimliği korunur; kamera revizyon üretmez; browser |
| A09 | Baseline'dan cihaz taşı, kablo sil/ekle, metadata değiştir | Nesne/alan bazlı doğru fark; nesneye git; aynı nesne yanlış değişmiş sayılmaz |
| A10 | Adlandırılmış revizyonu geri yükle, legacy snapshot içe al | Seçili revizyonun tam kapsamı; geri dönüş undo edilebilir; yeni teslim/eski kanıt bağı bozulmaz |
| A11 | Üç çalışma görünümü × 2D/3D; 320/390/768/1440 px; klavye/dokunma | Kapanmayan/örtüşen kontrol yok; seçim/fokus/Escape tutarlı; kritik işlem metni; son CSS sonrası görsel |
| A12 | Mevcut projede ilk kullanım aç, atla, örnek tamamla, başka projede bookmark aç | Gerçek veri üzerine yazılmaz; örnek ayrı; yanlış projeye ait görünüm uygulanmaz |
| A13 | CSV/JSON tekrar import; eksik/çoklu eşleme; eski tarihli gözlem | Idempotent gözlem; kaynak/toplanma/alınma zamanı; belirsiz eşleme review; plan değişmez |
| A14 | Gözlemde farklı IP/model/port; bir farkı plana uygula | Fark önizlenir; yalnızca seçilen alan komutla değişir; eski gözlem korunur; kontrol yenilenir |
| A15 | Uygulama/etiket/test başarılı/başarısız; gerekçeli düzeltme; uç değiştir | Geçerli state machine, düzeltme geçmişi, test kapsamı ve yeniden test ihtiyacı; yanlış tamamlanma yok |
| A16 | Fotoğraf/test eki ekle; boyut/tür/hash hatası ve kayıt kesintisi | Kanıt doğru entity/revizyona bağlı; invalid/yarım ek tamamlanmış görünmez; orphan güvenli reconciliation |
| A17 | Basılan QR'ı gerçek telefonda oku; yanlış proje; kamera izni reddi | Doğru kabin/hat açılır; yanlış kimlik açık hata; elle giriş çalışır; foto/video veya gözlem notu |
| A18 | Önceden yüklenmiş saha ekranında ağ kes; işlem/yenileme/geri bağlan | Yerel kayıt/iş sırası korunur; tekrar olay yok; PWA güncellemesi açık; kabul edilmiş uzak veriyle ayrım |
| A19 | Seçilmiş revizyondan rapor/CSV/SVG/teslim üret; üretirken projeyi değiştir | Çıktı tek dondurulmuş revizyonla tutarlı; bütün kaynak/hedef/alan/karakterler doğru |
| A20 | Uzun isim ve çok sayfalı tabloyla A4 PDF/print | Başlık/altbilgi/sayfa kırımı okunur; clipping/kayıp/boş yanlış sayfa yok; PDF render + sayfa görselleri |
| A21 | Model/aksesuar/transceiver/kablo listesi; senaryo karşılaştır | Fixture beklenen adetleri; kablo tek sayılır; her satır kaynak nesnelere izlenebilir |
| A22 | Eksik, tahmini ve ölçülmüş metraj; standart boy/fire ayarı | Tahmin/ölçüm/satın alma ayrı; bilinmeyen metraj sayısal kesin toplamın içinde gizlenmez |
| A23 | İki uç etiketi, uzun ad, tanımlı baskı ölçüsü ve QR | Karşılıklı uçlar doğru; yüzde 100 ölçekte fiziksel boy; basılmış QR telefonda okunur |
| A24 | Teslim revizyonunu dondur; açık işleri ekle; paket yeniden import; yeni düzenle | Eski teslim değişmez; proje/ek/katalog/view manifesti tam; salt-okunur viewer düzenleme yapmaz |
| A25 | Kaynaklı/approximate/local-calibrated modeller; katalog güncelle | Doğrulama seviyesi ve tarih görünür; kullanılan model sürümü sabit; güncelleme farkla uygulanır |
| A26 | Bilinen uygun/uygunsuz/bilinmeyen modül, speed, media ve combo port | Deterministik allowed/blocked/unknown; ilgili kaynak/eksik veri; no silent reassignment |
| A27 | Bilinen PoE bütçesi, eksik tüketim, PDU/PSU bağlantıları | Kaynaklı birim/tüketim; eksik sıfır sayılmaz; taşma uyarısı ve çift sayım kontrolü |
| A28 | Kontrol panelinden hataya git, düzeltme önizle/uygula, tekrar kontrol | Kararlı issue; gerekçe/kaynak/fix; domain doğrulaması; düzeltme güncel state üzerinde |
| A29 | Revizyon dalında switch taşı/değiştir; ana projeyi değiştir; apply | Ana state önizlemede değişmez; fark doğru; eski baseline yeniden değerlendirilir; tek undo |
| A30 | Pasif panel yolu; kablo sil; döngü/eksik panel eşlemesi | Doğru belgelenmiş fiziksel etki; eksik bilgi unknown; canlı servis etkisi gibi sunulmaz |
| A31 | Aynı fixture IDB/SQLite; DB+ek commit arası kapat; archive transfer | Repository semantic eşdeğer; açılış reconciliation; bozuk arşiv atomik reddedilir |
| A32 | Temiz Windows 11 x64, WebView2 var/yok, internet yok; yükle/çalıştır | Kurulum matrisi; kayıt/kurtarma/teslim; imza ve portable durumu gerçek kanıtıyla |
| A33 | NetBox iki kurulum/saha; duplicate ad; model/port dış kimlik eşleme | İsim alanlı stable mapping; yanlış sahaya bağlama yok; review; yalnızca read HTTP işlemleri |
| A34 | NetBox pagination sırasında timeout/401/429/ağ kopması | Yarım sonuç tam envanter olmaz; kontrollü retry/cancel; token log/bundle/JSON'da yok |
| A35 | Etiketlenmiş TR/EN katalog sorguları; deterministik baseline vs Jev | Teknik filtre ihlali yok; Top-3/no-match/gecikme/maliyet raporu; hedef domain testi |
| A36 | AI yok/timeout; sorgu değişir; kaynak/model eksik; secret taraması | Normal arama çalışır; stale cevap uygulanmaz; no-match/unknown; UI/render loop etkilenmez |
| A37 | İki firma/iki proje ve owner/designer/technician/viewer rolleri | API/WS/ek/export'ta ACL; çapraz tenant/proje erişimi reddi; güçlü server kimliği |
| A38 | İki online istemci aynı U veya port için değişiklik yolla | Bir geçerli ortak revizyon; conflict bildirimi; tekrar gönderim idempotent; Yjs/domain ayrımı |
| A39 | Offline iki istemci çatışır; nesne silinir; ağ gider/gelir | Outbox taslağı korunur; rebase/çözüm görünür; gizli son-yazan topoloji veya nesne canlanması yok |
| A40 | Remote değişiklikten sonra local undo; yetki iptali; reconnect | Başkasının işlemi silinmez; iptal sonrası sync/erişim reddi; yerel kopya sınırı doğru anlatılır |
| A41 | Günlük aktif testler ve 1/10/100 kabin benchmark | Aktif kaynak sonuçları ve source hash; performans tabanı; prototype/sentetik sınırı açık |
| A42 | Hedef 3 kullanıcı, 2 saha projesi; tasarla/uygula/doğrula/teslim | Görevler kullanıcı tamamlar; veri kaybı yok; süre/yardım/hata ölçümü; saha kanıtı |
| A43 | Yayın adayı build/install; eski belge aç; upgrade/recovery; geri dönüş tatbikatı | Tek sürüm manifesti; veri korunumu; sınırlamalar/kılavuz; yedeklenmeden downgrade yok |
| A44 | Arşiv/retention/ek temizliği/kalıcı silme; dış yedek yeni ortamda aç | Referanslı kanıt korunur; migration hatasında ham yedek; bakım logunda secret/topoloji yok |

## 3. Test fixture ve ölçüm sınırları

P01 manifesti en az şu kategorileri içerir: küçük 1-kabin proje; 10-kabin saha; 100-kabin sentetik veri; custom catalog; gözlem geçmişi; ön/arka ve combo port; pasif panel geçişi; belirsiz/missing eşleme; bozuk/oversized/new-version giriş; çoklu proje; kanıt ekleri. Çalışma süresi kısıtı bütün kabul alanlarını tek büyük teste sıkıştırma gerekçesi değildir.

Performans için P00 aynı donanım/tarayıcı/build/girdiyle p95 frame, input latency, commit süresi ve bellek tabanını alır. Her değişiklik için ilgili senaryo tekrarlanır. İlk hedef aynı fixture'da p95 gecikmede yüzde 10'dan fazla ve bellekte yüzde 15'ten fazla artış olmamasıdır; bunlar kabul hedefidir, mevcut ürün sonucu değildir. Ölçüm oynaklığı varsa tekrar sayısı/median ve belirsizlik raporlanır. Ağ/AI bekleme süresi renderer ölçümünden ayrı tutulur.

## 4. Mevcut komutlar

`package.json` üzerinden 6 Ekim 2026'da doğrulanan komutlar:

```powershell
npm run check
npm test
npm run test:unit
npm run test:browser
npm run test:visual
npm run test:performance
npm run test:all-unit
npm run build
npm run tauri:build
```

- `npm test`: aktif unit → browser → visual. `test:legacy` browser komutunun aliasıdır.
- Mevcut `test:unit` yalnızca iki seçili aktif test dosyasını çalıştırır; yeni ürün testlerini kendiliğinden keşfettiği varsayılmaz. P01 bu listeyi/günlük kapıyı bilinçli genişletir. `test:all-unit` prototip ve eski kopya/maket testleri içerir; ayrı raporlanır.
- `npm run check` ve build icon/stencil/3D/dağıtım varlıkları üretebilir. Başlamadan mevcut diff kaydedilir; sonrasında yalnızca görevle ilgili üretim değişiklikleri değerlendirilir.
- `js/src/3d/` veya ikon üretici kaynağı değişince browser/visual öncesi `npm run bundle` gerekir. Bu kaynak değişmediyse aynı build gereksiz tekrarlanmaz.
- Saf plan dokümanı değişikliğinde link/ID/diff kontrolü yeterlidir; ürün testleri koşulmuş gibi raporlanmaz.

P03'te eklenecek, **şu anda mevcut olmayan** tip kapısı:

```powershell
npx tsc -p tsconfig.active-product.json --noEmit
```

Yeni test dosyası için hedefli Vitest/browser komutu P01'de fixture ve yol kesinleşince yazılır. Bir paketin testi kopya işlev uygulamasını sınayarak kapanmaz.

## 5. Kapılar ve tamamlanma

| Kapı | Kapanması için gereken | Engel |
|---|---|---|
| G0 — başlangıç | P00/P01 raporu; current failure ve fixture listesi | Aktif/prototip belirsizliği, bilinmeyen veri formatı |
| G1 — ortak veri | P02–P06 ve A01–A08 | Kayıpsızlık, atomiklik, kimlik veya bridge hatası |
| G2 — yerel saha dilimi | P07–P16, A09–A24 | Yanlış saha tamamlanma, eksik teslim, okunamayan etiket |
| G3 — teknik genişleme | P17–P21, A25–A30 | Kaynaksız kesin sonuç, yanlış senaryo/uyumluluk |
| G4 — bağlı platform | P22–P25, A31–A36 | Kurulum/kurtarma, dış eşleme, fallback veya secret hatası |
| G5 — ekip | P26–P28, A37–A40 | ACL açığı, geçersiz ortak topoloji, offline veri kaybı |
| G6 — yayın | P29–P31, A41–A44 ve hedef sürümün önceki kapıları | Veri kaybı, tamamlanmayan kritik görev veya açıklanmayan sınırlama |

S1 G0/G1/G2 + ilgili G6; S2 buna G3/G4; S3 buna G5 ekler. AI özelliği değerlendirme hedefini tutturamazsa P25 deney raporu kapanabilir, fakat ürün özelliği kapalı kalır ve “başarılı entegrasyon” diye sunulmaz. Veri/kimlik/ACL hataları pazarlama veya görsel iyileşmeyle telafi edilmez.

## 6. Pilot ölçümü

P29'da mevcut Excel/Visio/manuel yöntem ve Rack Studio için aynı iş kapsamı kaydedilir: hazırlama süresi, saha farkını çözme süresi, teslim hazırlama süresi, hata ve yardım sayısı. Görev başarısı ve veri doğruluğu esas kabul koşuludur. Yüzde 20 zaman azalması değerlendirme hedefidir; sağlanmış sonuç değildir. Az sayıda kullanıcıdan genel pazar veya bütün ekipler için hız iddiası çıkarılmaz.

En az bir güncel gerçek telefon/tablet; en az bir temiz Windows ortamı; basılmış etiket ve gerçek kabin gözlemi gerekir. Fotoğraf/müşteri verisi rapora yalnızca yetkili ve gerektiği kadar alınır; paylaşılacak fixture anonimleştirilir. Saha erişimi sağlanamazsa ilgili senaryolar bekleyen saha doğrulaması olarak kalır; laboratuvar sonuçlarıyla kapanmaz.

## 7. Teslim notu ve değişiklik disiplini

Her paket notu şu alanları taşır: paket ID/durum, kaynak fingerprint, değişen dosyalar, komutlar ve sonuçları, A senaryoları ve kanıtı, ortam sınırı, bilinen hata, sonraki bağımlı paket. Tamamlandı etiketi uygulama ve gereken kanıt sağlandığında verilir.

Plan kapsamını uygulamak mevcut kullanıcı dosyalarını temizlemek, eski testleri topluca silmek, müşteri verisini dış servise göndermek, yayımlamak veya GitHub push yapmak için otomatik talimat değildir. Bunlar uygulama aşamasındaki gerçek istek ve mevcut yetki kapsamına göre yapılır. Geliştirme sırasında reversible yerel çalışma ve gerekli kontroller için tekrar tekrar onay akışı açılmaz.
