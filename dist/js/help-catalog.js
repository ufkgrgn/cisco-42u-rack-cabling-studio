/** Offline, editorial help. IDs are stable links, never action dispatchers. */
(function () {
  'use strict';
  const topic = (title, summary, when, how, example) => Object.freeze({ title, summary, when, how, example });
  const topics = {
    racks: topic('Kabin yönetimi', 'Kabinleri ekleyin, adlandırın ve yüksekliklerini düzenleyin.', 'Birden fazla kabineti aynı projede planlarken.', 'Üstteki kabin seçiciyi açın. Yeni kabin oluşturun veya aktif kabinin adını değiştirin.', 'Kat 1 ve Kat 2 için ayrı kabinler oluşturun.'),
    devices: topic('Cihaz yerleştirme', 'Kütüphanedeki donanımı kabindeki boş U alanına yerleştirin.', 'Switch, panel veya güç ünitesinin konumunu planlarken.', 'Cihazı boş alana sürükleyin. Dokunmatik ekranda katalogdaki yerleştirme seçeneğini kullanın.', '1U switchi kabinin 12U konumuna yerleştirin.'),
    layout: topic('Kabin yerleşimi', 'Cihaz konumlarına ve kapladıkları alana odaklanın.', 'Kabin düzenini planlarken veya genel görünümü incelerken.', 'Yerleşim düğmesini seçin. Portlar ve kablolar bu görünümde gizlenir.', 'İki cihaz arasında düzenleyici için boşluk bırakın.'),
    cabling: topic('Kablolama', 'Cihazların portları arasında bağlantı oluşturun.', 'Yerleşimden sonra kablo planını hazırlarken.', 'Kablolama düğmesini seçin ve gerekirse yakınlaşın. Boş kaynak portu, ardından boş hedef portu seçin. İptal düğmesi seçimi temizler.', 'Switch GE1 portunu patch panelin ilk portuna bağlayın.'),
    faces: topic('Ön ve arka yüz', 'Kabinin önündeki veya arkasındaki donanımı inceleyin.', 'Bağlantı noktalarının hangi yüzde bulunduğunu görmek için.', 'Ön Yüz / Arka Yüz kontrolünü kullanın. 3D kamerada Ön veya Arka açısını seçin.', 'Arkadaki güç bağlantısını incelemek için arka yüze geçin.'),
    views: topic('2D ve 3D görünüm', 'Aynı projeyi düz çizimde veya üç boyutlu ortamda inceleyin.', '2D ile düzenleme, 3D ile mekânsal kontrol ve sunum yaparken.', 'Masaüstünde üst çubuktaki, telefonda Görünüm panelindeki 2D veya 3D düğmesini seçin. Görünüm değişimi yeni proje oluşturmaz.', '2D yerleşimi hazırlayıp 3D görünümde kabin derinliğini inceleyin.'),
    zoom: topic('Yakınlaştırma ve sığdırma', 'Çalışma alanının görünür ölçeğini değiştirin.', 'Portları seçmek veya kabinin tamamını görmek için.', '+ / − ile ölçeği değiştirin. Sığdır bütün kabini gösterir; 1:1 yüzde 100 ölçeğe döner. Uzak görünümde port ayrıntıları gizlenebilir.', 'Kablo bağlamadan önce portlar görünene kadar yakınlaşın.'),
    ports: topic('Port ayarları', 'Portun rolünü, VLAN ve açıklama bilgilerini düzenleyin.', 'Access, trunk veya yönetim bağlantılarını ayırt ederken.', 'Porta sağ tıklayın veya Shift ile tıklayın. Dokunmatik ekranda cihaz seçimi üzerinden port ayarlarını açın.', 'Yönetim portuna açıklama ekleyerek bağlantı listesini anlaşılır kılın.'),
    autofill: topic('Otomatik bağlantı', 'Birden fazla uygun portu toplu olarak eşleştirin.', 'Ardışık panel ve switch bağlantıları planlarken.', 'Switchin otomatik bağlantı aracını açın, hedefi ve aralığı kontrol edin, ardından uygulayın. Sonucu bağlantı listesinden inceleyin.', 'Paneldeki ardışık portları switch portlarıyla eşleştirin.'),
    trace: topic('Devre izi', 'Kablonun uçlarını ve panel üzerinden geçtiği eşlemeleri inceleyin.', 'Bir bağlantının nereye ulaştığını anlamak için.', 'Menü → Devre izi bölümünü açın. İlgili uçları seçin; panel eşlemelerini gerektiğinde düzenleyin.', 'Switchten çıkan bağlantının hangi panel portuna ulaştığını kontrol edin.'),
    projects: topic('Proje kayıtları', 'Projenizi yerel kayıtlarda saklayın, açın ve yedekleyin.', 'Çalışmaya sonra devam etmek veya paylaşmak için.', 'Proje yöneticisinden kayıtları açın. Dışa aktarma ile yedek alın. Kayıt durumunu kontrol edin.', 'Saha çalışması öncesinde proje yedeği alın.'),
    field: topic('Saha görünümü', 'Plan ile sahadan kaydedilen gözlemleri birlikte inceleyin.', 'Gerçekleşen durumu planla karşılaştırırken.', 'Menü → Saha görünümünü açın. Cihazı seçip gözlem ve kanıt bilgilerini inceleyin.', 'Sahadaki cihaz etiketini planlanan cihaz bilgisiyle karşılaştırın.'),
    delivery: topic('Teslim merkezi', 'Rapor, malzeme listesi, etiket ve teslim paketi hazırlayın.', 'Projenin bir sürümünü teslim etmek için.', 'Menü → Teslim merkezi bölümünü açın. Çıktıların bağlı olduğu sürümü ve uyarıları kontrol edin.', 'Kontrol edilmiş proje sürümünden malzeme listesi üretin.'),
    schedule: topic('Bağlantı listesi', 'Kabloların kaynak ve hedef uçlarını liste halinde kontrol edin.', 'Bağlantı planını gözden geçirmek için.', 'Özellikler panelindeki Bağlantılar sekmesini açın. Telefonda önce alttaki Seçim düğmesine dokunun. Satırdaki uçları ve port adlarını inceleyin.', 'Yeni eklediğiniz GE1 bağlantısının doğru iki cihaza gittiğini doğrulayın.')
  };
  const controls = {
    'workspace-project': 'projects', 'btn-mobile-view': 'views', 'btn-mobile-selection': 'devices',
    'workspace-inspector-toggle': 'devices', 'workspace-library-toggle': 'devices', 'btn-compact-view': 'views',
    'workspace-3d-fit': 'zoom', 'workspace-tab-connections': 'schedule', 'workspace-tab-devices': 'devices',
    'btn-rack-selector': 'racks', 'btn-add-rack': 'racks', 'btn-rename-rack': 'racks',
    'btn-mode-layout': 'layout', 'btn-mode-cabling': 'cabling', 'btn-toggle-cables': 'cabling',
    'btn-2d-face-toggle': 'faces', 'cam-front': 'faces', 'cam-rear': 'faces',
    'btn-view-2d': 'views', 'btn-view-3d': 'views', 'btn-zoom-in': 'zoom', 'btn-zoom-out': 'zoom',
    'btn-zoom-fit': 'zoom', 'btn-zoom-actual': 'zoom', 'btn-circuit-trace': 'trace',
    'btn-field-mode': 'field', 'btn-delivery-center': 'delivery', 'btn-3d-schedule-modal': 'schedule',
    'btn-projects': 'projects', 'btn-export-json-3d': 'projects', 'btn-import-json-3d': 'projects', 'btn-saved-views': 'views',
    'btn-mobile-catalog': 'devices', 'btn-3d-catalog': 'devices', 'btn-toggle-port-numbers': 'ports',
    'btn-tidy-cables': 'cabling', 'btn-route-structured': 'cabling', 'btn-route-direct': 'cabling'
  };
  const terms = {
    U: 'Kabin yüksekliği birimi. 1U yaklaşık 44,45 mm yüksekliğindedir.',
    MDF: 'Ana dağıtım noktası; binanın ana ağ bağlantılarının toplandığı bölüm.',
    IDF: 'Kat veya bölge dağıtım noktası; ana dağıtıma bağlı yerel ağ bölümü.',
    'Patch panel': 'Saha kablolarını düzenli portlarda sonlandıran bağlantı paneli.',
    Trunk: 'Bir bağlantı üzerinden birden fazla VLAN taşıyan port rolü.',
    Uplink: 'Bir cihazı üst ağ katmanına veya başka ağ cihazına bağlayan bağlantı.',
    PoE: 'Uyumlu cihazlara Ethernet kablosuyla veri yanında güç de iletme yöntemi.',
    Fiber: 'Veriyi ışıkla taşıyan kablo türü; uç ve ortam türlerinin uyumlu olması gerekir.'
  };
  window.RackStudio.HelpCatalog = Object.freeze({ topics: Object.freeze(topics), controls: Object.freeze(controls), terms: Object.freeze(terms) });
})();
