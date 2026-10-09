# P22–P31 — yerel geliştirme ve kanıt sınırı

GitHub `master` fast-forward ile `ad43fb3` sürümüne çekildi. P22–P31 yazılımı bu kaynak ağacında geliştirilir. Yerel geliştirme tercihi kullanıcının talimatıdır. Canlı sunucu, müşteri, API anahtarı veya saha erişimi varsayılmaz.

## Yerel ekip sunucusu

Node 22 veya üzeri, Docker Desktop/Compose gerekir. Bu makinede Docker bulunmadığı için Compose başlangıcı kanıtlanmadı; SQL testleri PGlite PostgreSQL motoruyla, kimlik testleri imzalı JWT ve gerçek HTTP/WebSocket istemcileriyle çalışır. Bunlar Keycloak kurulumu veya üretim PostgreSQL dağıtımı kanıtı değildir.

PowerShell ortamında kendi geliştirme parolalarınızı ayarlayın; dosyaya veya Git'e kaydetmeyin:

```powershell
$env:POSTGRES_PASSWORD = '<your development database password>'
$env:KEYCLOAK_ADMIN = '<your development administrator>'
$env:KEYCLOAK_ADMIN_PASSWORD = '<your development administrator password>'
docker compose -f server/docker-compose.yml up -d
```

Keycloak `http://127.0.0.1:8080` yönetiminde `rack-studio` realm ve `rack-studio` public client oluşturun. Standard flow ve PKCE S256 kullanın; redirect/web origin `http://localhost:5173`. Client scope audience mapper ile access token'a `rack-studio` audience ekleyin. Kullanıcıları yönetim arayüzünde oluşturun. Geliştirme ekranı access token'ı oturum belleğinde alır; otomatik tarayıcı giriş/refresh veya canlı hosting bu yapılandırmada yoktur. Token geçerlilik süresi dolunca yeniden bağlanın. Realm token issuer'ını tam olarak kullanın; localhost ve 127.0.0.1 farklı issuer'dır.

```powershell
$env:DATABASE_URL = "postgresql://rack_studio:$([uri]::EscapeDataString($env:POSTGRES_PASSWORD))@127.0.0.1:5432/rack_studio"
$env:OIDC_ISSUER = 'http://127.0.0.1:8080/realms/rack-studio'
$env:OIDC_AUDIENCE = 'rack-studio'
$env:OIDC_JWKS_URL = 'http://127.0.0.1:8080/realms/rack-studio/protocol/openid-connect/certs'
$env:WORKSPACE_COMPANY = 'development'
$env:WORKSPACE_SUBJECT = '<OIDC user sub from your verified account>'
npm run workspace:seed
npm run workspace:start
```

Diğer kullanıcılar için `WORKSPACE_COMPANY_ROLE=member` ile seed çalıştırın. Firma üyeliği sunucu yöneticisinin işlemi; proje rolü Ekip ekranındaki yönetici tarafından atanır. Frontend için ayrı terminalde `npm run dev`; `/api` ve WebSocket Vite üzerinden yerel 8787 sunucusuna gider. Masaüstü native transport yalnızca `127.0.0.1:8787` ile konuşur. API token, parola, müşteri adı loga yazılmaz.

Rol sınırları: owner proje üyeliği/paylaşım/arşiv/silme; designer tasarım; technician gözlem ve doğrulanmış saha geçmişi; viewer okuma. Her API ve socket iletişimi sunucuda tekrar doğrulanır. Firma dışı kullanıcıya proje varlığı açıklanmaz. Revizyon/evidence/export/paylaşım aynı proje yetkisinin arkasındadır. Salt okunur bir kullanıcı gördüğü veriyi kopyalayabilir; export endpoint yetkisi veri gizleme garantisi değildir.

Topoloji PostgreSQL işleminde proje kilidi, eski revizyon kontrolü ve aynı komut kimliğinin aynı sonucu döndürmesiyle kabul edilir. Yjs yalnızca açıklamalara uygulanır. Uzaktan revizyon açık yerel taslağı değiştirmez. Sunucu kaydını açıkça yeniden açmak yerel undo geçmişini sıfırlar. Outbox dondurulmuş taslak ve hazırlanmış komut kimliğini dayanıklı tutar; tekrar gönderim timeout sonrası aynı kimliği kullanır. Yetki veya stale revision hatasında taslak korunur; yeni sunucu kaydını açıp çatışmayı güncel taslakla çözün. Silinmiş nesne sessizce canlandırılmaz; fiziksel çakışma taslakta düzenleme ister.

## SQLite ve Windows paket

Native depoda SQLite WAL/FULL transaction ve global CAS sürümü otoritedir. Ekler hash adına staging ile yazılır; açılış reconciliation yalnızca referanssız, yönetilen dosyaları temizler. Hashi bozuk referanslı dosya silinmez ve depo açılışı reddedilir. Frontend mevcut IDB transaction/cursor sözleşmesini geçici bir mirror üzerinde yürütür; native hatada tarayıcıya geçiş yapmaz. Mirror nedeniyle WebView IndexedDB erişimi hâlâ gerekir ve büyük depolarda snapshot maliyeti vardır; doğrudan Rust repository metotlarına geçiş ayrı performans çalışmasıdır.

Ürün/sürüm/title Rack Studio 4.0.0; eski uygulama identifier korunur ki mevcut app-data konumu değişmesin. `npm run tauri:build` çevrimiçi WebView2 bootstrapper; `node scripts/build-tauri.cjs --offline` offline WebView2 installer. Ana pencere dışında capability verilmez; CSP self ve sabit yerel API/socket kapsamındadır. Pixi vendor runtime aynı 8.20.1 paketin resmî `pixi.js/unsafe-eval` CSP adapter'ıyla derlenir; string eval izni eklenmez. HTTP üzerinde aynı CSP ile gerçek Pixi cihazları ve dondurulmuş rapor iframe'i test edilir. Bu Chromium kontrolü gerçek WebView2/native IPC kurulumu yerine geçmez. [Pixi v8 modül dokümanı](https://pixijs.com/8.x/guides/migrations/v8).

Temiz Windows 10/11, WebView2 yok/var, çevrimiçi/çevrimdışı kurulum, önceki sürümden yükseltme, rollback ve gerçek işletim sistemi kimlik deposu kontrolleri ayrı matristir. Oluşan NSIS dosyası bu matrisin tamamlandığı anlamına gelmez.

## Entegrasyonlar

NetBox native Windows Credential Manager ile saklanan anahtar, HTTPS/redirect engeli ve yalnızca beş salt okunur koleksiyon kullanır. Tüm sayfalar tamamlanmadan kayıt olmaz; count değişirse yeniden alınır. 429/502/503/504 ve ağ timeout için en çok üç deneme, artan bekleme; auth hatasında retry yok. Masaüstü ayarlarında anahtar boş bırakılırsa mevcut credential kullanılır. Tarayıcı anonim fixture JSON alır. Belirsiz cihaz/port/kablo eşlemesi kullanıcı seçimidir; alınan veri önce gözlemdir, plan değişikliği ayrı fark onayıdır. Canlı NetBox örneğiyle smoke henüz yapılmadı.

AI sıralama varsayılan kapalıdır; mühendislik/teknik filtrelerden geçmiş en fazla 20 üretici kaynağı olan katalog adayı gönderilir. Özel müşteri modelleri dışlanır. 1.5 saniye bütçe, geç cevap koruması, cache, eşleşme yok ve normal arama fallback vardır. `npm run catalog:pilot` 60 TR/EN sorguluk baseline raporu; `-- --live` ve yalnızca yerel `TYPESAFE_API_KEY` ile gerçek değerlendirme. Şimdiki iki üretici kaynaklı model top-3 +10 puan iyileştirmeyi gösteremez. Gerçek başarı/gecikme/maliyet ölçümü olmadan pilot yayın özelliği sayılmaz.

Resmî kaynaklar: [TypeSafe API](https://docs.typesafe.ai/api), [NetBox REST API](https://netbox.readthedocs.io/en/stable/integrations/rest-api/), [Keycloak Docker](https://www.keycloak.org/server/containers), [Vitest 4 gereksinimleri](https://v4.vitest.dev/guide/).
