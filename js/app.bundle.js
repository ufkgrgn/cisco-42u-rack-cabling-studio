"use strict";
(() => {
  // js/src/2d/catalogData.js
  var HARDWARE_CATALOG = {
    // 1. WAN & ROUTER
    "cisco-isr-4431": {
      name: "Cisco ISR 4431/K9 Router",
      u: 1,
      category: "router",
      logo: "CISCO",
      modelTag: "ISR 4431 ROUTER",
      desc: "Kurumsal WAN & \u0130nternet Y\xF6nlendiricisi, 4x Dahili GE/SFP Portu, 3x NIM Yuvas\u0131, \xC7ift G\xFC\xE7 Kayna\u011F\u0131.",
      ports: [
        { id: "ge0_0_0", name: "GE0/0/0", type: "rj45", group: 0, row: 0, speed: "1G WAN / Routed" },
        { id: "ge0_0_1", name: "GE0/0/1", type: "rj45", group: 0, row: 0, speed: "1G WAN / Routed" },
        { id: "ge0_0_2", name: "GE0/0/2", type: "sfp", group: 1, row: 0, speed: "1G SFP Fiber WAN" },
        { id: "ge0_0_3", name: "GE0/0/3", type: "sfp", group: 1, row: 0, speed: "1G SFP Fiber WAN" },
        { id: "mgmt0", name: "MGMT", type: "rj45", group: 2, row: 0, speed: "1G Out-of-Band MGMT" }
      ]
    },
    // 2. FIBER DISTRIBUTION & OMURGA
    "cisco-3850-24s": {
      name: "Cisco Catalyst 3850-24S-S",
      u: 1,
      category: "fiber-switch",
      logo: "CISCO",
      modelTag: "WS-C3850-24S-S",
      desc: "24 Port SFP 1G Fiber Omurga/Toplama Switchi, 4x 10G SFP+ Mod\xFCler Uplink.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `sfp${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "sfp",
          group: Math.floor(i / 6),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G SFP Fiber (IDF Toplama)"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 4,
          row: 0,
          speed: "10G SFP+ 10Gbps Uplink"
        }))
      ]
    },
    "cisco-nexus-93180yc": {
      name: "Cisco Nexus 93180YC-FX",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "N9K-C93180YC-FX",
      desc: "Veri merkezi ToR switch, 48x 10/25G SFP28 ve 6x 100G QSFP28 omurga portu.",
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `eth1_${i + 1}`,
          name: `Eth1/${i + 1}`,
          type: "sfp",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "25G SFP28"
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `eth1_${i + 49}`,
          name: `Eth1/${i + 49}`,
          type: "sfp",
          group: 4,
          row: i % 2 === 0 ? 0 : 1,
          speed: "100G QSFP28"
        }))
      ]
    },
    "cisco-9500-24y4c": {
      name: "Cisco Catalyst 9500-24Y4C",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "C9500-24Y4C",
      desc: "Kamp\xFCs \xE7ekirdek omurga, 24x 25G SFP28 ve 4x 100G QSFP28 uplink portu.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `25GE1/0/${i + 1}`,
          type: "sfp",
          group: Math.floor(i / 6),
          row: i % 2 === 0 ? 0 : 1,
          speed: "25G SFP28"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `100GE1/0/${i + 25}`,
          type: "sfp",
          group: 4,
          row: 0,
          speed: "100G QSFP28"
        }))
      ]
    },
    // 3. GIGABIT POE+ ACCESS SWITCHES
    "cisco-2960x-24ps": {
      name: "Cisco Catalyst 2960X-24PS-L",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "2960X-24PS-L (PoE+)",
      desc: "24x Gigabit RJ45 PoE+ (370W) ve 4x 1G SFP Uplink yuvas\u0131. Sahada 55 adet.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G Gigabit PoE+"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 2,
          row: 0,
          speed: "1G SFP Fiber Uplink"
        }))
      ]
    },
    "cisco-2960xr-24ps": {
      name: "Cisco Catalyst 2960XR-24PS-I",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "2960XR-24PS-I (L3)",
      desc: "L3 Kurumsal Kenar, 24x Gigabit PoE+ (370W), 2x 10G SFP+ Uplink, Yedekli \xC7ift G\xFC\xE7 Kayna\u011F\u0131.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G Gigabit PoE+"
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 2,
          row: 0,
          speed: "10G SFP+ Uplink"
        }))
      ]
    },
    "cisco-9200l-24p": {
      name: "Cisco Catalyst 9200L-24P-4X",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "C9200L-24P-4X",
      desc: "Yeni Nesil Kurumsal Kenar, 24x Gigabit PoE+ (370W), 4x 10G SFP+ Sabit Uplink.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G PoE+ (30W)"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 2,
          row: 0,
          speed: "10G SFP+ 10Gbps Uplink"
        }))
      ]
    },
    "cisco-9300l-24p": {
      name: "Cisco Catalyst 9300L-24P-4X",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "C9300L-24P-4X",
      desc: "StackWise-320 destekli Kenar Switch, 24x 1G PoE+ (505W UPOE), 4x 10G SFP+ Uplink.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G PoE+ UPOE"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 2,
          row: 0,
          speed: "10G SFP+ 10Gbps"
        }))
      ]
    },
    "cisco-9300-48u": {
      name: "Cisco Catalyst 9300X-48HX",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "CATALYST 9300X",
      desc: "Omurga/Kenar switch, 48x Multigigabit PoE+, mod\xFCler 4x 25G SFP28 Uplink.",
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "10G mGig PoE+"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 4,
          row: 0,
          speed: "25G SFP28"
        }))
      ]
    },
    "cisco-1000-24p": {
      name: "Cisco Catalyst 1000-24P-4G-L",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "C1000-24P-4G-L",
      desc: "24x 1G RJ45 PoE+ (195W), 4x 1G SFP sabit uplink portu.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G PoE+ (195W)"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `SFP${i + 1}`,
          type: "sfp",
          group: 2,
          row: 0,
          speed: "1G SFP"
        }))
      ]
    },
    // 4. FAST ETHERNET & SAHA SWITCHLERİ
    "cisco-2960-24pc": {
      name: "Cisco Catalyst 2960-24PC-L",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "2960-24PC-L (PoE)",
      desc: "Sahada en yayg\u0131n model (133 Adet). 24x 10/100 PoE (370W), 2x Dual-Purpose 1G Gigabit/SFP uplink.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "10/100 Mbps PoE"
        })),
        { id: "up1", name: "Gi0/1 (Dual)", type: "rj45", group: 2, row: 0, speed: "1G RJ45 / SFP Dual" },
        { id: "up2", name: "Gi0/2 (Dual)", type: "rj45", group: 2, row: 1, speed: "1G RJ45 / SFP Dual" }
      ]
    },
    "cisco-2960-24tc": {
      name: "Cisco Catalyst 2960-24TC-L",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "2960-24TC-L",
      desc: "24x 10/100 Mbps RJ45 (PoE Yok), 2x Dual-Purpose 1G Gigabit/SFP uplink.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "10/100 Mbps 100Base-TX"
        })),
        { id: "up1", name: "Gi0/1", type: "rj45", group: 2, row: 0, speed: "1G RJ45 / SFP Dual" },
        { id: "up2", name: "Gi0/2", type: "rj45", group: 2, row: 1, speed: "1G RJ45 / SFP Dual" }
      ]
    },
    "cisco-2960x-24ts": {
      name: "Cisco Catalyst 2960-X 24TS-L",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "2960-X 24TS-L",
      desc: "Klasik kurumsal kenar switch, 24x GigE RJ45, 4x 1G SFP uplink yuvas\u0131.",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G RJ45 Gigabit"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 2,
          row: 0,
          speed: "1G SFP"
        }))
      ]
    },
    "cisco-2960-48tc": {
      name: "Cisco Catalyst 2960-48TC-L",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "2960-48TC-L (48P)",
      desc: "48x 10/100 Mbps RJ45, 2x 10/100/1000 Gigabit RJ45 ve 2x 1G SFP uplink.",
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "10/100 Mbps 100Base-TX"
        })),
        { id: "up1", name: "Gi0/1", type: "rj45", group: 4, row: 0, speed: "1G Gigabit" },
        { id: "up2", name: "Gi0/2", type: "rj45", group: 4, row: 1, speed: "1G Gigabit" },
        { id: "sfp1", name: "SFP1", type: "sfp", group: 5, row: 0, speed: "1G SFP" },
        { id: "sfp2", name: "SFP2", type: "sfp", group: 5, row: 1, speed: "1G SFP" }
      ]
    },
    "cisco-3560x-24t": {
      name: "Cisco Catalyst 3560X-24T-S",
      u: 1,
      category: "switch",
      logo: "CISCO",
      modelTag: "WS-C3560X-24T-S",
      desc: "24x Gigabit 10/100/1000 RJ45 portu, Mod\xFCler A\u011F Mod\xFCl\xFC (4x 1G / 2x 10G SFP+).",
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: Math.floor(i / 12),
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G Gigabit RJ45"
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: "sfp",
          group: 2,
          row: 0,
          speed: "10G/1G SFP+"
        }))
      ]
    },
    // 5. COMPACT SWITCHES
    "cisco-3560-8pc": {
      name: "Cisco Catalyst 3560-8PC-S",
      u: 1,
      category: "compact",
      logo: "CISCO",
      modelTag: "3560-8PC-S (Kompakt)",
      desc: "8x 10/100 PoE (123W) + 1x Dual-Purpose 1G Gigabit/SFP uplink.",
      ports: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: "rj45",
          group: 0,
          row: i % 2 === 0 ? 0 : 1,
          speed: "10/100 PoE (15.4W)"
        })),
        { id: "up1", name: "Gi0/1 Dual", type: "rj45", group: 1, row: 0, speed: "1G RJ45 / SFP" }
      ]
    },
    "cisco-2960cx-8pc": {
      name: "Cisco Catalyst 2960CX-8PC-L",
      u: 1,
      category: "compact",
      logo: "CISCO",
      modelTag: "2960CX-8PC-L",
      desc: "8x Gigabit PoE+ (240W) + 2x 1G Bak\u0131r Uplink + 2x 1G SFP Portu.",
      ports: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: "rj45",
          group: 0,
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G Gigabit PoE+"
        })),
        { id: "up_cu1", name: "Gi1/0/9", type: "rj45", group: 1, row: 0, speed: "1G Copper" },
        { id: "up_cu2", name: "Gi1/0/10", type: "rj45", group: 1, row: 1, speed: "1G Copper" },
        { id: "up_sfp1", name: "SFP1", type: "sfp", group: 2, row: 0, speed: "1G SFP" },
        { id: "up_sfp2", name: "SFP2", type: "sfp", group: 2, row: 1, speed: "1G SFP" }
      ]
    },
    "cisco-2960g-8tc": {
      name: "Cisco Catalyst 2960G-8TC-L",
      u: 1,
      category: "compact",
      logo: "CISCO",
      modelTag: "2960G-8TC-L",
      desc: "7x 10/100/1000 Gigabit RJ45 + 1x Dual-Purpose 1G Gigabit/SFP yuvas\u0131.",
      ports: [
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi0/${i + 1}`,
          type: "rj45",
          group: 0,
          row: i % 2 === 0 ? 0 : 1,
          speed: "1G Gigabit RJ45"
        })),
        { id: "up1", name: "Gi0/8 Dual", type: "rj45", group: 1, row: 0, speed: "1G RJ45 / SFP" }
      ]
    },
    // 6. STRUCTURED CABLING & PANELS
    "patch-cat6-24": {
      name: "Cat6A 24-Port Patch Panel",
      u: 1,
      category: "patch",
      logo: "PANEL",
      modelTag: "CAT6A 24P-UTP",
      desc: '19" Rack montajl\u0131 24 Port 10Gbps Cat6A UTP bak\u0131r sonland\u0131rma paneli.',
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `pt${i + 1}`,
        name: `Port ${i + 1}`,
        type: "rj45",
        group: Math.floor(i / 6),
        row: 0,
        speed: "10G Cat6A"
      }))
    },
    "patch-cat6-48": {
      name: "Cat6 48-Port Y\xFCksek Yo\u011Funluk Panel",
      u: 1,
      category: "patch",
      logo: "PANEL",
      modelTag: "CAT6-48P-HD",
      desc: "1U alan\u0131nda 48 port \xE7ift s\u0131ral\u0131 y\xFCksek yo\u011Funluklu RJ45 patch panel.",
      ports: Array.from({ length: 48 }, (_, i) => ({
        id: `pt${i + 1}`,
        name: `P${i + 1}`,
        type: "rj45",
        group: Math.floor(i / 12),
        row: i % 2 === 0 ? 0 : 1,
        speed: "1G Cat6"
      }))
    },
    "fiber-odf-24": {
      name: "24-Port OM4 Fiber Da\u011F\u0131t\u0131m Paneli (ODF)",
      u: 1,
      category: "fiber",
      logo: "FIBER ODF",
      modelTag: "OM4 LC-DUPLEX",
      desc: "Veri merkezi OM4 LC Duplex \xE7ok modlu fiber optik sonland\u0131rma \xE7ekmecesi.",
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `lc${i + 1}`,
        name: `LC-${String(i + 1).padStart(2, "0")}`,
        type: "lc",
        group: Math.floor(i / 4),
        row: 0,
        speed: "100G MultiMode OM4"
      }))
    },
    "hcs-datalight-24": {
      name: "HCS DataLight Fiber Patch Panel",
      u: 1,
      category: "fiber",
      logo: "HCS",
      modelTag: "HCS-DATALIGHT-24",
      desc: "19\u201D teleskopik kasa ve \xE7apraz dizilimli mavi mod\xFCler fiber adapt\xF6r yuvalar\u0131.",
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `f${i + 1}`,
        name: `F-${String(i + 1).padStart(2, "0")}`,
        type: "lc",
        group: Math.floor(i / 6),
        row: i % 2 === 0 ? 0 : 1,
        speed: "10G OM4 LC Duplex"
      }))
    },
    // 7. CABLE MANAGEMENT & BLANKING
    "organizer-1u": {
      name: "1U F\u0131r\xE7al\u0131 Yatay D\xFCzenleyici",
      u: 1,
      category: "organizer",
      logo: "ORGANIZER",
      modelTag: "1U HORIZONTAL BRUSH",
      desc: "Hava s\u0131zd\u0131rmaz f\u0131r\xE7al\u0131 tip, patch kablolar\u0131 gizleyen 1U yatay kablo tavas\u0131.",
      ports: []
    },
    "organizer-dring-1u": {
      name: "1U D-Ring Yatay Kablo D\xFCzenleyici",
      u: 1,
      category: "organizer",
      logo: "ORGANIZER",
      modelTag: "1U 5x D-RING ORGANIZER",
      desc: '5 Adet Metal D-Ring kancal\u0131 19" 1U yatay kablo d\xFCzenleyici organizer.',
      ports: []
    },
    "organizer-2u": {
      name: "2U Kapakl\u0131 Parmak Tipi D\xFCzenleyici",
      u: 2,
      category: "organizer",
      logo: "ORGANIZER",
      modelTag: "2U FINGER-DUCT ORGANIZER",
      desc: "Y\xFCksek kapasiteli, \xF6n kapakl\u0131 parmak tipi (finger duct) 2U organizer.",
      ports: []
    },
    "blank-panel-1u": {
      name: "1U Bo\u015Fluk Kapatma Paneli",
      u: 1,
      category: "blank",
      logo: "BLANK",
      modelTag: "1U BLANKING PANEL",
      desc: "Hava ak\u0131\u015F\u0131n\u0131 y\xF6nlendirmek ve bo\u015F U yuvalar\u0131n\u0131 kapatmak i\xE7in k\xF6r panel.",
      ports: []
    }
  };
  var BUILTIN_KEYS = new Set(Object.keys(HARDWARE_CATALOG));

  // js/src/2d/utils.js
  var escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);
  var portKey = (instanceId, portId) => JSON.stringify([instanceId, portId]);
  function showTemporaryTooltip(x, y, msg, domTooltip) {
    const el = domTooltip || document.getElementById("tooltip");
    if (!el) return;
    el.style.display = "block";
    el.style.left = `${x + 10}px`;
    el.style.top = `${y + 10}px`;
    el.innerHTML = `<span style="color:#f59e0b;">&#9888; ${msg}</span>`;
    setTimeout(() => {
      if (el) el.style.display = "none";
    }, 2500);
  }

  // js/src/2d/state.js
  var STATE = {
    customCatalog: {},
    racks: [
      {
        id: "rack-1",
        name: "MDF - Ana Omurga & Da\u011F\u0131t\u0131m Kabini",
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ],
    activeRackId: "rack-1",
    cables: [],
    cableCounter: 0,
    rackCounter: 1,
    selectedLibraryItem: null,
    selectedCableColor: "#2563eb",
    cableRoutingMode: "structured",
    viewMode: "multi",
    // 'multi' (side-by-side all racks) or 'single' (focused on active rack)
    pendingConnection: null,
    // { rackId, instanceId, portId, element }
    highlightedCableId: null
  };
  function getActiveRack() {
    let r = STATE.racks.find((rack) => rack.id === STATE.activeRackId);
    if (!r && STATE.racks.length > 0) {
      r = STATE.racks[0];
      STATE.activeRackId = r.id;
    }
    return r;
  }
  var ZOOM_STATE = {
    scale: 1,
    panX: 0,
    panY: 0,
    minScale: 0.1,
    maxScale: 3.5,
    isPanning: false,
    startX: 0,
    startY: 0,
    hasMoved: false,
    isFit: true
  };
  var dom = {
    railLeft: null,
    railRight: null,
    rackSpace: null,
    rackContainer: null,
    viewportCanvas: null,
    rackStage: null,
    cablesSvg: null,
    cablesGroup: null,
    connectorsGroup: null,
    dringOverlayGroup: null,
    scheduleTbody: null,
    cableCountLabel: null,
    connectionStatusHint: null,
    inspectorInfo: null,
    tooltip: null,
    statusSelectionText: null,
    fileImport: null,
    btnExportVisio: null,
    btnExportJson: null,
    btnImportJson: null,
    btnPresetMdf: null,
    btnPresetIdf: null,
    btnPresetSite: null,
    btnClearAll: null,
    btnClearCables: null,
    btnZoomIn: null,
    btnZoomOut: null,
    btnZoomFit: null,
    btnZoomActual: null,
    zoomBadge: null,
    navJumpTop: null,
    navJumpMid: null,
    navJumpBot: null,
    btnRouteStructured: null,
    btnRouteDirect: null,
    btnTidyCables: null,
    rackTabsList: null,
    btnAddRack: null,
    btnRenameRack: null,
    btnViewModeSingle: null,
    btnViewModeMulti: null
  };
  function initDomReferences() {
    dom.railLeft = document.getElementById("rail-left");
    dom.railRight = document.getElementById("rail-right");
    dom.rackSpace = document.getElementById("rack-space");
    dom.rackContainer = document.getElementById("rack-container");
    dom.viewportCanvas = document.getElementById("viewport-canvas");
    dom.rackStage = document.getElementById("rack-stage");
    dom.cablesSvg = document.getElementById("cables-svg");
    dom.cablesGroup = document.getElementById("cables-group");
    dom.connectorsGroup = document.getElementById("connectors-group");
    dom.dringOverlayGroup = document.getElementById("dring-overlay-group");
    dom.scheduleTbody = document.getElementById("schedule-tbody");
    dom.cableCountLabel = document.getElementById("cable-count-label");
    dom.connectionStatusHint = document.getElementById("connection-status-hint");
    dom.inspectorInfo = document.getElementById("inspector-info");
    dom.tooltip = document.getElementById("tooltip");
    dom.statusSelectionText = document.getElementById("status-selection-text");
    dom.fileImport = document.getElementById("file-import");
    dom.btnExportVisio = document.getElementById("btn-export-visio");
    dom.btnExportJson = document.getElementById("btn-export-json");
    dom.btnImportJson = document.getElementById("btn-import-json");
    dom.btnPresetMdf = document.getElementById("btn-preset-mdf");
    dom.btnPresetIdf = document.getElementById("btn-preset-idf");
    dom.btnPresetSite = document.getElementById("btn-preset-site");
    dom.btnClearAll = document.getElementById("btn-clear-all");
    dom.btnClearCables = document.getElementById("btn-clear-cables");
    dom.btnZoomIn = document.getElementById("btn-zoom-in");
    dom.btnZoomOut = document.getElementById("btn-zoom-out");
    dom.btnZoomFit = document.getElementById("btn-zoom-fit");
    dom.btnZoomActual = document.getElementById("btn-zoom-actual");
    dom.zoomBadge = document.getElementById("zoom-badge");
    dom.navJumpTop = document.getElementById("nav-jump-top");
    dom.navJumpMid = document.getElementById("nav-jump-mid");
    dom.navJumpBot = document.getElementById("nav-jump-bot");
    dom.btnRouteStructured = document.getElementById("btn-route-structured");
    dom.btnRouteDirect = document.getElementById("btn-route-direct");
    dom.btnTidyCables = document.getElementById("btn-tidy-cables");
    dom.rackTabsList = document.getElementById("rack-tabs-list");
    dom.btnAddRack = document.getElementById("btn-add-rack");
    dom.btnRenameRack = document.getElementById("btn-rename-rack");
    dom.btnViewModeSingle = document.getElementById("btn-view-mode-single");
    dom.btnViewModeMulti = document.getElementById("btn-view-mode-multi");
  }

  // js/src/2d/scheduleTable.js
  function setConnectionRole(cableId, newRole) {
    const cable = STATE.cables.find((c) => c.id === cableId);
    if (!cable) return;
    const ROLE_COLORS = {
      trunk: "#a855f7",
      uplink: "#00d2ff",
      poe: "#f59e0b",
      mgmt: "#10b981",
      management: "#10b981",
      standard: STATE.selectedCableColor || "#2563eb"
    };
    const isStandard = !newRole || newRole === "standard" || newRole === "access";
    const roleKey = isStandard ? null : newRole.toLowerCase();
    const resolvedColor = isStandard ? STATE.selectedCableColor || "#2563eb" : ROLE_COLORS[roleKey] || "#a855f7";
    cable.role = roleKey;
    cable.color = resolvedColor;
    if (roleKey === "trunk") {
      if (!cable.name.startsWith("[TRUNK]")) {
        cable.name = `[TRUNK] ${cable.id}`;
      }
    } else {
      cable.name = (cable.name || "").replace(/^\[TRUNK\]\s*/i, "");
    }
    let devA = null, devB = null;
    (STATE.racks || []).forEach((r) => {
      if (!devA) devA = r.devices?.find((d) => d.instanceId === cable.from.instanceId);
      if (!devB) devB = r.devices?.find((d) => d.instanceId === cable.to.instanceId);
    });
    if (devA) {
      if (!devA.portsConfig) devA.portsConfig = {};
      const pIdA = cable.from.portId;
      const pNumA = String(pIdA).replace("p", "");
      if (isStandard) {
        delete devA.portsConfig[pIdA];
        delete devA.portsConfig[pNumA];
      } else {
        const cfg = { role: roleKey, isTrunk: roleKey === "trunk", color: resolvedColor, autoCableColor: true };
        devA.portsConfig[pIdA] = cfg;
        devA.portsConfig[pNumA] = cfg;
      }
    }
    if (devB) {
      if (!devB.portsConfig) devB.portsConfig = {};
      const pIdB = cable.to.portId;
      const pNumB = String(pIdB).replace("p", "");
      if (isStandard) {
        delete devB.portsConfig[pIdB];
        delete devB.portsConfig[pNumB];
      } else {
        const cfg = { role: roleKey, isTrunk: roleKey === "trunk", color: resolvedColor, autoCableColor: true };
        devB.portsConfig[pIdB] = cfg;
        devB.portsConfig[pNumB] = cfg;
      }
    }
    if (window.__STUDIO3D__ && window.__STUDIO3D__.updatePortConfig) {
      try {
        const portIdxA = parseInt(String(cable.from.portId).replace("p", ""), 10) || 1;
        const portIdxB = parseInt(String(cable.to.portId).replace("p", ""), 10) || 1;
        const dev3DA = devA?.id || devA?.instanceId;
        const dev3DB = devB?.id || devB?.instanceId;
        if (dev3DA) window.__STUDIO3D__.updatePortConfig(dev3DA, portIdxA, isStandard ? null : { role: roleKey, isTrunk: roleKey === "trunk", color: resolvedColor });
        if (dev3DB) window.__STUDIO3D__.updatePortConfig(dev3DB, portIdxB, isStandard ? null : { role: roleKey, isTrunk: roleKey === "trunk", color: resolvedColor });
      } catch (e) {
        console.warn("3D sync warning:", e);
      }
    }
    if (typeof window.sync2Dto3D === "function") {
      try {
        window.sync2Dto3D();
      } catch (e) {
      }
    }
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent("rackstudio:refresh"));
  }
  function showRolePickerPopover(triggerBtn, cableId, currentRole) {
    document.querySelectorAll(".role-picker-popover").forEach((p) => p.remove());
    const popover = document.createElement("div");
    popover.className = "role-picker-popover";
    popover.innerHTML = `
      <div class="role-picker-title">Ba\u011Flant\u0131 Rol\xFC &amp; Renk</div>
      <div class="role-picker-item ${currentRole === "trunk" ? "active" : ""}" data-role="trunk">
        <span class="role-badge-preview trunk">T</span>
        <div class="role-text-group">
          <span class="role-label">TRUNK (802.1Q)</span>
          <span class="role-hint">Mor (#a855f7) \xB7 VLAN Omurga</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === "uplink" ? "active" : ""}" data-role="uplink">
        <span class="role-badge-preview uplink">\u25B2</span>
        <div class="role-text-group">
          <span class="role-label">UPLINK (Core/Dist)</span>
          <span class="role-hint">Cyan (#00d2ff) \xB7 \xDCst \xC7\u0131k\u0131\u015F</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === "poe" ? "active" : ""}" data-role="poe">
        <span class="role-badge-preview poe">\u26A1</span>
        <div class="role-text-group">
          <span class="role-label">PoE (802.3af/at)</span>
          <span class="role-hint">Kehribar (#f59e0b) \xB7 G\xFC\xE7</span>
        </div>
      </div>
      <div class="role-picker-item ${currentRole === "mgmt" || currentRole === "management" ? "active" : ""}" data-role="mgmt">
        <span class="role-badge-preview mgmt">M</span>
        <div class="role-text-group">
          <span class="role-label">MGMT (Y\xF6netim)</span>
          <span class="role-hint">Ye\u015Fil (#10b981) \xB7 OOB Portu</span>
        </div>
      </div>
      <div class="role-picker-sep"></div>
      <div class="role-picker-item ${!currentRole || currentRole === "standard" ? "active" : ""}" data-role="standard">
        <span class="role-badge-preview standard">\u2014</span>
        <div class="role-text-group">
          <span class="role-label">Standart Ba\u011Flant\u0131</span>
          <span class="role-hint">\xD6zel Rol\xFC S\u0131f\u0131rla \xB7 Standart Mavi</span>
        </div>
      </div>
    `;
    document.body.appendChild(popover);
    const rect = triggerBtn.getBoundingClientRect();
    let top = rect.bottom + 4;
    let left = rect.right - 200;
    if (top + 230 > window.innerHeight && rect.top > 240) {
      top = rect.top - 225;
    }
    top = Math.max(10, Math.min(top, window.innerHeight - 240));
    left = Math.max(10, Math.min(left, window.innerWidth - 220));
    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.querySelectorAll(".role-picker-item").forEach((item) => {
      item.addEventListener("click", (e) => {
        e.stopPropagation();
        const newRole = item.dataset.role;
        popover.remove();
        setConnectionRole(cableId, newRole);
      });
    });
    const outsideClick = (e) => {
      if (!popover.contains(e.target) && e.target !== triggerBtn) {
        popover.remove();
        document.removeEventListener("click", outsideClick);
      }
    };
    setTimeout(() => document.addEventListener("click", outsideClick), 0);
  }
  var schedulePage = 0;
  var SCHEDULE_PAGE_SIZE = 100;
  function renderScheduleTable() {
    if (!dom.scheduleTbody) return;
    dom.scheduleTbody.innerHTML = "";
    let pager = document.getElementById("schedule-pagination");
    if (!pager) {
      pager = document.createElement("div");
      pager.id = "schedule-pagination";
      pager.style.cssText = "display:flex;gap:8px;align-items:center;padding:8px;font-size:12px;";
      const previous = document.createElement("button");
      previous.type = "button";
      previous.textContent = "\u2190 \xD6nceki";
      const label = document.createElement("span");
      label.className = "schedule-page-label";
      label.setAttribute("aria-live", "polite");
      const next = document.createElement("button");
      next.type = "button";
      next.textContent = "Sonraki \u2192";
      previous.addEventListener("click", () => {
        schedulePage--;
        renderScheduleTable();
      });
      next.addEventListener("click", () => {
        schedulePage++;
        renderScheduleTable();
      });
      pager.append(previous, label, next);
      dom.scheduleTbody.closest("table").before(pager);
    }
    const pages = Math.max(1, Math.ceil(STATE.cables.length / SCHEDULE_PAGE_SIZE));
    schedulePage = Math.max(0, Math.min(schedulePage, pages - 1));
    pager.querySelector(".schedule-page-label").textContent = schedulePage + 1 + " / " + pages + " \xB7 " + STATE.cables.length + " ba\u011Flant\u0131";
    pager.firstElementChild.disabled = schedulePage === 0;
    pager.lastElementChild.disabled = schedulePage === pages - 1;
    if (dom.cableCountLabel) {
      dom.cableCountLabel.textContent = `${STATE.cables.length} Ba\u011Flant\u0131 Yap\u0131ld\u0131`;
    }
    if (STATE.cables.length === 0) {
      dom.scheduleTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:#64748b; padding:20px;">
            Hen\xFCz kablo ba\u011Flant\u0131s\u0131 yap\u0131lmad\u0131.
          </td>
        </tr>
      `;
      return;
    }
    STATE.cables.slice(schedulePage * SCHEDULE_PAGE_SIZE, (schedulePage + 1) * SCHEDULE_PAGE_SIZE).forEach((c) => {
      const rackA = STATE.racks.find((r) => r.id === c.from.rackId);
      const rackB = STATE.racks.find((r) => r.id === c.to.rackId);
      const devA = rackA ? rackA.devices.find((d) => d.instanceId === c.from.instanceId) : null;
      const devB = rackB ? rackB.devices.find((d) => d.instanceId === c.to.instanceId) : null;
      const catA = devA ? HARDWARE_CATALOG[devA.catalogKey] : null;
      const catB = devB ? HARDWARE_CATALOG[devB.catalogKey] : null;
      const portA = catA ? catA.ports.find((p) => p.id === c.from.portId) : null;
      const portB = catB ? catB.ports.find((p) => p.id === c.to.portId) : null;
      const isInterRack = c.from.rackId !== c.to.rackId;
      const tr = document.createElement("tr");
      tr.dataset.cableId = c.id;
      if (c.id === STATE.highlightedCableId) tr.className = "active";
      const rackShortA = rackA ? rackA.name.length > 10 ? rackA.name.slice(0, 10) + "\u2026" : rackA.name : "Kabin";
      const rackShortB = rackB ? rackB.name.length > 10 ? rackB.name.slice(0, 10) + "\u2026" : rackB.name : "Kabin";
      const sourcePortCfg = devA?.portsConfig && (devA.portsConfig[c.from.portId] || devA.portsConfig[String(c.from.portId).replace("p", "")]);
      const targetPortCfg = devB?.portsConfig && (devB.portsConfig[c.to.portId] || devB.portsConfig[String(c.to.portId).replace("p", "")]);
      const portRole = (c.role || sourcePortCfg && sourcePortCfg.role || targetPortCfg && targetPortCfg.role || portA && portA.role || portB && portB.role || "").toLowerCase();
      let roleTriggerHtml = "";
      if (portRole === "trunk") {
        roleTriggerHtml = `<button type="button" class="role-select-trigger trunk" data-cable-id="${c.id}" title="Ba\u011Flant\u0131 Rol\xFCn\xFC De\u011Fi\u015Ftir"><span class="role-tag">T</span>TRUNK \u25BE</button>`;
      } else if (portRole === "uplink") {
        roleTriggerHtml = `<button type="button" class="role-select-trigger uplink" data-cable-id="${c.id}" title="Ba\u011Flant\u0131 Rol\xFCn\xFC De\u011Fi\u015Ftir"><span class="role-tag">\u25B2</span>UPLINK \u25BE</button>`;
      } else if (portRole === "poe") {
        roleTriggerHtml = `<button type="button" class="role-select-trigger poe" data-cable-id="${c.id}" title="Ba\u011Flant\u0131 Rol\xFCn\xFC De\u011Fi\u015Ftir"><span class="role-tag">\u26A1</span>PoE \u25BE</button>`;
      } else if (portRole === "mgmt" || portRole === "management") {
        roleTriggerHtml = `<button type="button" class="role-select-trigger mgmt" data-cable-id="${c.id}" title="Ba\u011Flant\u0131 Rol\xFCn\xFC De\u011Fi\u015Ftir"><span class="role-tag">M</span>MGMT \u25BE</button>`;
      } else {
        roleTriggerHtml = `<button type="button" class="role-select-trigger standard" data-cable-id="${c.id}" title="\xD6zel Rol Tan\u0131mla"><span class="role-tag">+</span>Rol Ata \u25BE</button>`;
      }
      const portTypeA = portA?.type === "fiber" || portA?.type === "lc" || portA?.type === "sfp" ? "fiber" : "copper";
      const portTypeB = portB?.type === "fiber" || portB?.type === "lc" || portB?.type === "sfp" ? "fiber" : "copper";
      const displayName = c.name && !c.name.includes("\u2192") ? c.name : c.id || c.name || "CBL";
      tr.innerHTML = `
        <td>
          <div class="cable-pill-cell">
            <span class="cable-color-dot" style="background:${c.color};box-shadow:0 0 6px ${c.color};"></span>
            <span class="cable-id-badge" title="${escapeHtml(c.name || c.id)}">${escapeHtml(displayName)}</span>
          </div>
        </td>
        <td>
          <div class="route-flow-cell" title="${escapeHtml(catA ? catA.name : "")} (${escapeHtml(portA ? portA.name : c.from.portId)}) \u2794 ${escapeHtml(catB ? catB.name : "")} (${escapeHtml(portB ? portB.name : c.to.portId)})">
            <div class="endpoint-badge clickable-endpoint" data-instance-id="${c.from.instanceId}" data-port-id="${c.from.portId}" title="Kaynak Port Ayarlar\u0131 / Odaklan">
              ${isInterRack && rackA ? `<span class="inter-rack-tag" title="${escapeHtml(rackA.name)}">${escapeHtml(rackShortA)}</span>` : ""}
              <span class="badge-u">U${devA ? devA.topU : "?"}</span>
              <span class="badge-port ${portTypeA}">${escapeHtml(portA ? portA.name : c.from.portId)}</span>
            </div>
            <span class="route-arrow" aria-hidden="true">\u2794</span>
            <div class="endpoint-badge clickable-endpoint" data-instance-id="${c.to.instanceId}" data-port-id="${c.to.portId}" title="Hedef Port Ayarlar\u0131 / Odaklan">
              ${isInterRack && rackB ? `<span class="inter-rack-tag" title="${escapeHtml(rackB.name)}">${escapeHtml(rackShortB)}</span>` : ""}
              <span class="badge-u">U${devB ? devB.topU : "?"}</span>
              <span class="badge-port ${portTypeB}">${escapeHtml(portB ? portB.name : c.to.portId)}</span>
            </div>
          </div>
        </td>
        <td>
          ${roleTriggerHtml}
        </td>
        <td><span class="metraj-badge">${c.lengthMeters}m</span></td>
        <td>
          <button class="del-cable-btn" data-cable-id="${c.id}" title="Kabloyu S\xF6k (Delete)">\u2702\uFE0F</button>
        </td>
      `;
      tr.addEventListener("click", (e) => {
        if (e.target.closest(".del-cable-btn") || e.target.closest(".role-select-trigger") || e.target.closest(".clickable-endpoint")) return;
        highlightCable(c.id);
      });
      tr.addEventListener("dblclick", (e) => {
        if (e.target.closest(".del-cable-btn") || e.target.closest(".role-select-trigger") || e.target.closest(".clickable-endpoint")) return;
        e.preventDefault();
        renameCable2D(c.id);
      });
      const roleBtn = tr.querySelector(".role-select-trigger");
      if (roleBtn) {
        roleBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          showRolePickerPopover(roleBtn, c.id, portRole);
        });
      }
      tr.querySelectorAll(".clickable-endpoint").forEach((ep) => {
        ep.addEventListener("click", (e) => {
          e.stopPropagation();
          const instId = ep.dataset.instanceId;
          const pId = ep.dataset.portId;
          if (window.PortConfigEditor) {
            window.PortConfigEditor.open(instId, pId, "2d");
          }
        });
      });
      const delBtn = tr.querySelector(".del-cable-btn");
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        STATE.cables = STATE.cables.filter((item) => item.id !== c.id);
        if (STATE.highlightedCableId === c.id) STATE.highlightedCableId = null;
        renderMountedDevices();
        renderScheduleTable();
        renderAllCables();
      });
      dom.scheduleTbody.appendChild(tr);
    });
  }

  // js/src/2d/cablingEngine.js
  function cancelPendingConnection() {
    if (STATE.pendingConnection && STATE.pendingConnection.element) {
      STATE.pendingConnection.element.classList.remove("selected");
    }
    STATE.pendingConnection = null;
    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = "Ba\u011Flamak i\xE7in <b>Kaynak Porta</b> t\u0131klay\u0131n";
    }
  }
  function getNextCableId2() {
    STATE.cableCounter++;
    return "CBL-" + String(STATE.cableCounter).padStart(3, "0");
  }
  function getCableEndpointInfo(activeRack, endpoint) {
    const instanceId = endpoint.instanceId || endpoint.deviceId;
    let device = null;
    let catalog = null;
    for (const rack of STATE.racks || [activeRack]) {
      const found = rack.devices.find((d) => d.instanceId === instanceId);
      if (found) {
        device = found;
        catalog = HARDWARE_CATALOG[found.catalogKey];
        break;
      }
    }
    if (!device) {
      device = activeRack.devices.find((d) => d.instanceId === instanceId);
      catalog = device ? HARDWARE_CATALOG[device.catalogKey] : null;
    }
    const port = catalog && Array.isArray(catalog.ports) ? catalog.ports.find((p) => p.id === endpoint.portId) || catalog.ports[(Number(endpoint.portIdx) || 1) - 1] : null;
    const deviceName = device && (device.name || device.hostname) || catalog && (catalog.modelTag || catalog.name) || "Cihaz";
    const portName = port && (port.name || port.id) || endpoint.portId || `Port ${endpoint.portIdx || "?"}`;
    return { deviceName, portName };
  }
  function getCableLabel(activeRack, cable) {
    const from = getCableEndpointInfo(activeRack, cable.from);
    const to = getCableEndpointInfo(activeRack, cable.to);
    const endpoints = `${from.deviceName} / ${from.portName} \u2192 ${to.deviceName} / ${to.portName}`;
    return cable.name ? `${cable.name}: ${endpoints}` : endpoints;
  }
  function renameCable2D(cableId) {
    const cable = STATE.cables.find((item) => item.id === cableId);
    if (!cable) return;
    const nextName = prompt("Kablo Ad\u0131 / Etiketi:", cable.name || cable.id);
    if (nextName === null) return;
    const normalizedName = nextName.trim();
    if (!normalizedName) {
      showTemporaryTooltip(window.innerWidth / 2, 80, "Kablo ad\u0131 bo\u015F b\u0131rak\u0131lamaz.");
      return;
    }
    cable.name = normalizedName;
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent("rackstudio:refresh"));
  }
  function getActiveOrganizers(activeRack) {
    if (!activeRack || !activeRack.devices) return [];
    return activeRack.devices.filter((dev) => {
      const cat = HARDWARE_CATALOG[dev.catalogKey];
      return cat && (dev.catalogKey.includes("organizer") || cat.modelTag && (cat.modelTag.includes("D-RING") || cat.modelTag.includes("ORGANIZER") || cat.modelTag.includes("DUCT") || cat.modelTag.includes("BRUSH")) || cat.name && (cat.name.toLowerCase().includes("organizer") || cat.name.toLowerCase().includes("d-ring")));
    });
  }
  function findDeviceOrganizer(activeRack, dev) {
    const orgs = getActiveOrganizers(activeRack);
    if (!orgs.length || !dev) return null;
    const devTop = Number(dev.topU);
    const devBot = devTop - Number(dev.uHeight || 1) + 1;
    const directlyBelow = orgs.find((org) => Number(org.topU) === devBot - 1);
    if (directlyBelow) return directlyBelow;
    const directlyAbove = orgs.find((org) => Number(org.topU) === devTop + 1);
    if (directlyAbove) return directlyAbove;
    let nearest = null;
    let minDiff = Infinity;
    orgs.forEach((org) => {
      const orgTop = Number(org.topU);
      const diff = Math.min(Math.abs(orgTop - devTop), Math.abs(orgTop - devBot));
      if (diff < minDiff && diff <= 3) {
        minDiff = diff;
        nearest = org;
      }
    });
    return nearest;
  }
  function renderDRingOverlays(activeRack) {
    if (!dom.dringOverlayGroup) return;
    dom.dringOverlayGroup.innerHTML = "";
    const drings = getActiveOrganizers(activeRack).filter((dev) => {
      const cat = HARDWARE_CATALOG[dev.catalogKey];
      return dev.catalogKey === "organizer-dring-1u" || cat && cat.modelTag && cat.modelTag.includes("D-RING") || cat && cat.name && cat.name.toLowerCase().includes("d-ring") || dev.catalogKey && dev.catalogKey.includes("dring");
    });
    if (!drings.length) return;

    const svgEl = dom.cablesSvg || document.getElementById("cables-svg");
    const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
    if (!svgRect || svgRect.width <= 0) return;

    const activeRackForSize = getActiveRack();
    const totalU = Number(activeRackForSize?.heightU || 42);
    const rackHeight = totalU * 32;
    const scaleX = svgRect.width / 618;
    const scaleY = svgRect.height / rackHeight;

    drings.forEach((org) => {
      const orgEl = document.getElementById(org.instanceId);
      if (!orgEl) return;

      const brackets = orgEl.querySelectorAll(".dring-loop");
      if (brackets && brackets.length > 0) {
        brackets.forEach((loopEl) => {
          const loopRect = loopEl.getBoundingClientRect();
          if (loopRect.width === 0) return;

          const cx = (loopRect.left + loopRect.width / 2 - svgRect.left) / scaleX;
          const cy = (loopRect.top + loopRect.height / 2 - svgRect.top) / scaleY;
          const w = loopRect.width / scaleX;
          const h = loopRect.height / scaleY;
          const loopX = cx - w / 2;
          const loopY = cy - h / 2;
          const pillarW = Math.max(3.5, w * 0.115);

          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g.setAttribute("class", "dring-svg-bracket");
          g.setAttribute("style", "pointer-events:none;");

          const leftPillar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          leftPillar.setAttribute("x", loopX);
          leftPillar.setAttribute("y", loopY);
          leftPillar.setAttribute("width", pillarW);
          leftPillar.setAttribute("height", h);
          leftPillar.setAttribute("rx", "1.5");
          leftPillar.setAttribute("fill", "#334155");
          leftPillar.setAttribute("stroke", "#475569");
          leftPillar.setAttribute("stroke-width", "0.6");
          g.appendChild(leftPillar);

          const rightPillar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          rightPillar.setAttribute("x", loopX + w - pillarW);
          rightPillar.setAttribute("y", loopY);
          rightPillar.setAttribute("width", pillarW);
          rightPillar.setAttribute("height", h);
          rightPillar.setAttribute("rx", "1.5");
          rightPillar.setAttribute("fill", "#334155");
          rightPillar.setAttribute("stroke", "#475569");
          rightPillar.setAttribute("stroke-width", "0.6");
          g.appendChild(rightPillar);

          const clipW = Math.max(10, w * 0.37);
          const clip = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          clip.setAttribute("x", cx - clipW / 2);
          clip.setAttribute("y", loopY - 1.2);
          clip.setAttribute("width", clipW);
          clip.setAttribute("height", "2.5");
          clip.setAttribute("rx", "1");
          clip.setAttribute("fill", "#64748b");
          g.appendChild(clip);

          dom.dringOverlayGroup.appendChild(g);
        });
      } else {
        // Fallback: U-position arithmetic
        const topU = Number(org.topU || 1);
        const uH = Number(org.uHeight || 1);
        const centerY = (42 - topU) * 32 + uH * 32 / 2;
        const ringXs = [111.4, 210.2, 309, 407.8, 506.6];
        const ringW = 38;
        const ringH = 24;
        ringXs.forEach((rx) => {
          const loopX = rx - ringW / 2;
          const loopY = centerY - ringH / 2;
          const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
          g.setAttribute("class", "dring-svg-bracket");
          g.setAttribute("style", "pointer-events:none;");
          const leftPillar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          leftPillar.setAttribute("x", loopX);
          leftPillar.setAttribute("y", loopY);
          leftPillar.setAttribute("width", "4.5");
          leftPillar.setAttribute("height", ringH);
          leftPillar.setAttribute("rx", "1.5");
          leftPillar.setAttribute("fill", "#334155");
          leftPillar.setAttribute("stroke", "#475569");
          leftPillar.setAttribute("stroke-width", "0.6");
          g.appendChild(leftPillar);
          const rightPillar = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          rightPillar.setAttribute("x", loopX + ringW - 4.5);
          rightPillar.setAttribute("y", loopY);
          rightPillar.setAttribute("width", "4.5");
          rightPillar.setAttribute("height", ringH);
          rightPillar.setAttribute("rx", "1.5");
          rightPillar.setAttribute("fill", "#334155");
          rightPillar.setAttribute("stroke", "#475569");
          rightPillar.setAttribute("stroke-width", "0.6");
          g.appendChild(rightPillar);
          const clip = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          clip.setAttribute("x", loopX + 12);
          clip.setAttribute("y", loopY - 1);
          clip.setAttribute("width", "14");
          clip.setAttribute("height", "2.5");
          clip.setAttribute("rx", "1");
          clip.setAttribute("fill", "#64748b");
          g.appendChild(clip);
          dom.dringOverlayGroup.appendChild(g);
        });
      }
    });
  }
  function renderAllCables() {
    const cablesGroup = dom.cablesGroup || document.getElementById("cables-group");
    const connectorsGroup = dom.connectorsGroup || document.getElementById("connectors-group");
    if (!cablesGroup) return;
    cablesGroup.innerHTML = "";
    if (connectorsGroup) connectorsGroup.innerHTML = "";
    const svgEl = dom.cablesSvg || document.getElementById("cables-svg");
    const svgRect = svgEl ? svgEl.getBoundingClientRect() : null;
    if (!svgRect || svgRect.width <= 0) return;
    const isMulti = STATE.viewMode === "multi" && STATE.racks && STATE.racks.length > 1;
    const activeRack = getActiveRack();
    let svgW = 618;
    let svgH = (activeRack?.heightU || 42) * 32;
    if (isMulti) {
      const numRacks = STATE.racks.length;
      const maxU = Math.max(...STATE.racks.map((r) => r.heightU || 42));
      svgW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      svgH = maxU * 32 + 156;
    }
    if (svgEl) {
      svgEl.setAttribute("viewBox", `0 0 ${svgW} ${svgH}`);
    }
    const scaleX = svgRect.width / svgW;
    const scaleY = svgRect.height / svgH;
    const portRects = /* @__PURE__ */ new Map();
    function getPortRect(el) {
      if (!el) return null;
      const key = el.id || el;
      let r = portRects.get(key);
      if (!r) {
        r = el.getBoundingClientRect();
        portRects.set(key, r);
      }
      return r;
    }
    let leftChannelUsage = 0;
    let rightChannelUsage = 0;
    STATE.cables.forEach((cable) => {
      const instA = cable.from.instanceId || cable.from.deviceId;
      const instB = cable.to.instanceId || cable.to.deviceId;
      const portIdA = cable.from.portId || "p" + cable.from.portIdx;
      const portIdB = cable.to.portId || "p" + cable.to.portIdx;
      let portFromEl = document.getElementById(`port-${instA}-${portIdA}`);
      let portToEl = document.getElementById(`port-${instB}-${portIdB}`);
      if (!portFromEl) {
        portFromEl = document.querySelector(`.port[data-instance-id="${instA}"][data-port-id="${portIdA}"]`) || document.querySelector(`.port[data-instance-id="${instA}"]`);
      }
      if (!portToEl) {
        portToEl = document.querySelector(`.port[data-instance-id="${instB}"][data-port-id="${portIdB}"]`) || document.querySelector(`.port[data-instance-id="${instB}"]`);
      }
      if (!portFromEl || !portToEl) return;
      const rectA = getPortRect(portFromEl);
      const rectB = getPortRect(portToEl);
      if (!rectA || !rectB) return;
      if (rectA.width === 0 && rectA.height === 0 && rectB.width === 0 && rectB.height === 0) return;
      const x1 = (rectA.left + rectA.width / 2 - svgRect.left) / scaleX;
      const y1 = (rectA.top + rectA.height / 2 - svgRect.top) / scaleY;
      const x2 = (rectB.left + rectB.width / 2 - svgRect.left) / scaleX;
      const y2 = (rectB.top + rectB.height / 2 - svgRect.top) / scaleY;
      const dy = Math.abs(y2 - y1);
      const dx = Math.abs(x2 - x1);
      let pathD = "";
      const isInterRack = cable.from.rackId !== cable.to.rackId;
      if (isInterRack) {
        const overheadY = Math.min(y1, y2) - 80 - leftChannelUsage++ % 6 * 8;
        pathD = `M ${x1} ${y1} C ${x1} ${overheadY}, ${x2} ${overheadY}, ${x2} ${y2}`;
      } else if (STATE.cableRoutingMode === "structured") {
        const devA = STATE.racks.flatMap((r) => r.devices).find((d) => d.instanceId === instA);
        const devB = STATE.racks.flatMap((r) => r.devices).find((d) => d.instanceId === instB);
        const rackA = STATE.racks.find((r) => r.id === cable.from.rackId) || activeRack;
        if (instA === instB) {
          const loopSide = x1 > 300 ? 12 : -12;
          pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
        } else {
          const orgA = findDeviceOrganizer(rackA, devA);
          const orgB = findDeviceOrganizer(rackA, devB);
          const getOrgY = (org, fallbackY, otherY) => {
            if (org) {
              const orgEl = document.getElementById(org.instanceId);
              if (orgEl) {
                const r = orgEl.getBoundingClientRect();
                return (r.top + r.height / 2 - svgRect.top) / scaleY;
              }
            }
            return fallbackY + (otherY >= fallbackY ? 14 : -14);
          };
          let trayYA = getOrgY(orgA, y1, y2);
          let trayYB = getOrgY(orgB, y2, y1);
          if (orgA && orgB && orgA.instanceId === orgB.instanceId) {
            const orgCenterY = trayYA;
            const isATop = Number(devA?.topU || 0) >= Number(devB?.topU || 0);
            trayYA = orgCenterY + (isATop ? -6 : 6);
            trayYB = orgCenterY + (isATop ? 6 : -6);
          }
          const avgX = (x1 + x2) / 2;

          // Dynamic channel X: read actual rack container edges from DOM
          // This is critical for multi-rack mode where each rack has a different horizontal offset
          let rackLeftEdge = 23;
          let rackRightEdge = 595;
          const rackContEl = document.getElementById(rackA?.id === STATE.activeRackId ? "rack-container" : `rack-container-${rackA?.id}`);
          if (rackContEl && svgRect) {
            const rc = rackContEl.getBoundingClientRect();
            rackLeftEdge = (rc.left - svgRect.left) / scaleX + 14;
            rackRightEdge = (rc.right - svgRect.left) / scaleX - 14;
          }

          const useRightChannel = avgX > (rackLeftEdge + rackRightEdge) / 2;
          const channelBase = useRightChannel ? rackRightEdge : rackLeftEdge;
          const bundleIdx = useRightChannel ? rightChannelUsage++ : leftChannelUsage++;
          const railOffset = (bundleIdx % 7 - 3) * 4.2;
          const channelX = channelBase + railOffset;
          const trayOffsetA = (bundleIdx % 5 - 2) * 2.5;
          const trayOffsetB = (bundleIdx % 5 - 2) * 2.5;
          const actualTrayYA = trayYA + trayOffsetA;
          const actualTrayYB = trayYB + trayOffsetB;
          const dirY1 = actualTrayYA >= y1 ? 1 : -1;
          const dirX1 = channelX >= x1 ? 1 : -1;
          const r1 = Math.min(8, Math.abs(channelX - x1) / 2, Math.abs(actualTrayYA - y1) / 2);
          const dirY_rail = actualTrayYB >= actualTrayYA ? 1 : -1;
          const distRailY = Math.abs(actualTrayYB - actualTrayYA);
          const rRail1 = Math.min(10, Math.abs(channelX - x1) / 2, distRailY / 2 || 6);
          const dirX2 = x2 >= channelX ? 1 : -1;
          const rRail2 = Math.min(10, Math.abs(x2 - channelX) / 2, distRailY / 2 || 6);
          const dirY2 = y2 >= actualTrayYB ? 1 : -1;
          const r2 = Math.min(8, Math.abs(x2 - channelX) / 2, Math.abs(y2 - actualTrayYB) / 2);
          pathD = `M ${x1} ${y1} L ${x1} ${actualTrayYA - dirY1 * r1} Q ${x1} ${actualTrayYA} ${x1 + dirX1 * r1} ${actualTrayYA} L ${channelX - dirX1 * rRail1} ${actualTrayYA} Q ${channelX} ${actualTrayYA} ${channelX} ${actualTrayYA + dirY_rail * rRail1} L ${channelX} ${actualTrayYB - dirY_rail * rRail2} Q ${channelX} ${actualTrayYB} ${channelX + dirX2 * rRail2} ${actualTrayYB} L ${x2 - dirX2 * r2} ${actualTrayYB} Q ${x2} ${actualTrayYB} ${x2} ${actualTrayYB + dirY2 * r2} L ${x2} ${y2}`;
        }
      } else {
        const ymid = (y1 + y2) / 2;
        const tightSag = Math.min(22, Math.max(8, dy * 0.12));
        const cp1x = x1 + (x2 - x1) * 0.25;
        const cp1y = ymid + (y2 >= y1 ? tightSag : -tightSag);
        const cp2x = x1 + (x2 - x1) * 0.75;
        const cp2y = ymid + (y2 >= y1 ? tightSag : -tightSag);
        pathD = `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
      }
      const casing = document.createElementNS("http://www.w3.org/2000/svg", "path");
      casing.setAttribute("d", pathD);
      casing.setAttribute("class", "cable-casing");
      cablesGroup.appendChild(casing);
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", pathD);
      path.setAttribute("stroke", cable.color);
      path.setAttribute("stroke-width", "2.6");
      path.setAttribute("stroke-linecap", "round");
      path.setAttribute("stroke-linejoin", "round");
      path.setAttribute("class", `cable-path ${cable.id === STATE.highlightedCableId ? "highlighted" : ""}`);
      path.setAttribute("id", `svg-cable-${cable.id}`);
      path.setAttribute("filter", "url(#cable-shadow)");
      const cableLabel = getCableLabel(activeRack, cable);
      path.setAttribute("aria-label", cableLabel);
      const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
      title.textContent = cableLabel;
      path.appendChild(title);
      const showCableTooltip = (e) => {
        dom.tooltip.style.display = "block";
        dom.tooltip.style.left = `${e.clientX + 10}px`;
        dom.tooltip.style.top = `${e.clientY - 10}px`;
        dom.tooltip.innerHTML = `
          <b>${escapeHtml(cable.id)}</b> (${Number(cable.lengthMeters || 0).toFixed(1)}m)<br>
          <span style="color:${cable.color};">&#9632;</span> <strong>${escapeHtml(cableLabel)}</strong><br>
          <span style="color:#f59e0b;font-size:11px;">Yeniden adland\u0131rmak i\xE7in \xE7ift t\u0131klay\u0131n</span>
        `;
      };
      path.addEventListener("click", (e) => {
        e.stopPropagation();
        highlightCable(cable.id);
        showCableQuickHud(cable.id, e.clientX, e.clientY);
      });
      path.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        highlightCable(cable.id);
        showCableContextMenu(cable.id, e.clientX, e.clientY);
      });
      path.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        renameCable2D(cable.id);
      });
      path.addEventListener("mouseenter", showCableTooltip);
      path.addEventListener("mousemove", (e) => {
        if (dom.tooltip.style.display !== "none") {
          dom.tooltip.style.left = `${e.clientX + 10}px`;
          dom.tooltip.style.top = `${e.clientY - 10}px`;
        }
      });
      path.addEventListener("mouseleave", () => {
        if (STATE.highlightedCableId !== cable.id) dom.tooltip.style.display = "none";
      });
      dom.cablesGroup.appendChild(path);
      if (dom.connectorsGroup) {
        const bootA = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bootA.setAttribute("cx", x1);
        bootA.setAttribute("cy", y1);
        bootA.setAttribute("r", "3.4");
        bootA.setAttribute("fill", "#090d16");
        bootA.setAttribute("stroke", cable.color);
        bootA.setAttribute("stroke-width", "1.6");
        bootA.setAttribute("class", "cable-boot");
        bootA.setAttribute("data-cable-id", cable.id);
        bootA.addEventListener("click", (e) => {
          e.stopPropagation();
          highlightCable(cable.id);
          showCableQuickHud(cable.id, e.clientX, e.clientY);
        });
        bootA.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          highlightCable(cable.id);
          showCableContextMenu(cable.id, e.clientX, e.clientY);
        });
        const pinA = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        pinA.setAttribute("cx", x1);
        pinA.setAttribute("cy", y1);
        pinA.setAttribute("r", "1.2");
        pinA.setAttribute("fill", cable.color);
        pinA.setAttribute("class", "cable-boot-pin");
        const bootB = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        bootB.setAttribute("cx", x2);
        bootB.setAttribute("cy", y2);
        bootB.setAttribute("r", "3.4");
        bootB.setAttribute("fill", "#090d16");
        bootB.setAttribute("stroke", cable.color);
        bootB.setAttribute("stroke-width", "1.6");
        bootB.setAttribute("class", "cable-boot");
        bootB.setAttribute("data-cable-id", cable.id);
        bootB.addEventListener("click", (e) => {
          e.stopPropagation();
          highlightCable(cable.id);
          showCableQuickHud(cable.id, e.clientX, e.clientY);
        });
        bootB.addEventListener("contextmenu", (e) => {
          e.preventDefault();
          e.stopPropagation();
          highlightCable(cable.id);
          showCableContextMenu(cable.id, e.clientX, e.clientY);
        });
        const pinB = document.createElementNS("http://www.w3.org/2000/svg", "circle");
        pinB.setAttribute("cx", x2);
        pinB.setAttribute("cy", y2);
        pinB.setAttribute("r", "1.2");
        pinB.setAttribute("fill", cable.color);
        pinB.setAttribute("class", "cable-boot-pin");
        dom.connectorsGroup.appendChild(bootA);
        dom.connectorsGroup.appendChild(pinA);
        dom.connectorsGroup.appendChild(bootB);
        dom.connectorsGroup.appendChild(pinB);
      }
    });
    renderDRingOverlays(activeRack);
  }
  var quickHudEl = null;
  var contextMenuEl = null;
  function hideCableQuickHud() {
    if (quickHudEl) {
      quickHudEl.remove();
      quickHudEl = null;
    }
  }
  function hideCableContextMenu() {
    if (contextMenuEl) {
      contextMenuEl.remove();
      contextMenuEl = null;
    }
  }
  function disconnectCable(cableId) {
    if (!cableId) return;
    const cable = STATE.cables.find((c) => c.id === cableId);
    if (!cable) return;
    STATE.cables = STATE.cables.filter((c) => c.id !== cableId);
    if (STATE.highlightedCableId === cableId) {
      STATE.highlightedCableId = null;
    }
    hideCableQuickHud();
    hideCableContextMenu();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:#f87171; font-weight:700;">\u2702\uFE0F ${escapeHtml(cable.name || cable.id)} s\xF6k\xFCld\xFC.</span>`;
      setTimeout(() => {
        if (dom.connectionStatusHint && !STATE.pendingConnection) {
          dom.connectionStatusHint.innerHTML = "Ba\u011Flamak i\xE7in <b>Kaynak Porta</b> t\u0131klay\u0131n";
        }
      }, 2500);
    }
    if (window.__STUDIO3D__ && typeof window.__STUDIO3D__.removeCable === "function") {
      window.__STUDIO3D__.removeCable(cableId);
    }
    window.dispatchEvent(new CustomEvent("rackstudio:refresh"));
  }
  function showCableQuickHud(cableId, clientX, clientY) {
    hideCableQuickHud();
    hideCableContextMenu();
    const cable = STATE.cables.find((c) => c.id === cableId);
    if (!cable) return;
    const hud = document.createElement("div");
    hud.className = "cable-quick-hud";
    hud.id = "cable-quick-hud";
    const left = Math.max(80, Math.min(window.innerWidth - 80, clientX));
    const isNearTop = clientY < 85;
    const top = isNearTop ? Math.max(70, clientY + 30) : clientY;
    if (isNearTop) {
      hud.style.transform = "translate(-50%, 0)";
    }
    hud.style.left = `${left}px`;
    hud.style.top = `${top}px`;
    hud.innerHTML = `
      <span class="hud-title"><span style="color:${cable.color};">\u25CF</span> ${escapeHtml(cable.name || cable.id)}</span>
      <button type="button" class="hud-btn-disconnect" title="Kabloyu S\xF6k (Delete Tu\u015Fu)">\u2702\uFE0F S\xF6k</button>
      <button type="button" class="hud-btn-color" title="Kablo Rengini De\u011Fi\u015Ftir">\u{1F3A8}</button>
      <button type="button" class="hud-btn-close" title="Kapat">\u2715</button>
    `;
    hud.querySelector(".hud-btn-disconnect").addEventListener("click", (e) => {
      e.stopPropagation();
      disconnectCable(cableId);
    });
    hud.querySelector(".hud-btn-color").addEventListener("click", (e) => {
      e.stopPropagation();
      const colors = ["#0070d2", "#00d2ff", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#ffffff"];
      const currentIdx = colors.indexOf(cable.color);
      cable.color = colors[(currentIdx + 1) % colors.length];
      renderAllCables();
      renderScheduleTable();
      showCableQuickHud(cableId, left, top);
    });
    hud.querySelector(".hud-btn-close").addEventListener("click", (e) => {
      e.stopPropagation();
      hideCableQuickHud();
      if (STATE.highlightedCableId === cableId) {
        highlightCable(cableId);
      }
    });
    document.body.appendChild(hud);
    quickHudEl = hud;
  }
  function showCableContextMenu(cableId, clientX, clientY) {
    hideCableQuickHud();
    hideCableContextMenu();
    const cable = STATE.cables.find((c) => c.id === cableId);
    if (!cable) return;
    const menu = document.createElement("div");
    menu.className = "cable-context-menu";
    menu.id = "cable-context-menu";
    const left = Math.max(10, Math.min(window.innerWidth - 180, clientX));
    const top = Math.max(10, Math.min(window.innerHeight - 150, clientY));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.innerHTML = `
      <div style="padding: 4px 8px; font-size: 0.7rem; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #1e293b;">
        <span style="color:${cable.color};">\u25CF</span> ${escapeHtml(cable.name || cable.id)} (${cable.lengthMeters || 1.5}m)
      </div>
      <div class="menu-item danger" id="ctx-disconnect">
        \u2702\uFE0F Kabloyu S\xF6k (Delete)
      </div>
      <div class="menu-item" id="ctx-rename">
        \u270F\uFE0F Yeniden Adland\u0131r
      </div>
      <div class="menu-item" id="ctx-change-color">
        \u{1F3A8} Renk De\u011Fi\u015Ftir
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" id="ctx-cancel">
        \u2715 Kapat
      </div>
    `;
    menu.querySelector("#ctx-disconnect").addEventListener("click", (e) => {
      e.stopPropagation();
      disconnectCable(cableId);
    });
    menu.querySelector("#ctx-rename").addEventListener("click", (e) => {
      e.stopPropagation();
      hideCableContextMenu();
      renameCable2D(cable.id);
    });
    menu.querySelector("#ctx-change-color").addEventListener("click", (e) => {
      e.stopPropagation();
      const colors = ["#0070d2", "#00d2ff", "#10b981", "#f59e0b", "#ef4444", "#a855f7", "#ec4899", "#ffffff"];
      const currentIdx = colors.indexOf(cable.color);
      cable.color = colors[(currentIdx + 1) % colors.length];
      renderAllCables();
      renderScheduleTable();
      hideCableContextMenu();
    });
    menu.querySelector("#ctx-cancel").addEventListener("click", (e) => {
      e.stopPropagation();
      hideCableContextMenu();
    });
    document.body.appendChild(menu);
    contextMenuEl = menu;
  }
  if (typeof window !== "undefined" && !window.__CABLE_INTERACTIONS_BOUND__) {
    window.__CABLE_INTERACTIONS_BOUND__ = true;
    document.addEventListener("click", (e) => {
      if (!e.target.closest("#cable-quick-hud") && !e.target.closest("#cable-context-menu")) {
        hideCableQuickHud();
        hideCableContextMenu();
      }
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Delete" || e.key === "Backspace") {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable);
        if (isEditing) return;
        if (STATE.highlightedCableId) {
          e.preventDefault();
          disconnectCable(STATE.highlightedCableId);
        }
      }
    });
  }
  function highlightCable(cableId) {
    STATE.highlightedCableId = STATE.highlightedCableId === cableId ? null : cableId;
    if (!STATE.highlightedCableId) {
      hideCableQuickHud();
      hideCableContextMenu();
    }
    document.querySelectorAll(".cable-path").forEach((p) => {
      p.classList.remove("highlighted");
    });
    if (STATE.highlightedCableId) {
      const p = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
      if (p) p.classList.add("highlighted");
    }
    document.querySelectorAll("#schedule-tbody tr").forEach((row) => {
      row.classList.toggle("active", row.dataset.cableId === STATE.highlightedCableId);
    });
  }
  function addDirectCable(rackA, instA, portA, rackB, instB, portB, color, lengthMeters) {
    const cableId = getNextCableId2();
    STATE.cables.push({
      id: cableId,
      name: cableId,
      from: { rackId: rackA, instanceId: instA, portId: portA },
      to: { rackId: rackB, instanceId: instB, portId: portB },
      color: color || "#2563eb",
      lengthMeters: lengthMeters || 1.5
    });
  }
  function highlightDropSlots(targetU, catalogKey, isOver) {
    document.querySelectorAll(".rack-slot.drag-valid, .rack-slot.drag-invalid").forEach((el) => {
      el.classList.remove("drag-valid", "drag-invalid");
    });
    if (!isOver || !targetU) return;
    const cat = catalogKey ? HARDWARE_CATALOG[catalogKey] : STATE.selectedLibraryItem ? HARDWARE_CATALOG[STATE.selectedLibraryItem] : null;
    const reqU = cat ? cat.u : 1;
    const endU = targetU - reqU + 1;
    const activeRack = getActiveRack();
    const isOut = endU < 1;
    let isBlocked = isOut;
    if (activeRack && !isOut) {
      for (let u = endU; u <= targetU; u++) {
        if (activeRack.units && activeRack.units[u] !== null) {
          isBlocked = true;
          break;
        }
      }
    }
    const cls = isBlocked ? "drag-invalid" : "drag-valid";
    for (let u = Math.max(1, endU); u <= targetU; u++) {
      const el = document.getElementById(`rack-slot-u${u}`);
      if (el) el.classList.add(cls);
    }
  }

  // js/src/2d/rackRenderer.js
  function createRackUnitAndSlot(rack, u, clickHandler, isSingleOrActive) {
    const leftU = document.createElement("div");
    leftU.className = "u-unit";
    leftU.innerHTML = `
    <div class="rack-holes">
      <div class="hole"></div>
      <div class="hole"></div>
      <div class="hole"></div>
    </div>
    <div class="u-label">${u}</div>
  `;
    const rightU = document.createElement("div");
    rightU.className = "u-unit";
    rightU.innerHTML = `
    <div class="u-label">${u}</div>
    <div class="rack-holes">
      <div class="hole"></div>
      <div class="hole"></div>
      <div class="hole"></div>
    </div>
  `;
    const slot = document.createElement("div");
    slot.className = "rack-slot";
    slot.dataset.u = u;
    slot.dataset.rackId = rack.id;
    if (isSingleOrActive) {
      slot.id = `rack-slot-u${u}`;
    } else {
      slot.id = `rack-${rack.id}-slot-u${u}`;
    }
    slot.addEventListener("click", (e) => {
      if (e.target.closest(".mounted-device")) return;
      if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
      if (STATE.selectedLibraryItem) {
        const item = HARDWARE_CATALOG[STATE.selectedLibraryItem];
        const name = item ? item.name : "Donan\u0131m";
        showTemporaryTooltip(e.clientX, e.clientY, `[${name}] eklemek i\xE7in [${rack.name}] U${u} yuvas\u0131na \xC7\u0130FT TIKLAYIN veya s\xFCr\xFCkleyip b\u0131rak\u0131n.`);
      }
    });
    slot.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      if (e.target.closest(".mounted-device")) return;
      if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
      if (clickHandler) clickHandler(u, e, rack.id);
    });
    slot.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
      const draggedDev = window.__RACK_DRAGGED_DEVICE__ || STATE.selectedLibraryItem;
      highlightDropSlots(u, draggedDev, true, rack.id);
    });
    slot.addEventListener("dragleave", (e) => {
      if (!slot.contains(e.relatedTarget)) {
        highlightDropSlots(u, null, false, rack.id);
      }
    });
    slot.addEventListener("drop", (e) => {
      e.preventDefault();
      e.stopPropagation();
      highlightDropSlots(u, null, false, rack.id);
      const devId = e.dataTransfer.getData("application/x-rack-device") || e.dataTransfer.getData("text/plain") || window.__RACK_DRAGGED_DEVICE__ || STATE.selectedLibraryItem;
      window.__RACK_DRAGGED_DEVICE__ = null;
      if (!devId) return;
      if (typeof window.mountDeviceFromAction === "function") {
        window.mountDeviceFromAction(devId, u, e, rack.id);
      }
    });
    return { leftU, rightU, slot };
  }
  function renderRackRailsAndSlots(onSlotClick) {
    if (typeof onSlotClick === "function") STATE.onSlotClick = onSlotClick;
    const clickHandler = typeof onSlotClick === "function" ? onSlotClick : STATE.onSlotClick;
    const rackStage = dom.rackStage || document.getElementById("rack-stage");
    if (!rackStage) return;
    const isMulti = STATE.viewMode === "multi" && STATE.racks && STATE.racks.length > 1;
    rackStage.classList.toggle("multi-rack-stage", isMulti);
    if (!isMulti) {
      let container = document.getElementById("rack-container");
      if (!container) {
        rackStage.innerHTML = `
          <div class="rack-container" id="rack-container">
            <div class="rack-rail left" id="rail-left"></div>
            <div class="rack-main-space" id="rack-space"></div>
            <div class="rack-rail right" id="rail-right"></div>
            <svg class="cables-svg-layer" id="cables-svg" viewBox="0 0 618 1344" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <filter id="cable-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/>
                </filter>
              </defs>
              <g id="cables-group"></g>
              <g id="connectors-group"></g>
              <g id="dring-overlay-group"></g>
            </svg>
          </div>
        `;
        initDomReferences();
      } else {
        rackStage.querySelectorAll(".rack-container").forEach((c) => {
          if (c !== container) c.remove();
        });
        container.classList.remove("active-rack-target");
        const existingPlate = container.querySelector(".rack-header-plate");
        if (existingPlate) existingPlate.remove();
        const svg = document.getElementById("cables-svg");
        if (svg && svg.parentElement !== container) {
          container.appendChild(svg);
        }
      }
      initDomReferences();
      if (!dom.railLeft || !dom.railRight || !dom.rackSpace) return;
      dom.railLeft.innerHTML = "";
      dom.railRight.innerHTML = "";
      dom.rackSpace.innerHTML = "";
      const activeRack = getActiveRack();
      const heightU = activeRack?.heightU || 42;
      if (dom.cablesSvg) dom.cablesSvg.setAttribute("viewBox", `0 0 618 ${heightU * 32}`);
      for (let u = heightU; u >= 1; u--) {
        const { leftU, rightU, slot } = createRackUnitAndSlot(activeRack, u, clickHandler, true);
        dom.railLeft.appendChild(leftU);
        dom.railRight.appendChild(rightU);
        dom.rackSpace.appendChild(slot);
      }
    } else {
      rackStage.querySelectorAll(".rack-container").forEach((c) => c.remove());
      let svg = document.getElementById("cables-svg");
      if (!svg) {
        svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("class", "cables-svg-layer");
        svg.setAttribute("id", "cables-svg");
        svg.innerHTML = `
          <defs>
            <filter id="cable-shadow" x="-10%" y="-10%" width="120%" height="120%">
              <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000" flood-opacity="0.6"/>
            </filter>
          </defs>
          <g id="cables-group"></g>
          <g id="connectors-group"></g>
          <g id="dring-overlay-group"></g>
        `;
      }
      rackStage.appendChild(svg);
      const numRacks = STATE.racks.length;
      const maxU = Math.max(...STATE.racks.map((r) => r.heightU || 42));
      const baseW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      const baseH = maxU * 32 + 156;
      svg.setAttribute("viewBox", `0 0 ${baseW} ${baseH}`);
      STATE.racks.forEach((rack) => {
        const isAct = rack.id === STATE.activeRackId;
        const cont = document.createElement("div");
        cont.className = `rack-container ${isAct ? "active-rack-target" : ""}`;
        cont.dataset.rackId = rack.id;
        if (isAct) {
          cont.id = "rack-container";
        } else {
          cont.id = `rack-container-${rack.id}`;
        }
        const headerPlate = document.createElement("div");
        headerPlate.className = "rack-header-plate";
        headerPlate.dataset.rackId = rack.id;
        headerPlate.innerHTML = `
          <span class="rack-header-title">
            <svg width="12" height="12" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
            ${escapeHtml(rack.name)}
          </span>
          <span class="rack-header-meta">${rack.heightU || 42}U \xB7 ${rack.devices ? rack.devices.length : 0} Cihaz</span>
        `;
        cont.appendChild(headerPlate);
        cont.addEventListener("click", (e) => {
          if (e.target.closest(".port") || e.target.closest(".dev-btn")) return;
          if (STATE.activeRackId !== rack.id) {
            switchActiveRack(rack.id);
          }
        });
        const railL = document.createElement("div");
        railL.className = "rack-rail left";
        if (isAct) railL.id = "rail-left";
        else railL.id = `rail-left-${rack.id}`;
        cont.appendChild(railL);
        const space = document.createElement("div");
        space.className = "rack-main-space";
        if (isAct) space.id = "rack-space";
        else space.id = `rack-space-${rack.id}`;
        cont.appendChild(space);
        const railR = document.createElement("div");
        railR.className = "rack-rail right";
        if (isAct) railR.id = "rail-right";
        else railR.id = `rail-right-${rack.id}`;
        cont.appendChild(railR);
        const rHeightU = rack.heightU || 42;
        for (let u = rHeightU; u >= 1; u--) {
          const { leftU, rightU, slot } = createRackUnitAndSlot(rack, u, clickHandler, isAct);
          railL.appendChild(leftU);
          railR.appendChild(rightU);
          space.appendChild(slot);
        }
        rackStage.appendChild(cont);
      });
      initDomReferences();
    }
  }
  function mountDeviceAt(catalogKey, topU, targetRackId) {
    const cat = Object.hasOwn(HARDWARE_CATALOG, catalogKey) ? HARDWARE_CATALOG[catalogKey] : null;
    if (!cat) return null;
    const targetRack = targetRackId ? STATE.racks.find((r) => r.id === targetRackId) : getActiveRack();
    if (!targetRack) return null;
    const endU = topU - cat.u + 1;
    if (!Number.isInteger(topU) || !Number.isInteger(cat.u) || cat.u < 1 || endU < 1 || topU > (targetRack.heightU || 42)) return null;
    if (targetRack.devices.some((d) => topU >= d.topU - d.uHeight + 1 && endU <= d.topU)) return null;
    const instanceId = "dev-" + Math.random().toString(36).substring(2, 9);
    for (let u = endU; u <= topU; u++) {
      targetRack.units[u] = instanceId;
    }
    const devObj = {
      instanceId,
      catalogKey,
      topU,
      uHeight: cat.u
    };
    targetRack.devices.push(devObj);
    return devObj;
  }
  function removeDevice(instanceId) {
    const activeRack = getActiveRack();
    if (!activeRack) return;
    STATE.cables = STATE.cables.filter((c) => c.from.instanceId !== instanceId && c.to.instanceId !== instanceId);
    for (let u = 1; u <= (activeRack.heightU || 42); u++) {
      if (activeRack.units[u] === instanceId) {
        activeRack.units[u] = null;
      }
    }
    activeRack.devices = activeRack.devices.filter((d) => d.instanceId !== instanceId);
    if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
      cancelPendingConnection();
    }
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
  }
  function updateDeviceMetadata(instanceId, metadata) {
    const rack = STATE.racks.find((item) => item.devices.some((dev2) => dev2.instanceId === instanceId));
    const dev = rack && rack.devices.find((item) => item.instanceId === instanceId);
    if (!dev) return false;
    dev.name = String(metadata.name || "").trim();
    dev.hostname = dev.name;
    dev.ipAddress = String(metadata.ipAddress || "").trim();
    dev.macAddress = String(metadata.macAddress || "").trim();
    dev.serialNumber = String(metadata.serialNumber || "").trim();
    dev.panelLabel = String(metadata.panelLabel || "").trim();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent("rackstudio:refresh"));
    return true;
  }
  function renderMountedDevices() {
    document.querySelectorAll(".mounted-device").forEach((el) => el.remove());
    const isMulti = STATE.viewMode === "multi" && STATE.racks && STATE.racks.length > 1;
    const racksToRender = isMulti ? STATE.racks : [getActiveRack()].filter(Boolean);
    if (!racksToRender.length) return;
    const activeRack = getActiveRack();
    if (!isMulti && dom.rackSpace && dom.rackSpace.querySelectorAll(".rack-slot").length !== (activeRack?.heightU || 42)) {
      renderRackRailsAndSlots();
    }
    occupiedPortKeys = new Set(STATE.cables.flatMap((c) => [portKey2(c.from.instanceId, c.from.portId), portKey2(c.to.instanceId, c.to.portId)]));
    racksToRender.forEach((rack) => {
      if (!rack) return;
      rack.devices.forEach((dev) => {
        const cat = HARDWARE_CATALOG[dev.catalogKey];
        if (!cat) return;
        const isActiveRack = rack.id === STATE.activeRackId;
        let slotEl = null;
        if (isActiveRack || !isMulti) {
          slotEl = document.getElementById(`rack-slot-u${dev.topU}`);
        } else {
          slotEl = document.getElementById(`rack-${rack.id}-slot-u${dev.topU}`);
        }
        if (!slotEl) return;
        const devEl = document.createElement("div");
        devEl.className = "mounted-device";
        devEl.id = dev.instanceId;
        devEl.style.height = `${dev.uHeight * 32}px`;
        devEl.style.top = "0px";
        devEl.dataset.rackId = rack.id;
        if (cat.category === "organizer") {
          devEl.innerHTML = renderOrganizerFaceplate(cat, dev);
        } else if (cat.category === "blank") {
          devEl.innerHTML = renderBlankFaceplate(cat, dev);
        } else if (cat.category === "router") {
          devEl.innerHTML = renderRouterFaceplate(cat, dev);
        } else {
          devEl.innerHTML = renderSwitchOrPatchFaceplate(cat, dev);
        }
        slotEl.appendChild(devEl);
        if (!["organizer", "blank"].includes(cat.category)) {
          devEl.addEventListener("dblclick", (e) => {
            if (e.target.closest(".port, .del-device-btn")) return;
            window.DeviceMetadataEditor?.open2D(dev.instanceId);
          });
          devEl.querySelector(".bezel-badge")?.addEventListener("click", (e) => {
            e.stopPropagation();
            window.DeviceMetadataEditor?.open2D(dev.instanceId);
          });
        }
        const delBtn = devEl.querySelector(".del-device-btn");
        if (delBtn) {
          delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`${escapeHtml(cat.name)} cihaz\u0131n\u0131 ve ba\u011Fl\u0131 kablolar\u0131n\u0131 kald\u0131rmak istiyor musunuz?`)) {
              removeDevice(dev.instanceId);
            }
          });
        }
      });
    });
    bindPortInteractions();
  }
  function renderRouterFaceplate(cat, dev) {
    const groups = {};
    cat.ports.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    let portsHtml = "";
    Object.keys(groups).forEach((gId) => {
      const groupPorts = groups[gId];
      portsHtml += `
        <div class="port-group" style="background:rgba(15,23,42,0.85); border-color:#0284c7;">
          <div class="port-row">
            ${groupPorts.map((p) => renderPortIcon(dev.instanceId, p)).join("")}
          </div>
        </div>
      `;
    });
    return `
      <div class="device-faceplate" style="background:linear-gradient(90deg, #131b2c 0%, #1e293b 100%);">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihaz\u0131 Kald\u0131r">\u2715</button>
        </div>
        <div class="bezel-badge">
          <span class="bezel-logo" style="color:#38bdf8;">CISCO</span>
          <span class="bezel-model">${escapeHtml(cat.modelTag)}</span>
        </div>
        <div class="device-status-leds">
          <div class="status-led" title="PWR1: Active" style="background:#22c55e;"></div>
          <div class="status-led" title="PWR2: Standby" style="background:#38bdf8;"></div>
          <div class="status-led" title="WAN: Up" style="background:#22c55e;"></div>
        </div>
        <div class="ports-area">
          ${portsHtml}
          <!-- NIM Modules visual simulation -->
          <div style="display:flex; gap:3px; margin-left:auto; opacity:0.85;">
            <div style="font-size:0.5rem; font-family:monospace; color:#64748b; border:1px dashed #334155; padding:2px 4px; border-radius:2px;">NIM-1</div>
            <div style="font-size:0.5rem; font-family:monospace; color:#64748b; border:1px dashed #334155; padding:2px 4px; border-radius:2px;">NIM-2</div>
            <div style="font-size:0.5rem; font-family:monospace; color:#475569; border:1px solid #1e293b; padding:2px 4px; border-radius:2px;">SM-X</div>
          </div>
        </div>
      </div>
    `;
  }
  function renderOrganizerFaceplate(cat, dev) {
    const is2U = dev.uHeight === 2;
    const isDring = cat && (cat.id === "organizer-dring-1u" || cat.modelTag && cat.modelTag.includes("D-RING") || cat.name && cat.name.toLowerCase().includes("d-ring")) || dev && dev.catalogKey && dev.catalogKey.includes("dring");
    if (isDring) {
      const rings = [1, 2, 3, 4, 5].map((idx) => `
        <div class="dring-bracket" data-ring="${idx}">
          <div class="dring-loop"></div>
        </div>
      `).join("");
      return `
        <div class="organizer-faceplate dring-faceplate">
          <div class="device-controls">
            <button class="dev-btn del-device-btn" title="Cihaz\u0131 Kald\u0131r">\u2715</button>
          </div>
          <div class="dring-ring-container">
            ${rings}
          </div>
        </div>
      `;
    }
    return `
      <div class="organizer-faceplate" style="${is2U ? "background: #0d121c;" : ""}">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihaz\u0131 Kald\u0131r">\u2715</button>
        </div>
        <div style="font-size:0.6rem; color:#64748b; font-family:monospace; font-weight:700; padding:0 8px;">
          ${escapeHtml(cat.modelTag)}
        </div>
        <div class="organizer-brush" style="${is2U ? "height:24px;" : ""}"></div>
      </div>
    `;
  }
  function renderBlankFaceplate(cat, dev) {
    return `
      <div class="blank-faceplate" style="width:100%; height:100%; background:#0b0d13; border-top:1px solid #1c212b; border-bottom:1px solid #030406; border-left:4px solid #334155; display:flex; align-items:center; justify-content:center; position:relative;">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Paneli Kald\u0131r">\u2715</button>
        </div>
        <span style="font-size:0.6rem; color:#475569; font-family:monospace; letter-spacing:2px;">BLANK COVER PANEL 1U</span>
      </div>
    `;
  }
  function renderSwitchOrPatchFaceplate(cat, dev) {
    const isRouter = cat.category === "router";
    const isSwitch = cat.category === "switch" || cat.category === "fiber-switch" || isRouter;
    const isFiberPanel = cat.category === "fiber";
    const isPatchPanel = cat.category === "patch" || isFiberPanel;
    const typeLabel = isRouter ? "ROUTER" : isSwitch ? "SWITCH" : isFiberPanel ? "FIBER PANEL" : "PATCH PANEL";
    const typeClass = isSwitch ? "faceplate-switch" : isFiberPanel ? "faceplate-fiber-panel" : "faceplate-patch-panel";
    const configuredLabel = isPatchPanel ? dev.panelLabel || dev.name || "" : dev.hostname || dev.name || "";
    const isCisco = isSwitch && (/cisco/i.test(cat.logo || "") || /cisco/i.test(cat.name || "") || /cisco/i.test(dev.catalogKey || ""));
    const groups = {};
    cat.ports.forEach((p) => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });
    let portsHtml = "";
    Object.keys(groups).forEach((gId) => {
      const groupPorts = groups[gId];
      const isTwoRows = groupPorts.some((p) => p.row === 1);
      const isUplinkGroup = isSwitch && groupPorts.every((p) => p.type === "sfp" || p.type === "sfp+" || p.type === "qsfp28");
      const bayClass = isUplinkGroup ? "cisco-uplink-bay" : isPatchPanel ? "patch-port-bay" : "cisco-port-bay";
      let patchStrip = "";
      if (isPatchPanel && groupPorts.length > 0) {
        const firstPortName = groupPorts[0]?.name || "1";
        const lastPortName = groupPorts[groupPorts.length - 1]?.name || String(groupPorts.length);
        patchStrip = `<div class="patch-id-strip"><span>${escapeHtml(firstPortName)}</span><span>-</span><span>${escapeHtml(lastPortName)}</span></div>`;
      }
      if (isTwoRows) {
        const row0 = groupPorts.filter((p) => p.row === 0);
        const row1 = groupPorts.filter((p) => p.row === 1);
        portsHtml += `
          <div class="port-group ${bayClass}">
            ${patchStrip}
            <div class="port-row">
              ${row0.map((p) => renderPortIcon(dev.instanceId, p)).join("")}
            </div>
            <div class="port-row">
              ${row1.map((p) => renderPortIcon(dev.instanceId, p)).join("")}
            </div>
          </div>
        `;
      } else {
        portsHtml += `
          <div class="port-group ${bayClass}">
            ${patchStrip}
            <div class="port-row">
              ${groupPorts.map((p) => renderPortIcon(dev.instanceId, p)).join("")}
            </div>
          </div>
        `;
      }
    });
    let leftSection = "";
    if (isCisco) {
      const modelText = cat.modelTag || cat.name || "Cisco";
      leftSection = `
        <div class="cisco-integrated-bezel" title="${escapeHtml([cat.name, cat.modelTag, configuredLabel, "Cisco Catalyst Managed Switch"].filter(Boolean).join(" \xB7 "))}">
          <div class="cisco-bezel-top">
            <span class="cisco-brand-logo">CISCO</span>
            <div class="cisco-bezel-leds">
              <span class="cisco-mini-mode" title="Mode Button"></span>
              <span class="cisco-mini-led" title="SYST: Normal"><i></i></span>
              <span class="cisco-mini-led" title="STAT: Active"><i></i></span>
            </div>
          </div>
          <div class="cisco-bezel-bot">
            <span class="cisco-model-code" title="${escapeHtml(modelText)}">${escapeHtml(modelText)}</span>
            <span class="cisco-console-mini" title="Cisco RJ45 Console Port">CONS</span>
          </div>
        </div>
      `;
    } else if (isPatchPanel) {
      const modelText = cat.modelTag || cat.name || "Patch Panel";
      const brandText = isFiberPanel ? cat.logo || "FIBER" : cat.logo && cat.logo !== "PANEL" ? cat.logo : "PATCH";
      const badgeText = isFiberPanel ? "FIBER" : cat.category === "patch" && /cat6a/i.test(cat.name || cat.modelTag || "") ? "CAT6A" : "CAT6";
      const typeMini = isFiberPanel ? "LC-DPX" : "110 IDC";
      leftSection = `
        <div class="patch-integrated-bezel" title="${escapeHtml([cat.name, cat.modelTag, configuredLabel, isFiberPanel ? "Fiber Da\u011F\u0131t\u0131m Paneli" : "Pasif Patch Panel"].filter(Boolean).join(" \xB7 "))}">
          <div class="patch-bezel-top">
            <span class="patch-brand-logo">${escapeHtml(brandText)}</span>
            <span class="patch-kind-badge">${escapeHtml(badgeText)}</span>
          </div>
          <div class="patch-bezel-bot">
            <span class="patch-model-code" title="${escapeHtml(configuredLabel || modelText)}">${escapeHtml(configuredLabel || modelText)}</span>
            <span class="patch-type-mini" title="${isFiberPanel ? "LC Duplex Adapt\xF6r Yuvas\u0131" : "110 IDC Punch Down Blo\u011Fu"}">${escapeHtml(typeMini)}</span>
          </div>
        </div>
      `;
    } else {
      const statusSection = `
        <div class="device-status-leds">
          <div class="status-led" title="Power: OK"></div>
          <div class="status-led" style="background:#38bdf8;" title="Status: Active"></div>
        </div>
      `;
      leftSection = `
        <div class="bezel-badge" title="${escapeHtml([cat.logo, cat.modelTag, typeLabel, configuredLabel].filter(Boolean).join(" \xB7 "))}">
          <div class="bezel-primary-row">
            <span class="bezel-logo">${escapeHtml(cat.logo)}</span>
            <span class="device-kind-badge">${typeLabel}</span>
          </div>
          <div class="bezel-secondary-row">
            <span class="bezel-model">${escapeHtml(cat.modelTag)}</span>
            ${configuredLabel ? `<span class="device-config-label">${escapeHtml(configuredLabel)}</span>` : ""}
          </div>
        </div>
        ${statusSection}
      `;
    }
    return `
      <div class="device-faceplate ${typeClass}">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihaz\u0131 Kald\u0131r">\u2715</button>
        </div>
        ${leftSection}
        <div class="ports-area">
          ${portsHtml}
        </div>
      </div>
    `;
  }
  var portKey2 = (instanceId, portId) => JSON.stringify([instanceId, portId]);
  var occupiedPortKeys = /* @__PURE__ */ new Set();
  function renderPortIcon(instanceId, port) {
    let typeClass = "port-rj45";
    let inner = "";
    if (port.type === "sfp") {
      typeClass = "port-sfp";
    } else if (port.type === "lc") {
      typeClass = "port-lc";
      inner = '<div class="port-lc-inner"></div><div class="port-lc-inner"></div>';
    }
    const isConnected = occupiedPortKeys.has(portKey2(instanceId, port.id));
    const activeRack = getActiveRack ? getActiveRack() : STATE.racks && STATE.racks[0];
    const dev = activeRack && activeRack.devices.find((d) => d.instanceId === instanceId);
    const portCfg = dev && dev.portsConfig && (dev.portsConfig[port.id] || dev.portsConfig[port.id.replace("p", "")] || dev.portsConfig[port.name]);
    let specialClass = "";
    let specialStyle = "";
    if (portCfg) {
      const role = (portCfg.role || (portCfg.isTrunk ? "trunk" : "")).toLowerCase();
      const hasVlan = Boolean(portCfg.vlan);
      const customColor = portCfg.color;
      if (role === "trunk" || portCfg.isTrunk) {
        const color = customColor || "#a855f7";
        specialClass = "port-special port-trunk";
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --trunk-color: ${color}; --port-badge-text: 'T';"`;
      } else if (role === "uplink") {
        const color = customColor || "#00d2ff";
        specialClass = "port-special port-uplink";
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '\u25B2';"`;
      } else if (role === "poe") {
        const color = customColor || "#f59e0b";
        specialClass = "port-special port-poe";
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '\u26A1';"`;
      } else if (role === "management" || role === "mgmt") {
        const color = customColor || "#10b981";
        specialClass = "port-special port-mgmt";
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'M';"`;
      } else if (hasVlan || role === "access" && hasVlan) {
        const color = customColor || "#3b82f6";
        const vlanLabel = String(portCfg.vlan).trim().split(/[, ]+/)[0];
        const badgeText = vlanLabel ? `V${vlanLabel.slice(0, 3)}` : "V";
        specialClass = "port-special port-vlan";
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '${badgeText}';"`;
      } else if (customColor) {
        specialClass = "port-special";
        specialStyle = `style="--port-role-color: ${customColor}; --custom-color: ${customColor}; --port-badge-text: '\u25CF';"`;
      }
    }
    return `
      <div class="port ${typeClass} ${isConnected ? "connected" : ""} ${specialClass}" 
           ${specialStyle}
           data-instance-id="${instanceId}" 
           data-port-id="${port.id}"
           data-port-name="${escapeHtml(port.name)}"
           data-port-type="${escapeHtml(port.type)}"
           data-port-speed="${escapeHtml(port.speed)}"
           id="port-${instanceId}-${port.id}">
        ${inner}
      </div>
    `;
  }
  function bindPortInteractions() {
    const portElements = document.querySelectorAll(".port");
    portElements.forEach((portEl) => {
      portEl.addEventListener("mouseenter", handlePortHover);
      portEl.addEventListener("mouseleave", handlePortLeave);
      portEl.addEventListener("click", (e) => {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const devId = portEl.dataset.instanceId;
          const portId = portEl.dataset.portId;
          if (window.PortConfigEditor) {
            window.PortConfigEditor.open(devId, portId, "2d");
          }
          return;
        }
        handlePortClick(e);
      });
      portEl.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const devId = portEl.dataset.instanceId;
        const portId = portEl.dataset.portId;
        if (window.PortConfigEditor) {
          window.PortConfigEditor.open(devId, portId, "2d");
        }
      });
    });
  }
  function handlePortHover(e) {
    const portEl = e.currentTarget;
    const instanceId = portEl.dataset.instanceId;
    const portId = portEl.dataset.portId;
    const portName = portEl.dataset.portName;
    const portSpeed = portEl.dataset.portSpeed;
    const activeRack = getActiveRack();
    if (!activeRack) return;
    const dev = activeRack.devices.find((d) => d.instanceId === instanceId);
    if (!dev) return;
    const cat = HARDWARE_CATALOG[dev.catalogKey];
    const connectedCable = STATE.cables.find(
      (c) => c.from.instanceId === instanceId && c.from.portId === portId || c.to.instanceId === instanceId && c.to.portId === portId
    );
    let connectionInfo = '<span style="color:#94a3b8;">Bo\u015F / Ba\u011Flant\u0131 Yok</span>';
    if (connectedCable) {
      const isFrom = connectedCable.from.instanceId === instanceId && connectedCable.from.portId === portId;
      const otherEndpoint = isFrom ? connectedCable.to : connectedCable.from;
      const otherRack = STATE.racks.find((r) => r.id === otherEndpoint.rackId);
      const otherDev = otherRack ? otherRack.devices.find((d) => d.instanceId === otherEndpoint.instanceId) : null;
      const otherCat = otherDev ? HARDWARE_CATALOG[otherDev.catalogKey] : null;
      const otherPort = otherCat ? otherCat.ports.find((p) => p.id === otherEndpoint.portId) : null;
      const isInterRack = otherEndpoint.rackId !== activeRack.id;
      connectionInfo = `<span style="color:${isInterRack ? "#38bdf8" : "#22c55e"}; font-weight:600;">
        Ba\u011Fl\u0131 -> ${isInterRack ? `[${escapeHtml(otherRack ? otherRack.name : "D\u0131\u015F Kabin")}] ` : ""}${escapeHtml(otherCat ? otherCat.name : "")} [${escapeHtml(otherPort ? otherPort.name : otherEndpoint.portId)}]
      </span>`;
    }
    const portCfg = dev.portsConfig && (dev.portsConfig[portId] || dev.portsConfig[portId.replace("p", "")] || dev.portsConfig[portName]);
    const isTrunk = portCfg && (portCfg.role === "trunk" || portCfg.isTrunk);
    const trunkColor = portCfg && portCfg.color || "#a855f7";
    let trunkDetail = "";
    if (isTrunk && portCfg) {
      const cName = portCfg.ciscoName ? ` \xB7 ${escapeHtml(portCfg.ciscoName)}` : "";
      const vText = portCfg.vlan ? ` | VLAN: ${escapeHtml(portCfg.vlan)}` : "";
      const dText = portCfg.description ? `<div style="color:#94a3b8; font-size:10px; font-style:italic;">"${escapeHtml(portCfg.description)}"</div>` : "";
      trunkDetail = `
        <div style="background:rgba(168,85,247,0.2); border-left:3px solid ${trunkColor}; padding:2px 6px; margin:4px 0; border-radius:2px;">
          <span style="color:${trunkColor}; font-weight:700;">\u26A1 802.1Q TRUNK${cName}${vText}</span>
          ${dText}
        </div>
      `;
    }
    if (dom.inspectorInfo) {
      dom.inspectorInfo.innerHTML = `
        <div style="font-weight:700; color:#fff; margin-bottom:3px;">${escapeHtml(cat.name)} (${escapeHtml(activeRack.name)} - U${dev.topU})</div>
        <div><b>Port:</b> ${escapeHtml(portName)} (${escapeHtml(portSpeed)})</div>
        <div><b>Tip:</b> ${escapeHtml(portEl.dataset.portType.toUpperCase())}</div>
        ${trunkDetail}
        <div><b>Durum:</b> ${connectionInfo}</div>
      `;
    }
    if (dom.tooltip) {
      const rect = portEl.getBoundingClientRect();
      dom.tooltip.style.display = "block";
      dom.tooltip.style.left = `${rect.right + 10}px`;
      dom.tooltip.style.top = `${rect.top - 5}px`;
      const trunkBadge = isTrunk ? `<div style="color:${trunkColor}; font-weight:bold; font-size:10px;">\u26A1 802.1Q TRUNK</div>` : "";
      dom.tooltip.innerHTML = `<b>${escapeHtml(cat.modelTag)}</b> &bull; ${escapeHtml(portName)}${trunkBadge}<br><span style="color:#94a3b8; font-size:0.68rem;">${escapeHtml(portSpeed)}</span><br><span style="color:#38bdf8; font-size:0.65rem;">Ayarlar: <b>Sa\u011F T\u0131k / Shift+T\u0131k</b></span>`;
    }
  }
  function handlePortLeave() {
    if (dom.tooltip) dom.tooltip.style.display = "none";
  }
  function handlePortClick(e) {
    e.stopPropagation();
    const portEl = e.currentTarget;
    const instanceId = portEl.dataset.instanceId;
    const portId = portEl.dataset.portId;
    if (!instanceId || !portId) return;
    const devRack = STATE.racks.find((r) => r.devices.some((d) => d.instanceId === instanceId)) || getActiveRack();
    if (!devRack) return;
    if (!STATE.pendingConnection) {
      const isOccupied = STATE.cables.some(
        (c) => c.from.instanceId === instanceId && c.from.portId === portId || c.to.instanceId === instanceId && c.to.portId === portId
      );
      if (isOccupied) {
        const connectedCable = STATE.cables.find(
          (c) => c.from.instanceId === instanceId && c.from.portId === portId || c.to.instanceId === instanceId && c.to.portId === portId
        );
        if (connectedCable) {
          highlightCable(connectedCable.id);
          const rect = portEl.getBoundingClientRect();
          showCableQuickHud(connectedCable.id, rect.left + rect.width / 2, rect.top);
        }
        return;
      }
      STATE.pendingConnection = {
        rackId: devRack.id,
        instanceId,
        portId,
        element: portEl
      };
      portEl.classList.add("selected");
      const dev = devRack.devices.find((d) => d.instanceId === instanceId);
      const cat = dev ? HARDWARE_CATALOG[dev.catalogKey] : null;
      const port = cat ? cat.ports.find((p) => p.id === portId) : null;
      if (dom.connectionStatusHint && cat && port) {
        dom.connectionStatusHint.innerHTML = `Kaynak: <span style="color:#38bdf8;">[${escapeHtml(devRack.name)}] ${escapeHtml(cat.modelTag)} (${escapeHtml(port.name)})</span> &rarr; <b>Hedef Porta T\u0131klay\u0131n (Kabin de\u011Fi\u015Ftirebilirsiniz)</b>`;
      }
    } else {
      const source = STATE.pendingConnection;
      if (source.rackId === devRack.id && source.instanceId === instanceId && source.portId === portId) {
        cancelPendingConnection();
        return;
      }
      const isTargetOccupied = STATE.cables.some(
        (c) => c.from.instanceId === instanceId && c.from.portId === portId || c.to.instanceId === instanceId && c.to.portId === portId
      );
      if (isTargetOccupied) {
        alert("Hedef port dolu! L\xFCtfen bo\u015F bir port se\xE7in.");
        return;
      }
      const isInterRack = source.rackId !== devRack.id;
      const cableId = getNextCableId();
      const sourceDev = STATE.racks?.find((r) => r.id === source.rackId)?.devices?.find((d) => d.instanceId === source.instanceId);
      const targetDev = devRack.devices?.find((d) => d.instanceId === instanceId);
      const sourcePortCfg = sourceDev?.portsConfig && (sourceDev.portsConfig[source.portId] || sourceDev.portsConfig[source.portId.replace("p", "")]);
      const targetPortCfg = targetDev?.portsConfig && (targetDev.portsConfig[portId] || targetDev.portsConfig[portId.replace("p", "")]);
      const isTrunkLink = sourcePortCfg && sourcePortCfg.isTrunk || targetPortCfg && targetPortCfg.isTrunk;
      const trunkColor = sourcePortCfg && sourcePortCfg.isTrunk && sourcePortCfg.color || targetPortCfg && targetPortCfg.isTrunk && targetPortCfg.color || "#a855f7";
      const effectiveCableColor = isTrunkLink && (sourcePortCfg && sourcePortCfg.autoCableColor !== false || targetPortCfg && targetPortCfg.autoCableColor !== false) ? trunkColor : STATE.selectedCableColor;
      const trunkPrefix = isTrunkLink ? "[TRUNK] " : "";
      const newCable = {
        id: cableId,
        name: trunkPrefix + cableId,
        from: { rackId: source.rackId, instanceId: source.instanceId, portId: source.portId },
        to: { rackId: devRack.id, instanceId, portId },
        color: effectiveCableColor,
        lengthMeters: calculateCableLengthMeters(source.instanceId, instanceId, isInterRack)
      };
      STATE.cables.push(newCable);
      cancelPendingConnection();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
    }
  }
  function calculateCableLengthMeters(instA, instB, isInterRack) {
    if (isInterRack) return 15;
    const activeRack = getActiveRack();
    if (!activeRack) return 1.5;
    const devA = activeRack.devices.find((d) => d.instanceId === instA);
    const devB = activeRack.devices.find((d) => d.instanceId === instB);
    if (!devA || !devB) return 1.5;
    const uDiff = Math.abs(devA.topU - devB.topU);
    const length = 0.5 + uDiff * 0.045 + (uDiff > 5 ? 0.8 : 0.2);
    return parseFloat(length.toFixed(2));
  }

  // js/src/2d/zoomManager.js
  var stageTransitionBound = false;
  function ensureStageTransitionListener() {
    if (stageTransitionBound || !dom.rackStage) return;
    dom.rackStage.addEventListener("transitionend", (e) => {
      if (e.propertyName === "transform") {
        renderAllCables();
      }
    });
    stageTransitionBound = true;
  }
  function updateStageTransform(smooth = false) {
    if (!dom.rackStage) return;
    ensureStageTransitionListener();
    if (smooth) {
      dom.rackStage.style.transition = "transform 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)";
    } else {
      dom.rackStage.style.transition = "none";
    }
    dom.rackStage.style.transform = `translate(${ZOOM_STATE.panX}px, ${ZOOM_STATE.panY}px) scale(${ZOOM_STATE.scale})`;
    if (dom.zoomBadge) {
      dom.zoomBadge.textContent = `${Math.round(ZOOM_STATE.scale * 100)}%`;
    }
    const currentLod = ZOOM_STATE.scale < 0.42 ? "macro" : ZOOM_STATE.scale < 0.78 ? "medium" : "detail";
    if (dom.rackStage && dom.rackStage.getAttribute("data-lod") !== currentLod) {
      dom.rackStage.setAttribute("data-lod", currentLod);
    }
    window.dispatchEvent(new CustomEvent("rack-zoom-changed", {
      detail: { scale: ZOOM_STATE.scale, panX: ZOOM_STATE.panX, panY: ZOOM_STATE.panY }
    }));
  }
  function fitRackToScreen(smooth = true) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;
    const activeRack = getActiveRack ? getActiveRack() : null;
    let rackW = 634;
    let rackH = (activeRack?.heightU || 42) * 32 + 16;
    const isMulti = STATE && STATE.viewMode === "multi" && STATE.racks && STATE.racks.length > 1;
    if (isMulti) {
      const numRacks = STATE.racks.length;
      rackW = numRacks * 634 + (numRacks - 1) * 64 + 120;
      const maxU = Math.max(...STATE.racks.map((r) => r.heightU || 42));
      rackH = maxU * 32 + 16 + 140;
    }
    const padX = 24;
    const padY = 20;
    const scaleX = (cw - padX * 2) / rackW;
    const scaleY = (ch - padY * 2) / rackH;
    const fitScale = parseFloat(Math.max(ZOOM_STATE.minScale, Math.min(scaleX, scaleY, 1.25)).toFixed(4));
    ZOOM_STATE.scale = fitScale;
    ZOOM_STATE.panX = Math.round((cw - rackW * fitScale) / 2);
    ZOOM_STATE.panY = Math.max(8, Math.round((ch - rackH * fitScale) / 2));
    ZOOM_STATE.isFit = true;
    updateStageTransform(smooth);
    scheduleCableRender(smooth ? 260 : 20);
  }
  function setZoom(newScale, screenX, screenY, smooth = false) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clampedScale = parseFloat(Math.max(ZOOM_STATE.minScale, Math.min(ZOOM_STATE.maxScale, newScale)).toFixed(4));
    const cx = screenX !== void 0 ? screenX - rect.left : canvas.clientWidth / 2;
    const cy = screenY !== void 0 ? screenY - rect.top : canvas.clientHeight / 2;
    const stageX = (cx - ZOOM_STATE.panX) / ZOOM_STATE.scale;
    const stageY = (cy - ZOOM_STATE.panY) / ZOOM_STATE.scale;
    ZOOM_STATE.scale = clampedScale;
    ZOOM_STATE.panX = Math.round(cx - stageX * clampedScale);
    ZOOM_STATE.panY = Math.round(cy - stageY * clampedScale);
    ZOOM_STATE.isFit = false;
    updateStageTransform(smooth);
    scheduleCableRender(smooth ? 260 : 30);
  }
  var cableRenderTimer = null;
  function scheduleCableRender(delay = 40) {
    if (cableRenderTimer) clearTimeout(cableRenderTimer);
    cableRenderTimer = setTimeout(() => {
      cableRenderTimer = null;
      requestAnimationFrame(renderAllCables);
    }, delay);
  }
  function jumpToSection(section) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const rackW = 634;
    const targetScale = parseFloat(Math.min(1.3, Math.max(0.9, (cw - 40) / rackW)).toFixed(4));
    ZOOM_STATE.scale = targetScale;
    ZOOM_STATE.panX = Math.round((cw - rackW * targetScale) / 2);
    ZOOM_STATE.isFit = false;
    if (section === "top") {
      ZOOM_STATE.panY = 16;
    } else if (section === "mid") {
      ZOOM_STATE.panY = Math.round(ch / 2 - (getActiveRack()?.heightU || 42) * 16 * targetScale);
    } else if (section === "bot") {
      ZOOM_STATE.panY = Math.round(ch - ((getActiveRack()?.heightU || 42) * 32 + 16) * targetScale - 24);
    }
    updateStageTransform(true);
    scheduleCableRender(260);
  }
  var panFrame = 0;
  function bindZoomAndPanEvents() {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    canvas.addEventListener("wheel", (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(ZOOM_STATE.scale * factor, e.clientX, e.clientY, false);
    }, { passive: false });
    canvas.addEventListener("mousedown", (e) => {
      if (e.target.closest(".port") || e.target.closest(".dev-btn") || e.target.closest(".del-device-btn")) {
        return;
      }
      ZOOM_STATE.isPanning = true;
      ZOOM_STATE.startX = e.clientX - ZOOM_STATE.panX;
      ZOOM_STATE.startY = e.clientY - ZOOM_STATE.panY;
      ZOOM_STATE.hasMoved = false;
      canvas.classList.add("panning");
      if (dom.rackStage) dom.rackStage.classList.add("panning-active");
    });
    window.addEventListener("mousemove", (e) => {
      if (!ZOOM_STATE.isPanning) return;
      const newPanX = e.clientX - ZOOM_STATE.startX;
      const newPanY = e.clientY - ZOOM_STATE.startY;
      if (Math.abs(newPanX - ZOOM_STATE.panX) > 3 || Math.abs(newPanY - ZOOM_STATE.panY) > 3) {
        ZOOM_STATE.hasMoved = true;
      }
      ZOOM_STATE.panX = newPanX;
      ZOOM_STATE.panY = newPanY;
      ZOOM_STATE.isFit = false;
      if (!panFrame) panFrame = requestAnimationFrame(() => {
        panFrame = 0;
        updateStageTransform(false);
      });
    });
    window.addEventListener("mouseup", () => {
      if (ZOOM_STATE.isPanning) {
        ZOOM_STATE.isPanning = false;
        canvas.classList.remove("panning");
        if (dom.rackStage) dom.rackStage.classList.remove("panning-active");
        setTimeout(() => {
          ZOOM_STATE.hasMoved = false;
        }, 120);
      }
    });
    canvas.addEventListener("dblclick", (e) => {
      if (e.target.closest(".port") || e.target.closest(".dev-btn") || e.target.closest(".rack-slot") || e.target.closest(".mounted-device")) return;
      if (ZOOM_STATE.scale > 0.85) {
        fitRackToScreen(true);
      } else {
        setZoom(1.25, e.clientX, e.clientY, true);
      }
    });
    if (dom.btnZoomIn) {
      dom.btnZoomIn.addEventListener("click", () => setZoom(ZOOM_STATE.scale * 1.25, void 0, void 0, true));
    }
    if (dom.btnZoomOut) {
      dom.btnZoomOut.addEventListener("click", () => setZoom(ZOOM_STATE.scale / 1.25, void 0, void 0, true));
    }
    if (dom.btnZoomFit) {
      dom.btnZoomFit.addEventListener("click", () => fitRackToScreen(true));
    }
    if (dom.btnZoomActual) {
      dom.btnZoomActual.addEventListener("click", () => setZoom(1, void 0, void 0, true));
    }
    if (dom.zoomBadge) {
      dom.zoomBadge.addEventListener("click", () => {
        if (ZOOM_STATE.scale > 0.85) {
          fitRackToScreen(true);
        } else {
          setZoom(1, void 0, void 0, true);
        }
      });
    }
    if (dom.navJumpTop) dom.navJumpTop.addEventListener("click", () => jumpToSection("top"));
    if (dom.navJumpMid) dom.navJumpMid.addEventListener("click", () => jumpToSection("mid"));
    if (dom.navJumpBot) dom.navJumpBot.addEventListener("click", () => jumpToSection("bot"));
    window.addEventListener("rack-zoom-changed", () => scheduleCableRender(30));
  }

  // js/src/2d/rackManager.js
  function renderRackTabs() {
    if (!dom.rackTabsList) return;
    dom.rackTabsList.innerHTML = "";
    STATE.racks.forEach((rack, idx) => {
      const tab = document.createElement("div");
      tab.className = `rack-tab ${rack.id === STATE.activeRackId ? "active" : ""}`;
      tab.dataset.rackId = rack.id;
      const deviceCount = rack.devices.length;
      const canDelete = STATE.racks.length > 1;
      tab.innerHTML = `
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
        <span>${escapeHtml(rack.name)}</span>
        <span class="rack-tab-badge">${deviceCount} Cihaz</span>
        ${canDelete ? `<span class="rack-tab-close" data-rack-id="${rack.id}" title="Kabini Sil">\u2715</span>` : ""}
      `;
      tab.addEventListener("click", (e) => {
        const closeBtn = e.target.closest(".rack-tab-close");
        if (closeBtn) {
          e.stopPropagation();
          deleteRack(rack.id);
          return;
        }
        switchActiveRack(rack.id);
      });
      dom.rackTabsList.appendChild(tab);
    });
  }
  function switchActiveRack(rackId) {
    if (STATE.activeRackId === rackId) return;
    STATE.activeRackId = rackId;
    if (STATE.viewMode === "multi") {
      document.querySelectorAll(".rack-container").forEach((container) => {
        const cRackId = container.dataset.rackId;
        const isNowActive = cRackId === rackId;
        container.classList.toggle("active-rack", isNowActive);
        container.classList.toggle("inactive-rack", !isNowActive);
        const rackSpace = container.querySelector('[id^="rack-space"], .rack-space');
        const railLeft = container.querySelector('[id^="rail-left"], .rack-rail-left');
        const railRight = container.querySelector('[id^="rail-right"], .rack-rail-right');
        if (rackSpace) rackSpace.id = isNowActive ? "rack-space" : `rack-${cRackId}-space`;
        if (railLeft) railLeft.id = isNowActive ? "rail-left" : `rack-${cRackId}-rail-left`;
        if (railRight) railRight.id = isNowActive ? "rail-right" : `rack-${cRackId}-rail-right`;
        const slots = container.querySelectorAll('[id^="rack-slot-u"], [id^="rack-"]');
        slots.forEach((slot) => {
          const uMatch = slot.id.match(/u(\d+)$/);
          if (!uMatch) return;
          const u = uMatch[1];
          slot.id = isNowActive ? `rack-slot-u${u}` : `rack-${cRackId}-slot-u${u}`;
        });
      });
      initDomReferences();
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
    } else {
      renderRackRailsAndSlots();
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
      requestAnimationFrame(() => fitRackToScreen(false));
    }
  }
  function addNewRack(customName) {
    do {
      STATE.rackCounter++;
    } while (STATE.racks.some((r) => r.id === `rack-${STATE.rackCounter}`));
    const newId = `rack-${STATE.rackCounter}`;
    const newName = customName || `Kabin ${STATE.rackCounter} - IDF Kenar`;
    const newRack = {
      id: newId,
      name: newName,
      heightU: 42,
      units: Array(43).fill(null),
      devices: []
    };
    STATE.racks.push(newRack);
    STATE.activeRackId = newId;
    renderRackRailsAndSlots();
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    requestAnimationFrame(() => fitRackToScreen(false));
    return newRack;
  }
  function deleteRack(rackId) {
    if (STATE.racks.length <= 1) {
      alert("En az bir kabin bulunmal\u0131d\u0131r!");
      return;
    }
    const rackToDelete = STATE.racks.find((r) => r.id === rackId);
    if (!rackToDelete) return;
    if (confirm(`"${rackToDelete.name}" kabinini ve i\xE7indeki t\xFCm cihazlar\u0131 silmek istedi\u011Finize emin misiniz?`)) {
      STATE.cables = STATE.cables.filter((c) => c.from.rackId !== rackId && c.to.rackId !== rackId);
      STATE.racks = STATE.racks.filter((r) => r.id !== rackId);
      if (STATE.activeRackId === rackId) {
        STATE.activeRackId = STATE.racks[0].id;
      }
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
    }
  }

  // js/src/2d/topologyIO.js
  function exportVisioSvg() {
    const totalWidth = 700;
    const activeRack = getActiveRack();
    const heightU = activeRack?.heightU || 42;
    const totalHeight = heightU * 32 + 80;
    let svgContent = `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd">
<svg xmlns="http://www.w3.org/2000/svg" 
     xmlns:v="http://schemas.microsoft.com/visio/2003/SVGExtensions/" 
     width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">
  
  <style>
    .v-rack-post { fill: #1c202a; stroke: #333a47; stroke-width: 1; }
    .v-u-label { font-family: 'Segoe UI', Arial, sans-serif; font-size: 10px; fill: #64748b; font-weight: bold; }
    .v-hole { fill: #0d1117; stroke: #3b4252; stroke-width: 0.5; }
    .v-device-body { fill: #1e2430; stroke: #475569; stroke-width: 1; }
    .v-device-text { font-family: 'Segoe UI', Arial, sans-serif; font-size: 9px; fill: #38bdf8; font-weight: bold; }
    .v-cable { fill: none; stroke-linecap: round; filter: drop-shadow(0px 2px 2px rgba(0,0,0,0.5)); }
  </style>

  <!-- LAYER 1: RACK CABINET FRAME AND RAILS -->
  <g v:groupContext="layer" v:layerMember="Rack_Cabinet">
    <text x="350" y="15" text-anchor="middle" font-family="'Segoe UI', Arial" font-size="12" fill="#38bdf8" font-weight="bold">${escapeHtml(activeRack ? activeRack.name : "42U Rack")}</text>
    <rect x="40" y="20" width="620" height="${heightU * 32}" fill="#11141c" stroke="#2d3340" stroke-width="4"/>
    <rect x="40" y="20" width="44" height="${heightU * 32}" class="v-rack-post"/>
    <rect x="616" y="20" width="44" height="${heightU * 32}" class="v-rack-post"/>
`;
    for (let u = heightU; u >= 1; u--) {
      const y = 20 + (heightU - u) * 32;
      svgContent += `
        <line x1="40" y1="${y}" x2="660" y2="${y}" stroke="#1f2430" stroke-width="0.5" stroke-dasharray="2,2"/>
        <text x="62" y="${y + 20}" text-anchor="middle" class="v-u-label">${u}</text>
        <text x="638" y="${y + 20}" text-anchor="middle" class="v-u-label">${u}</text>
        <rect x="48" y="${y + 6}" width="4" height="4" class="v-hole"/>
        <rect x="48" y="${y + 14}" width="4" height="4" class="v-hole"/>
        <rect x="48" y="${y + 22}" width="4" height="4" class="v-hole"/>
        <rect x="648" y="${y + 6}" width="4" height="4" class="v-hole"/>
        <rect x="648" y="${y + 14}" width="4" height="4" class="v-hole"/>
        <rect x="648" y="${y + 22}" width="4" height="4" class="v-hole"/>
      `;
    }
    svgContent += `  </g>
`;
    svgContent += `  <!-- LAYER 2: CISCO & NETWORK HARDWARE -->
  <g v:groupContext="layer" v:layerMember="Network_Devices">
`;
    if (activeRack) {
      activeRack.devices.forEach((dev) => {
        const cat = HARDWARE_CATALOG[dev.catalogKey];
        if (!cat) return;
        const y = 20 + (heightU - dev.topU) * 32;
        const height = dev.uHeight * 32;
        svgContent += `
          <g v:groupContext="shape" v:mID="${dev.instanceId}">
            <rect x="84" y="${y}" width="532" height="${height}" class="v-device-body"/>
            <text x="96" y="${y + 18}" class="v-device-text">${escapeHtml(cat.name)} (U${dev.topU})</text>
            <rect x="96" y="${y + 22}" width="6" height="4" fill="#22c55e"/>
            <rect x="104" y="${y + 22}" width="6" height="4" fill="#38bdf8"/>
          </g>
        `;
      });
    }
    svgContent += `  </g>
`;
    svgContent += `  <!-- LAYER 3: CABLING RUN SCHEDULE & CONNECTIONS -->
  <g v:groupContext="layer" v:layerMember="Patch_Cables" transform="translate(40, 20)">
`;
    const svgLayer = document.getElementById("cables-svg");
    if (svgLayer) {
      const paths = svgLayer.querySelectorAll(".cable-path");
      paths.forEach((p, idx) => {
        const d = p.getAttribute("d");
        const stroke = p.getAttribute("stroke");
        const cable = STATE.cables.find((c) => "svg-cable-" + c.id === p.id) || { id: "CBL" };
        svgContent += `
          <path d="${d}" stroke="${stroke}" stroke-width="2.8" class="v-cable" v:groupContext="shape">
            <title>${cable.id} (${cable.lengthMeters}m)</title>
          </path>
        `;
      });
    }
    svgContent += `  </g>
</svg>`;
    const blob = new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const dlLink = document.createElement("a");
    dlLink.href = url;
    const safeName = activeRack ? activeRack.name.replace(/[^a-zA-Z0-9_-]/g, "_") : "rack";
    dlLink.download = `cisco-${heightU}u-visio-${safeName}-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.svg`;
    document.body.appendChild(dlLink);
    dlLink.click();
    dlLink.remove();
    URL.revokeObjectURL(url);
  }
  function exportJson() {
    const exportData = {
      version: "4.0-studio",
      customCatalog: STATE.customCatalog,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      activeRackId: STATE.activeRackId,
      racks: STATE.racks,
      cables: STATE.cables
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement("a");
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `cisco-site-topology-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }
  function validateTopology(data) {
    if (!data || typeof data !== "object") throw new Error("Ge\xE7ersiz proje.");
    const customCatalog = JSON.parse(JSON.stringify(data.customCatalog || {}));
    if (Array.isArray(customCatalog) || typeof customCatalog !== "object") throw new Error("Ge\xE7ersiz katalog.");
    const validId = (value) => typeof value === "string" && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
    for (const [key, cat] of Object.entries(customCatalog)) {
      if (!validId(key) || ["__proto__", "constructor", "prototype"].includes(key) || BUILTIN_KEYS.has(key) || !cat || !Number.isInteger(cat.u) || cat.u < 1 || cat.u > 60 || !Array.isArray(cat.ports) || typeof cat.name !== "string") throw new Error("Ge\xE7ersiz \xF6zel cihaz: " + key);
      const ids = /* @__PURE__ */ new Set();
      for (const port of cat.ports) {
        if (!validId(port.id) || ids.has(port.id)) throw new Error("Ge\xE7ersiz port.");
        ids.add(port.id);
      }
    }
    const catalog = Object.fromEntries([...BUILTIN_KEYS].map((key) => [key, HARDWARE_CATALOG[key]]));
    Object.assign(catalog, customCatalog);
    const legacy = !Array.isArray(data.racks);
    const sourceRacks = legacy ? [{ id: "rack-1", name: "MDF - Da\u011F\u0131t\u0131m Kabini", heightU: data.heightU || 42, devices: data.devices }] : data.racks;
    if (!sourceRacks.length || sourceRacks.length > 1e3) throw new Error("Proje en az bir kabin i\xE7ermeli.");
    const rackIds = /* @__PURE__ */ new Set(), deviceIds = /* @__PURE__ */ new Set(), deviceMap = /* @__PURE__ */ new Map();
    const racks = sourceRacks.map((source) => {
      const heightU = source.heightU ?? 42;
      if (!validId(source.id) || rackIds.has(source.id) || typeof source.name !== "string" || !Number.isInteger(heightU) || heightU < 1 || heightU > 60 || !Array.isArray(source.devices)) throw new Error("Ge\xE7ersiz kabin.");
      rackIds.add(source.id);
      const units = Array(heightU + 1).fill(null);
      const devices = source.devices.map((dev) => {
        const cat = Object.hasOwn(catalog, dev.catalogKey) ? catalog[dev.catalogKey] : null;
        if (!cat || !validId(dev.instanceId) || deviceIds.has(dev.instanceId) || !Number.isInteger(dev.topU) || dev.topU > heightU || dev.topU - cat.u < 0 || dev.uHeight !== void 0 && dev.uHeight !== cat.u) throw new Error("Ge\xE7ersiz cihaz veya U konumu.");
        for (let u = dev.topU - cat.u + 1; u <= dev.topU; u++) {
          if (units[u]) throw new Error("Cihaz yerle\u015Fimleri \xE7ak\u0131\u015F\u0131yor.");
          units[u] = dev.instanceId;
        }
        deviceIds.add(dev.instanceId);
        deviceMap.set(dev.instanceId, { rackId: source.id, cat });
        return { ...dev, uHeight: cat.u };
      });
      return { ...source, heightU, units, devices };
    });
    if (data.cables !== void 0 && !Array.isArray(data.cables)) throw new Error("Ge\xE7ersiz kablolar.");
    const cableIds = /* @__PURE__ */ new Set(), usedPorts = /* @__PURE__ */ new Set();
    const cables = (data.cables || []).map((c) => {
      if (!validId(c.id) || cableIds.has(c.id)) throw new Error("Tekrarlanan/ge\xE7ersiz kablo kimli\u011Fi.");
      cableIds.add(c.id);
      const endpoints = ["from", "to"].map((side) => {
        const endpoint = { ...c[side] };
        if (legacy && !endpoint.rackId) endpoint.rackId = "rack-1";
        const device = deviceMap.get(endpoint.instanceId);
        const key = portKey(endpoint.instanceId, endpoint.portId);
        if (!device || endpoint.rackId !== device.rackId || !device.cat.ports.some((p) => p.id === endpoint.portId) || usedPorts.has(key)) throw new Error("Ge\xE7ersiz veya dolu kablo portu.");
        usedPorts.add(key);
        return endpoint;
      });
      if (c.color && !/^#[0-9a-f]{6}$/i.test(c.color)) throw new Error("Ge\xE7ersiz kablo rengi.");
      if (c.lengthMeters !== void 0 && (!Number.isFinite(c.lengthMeters) || c.lengthMeters < 0)) throw new Error("Ge\xE7ersiz kablo uzunlu\u011Fu.");
      return { ...c, from: endpoints[0], to: endpoints[1] };
    });
    return { racks, cables, customCatalog, activeRackId: rackIds.has(data.activeRackId) ? data.activeRackId : racks[0].id };
  }
  function refresh() {
    renderRackRailsAndSlots();
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    document.dispatchEvent(new CustomEvent("rackstudio:refresh", { bubbles: true }));
    document.dispatchEvent(new CustomEvent("rackstudio:change", { bubbles: true }));
  }
  function loadCustomTopology(data) {
    const next = validateTopology(data);
    for (const key of Object.keys(HARDWARE_CATALOG)) if (!BUILTIN_KEYS.has(key)) delete HARDWARE_CATALOG[key];
    Object.assign(HARDWARE_CATALOG, next.customCatalog);
    Object.assign(STATE, next);
    STATE.rackCounter = Math.max(0, ...STATE.racks.map((r) => Number(r.id.match(/\d+$/)?.[0]) || 0));
    STATE.cableCounter = Math.max(0, ...STATE.cables.map((c) => Number(c.id.match(/\d+$/)?.[0]) || 0));
    cancelPendingConnection();
    STATE.highlightedCableId = null;
    refresh();
    return true;
  }

  // js/src/2d/presets.js
  function loadMdfPreset() {
    STATE.racks = [
      {
        id: "rack-1",
        name: "MDF - Ana Da\u011F\u0131t\u0131m & WAN Omurga Kabini",
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ];
    STATE.activeRackId = "rack-1";
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.highlightedCableId = null;
    const r = STATE.racks[0];
    const dODF = mountDeviceAt("fiber-odf-24", 42, r.id);
    mountDeviceAt("organizer-1u", 41, r.id);
    const dRouter1 = mountDeviceAt("cisco-isr-4431", 40, r.id);
    const dRouter2 = mountDeviceAt("cisco-isr-4431", 39, r.id);
    mountDeviceAt("organizer-1u", 38, r.id);
    const dCoreFiber1 = mountDeviceAt("cisco-3850-24s", 37, r.id);
    const dCoreFiber2 = mountDeviceAt("cisco-3850-24s", 36, r.id);
    mountDeviceAt("organizer-2u", 35, r.id);
    const dCore9300 = mountDeviceAt("cisco-9300l-24p", 33, r.id);
    const dPatch32 = mountDeviceAt("patch-cat6-24", 32, r.id);
    mountDeviceAt("organizer-1u", 31, r.id);
    const dSwitch9200 = mountDeviceAt("cisco-9200l-24p", 30, r.id);
    const dPatch29 = mountDeviceAt("patch-cat6-24", 29, r.id);
    mountDeviceAt("blank-panel-1u", 28, r.id);
    if (dODF && dRouter1) {
      addDirectCable(r.id, dODF.instanceId, "lc1", r.id, dRouter1.instanceId, "ge0_0_2", "#06b6d4", 1.2);
      addDirectCable(r.id, dODF.instanceId, "lc2", r.id, dRouter2.instanceId, "ge0_0_2", "#06b6d4", 1.2);
    }
    if (dRouter1 && dCoreFiber1) {
      addDirectCable(r.id, dRouter1.instanceId, "ge0_0_0", r.id, dCoreFiber1.instanceId, "sfp1", "#ef4444", 1.5);
      addDirectCable(r.id, dRouter2.instanceId, "ge0_0_0", r.id, dCoreFiber2.instanceId, "sfp1", "#ef4444", 1.5);
    }
    if (dCoreFiber1 && dCoreFiber2) {
      addDirectCable(r.id, dCoreFiber1.instanceId, "up1", r.id, dCoreFiber2.instanceId, "up1", "#a855f7", 0.4);
      addDirectCable(r.id, dCoreFiber1.instanceId, "up2", r.id, dCoreFiber2.instanceId, "up2", "#a855f7", 0.4);
    }
    if (dCore9300 && dPatch32) {
      addDirectCable(r.id, dPatch32.instanceId, "pt1", r.id, dCore9300.instanceId, "p1", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch32.instanceId, "pt2", r.id, dCore9300.instanceId, "p2", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch32.instanceId, "pt3", r.id, dCore9300.instanceId, "p3", "#eab308", 0.3);
      addDirectCable(r.id, dPatch32.instanceId, "pt4", r.id, dCore9300.instanceId, "p4", "#22c55e", 0.3);
    }
    if (dSwitch9200 && dPatch29) {
      addDirectCable(r.id, dPatch29.instanceId, "pt1", r.id, dSwitch9200.instanceId, "p1", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch29.instanceId, "pt2", r.id, dSwitch9200.instanceId, "p2", "#2563eb", 0.3);
    }
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
  }
  function loadIdfPreset() {
    STATE.racks = [
      {
        id: "rack-1",
        name: "IDF-1 - Kat 1 Kenar Eri\u015Fim Kabini",
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ];
    STATE.activeRackId = "rack-1";
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.highlightedCableId = null;
    const r = STATE.racks[0];
    const dODF = mountDeviceAt("fiber-odf-24", 42, r.id);
    mountDeviceAt("organizer-1u", 41, r.id);
    const dPatch1 = mountDeviceAt("patch-cat6-24", 40, r.id);
    const dSwitchX1 = mountDeviceAt("cisco-2960x-24ps", 39, r.id);
    mountDeviceAt("organizer-1u", 38, r.id);
    const dPatch2 = mountDeviceAt("patch-cat6-24", 37, r.id);
    const dSwitchPC1 = mountDeviceAt("cisco-2960-24pc", 36, r.id);
    mountDeviceAt("organizer-2u", 35, r.id);
    const dPatch3 = mountDeviceAt("patch-cat6-48", 33, r.id);
    const dSwitchPC2 = mountDeviceAt("cisco-2960-24pc", 32, r.id);
    mountDeviceAt("organizer-1u", 31, r.id);
    const dSwitchTC = mountDeviceAt("cisco-2960-24tc", 30, r.id);
    mountDeviceAt("blank-panel-1u", 29, r.id);
    if (dODF && dSwitchX1) {
      addDirectCable(r.id, dODF.instanceId, "lc1", r.id, dSwitchX1.instanceId, "up1", "#06b6d4", 1.2);
    }
    if (dPatch1 && dSwitchX1) {
      addDirectCable(r.id, dPatch1.instanceId, "pt1", r.id, dSwitchX1.instanceId, "p1", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch1.instanceId, "pt2", r.id, dSwitchX1.instanceId, "p2", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch1.instanceId, "pt3", r.id, dSwitchX1.instanceId, "p3", "#eab308", 0.3);
      addDirectCable(r.id, dPatch1.instanceId, "pt4", r.id, dSwitchX1.instanceId, "p4", "#22c55e", 0.3);
    }
    if (dPatch2 && dSwitchPC1) {
      addDirectCable(r.id, dPatch2.instanceId, "pt1", r.id, dSwitchPC1.instanceId, "fa1", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch2.instanceId, "pt2", r.id, dSwitchPC1.instanceId, "fa2", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch2.instanceId, "pt3", r.id, dSwitchPC1.instanceId, "fa3", "#eab308", 0.3);
    }
    if (dPatch3 && dSwitchPC2) {
      addDirectCable(r.id, dPatch3.instanceId, "pt1", r.id, dSwitchPC2.instanceId, "fa1", "#2563eb", 0.3);
      addDirectCable(r.id, dPatch3.instanceId, "pt2", r.id, dSwitchPC2.instanceId, "fa2", "#2563eb", 0.3);
    }
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
  }
  function loadFullSitePreset() {
    STATE.racks = [
      {
        id: "rack-1",
        name: "MDF - Ana Da\u011F\u0131t\u0131m & Omurga",
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      },
      {
        id: "rack-2",
        name: "IDF-1 - Kat 1 Kenar Kabini",
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      },
      {
        id: "rack-3",
        name: "IDF-2 - Kat 2 Kenar Kabini",
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ];
    STATE.activeRackId = "rack-1";
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.rackCounter = 3;
    const r1 = STATE.racks[0];
    const r2 = STATE.racks[1];
    const r3 = STATE.racks[2];
    const mdfODF = mountDeviceAt("fiber-odf-24", 42, r1.id);
    mountDeviceAt("organizer-1u", 41, r1.id);
    const mdfRouter1 = mountDeviceAt("cisco-isr-4431", 40, r1.id);
    const mdfRouter2 = mountDeviceAt("cisco-isr-4431", 39, r1.id);
    mountDeviceAt("organizer-1u", 38, r1.id);
    const mdfFiber1 = mountDeviceAt("cisco-3850-24s", 37, r1.id);
    const mdfFiber2 = mountDeviceAt("cisco-3850-24s", 36, r1.id);
    mountDeviceAt("organizer-2u", 35, r1.id);
    const mdfCore9300 = mountDeviceAt("cisco-9300l-24p", 33, r1.id);
    const mdfPatch = mountDeviceAt("patch-cat6-24", 32, r1.id);
    const idf1ODF = mountDeviceAt("fiber-odf-24", 42, r2.id);
    mountDeviceAt("organizer-1u", 41, r2.id);
    const idf1Patch1 = mountDeviceAt("patch-cat6-24", 40, r2.id);
    const idf1SwX = mountDeviceAt("cisco-2960x-24ps", 39, r2.id);
    mountDeviceAt("organizer-1u", 38, r2.id);
    const idf1Patch2 = mountDeviceAt("patch-cat6-24", 37, r2.id);
    const idf1SwPC = mountDeviceAt("cisco-2960-24pc", 36, r2.id);
    const idf2ODF = mountDeviceAt("fiber-odf-24", 42, r3.id);
    mountDeviceAt("organizer-1u", 41, r3.id);
    const idf2Patch1 = mountDeviceAt("patch-cat6-24", 40, r3.id);
    const idf2SwXR = mountDeviceAt("cisco-2960xr-24ps", 39, r3.id);
    mountDeviceAt("organizer-1u", 38, r3.id);
    const idf2Patch2 = mountDeviceAt("patch-cat6-24", 37, r3.id);
    const idf2SwPC = mountDeviceAt("cisco-2960-24pc", 36, r3.id);
    addDirectCable(r1.id, mdfODF.instanceId, "lc1", r1.id, mdfRouter1.instanceId, "ge0_0_2", "#06b6d4", 1.2);
    addDirectCable(r1.id, mdfODF.instanceId, "lc2", r1.id, mdfRouter2.instanceId, "ge0_0_2", "#06b6d4", 1.2);
    addDirectCable(r1.id, mdfRouter1.instanceId, "ge0_0_0", r1.id, mdfFiber1.instanceId, "sfp1", "#ef4444", 1.5);
    addDirectCable(r1.id, mdfRouter2.instanceId, "ge0_0_0", r1.id, mdfFiber2.instanceId, "sfp1", "#ef4444", 1.5);
    addDirectCable(r1.id, mdfPatch.instanceId, "pt1", r1.id, mdfCore9300.instanceId, "p1", "#2563eb", 0.3);
    addDirectCable(r1.id, mdfPatch.instanceId, "pt2", r1.id, mdfCore9300.instanceId, "p2", "#2563eb", 0.3);
    addDirectCable(r2.id, idf1Patch1.instanceId, "pt1", r2.id, idf1SwX.instanceId, "p1", "#2563eb", 0.3);
    addDirectCable(r2.id, idf1Patch1.instanceId, "pt2", r2.id, idf1SwX.instanceId, "p2", "#2563eb", 0.3);
    addDirectCable(r2.id, idf1Patch2.instanceId, "pt1", r2.id, idf1SwPC.instanceId, "fa1", "#2563eb", 0.3);
    addDirectCable(r3.id, idf2Patch1.instanceId, "pt1", r3.id, idf2SwXR.instanceId, "p1", "#2563eb", 0.3);
    addDirectCable(r3.id, idf2Patch2.instanceId, "pt1", r3.id, idf2SwPC.instanceId, "fa1", "#2563eb", 0.3);
    addDirectCable(r1.id, mdfFiber1.instanceId, "sfp5", r2.id, idf1ODF.instanceId, "lc1", "#06b6d4", 45);
    addDirectCable(r1.id, mdfFiber2.instanceId, "sfp5", r2.id, idf1ODF.instanceId, "lc2", "#06b6d4", 45);
    addDirectCable(r1.id, mdfFiber1.instanceId, "sfp6", r3.id, idf2ODF.instanceId, "lc1", "#06b6d4", 75);
    addDirectCable(r1.id, mdfFiber2.instanceId, "sfp6", r3.id, idf2ODF.instanceId, "lc2", "#06b6d4", 75);
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
  }

  // js/src/2d/appCore.js
  function init() {
    initDomReferences();
    renderRackRailsAndSlots(handleSlotClick);
    bindCatalogEvents();
    bindColorSwatchEvents();
    bindHeaderActionEvents();
    bindRoutingSelectorEvents();
    bindGlobalEvents();
    bindZoomAndPanEvents();
    loadMdfPreset();
    requestAnimationFrame(() => {
      fitRackToScreen(false);
    });
  }
  function mountDeviceFromAction(catalogKey, targetU, e, targetRackId) {
    if (!catalogKey) return false;
    const catalogItem = HARDWARE_CATALOG[catalogKey];
    if (!catalogItem) return false;
    const requiredU = catalogItem.u;
    const startU = targetU;
    const endU = targetU - requiredU + 1;
    if (endU < 1) {
      alert(`Bu cihaz ${requiredU}U y\xFCksekli\u011Finde. U${targetU} seviyesine s\u0131\u011Fm\u0131yor.`);
      return false;
    }
    const targetRack = targetRackId ? STATE.racks.find((r) => r.id === targetRackId) : getActiveRack();
    if (!targetRack) return false;
    for (let u = endU; u <= startU; u++) {
      if (targetRack.units[u] !== null) {
        alert(`U${u} pozisyonu dolu! L\xFCtfen bo\u015F bir slot se\xE7in.`);
        return false;
      }
    }
    const mounted = mountDeviceAt(catalogKey, startU, targetRackId);
    renderRackTabs();
    renderMountedDevices();
    renderAllCables();
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent("rackstudio:refresh"));
    }
    return !!mounted;
  }
  window.mountDeviceFromAction = mountDeviceFromAction;
  function handleSlotDoubleClick(targetU, e, targetRackId) {
    if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
    if (!STATE.selectedLibraryItem) {
      showTemporaryTooltip2(e.clientX, e.clientY, "L\xFCtfen \xF6nce sol men\xFCden monte edilecek bir donan\u0131m se\xE7in veya s\xFCr\xFCkleyin!");
      return;
    }
    mountDeviceFromAction(STATE.selectedLibraryItem, targetU, e, targetRackId);
  }
  var handleSlotClick = handleSlotDoubleClick;
  function bindCatalogEvents() {
    const cards = document.querySelectorAll(".device-card");
    cards.forEach((card) => {
      card.setAttribute("draggable", "true");
      card.addEventListener("dragstart", (e) => {
        const devId = card.dataset.deviceId;
        if (!devId) return;
        window.__RACK_DRAGGED_DEVICE__ = devId;
        e.dataTransfer.setData("text/plain", devId);
        e.dataTransfer.setData("application/x-rack-device", devId);
        e.dataTransfer.effectAllowed = "copy";
        card.classList.add("dragging");
      });
      card.addEventListener("dragend", () => {
        card.classList.remove("dragging");
        window.__RACK_DRAGGED_DEVICE__ = null;
        highlightDropSlots(null, null, false);
      });
      card.addEventListener("click", () => {
        document.querySelectorAll(".device-card").forEach((c) => c.classList.remove("active"));
        const devId = card.dataset.deviceId;
        if (STATE.selectedLibraryItem === devId) {
          STATE.selectedLibraryItem = null;
          if (dom.statusSelectionText) {
            dom.statusSelectionText.textContent = "K\xFCt\xFCphaneden bir donan\u0131m se\xE7in veya kablolama yap\u0131n.";
          }
        } else {
          card.classList.add("active");
          STATE.selectedLibraryItem = devId;
          const item = HARDWARE_CATALOG[devId];
          if (dom.statusSelectionText && item) {
            dom.statusSelectionText.textContent = `Se\xE7ili: [${item.name}] (${item.u}U). Yerle\u015Ftirmek i\xE7in bo\u015F bir U yuvas\u0131na \xC7\u0130FT TIKLAYIN veya s\xFCr\xFCkleyip b\u0131rak\u0131n.`;
          }
        }
      });
    });
  }
  function bindColorSwatchEvents() {
    const swatches = document.querySelectorAll(".color-swatch");
    swatches.forEach((swatch) => {
      swatch.addEventListener("click", () => {
        swatches.forEach((s) => s.classList.remove("selected"));
        swatch.classList.add("selected");
        STATE.selectedCableColor = swatch.dataset.color;
      });
    });
  }
  function bindRoutingSelectorEvents() {
    if (dom.btnRouteStructured && dom.btnRouteDirect) {
      dom.btnRouteStructured.addEventListener("click", () => {
        dom.btnRouteStructured.classList.add("active");
        dom.btnRouteDirect.classList.remove("active");
        STATE.cableRoutingMode = "structured";
        renderAllCables();
      });
      dom.btnRouteDirect.addEventListener("click", () => {
        dom.btnRouteDirect.classList.add("active");
        dom.btnRouteStructured.classList.remove("active");
        STATE.cableRoutingMode = "direct";
        renderAllCables();
      });
    }
    if (dom.btnTidyCables) {
      dom.btnTidyCables.addEventListener("click", () => {
        renderAllCables();
        const orig = dom.btnTidyCables.textContent;
        dom.btnTidyCables.textContent = "\u2713 D\xFCzenlendi";
        dom.btnTidyCables.style.color = "#22c55e";
        setTimeout(() => {
          dom.btnTidyCables.textContent = orig;
          dom.btnTidyCables.style.color = "";
        }, 1200);
      });
    }
  }
  function setViewMode(mode) {
    STATE.viewMode = mode;
    dom.btnViewModeSingle?.classList.toggle("active", mode === "single");
    dom.btnViewModeMulti?.classList.toggle("active", mode === "multi");
    renderRackRailsAndSlots(handleSlotClick);
    renderMountedDevices();
    renderAllCables();
    requestAnimationFrame(() => fitRackToScreen(false));
  }
  function bindHeaderActionEvents() {
    if (dom.btnAddRack) {
      dom.btnAddRack.addEventListener("click", () => {
        const name = prompt("Yeni Kabin Ad\u0131 (\xD6rn: IDF-2 Kat 2):");
        if (name && name.trim()) {
          addNewRack(name.trim());
        }
      });
    }
    if (dom.btnRenameRack) {
      dom.btnRenameRack.addEventListener("click", () => renameActiveRack());
    }
    if (dom.btnViewModeSingle) {
      dom.btnViewModeSingle.addEventListener("click", () => setViewMode("single"));
    }
    if (dom.btnViewModeMulti) {
      dom.btnViewModeMulti.addEventListener("click", () => setViewMode("multi"));
    }
    if (dom.btnPresetMdf) {
      dom.btnPresetMdf.addEventListener("click", () => {
        if (confirm("MDF Ana Da\u011F\u0131t\u0131m Kabini \u015Fablonu y\xFCklensin mi? (Mevcut topoloji s\u0131f\u0131rlan\u0131r)")) {
          loadMdfPreset();
        }
      });
    }
    if (dom.btnPresetIdf) {
      dom.btnPresetIdf.addEventListener("click", () => {
        if (confirm("IDF Kat Kenar Kabini \u015Fablonu y\xFCklensin mi? (Mevcut topoloji s\u0131f\u0131rlan\u0131r)")) {
          loadIdfPreset();
        }
      });
    }
    if (dom.btnPresetSite) {
      dom.btnPresetSite.addEventListener("click", () => {
        if (confirm("T\xFCm Saha Topolojisi (MDF + IDF-1 + IDF-2 \xC7oklu Kabin) y\xFCklensin mi?")) {
          loadFullSitePreset();
        }
      });
    }
    if (dom.btnClearAll) {
      dom.btnClearAll.addEventListener("click", () => {
        if (confirm("T\xFCm kabinler, cihazlar ve kablolar s\u0131f\u0131rlanacakt\u0131r. Onayl\u0131yor musunuz?")) {
          STATE.racks = [
            {
              id: "rack-1",
              name: "MDF - Da\u011F\u0131t\u0131m Kabini",
              heightU: 42,
              units: Array(43).fill(null),
              devices: []
            }
          ];
          STATE.activeRackId = "rack-1";
          STATE.cables = [];
          STATE.cableCounter = 0;
          STATE.rackCounter = 1;
          STATE.highlightedCableId = null;
          cancelPendingConnection();
          renderRackTabs();
          renderMountedDevices();
          renderScheduleTable();
          renderAllCables();
        }
      });
    }
    if (dom.btnClearCables) {
      dom.btnClearCables.addEventListener("click", () => {
        if (confirm("T\xFCm kablolar\u0131 silmek istiyor musunuz?")) {
          STATE.cables = [];
          STATE.highlightedCableId = null;
          cancelPendingConnection();
          renderMountedDevices();
          renderScheduleTable();
          renderAllCables();
        }
      });
    }
    if (dom.btnExportJson) {
      dom.btnExportJson.addEventListener("click", () => exportJson());
    }
    if (dom.btnImportJson) {
      dom.btnImportJson.addEventListener("click", () => {
        if (dom.fileImport) dom.fileImport.click();
      });
    }
    if (dom.fileImport) {
      dom.fileImport.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            loadCustomTopology(parsed);
          } catch (err) {
            alert("JSON dosyas\u0131 okunurken hata olu\u015Ftu: " + err.message);
          }
        };
        reader.readAsText(file);
        dom.fileImport.value = "";
      });
    }
    if (dom.btnExportVisio) {
      dom.btnExportVisio.addEventListener("click", () => exportVisioSvg());
    }
  }
  function bindGlobalEvents() {
    window.addEventListener("click", (e) => {
      if (!e.target.closest(".port")) {
        cancelPendingConnection();
      }
    });
    window.addEventListener("resize", () => {
      if (ZOOM_STATE.isFit) {
        fitRackToScreen(false);
      }
      renderAllCables();
    });
    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "+" || e.key === "=") {
        setZoom(ZOOM_STATE.scale * 1.2, void 0, void 0, true);
      } else if (e.key === "-" || e.key === "_") {
        setZoom(ZOOM_STATE.scale / 1.2, void 0, void 0, true);
      } else if (e.key === "0") {
        setZoom(1, void 0, void 0, true);
      } else if (e.key === "f" || e.key === "F") {
        fitRackToScreen(true);
      } else if (e.key === "Escape") {
        cancelPendingConnection();
      }
    });
  }
  function showTemporaryTooltip2(x, y, msg) {
    if (!dom.tooltip) return;
    dom.tooltip.style.display = "block";
    dom.tooltip.style.left = `${x + 10}px`;
    dom.tooltip.style.top = `${y + 10}px`;
    dom.tooltip.innerHTML = `<span style="color:#f59e0b;">&#9888; ${msg}</span>`;
    setTimeout(() => {
      if (dom.tooltip) dom.tooltip.style.display = "none";
    }, 2500);
  }
  function updatePortConfig(instanceId, portId, config) {
    const activeRack = getActiveRack();
    if (!activeRack) return false;
    const dev = activeRack.devices.find((d) => d.instanceId === instanceId);
    if (!dev) return false;
    if (!dev.portsConfig) dev.portsConfig = {};
    if (!config || config.role === "access" && !config.ciscoName && !config.vlan && !config.description && !config.color) {
      delete dev.portsConfig[portId];
      delete dev.portsConfig[String(portId).replace("p", "")];
    } else {
      const role = config.role || "trunk";
      const defaultRoleColors = {
        trunk: "#a855f7",
        uplink: "#00d2ff",
        poe: "#f59e0b",
        mgmt: "#10b981",
        management: "#10b981",
        access: "#3b82f6"
      };
      const resolvedColor = config.color || defaultRoleColors[role] || "#a855f7";
      dev.portsConfig[portId] = {
        role,
        isTrunk: role === "trunk" || config.isTrunk === true,
        color: resolvedColor,
        ciscoName: config.ciscoName || "",
        vlan: config.vlan || "",
        description: config.description || "",
        autoCableColor: config.autoCableColor !== false
      };
      dev.portsConfig[String(portId).replace("p", "")] = dev.portsConfig[portId];
      if (config.autoCableColor !== false) {
        const connectedCable = STATE.cables.find(
          (c) => c.from.instanceId === instanceId && (c.from.portId === portId || String(c.from.portId).replace("p", "") === String(portId).replace("p", "")) || c.to.instanceId === instanceId && (c.to.portId === portId || String(c.to.portId).replace("p", "") === String(portId).replace("p", ""))
        );
        if (connectedCable) {
          connectedCable.color = resolvedColor;
          connectedCable.role = role;
          if (role === "trunk" && !connectedCable.name.startsWith("[TRUNK]")) {
            connectedCable.name = `[TRUNK] ${connectedCable.id}`;
          } else if (role !== "trunk") {
            connectedCable.name = (connectedCable.name || "").replace(/^\[TRUNK\]\s*/i, "");
          }
          const otherEndpoint = connectedCable.from.instanceId === instanceId ? connectedCable.to : connectedCable.from;
          let otherDev = null;
          (STATE.racks || []).forEach((r) => {
            if (!otherDev) otherDev = r.devices?.find((d) => d.instanceId === otherEndpoint.instanceId);
          });
          if (otherDev) {
            if (!otherDev.portsConfig) otherDev.portsConfig = {};
            otherDev.portsConfig[otherEndpoint.portId] = {
              role,
              isTrunk: role === "trunk" || config.isTrunk === true,
              color: resolvedColor,
              autoCableColor: true
            };
            otherDev.portsConfig[String(otherEndpoint.portId).replace("p", "")] = otherDev.portsConfig[otherEndpoint.portId];
          }
        }
      }
    }
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent("rackstudio:refresh"));
    return true;
  }
  window.RackStudio = {
    STATE,
    catalog: HARDWARE_CATALOG,
    getActiveRack,
    refresh,
    renderAllCables,
    renderMountedDevices,
    renderScheduleTable,
    setConnectionRole,
    fit: fitRackToScreen,
    mountDeviceAt,
    mountDeviceFromAction,
    setViewMode,
    loadCustomTopology,
    validateTopology,
    exportJson,
    exportVisioSvg,
    switchActiveRack,
    addNewRack,
    removeDevice,
    updateDeviceMetadata,
    updatePortConfig,
    highlightCable,
    disconnectCable,
    showCableQuickHud,
    hideCableQuickHud
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
