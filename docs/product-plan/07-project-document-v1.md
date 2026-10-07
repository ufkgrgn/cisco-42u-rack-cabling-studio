# Uygulanan proje belgesi v1

Bu belge çalışan veri katmanını tanımlar. Çoklu proje repository'si, komut kuyruğu ve saha iş akışları henüz eklenmedi.

## Dosyalar ve yükleme sırası

1. `js/2d/project-records.js`: kayıt ve ilişkilerin runtime doğrulaması.
2. `js/2d/project-document.js`: güvenli JSON okuma, legacy dönüşümü ve belge yakalama.
3. `js/2d/topology-io.js`: katalog, U yerleşimi ve port doğrulaması; state uygulama.
4. `js/2d/project-adapters.js`: 3D sahnesinin mevcut belgeye kayıpsız eşlenmesi.

Tür sözleşmeleri `js/2d/types/product.d.ts` içinde. Aktif modüllerin checkJs kapsamına alınması P03'te yapılacak; bu dosyanın varlığı tüm mevcut kodun tip denetiminden geçtiği anlamına gelmez.

## Belge

`schemaVersion: 1`, `projectId`, `revision`, `metadata`, `locations`, `topology`, `catalogContext`, `observations`, `fieldEvents`, `evidenceRefs`, `handoverRecords`, `integrationMappings`, `extensions` saklanır. Ek kök, cihaz, kabin, kablo ve uç alanları korunur. Topoloji, özel katalog ve yerel port kalibrasyonlarını içerir. Şema sürümü uygulama sürümünden bağımsızdır.

`revision` bu aşamada korunmuş bir veri alanıdır; monoton transaction sıra numarası olarak artırılması P03/P04'ün sorumluluğudur. Kamera hareketi belgeyi veya mevcut IndexedDB yazma sayısını değiştirmiyor.

Kayıtlar benzersiz `id` taşır. `projectId` belirtilmişse açık belgenin kimliğiyle aynı olmalıdır. Metin, zaman, entity reference, konum üst ilişkisi/döngüsü, saha test sonucu ve kanıt bağlantıları doğrulanır. Yerel geçmişte silinmiş cihazlara ait gözlem/test referansları korunabilir; `entityRef` tipi ve kimliği doğrulanır, tarihsel kayıt sırf cihaz artık yok diye silinmez.

Kayıtların yalnızca kimlik taşıyan taslak biçimleri uyumluluk için kabul edilir. `result`, `source`, `recordedAt`, `revision` gibi alanlar verilmişse tür ve sınırları denetlenir. Tamamlanmış saha olayının zorunlu alanları ve durum geçişleri P11'de komut/state machine üzerinden uygulanacak. Kanıt metadata'sının geçerli olması blobun mevcut olduğu veya saha sonucunun doğrulandığı anlamına gelmez.

## Sınırlar

- Proje JSON'u: 32 MiB UTF-8. Dosya sınırı okumadan önce, metin sınırı JSON parse öncesinde denetlenir.
- Maksimum veri derinliği: 64; en fazla 1.000.000 incelenen değer. Döngülü nesneler ve sonlu olmayan sayılar reddedilir.
- Her kayıt koleksiyonu: en fazla 50.000; konum zinciri: en fazla 64.
- Metin alanları: 2.000 karakter; kayıt notu: 64.000 karakter.
- Kanıt referansı: en fazla 20 MiB; JPEG/PNG/WebP/PDF/plain/CSV/JSON MIME türleri; varsa SHA-256 64 hex karakter.
- Kabloda eski uzunluk, tahmini, ölçülen ve satın alma uzunlukları ayrı korunur. Son üç alanda `null` bilinmeyen değerdir. Sıfır değer, eksik değer gibi ele alınmaz.

Arşiv paketleri, gerçek blob boyut/hash kontrolü ve disk/IDB bütünlüğü P04/P16 kapsamında; bu sınırlar henüz arşiv okuyucusu oluşturmaz.

## Migration tablosu

| Girdi | Dönüşüm | Kanıt |
|---|---|---|
| Sürüm etiketsiz tek kabin `devices/heightU` | `rack-1` altında kabin; katalog/kalibrasyon/ek alanlar korunur | Saf model testi |
| `version: 3.0.0` kabinli 2D JSON | Şema v1; eski kök ek alanları `extensions` içinde ayrıca korunur | Saf migration testi |
| `version: 4.0-studio` JSON | Şema v1 | Saf model ve aktif kurtarma testleri |
| Cihazın `observed` alanı | Plan alanları değişmez; ham gözlem ayrıca kaynaklı observation kaydına taşınır; eski cihaz alanı da korunur | Saf migration testi |
| Şema v1 | Kimlik/revizyon ve alanlar korunur; yalnızca doğrulama/kopyalama | Tam browser fixture |
| Bilinmeyen schemaVersion veya legacy version | Açık sürüm hatası; state ve ham kaynak değişmez | Model ve aktif browser reddetme testi |
| Native 3D `version: 3.2.0` | `StudioState.loadAutoSave` ortak adaptörle scene doğrular; boş proje de kabul edilir | Aktif browser kurtarma testi |
| Yeni snapshot | Tam `projectDocument` saklanır | Aktif browser snapshot/restore testi |
| Eski snapshot | Mevcut belgenin üst bilgisi korunarak eski racks/cables katmanı uygulanır | Eski biçim için uyumluluk yolu; eski snapshotta olmayan metadata geri üretilemez |

Birden fazla legacy kurtarma adayını seçtiren ekran ve idempotent depo geçişi P04'te yapılacak. Mevcut editör yeni IDB kaydını yeniden okuyup eşdeğerliğini doğrulamadan kurtarma anahtarını silmiyor. Snapshot quota hatasında önceki dayanıklı liste korunuyor.

## 2D/3D sınırı

Köprü ve 3D autosave aynı `ProjectAdapters.from3D` kullanır. Mevcut belge üst bilgisi, saha geçmişi, katalog bağlamı, ek referansları ve tanınmayan entity alanları yeniden oluşturulup atılmaz. Geçerli kaydedilmiş port kimliği kullanılır; kimlik yoksa yalnızca geçerli katalog indeksinin karşılığı seçilir. Hatalı veya dolu port için başka bir boş porta geçilmez. Dönüşüm bütünüyle reddedilir; görünüm geçişi ve açık proje korunur.

3D düzenlemesi ortak state'e uygulandıktan sonra mevcut editörün IDB kayıt yolu çalışır. Native 3D cache ve uyumluluk localStorage anahtarları tek transaction değildir; bunların konsolidasyonu P04 kapsamındadır. 3D `lastSaveError` başarısız cache kaydını saklar; IDB kayıt durumu mevcut editör göstergesinden izlenir.

## Test kanıtı

`tests/fixtures/product/project-rich-v1.json`: özel katalog, konum, asset/serial/IP/MAC, arka yüz, port ayarı, pasif eşleme, gözlem, saha olayı, ek referansı, teslim, dış kimlik, üç metraj türü ve bilinmeyen alanlar.

`npm run test:product`: saf validator/migration, gerçek IndexedDB recovery, on 2D/3D geçişi, 3D'de değişiklikten sonra yenileme, snapshot geri yükleme, kamera/domain ayrımı, belirsiz port reddi ve native boş/bozuk 3D recovery.

Bu testler P02/P05 veri koruma kapsamını doğrular. A01 proje oluşturma/hiyerarşi UI'si, A02 çoğaltma, tam A04 arşiv güvenliği ve A05–A07 repository/transaction kabulü henüz tamamlanmış değildir.
