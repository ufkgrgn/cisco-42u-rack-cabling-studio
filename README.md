# Enterprise 42U Cisco Rack & Cabling Studio

Standart 19 inç 42U EIA-310-D rack kabinet içinde çalışan; Cisco Catalyst ve Nexus switchler, Cat6/Cat6A patch paneller, Fiber LC Duplex ODF ve yatay kablo düzenleyicileri (organizer) arasında port seviyesinde fiziksel Bézier sarkma eğrileriyle kablolama yapabilen interaktif web stüdyosu.

## 🚀 Özellikler

- **19 inç 42U EIA-310-D Standart Rack Kabinet:**
  - 42U dikey U cetveli, her U için 3'lü kare montaj delikleri (cage nut).
  - 1U ve 2U cihaz montajı, çakışma (collision) ve sınır denetimi.
- **Geniş Donanım Kütüphanesi & Birebir Port Mimarisi:**
  - **Cisco Catalyst 9300X-48HX (1U):** 48x Multigigabit PoE+ RJ45 + 4x 25G SFP28 modüler uplink.
  - **Cisco Catalyst 9200-24P (1U):** 24x 1G PoE+ RJ45 + 4x 10G SFP+ uplink.
  - **Cisco Catalyst 3850-48P (1U):** 48x 1G PoE+ RJ45 + 4x 10G SFP+ uplink.
  - **Cisco Catalyst 2960-X 24TS (1U):** 24x 1G RJ45 + 4x 1G SFP uplink.
  - **Cisco Catalyst 9500-24Y4C (1U Core):** 24x 25G SFP28 + 4x 100G QSFP28.
  - **Cisco Nexus 93180YC-FX (1U DC ToR):** 48x 10/25G SFP28 + 6x 40/100G QSFP28 uplink.
  - **1U Cat6A 24-Port Patch Panel & 1U Cat6 48-Port Yüksek Yoğunluk RJ45 Paneli**
  - **1U 24-Port Fiber ODF (LC Duplex - OM4 Multimode)**
  - **1U & 2U Kapaklı Yatay Kablo Düzenleyicileri (Organizers)**
  - **1U Boşluk Kapatma Paneli (Blanking)**
- **Doğal Bézier Sarkma (Slack/Sag) Kablolama Motoru:**
  - Port-to-port bağlantı simülasyonu.
  - Yerçekimini ve kablo kanallarını yansıtan gerçekçi Bézier eğrisi (`M x1,y1 C cp1x,cp1y cp2x,cp2y x2,y2`).
  - Dinamik kablo renk paleti (Cat6 Mavi, VoIP Sarı, MGMT Yeşil, Kritik Kırmızı, Aqua OM4, OS2 Turuncu, SAN Mor vb.).
  - Port üzerine gelindiğinde anlık tooltips ve port özellikleri.
- **Run Schedule (Kablo Çizelgesi Tablosu):**
  - Tüm bağlantıların Kaynak U / Port, Hedef U / Port, metraj ve renk listesi.
  - Kablo izleme (tracing glow) ve tek tıkla kablo sökme.
- **Dışa / İçe Aktarma:**
  - **Microsoft Visio Katmanlı SVG:** `xmlns:v` namespace'li, katmanlı (`Rack_Cabinet`, `Network_Devices`, `Patch_Cables`) vektörel export.
  - **JSON Kaydet / Yükle:** Topolojiyi kaydedip daha sonra tekrar yükleme.
  - **Hazır Şablon:** Tek tıkla kurumsal omurga topolojisi yükleme.

## 🛠️ Kurulum & Çalıştırma

Harici hiçbir bağımlılık veya npm paketi gerektirmez.
Doğrudan `index.html` dosyasını tarayıcınızda açarak kullanabilirsiniz:

```bash
# Depoyu klonlayın
git clone https://github.com/ufkgrgn/cisco-42u-rack-cabling-studio.git

# index.html dosyasını herhangi bir tarayıcıda açın
```

## 📄 Lisans
MIT
