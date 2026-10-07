# P04 — yerel proje deposu ve kurtarma

Bu dilim tek `current` kaydını proje kimliğiyle ayrılmış bir IndexedDB deposuna taşır. Eski `current` kaydı upgrade sırasında korunur. Yeni dosyalar klasik script sırasıyla `project-commands` sonrasında, uygulama/editor bootstrap'ından önce yüklenir: `project-storage-idb.js`, `project-repository.js`, `project-archive.js`, `project-recovery-ui.js`.

## Kayıt sözleşmesi

`rack-studio` veritabanı sürüm 2:

| Store | Anahtar | İçerik |
|---|---|---|
| projects | projectId | Tam ProjectDocument, storageVersion, archived, updatedAt |
| revisions | [projectId, storageVersion] | Kalıcı kayıt sürümünün tam belgesi |
| log | [projectId, commandId] | Kabul edilen makbuz ve onu içeren storageVersion |
| evidence | [projectId, blobId] | Blob, SHA-256 ve proje kimliği |
| leases | projectId | Yazıcı kimliği ve sona erme zamanı |
| meta | sabit anahtar | Aktif proje ve yeni depo formatına geçiş bilgisi |
| recovery | ham kaydın SHA-256 özeti | Orijinal kaynak, byte eşdeğeri metin ve saklanma zamanı |

Domain `revision` içerik değişikliğini; `storageVersion` başarılı yerel kayıt sırasını temsil eder. Aynı belge tekrar kaydedildiğinde storageVersion artmaz. Görünüm verisi veya arşiv durumu domain revizyonunu artırmadan yerel bir kayıt oluşturabilir. İleriye dönük adlandırılmış/dondurulmuş revizyon UI'si P07 kapsamındadır.

`Repository.commit(document, {evidence, archived, unarchive})` proje başlığını, revizyonu, yeni komut makbuzlarını, ekleri ve ilgili meta/lease kayıtlarını **aynı readwrite transaction** içinde yazar. Başarı request.onsuccess'te değil transaction.oncomplete ve ardından başlık okuma doğrulamasında bildirilir. SHA-256 hazırlığı transaction dışında yapılır; transaction içinde await yoktur. Aynı ek kimliğine farklı içerik yazılamaz. Eksik yerel blob içeren bir belge saklanabilir, ancak eksik veriyi tam yedek gibi dışa aktarma reddedilir.

Kayıt sırasında 15 saniyelik writer lease ve okunan storageVersion kontrol edilir. Başka yazıcı veya stale baseline üzerine yazma reddedilir; lease süresi dolduğunda da storageVersion denetimi devam eder. Her başarılı değişiklik lease'i yeniler; proje değişimi/pagehide yalnızca bu yazıcının lease'ini bırakır. Salt okuma mevcut yazma baseline'ını sessizce değiştirmez; açık proje seçimi baseline'ı benimser. Bu yerel sekme sahipliğidir, kullanıcı kimliği/ekip yetkilendirmesi değildir.

`ProjectCommands.execute()` anlık sonucu `localDraft` olarak döndürmeye devam eder; `result.committed` Promise'i ortak editör kayıt kuyruğunun dayanıklı sonucunu verir. Hızlı ardışık işlemler aynı son belgede birleştirilebilir; bütün yeni makbuzlar belgeyle birlikte atomik yazılır. Her ara taslağın ayrı kalıcı revizyon olduğu iddia edilmez. `saveProjectNow()` sonucu başarısızsa çağırana hata verir; arka plan autosave hata durumunu kullanıcıya gösterir.

## Taslak ve kurtarma

- Taslak anahtarı yazıcı + proje kimliğiyle ayrılır; bir sekmenin taslağı diğerinin üzerine yazmaz. Depolama hatasında açık bellek taslağı ve yazılabildiği ölçüde localStorage taslağı korunur; başarı durumu gösterilmez. Mevcut JSON export yolu kullanılabilir.
- İlk geçişte dört eski localStorage kaynağı ve eski IndexedDB/current değerlendirilir. Kaynaklar bootstrap onları değiştirmeden önce yakalanır. Desteklenmeyen sürüm, bozuk JSON, geçersiz topoloji ve sınır hataları raw içeriği silmez.
- Legacy proje kimliği ham kaydın SHA-256 özetinden deterministik türetilir. Aynı byte içeriğinin migration'ı tekrar proje üretmez. Birden fazla farklı içerikte aday varsa seçim ekranı kaynak, ad ve revizyonu gösterir; otomatik seçim yapılmaz.
- Kullanıcı veritabanı açılırken düzenleme yaptıysa kurtarma onun çalışmasını değiştirmez. Başlangıç çalışma kopyası dayanıklı kayıttan zaten gerideyse düzenleme taslak olarak bırakılır.
- Eski `rack-studio-project-v2` yalnızca ham kurtarma yedeği ve yeni proje başlığı doğrulandıktan sonra, byte eşitliğiyle silinir. Diğer eski kaynaklar ve eski current korunur. Yeni format kurulduktan sonra eski görünüm cache'leri dayanıklı depo yerine otomatik aday yapılmaz; yeni taslaklar hâlâ değerlendirilir.
- **Araçlar → Proje kayıtları ve yedek**: kayıt açma, taslağı ayrıca saklayıp son kaydı açma, arşivleme/yeniden açma, dış yedek ve kurtarma orijinallerini indirme. Proje değişiminde history temizlenir; önceki projeye undo yapılmaz. 3D'den değişim önce eski sahneyi kanonik kayda aktarır.

## Dış yedek ve sınırlar

JSON dış yedek biçimi `rack-studio-archive`, version 1. Başlıklar, revizyonlar, komut günlüğü, ekler ve ham kurtarma kayıtları tek readonly snapshot'tan okunur. Ek ve raw özetleri, dosya kullanıcıya verilmeden ve içe yazılmadan önce doğrulanır. Import bütün veriyi önce doğrular, sonra tek transaction ile ekler. Var olan proje kimliği üzerine yazmaz; aktif çalışma otomatik değiştirilmez. Anahtarlar güvenli ID biçimindedir; dosya sistemi yolları açılmaz veya arşivden çıkarılmaz.

- Proje belgesi: 32 MB; her ek: 20 MB.
- Dış yedek: 128 MB; dışa aktarılan eklerin toplamı en fazla 64 MB.
- Bir arşivde en fazla 100 proje, 100.000 revizyon, 1.000.000 log satırı, 10.000 ek ve 1.000 raw kurtarma kaydı.
- Proje başına en fazla 1.000 kalıcı kayıt sürümü ve 10.000 makbuz. Sınırda sessiz temizleme yapılmaz; yeni kayıt açık hata verir. Uzun süreli kullanım için arşivden sonra kontrollü geçmiş azaltma/P07 politikası ayrıca gereklidir.
- IndexedDB kapalıysa tam depo başarısı bildirilmez; bellek taslağı ve mevcut JSON export korunur.

## Doğrulama ve kalan kanıt

`project-repository.test.cjs`, aktif üretim modüllerini fake-indexeddb ile çalıştırır: kota/transaction abort enjeksiyonunda başlık+revizyon+log+ek geri alınması, writer lease ve stale version, tam yedek geri yükleme ve SHA-256 reddi, tekrar migration ve raw koruma. Fiziksel disk dolması veya elektrik kesintisi kanıtı değildir.

`project-repository-browser.test.cjs`, gerçek headless Edge'de iki sekme, çakışan kurtarma adaylarının seçim ekranı, açılırken düzenleme ve 3D'den projeler arası geçiş/arşiv açmayı doğrular. Komut testi `committed` sonucunu ve tekrar denemede değişmeyen storageVersion'ı kontrol eder.

Son kanıtlar: `results/repository-check-final.log`, `results/repository-full-tests-final.log`, `results/repository-tests-final.log`, `results/repository-ui-final.log`, `results/repository-performance-100.json`. Testler geçti; fiziksel süreç öldürme/güç kaybı, gerçek disk kotası ve mobil/saha pilotu ayrı kabul kanıtları olarak açık tutulur. P05 eski 3D yazıcıların ortak komut geçişini; P06 tam proje ana ekranını; P11 ek toplama arayüzünü tamamlayacaktır.
