# P29 — saha pilotu kaydı

2026-10-08: gerçek saha pilotu **yapılmadı**. Yerel testler saha kanıtı değildir. En az üç kullanıcı ve iki gerçek proje gerektiğinden A42/G6 açıktır. Veri kaybı veya kullanıcı tarafından tamamlanamayan kritik görev sürümü engeller.

Pilot akışı: aynı kapsamı önce mevcut yöntemle, sonra Rack Studio ile hazırlayın; hazırlama, montaj, etiket, QR, kanıt, teslim ve yedeği yeniden açma görevlerini kullanıcının kendisi tamamlasın. Dakikaları, hata/yardım sayısını ve görüşme notlarını anonim kodlarla kaydedin. İlk tarayıcı pilotunu masaüstü ve ekip özellikleriyle tekrar edin.

`npm run pilot:evaluate -- <capture.json>` ölçümü doğrular. Girdi örneği:

```json
{"format":"rack-studio-field-pilot","version":1,"runs":[{"participant":"u1","project":"project-a","environment":"real-field","baselineMinutes":60,"productMinutes":45,"helpCount":2,"dataLoss":false,"evidenceReviewedBy":"reviewer-code","evidenceHashes":["64-character-sha256-of-reviewed-evidence"],"tasks":[{"task":"prepare","completedByUser":true}]}]}
```

Görev kimlikleri: `prepare`, `install`, `label`, `qr`, `evidence`, `handover`, `reopen`. Örnek kayıt eksiktir ve kapıyı geçmez. Gerçek dosyaları paylaşmadan önce anonimleştirin; kanıt hashleri dosyaların gerçekliğini kendi başına kanıtlamaz. Değerlendirme operatör beyanıdır; QA gözden geçirmesi ayrıca gerekir. Lab kaydı `environment: "lab"` olarak işaretlenir ve saha kapısını kapatmaz.

Tekrarlanabilir lab hata senaryoları: `test:native` yarıda kalan commit/ek dosyası/kayıt çatışması; `test:workspace` firma dışı erişim, yetki iptali, eski revizyon, tekrar gönderim; `test:extensions` silinmiş nesne, aynı U, kuyruk ve yedek geri açma. Gerçek saha sonuçları ve kararlar bu dosyaya ayrıca eklenir.
