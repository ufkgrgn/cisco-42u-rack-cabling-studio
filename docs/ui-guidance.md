# Arayüz yardımı ve ilk kullanım

Üst çubuktaki **Yardım**, başlangıç rehberini, işlev açıklamalarını, terimleri ve kısayolları açar. İçerikler yereldir; yardım için internet veya yapay zekâ servisi kullanılmaz.

## Modüller

- `help-catalog.js`: Sabit konu kimlikleri, Türkçe açıklamalar ve kontrol eşlemeleri.
- `help-controller.js`: `RackStudio.Help.open(topicId)`, erişilebilir ipuçları, bölüm yardımı ve ekran sınırlarına yerleştirme.
- `workflow-guidance.js`: Gerçek port seçimi ve komut sonuçlarına bağlı yönlendirme. Ağ uygunluğunu mevcut kurallar ve komutlar belirler.
- `onboarding-controller.js`: Ayrı örnek projede engelleyici olmayan eğitim. Eski yarım rehber oturumları yeni akışın ilk adımından sürdürülür; özgün projeye dönüş kimliği korunur.

Yeni kontrollerde `data-help-id` kısa açıklamayı, `data-help-open` ilgili ayrıntı panelini bağlar. Yardım içerikleri işlem çalıştırmaz. Dinamik pencerelerde bölüm yardımı ilgili başlığa eklenir; kapatınca odak açan kontrole döner.

## Kullanım

İlk kullanım daveti katalog içinde gösterilir. Rehber kapatılabilir, daraltılabilir ve Yardım menüsünden yeniden açılabilir. Cihazı 12U konumuna elle yerleştirmek ve iki GE1 portunu bağlamak ilgili adımları ilerletir. **Örneği benim için yap** mevcut komutlarla aynı eğitim işlemini otomatik yapar. Son adımda kullanıcı bağlantı listesini kontrol ettiğini belirtir. Örnek gözlem gerçek saha kanıtı değildir.

Bağlantı mesajı kalıcı olarak kaynak ucu ve iptal yolunu gösterir. Başarı, yerel kayıt tamamlanınca bildirilir; kayıt başarısızlığı ayrı açıklanır. Yardım paneli proje şemasına alan eklemez.

## Doğrulama

`npm run check`, `npm run test:unit` ve `npm run test:legacy` temel kapılardır. `npm run test:guidance`, dört tema × dört genişlik × 2D/3D yardım ekranlarını, odak dönüşünü, elle eğitim ve özgün projeye dönüşü, gerçek bağlantı reddini ve katalogda sonuçsuz aramadan kurtulmayı kontrol eder. Ekran çıktıları `docs/product-plan/results/ui-guidance` altında oluşturulur.

Tema karşılaştırma görüntüleri başlangıç daveti kapalıyken alınır; davet ve rehber davranışı ayrı test edilir. Ekran boyutu doğrulaması fiziksel dokunmatik cihaz veya ekran okuyucu kullanıcı testi yerine geçmez.
