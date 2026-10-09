# P22–P31 uygulama ve yerel kanıt — 8 Ekim 2026

| Paket | Eklenen yazılım | Ayrı kalan kanıt |
| --- | --- | --- |
| P22 | SQLite migration/WAL/CAS, managed hash ekler/staging/reconciliation, native storage/credential bridge; gerçek Rust SQLite ile arşiv gidiş dönüşü | Fiziksel güç kesintisi ve uzun süreli WebView depolama performansı |
| P23 | Rack Studio 4.0.0, başlık/window, main capability/CSP, NSIS current-user, online/offline WebView2 yapılandırması | Temiz Windows 10/11, WebView2 yok/var, offline kurulum, upgrade/rollback |
| P24 | HTTPS salt okunur NetBox transport; bounded retry/pagination; fixture/explicit mapping; değişmeyen gözlem kimlikleri; plan farkı ayrı | Gerçek NetBox sunucusu/token/sürüm smoke |
| P25 | Filtrelenmiş public shortlist, typed noul sıralama, cache/stale/timeout/no-match/fallback; 60 TR/EN değerlendirme | API anahtarı yok; yalnızca iki public aday; +10 pp top-3 ve maliyet/gecikme kapısı açık; pilot varsayılan kapalı |
| P26 | Node/PostgreSQL SQL migration, OIDC doğrulama, firma/proje ACL, role, authoritative komut, revision/evidence/export/share/revoke API; yerel seed/Compose | Docker/Keycloak gerçek kurulum smoke ve canlı hosting yok |
| P27 | Yjs açıklama/presence; yetkiyi tekrar doğrulayan socket; serileştirilmiş topology; remote checkpoint ile undo sınırı | Uzun süreli gerçek kullanıcı/ağ yükü |
| P28 | Dayanıklı frozen outbox/prepared command; 3-way rebase; alan bazlı seçim; deletion/physical-layout conflict; draft download; reconnect; local acceptance checkpoint | Gerçek kopan ağ/telefon ve ekip saha pilotu |
| P29 | Pilot görev/timing/evidence kayıt sözleşmesi, anonim değerlendirme aracı, lab hata senaryoları; lab saha sayılmaz | Üç gerçek kullanıcı, en az iki gerçek proje ve QA görüşme/ölçüm |
| P30 | Fingerprint bağlı test makbuzları, S1/S2/S3 ayrı release manifesti, kullanım/teşhis ekranı, npm güvenlik güncellemeleri | Dış kabul kapıları açık; releaseApproved false |
| P31 | Arşiv/restore/permanent delete, lease/pending/aktif proje koruması, typed name, referans güvenli retention, backup drill ve migration/catalog bakım prosedürü | Gerçek ayrı Windows cihazında yedek tatbikatı ve işletme saklama kararı |

Yerel kanıt komutları ve fingerprint makbuzları [results/p22-p31/release-manifest.json](results/p22-p31/release-manifest.json) içinde tutulur. Bir test başarısızlığı başka testin başarısıyla kapatılmaz. Mevcut eski test görsellerinde Windows preview/indexer kilidi `UNKNOWN` yazma hatası verdi; yalnızca üretilen PNG yazımı için sınırlı retry eklendi, ürün depolama hataları ve görsel toleranslar değiştirilmedi. Eski sonuç görüntüleri baseline kabulünün yerine geçmez.

Yeni arayüz kanıtları 320/390/768/1440 ve dört temada `results/p22-p31/` altında. İki ayrı Edge tarayıcı oturumu gerçek HTTP/socket ve imzalı JWT üzerinden bağımsız değişiklikleri birleştirir; sonradan gelen yerel taslağı korur, kabul edilmiş checkpoint'i yeniden açar, açıklamaları yakınsatır. SQL engine PGlite'dır; production pg Pool transport/Keycloak deployment sayılmaz. `test:native` gerçek Rust SQLite ve yönetilen ek dosyalarını çalıştırır; mocked native IPC testinden ayrı raporlanır.

Eski görsel suite'in altı hatası temiz `ad43fb3` checkout'ta da tekrarlandı (`baseline-visual.log`). Kablolama snapshot/scroll/inspector testleri artık açıkça kablolama görünümünü seçer; varsayılan yerleşim davranışı kendi suite'inde kalır. Baseline görüntüleri ve diff toleransları değişmedi. AI ayarı native transport bulunan masaüstünde görünür. Native CSP'nin Pixi'yi engellediği ek smoke'ta yakalandı; resmî CSP adapter'ı ile eval izni açılmadan giderildi ve rapor önizlemesi de doğrulandı.

Tüm özellikler `index.html` modüler script girişinde aktiftir. Forbidden `app.bundle.js` oluşturulmadı. Kaynak ve NSIS ürünü yereldir; GitHub push yapılmadı. Kullanıcıya ait mevcut scratch görüntüleri korunur.

## Son yerel doğrulama

8 Ekim 2026 son kaynakta ürün/ekip testleri 97/97, görsel regresyon 29/29, Vitest 6/6, gerçek Rust SQLite köprüsü 4/4 ve Rust birim testleri 6/6 geçti. Ayrı features 17/17 ve workspace 7/7 koşuları ürün toplamının alt kümeleridir. Check, legacy, production build ve npm audit geçti; audit sıfır bilinen açık raporladı. Sentetik performans ölçümü 100 rack, 3.000 cihaz ve 20.000 kabloyla geçti; import 829 ms, pan frame interval p95 8,4 ms. Bu headless ölçüm gerçek cihaz GPU/60 FPS sertifikası değildir. Son makbuzların kaynak fingerprint'i release manifestinde karşılaştırılır.

Son NSIS paketi başarıyla üretildi (24.861.889 byte). Release manifestindeki 12 kontrol aynı kaynak fingerprint'i ile geçti; S1/S2/S3 localPassed true, dış kanıtlar pending ve releaseApproved false olarak korunur.
