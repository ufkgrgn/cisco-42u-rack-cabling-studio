// ============================================================================
// Cisco Enterprise 42U Rack & Cabling Studio - Standalone Universal Bundle
// Multi-Rack / Multi-Cabinet Architecture & Complete Field Inventory Support
// Supports both file:/// local execution (no server needed) and HTTP hosting
// ============================================================================

(function () {
  'use strict';

  // --- HARDWARE CATALOG SPECIFICATIONS ---
  const HARDWARE_CATALOG = {
    // 1. WAN & ROUTER
    'cisco-isr-4431': {
      name: 'Cisco ISR 4431/K9 Router',
      u: 1,
      category: 'router',
      logo: 'CISCO',
      modelTag: 'ISR 4431 ROUTER',
      desc: 'Kurumsal WAN & İnternet Yönlendiricisi, 4x Dahili GE/SFP Portu, 3x NIM Yuvası, Çift Güç Kaynağı.',
      ports: [
        { id: 'ge0_0_0', name: 'GE0/0/0', type: 'rj45', group: 0, row: 0, speed: '1G WAN / Routed' },
        { id: 'ge0_0_1', name: 'GE0/0/1', type: 'rj45', group: 0, row: 0, speed: '1G WAN / Routed' },
        { id: 'ge0_0_2', name: 'GE0/0/2', type: 'sfp', group: 1, row: 0, speed: '1G SFP Fiber WAN' },
        { id: 'ge0_0_3', name: 'GE0/0/3', type: 'sfp', group: 1, row: 0, speed: '1G SFP Fiber WAN' },
        { id: 'mgmt0', name: 'MGMT', type: 'rj45', group: 2, row: 0, speed: '1G Out-of-Band MGMT' }
      ]
    },

    // 2. FIBER DISTRIBUTION & OMURGA
    'cisco-3850-24s': {
      name: 'Cisco Catalyst 3850-24S-S',
      u: 1,
      category: 'fiber-switch',
      logo: 'CISCO',
      modelTag: 'WS-C3850-24S-S',
      desc: '24 Port SFP 1G Fiber Omurga/Toplama Switchi, 4x 10G SFP+ Modüler Uplink.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `sfp${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'sfp',
          group: Math.floor(i / 6),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G SFP Fiber (IDF Toplama)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 4,
          row: 0,
          speed: '10G SFP+ 10Gbps Uplink'
        }))
      ]
    },
    'cisco-nexus-93180yc': {
      name: 'Cisco Nexus 93180YC-FX',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: 'N9K-C93180YC-FX',
      desc: 'Veri merkezi ToR switch, 48x 10/25G SFP28 ve 6x 100G QSFP28 omurga portu.',
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `eth1_${i + 1}`,
          name: `Eth1/${i + 1}`,
          type: 'sfp',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '25G SFP28'
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `eth1_${i + 49}`,
          name: `Eth1/${i + 49}`,
          type: 'sfp',
          group: 4,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '100G QSFP28'
        }))
      ]
    },
    'cisco-9500-24y4c': {
      name: 'Cisco Catalyst 9500-24Y4C',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: 'C9500-24Y4C',
      desc: 'Kampüs çekirdek omurga, 24x 25G SFP28 ve 4x 100G QSFP28 uplink portu.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `25GE1/0/${i + 1}`,
          type: 'sfp',
          group: Math.floor(i / 6),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '25G SFP28'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `100GE1/0/${i + 25}`,
          type: 'sfp',
          group: 4,
          row: 0,
          speed: '100G QSFP28'
        }))
      ]
    },

    // 3. GIGABIT POE+ ACCESS SWITCHES
    'cisco-2960x-24ps': {
      name: 'Cisco Catalyst 2960X-24PS-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: '2960X-24PS-L (PoE+)',
      desc: '24x Gigabit RJ45 PoE+ (370W) ve 4x 1G SFP Uplink yuvası. Sahada 55 adet.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G Gigabit PoE+'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: 0,
          speed: '1G SFP Fiber Uplink'
        }))
      ]
    },
    'cisco-2960xr-24ps': {
      name: 'Cisco Catalyst 2960XR-24PS-I',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: '2960XR-24PS-I (L3)',
      desc: 'L3 Kurumsal Kenar, 24x Gigabit PoE+ (370W), 2x 10G SFP+ Uplink, Yedekli Çift Güç Kaynağı.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G Gigabit PoE+'
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: 0,
          speed: '10G SFP+ Uplink'
        }))
      ]
    },
    'cisco-9200l-24p': {
      name: 'Cisco Catalyst 9200L-24P-4X',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: 'C9200L-24P-4X',
      desc: 'Yeni Nesil Kurumsal Kenar, 24x Gigabit PoE+ (370W), 4x 10G SFP+ Sabit Uplink.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G PoE+ (30W)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: 0,
          speed: '10G SFP+ 10Gbps Uplink'
        }))
      ]
    },
    'cisco-9300l-24p': {
      name: 'Cisco Catalyst 9300L-24P-4X',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: 'C9300L-24P-4X',
      desc: 'StackWise-320 destekli Kenar Switch, 24x 1G PoE+ (505W UPOE), 4x 10G SFP+ Uplink.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G PoE+ UPOE'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: 0,
          speed: '10G SFP+ 10Gbps'
        }))
      ]
    },
    'cisco-9300-48u': {
      name: 'Cisco Catalyst 9300X-48HX',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: 'CATALYST 9300X',
      desc: 'Omurga/Kenar switch, 48x Multigigabit PoE+, modüler 4x 25G SFP28 Uplink.',
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10G mGig PoE+'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 4,
          row: 0,
          speed: '25G SFP28'
        }))
      ]
    },
    'cisco-1000-24p': {
      name: 'Cisco Catalyst 1000-24P-4G-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: 'C1000-24P-4G-L',
      desc: '24x 1G RJ45 PoE+ (195W), 4x 1G SFP sabit uplink portu.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G PoE+ (195W)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `SFP${i + 1}`,
          type: 'sfp',
          group: 2,
          row: 0,
          speed: '1G SFP'
        }))
      ]
    },

    // 4. FAST ETHERNET & SAHA SWITCHLERİ
    'cisco-2960-24pc': {
      name: 'Cisco Catalyst 2960-24PC-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: '2960-24PC-L (PoE)',
      desc: 'Sahada en yaygın model (133 Adet). 24x 10/100 PoE (370W), 2x Dual-Purpose 1G Gigabit/SFP uplink.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 Mbps PoE'
        })),
        { id: 'up1', name: 'Gi0/1 (Dual)', type: 'rj45', group: 2, row: 0, speed: '1G RJ45 / SFP Dual' },
        { id: 'up2', name: 'Gi0/2 (Dual)', type: 'rj45', group: 2, row: 1, speed: '1G RJ45 / SFP Dual' }
      ]
    },
    'cisco-2960-24tc': {
      name: 'Cisco Catalyst 2960-24TC-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: '2960-24TC-L',
      desc: '24x 10/100 Mbps RJ45 (PoE Yok), 2x Dual-Purpose 1G Gigabit/SFP uplink.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 Mbps 100Base-TX'
        })),
        { id: 'up1', name: 'Gi0/1', type: 'rj45', group: 2, row: 0, speed: '1G RJ45 / SFP Dual' },
        { id: 'up2', name: 'Gi0/2', type: 'rj45', group: 2, row: 1, speed: '1G RJ45 / SFP Dual' }
      ]
    },
    'cisco-2960x-24ts': {
      name: 'Cisco Catalyst 2960-X 24TS-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: '2960-X 24TS-L',
      desc: 'Klasik kurumsal kenar switch, 24x GigE RJ45, 4x 1G SFP uplink yuvası.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G RJ45 Gigabit'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: 0,
          speed: '1G SFP'
        }))
      ]
    },
    'cisco-2960-48tc': {
      name: 'Cisco Catalyst 2960-48TC-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: '2960-48TC-L (48P)',
      desc: '48x 10/100 Mbps RJ45, 2x 10/100/1000 Gigabit RJ45 ve 2x 1G SFP uplink.',
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 Mbps 100Base-TX'
        })),
        { id: 'up1', name: 'Gi0/1', type: 'rj45', group: 4, row: 0, speed: '1G Gigabit' },
        { id: 'up2', name: 'Gi0/2', type: 'rj45', group: 4, row: 1, speed: '1G Gigabit' },
        { id: 'sfp1', name: 'SFP1', type: 'sfp', group: 5, row: 0, speed: '1G SFP' },
        { id: 'sfp2', name: 'SFP2', type: 'sfp', group: 5, row: 1, speed: '1G SFP' }
      ]
    },
    'cisco-3560x-24t': {
      name: 'Cisco Catalyst 3560X-24T-S',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      modelTag: 'WS-C3560X-24T-S',
      desc: '24x Gigabit 10/100/1000 RJ45 portu, Modüler Ağ Modülü (4x 1G / 2x 10G SFP+).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G Gigabit RJ45'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: 0,
          speed: '10G/1G SFP+'
        }))
      ]
    },

    // 5. COMPACT SWITCHES
    'cisco-3560-8pc': {
      name: 'Cisco Catalyst 3560-8PC-S',
      u: 1,
      category: 'compact',
      logo: 'CISCO',
      modelTag: '3560-8PC-S (Kompakt)',
      desc: '8x 10/100 PoE (123W) + 1x Dual-Purpose 1G Gigabit/SFP uplink.',
      ports: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: 0,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 PoE (15.4W)'
        })),
        { id: 'up1', name: 'Gi0/1 Dual', type: 'rj45', group: 1, row: 0, speed: '1G RJ45 / SFP' }
      ]
    },
    'cisco-2960cx-8pc': {
      name: 'Cisco Catalyst 2960CX-8PC-L',
      u: 1,
      category: 'compact',
      logo: 'CISCO',
      modelTag: '2960CX-8PC-L',
      desc: '8x Gigabit PoE+ (240W) + 2x 1G Bakır Uplink + 2x 1G SFP Portu.',
      ports: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: 0,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G Gigabit PoE+'
        })),
        { id: 'up_cu1', name: 'Gi1/0/9', type: 'rj45', group: 1, row: 0, speed: '1G Copper' },
        { id: 'up_cu2', name: 'Gi1/0/10', type: 'rj45', group: 1, row: 1, speed: '1G Copper' },
        { id: 'up_sfp1', name: 'SFP1', type: 'sfp', group: 2, row: 0, speed: '1G SFP' },
        { id: 'up_sfp2', name: 'SFP2', type: 'sfp', group: 2, row: 1, speed: '1G SFP' }
      ]
    },
    'cisco-2960g-8tc': {
      name: 'Cisco Catalyst 2960G-8TC-L',
      u: 1,
      category: 'compact',
      logo: 'CISCO',
      modelTag: '2960G-8TC-L',
      desc: '7x 10/100/1000 Gigabit RJ45 + 1x Dual-Purpose 1G Gigabit/SFP yuvası.',
      ports: [
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi0/${i + 1}`,
          type: 'rj45',
          group: 0,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G Gigabit RJ45'
        })),
        { id: 'up1', name: 'Gi0/8 Dual', type: 'rj45', group: 1, row: 0, speed: '1G RJ45 / SFP' }
      ]
    },

    // 6. STRUCTURED CABLING & PANELS
    'patch-cat6-24': {
      name: 'Cat6A 24-Port Patch Panel',
      u: 1,
      category: 'patch',
      logo: 'PANEL',
      modelTag: 'CAT6A 24P-UTP',
      desc: '19" Rack montajlı 24 Port 10Gbps Cat6A UTP bakır sonlandırma paneli.',
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `pt${i + 1}`,
        name: `Port ${i + 1}`,
        type: 'rj45',
        group: Math.floor(i / 6),
        row: 0,
        speed: '10G Cat6A'
      }))
    },
    'patch-cat6-48': {
      name: 'Cat6 48-Port Yüksek Yoğunluk Panel',
      u: 1,
      category: 'patch',
      logo: 'PANEL',
      modelTag: 'CAT6-48P-HD',
      desc: '1U alanında 48 port çift sıralı yüksek yoğunluklu RJ45 patch panel.',
      ports: Array.from({ length: 48 }, (_, i) => ({
        id: `pt${i + 1}`,
        name: `P${i + 1}`,
        type: 'rj45',
        group: Math.floor(i / 12),
        row: (i % 2 === 0) ? 0 : 1,
        speed: '1G Cat6'
      }))
    },
    'fiber-odf-24': {
      name: '24-Port OM4 Fiber Dağıtım Paneli (ODF)',
      u: 1,
      category: 'fiber',
      logo: 'FIBER ODF',
      modelTag: 'OM4 LC-DUPLEX',
      desc: 'Veri merkezi OM4 LC Duplex çok modlu fiber optik sonlandırma çekmecesi.',
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `lc${i + 1}`,
        name: `LC-${String(i + 1).padStart(2, '0')}`,
        type: 'lc',
        group: Math.floor(i / 4),
        row: 0,
        speed: '100G MultiMode OM4'
      }))
    },
    'hcs-datalight-24': {
      name: 'HCS DataLight Fiber Patch Panel',
      u: 1,
      category: 'fiber',
      logo: 'HCS',
      modelTag: 'HCS-DATALIGHT-24',
      desc: '19” teleskopik kasa ve çapraz dizilimli mavi modüler fiber adaptör yuvaları.',
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `f${i + 1}`,
        name: `F-${String(i + 1).padStart(2, '0')}`,
        type: 'lc',
        group: Math.floor(i / 6),
        row: (i % 2 === 0) ? 0 : 1,
        speed: '10G OM4 LC Duplex'
      }))
    },

    // 7. CABLE MANAGEMENT & BLANKING
    'organizer-1u': {
      name: '1U Fırçalı Yatay Düzenleyici',
      u: 1,
      category: 'organizer',
      logo: 'ORGANIZER',
      modelTag: '1U HORIZONTAL BRUSH',
      desc: 'Hava sızdırmaz fırçalı tip, patch kabloları gizleyen 1U yatay kablo tavası.',
      ports: []
    },
    'organizer-dring-1u': {
      name: '1U D-Ring Yatay Kablo Düzenleyici',
      u: 1,
      category: 'organizer',
      logo: 'ORGANIZER',
      modelTag: '1U 5x D-RING ORGANIZER',
      desc: '5 Adet Metal D-Ring kancalı 19" 1U yatay kablo düzenleyici organizer.',
      ports: []
    },
    'organizer-2u': {
      name: '2U Kapaklı Parmak Tipi Düzenleyici',
      u: 2,
      category: 'organizer',
      logo: 'ORGANIZER',
      modelTag: '2U FINGER-DUCT ORGANIZER',
      desc: 'Yüksek kapasiteli, ön kapaklı parmak tipi (finger duct) 2U organizer.',
      ports: []
    },
    'blank-panel-1u': {
      name: '1U Boşluk Kapatma Paneli',
      u: 1,
      category: 'blank',
      logo: 'BLANK',
      modelTag: '1U BLANKING PANEL',
      desc: 'Hava akışını yönlendirmek ve boş U yuvalarını kapatmak için kör panel.',
      ports: []
    }
  };

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  // --- MULTI-RACK APPLICATION STATE ---
  const BUILTIN_KEYS = new Set(Object.keys(HARDWARE_CATALOG));
  const STATE = {
    customCatalog: {},
    racks: [
      {
        id: 'rack-1',
        name: 'MDF - Ana Omurga & Dağıtım Kabini',
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ],
    activeRackId: 'rack-1',
    cables: [],
    cableCounter: 0,
    rackCounter: 1,
    selectedLibraryItem: null,
    selectedCableColor: '#2563eb',
    cableRoutingMode: 'structured',
    pendingConnection: null, // { rackId, instanceId, portId, element }
    highlightedCableId: null
  };

  function getActiveRack() {
    let r = STATE.racks.find(rack => rack.id === STATE.activeRackId);
    if (!r && STATE.racks.length > 0) {
      r = STATE.racks[0];
      STATE.activeRackId = r.id;
    }
    return r;
  }

  // --- PAN & ZOOM CANVAS STATE ---
  const ZOOM_STATE = {
    scale: 1.0,
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

  // --- DOM REFERENCES ---
  const dom = {
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
    btnRenameRack: null
  };

  function initDomReferences() {
    dom.railLeft = document.getElementById('rail-left');
    dom.railRight = document.getElementById('rail-right');
    dom.rackSpace = document.getElementById('rack-space');
    dom.rackContainer = document.getElementById('rack-container');
    dom.viewportCanvas = document.getElementById('viewport-canvas');
    dom.rackStage = document.getElementById('rack-stage');
    dom.cablesSvg = document.getElementById('cables-svg');
    dom.cablesGroup = document.getElementById('cables-group');
    dom.connectorsGroup = document.getElementById('connectors-group');
    dom.dringOverlayGroup = document.getElementById('dring-overlay-group');
    dom.scheduleTbody = document.getElementById('schedule-tbody');
    dom.cableCountLabel = document.getElementById('cable-count-label');
    dom.connectionStatusHint = document.getElementById('connection-status-hint');
    dom.inspectorInfo = document.getElementById('inspector-info');
    dom.tooltip = document.getElementById('tooltip');
    dom.statusSelectionText = document.getElementById('status-selection-text');
    dom.fileImport = document.getElementById('file-import');
    dom.btnExportVisio = document.getElementById('btn-export-visio');
    dom.btnExportJson = document.getElementById('btn-export-json');
    dom.btnImportJson = document.getElementById('btn-import-json');
    dom.btnPresetMdf = document.getElementById('btn-preset-mdf');
    dom.btnPresetIdf = document.getElementById('btn-preset-idf');
    dom.btnPresetSite = document.getElementById('btn-preset-site');
    dom.btnClearAll = document.getElementById('btn-clear-all');
    dom.btnClearCables = document.getElementById('btn-clear-cables');
    dom.btnZoomIn = document.getElementById('btn-zoom-in');
    dom.btnZoomOut = document.getElementById('btn-zoom-out');
    dom.btnZoomFit = document.getElementById('btn-zoom-fit');
    dom.btnZoomActual = document.getElementById('btn-zoom-actual');
    dom.zoomBadge = document.getElementById('zoom-badge');
    dom.navJumpTop = document.getElementById('nav-jump-top');
    dom.navJumpMid = document.getElementById('nav-jump-mid');
    dom.navJumpBot = document.getElementById('nav-jump-bot');
    dom.btnRouteStructured = document.getElementById('btn-route-structured');
    dom.btnRouteDirect = document.getElementById('btn-route-direct');
    dom.btnTidyCables = document.getElementById('btn-tidy-cables');
    dom.rackTabsList = document.getElementById('rack-tabs-list');
    dom.btnAddRack = document.getElementById('btn-add-rack');
    dom.btnRenameRack = document.getElementById('btn-rename-rack');
  }

  // --- MULTI-RACK TAB MANAGEMENT ---
  function renderRackTabs() {
    if (!dom.rackTabsList) return;
    dom.rackTabsList.innerHTML = '';

    STATE.racks.forEach((rack, idx) => {
      const tab = document.createElement('div');
      tab.className = `rack-tab ${rack.id === STATE.activeRackId ? 'active' : ''}`;
      tab.dataset.rackId = rack.id;

      const deviceCount = rack.devices.length;
      const canDelete = STATE.racks.length > 1;

      tab.innerHTML = `
        <svg width="13" height="13" fill="currentColor" viewBox="0 0 16 16"><path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h3A1.5 1.5 0 0 1 7 2.5v1.077a2.5 2.5 0 0 1-.95 1.956L4.5 6.786V14.5a.5.5 0 0 0 .5.5h6a.5.5 0 0 0 .5-.5V6.786l-1.55-1.253A2.5 2.5 0 0 1 9 3.577V2.5A1.5 1.5 0 0 1 10.5 1h3A1.5 1.5 0 0 1 15 2.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 1 13.5v-11z"/></svg>
        <span>${escapeHtml(rack.name)}</span>
        <span class="rack-tab-badge">${deviceCount} Cihaz</span>
        ${canDelete ? `<span class="rack-tab-close" data-rack-id="${rack.id}" title="Kabini Sil">✕</span>` : ''}
      `;

      tab.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('.rack-tab-close');
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
    renderRackRailsAndSlots(handleSlotClick);
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    requestAnimationFrame(() => fitRackToScreen(false));
  }

  function addNewRack(customName) {
    do { STATE.rackCounter++; } while (STATE.racks.some(r => r.id === `rack-${STATE.rackCounter}`));
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
    renderRackRailsAndSlots(handleSlotClick);
    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    requestAnimationFrame(() => fitRackToScreen(false));
    return newRack;
  }

  function renameActiveRack() {
    const activeRack = getActiveRack();
    if (!activeRack) return;
    const currentName = activeRack.name;
    const newName = prompt("Kabin adını girin:", currentName);
    if (newName && newName.trim()) {
      activeRack.name = newName.trim();
      renderRackTabs();
      renderScheduleTable();
    }
  }

  function deleteRack(rackId) {
    if (STATE.racks.length <= 1) {
      alert("En az bir kabin bulunmalıdır!");
      return;
    }
    const rackToDelete = STATE.racks.find(r => r.id === rackId);
    if (!rackToDelete) return;
    if (confirm(`"${rackToDelete.name}" kabinini ve içindeki tüm cihazları silmek istediğinize emin misiniz?`)) {
      // Remove cables attached to this rack
      STATE.cables = STATE.cables.filter(c => c.from.rackId !== rackId && c.to.rackId !== rackId);
      STATE.racks = STATE.racks.filter(r => r.id !== rackId);
      if (STATE.activeRackId === rackId) {
        STATE.activeRackId = STATE.racks[0].id;
      }
      renderRackTabs();
      renderMountedDevices();
      renderScheduleTable();
      renderAllCables();
    }
  }

  // --- CABLING MODULE ---
  function cancelPendingConnection() {
    if (STATE.pendingConnection && STATE.pendingConnection.element) {
      STATE.pendingConnection.element.classList.remove('selected');
    }
    STATE.pendingConnection = null;
    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
    }
  }

  function getNextCableId() {
    STATE.cableCounter++;
    return 'CBL-' + String(STATE.cableCounter).padStart(3, '0');
  }

  function getCableEndpointInfo(activeRack, endpoint) {
    const instanceId = endpoint.instanceId || endpoint.deviceId;
    const device = activeRack.devices.find(d => d.instanceId === instanceId);
    const catalog = device ? HARDWARE_CATALOG[device.catalogKey] : null;
    const port = catalog && Array.isArray(catalog.ports)
      ? catalog.ports.find(p => p.id === endpoint.portId) || catalog.ports[(Number(endpoint.portIdx) || 1) - 1]
      : null;
    const deviceName = (device && (device.name || device.hostname)) || (catalog && (catalog.modelTag || catalog.name)) || 'Cihaz';
    const portName = (port && (port.name || port.id)) || endpoint.portId || `Port ${endpoint.portIdx || '?'}`;
    return { deviceName, portName };
  }

  function getCableLabel(activeRack, cable) {
    const from = getCableEndpointInfo(activeRack, cable.from);
    const to = getCableEndpointInfo(activeRack, cable.to);
    const endpoints = `${from.deviceName} / ${from.portName} → ${to.deviceName} / ${to.portName}`;
    return cable.name ? `${cable.name}: ${endpoints}` : endpoints;
  }

  function renameCable2D(cableId) {
    const cable = STATE.cables.find(item => item.id === cableId);
    if (!cable) return;
    const nextName = prompt('Kablo Adı / Etiketi:', cable.name || cable.id);
    if (nextName === null) return;
    const normalizedName = nextName.trim();
    if (!normalizedName) {
      showTemporaryTooltip(window.innerWidth / 2, 80, 'Kablo adı boş bırakılamaz.');
      return;
    }
    cable.name = normalizedName;
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function getEndpointOrganizerChannelYs(activeRack, cable, contRect, curScale) {
    const organizers = activeRack.devices.filter(dev => HARDWARE_CATALOG[dev.catalogKey]?.category === 'organizer');
    const findDevice = endpoint => activeRack.devices.find(dev =>
      dev.instanceId === (endpoint.instanceId || endpoint.deviceId)
    );
    const findOrganizerDirectlyBelow = device => {
      if (!device) return null;
      const uImmediatelyBelow = Number(device.topU) - Number(device.uHeight || 1);
      return organizers.find(org => Number(org.topU) === uImmediatelyBelow) || null;
    };
    const centerY = organizer => {
      const el = organizer && document.getElementById(organizer.instanceId);
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return (rect.top + rect.height / 2 - (contRect.top + 8 * curScale)) / curScale;
    };

    const fromY = centerY(findOrganizerDirectlyBelow(findDevice(cable.from)));
    const toY = centerY(findOrganizerDirectlyBelow(findDevice(cable.to)));
    return Number.isFinite(fromY) && Number.isFinite(toY) ? [fromY, toY] : [];
  }

  function getActiveOrganizers(activeRack) {
    if (!activeRack || !activeRack.devices) return [];
    return activeRack.devices.filter(dev => {
      const cat = HARDWARE_CATALOG[dev.catalogKey];
      return cat && (
        dev.catalogKey.includes('organizer') ||
        (cat.modelTag && (cat.modelTag.includes('D-RING') || cat.modelTag.includes('ORGANIZER') || cat.modelTag.includes('DUCT') || cat.modelTag.includes('BRUSH'))) ||
        (cat.name && (cat.name.toLowerCase().includes('organizer') || cat.name.toLowerCase().includes('d-ring')))
      );
    });
  }

  function findDeviceOrganizer(activeRack, dev) {
    const orgs = getActiveOrganizers(activeRack);
    if (!orgs.length || !dev) return null;
    const devTop = Number(dev.topU);
    const devBot = devTop - Number(dev.uHeight || 1) + 1;

    // 1. Directly adjacent below
    const directlyBelow = orgs.find(org => Number(org.topU) === devBot - 1);
    if (directlyBelow) return directlyBelow;

    // 2. Directly adjacent above
    const directlyAbove = orgs.find(org => Number(org.topU) === devTop + 1);
    if (directlyAbove) return directlyAbove;

    // 3. Nearest organizer within 3U
    let nearest = null;
    let minDiff = Infinity;
    orgs.forEach(org => {
      const orgTop = Number(org.topU);
      const diff = Math.min(Math.abs(orgTop - devTop), Math.abs(orgTop - devBot));
      if (diff < minDiff && diff <= 3) {
        minDiff = diff;
        nearest = org;
      }
    });
    return nearest;
  }

  function getDRingBracketCoords(organizer, contRect, curScale) {
    const el = document.getElementById(organizer.instanceId);
    if (!el) return [];
    const brackets = el.querySelectorAll('.dring-bracket');
    if (!brackets || !brackets.length) return [];
    const coords = [];
    brackets.forEach((bEl, idx) => {
      const rect = bEl.getBoundingClientRect();
      coords.push({
        index: idx,
        x: (rect.left + rect.width / 2 - (contRect.left + 8 * curScale)) / curScale,
        y: (rect.top + rect.height / 2 - (contRect.top + 8 * curScale)) / curScale,
        width: rect.width / curScale,
        height: rect.height / curScale
      });
    });
    return coords;
  }

  function renderDRingOverlays(activeRack, contRect, curScale) {
    if (!dom.dringOverlayGroup) return;
    dom.dringOverlayGroup.innerHTML = '';
    const drings = getActiveOrganizers(activeRack).filter(dev => {
      const cat = HARDWARE_CATALOG[dev.catalogKey];
      return dev.catalogKey === 'organizer-dring-1u' || (cat && cat.modelTag && cat.modelTag.includes('D-RING')) || (cat && cat.name && cat.name.toLowerCase().includes('d-ring'));
    });
    if (!drings.length) return;

    drings.forEach(org => {
      const coords = getDRingBracketCoords(org, contRect, curScale);
      coords.forEach(bracket => {
        const loopW = 38;
        const loopH = 27;
        const loopX = bracket.x - loopW / 2;
        const loopY = bracket.y - loopH / 2;

        const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        g.setAttribute('class', 'dring-svg-bracket');
        g.setAttribute('style', 'pointer-events:none;');

        // Left vertical pillar of D-Ring hoop
        const leftPillar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        leftPillar.setAttribute('x', loopX);
        leftPillar.setAttribute('y', loopY);
        leftPillar.setAttribute('width', '5.5');
        leftPillar.setAttribute('height', loopH);
        leftPillar.setAttribute('rx', '2.5');
        leftPillar.setAttribute('fill', 'url(#dring-front-grad)');
        leftPillar.setAttribute('filter', 'drop-shadow(0 3px 5px rgba(0,0,0,0.85))');
        g.appendChild(leftPillar);

        // Right vertical pillar of D-Ring hoop
        const rightPillar = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rightPillar.setAttribute('x', loopX + loopW - 5.5);
        rightPillar.setAttribute('y', loopY);
        rightPillar.setAttribute('width', '5.5');
        rightPillar.setAttribute('height', loopH);
        rightPillar.setAttribute('rx', '2.5');
        rightPillar.setAttribute('fill', 'url(#dring-front-grad)');
        rightPillar.setAttribute('filter', 'drop-shadow(0 3px 5px rgba(0,0,0,0.85))');
        g.appendChild(rightPillar);

        // Top retention clip / chrome locking notch
        const clip = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        clip.setAttribute('x', loopX + 14);
        clip.setAttribute('y', loopY - 1.5);
        clip.setAttribute('width', '10');
        clip.setAttribute('height', '2.5');
        clip.setAttribute('rx', '1');
        clip.setAttribute('fill', 'url(#dring-clip-grad)');
        g.appendChild(clip);

        // Specular highlight line along top bar
        const highlight = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        highlight.setAttribute('x', loopX + 2);
        highlight.setAttribute('y', loopY);
        highlight.setAttribute('width', loopW - 4);
        highlight.setAttribute('height', '1.2');
        highlight.setAttribute('rx', '0.6');
        highlight.setAttribute('fill', 'rgba(255, 255, 255, 0.55)');
        g.appendChild(highlight);

        dom.dringOverlayGroup.appendChild(g);
      });
    });
  }

  function buildStructuredCablePath(x1, y1, x2, y2, channelX, organizerYs) {
    const ordered = organizerYs;
    const firstOrganizerY = ordered[0];
    const lastOrganizerY = ordered[ordered.length - 1];
    const entryY = firstOrganizerY ?? y1;
    const exitY = lastOrganizerY ?? y2;
    const bend = channelX > 309 ? -10 : 10;

    if (!ordered.length) {
      return `M ${x1} ${y1} L ${channelX + bend} ${y1} Q ${channelX} ${y1} ${channelX} ${y1 + Math.sign(y2 - y1) * 10} L ${channelX} ${y2 - Math.sign(y2 - y1) * 10} Q ${channelX} ${y2} ${channelX + bend} ${y2} L ${x2} ${y2}`;
    }

    // First descend/rise vertically from the port into the organizer, traverse its
    // horizontal channel, use the rack side, then traverse the destination organizer.
    const points = [`M ${x1} ${y1}`, `L ${x1} ${entryY}`, `L ${channelX} ${entryY}`];
    if (entryY !== exitY) points.push(`L ${channelX} ${exitY}`);
    else if (exitY !== y2) points.push(`L ${channelX} ${y2}`);
    points.push(`L ${x2} ${exitY === entryY && exitY !== y2 ? y2 : exitY}`, `L ${x2} ${y2}`);
    return points.join(' ');
  }

  function renderAllCables() {
    if (!dom.cablesGroup || !dom.rackContainer) return;
    dom.cablesGroup.innerHTML = '';
    if (dom.connectorsGroup) dom.connectorsGroup.innerHTML = '';

    const contRect = dom.rackContainer.getBoundingClientRect();
    const curScale = ZOOM_STATE.scale || 1.0;
    if (curScale <= 0) return;

    const portRects = new Map();
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
    const dringUsageMap = new Map();

    const activeRack = getActiveRack();

    STATE.cables.forEach((cable) => {
      // If cable is inter-rack and only one endpoint is in current rack, show port as connected
      const fromInActive = cable.from.rackId === activeRack.id;
      const toInActive = cable.to.rackId === activeRack.id;

      const instA = cable.from.instanceId || cable.from.deviceId;
      const instB = cable.to.instanceId || cable.to.deviceId;
      const portIdA = cable.from.portId || ('p' + cable.from.portIdx);
      const portIdB = cable.to.portId || ('p' + cable.to.portIdx);

      let portFromEl = document.getElementById(`port-${instA}-${portIdA}`);
      let portToEl = document.getElementById(`port-${instB}-${portIdB}`);

      if (!portFromEl) {
        portFromEl = document.querySelector(`.port[data-instance-id="${instA}"][data-port-id="${portIdA}"]`) ||
                     document.querySelector(`.port[data-instance-id="${instA}"]`);
      }
      if (!portToEl) {
        portToEl = document.querySelector(`.port[data-instance-id="${instB}"][data-port-id="${portIdB}"]`) ||
                    document.querySelector(`.port[data-instance-id="${instB}"]`);
      }

      if (!portFromEl || !portToEl) return;

      const rectA = getPortRect(portFromEl);
      const rectB = getPortRect(portToEl);
      if (!rectA || !rectB) return;
      if (rectA.width === 0 && rectA.height === 0 && rectB.width === 0 && rectB.height === 0) return;

      // 8px is rack-container outer border
      const x1 = (rectA.left + rectA.width / 2 - (contRect.left + 8 * curScale)) / curScale;
      const y1 = (rectA.top + rectA.height / 2 - (contRect.top + 8 * curScale)) / curScale;
      const x2 = (rectB.left + rectB.width / 2 - (contRect.left + 8 * curScale)) / curScale;
      const y2 = (rectB.top + rectB.height / 2 - (contRect.top + 8 * curScale)) / curScale;

      const dy = Math.abs(y2 - y1);
      const dx = Math.abs(x2 - x1);

      let pathD = '';

      if (STATE.cableRoutingMode === 'structured') {
        const devA = activeRack?.devices?.find(d => d.instanceId === instA);
        const devB = activeRack?.devices?.find(d => d.instanceId === instB);

        if (instA === instB) {
          // Same device loopback
          const loopSide = x1 > 300 ? 12 : -12;
          pathD = `M ${x1} ${y1} C ${x1 + loopSide} ${y1}, ${x2 + loopSide} ${y2}, ${x2} ${y2}`;
        } else {
          // Structured datacenter cabling:
          // 1. Port A drops/rises vertically to Organizer A level
          // 2. Traverses horizontally through Organizer A to closest side rail
          // 3. Runs vertically in side rail duct to Organizer B level
          // 4. Traverses horizontally through Organizer B from side rail to Port B column
          // 5. Connects vertically into Port B

          const orgA = findDeviceOrganizer(activeRack, devA);
          const orgB = findDeviceOrganizer(activeRack, devB);

          const getOrgY = (org, fallbackY, otherY) => {
            if (org) {
              const orgEl = document.getElementById(org.instanceId);
              if (orgEl) {
                const r = orgEl.getBoundingClientRect();
                return (r.top + r.height / 2 - (contRect.top + 8 * curScale)) / curScale;
              }
            }
            return fallbackY + (otherY >= fallbackY ? 14 : -14);
          };

          let trayYA = getOrgY(orgA, y1, y2);
          let trayYB = getOrgY(orgB, y2, y1);

          // If both devices share the exact same organizer between them, split into upper and lower lanes
          if (orgA && orgB && orgA.instanceId === orgB.instanceId) {
            const orgCenterY = trayYA;
            const isATop = Number(devA?.topU || 0) >= Number(devB?.topU || 0);
            trayYA = orgCenterY + (isATop ? -6 : 6);
            trayYB = orgCenterY + (isATop ? 6 : -6);
          }

          // Side rail selection: left rail if on left half, right rail if on right half
          const avgX = (x1 + x2) / 2;
          const useRightChannel = (x1 >= 309 && x2 >= 309) || (avgX >= 309);
          const channelBase = useRightChannel ? 595 : 23;
          const bundleIdx = useRightChannel ? rightChannelUsage++ : leftChannelUsage++;

          // Space parallel cables neatly within vertical rail duct (44px rail width)
          const railOffset = ((bundleIdx % 7) - 3) * 2.8;
          const channelX = channelBase + railOffset;

          // Minor vertical jitter inside horizontal tray to form parallel wire bundles
          const trayOffsetA = ((bundleIdx % 5) - 2) * 1.5;
          const trayOffsetB = ((bundleIdx % 5) - 2) * 1.5;
          const actualTrayYA = trayYA + trayOffsetA;
          const actualTrayYB = trayYB + trayOffsetB;

          // 1. Vertical from (x1, y1) to (x1, actualTrayYA), then turn towards channelX
          const dirY1 = actualTrayYA >= y1 ? 1 : -1;
          const dirX1 = channelX >= x1 ? 1 : -1;
          const r1 = Math.min(8, Math.abs(channelX - x1) / 2, Math.abs(actualTrayYA - y1) / 2);

          // 2. From (channelX, actualTrayYA) turn into vertical side rail towards actualTrayYB
          const dirY_rail = actualTrayYB >= actualTrayYA ? 1 : -1;
          const distRailY = Math.abs(actualTrayYB - actualTrayYA);
          const rRail1 = Math.min(10, Math.abs(channelX - x1) / 2, distRailY / 2 || 6);

          // 3. From side rail at actualTrayYB, turn towards x2
          const dirX2 = x2 >= channelX ? 1 : -1;
          const rRail2 = Math.min(10, Math.abs(x2 - channelX) / 2, distRailY / 2 || 6);

          // 4. From actualTrayYB at x2, turn towards y2
          const dirY2 = y2 >= actualTrayYB ? 1 : -1;
          const r2 = Math.min(8, Math.abs(x2 - channelX) / 2, Math.abs(y2 - actualTrayYB) / 2);

          pathD = `M ${x1} ${y1} ` +
                  `L ${x1} ${actualTrayYA - dirY1 * r1} ` +
                  `Q ${x1} ${actualTrayYA} ${x1 + dirX1 * r1} ${actualTrayYA} ` +
                  `L ${channelX - dirX1 * rRail1} ${actualTrayYA} ` +
                  `Q ${channelX} ${actualTrayYA} ${channelX} ${actualTrayYA + dirY_rail * rRail1} ` +
                  `L ${channelX} ${actualTrayYB - dirY_rail * rRail2} ` +
                  `Q ${channelX} ${actualTrayYB} ${channelX + dirX2 * rRail2} ${actualTrayYB} ` +
                  `L ${x2 - dirX2 * r2} ${actualTrayYB} ` +
                  `Q ${x2} ${actualTrayYB} ${x2} ${actualTrayYB + dirY2 * r2} ` +
                  `L ${x2} ${y2}`;
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

      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('stroke', cable.color);
      path.setAttribute('stroke-width', '2.6');
      path.setAttribute('stroke-linecap', 'round');
      path.setAttribute('stroke-linejoin', 'round');
      path.setAttribute('class', `cable-path ${cable.id === STATE.highlightedCableId ? 'highlighted' : ''}`);
      path.setAttribute('id', `svg-cable-${cable.id}`);
      path.setAttribute('filter', 'url(#cable-shadow)');

      const cableLabel = getCableLabel(activeRack, cable);
      path.setAttribute('aria-label', cableLabel);
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = cableLabel;
      path.appendChild(title);

      const showCableTooltip = (e) => {
        dom.tooltip.style.display = 'block';
        dom.tooltip.style.left = `${e.clientX + 10}px`;
        dom.tooltip.style.top = `${e.clientY - 10}px`;
        dom.tooltip.innerHTML = `
          <b>${escapeHtml(cable.id)}</b> (${Number(cable.lengthMeters || 0).toFixed(1)}m)<br>
          <span style="color:${cable.color};">&#9632;</span> <strong>${escapeHtml(cableLabel)}</strong><br>
          <span style="color:#f59e0b;font-size:11px;">Yeniden adlandırmak için çift tıklayın</span>
        `;
      };

      path.addEventListener('click', (e) => {
        e.stopPropagation();
        highlightCable(cable.id);
        showCableQuickHud(cable.id, e.clientX, e.clientY);
      });

      path.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        highlightCable(cable.id);
        showCableContextMenu(cable.id, e.clientX, e.clientY);
      });

      path.addEventListener('dblclick', (e) => {
        e.preventDefault();
        e.stopPropagation();
        renameCable2D(cable.id);
      });

      path.addEventListener('mouseenter', showCableTooltip);

      path.addEventListener('mousemove', (e) => {
        if (dom.tooltip.style.display !== 'none') {
          dom.tooltip.style.left = `${e.clientX + 10}px`;
          dom.tooltip.style.top = `${e.clientY - 10}px`;
        }
      });

      path.addEventListener('mouseleave', () => {
        if (STATE.highlightedCableId !== cable.id) dom.tooltip.style.display = 'none';
      });

      dom.cablesGroup.appendChild(path);

      if (dom.connectorsGroup) {
        const bootA = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bootA.setAttribute('cx', x1);
        bootA.setAttribute('cy', y1);
        bootA.setAttribute('r', '3');
        bootA.setAttribute('fill', '#0c101a');
        bootA.setAttribute('stroke', cable.color);
        bootA.setAttribute('stroke-width', '1.6');
        bootA.setAttribute('class', 'cable-boot');
        bootA.style.cursor = 'pointer';
        bootA.addEventListener('click', (e) => {
          e.stopPropagation();
          highlightCable(cable.id);
          showCableQuickHud(cable.id, e.clientX, e.clientY);
        });
        bootA.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          highlightCable(cable.id);
          showCableContextMenu(cable.id, e.clientX, e.clientY);
        });

        const bootB = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bootB.setAttribute('cx', x2);
        bootB.setAttribute('cy', y2);
        bootB.setAttribute('r', '3');
        bootB.setAttribute('fill', '#0c101a');
        bootB.setAttribute('stroke', cable.color);
        bootB.setAttribute('stroke-width', '1.6');
        bootB.setAttribute('class', 'cable-boot');
        bootB.style.cursor = 'pointer';
        bootB.addEventListener('click', (e) => {
          e.stopPropagation();
          highlightCable(cable.id);
          showCableQuickHud(cable.id, e.clientX, e.clientY);
        });
        bootB.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          highlightCable(cable.id);
          showCableContextMenu(cable.id, e.clientX, e.clientY);
        });

        dom.connectorsGroup.appendChild(bootA);
        dom.connectorsGroup.appendChild(bootB);
      }
    });

    renderDRingOverlays(activeRack, contRect, curScale);
  }

  let quickHudEl = null;
  let contextMenuEl = null;

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
    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    STATE.cables = STATE.cables.filter(c => c.id !== cableId);
    if (STATE.highlightedCableId === cableId) {
      STATE.highlightedCableId = null;
    }
    hideCableQuickHud();
    hideCableContextMenu();

    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();

    if (dom.connectionStatusHint) {
      dom.connectionStatusHint.innerHTML = `<span style="color:#f87171; font-weight:700;">✂️ ${escapeHtml(cable.name || cable.id)} söküldü.</span>`;
      setTimeout(() => {
        if (dom.connectionStatusHint && !STATE.pendingConnection) {
          dom.connectionStatusHint.innerHTML = 'Bağlamak için <b>Kaynak Porta</b> tıklayın';
        }
      }, 2500);
    }

    if (window.__STUDIO3D__ && typeof window.__STUDIO3D__.removeCable === 'function') {
      window.__STUDIO3D__.removeCable(cableId);
    }
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
  }

  function showCableQuickHud(cableId, clientX, clientY) {
    hideCableQuickHud();
    hideCableContextMenu();

    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    const hud = document.createElement('div');
    hud.className = 'cable-quick-hud';
    hud.id = 'cable-quick-hud';
    const left = Math.max(80, Math.min(window.innerWidth - 80, clientX));
    const isNearTop = clientY < 85;
    const top = isNearTop ? Math.max(70, clientY + 30) : clientY;
    if (isNearTop) {
      hud.style.transform = 'translate(-50%, 0)';
    }
    hud.style.left = `${left}px`;
    hud.style.top = `${top}px`;

    hud.innerHTML = `
      <span class="hud-title"><span style="color:${cable.color};">●</span> ${escapeHtml(cable.name || cable.id)}</span>
      <button type="button" class="hud-btn-disconnect" title="Kabloyu Sök (Delete Tuşu)">✂️ Sök</button>
      <button type="button" class="hud-btn-color" title="Kablo Rengini Değiştir">🎨</button>
      <button type="button" class="hud-btn-close" title="Kapat">✕</button>
    `;

    hud.querySelector('.hud-btn-disconnect').addEventListener('click', (e) => {
      e.stopPropagation();
      disconnectCable(cableId);
    });

    hud.querySelector('.hud-btn-color').addEventListener('click', (e) => {
      e.stopPropagation();
      const colors = ['#0070d2', '#00d2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#ffffff'];
      const currentIdx = colors.indexOf(cable.color);
      cable.color = colors[(currentIdx + 1) % colors.length];
      renderAllCables();
      renderScheduleTable();
      showCableQuickHud(cableId, left, top);
    });

    hud.querySelector('.hud-btn-close').addEventListener('click', (e) => {
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

    const cable = STATE.cables.find(c => c.id === cableId);
    if (!cable) return;

    const menu = document.createElement('div');
    menu.className = 'cable-context-menu';
    menu.id = 'cable-context-menu';
    const left = Math.max(10, Math.min(window.innerWidth - 180, clientX));
    const top = Math.max(10, Math.min(window.innerHeight - 150, clientY));
    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;

    menu.innerHTML = `
      <div style="padding: 4px 8px; font-size: 0.7rem; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #1e293b;">
        <span style="color:${cable.color};">●</span> ${escapeHtml(cable.name || cable.id)} (${cable.lengthMeters || 1.5}m)
      </div>
      <div class="menu-item danger" id="ctx-disconnect">
        ✂️ Kabloyu Sök (Delete)
      </div>
      <div class="menu-item" id="ctx-rename">
        ✏️ Yeniden Adlandır
      </div>
      <div class="menu-item" id="ctx-change-color">
        🎨 Renk Değiştir
      </div>
      <div class="menu-divider"></div>
      <div class="menu-item" id="ctx-cancel">
        ✕ Kapat
      </div>
    `;

    menu.querySelector('#ctx-disconnect').addEventListener('click', (e) => {
      e.stopPropagation();
      disconnectCable(cableId);
    });

    menu.querySelector('#ctx-rename').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCableContextMenu();
      renameCable2D(cable.id);
    });

    menu.querySelector('#ctx-change-color').addEventListener('click', (e) => {
      e.stopPropagation();
      const colors = ['#0070d2', '#00d2ff', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#ffffff'];
      const currentIdx = colors.indexOf(cable.color);
      cable.color = colors[(currentIdx + 1) % colors.length];
      renderAllCables();
      renderScheduleTable();
      hideCableContextMenu();
    });

    menu.querySelector('#ctx-cancel').addEventListener('click', (e) => {
      e.stopPropagation();
      hideCableContextMenu();
    });

    document.body.appendChild(menu);
    contextMenuEl = menu;
  }

  // Global keydown and click listeners for keyboard shortcuts & auto-dismiss
  if (typeof window !== 'undefined' && !window.__CABLE_INTERACTIONS_BOUND__) {
    window.__CABLE_INTERACTIONS_BOUND__ = true;

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#cable-quick-hud') && !e.target.closest('#cable-context-menu')) {
        hideCableQuickHud();
        hideCableContextMenu();
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const activeEl = document.activeElement;
        const isEditing = activeEl && (
          activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.isContentEditable
        );
        if (isEditing) return;

        if (STATE.highlightedCableId) {
          e.preventDefault();
          disconnectCable(STATE.highlightedCableId);
        }
      }
    });
  }

  function highlightCable(cableId) {
    STATE.highlightedCableId = (STATE.highlightedCableId === cableId) ? null : cableId;
    if (!STATE.highlightedCableId) {
      hideCableQuickHud();
      hideCableContextMenu();
    }

    document.querySelectorAll('.cable-path').forEach(p => {
      p.classList.remove('highlighted');
    });
    if (STATE.highlightedCableId) {
      const p = document.getElementById(`svg-cable-${STATE.highlightedCableId}`);
      if (p) p.classList.add('highlighted');
    }

    document.querySelectorAll('#schedule-tbody tr').forEach(row => {
      row.classList.toggle('active', row.dataset.cableId === STATE.highlightedCableId);
    });
  }

  function addDirectCable(rackA, instA, portA, rackB, instB, portB, color, lengthMeters) {
    const cableId = getNextCableId();
    STATE.cables.push({
      id: cableId,
      name: cableId,
      from: { rackId: rackA, instanceId: instA, portId: portA },
      to: { rackId: rackB, instanceId: instB, portId: portB },
      color: color || '#2563eb',
      lengthMeters: lengthMeters || 1.5
    });
  }

  function highlightDropSlots(targetU, catalogKey, isOver) {
    document.querySelectorAll('.rack-slot.drag-valid, .rack-slot.drag-invalid').forEach(el => {
      el.classList.remove('drag-valid', 'drag-invalid');
    });
    if (!isOver || !targetU) return;
    const cat = catalogKey ? HARDWARE_CATALOG[catalogKey] : (STATE.selectedLibraryItem ? HARDWARE_CATALOG[STATE.selectedLibraryItem] : null);
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
    const cls = isBlocked ? 'drag-invalid' : 'drag-valid';
    for (let u = Math.max(1, endU); u <= targetU; u++) {
      const el = document.getElementById(`rack-slot-u${u}`);
      if (el) el.classList.add(cls);
    }
  }

  // --- RACK MODULE ---
  function renderRackRailsAndSlots(onSlotClick) {
    if (!dom.railLeft || !dom.railRight || !dom.rackSpace) return;
    dom.railLeft.innerHTML = '';
    dom.railRight.innerHTML = '';
    dom.rackSpace.innerHTML = '';

    const heightU = getActiveRack()?.heightU || 42;
    dom.cablesSvg?.setAttribute("viewBox", `0 0 618 ${heightU * 32}`);
    for (let u = heightU; u >= 1; u--) {
      const leftU = document.createElement('div');
      leftU.className = 'u-unit';
      leftU.innerHTML = `
        <div class="rack-holes">
          <div class="hole"></div>
          <div class="hole"></div>
          <div class="hole"></div>
        </div>
        <div class="u-label">${u}</div>
      `;
      dom.railLeft.appendChild(leftU);

      const rightU = document.createElement('div');
      rightU.className = 'u-unit';
      rightU.innerHTML = `
        <div class="u-label">${u}</div>
        <div class="rack-holes">
          <div class="hole"></div>
          <div class="hole"></div>
          <div class="hole"></div>
        </div>
      `;
      dom.railRight.appendChild(rightU);

      const slot = document.createElement('div');
      slot.className = 'rack-slot';
      slot.dataset.u = u;
      slot.id = `rack-slot-u${u}`;

      // Single click: informs the user without mounting (prevents accidental placement during pan/click)
      slot.addEventListener('click', (e) => {
        if (e.target.closest('.mounted-device')) return;
        if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
        if (STATE.selectedLibraryItem) {
          const item = HARDWARE_CATALOG[STATE.selectedLibraryItem];
          const name = item ? item.name : 'Donanım';
          showTemporaryTooltip(e.clientX, e.clientY, `[${name}] eklemek için U${u} yuvasına ÇİFT TIKLAYIN veya sürükleyip bırakın.`);
        }
      });

      // Double click: mounts the device safely
      slot.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (e.target.closest('.mounted-device')) return;
        if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
        if (onSlotClick) onSlotClick(u, e);
      });

      // Drag and drop support
      slot.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
        const draggedDev = window.__RACK_DRAGGED_DEVICE__ || STATE.selectedLibraryItem;
        highlightDropSlots(u, draggedDev, true);
      });

      slot.addEventListener('dragleave', (e) => {
        if (!slot.contains(e.relatedTarget)) {
          highlightDropSlots(u, null, false);
        }
      });

      slot.addEventListener('drop', (e) => {
        e.preventDefault();
        e.stopPropagation();
        highlightDropSlots(u, null, false);
        const devId = e.dataTransfer.getData('application/x-rack-device') || 
                      e.dataTransfer.getData('text/plain') || 
                      window.__RACK_DRAGGED_DEVICE__ || 
                      STATE.selectedLibraryItem;
        window.__RACK_DRAGGED_DEVICE__ = null;
        if (!devId) return;
        mountDeviceFromAction(devId, u, e);
      });

      dom.rackSpace.appendChild(slot);
    }
  }

  function mountDeviceAt(catalogKey, topU, targetRackId) {
    const cat = Object.hasOwn(HARDWARE_CATALOG, catalogKey) ? HARDWARE_CATALOG[catalogKey] : null;
    if (!cat) return null;
    const targetRack = targetRackId ? STATE.racks.find(r => r.id === targetRackId) : getActiveRack();
    if (!targetRack) return null;

    const endU = topU - cat.u + 1;
    if (!Number.isInteger(topU) || !Number.isInteger(cat.u) || cat.u < 1 || endU < 1 || topU > (targetRack.heightU || 42)) return null;
    if (targetRack.devices.some(d => topU >= d.topU - d.uHeight + 1 && endU <= d.topU)) return null;
    const instanceId = 'dev-' + Math.random().toString(36).substring(2, 9);
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

    STATE.cables = STATE.cables.filter(c => c.from.instanceId !== instanceId && c.to.instanceId !== instanceId);

    for (let u = 1; u <= (activeRack.heightU || 42); u++) {
      if (activeRack.units[u] === instanceId) {
        activeRack.units[u] = null;
      }
    }

    activeRack.devices = activeRack.devices.filter(d => d.instanceId !== instanceId);

    if (STATE.pendingConnection && STATE.pendingConnection.instanceId === instanceId) {
      cancelPendingConnection();
    }

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
  }

  function updateDeviceMetadata(instanceId, metadata) {
    const rack = STATE.racks.find(item => item.devices.some(dev => dev.instanceId === instanceId));
    const dev = rack && rack.devices.find(item => item.instanceId === instanceId);
    if (!dev) return false;
    dev.name = String(metadata.name || '').trim();
    dev.hostname = dev.name;
    dev.ipAddress = String(metadata.ipAddress || '').trim();
    dev.macAddress = String(metadata.macAddress || '').trim();
    dev.serialNumber = String(metadata.serialNumber || '').trim();
    dev.panelLabel = String(metadata.panelLabel || '').trim();
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    return true;
  }

  function renderMountedDevices() {
    if (dom.rackSpace && dom.rackSpace.querySelectorAll('.rack-slot').length !== (getActiveRack()?.heightU || 42)) renderRackRailsAndSlots(handleSlotClick);
    document.querySelectorAll('.mounted-device').forEach(el => el.remove());
    const activeRack = getActiveRack();
    if (!activeRack) return;

    occupiedPortKeys = new Set(STATE.cables.flatMap(c => [portKey(c.from.instanceId, c.from.portId), portKey(c.to.instanceId, c.to.portId)]));
    activeRack.devices.forEach(dev => {
      const cat = HARDWARE_CATALOG[dev.catalogKey];
      if (!cat) return;
      const slotEl = document.getElementById(`rack-slot-u${dev.topU}`);
      if (!slotEl) return;

      const devEl = document.createElement('div');
      devEl.className = 'mounted-device';
      devEl.id = dev.instanceId;
      devEl.style.height = `${dev.uHeight * 32}px`;
      devEl.style.top = '0px';

      if (cat.category === 'organizer') {
        devEl.innerHTML = renderOrganizerFaceplate(cat, dev);
      } else if (cat.category === 'blank') {
        devEl.innerHTML = renderBlankFaceplate(cat, dev);
      } else if (cat.category === 'router') {
        devEl.innerHTML = renderRouterFaceplate(cat, dev);
      } else {
        devEl.innerHTML = renderSwitchOrPatchFaceplate(cat, dev);
      }

      slotEl.appendChild(devEl);

      if (!['organizer', 'blank'].includes(cat.category)) {
        devEl.addEventListener('dblclick', (e) => {
          if (e.target.closest('.port, .del-device-btn')) return;
          window.DeviceMetadataEditor?.open2D(dev.instanceId);
        });
        devEl.querySelector('.bezel-badge')?.addEventListener('click', (e) => {
          e.stopPropagation();
          window.DeviceMetadataEditor?.open2D(dev.instanceId);
        });
      }

      const delBtn = devEl.querySelector('.del-device-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`${escapeHtml(cat.name)} cihazını ve bağlı kablolarını kaldırmak istiyor musunuz?`)) {
            removeDevice(dev.instanceId);
          }
        });
      }
    });

    bindPortInteractions();
  }

  function renderRouterFaceplate(cat, dev) {
    const groups = {};
    cat.ports.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    let portsHtml = '';
    Object.keys(groups).forEach(gId => {
      const groupPorts = groups[gId];
      portsHtml += `
        <div class="port-group" style="background:rgba(15,23,42,0.85); border-color:#0284c7;">
          <div class="port-row">
            ${groupPorts.map(p => renderPortIcon(dev.instanceId, p)).join('')}
          </div>
        </div>
      `;
    });

    return `
      <div class="device-faceplate" style="background:linear-gradient(90deg, #131b2c 0%, #1e293b 100%);">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
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
    const isDring = (cat && (cat.id === 'organizer-dring-1u' ||
                    (cat.modelTag && cat.modelTag.includes('D-RING')) ||
                    (cat.name && cat.name.toLowerCase().includes('d-ring')))) ||
                    (dev && dev.catalogKey && dev.catalogKey.includes('dring'));

    if (isDring) {
      const rings = [1, 2, 3, 4, 5].map(idx => `
        <div class="dring-bracket" data-ring="${idx}">
          <div class="dring-mount-base"></div>
          <div class="dring-loop">
            <div class="dring-aperture"></div>
            <div class="dring-front-face"></div>
          </div>
        </div>
      `).join('');

      return `
        <div class="organizer-faceplate dring-faceplate">
          <div class="device-controls">
            <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
          </div>
          <div class="dring-ring-container">
            ${rings}
          </div>
        </div>
      `;
    }

    return `
      <div class="organizer-faceplate" style="${is2U ? 'background: #0d121c;' : ''}">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
        </div>
        <div style="font-size:0.6rem; color:#64748b; font-family:monospace; font-weight:700; padding:0 8px;">
          ${escapeHtml(cat.modelTag)}
        </div>
        <div class="organizer-brush" style="${is2U ? 'height:24px;' : ''}"></div>
      </div>
    `;
  }

  function renderBlankFaceplate(cat, dev) {
    return `
      <div style="width:100%; height:100%; background:#141720; border-top:1px solid #2d3340; display:flex; align-items:center; justify-content:center; position:relative;">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Paneli Kaldır">✕</button>
        </div>
        <span style="font-size:0.6rem; color:#475569; font-family:monospace; letter-spacing:2px;">BLANK COVER PANEL 1U</span>
      </div>
    `;
  }

  function renderSwitchOrPatchFaceplate(cat, dev) {
    const isSwitch = cat.category === 'switch' || cat.category === 'fiber-switch';
    const isFiberPanel = cat.category === 'fiber';
    const isPatchPanel = cat.category === 'patch' || isFiberPanel;
    const typeLabel = isSwitch ? 'SWITCH' : isFiberPanel ? 'FIBER PANEL' : 'PATCH PANEL';
    const typeClass = isSwitch ? 'faceplate-switch' : isFiberPanel ? 'faceplate-fiber-panel' : 'faceplate-patch-panel';
    const configuredLabel = isPatchPanel
      ? (dev.panelLabel || dev.name || '')
      : (dev.hostname || dev.name || '');
    const groups = {};
    cat.ports.forEach(p => {
      if (!groups[p.group]) groups[p.group] = [];
      groups[p.group].push(p);
    });

    let portsHtml = '';
    Object.keys(groups).forEach(gId => {
      const groupPorts = groups[gId];
      const isTwoRows = groupPorts.some(p => p.row === 1);

      if (isTwoRows) {
        const row0 = groupPorts.filter(p => p.row === 0);
        const row1 = groupPorts.filter(p => p.row === 1);

        portsHtml += `
          <div class="port-group">
            <div class="port-row">
              ${row0.map(p => renderPortIcon(dev.instanceId, p)).join('')}
            </div>
            <div class="port-row">
              ${row1.map(p => renderPortIcon(dev.instanceId, p)).join('')}
            </div>
          </div>
        `;
      } else {
        portsHtml += `
          <div class="port-group">
            <div class="port-row">
              ${groupPorts.map(p => renderPortIcon(dev.instanceId, p)).join('')}
            </div>
          </div>
        `;
      }
    });

    return `
      <div class="device-faceplate ${typeClass}">
        <div class="device-controls">
          <button class="dev-btn del-device-btn" title="Cihazı Kaldır">✕</button>
        </div>
        <div class="bezel-badge" title="${escapeHtml([cat.logo, cat.modelTag, typeLabel, configuredLabel].filter(Boolean).join(' · '))}">
          <div class="bezel-primary-row">
            <span class="bezel-logo">${escapeHtml(cat.logo)}</span>
            <span class="device-kind-badge">${typeLabel}</span>
          </div>
          <div class="bezel-secondary-row">
            <span class="bezel-model">${escapeHtml(cat.modelTag)}</span>
            ${configuredLabel ? `<span class="device-config-label">${escapeHtml(configuredLabel)}</span>` : ''}
          </div>
        </div>
        ${isPatchPanel ? '<div class="passive-panel-mark" title="Pasif sonlandırma paneli">PASSIVE</div>' : `<div class="device-status-leds">
          <div class="status-led" title="Power: OK"></div>
          <div class="status-led" style="background:#38bdf8; box-shadow:0 0 4px #38bdf8;" title="Status: Active"></div>
        </div>`}
        <div class="ports-area">
          ${portsHtml}
        </div>
      </div>
    `;
  }

  const portKey = (instanceId, portId) => JSON.stringify([instanceId, portId]);
  let occupiedPortKeys = new Set();
  function renderPortIcon(instanceId, port) {
    let typeClass = 'port-rj45';
    let inner = '';
    if (port.type === 'sfp') {
      typeClass = 'port-sfp';
    } else if (port.type === 'lc') {
      typeClass = 'port-lc';
      inner = '<div class="port-lc-inner"></div><div class="port-lc-inner"></div>';
    }

    const isConnected = occupiedPortKeys.has(portKey(instanceId, port.id));
    const activeRack = getActiveRack ? getActiveRack() : (STATE.racks && STATE.racks[0]);
    const dev = activeRack && activeRack.devices.find(d => d.instanceId === instanceId);
    const portCfg = dev && dev.portsConfig && (dev.portsConfig[port.id] || dev.portsConfig[port.id.replace('p', '')] || dev.portsConfig[port.name]);

    let specialClass = '';
    let specialStyle = '';

    if (portCfg) {
      const role = (portCfg.role || (portCfg.isTrunk ? 'trunk' : '')).toLowerCase();
      const hasVlan = Boolean(portCfg.vlan);
      const customColor = portCfg.color;

      if (role === 'trunk' || portCfg.isTrunk) {
        const color = customColor || '#a855f7';
        specialClass = 'port-special port-trunk';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --trunk-color: ${color}; --port-badge-text: 'T';"`;
      } else if (role === 'uplink') {
        const color = customColor || '#00d2ff';
        specialClass = 'port-special port-uplink';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '▲';"`;
      } else if (role === 'poe') {
        const color = customColor || '#f59e0b';
        specialClass = 'port-special port-poe';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '⚡';"`;
      } else if (role === 'management' || role === 'mgmt') {
        const color = customColor || '#10b981';
        specialClass = 'port-special port-mgmt';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: 'M';"`;
      } else if (hasVlan || (role === 'access' && hasVlan)) {
        const color = customColor || '#3b82f6';
        const vlanLabel = String(portCfg.vlan).trim().split(/[, ]+/)[0];
        const badgeText = vlanLabel ? `V${vlanLabel.slice(0, 3)}` : 'V';
        specialClass = 'port-special port-vlan';
        specialStyle = `style="--port-role-color: ${color}; --custom-color: ${color}; --port-badge-text: '${badgeText}';"`;
      } else if (customColor) {
        specialClass = 'port-special';
        specialStyle = `style="--port-role-color: ${customColor}; --custom-color: ${customColor}; --port-badge-text: '●';"`;
      }
    }

    return `
      <div class="port ${typeClass} ${isConnected ? 'connected' : ''} ${specialClass}" 
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
    const portElements = document.querySelectorAll('.port');
    portElements.forEach(portEl => {
      portEl.addEventListener('mouseenter', handlePortHover);
      portEl.addEventListener('mouseleave', handlePortLeave);
      portEl.addEventListener('click', (e) => {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          const devId = portEl.dataset.instanceId;
          const portId = portEl.dataset.portId;
          if (window.PortConfigEditor) {
            window.PortConfigEditor.open(devId, portId, '2d');
          }
          return;
        }
        handlePortClick(e);
      });
      portEl.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const devId = portEl.dataset.instanceId;
        const portId = portEl.dataset.portId;
        if (window.PortConfigEditor) {
          window.PortConfigEditor.open(devId, portId, '2d');
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

    const dev = activeRack.devices.find(d => d.instanceId === instanceId);
    if (!dev) return;
    const cat = HARDWARE_CATALOG[dev.catalogKey];

    const connectedCable = STATE.cables.find(c =>
      (c.from.instanceId === instanceId && c.from.portId === portId) ||
      (c.to.instanceId === instanceId && c.to.portId === portId)
    );

    let connectionInfo = '<span style="color:#94a3b8;">Boş / Bağlantı Yok</span>';
    if (connectedCable) {
      const isFrom = (connectedCable.from.instanceId === instanceId && connectedCable.from.portId === portId);
      const otherEndpoint = isFrom ? connectedCable.to : connectedCable.from;
      const otherRack = STATE.racks.find(r => r.id === otherEndpoint.rackId);
      const otherDev = otherRack ? otherRack.devices.find(d => d.instanceId === otherEndpoint.instanceId) : null;
      const otherCat = otherDev ? HARDWARE_CATALOG[otherDev.catalogKey] : null;
      const otherPort = otherCat ? otherCat.ports.find(p => p.id === otherEndpoint.portId) : null;

      const isInterRack = otherEndpoint.rackId !== activeRack.id;
      connectionInfo = `<span style="color:${isInterRack ? '#38bdf8' : '#22c55e'}; font-weight:600;">
        Bağlı -> ${isInterRack ? `[${escapeHtml(otherRack ? otherRack.name : 'Dış Kabin')}] ` : ''}${escapeHtml(otherCat ? otherCat.name : '')} [${escapeHtml(otherPort ? otherPort.name : otherEndpoint.portId)}]
      </span>`;
    }

    const portCfg = dev.portsConfig && (dev.portsConfig[portId] || dev.portsConfig[portId.replace('p', '')] || dev.portsConfig[portName]);
    const isTrunk = portCfg && (portCfg.role === 'trunk' || portCfg.isTrunk);
    const trunkColor = (portCfg && portCfg.color) || '#a855f7';
    let trunkDetail = '';
    if (isTrunk && portCfg) {
      const cName = portCfg.ciscoName ? ` · ${escapeHtml(portCfg.ciscoName)}` : '';
      const vText = portCfg.vlan ? ` | VLAN: ${escapeHtml(portCfg.vlan)}` : '';
      const dText = portCfg.description ? `<div style="color:#94a3b8; font-size:10px; font-style:italic;">"${escapeHtml(portCfg.description)}"</div>` : '';
      trunkDetail = `
        <div style="background:rgba(168,85,247,0.2); border-left:3px solid ${trunkColor}; padding:2px 6px; margin:4px 0; border-radius:2px;">
          <span style="color:${trunkColor}; font-weight:700;">⚡ 802.1Q TRUNK${cName}${vText}</span>
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
      dom.tooltip.style.display = 'block';
      dom.tooltip.style.left = `${rect.right + 10}px`;
      dom.tooltip.style.top = `${rect.top - 5}px`;
      const trunkBadge = isTrunk ? `<div style="color:${trunkColor}; font-weight:bold; font-size:10px;">⚡ 802.1Q TRUNK</div>` : '';
      dom.tooltip.innerHTML = `<b>${escapeHtml(cat.modelTag)}</b> &bull; ${escapeHtml(portName)}${trunkBadge}<br><span style="color:#94a3b8; font-size:0.68rem;">${escapeHtml(portSpeed)}</span><br><span style="color:#38bdf8; font-size:0.65rem;">Ayarlar: <b>Sağ Tık / Shift+Tık</b></span>`;
    }
  }

  function handlePortLeave() {
    if (dom.tooltip) dom.tooltip.style.display = 'none';
  }

  function handlePortClick(e) {
    e.stopPropagation();
    const portEl = e.currentTarget;
    const instanceId = portEl.dataset.instanceId;
    const portId = portEl.dataset.portId;
    const activeRack = getActiveRack();
    if (!activeRack) return;

    if (!STATE.pendingConnection) {
      const isOccupied = STATE.cables.some(c =>
        (c.from.instanceId === instanceId && c.from.portId === portId) ||
        (c.to.instanceId === instanceId && c.to.portId === portId)
      );

      if (isOccupied) {
        const connectedCable = STATE.cables.find(c => 
          (c.from.instanceId === instanceId && c.from.portId === portId) ||
          (c.to.instanceId === instanceId && c.to.portId === portId)
        );
        if (connectedCable) {
          highlightCable(connectedCable.id);
          const rect = portEl.getBoundingClientRect();
          showCableQuickHud(connectedCable.id, rect.left + rect.width / 2, rect.top);
        }
        return;
      }

      STATE.pendingConnection = {
        rackId: activeRack.id,
        instanceId,
        portId,
        element: portEl
      };

      portEl.classList.add('selected');
      const dev = activeRack.devices.find(d => d.instanceId === instanceId);
      const cat = dev ? HARDWARE_CATALOG[dev.catalogKey] : null;
      const port = cat ? cat.ports.find(p => p.id === portId) : null;

      if (dom.connectionStatusHint && cat && port) {
        dom.connectionStatusHint.innerHTML = `Kaynak: <span style="color:#38bdf8;">[${escapeHtml(activeRack.name)}] ${escapeHtml(cat.modelTag)} (${escapeHtml(port.name)})</span> &rarr; <b>Hedef Porta Tıklayın (Kabin değiştirebilirsiniz)</b>`;
      }
    } else {
      const source = STATE.pendingConnection;

      if (source.rackId === activeRack.id && source.instanceId === instanceId && source.portId === portId) {
        cancelPendingConnection();
        return;
      }

      const isTargetOccupied = STATE.cables.some(c =>
        (c.from.instanceId === instanceId && c.from.portId === portId) ||
        (c.to.instanceId === instanceId && c.to.portId === portId)
      );

      if (isTargetOccupied) {
        alert("Hedef port dolu! Lütfen boş bir port seçin.");
        return;
      }

      const isInterRack = source.rackId !== activeRack.id;
      const cableId = getNextCableId();

      // Check trunk role and color inheritance
      const sourceDev = STATE.racks?.find(r => r.id === source.rackId)?.devices?.find(d => d.instanceId === source.instanceId);
      const targetDev = activeRack.devices?.find(d => d.instanceId === instanceId);
      const sourcePortCfg = sourceDev?.portsConfig && (sourceDev.portsConfig[source.portId] || sourceDev.portsConfig[source.portId.replace('p', '')]);
      const targetPortCfg = targetDev?.portsConfig && (targetDev.portsConfig[portId] || targetDev.portsConfig[portId.replace('p', '')]);
      const isTrunkLink = (sourcePortCfg && sourcePortCfg.isTrunk) || (targetPortCfg && targetPortCfg.isTrunk);
      const trunkColor = (sourcePortCfg && sourcePortCfg.isTrunk && sourcePortCfg.color) || (targetPortCfg && targetPortCfg.isTrunk && targetPortCfg.color) || '#a855f7';
      const effectiveCableColor = (isTrunkLink && ((sourcePortCfg && sourcePortCfg.autoCableColor !== false) || (targetPortCfg && targetPortCfg.autoCableColor !== false))) ? trunkColor : STATE.selectedCableColor;
      const trunkPrefix = isTrunkLink ? '[TRUNK] ' : '';

      const newCable = {
        id: cableId,
        name: trunkPrefix + cableId,
        from: { rackId: source.rackId, instanceId: source.instanceId, portId: source.portId },
        to: { rackId: activeRack.id, instanceId, portId },
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
    if (isInterRack) return 15.0; // Inter-rack structured tie cable
    const activeRack = getActiveRack();
    if (!activeRack) return 1.5;
    const devA = activeRack.devices.find(d => d.instanceId === instA);
    const devB = activeRack.devices.find(d => d.instanceId === instB);
    if (!devA || !devB) return 1.5;
    const uDiff = Math.abs(devA.topU - devB.topU);
    const length = 0.5 + (uDiff * 0.045) + (uDiff > 5 ? 0.8 : 0.2);
    return parseFloat(length.toFixed(2));
  }

  // --- PAN & ZOOM MODULE ---
  function updateStageTransform(smooth = false) {
    if (!dom.rackStage) return;
    if (smooth) {
      dom.rackStage.style.transition = 'transform 0.25s cubic-bezier(0.2, 0.8, 0.25, 1)';
    } else {
      dom.rackStage.style.transition = 'none';
    }
    dom.rackStage.style.transform = `translate3d(${ZOOM_STATE.panX}px, ${ZOOM_STATE.panY}px, 0) scale(${ZOOM_STATE.scale})`;
    if (dom.zoomBadge) {
      dom.zoomBadge.textContent = `${Math.round(ZOOM_STATE.scale * 100)}%`;
    }
  }

  function fitRackToScreen(smooth = true) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    if (cw <= 0 || ch <= 0) return;

    const rackW = 634; // 618px inner content + 16px border
    const rackH = (getActiveRack()?.heightU || 42) * 32 + 16; // 1344px inner content + 16px border

    const padX = 24;
    const padY = 20;

    const scaleX = (cw - padX * 2) / rackW;
    const scaleY = (ch - padY * 2) / rackH;
    const fitScale = Math.max(ZOOM_STATE.minScale, Math.min(scaleX, scaleY, 1.25));

    ZOOM_STATE.scale = fitScale;
    ZOOM_STATE.panX = Math.round((cw - rackW * fitScale) / 2);
    ZOOM_STATE.panY = Math.max(8, Math.round((ch - rackH * fitScale) / 2));
    ZOOM_STATE.isFit = true;

    updateStageTransform(smooth);
    setTimeout(renderAllCables, 40);
  }

  function setZoom(newScale, screenX, screenY, smooth = false) {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clampedScale = Math.max(ZOOM_STATE.minScale, Math.min(ZOOM_STATE.maxScale, newScale));

    const cx = (screenX !== undefined) ? screenX - rect.left : canvas.clientWidth / 2;
    const cy = (screenY !== undefined) ? screenY - rect.top : canvas.clientHeight / 2;

    const stageX = (cx - ZOOM_STATE.panX) / ZOOM_STATE.scale;
    const stageY = (cy - ZOOM_STATE.panY) / ZOOM_STATE.scale;

    ZOOM_STATE.scale = clampedScale;
    ZOOM_STATE.panX = Math.round(cx - stageX * clampedScale);
    ZOOM_STATE.panY = Math.round(cy - stageY * clampedScale);
    ZOOM_STATE.isFit = false;

    updateStageTransform(smooth);
    scheduleCableRender();
  }

  let cableRenderTimer = null;
  function scheduleCableRender(delay = 50) {
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

    const targetScale = Math.min(1.3, Math.max(0.9, (cw - 40) / rackW));
    ZOOM_STATE.scale = targetScale;
    ZOOM_STATE.panX = Math.round((cw - rackW * targetScale) / 2);
    ZOOM_STATE.isFit = false;

    if (section === 'top') {
      ZOOM_STATE.panY = 16;
    } else if (section === 'mid') {
      ZOOM_STATE.panY = Math.round(ch / 2 - (((getActiveRack()?.heightU || 42) * 16) * targetScale));
    } else if (section === 'bot') {
      ZOOM_STATE.panY = Math.round(ch - (((getActiveRack()?.heightU || 42) * 32 + 16) * targetScale) - 24);
    }

    updateStageTransform(true);
  }

  let panFrame = 0;
  function bindZoomAndPanEvents() {
    const canvas = dom.viewportCanvas;
    if (!canvas) return;

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      setZoom(ZOOM_STATE.scale * factor, e.clientX, e.clientY, false);
    }, { passive: false });

    canvas.addEventListener('mousedown', (e) => {
      if (e.target.closest('.port') || e.target.closest('.dev-btn') || e.target.closest('.del-device-btn')) {
        return;
      }
      ZOOM_STATE.isPanning = true;
      ZOOM_STATE.startX = e.clientX - ZOOM_STATE.panX;
      ZOOM_STATE.startY = e.clientY - ZOOM_STATE.panY;
      ZOOM_STATE.hasMoved = false;
      canvas.classList.add('panning');
    });

    window.addEventListener('mousemove', (e) => {
      if (!ZOOM_STATE.isPanning) return;
      const newPanX = e.clientX - ZOOM_STATE.startX;
      const newPanY = e.clientY - ZOOM_STATE.startY;
      if (Math.abs(newPanX - ZOOM_STATE.panX) > 3 || Math.abs(newPanY - ZOOM_STATE.panY) > 3) {
        ZOOM_STATE.hasMoved = true;
      }
      ZOOM_STATE.panX = newPanX;
      ZOOM_STATE.panY = newPanY;
      ZOOM_STATE.isFit = false;
      if (!panFrame) panFrame = requestAnimationFrame(() => { panFrame = 0; updateStageTransform(false); });
    });

    window.addEventListener('mouseup', () => {
      if (ZOOM_STATE.isPanning) {
        ZOOM_STATE.isPanning = false;
        canvas.classList.remove('panning');
        setTimeout(() => { ZOOM_STATE.hasMoved = false; }, 120);
      }
    });

    canvas.addEventListener('dblclick', (e) => {
      if (e.target.closest('.port') || e.target.closest('.dev-btn') || e.target.closest('.rack-slot') || e.target.closest('.mounted-device')) return;
      if (ZOOM_STATE.scale > 0.85) {
        fitRackToScreen(true);
      } else {
        setZoom(1.25, e.clientX, e.clientY, true);
      }
    });

    if (dom.btnZoomIn) {
      dom.btnZoomIn.addEventListener('click', () => setZoom(ZOOM_STATE.scale * 1.25, undefined, undefined, true));
    }
    if (dom.btnZoomOut) {
      dom.btnZoomOut.addEventListener('click', () => setZoom(ZOOM_STATE.scale / 1.25, undefined, undefined, true));
    }
    if (dom.btnZoomFit) {
      dom.btnZoomFit.addEventListener('click', () => fitRackToScreen(true));
    }
    if (dom.btnZoomActual) {
      dom.btnZoomActual.addEventListener('click', () => setZoom(1.0, undefined, undefined, true));
    }
    if (dom.zoomBadge) {
      dom.zoomBadge.addEventListener('click', () => {
        if (ZOOM_STATE.scale > 0.85) {
          fitRackToScreen(true);
        } else {
          setZoom(1.0, undefined, undefined, true);
        }
      });
    }

    if (dom.navJumpTop) dom.navJumpTop.addEventListener('click', () => jumpToSection('top'));
    if (dom.navJumpMid) dom.navJumpMid.addEventListener('click', () => jumpToSection('mid'));
    if (dom.navJumpBot) dom.navJumpBot.addEventListener('click', () => jumpToSection('bot'));
  }

  // --- SCHEDULE TABLE MODULE ---
  let schedulePage = 0;
  const SCHEDULE_PAGE_SIZE = 100;
  function renderScheduleTable() {
    if (!dom.scheduleTbody) return;
    dom.scheduleTbody.innerHTML = '';
    let pager = document.getElementById('schedule-pagination');
    if (!pager) {
      pager = document.createElement('div'); pager.id = 'schedule-pagination';
      pager.style.cssText = 'display:flex;gap:8px;align-items:center;padding:8px;font-size:12px;';
      const previous = document.createElement('button'); previous.type = 'button'; previous.textContent = '← Önceki';
      const label = document.createElement('span'); label.className = 'schedule-page-label'; label.setAttribute('aria-live','polite');
      const next = document.createElement('button'); next.type = 'button'; next.textContent = 'Sonraki →';
      previous.addEventListener('click', () => { schedulePage--; renderScheduleTable(); });
      next.addEventListener('click', () => { schedulePage++; renderScheduleTable(); });
      pager.append(previous,label,next);
      dom.scheduleTbody.closest('table').before(pager);
    }
    const pages = Math.max(1, Math.ceil(STATE.cables.length / SCHEDULE_PAGE_SIZE));
    schedulePage = Math.max(0, Math.min(schedulePage, pages - 1));
    pager.querySelector('.schedule-page-label').textContent = (schedulePage + 1) + ' / ' + pages + ' · ' + STATE.cables.length + ' bağlantı';
    pager.firstElementChild.disabled = schedulePage === 0;
    pager.lastElementChild.disabled = schedulePage === pages - 1;
    if (dom.cableCountLabel) {
      dom.cableCountLabel.textContent = `${STATE.cables.length} Bağlantı Yapıldı`;
    }

    if (STATE.cables.length === 0) {
      dom.scheduleTbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align:center; color:#64748b; padding:20px;">
            Henüz kablo bağlantısı yapılmadı.
          </td>
        </tr>
      `;
      return;
    }

    STATE.cables.slice(schedulePage * SCHEDULE_PAGE_SIZE, (schedulePage + 1) * SCHEDULE_PAGE_SIZE).forEach(c => {
      const rackA = STATE.racks.find(r => r.id === c.from.rackId);
      const rackB = STATE.racks.find(r => r.id === c.to.rackId);
      const devA = rackA ? rackA.devices.find(d => d.instanceId === c.from.instanceId) : null;
      const devB = rackB ? rackB.devices.find(d => d.instanceId === c.to.instanceId) : null;

      const catA = devA ? HARDWARE_CATALOG[devA.catalogKey] : null;
      const catB = devB ? HARDWARE_CATALOG[devB.catalogKey] : null;
      const portA = catA ? catA.ports.find(p => p.id === c.from.portId) : null;
      const portB = catB ? catB.ports.find(p => p.id === c.to.portId) : null;

      const isInterRack = c.from.rackId !== c.to.rackId;

      const tr = document.createElement('tr');
      tr.dataset.cableId = c.id;
      if (c.id === STATE.highlightedCableId) tr.className = 'active';

      const rackShortA = rackA ? (rackA.name.length > 12 ? rackA.name.slice(0, 12) + '…' : rackA.name) : 'Kabin';
      const rackShortB = rackB ? (rackB.name.length > 12 ? rackB.name.slice(0, 12) + '…' : rackB.name) : 'Kabin';

      tr.innerHTML = `
        <td>
          <span class="cable-color-dot" style="background:${c.color};"></span>
          <b>${escapeHtml(c.name || c.id)}</b>
          ${isInterRack ? `<span style="font-size:0.6rem; background:#0284c7; color:#fff; padding:1px 4px; border-radius:3px; margin-left:3px;" title="Kabinler Arası Bağlantı">INTER</span>` : ''}
        </td>
        <td title="${escapeHtml(rackA ? rackA.name : '')}">[${escapeHtml(rackShortA)}] U${devA ? devA.topU : '?'}-${escapeHtml(portA ? portA.name : c.from.portId)}</td>
        <td title="${escapeHtml(rackB ? rackB.name : '')}">[${escapeHtml(rackShortB)}] U${devB ? devB.topU : '?'}-${escapeHtml(portB ? portB.name : c.to.portId)}</td>
        <td>${c.lengthMeters}m</td>
        <td>
          <button class="del-cable-btn" data-cable-id="${c.id}" title="Kabloyu Sil">&#10005;</button>
        </td>
      `;

      tr.addEventListener('click', (e) => {
        if (e.target.closest('.del-cable-btn')) return;
        highlightCable(c.id);
      });

      tr.addEventListener('dblclick', (e) => {
        if (e.target.closest('.del-cable-btn')) return;
        e.preventDefault();
        renameCable2D(c.id);
      });

      const delBtn = tr.querySelector('.del-cable-btn');
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        STATE.cables = STATE.cables.filter(item => item.id !== c.id);
        if (STATE.highlightedCableId === c.id) STATE.highlightedCableId = null;
        renderMountedDevices();
        renderScheduleTable();
        renderAllCables();
      });

      dom.scheduleTbody.appendChild(tr);
    });
  }

  // --- EXPORT & IMPORT MODULE ---
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
    <text x="350" y="15" text-anchor="middle" font-family="'Segoe UI', Arial" font-size="12" fill="#38bdf8" font-weight="bold">${escapeHtml(activeRack ? activeRack.name : '42U Rack')}</text>
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
    svgContent += `  </g>\n`;

    svgContent += `  <!-- LAYER 2: CISCO & NETWORK HARDWARE -->\n  <g v:groupContext="layer" v:layerMember="Network_Devices">\n`;
    if (activeRack) {
      activeRack.devices.forEach(dev => {
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
    svgContent += `  </g>\n`;

    svgContent += `  <!-- LAYER 3: CABLING RUN SCHEDULE & CONNECTIONS -->\n  <g v:groupContext="layer" v:layerMember="Patch_Cables" transform="translate(40, 20)">\n`;
    const svgLayer = document.getElementById('cables-svg');
    if (svgLayer) {
      const paths = svgLayer.querySelectorAll('.cable-path');
      paths.forEach((p, idx) => {
        const d = p.getAttribute('d');
        const stroke = p.getAttribute('stroke');
        const cable = STATE.cables.find(c => 'svg-cable-' + c.id === p.id) || { id: 'CBL' };
        svgContent += `
          <path d="${d}" stroke="${stroke}" stroke-width="2.8" class="v-cable" v:groupContext="shape">
            <title>${cable.id} (${cable.lengthMeters}m)</title>
          </path>
        `;
      });
    }
    svgContent += `  </g>\n</svg>`;

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const dlLink = document.createElement('a');
    dlLink.href = url;
    const safeName = activeRack ? activeRack.name.replace(/[^a-zA-Z0-9_-]/g, '_') : 'rack';
    dlLink.download = `cisco-${heightU}u-visio-${safeName}-${new Date().toISOString().slice(0,10)}.svg`;
    document.body.appendChild(dlLink);
    dlLink.click();
    dlLink.remove();
    URL.revokeObjectURL(url);
  }

  function exportJson() {
    const exportData = {
      version: '4.0-studio',
      customCatalog: STATE.customCatalog,
      timestamp: new Date().toISOString(),
      activeRackId: STATE.activeRackId,
      racks: STATE.racks,
      cables: STATE.cables
    };
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `cisco-site-topology-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
  }

  function validateTopology(data) {
    if (!data || typeof data !== 'object') throw new Error('Geçersiz proje.');
    const customCatalog = JSON.parse(JSON.stringify(data.customCatalog || {}));
    if (Array.isArray(customCatalog) || typeof customCatalog !== 'object') throw new Error('Geçersiz katalog.');
    const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,160}$/.test(value);
    for (const [key, cat] of Object.entries(customCatalog)) {
      if (!validId(key) || ['__proto__','constructor','prototype'].includes(key) || BUILTIN_KEYS.has(key) || !cat || !Number.isInteger(cat.u) || cat.u < 1 || cat.u > 60 || !Array.isArray(cat.ports) || typeof cat.name !== 'string') throw new Error('Geçersiz özel cihaz: ' + key);
      const ids = new Set();
      for (const port of cat.ports) { if (!validId(port.id) || ids.has(port.id)) throw new Error('Geçersiz port.'); ids.add(port.id); }
    }
    const catalog = Object.fromEntries([...BUILTIN_KEYS].map(key => [key, HARDWARE_CATALOG[key]]));
    Object.assign(catalog, customCatalog);
    const legacy = !Array.isArray(data.racks);
    const sourceRacks = legacy ? [{id:'rack-1', name:'MDF - Dağıtım Kabini', heightU:data.heightU || 42, devices:data.devices}] : data.racks;
    if (!sourceRacks.length || sourceRacks.length > 1000) throw new Error('Proje en az bir kabin içermeli.');
    const rackIds = new Set(), deviceIds = new Set(), deviceMap = new Map();
    const racks = sourceRacks.map(source => {
      const heightU = source.heightU ?? 42;
      if (!validId(source.id) || rackIds.has(source.id) || typeof source.name !== 'string' || !Number.isInteger(heightU) || heightU < 1 || heightU > 60 || !Array.isArray(source.devices)) throw new Error('Geçersiz kabin.');
      rackIds.add(source.id);
      const units = Array(heightU + 1).fill(null);
      const devices = source.devices.map(dev => {
        const cat = Object.hasOwn(catalog, dev.catalogKey) ? catalog[dev.catalogKey] : null;
        if (!cat || !validId(dev.instanceId) || deviceIds.has(dev.instanceId) || !Number.isInteger(dev.topU) || dev.topU > heightU || dev.topU - cat.u < 0 || (dev.uHeight !== undefined && dev.uHeight !== cat.u)) throw new Error('Geçersiz cihaz veya U konumu.');
        for(let u = dev.topU - cat.u + 1; u <= dev.topU; u++) { if(units[u]) throw new Error('Cihaz yerleşimleri çakışıyor.'); units[u] = dev.instanceId; }
        deviceIds.add(dev.instanceId); deviceMap.set(dev.instanceId, {rackId:source.id, cat});
        return {...dev, uHeight:cat.u};
      });
      return {...source, heightU, units, devices};
    });
    if (data.cables !== undefined && !Array.isArray(data.cables)) throw new Error('Geçersiz kablolar.');
    const cableIds = new Set(), usedPorts = new Set();
    const cables = (data.cables || []).map(c => {
      if(!validId(c.id) || cableIds.has(c.id)) throw new Error('Tekrarlanan/geçersiz kablo kimliği.');
      cableIds.add(c.id);
      const endpoints = ['from','to'].map(side => {
        const endpoint = {...c[side]}; if(legacy && !endpoint.rackId) endpoint.rackId = 'rack-1';
        const device = deviceMap.get(endpoint.instanceId);
        const key = portKey(endpoint.instanceId, endpoint.portId);
        if(!device || endpoint.rackId !== device.rackId || !device.cat.ports.some(p => p.id === endpoint.portId) || usedPorts.has(key)) throw new Error('Geçersiz veya dolu kablo portu.');
        usedPorts.add(key); return endpoint;
      });
      if(c.color && !/^#[0-9a-f]{6}$/i.test(c.color)) throw new Error('Geçersiz kablo rengi.');
      if(c.lengthMeters !== undefined && (!Number.isFinite(c.lengthMeters) || c.lengthMeters < 0)) throw new Error('Geçersiz kablo uzunluğu.');
      return {...c, from:endpoints[0], to:endpoints[1]};
    });
    return {racks, cables, customCatalog, activeRackId:rackIds.has(data.activeRackId) ? data.activeRackId : racks[0].id};
  }

  function refresh() {
    renderRackRailsAndSlots(handleSlotClick);
    renderRackTabs(); renderMountedDevices(); renderScheduleTable(); renderAllCables();
    document.dispatchEvent(new CustomEvent('rackstudio:refresh', {bubbles:true}));
    document.dispatchEvent(new CustomEvent('rackstudio:change', {bubbles:true}));
  }

  function loadCustomTopology(data) {
    const next = validateTopology(data);
    for (const key of Object.keys(HARDWARE_CATALOG)) if (!BUILTIN_KEYS.has(key)) delete HARDWARE_CATALOG[key];
    Object.assign(HARDWARE_CATALOG, next.customCatalog);
    Object.assign(STATE, next);
    STATE.rackCounter = Math.max(0, ...STATE.racks.map(r => Number(r.id.match(/\d+$/)?.[0]) || 0));
    STATE.cableCounter = Math.max(0, ...STATE.cables.map(c => Number(c.id.match(/\d+$/)?.[0]) || 0));
    cancelPendingConnection(); STATE.highlightedCableId = null;
    refresh();
    return true;
  }

  // --- PRESETS: MDF, IDF & FULL SITE TOPOLOGIES ---
  function loadMdfPreset() {
    STATE.racks = [
      {
        id: 'rack-1',
        name: 'MDF - Ana Dağıtım & WAN Omurga Kabini',
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ];
    STATE.activeRackId = 'rack-1';
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.highlightedCableId = null;

    const r = STATE.racks[0];

    const dODF = mountDeviceAt('fiber-odf-24', 42, r.id);
    mountDeviceAt('organizer-1u', 41, r.id);
    const dRouter1 = mountDeviceAt('cisco-isr-4431', 40, r.id);
    const dRouter2 = mountDeviceAt('cisco-isr-4431', 39, r.id);
    mountDeviceAt('organizer-1u', 38, r.id);
    const dCoreFiber1 = mountDeviceAt('cisco-3850-24s', 37, r.id);
    const dCoreFiber2 = mountDeviceAt('cisco-3850-24s', 36, r.id);
    mountDeviceAt('organizer-2u', 35, r.id);
    const dCore9300 = mountDeviceAt('cisco-9300l-24p', 33, r.id);
    const dPatch32 = mountDeviceAt('patch-cat6-24', 32, r.id);
    mountDeviceAt('organizer-1u', 31, r.id);
    const dSwitch9200 = mountDeviceAt('cisco-9200l-24p', 30, r.id);
    const dPatch29 = mountDeviceAt('patch-cat6-24', 29, r.id);
    mountDeviceAt('blank-panel-1u', 28, r.id);

    // WAN Router -> Fiber ODF connections
    if (dODF && dRouter1) {
      addDirectCable(r.id, dODF.instanceId, 'lc1', r.id, dRouter1.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
      addDirectCable(r.id, dODF.instanceId, 'lc2', r.id, dRouter2.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
    }
    // Routers -> Core Switch 3850 Fiber
    if (dRouter1 && dCoreFiber1) {
      addDirectCable(r.id, dRouter1.instanceId, 'ge0_0_0', r.id, dCoreFiber1.instanceId, 'sfp1', '#ef4444', 1.5);
      addDirectCable(r.id, dRouter2.instanceId, 'ge0_0_0', r.id, dCoreFiber2.instanceId, 'sfp1', '#ef4444', 1.5);
    }
    // Core Fiber Switch 1 <-> Core Fiber Switch 2 (Stack/Interconnect)
    if (dCoreFiber1 && dCoreFiber2) {
      addDirectCable(r.id, dCoreFiber1.instanceId, 'up1', r.id, dCoreFiber2.instanceId, 'up1', '#a855f7', 0.4);
      addDirectCable(r.id, dCoreFiber1.instanceId, 'up2', r.id, dCoreFiber2.instanceId, 'up2', '#a855f7', 0.4);
    }
    // Core 9300L -> Patch Panel
    if (dCore9300 && dPatch32) {
      addDirectCable(r.id, dPatch32.instanceId, 'pt1', r.id, dCore9300.instanceId, 'p1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch32.instanceId, 'pt2', r.id, dCore9300.instanceId, 'p2', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch32.instanceId, 'pt3', r.id, dCore9300.instanceId, 'p3', '#eab308', 0.3);
      addDirectCable(r.id, dPatch32.instanceId, 'pt4', r.id, dCore9300.instanceId, 'p4', '#22c55e', 0.3);
    }
    // 9200L -> Patch Panel 29
    if (dSwitch9200 && dPatch29) {
      addDirectCable(r.id, dPatch29.instanceId, 'pt1', r.id, dSwitch9200.instanceId, 'p1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch29.instanceId, 'pt2', r.id, dSwitch9200.instanceId, 'p2', '#2563eb', 0.3);
    }

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
  }

  function loadIdfPreset() {
    STATE.racks = [
      {
        id: 'rack-1',
        name: 'IDF-1 - Kat 1 Kenar Erişim Kabini',
        heightU: 42,
        units: Array(43).fill(null),
        devices: []
      }
    ];
    STATE.activeRackId = 'rack-1';
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.highlightedCableId = null;

    const r = STATE.racks[0];

    const dODF = mountDeviceAt('fiber-odf-24', 42, r.id);
    mountDeviceAt('organizer-1u', 41, r.id);
    const dPatch1 = mountDeviceAt('patch-cat6-24', 40, r.id);
    const dSwitchX1 = mountDeviceAt('cisco-2960x-24ps', 39, r.id);
    mountDeviceAt('organizer-1u', 38, r.id);
    const dPatch2 = mountDeviceAt('patch-cat6-24', 37, r.id);
    const dSwitchPC1 = mountDeviceAt('cisco-2960-24pc', 36, r.id);
    mountDeviceAt('organizer-2u', 35, r.id);
    const dPatch3 = mountDeviceAt('patch-cat6-48', 33, r.id);
    const dSwitchPC2 = mountDeviceAt('cisco-2960-24pc', 32, r.id);
    mountDeviceAt('organizer-1u', 31, r.id);
    const dSwitchTC = mountDeviceAt('cisco-2960-24tc', 30, r.id);
    mountDeviceAt('blank-panel-1u', 29, r.id);

    // ODF Uplink to 2960X SFP
    if (dODF && dSwitchX1) {
      addDirectCable(r.id, dODF.instanceId, 'lc1', r.id, dSwitchX1.instanceId, 'up1', '#06b6d4', 1.2);
    }
    // Patch 1 -> SwitchX1
    if (dPatch1 && dSwitchX1) {
      addDirectCable(r.id, dPatch1.instanceId, 'pt1', r.id, dSwitchX1.instanceId, 'p1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch1.instanceId, 'pt2', r.id, dSwitchX1.instanceId, 'p2', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch1.instanceId, 'pt3', r.id, dSwitchX1.instanceId, 'p3', '#eab308', 0.3);
      addDirectCable(r.id, dPatch1.instanceId, 'pt4', r.id, dSwitchX1.instanceId, 'p4', '#22c55e', 0.3);
    }
    // Patch 2 -> SwitchPC1
    if (dPatch2 && dSwitchPC1) {
      addDirectCable(r.id, dPatch2.instanceId, 'pt1', r.id, dSwitchPC1.instanceId, 'fa1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch2.instanceId, 'pt2', r.id, dSwitchPC1.instanceId, 'fa2', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch2.instanceId, 'pt3', r.id, dSwitchPC1.instanceId, 'fa3', '#eab308', 0.3);
    }
    // Patch 3 -> SwitchPC2
    if (dPatch3 && dSwitchPC2) {
      addDirectCable(r.id, dPatch3.instanceId, 'pt1', r.id, dSwitchPC2.instanceId, 'fa1', '#2563eb', 0.3);
      addDirectCable(r.id, dPatch3.instanceId, 'pt2', r.id, dSwitchPC2.instanceId, 'fa2', '#2563eb', 0.3);
    }

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
  }

  function loadFullSitePreset() {
    STATE.racks = [
      { id: 'rack-1', name: 'MDF - Ana Dağıtım & Omurga', heightU: 42,
        units: Array(43).fill(null), devices: [] },
      { id: 'rack-2', name: 'IDF-1 - Kat 1 Kenar Kabini', heightU: 42,
        units: Array(43).fill(null), devices: [] },
      { id: 'rack-3', name: 'IDF-2 - Kat 2 Kenar Kabini', heightU: 42,
        units: Array(43).fill(null), devices: [] }
    ];
    STATE.activeRackId = 'rack-1';
    STATE.cables = [];
    STATE.cableCounter = 0;
    STATE.rackCounter = 3;

    const r1 = STATE.racks[0];
    const r2 = STATE.racks[1];
    const r3 = STATE.racks[2];

    // --- POPULATE MDF (Rack 1) ---
    const mdfODF = mountDeviceAt('fiber-odf-24', 42, r1.id);
    mountDeviceAt('organizer-1u', 41, r1.id);
    const mdfRouter1 = mountDeviceAt('cisco-isr-4431', 40, r1.id);
    const mdfRouter2 = mountDeviceAt('cisco-isr-4431', 39, r1.id);
    mountDeviceAt('organizer-1u', 38, r1.id);
    const mdfFiber1 = mountDeviceAt('cisco-3850-24s', 37, r1.id);
    const mdfFiber2 = mountDeviceAt('cisco-3850-24s', 36, r1.id);
    mountDeviceAt('organizer-2u', 35, r1.id);
    const mdfCore9300 = mountDeviceAt('cisco-9300l-24p', 33, r1.id);
    const mdfPatch = mountDeviceAt('patch-cat6-24', 32, r1.id);

    // --- POPULATE IDF-1 (Rack 2) ---
    const idf1ODF = mountDeviceAt('fiber-odf-24', 42, r2.id);
    mountDeviceAt('organizer-1u', 41, r2.id);
    const idf1Patch1 = mountDeviceAt('patch-cat6-24', 40, r2.id);
    const idf1SwX = mountDeviceAt('cisco-2960x-24ps', 39, r2.id);
    mountDeviceAt('organizer-1u', 38, r2.id);
    const idf1Patch2 = mountDeviceAt('patch-cat6-24', 37, r2.id);
    const idf1SwPC = mountDeviceAt('cisco-2960-24pc', 36, r2.id);

    // --- POPULATE IDF-2 (Rack 3) ---
    const idf2ODF = mountDeviceAt('fiber-odf-24', 42, r3.id);
    mountDeviceAt('organizer-1u', 41, r3.id);
    const idf2Patch1 = mountDeviceAt('patch-cat6-24', 40, r3.id);
    const idf2SwXR = mountDeviceAt('cisco-2960xr-24ps', 39, r3.id);
    mountDeviceAt('organizer-1u', 38, r3.id);
    const idf2Patch2 = mountDeviceAt('patch-cat6-24', 37, r3.id);
    const idf2SwPC = mountDeviceAt('cisco-2960-24pc', 36, r3.id);

    // Intra-MDF Cabling
    addDirectCable(r1.id, mdfODF.instanceId, 'lc1', r1.id, mdfRouter1.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
    addDirectCable(r1.id, mdfODF.instanceId, 'lc2', r1.id, mdfRouter2.instanceId, 'ge0_0_2', '#06b6d4', 1.2);
    addDirectCable(r1.id, mdfRouter1.instanceId, 'ge0_0_0', r1.id, mdfFiber1.instanceId, 'sfp1', '#ef4444', 1.5);
    addDirectCable(r1.id, mdfRouter2.instanceId, 'ge0_0_0', r1.id, mdfFiber2.instanceId, 'sfp1', '#ef4444', 1.5);
    addDirectCable(r1.id, mdfPatch.instanceId, 'pt1', r1.id, mdfCore9300.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(r1.id, mdfPatch.instanceId, 'pt2', r1.id, mdfCore9300.instanceId, 'p2', '#2563eb', 0.3);

    // Intra-IDF1 Cabling
    addDirectCable(r2.id, idf1Patch1.instanceId, 'pt1', r2.id, idf1SwX.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(r2.id, idf1Patch1.instanceId, 'pt2', r2.id, idf1SwX.instanceId, 'p2', '#2563eb', 0.3);
    addDirectCable(r2.id, idf1Patch2.instanceId, 'pt1', r2.id, idf1SwPC.instanceId, 'fa1', '#2563eb', 0.3);

    // Intra-IDF2 Cabling
    addDirectCable(r3.id, idf2Patch1.instanceId, 'pt1', r3.id, idf2SwXR.instanceId, 'p1', '#2563eb', 0.3);
    addDirectCable(r3.id, idf2Patch2.instanceId, 'pt1', r3.id, idf2SwPC.instanceId, 'fa1', '#2563eb', 0.3);

    // INTER-RACK FIBER BACKBONE CABLES (MDF C3850-24S -> IDF-1 & IDF-2 ODF)
    addDirectCable(r1.id, mdfFiber1.instanceId, 'sfp5', r2.id, idf1ODF.instanceId, 'lc1', '#06b6d4', 45.0);
    addDirectCable(r1.id, mdfFiber2.instanceId, 'sfp5', r2.id, idf1ODF.instanceId, 'lc2', '#06b6d4', 45.0);
    addDirectCable(r1.id, mdfFiber1.instanceId, 'sfp6', r3.id, idf2ODF.instanceId, 'lc1', '#06b6d4', 75.0);
    addDirectCable(r1.id, mdfFiber2.instanceId, 'sfp6', r3.id, idf2ODF.instanceId, 'lc2', '#06b6d4', 75.0);

    renderRackTabs();
    renderMountedDevices();
    renderScheduleTable();
    setTimeout(renderAllCables, 50);
  }

  // --- APPLICATION MAIN WORKFLOW ---
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

  function mountDeviceFromAction(catalogKey, targetU, e) {
    if (!catalogKey) return false;
    const catalogItem = HARDWARE_CATALOG[catalogKey];
    if (!catalogItem) return false;
    const requiredU = catalogItem.u;
    const startU = targetU;
    const endU = targetU - requiredU + 1;

    if (endU < 1) {
      alert(`Bu cihaz ${requiredU}U yüksekliğinde. U${targetU} seviyesine sığmıyor.`);
      return false;
    }

    const activeRack = getActiveRack();
    if (!activeRack) return false;

    for (let u = endU; u <= startU; u++) {
      if (activeRack.units[u] !== null) {
        alert(`U${u} pozisyonu dolu! Lütfen boş bir slot seçin.`);
        return false;
      }
    }

    const mounted = mountDeviceAt(catalogKey, startU);
    renderRackTabs();
    renderMountedDevices();
    renderAllCables();
    if (window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
    }
    return !!mounted;
  }

  function handleSlotDoubleClick(targetU, e) {
    if (ZOOM_STATE.hasMoved || ZOOM_STATE.isPanning) return;
    if (!STATE.selectedLibraryItem) {
      showTemporaryTooltip(e.clientX, e.clientY, "Lütfen önce sol menüden monte edilecek bir donanım seçin veya sürükleyin!");
      return;
    }
    mountDeviceFromAction(STATE.selectedLibraryItem, targetU, e);
  }
  const handleSlotClick = handleSlotDoubleClick;

  function bindCatalogEvents() {
    const cards = document.querySelectorAll('.device-card');
    cards.forEach(card => {
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', (e) => {
        const devId = card.dataset.deviceId;
        if (!devId) return;
        window.__RACK_DRAGGED_DEVICE__ = devId;
        e.dataTransfer.setData('text/plain', devId);
        e.dataTransfer.setData('application/x-rack-device', devId);
        e.dataTransfer.effectAllowed = 'copy';
        card.classList.add('dragging');
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        window.__RACK_DRAGGED_DEVICE__ = null;
        highlightDropSlots(null, null, false);
      });
      card.addEventListener('click', () => {
        document.querySelectorAll('.device-card').forEach(c => c.classList.remove('active')); 
        const devId = card.dataset.deviceId;
        if (STATE.selectedLibraryItem === devId) {
          STATE.selectedLibraryItem = null;
          if (dom.statusSelectionText) {
            dom.statusSelectionText.textContent = 'Kütüphaneden bir donanım seçin veya kablolama yapın.';
          }
        } else {
          card.classList.add('active');
          STATE.selectedLibraryItem = devId;
          const item = HARDWARE_CATALOG[devId];
          if (dom.statusSelectionText && item) {
            dom.statusSelectionText.textContent = `Seçili: [${item.name}] (${item.u}U). Yerleştirmek için boş bir U yuvasına ÇİFT TIKLAYIN veya sürükleyip bırakın.`;
          }
        }
      });
    });
  }

  function bindColorSwatchEvents() {
    const swatches = document.querySelectorAll('.color-swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', () => {
        swatches.forEach(s => s.classList.remove('selected'));
        swatch.classList.add('selected');
        STATE.selectedCableColor = swatch.dataset.color;
      });
    });
  }

  function bindRoutingSelectorEvents() {
    if (dom.btnRouteStructured && dom.btnRouteDirect) {
      dom.btnRouteStructured.addEventListener('click', () => {
        dom.btnRouteStructured.classList.add('active');
        dom.btnRouteDirect.classList.remove('active');
        STATE.cableRoutingMode = 'structured';
        renderAllCables();
      });

      dom.btnRouteDirect.addEventListener('click', () => {
        dom.btnRouteDirect.classList.add('active');
        dom.btnRouteStructured.classList.remove('active');
        STATE.cableRoutingMode = 'direct';
        renderAllCables();
      });
    }

    if (dom.btnTidyCables) {
      dom.btnTidyCables.addEventListener('click', () => {
        renderAllCables();
        const orig = dom.btnTidyCables.textContent;
        dom.btnTidyCables.textContent = '✓ Düzenlendi';
        dom.btnTidyCables.style.color = '#22c55e';
        setTimeout(() => {
          dom.btnTidyCables.textContent = orig;
          dom.btnTidyCables.style.color = '';
        }, 1200);
      });
    }
  }

  function bindHeaderActionEvents() {
    if (dom.btnAddRack) {
      dom.btnAddRack.addEventListener('click', () => {
        const name = prompt("Yeni Kabin Adı (Örn: IDF-2 Kat 2):");
        if (name && name.trim()) {
          addNewRack(name.trim());
        }
      });
    }

    if (dom.btnRenameRack) {
      dom.btnRenameRack.addEventListener('click', () => renameActiveRack());
    }

    if (dom.btnPresetMdf) {
      dom.btnPresetMdf.addEventListener('click', () => {
        if (confirm("MDF Ana Dağıtım Kabini şablonu yüklensin mi? (Mevcut topoloji sıfırlanır)")) {
          loadMdfPreset();
        }
      });
    }

    if (dom.btnPresetIdf) {
      dom.btnPresetIdf.addEventListener('click', () => {
        if (confirm("IDF Kat Kenar Kabini şablonu yüklensin mi? (Mevcut topoloji sıfırlanır)")) {
          loadIdfPreset();
        }
      });
    }

    if (dom.btnPresetSite) {
      dom.btnPresetSite.addEventListener('click', () => {
        if (confirm("Tüm Saha Topolojisi (MDF + IDF-1 + IDF-2 Çoklu Kabin) yüklensin mi?")) {
          loadFullSitePreset();
        }
      });
    }

    if (dom.btnClearAll) {
      dom.btnClearAll.addEventListener('click', () => {
        if (confirm("Tüm kabinler, cihazlar ve kablolar sıfırlanacaktır. Onaylıyor musunuz?")) {
          STATE.racks = [
            { id: 'rack-1', name: 'MDF - Dağıtım Kabini', heightU: 42,
        units: Array(43).fill(null), devices: [] }
          ];
          STATE.activeRackId = 'rack-1';
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
      dom.btnClearCables.addEventListener('click', () => {
        if (confirm("Tüm kabloları silmek istiyor musunuz?")) {
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
      dom.btnExportJson.addEventListener('click', () => exportJson());
    }

    if (dom.btnImportJson) {
      dom.btnImportJson.addEventListener('click', () => {
        if (dom.fileImport) dom.fileImport.click();
      });
    }

    if (dom.fileImport) {
      dom.fileImport.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target.result);
            loadCustomTopology(parsed);
          } catch (err) {
            alert("JSON dosyası okunurken hata oluştu: " + err.message);
          }
        };
        reader.readAsText(file);
        dom.fileImport.value = '';
      });
    }

    if (dom.btnExportVisio) {
      dom.btnExportVisio.addEventListener('click', () => exportVisioSvg());
    }
  }

  function bindGlobalEvents() {
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.port')) {
        cancelPendingConnection();
      }
    });

    window.addEventListener('resize', () => {
      if (ZOOM_STATE.isFit) {
        fitRackToScreen(false);
      }
      renderAllCables();
    });

    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === '+' || e.key === '=') {
        setZoom(ZOOM_STATE.scale * 1.2, undefined, undefined, true);
      } else if (e.key === '-' || e.key === '_') {
        setZoom(ZOOM_STATE.scale / 1.2, undefined, undefined, true);
      } else if (e.key === '0') {
        setZoom(1.0, undefined, undefined, true);
      } else if (e.key === 'f' || e.key === 'F') {
        fitRackToScreen(true);
      } else if (e.key === 'Escape') {
        cancelPendingConnection();
      }
    });
  }

  function showTemporaryTooltip(x, y, msg) {
    if (!dom.tooltip) return;
    dom.tooltip.style.display = 'block';
    dom.tooltip.style.left = `${x + 10}px`;
    dom.tooltip.style.top = `${y + 10}px`;
    dom.tooltip.innerHTML = `<span style="color:#f59e0b;">&#9888; ${msg}</span>`;
    setTimeout(() => { if (dom.tooltip) dom.tooltip.style.display = 'none'; }, 2500);
  }

  function updatePortConfig(instanceId, portId, config) {
    const activeRack = getActiveRack();
    if (!activeRack) return false;
    const dev = activeRack.devices.find(d => d.instanceId === instanceId);
    if (!dev) return false;
    if (!dev.portsConfig) dev.portsConfig = {};
    if (!config || (config.role === 'access' && !config.ciscoName && !config.vlan && !config.description && !config.color)) {
      delete dev.portsConfig[portId];
      delete dev.portsConfig[String(portId).replace('p', '')];
    } else {
      const role = config.role || 'trunk';
      const defaultRoleColors = {
        trunk: '#a855f7',
        uplink: '#00d2ff',
        poe: '#f59e0b',
        mgmt: '#10b981',
        management: '#10b981',
        access: '#3b82f6'
      };
      const resolvedColor = config.color || defaultRoleColors[role] || '#a855f7';
      dev.portsConfig[portId] = {
        role: role,
        isTrunk: role === 'trunk' || config.isTrunk === true,
        color: resolvedColor,
        ciscoName: config.ciscoName || '',
        vlan: config.vlan || '',
        description: config.description || '',
        autoCableColor: config.autoCableColor !== false
      };
    }
    renderMountedDevices();
    renderScheduleTable();
    renderAllCables();
    window.dispatchEvent(new CustomEvent('rackstudio:refresh'));
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
    fit: fitRackToScreen,
    mountDeviceAt,
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

  // Automatic init on DOM ready or immediate if already loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
