// ============================================================================
// Cisco Hardware Catalog - Complete Field Inventory
// ============================================================================

export const HARDWARE_CATALOG = {
  // --- WAN & ROUTERS ---
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

  // --- FIBER DISTRIBUTION & CORE ---
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

  // --- ACCESS SWITCHES (PoE+ GIGABIT) ---
  'cisco-2960x-24ps': {
    name: 'Cisco Catalyst 2960X-24PS-L',
    u: 1,
    category: 'switch',
    logo: 'CISCO',
    modelTag: '2960X-24PS-L (PoE+)',
    desc: '24x Gigabit RJ45 PoE+ (370W) ve 4x 1G SFP Uplink yuvası.',
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
    desc: 'StackWise-320 destekli Kenar Switch, 24x 1G PoE+ (505W), 4x 10G SFP+ Uplink.',
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

  // --- ACCESS SWITCHES (FAST ETHERNET / POE & NON-POE) ---
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

  // --- COMPACT SWITCHES ---
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

  // --- STRUCTURED CABLING & PANELS ---
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

  // --- CABLE MANAGEMENT & ACCESSORIES ---
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
  },
  'blank-panel-2u': {
    name: '2U Boşluk Kapatma Paneli',
    u: 2,
    category: 'blank',
    logo: 'BLANK',
    modelTag: '2U BLANKING PANEL',
    desc: 'Hava akışını yönlendirmek ve boş U yuvalarını kapatmak için 2U kör panel.',
    ports: []
  },

  // --- 3D CATALOG MODELS & ALIASES ---
  'cisco-c9300-48p': {
    name: 'Cisco Catalyst 9300-48P',
    u: 1,
    category: 'switch',
    logo: 'CISCO',
    modelTag: 'C9300-48P',
    desc: '48x 1G PoE+ (437W) + 4x 10G SFP+ Uplink, Ağ Dağıtım Omurgası.',
    powerWatts: 715,
    ports: [
      ...Array.from({ length: 48 }, (_, i) => ({
        id: `ge${i + 1}`,
        name: `1G-${String(i + 1).padStart(2, '0')}`,
        type: 'rj45',
        group: Math.floor(i / 12),
        row: (i % 2 === 0) ? 0 : 1,
        speed: '1G PoE+ Access'
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `up${i + 1}`,
        name: `10G-UP-${i + 1}`,
        type: 'sfp',
        group: 4,
        row: 0,
        speed: '10G SFP+ Uplink'
      }))
    ]
  },
  'cisco-c9500-32qc': {
    name: 'Cisco Catalyst 9500-32QC',
    u: 1,
    category: 'switch',
    logo: 'CISCO',
    modelTag: 'C9500-32QC',
    desc: '32x 100G/40G QSFP28 Yüksek Hızlı Veri Merkezi Spine Switch.',
    powerWatts: 950,
    ports: Array.from({ length: 32 }, (_, i) => ({
      id: `qsfp${i + 1}`,
      name: `100G-${String(i + 1).padStart(2, '0')}`,
      type: 'qsfp28',
      group: Math.floor(i / 8),
      row: (i % 2 === 0) ? 0 : 1,
      speed: '100G QSFP28 Spine'
    }))
  },
  'cisco-nexus-9336c': {
    name: 'Cisco Nexus 9336C-FX2',
    u: 1,
    category: 'switch',
    logo: 'CISCO',
    modelTag: 'N9K-C9336C-FX2',
    desc: '36x 40/100G Cloud Scale Nexus Spine/Leaf Switch.',
    powerWatts: 850,
    ports: Array.from({ length: 36 }, (_, i) => ({
      id: `qsfp${i + 1}`,
      name: `100G-${String(i + 1).padStart(2, '0')}`,
      type: 'qsfp28',
      group: Math.floor(i / 6),
      row: (i % 2 === 0) ? 0 : 1,
      speed: '100G QSFP28 Leaf'
    }))
  },
  'cisco-isr4451': {
    name: 'Cisco ISR 4451-X Router',
    u: 2,
    category: 'router',
    logo: 'CISCO',
    modelTag: 'ISR 4451-X',
    desc: '2U Kurumsal WAN Uç Birim Router (Dual NIM + SM-X).',
    powerWatts: 450,
    ports: [
      ...Array.from({ length: 8 }, (_, i) => ({
        id: `ge${i + 1}`,
        name: `GE-${i + 1}`,
        type: 'rj45',
        group: Math.floor(i / 4),
        row: (i % 2 === 0) ? 0 : 1,
        speed: '1G WAN'
      })),
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `sfp${i + 1}`,
        name: `SFP-${i + 1}`,
        type: 'sfp',
        group: 2,
        row: 0,
        speed: '10G Fiber WAN'
      }))
    ]
  },
  'dell-r750': {
    name: 'Dell PowerEdge R750',
    u: 2,
    category: 'server',
    logo: 'DELL',
    modelTag: 'R750 RACK SERVER',
    desc: '2U Dual Xeon Enterprise Rack Sunucu (24x 2.5" NVMe/SAS).',
    powerWatts: 1400,
    ports: [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `nic${i + 1}`,
        name: `NIC-${i + 1}`,
        type: 'rj45',
        group: 0,
        row: 0,
        speed: '10G Base-T'
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `sfp${i + 1}`,
        name: `SFP-${i + 1}`,
        type: 'sfp',
        group: 1,
        row: 0,
        speed: '25G SFP28'
      }))
    ]
  },
  'hpe-dl380-g10': {
    name: 'HPE ProLiant DL380 Gen10',
    u: 2,
    category: 'server',
    logo: 'HPE',
    modelTag: 'DL380 GEN10',
    desc: '2U 2P Güvenli ve Esnek Endüstri Standardı Sanallaştırma Sunucusu.',
    powerWatts: 1200,
    ports: [
      ...Array.from({ length: 4 }, (_, i) => ({
        id: `nic${i + 1}`,
        name: `NIC-${i + 1}`,
        type: 'rj45',
        group: 0,
        row: 0,
        speed: '10G Base-T'
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        id: `sfp${i + 1}`,
        name: `SFP-${i + 1}`,
        type: 'sfp',
        group: 1,
        row: 0,
        speed: '25G SFP28'
      }))
    ]
  },
  'patch-cat6a-24p': {
    name: 'Cat6A 24-Port Patch Panel',
    u: 1,
    category: 'patch-panel',
    logo: 'CAT6A',
    modelTag: '24P CAT6A STP',
    desc: '10 Gigabit Ethernet destekli korumalı (STP) 1U 24 port patch panel.',
    powerWatts: 0,
    ports: Array.from({ length: 24 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `PP-${String(i + 1).padStart(2, '0')}`,
      type: 'rj45',
      group: Math.floor(i / 6),
      row: (i % 2 === 0) ? 0 : 1,
      speed: 'Cat6A 10G'
    }))
  },
  'patch-cat6-48p': {
    name: 'Cat6 48-Port Patch Panel',
    u: 2,
    category: 'patch-panel',
    logo: 'CAT6',
    modelTag: '48P CAT6 UTP',
    desc: '2U yüksek yoğunluklu 48 port Cat6 RJ45 patch panel.',
    powerWatts: 0,
    ports: Array.from({ length: 48 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `PP-${String(i + 1).padStart(2, '0')}`,
      type: 'rj45',
      group: Math.floor(i / 12),
      row: (i % 2 === 0) ? 0 : 1,
      speed: 'Cat6 1G'
    }))
  },
  'cable-manager-1u': {
    name: '1U Yatay Kablo Düzenleyici Panel',
    u: 1,
    category: 'organizer',
    logo: 'ORGANIZER',
    modelTag: '1U CABLE MANAGEMENT',
    desc: '19" 1U kapaklı yatay kablo düzenleme paneli.',
    powerWatts: 0,
    ports: []
  },
  'cable-manager-2u': {
    name: '2U Parmak Tipi Kablo Düzenleyici',
    u: 2,
    category: 'organizer',
    logo: 'ORGANIZER',
    modelTag: '2U FINGER DUCT',
    desc: '19" 2U yüksek kapasiteli kablo düzenleme paneli.',
    powerWatts: 0,
    ports: []
  },
  'blanking-panel-1u': {
    name: '1U Boşluk Kapatma Kör Panel',
    u: 1,
    category: 'blank',
    logo: 'BLANK',
    modelTag: '1U BLANKING PANEL',
    desc: 'Hava akışı sızdırmazlığı sağlayan 1U kör kapama paneli.',
    powerWatts: 0,
    ports: []
  },
  'blanking-panel-2u': {
    name: '2U Boşluk Kapatma Kör Panel',
    u: 2,
    category: 'blank',
    logo: 'BLANK',
    modelTag: '2U BLANKING PANEL',
    desc: 'Hava akışı sızdırmazlığı sağlayan 2U kör kapama paneli.',
    powerWatts: 0,
    ports: []
  },
  'pdu-1u-8c13': {
    name: '1U 8x C13 Raf Tipi PDU',
    u: 1,
    category: 'pdu',
    logo: 'PDU',
    modelTag: '1U 8xC13 METERED PDU',
    desc: '8 Adet IEC-C13 çıkışlı 16A 1U yatay rack PDU.',
    powerWatts: 25,
    ports: Array.from({ length: 8 }, (_, i) => ({
      id: `c13_${i + 1}`,
      name: `C13-${i + 1}`,
      type: 'c13',
      group: Math.floor(i / 4),
      row: 0,
      speed: '230V 10A Out'
    }))
  },
  'pdu-vertical-0u': {
    name: '0U 24x C13 Dikey Rack PDU',
    u: 1,
    category: 'pdu',
    logo: 'PDU',
    modelTag: '0U 24xC13 VERTICAL PDU',
    desc: 'Kabin arka dikmesine monte edilen 24 çıkışlı akıllı dikey PDU.',
    powerWatts: 45,
    ports: Array.from({ length: 24 }, (_, i) => ({
      id: `c13_${i + 1}`,
      name: `C13-${i + 1}`,
      type: 'c13',
      group: Math.floor(i / 6),
      row: 0,
      speed: '230V 10A Out'
    }))
  }
};

// Aliases for 2D/3D cross-compatibility
HARDWARE_CATALOG['cable-org-1u'] = HARDWARE_CATALOG['cable-manager-1u'];
HARDWARE_CATALOG['cable-org-2u'] = HARDWARE_CATALOG['cable-manager-2u'];
HARDWARE_CATALOG['blank-panel-2u'] = HARDWARE_CATALOG['blanking-panel-2u'];
HARDWARE_CATALOG['apc-pdu-1u'] = HARDWARE_CATALOG['pdu-1u-8c13'];
HARDWARE_CATALOG['apc-pdu-vert'] = HARDWARE_CATALOG['pdu-vertical-0u'];
HARDWARE_CATALOG['dell-r740'] = HARDWARE_CATALOG['dell-r750'];

// Dynamic Proxy Fallback: if a key is not found (e.g. custom wizard device), provide a rich valid definition
export const getSafeCatalogItem = (key) => {
  if (HARDWARE_CATALOG[key]) return HARDWARE_CATALOG[key];
  return {
    name: (key || 'Custom Device').replace(/-/g, ' ').toUpperCase(),
    u: 1,
    category: 'switch',
    logo: 'CUSTOM',
    modelTag: (key || 'DEV').toUpperCase(),
    desc: 'Kullanıcı tanımlı veya içe aktarılmış donanım bileşeni.',
    powerWatts: 150,
    ports: Array.from({ length: 24 }, (_, i) => ({
      id: `p${i + 1}`,
      name: `Port-${i + 1}`,
      type: 'rj45',
      group: Math.floor(i / 6),
      row: (i % 2 === 0) ? 0 : 1,
      speed: '1G'
    }))
  };
};
