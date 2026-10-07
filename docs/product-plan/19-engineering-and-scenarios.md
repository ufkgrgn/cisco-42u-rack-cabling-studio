# P17–P21 — kaynaklı mühendislik ve senaryolar

7 Ekim 2026. Araç menüsündeki **Gelişmiş işlemler → Mühendislik** ve **What-if** aynı proje belgesini kullanır. Proje denetimi ortak sonuçları önem derecesine göre filtreler ve nesneye gider.

## P17: kaynak ve model sürümü

Pilot veri paketi Cisco C9200L-24P-4G, HPE Aruba JL677A ve yerel Generic 24-port panel içerir. Her modelde üretici/SKU, modelVersion, kaynak başlığı/adresi/tarihi, teknik ve fiziksel doğrulama seviyeleri vardır. Teknik belgeden alınan alanlar fiziksel port konumunun doğrulandığı anlamına gelmez. Generic şablon üretici sertifikası değildir.

Kaynaklı modeller yüklenirken veya monte edilirken `catalogContext.models[key].definition` içine sabitlenir. Eski, kaynağı eksik modeller **Kullanılan modelleri sabitle** önizlemesiyle de dondurulabilir. Global katalog tabanı ve aktif proje tanımları ayrıdır; başka proje açılırken aktif projeye ait tanımlar temizlenir. Kaynaklı projeyi yeniden açmak port sayısı/kimliğini yeni global sürüme taşımaz. Güncelleme; model JSON dosyası/ileri düzey tanım → alan farkı → tüm bağlantı ve yerleşim denetimi → tek komut şeklindedir. Kullanılan port silinmesi veya U çakışması reddedilir.

Rapor modeli de kullandığı tanımları aynı katalog bağlamına sabitler. Yerleşik modeller `customCatalog` güvenlik sınırına sokulmaz; JSON, named revision ve teslim paketi kendi model sürümünü taşır. Önceki port geometrileri ve yerel kalibrasyonlar korunur.

## P18: üç durumlu uyumluluk

`EngineeringCompatibility.assess(document,cable)` sonuçları **allowed / blocked / unknown** verir; kaynaklar ve açıklamalar sonuçla birlikte taşınır. Kontrol edilen alanlar port kafesi, açıkça desteklenen kafesler, modül yuvası/listesi, takılı transceiver, host destek politikası, konnektör, ortak hız, kablo ortamı, combo grubu ve kayıtlı fiber mesafedir. Kaynaksız teknik profil kesin sonuç üretmez. Eksik modül destek listesi veya host matrisi bilinmiyor kalır; açık destek dışı üretici ihlaldir.

Transceiver seçimi ve PoE talebi cihaz/port formundan yapılır. Yeni yerel transceiver tanımı `catalogContext.transceivers` içinde `model,manufacturer,cage,connector,speedsMbps,media,maxDistanceMeters,source` ile taşınabilir. Takılı modüller `device.modules[] = {slotId,model}`; kaynaklı model yuvaları `engineering.moduleSlots[] = {id,allowedModels,source}` olarak tutulur. Combo portlar `port.engineering.comboGroup` ile aynı fiziksel kaynağa bağlanır.

Pilot Cisco SFP-10G-SR profili OM3/OM4 mesafe sınırlarını, SFP-10G-LR profili single-mode sınırını içerir. OS2 etiketinin G.652 tek mod sınıfına eşlenmesi tasarım varsayımıdır; kablonun gerçekten bu sınıfta olduğunun saha kanıtı değildir. Bu Cisco modülleri için Aruba host uyumluluğu iddia edilmez; Aruba'nın destek politikası kaynakla gösterilir. Diğer host/SKU/firmware matrisi eksikse bilinmiyor kalır. Kafes fiziksel olarak otursa bile bu tek başına host desteği değildir.

Klasik NetworkRules planlama API'sinde `allowed` boolean'ı bağlantının editörde yapılabilmesini ifade eder. Fiziksel uyumluluk sonucu ayrıca `status` ile taşınır; `allowed:true,status:unknown` doğrulanmış uyumluluk değildir. Mevcut elektriksel izolasyon ve loop kuralları korunur.

## P19: PoE, PSU ve PDU

PoE toplam/per-port kapasiteleri yalnızca kaynaklı profilden alınır. Port formunda talep watt, kaynak, referans ve tarih girilir. Boş değer bilinmiyor; açık sıfır sıfırdır. Kaynaklı per-port veya toplam aşımı ihlaldir. Bir tüketicinin birden çok port/besleme bildirimi otomatik iki yük yapılmaz; belirsiz paylaştırma olarak gösterilir.

`device.powerPlan.consumption = {watts,kind,source}`; kind `planned`, `typical` veya `nameplate`. Türler ayrı toplamlanır. `powerPlan.feeds[] = {group,pduDeviceId,cableId,psuSlotId?}` A/B bildirimi taşır. Gerçek güç kablosu/portu bulunmadan bağlantı doğrulanmış sayılmaz. Karışık tüketim türleri PDU toplamında bilinmiyor bırakılır. A ve B ayrı tam yük planı olarak incelenir; genel tüketim cihaz başına bir kez sayılır.

`device.psus[] = {slotId,model,capacityWatts,source}` açık PSU kayıtlarıdır. Aynı slot tekrar sayılmaz. PSU kapasitesi, cihaz tüketimi veya PoE bütçesine eklenmez. PDU kapasitesi kaynaklı `model.engineering.power.capacityWatts/source` alanından gelir. Amper/kVA'dan güç faktörü/gerilim varsayımıyla watt türetilmez. Eksik değerlerin sayısal uyumluluğu bilinmiyor kalır.

3D kayıt projeksiyonunda kaynaksız varsayılan 150 W yerine bilinmiyor gösterilir. Kaynaklı tüketim türü mühendislik ekranında açıklanır; elektriksel tüketimden ısı yayılımı otomatik hesaplanmaz. Gerçek enerji veya PoE ölçümü yapılmaz.

## P20: denetim ve düzeltme

Mühendislik sonuçları `issueId,code,severity,status,affectedEntity,source,basis,fixCandidates` taşır. Stable kimlik kontrol türü ve nesneye bağlıdır; açıklama değişebilir. Bilinmeyen veri ihlalden ayrı görünür. Sonuç temeli belge ve kullanılan katalog/transceiver tanımlarını içerir. Proje veya global kaynak değişince açık denetim eskir; düzeltme için yeniden denetim gerekir.

Sunulan deterministik düzeltmeler kullanılan tanımları sabitleme ve ihlalli kabloyu kaldırmadır. Düzeltme düğmesi ana projeyi değiştirmez; mühendislik ekranında alan farkını ve bütün sonuçları açar. Uygulama `ApplyEngineeringChange` komutuyla yapılır; yeni ihlal reddedilir, yeni bilinmeyen durum açıkça kabul edilmelidir. Eski, zaten mevcut sorunlar kaybolmuş gibi gösterilmez. U çakışması, kayıp uç, dolu port, loop ve elektriksel izolasyon tekrar kontrol edilir. Sunum modu değişiklik yapamaz.

## P21: iki alternatif

Güncel veya adlandırılmış revizyondan A/B dalları oluşturulur. Dal işlemleri `removeCable`, `moveDevice` ve `replaceSwitch` olarak kaydedilir. Switch değişiminde bağlı her port için açık, tekil eşleme gerekir; uyuşmayan/dolu port reddedilir. Eski PSU ve tüketim tanımı yeni switch'e taşınmaz. Cihaz taşıma, ilgili tahmini metrajı yeniden hesaplama bekleyen bilinmeyene çevirir; eski ölçüm verisi ölçüm olarak korunur.

Karşılaştırma U, port kapasitesi, malzeme satır/miktarları, ayrı metraj bilinen/bilinmeyenleri, belge alan farkları ve fiziksel yolları gösterir. Pasif yol sadece açık `passThroughPairs` (`a/b` veya `from/to`) ve gerçek kablo uçları üzerinden izlenir. Eksik kenar/eşleme veya döngü bilinmiyor kalır. Bu analiz canlı servis kesintisi/iletişim başarısı iddiası taşımaz.

Dal ana projeyi değiştirmeden named revision olarak kaydedilir ve tam proje yedeğine girer. Kalıcı `scenario` kaydı taban belgesi, ana içerik/revizyon temeli ve işlem listesini taşır; yeniden hesaplanan aday kayıtla uyuşmalıdır. Ana revizyon/içerik değişmişse uygulama reddedilir. Seçilen dal, yalnızca topology/catalogContext alanlarını tek komutla uygular; saha/teslim geçmişi korunur. 2D/3D aynı projeyi gösterir; undo tek adımda geri alır. 500 işlem ve mevcut 100 adlandırılmış revizyon sınırları uygulanır.

## Kaynaklar ve kanıt sınırı

Kontrol tarihi: 7 Ekim 2026. Belgeler uygulamada bağlantı olarak tutulur; tam üretici dokümanları projeye kopyalanmaz.

- [Cisco Catalyst 9200 datasheet](https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9200-series-switches/nb-06-cat9200-ser-data-sheet-cte-en.html): pilot port/PoE bilgisi ve varsayılan güç kaynağı bağlamı.
- [HPE Aruba 6000/6100 Installation Guide](https://www.arubanetworks.com/techdocs/hardware/switches/6100/IGSG/igsg_6000-6100.pdf): JL677A, PoE ve SFP/SFP+ destek politikası; fiziksel çizimler üretici doğrulaması yerine geçmez.
- [Cisco 10GBASE SFP+ datasheet](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-455693.html): modül konnektör/optik/mesafe profilleri.

Yerel otomasyon kabulü A25–A30'un yazılım davranışlarını kapsar. Gerçek switch/transceiver/PSU/PDU, fiziksel kablo sınıfı, enerji ölçümü, ekran okuyucu ve dokunmatik cihaz pilotu henüz yapılmadı. Üretici kaynaklı sınırlı pilot alanlar tüm katalog modellerinin doğrulandığı anlamına gelmez. Geniş model/firmware destek matrisi açık veri çalışmasıdır.

Doğrulama sonuçları ve test günlükleri: `results/p17-p21-*.log`; görüntüler ve sentetik raporlar `results/p17-p21/`. Testler `tests/engineering-scenarios.test.cjs`; çalıştırma `npm run test:engineering`. Bu paket ayrıca `npm test` ve `npm run check` akışına eklenmiştir. Sıradaki paket **P22 — Tauri SQLite repository**.
