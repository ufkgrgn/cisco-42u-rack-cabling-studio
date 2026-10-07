# Ürün kapsamı ve ekran akışları

## 1. Hedef kullanıcı ve ana iş

İlk hedef teknisyen, küçük IT ekibi ve entegratördür. Kullanıcı bir müşteri/saha projesi oluşturur; mevcut şablon veya katalogla kabinleri düzenler; bağlantıları planlar; saha uygulamasını kaydeder; farkları inceler ve adlandırılmış bir revizyonu teslim eder.

Kurumsal kullanıcı aynı projeye NetBox verisi bağlar ve ekip erişimi tanımlar. İlk ürünün yerel çalışma akışı bu servislerden bağımsızdır.

## 2. Konuşmadaki önerilerin kapsam karşılığı

| Öneri | Kullanıcıya sunulacak davranış | Paketler | Kabul |
|---|---|---|---|
| Proje dosyası ve hiyerarşi | Müşteri, saha, bina/kat/oda ve kabin bağları; proje sorumlusu/durum/tarih | P02, P04, P06 | A01–A08 |
| Revizyon geçmişi | Adlandırılmış revizyon, açıklama, nesne/alan farkı, geri dönüş | P07 | A09–A10 |
| Planlanan/uygulanan/doğrulanan | Plan verisi, kaynaklı gözlem ve saha işlem geçmişi ayrı görünür | P10–P11 | A13–A16 |
| Telefon/tablet saha erişimi | QR kimliği, bağlantı uçları, büyük işlem alanları, çevrimdışı sıra | P08, P12 | A11, A17–A18 |
| Tek işlemle teslim paketi | Kabin görünümü, çizelge, envanter, malzeme, etiket, açık işler | P13–P16 | A19–A24 |
| Kaynaklı katalog | Üretici/model/veri kaynağı/tarih ve doğrulama seviyesi | P17 | A25 |
| Açıklayan teknik denetimler | İhlalin nedeni, dayanağı, eksik bilgi ve uygulanabilir düzeltme | P18–P20 | A26–A28 |
| Alternatif tasarım ve etki | Senaryo dalı, fiziksel yol farkı, malzeme/yerleşim karşılaştırması | P21 | A29–A30 |
| NetBox bağlantısı | Salt okunur içe alma, dış kimlik eşleme, gözlem/fark önizlemesi | P24 | A33–A34 |
| Tasarım/saha/sunum görünümleri | Aynı proje üzerinde işe göre araç görünürlüğü | P08 | A11 |
| Tutarlı sağ panel | Cihaz/port/kablo bilgisi, kaynak ve işlemler aynı seçim yüzeyinde | P08 | A11 |
| Kısa ilk kullanım | Ayrı örnek proje üzerinde yönlendirme; kullanıcı verisi korunur | P09 | A12 |
| TypeScript ve ortak işlem modeli | Aktif kaynaklarda tip denetimi; tek doğrulanmış işlem akışı | P02–P03 | A03–A05 |
| IndexedDB geliştirmesi | Çoklu proje, revizyon, ek dosya, kurtarma ve dış yedek | P04 | A04–A06 |
| Tauri/SQLite | Aynı sözleşmeyle Windows yerel arşivi ve dosya yönetimi | P22–P23 | A31–A32 |
| TypeSafe/Jev | Mevcut katalog adaylarının anlamsal sıralanması | P25 | A35–A36 |
| Yjs ve ekip çalışması | Eşzamanlı açıklamalar, farkındalık ve doğrulanmış ortak işlemler | P26–P28 | A37–A40 |
| Güvenilir ürün sürümü | Aktif testler, gerçek saha pilotu, sürüm ve destek verisi | P00–P01, P29–P31 | A41–A44 |

## 3. Ekran düzeni

### Projeler ekranı

Arama ve son düzenleme sırasıyla proje listesi; müşteri/saha/durum filtreleri; oluştur, aç, çoğalt, arşivle, yedekle. Kartta son dayanıklı kayıt zamanı ve son teslim revizyonu gösterilir. Arşivleme geri alınabilir; kalıcı silme ayrı bir eylemdir. Kaydedilmemiş çalışma varken proje değiştirmenin sonucu görünürdür.

### Tasarım görünümü

Solda donanım kütüphanesi ve saha/kabin ağacı, ortada 2D/3D sahne, sağda seçili nesnenin paneli. Üstte proje adı, çalışma/teslim durumu, kayıt bilgisi ve görünüm seçimi. Bağlantı çizelgesi açılır bir alt yüzeydir. 2D ve 3D seçimi çalışma görünümünden ayrıdır; sunum veya saha görünümü proje verisini dönüştürmez.

### Saha görünümü

Kabin ve bağlantı araması, sıradaki iş ve kaynak/hedef uç bilgileri öndedir. Durum işlemleri tek elle erişilebilir; kurulumu kaydet, etiketi doğrula, test sonucu ekle. Fotoğraf/not ekleme aynı iş kaydına bağlıdır. Kamera izni yoksa elle kimlik girişi ve listeden seçme çalışır. Çevrimdışılık, bekleyen yerel kayıt ve paylaşılan revizyon ayrı gösterilir.

### Sunum görünümü

Düzenleme araçları gizlenir; temiz 2D/3D görünüm, kayıtlı açılar, revizyon açıklaması ve çıktı eylemleri görünürdür. İlk sürümde yerel sunumdur. Dışarıya verilen çevrimdışı izleyici yalnızca seçilmiş teslim revizyonunu içerir; hesaplı paylaşım S3'te proje yetkileriyle gelir.

### Ortak nesne paneli

Kimlik ve konum; planlanan/gözlenen farkları; teknik özelliklerin kaynakları; saha durumu; bağlı devre; revizyon geçmişi. Bölümler gerektikçe açılır. Kritik teknisyen işlemlerinin görünür metinleri vardır. Renk tek başına tür veya durum anlatmaz; etiket/simge/metin birlikte kullanılır.

### İlk kullanım ve yardım

Kullanıcı örnek projede bir cihaz yerleştirir, bağlantı oluşturur, saha durumu ekler ve teslim önizler. Yönlendirme atlanabilir ve yeniden açılabilir. Örnek proje gerçek projeden ayrı kimlik taşır. Boş ekranlar bir sonraki somut işlemi anlatır.

## 4. Saha ve teslim semantiği

- Kablo işi için adımlar: planlandı, uygulandı, etiket doğrulandı, test sonucu kaydedildi. Test sonucu başarılı/başarısız/değerlendirilemedi olarak tutulur; sonuç dosyası tek başına otomatik başarılı yapmaz.
- Geriye alma geçmiş kaydı silmez; gerekçeli düzeltme olayı ekler. Yerel kişinin adı, kurumsal doğrulanmış kullanıcı kimliği gibi sunulmaz.
- Projenin teknik tamamlanması ile müşterinin teslim kabulü ayrı alanlardır. Teslim kaydı belirli bir revizyona bağlanır; sonraki düzenleme o teslimi değiştirmez.
- Planı bir gözlemle güncelleme işlemi fark önizlemesi ve kullanıcı seçimiyle yapılır. Yeni gözlem eski gözlemi korur. Gözlem zamanı, alınma zamanı ve kaynak ayrı saklanır.
- Port/model/uç değişikliği daha önceki testin güncel revizyon için yeterli olup olmadığını yeniden değerlendirir. Eski test kaydı korunur ve gerekirse yeniden test işi açılır.
- Kablo uzunluğu: tahmini güzergâh, saha ölçümü ve satın alınacak standart boy ayrı kavramlardır. Kaynaksız uzunluk toplamı tamamlanmış metraj olarak gösterilmez.

## 5. Kapsam sınırları

P21 fiziksel devre ve belgelenmiş bağımlılık etkisini gösterir. Trafik yönlendirme, STP davranışı veya gerçek uygulama kesintisi sonucu ancak ayrıca modellenmiş veri ile değerlendirilebilir; bu plan tam ağ simülatörü kurmaz.

P19 bilinen güç/PoE verileri üzerinden kapasite bütçesi kontrolüdür; saha elektrik ölçümü veya termal simülasyon sertifikası değildir. Eksik tüketim/mesafe/uyumluluk verisi belirsiz olarak işaretlenir.

P24 ilk sürümde NetBox'u değiştirmez ve cihazlara otomatik komut göndermez. İleri bir yazma entegrasyonu ayrı kapsam ve uzlaşma akışı gerektirir. P25 mevcut adayları sıralar; katalog özellikleri veya fiziksel uyumluluk üretmez.

Ürün adı için plan boyunca “Rack Studio” kullanılır. P23 sürüm paketindeki isim, uygulama kimliği, ikon, versiyon ve üretici katalog adlarını tutarlı hale getirir; nihai ticari ad bu belgenin teknik bağımlılığı değildir.
