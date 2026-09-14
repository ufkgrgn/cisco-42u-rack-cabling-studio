# Enterprise 42U Cisco Rack & Cabling Studio (Multi-Rack)

Standart 19 inç 42U EIA-310-D rack kabinetler içinde çalışan; Cisco ISR Router'lar, Catalyst ve Nexus switchler, Cat6/Cat6A patch paneller, Fiber LC Duplex ODF ve yatay kablo düzenleyicileri arasında port seviyesinde fiziksel Bézier eğrileriyle kablolama yapabilen, **Çoklu Kabin (MDF / IDF)** mimarili interaktif web stüdyosu.

---

## 🚀 Öne Çıkan Özellikler

- **Çoklu Kabin (Multi-Rack / MDF-IDF) Mimarisi:**
  - Üst kabin sekmeleri üzerinden sınırsız 42U kabin oluşturma (`+ Yeni Kabin`), yeniden adlandırma ve kabinler arası geçiş.
  - **Kabinler Arası (Inter-Rack) Kablolama:** MDF Omurga switchinden katlardaki IDF kabin uplinklerine kadar inter-rack tie hatları çekebilme.
  - Kabin bazlı bağımsız cihaz yönetimi ve genel bağlantı tablosu.

- **Saha Donanım Kütüphanesi & Birebir Port Mimarisi:**
  - **Cisco ISR 4431/K9 Router (1U):** 4x Dahili GE/SFP yönlendirilmiş port, 3x NIM yuvası, çift PSU.
  - **Cisco Catalyst WS-C3850-24S-S (1U):** 24x 1G SFP Fiber Omurga / Toplama Switchi + 4x 10G SFP+ Uplink.
  - **Cisco Catalyst WS-C2960-24PC-L (1U):** 24x 10/100 PoE FastEthernet + 2x Dual-Purpose 1G Gigabit/SFP.
  - **Cisco Catalyst WS-C2960X-24PS-L (1U):** 24x Gigabit PoE+ (370W) + 4x 1G SFP Uplink.
  - **Cisco Catalyst WS-C2960XR-24PS-I (1U):** L3 24x Gigabit PoE+ + 2x 10G SFP+ Uplink, çift PSU.
  - **Cisco Catalyst C9200L-24P-4X & C9300L-24P-4X (1U):** 24x Gigabit PoE+ + 4x 10G SFP+ sabit uplink.
  - **Cisco Catalyst WS-C2960X-24TS-L & WS-C2960-24TC-L (1U):** 24 Port PoE'siz kurumsal kenar switchler.
  - **Cisco Catalyst WS-C2960-48TC-L (1U):** 48 Port 10/100 + Gigabit & SFP uplink.
  - **Cisco Catalyst C1000-24P-4G-L (1U):** 24x 1G PoE+ + 4x 1G SFP.
  - **Kompakt Switchler:** WS-C3560-8PC-S, WS-C2960CX-8PC-L, WS-C2960G-8TC-L.
  - **Cisco Catalyst 9500-24Y4C (1U) & Cisco Nexus 93180YC-FX (1U ToR):** Yüksek yoğunluklu omurga.
  - **Yapısal Kablolama:** Cat6A 24P, Cat6 48P, 24P OM4 LC Duplex Fiber ODF, 1U/2U Yatay Düzenleyiciler ve Kör Paneller.

- **Sahaya Özel Hazır Şablonlar (Presets):**
  - **MDF Şablonu:** WAN Router'lar (ISR4431) + OM4 Fiber ODF + C3850-24S Fiber Dağıtım + C9300L/C9200L.
  - **IDF Şablonu:** Fiber ODF + Cat6A Patch Paneller + WS-C2960X-24PS-L + WS-C2960-24PC-L + Düzenleyiciler.
  - **⚡ Tam Saha Topolojisi:** MDF, IDF-1 ve IDF-2 kabinlerini aynı anda oluşturur ve kabinler arası fiber omurga hatlarını çeker.

- **Bézier Sarkma & Yapısal Kanal Kablolama:**
  - Dikey kablo kanallarından paralel geçiş (`Yapısal Kanal`) veya doğrudan kavis (`Sıkı Doğrudan`) modları.
  - 8 farklı renk kodu (Cat6 Mavi, VoIP Sarı, MGMT Yeşil, Kritik Kırmızı, Aqua OM4, OS2 Turuncu, SAN Mor, Gri).

- **Run Schedule (Kablo Çizelgesi) & Vektörel Dışa Aktarım:**
  - Tüm kablolar için kaynak/hedef kabin, U seviyesi, port, metraj ve silme işlemleri.
  - **Microsoft Visio Katmanlı SVG:** `xmlns:v` uyumlu katmanlı vektörel çizim çıktısı.
  - **JSON Yedekleme:** Çoklu kabin mimarisini ve tüm kabloları tek dosyada dışa/içe aktarma.

---

## 🛠️ Kurulum & Çalıştırma

Harici hiçbir paket ya da sunucu gerektirmez. 

1. Doğrudan **`index.html`** veya **`start-server.bat`** dosyasına çift tıklayarak tarayıcınızda anında kullanabilirsiniz.

---

## 📄 Lisans
MIT
