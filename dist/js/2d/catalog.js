/**
 * Cisco Enterprise Rack & Cabling Studio - Hardware Catalog Specifications
 */
(function () {
  'use strict';

  const RS = window.RackStudio = window.RackStudio || {};

  const HARDWARE_CATALOG = {
    // 1. WAN & ROUTER
    'cisco-isr-4431': {
      name: 'Cisco ISR 4431/K9 Router',
      u: 1,
      category: 'router',
      logo: 'CISCO',
      series: 'isr',
      modelTag: 'ISR 4431 WAN ROUTER',
      powerWatts: 250,
      heatBtu: 853,
      desc: 'Kurumsal WAN & İnternet Yönlendiricisi, 4x Dahili GE/SFP Portu (GE0/0/0 - GE0/0/3), 1x Dedicated OOB Mgmt0, 3x NIM Yuvası, Çift Güç Kaynağı.',
      ports: [
        { id: 'ge0_0_0', name: 'GE0/0/0', type: 'rj45', group: 0, row: 0, speed: '10/100/1000 Gigabit WAN (Bakır)' },
        { id: 'ge0_0_1', name: 'GE0/0/1', type: 'rj45', group: 0, row: 1, speed: '10/100/1000 Gigabit WAN (Bakır)' },
        { id: 'ge0_0_2', name: 'GE0/0/2', type: 'sfp', group: 1, row: 0, speed: '1G SFP Fiber WAN' },
        { id: 'ge0_0_3', name: 'GE0/0/3', type: 'sfp', group: 1, row: 1, speed: '1G SFP Fiber WAN' },
        { id: 'mgmt0', name: 'Mgmt0', type: 'rj45', group: 2, row: 0, speed: '10/100/1000 OOB Yönetim Portu' }
      ]
    },

    // 2. FIBER DISTRIBUTION & OMURGA
    'cisco-3850-24s': {
      name: 'Cisco Catalyst 3850-24S-S',
      u: 1,
      category: 'fiber-switch',
      logo: 'CISCO',
      series: 'cat3k',
      modelTag: 'WS-C3850-24S-S',
      powerWatts: 350,
      heatBtu: 1194,
      desc: '24 Port SFP 1G Fiber Omurga/Toplama Switchi (Gi1/0/1 - Gi1/0/24), 4x 10G SFP+ Modüler Ağ Modülü (Te1/1/1 - Te1/1/4).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `sfp${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'sfp',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G SFP Fiber (IDF Toplama)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10G SFP+ 10Gbps Uplink'
        }))
      ]
    },
    'cisco-nexus-93180yc': {
      name: 'Cisco Nexus 93180YC-FX',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'nexus',
      modelTag: 'N9K-C93180YC-FX',
      powerWatts: 450,
      heatBtu: 1535,
      desc: 'Veri merkezi ToR switch, 48x 10/25G SFP28 (Eth1/1 - Eth1/48) ve 6x 40/100G QSFP28 omurga portu (Eth1/49 - Eth1/54).',
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `eth1_${i + 1}`,
          name: `Eth1/${i + 1}`,
          type: 'sfp',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '25G SFP28 ToR'
        })),
        ...Array.from({ length: 6 }, (_, i) => ({
          id: `eth1_${i + 49}`,
          name: `Eth1/${i + 49}`,
          type: 'sfp',
          group: 4,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '100G QSFP28 Spine'
        }))
      ]
    },
    'cisco-9500-24y4c': {
      name: 'Cisco Catalyst 9500-24Y4C',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat9k',
      modelTag: 'C9500-24Y4C',
      powerWatts: 950,
      heatBtu: 3241,
      desc: 'Kampüs çekirdek omurga, 24x 1/10/25G SFP28 (25GE1/0/1 - 25GE1/0/24) ve 4x 40/100G QSFP28 uplink (100GE1/0/25 - 100GE1/0/28).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `25GE1/0/${i + 1}`,
          type: 'sfp',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '25G SFP28 Core'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `100GE1/0/${i + 25}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '100G QSFP28 Core Uplink'
        }))
      ]
    },

    // 3. GIGABIT POE+ ACCESS SWITCHES
    'cisco-2960x-24ps': {
      name: 'Cisco Catalyst 2960X-24PS-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat2960x',
      modelTag: 'WS-C2960X-24PS-L',
      powerWatts: 450,
      heatBtu: 1535,
      desc: '24x 10/100/1000 Gigabit RJ45 PoE+ (370W, Gi1/0/1 - Gi1/0/24) ve 4x 1G SFP Uplink (Gi1/0/25 - Gi1/0/28). Sahada 55 adet.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit PoE+ (30W)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Gi1/0/${i + 25}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G SFP Fiber Uplink'
        }))
      ]
    },
    'cisco-2960x-24ts': {
      name: 'Cisco Catalyst 2960-X 24TS-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat2960x',
      modelTag: 'WS-C2960X-24TS-L',
      powerWatts: 45,
      heatBtu: 153,
      desc: '24x 10/100/1000 Gigabit Data RJ45 (Gi1/0/1 - Gi1/0/24), 4x 1G SFP Uplink (Gi1/0/25 - Gi1/0/28).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit Data'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Gi1/0/${i + 25}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G SFP Fiber Uplink'
        }))
      ]
    },
    'cisco-2960xr-24ps': {
      name: 'Cisco Catalyst 2960XR-24PS-I',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat2960x',
      modelTag: 'WS-C2960XR-24PS-I',
      powerWatts: 450,
      heatBtu: 1535,
      desc: 'L3 Kurumsal Kenar, 24x Gigabit PoE+ (370W, Gi1/0/1 - Gi1/0/24), 2x 10G SFP+ Uplink (Te1/0/25 - Te1/0/26), Çift Yedekli Güç Kaynağı.',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit PoE+'
        })),
        { id: 'up1', name: 'Te1/0/25', type: 'sfp', group: 2, row: 0, speed: '10G SFP+ 10Gbps Uplink' },
        { id: 'up2', name: 'Te1/0/26', type: 'sfp', group: 2, row: 1, speed: '10G SFP+ 10Gbps Uplink' }
      ]
    },
    'cisco-9200l-24p': {
      name: 'Cisco Catalyst 9200L-24P-4X',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat9k',
      modelTag: 'C9200L-24P-4X',
      powerWatts: 450,
      heatBtu: 1535,
      desc: 'Yeni Nesil Kurumsal Kenar, 24x Gigabit PoE+ (370W, Gi1/0/1 - Gi1/0/24), 4x 10G SFP+ Sabit Uplink (Te1/1/1 - Te1/1/4).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit PoE+ (30W)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10G SFP+ 10Gbps Uplink'
        }))
      ]
    },
    'cisco-9300l-24p': {
      name: 'Cisco Catalyst 9300L-24P-4X',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat9k',
      modelTag: 'C9300L-24P-4X',
      powerWatts: 505,
      heatBtu: 1723,
      desc: 'StackWise-320 destekli Kenar Switch, 24x 1G PoE+ (505W UPOE, Gi1/0/1 - Gi1/0/24), 4x 10G SFP+ Sabit Uplink (Te1/1/1 - Te1/1/4).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit PoE+ UPOE'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10G SFP+ 10Gbps Uplink'
        }))
      ]
    },
    'cisco-9300-48u': {
      name: 'Cisco Catalyst 9300X-48HX',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat9k',
      modelTag: 'C9300X-48HX UPOE+',
      powerWatts: 1100,
      heatBtu: 3753,
      desc: 'StackWise-1T, 48x Multigigabit 10G UPOE+ (90W, Te1/0/1 - Te1/0/48), Modüler 4x 25G SFP28 Uplink (Twe1/1/1 - Twe1/1/4).',
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Te1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '100M/1G/2.5G/5G/10G mGig UPOE+ (90W)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Twe1/1/${i + 1}`,
          type: 'sfp',
          group: 4,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '25G/10G SFP28 Uplink'
        }))
      ]
    },
    'cisco-1000-24p': {
      name: 'Cisco Catalyst 1000-24P-4G-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat1k',
      modelTag: 'C1000-24P-4G-L',
      powerWatts: 240,
      heatBtu: 818,
      desc: '24x 10/100/1000 Gigabit PoE+ (195W, Gi1/0/1 - Gi1/0/24), 4x 1G SFP Sabit Uplink (Gi1/0/25 - Gi1/0/28).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit PoE+ (195W)'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Gi1/0/${i + 25}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '1G SFP Fiber Uplink'
        }))
      ]
    },

    // 4. FAST ETHERNET & SAHA SWITCHLERİ
    'cisco-2960-24pc': {
      name: 'Cisco Catalyst 2960-24PC-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat2960',
      modelTag: 'WS-C2960-24PC-L (PoE)',
      powerWatts: 450,
      heatBtu: 1535,
      desc: 'Sahada en yaygın model (133 Adet). 24x 10/100 PoE (370W, Fa0/1 - Fa0/24), 2x Dual-Purpose 1G Gigabit/SFP uplink (Gi0/1 - Gi0/2).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 Mbps FastEthernet PoE (15.4W)'
        })),
        { id: 'up1', name: 'Gi0/1 (RJ45)', type: 'rj45', group: 2, row: 0, speed: '10/100/1000 Gigabit Dual-Purpose Bakır' },
        { id: 'up2', name: 'Gi0/2 (RJ45)', type: 'rj45', group: 2, row: 1, speed: '10/100/1000 Gigabit Dual-Purpose Bakır' },
        { id: 'sfp1', name: 'Gi0/1 (SFP)', type: 'sfp', group: 3, row: 0, speed: '1G SFP Dual-Purpose Fiber' },
        { id: 'sfp2', name: 'Gi0/2 (SFP)', type: 'sfp', group: 3, row: 1, speed: '1G SFP Dual-Purpose Fiber' }
      ]
    },
    'cisco-2960-24tc': {
      name: 'Cisco Catalyst 2960-24TC-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat2960',
      modelTag: 'WS-C2960-24TC-L',
      powerWatts: 45,
      heatBtu: 153,
      desc: '24x 10/100 Mbps RJ45 (PoE Yok, Fa0/1 - Fa0/24), 2x Dual-Purpose 1G Gigabit/SFP uplink (Gi0/1 - Gi0/2).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 Mbps 100Base-TX'
        })),
        { id: 'up1', name: 'Gi0/1 (RJ45)', type: 'rj45', group: 2, row: 0, speed: '10/100/1000 Gigabit Dual-Purpose Bakır' },
        { id: 'up2', name: 'Gi0/2 (RJ45)', type: 'rj45', group: 2, row: 1, speed: '10/100/1000 Gigabit Dual-Purpose Bakır' },
        { id: 'sfp1', name: 'Gi0/1 (SFP)', type: 'sfp', group: 3, row: 0, speed: '1G SFP Dual-Purpose Fiber' },
        { id: 'sfp2', name: 'Gi0/2 (SFP)', type: 'sfp', group: 3, row: 1, speed: '1G SFP Dual-Purpose Fiber' }
      ]
    },
    'cisco-2960-48tc': {
      name: 'Cisco Catalyst 2960-48TC-L',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat2960',
      modelTag: 'WS-C2960-48TC-L (48P)',
      powerWatts: 60,
      heatBtu: 205,
      desc: '48x 10/100 Mbps RJ45 (Fa0/1 - Fa0/48), 2x 10/100/1000 Gigabit RJ45 (Gi0/1 - Gi0/2) ve 2x 1G SFP uplink (Gi0/3 - Gi0/4).',
      ports: [
        ...Array.from({ length: 48 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 Mbps 100Base-TX'
        })),
        { id: 'up1', name: 'Gi0/1', type: 'rj45', group: 4, row: 0, speed: '10/100/1000 Gigabit RJ45' },
        { id: 'up2', name: 'Gi0/2', type: 'rj45', group: 4, row: 1, speed: '10/100/1000 Gigabit RJ45' },
        { id: 'sfp1', name: 'Gi0/3', type: 'sfp', group: 5, row: 0, speed: '1G SFP Fiber' },
        { id: 'sfp2', name: 'Gi0/4', type: 'sfp', group: 5, row: 1, speed: '1G SFP Fiber' }
      ]
    },
    'cisco-3560x-24t': {
      name: 'Cisco Catalyst 3560X-24T-S',
      u: 1,
      category: 'switch',
      logo: 'CISCO',
      series: 'cat3k',
      modelTag: 'WS-C3560X-24T-S',
      powerWatts: 350,
      heatBtu: 1194,
      desc: '24x Gigabit 10/100/1000 RJ45 (Gi1/0/1 - Gi1/0/24), Modüler Ağ Modülü (4x 10G/1G SFP+ Te1/1/1 - Te1/1/4).',
      ports: [
        ...Array.from({ length: 24 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: Math.floor(i / 12),
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit RJ45'
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          id: `up${i + 1}`,
          name: `Te1/1/${i + 1}`,
          type: 'sfp',
          group: 2,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10G/1G SFP+ Uplink'
        }))
      ]
    },

    // 5. COMPACT SWITCHES
    'cisco-3560-8pc': {
      name: 'Cisco Catalyst 3560-8PC-S',
      u: 1,
      category: 'compact',
      logo: 'CISCO',
      series: 'compact',
      modelTag: 'WS-C3560-8PC-S',
      powerWatts: 154,
      heatBtu: 525,
      desc: '8x 10/100 PoE (123W, Fa0/1 - Fa0/8) + 1x Dual-Purpose 1G Gigabit/SFP uplink (Gi0/1).',
      ports: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `fa${i + 1}`,
          name: `Fa0/${i + 1}`,
          type: 'rj45',
          group: 0,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100 PoE (15.4W)'
        })),
        { id: 'up1', name: 'Gi0/1 Dual', type: 'rj45', group: 1, row: 0, speed: '1G RJ45 / SFP Dual-Purpose' }
      ]
    },
    'cisco-2960cx-8pc': {
      name: 'Cisco Catalyst 2960CX-8PC-L',
      u: 1,
      category: 'compact',
      logo: 'CISCO',
      series: 'compact',
      modelTag: 'WS-C2960CX-8PC-L',
      powerWatts: 280,
      heatBtu: 955,
      desc: '8x Gigabit PoE+ (240W, Gi1/0/1 - Gi1/0/8) + 2x 1G Bakır Uplink (Gi1/0/9 - Gi1/0/10) + 2x 1G SFP Portu (Gi1/0/11 - Gi1/0/12).',
      ports: [
        ...Array.from({ length: 8 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi1/0/${i + 1}`,
          type: 'rj45',
          group: 0,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit PoE+'
        })),
        { id: 'up_cu1', name: 'Gi1/0/9', type: 'rj45', group: 1, row: 0, speed: '1G Copper Uplink' },
        { id: 'up_cu2', name: 'Gi1/0/10', type: 'rj45', group: 1, row: 1, speed: '1G Copper Uplink' },
        { id: 'up_sfp1', name: 'Gi1/0/11', type: 'sfp', group: 2, row: 0, speed: '1G SFP Fiber Uplink' },
        { id: 'up_sfp2', name: 'Gi1/0/12', type: 'sfp', group: 2, row: 1, speed: '1G SFP Fiber Uplink' }
      ]
    },
    'cisco-2960g-8tc': {
      name: 'Cisco Catalyst 2960G-8TC-L',
      u: 1,
      category: 'compact',
      logo: 'CISCO',
      series: 'compact',
      modelTag: 'WS-C2960G-8TC-L',
      powerWatts: 45,
      heatBtu: 153,
      desc: '7x 10/100/1000 Gigabit RJ45 (Gi0/1 - Gi0/7) + 1x Dual-Purpose 1G Gigabit/SFP yuvası (Gi0/8).',
      ports: [
        ...Array.from({ length: 7 }, (_, i) => ({
          id: `p${i + 1}`,
          name: `Gi0/${i + 1}`,
          type: 'rj45',
          group: 0,
          row: (i % 2 === 0) ? 0 : 1,
          speed: '10/100/1000 Gigabit RJ45'
        })),
        { id: 'up1', name: 'Gi0/8 Dual', type: 'rj45', group: 1, row: 0, speed: '1G RJ45 / SFP Dual-Purpose' }
      ]
    },

    // 6. STRUCTURED CABLING & PANELS
    'patch-cat6-24': {
      name: 'Cat6A 24-Port Patch Panel',
      u: 1,
      category: 'patch',
      logo: 'PANEL',
      modelTag: 'CAT6A 24P-UTP',
      powerWatts: 0,
      heatBtu: 0,
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
      powerWatts: 0,
      heatBtu: 0,
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
      powerWatts: 0,
      heatBtu: 0,
      desc: 'Veri merkezi OM4 LC Duplex çok modlu (Aqua) fiber optik sonlandırma çekmecesi (48 Core).',
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `lc${i + 1}`,
        name: `LC-${String(i + 1).padStart(2, '0')}`,
        type: 'lc',
        group: Math.floor(i / 4),
        row: 0,
        speed: '100G MultiMode OM4'
      }))
    },
    'fiber-odf-24-os2': {
      name: '24-Port OS2 Singlemode Fiber Paneli (ODF)',
      u: 1,
      category: 'fiber',
      logo: 'FIBER ODF',
      modelTag: 'OS2 LC-DUPLEX',
      powerWatts: 0,
      heatBtu: 0,
      desc: '19" 1U OS2 Single Mode (9/125µm) LC Duplex mavi adaptörlü fiber optik sonlandırma çekmecesi (48 Core).',
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `lc${i + 1}`,
        name: `LC-${String(i + 1).padStart(2, '0')}`,
        type: 'lc',
        group: Math.floor(i / 4),
        row: 0,
        speed: '100G SingleMode OS2 (UPC)'
      }))
    },
    'fiber-odf-24-sc': {
      name: '24-Port OS2 SC Duplex Fiber Paneli (ODF)',
      u: 1,
      category: 'fiber',
      logo: 'SC ODF',
      modelTag: 'OS2 SC-DUPLEX',
      powerWatts: 0,
      heatBtu: 0,
      desc: '19" 1U 24-Port SC Duplex Single Mode fiber dağıtım paneli, push-pull mavi adaptör yuvalı (48 Core).',
      ports: Array.from({ length: 24 }, (_, i) => ({
        id: `sc${i + 1}`,
        name: `SC-${String(i + 1).padStart(2, '0')}`,
        type: 'sc',
        group: Math.floor(i / 4),
        row: 0,
        speed: '10G/100G SingleMode OS2 SC'
      }))
    },
    'hcs-datalight-24': {
      name: 'HCS DataLight Fiber Patch Panel',
      u: 1,
      category: 'fiber',
      logo: 'HCS',
      modelTag: 'HCS-DATALIGHT-24',
      powerWatts: 0,
      heatBtu: 0,
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
    'pdu-8port-1u': {
      name: '1U 8-Soketli Rack Montajlı PDU',
      u: 1,
      category: 'pdu',
      logo: 'PDU',
      modelTag: '1U 8x SCHUKO PDU',
      powerWatts: 0,
      heatBtu: 0,
      maxWatts: 3680,
      maxAmps: 16,
      desc: '19" 1U 16A 250V 8 soketli Schuko tip güç dağıtım ünitesi, ışıklı açma/kapama şalteri ve aşırı akım sigortalı.',
      ports: Array.from({ length: 8 }, (_, i) => ({
        id: `pwr${i + 1}`,
        name: `Priz ${i + 1}`,
        type: 'power',
        group: Math.floor(i / 4),
        row: 0,
        speed: '230V 16A 50Hz AC'
      }))
    },

    // 7. CABLE MANAGEMENT & BLANKING
    'organizer-1u': {
      name: '1U Fırçalı Yatay Düzenleyici',
      u: 1,
      category: 'organizer',
      logo: 'ORGANIZER',
      modelTag: '1U HORIZONTAL BRUSH',
      powerWatts: 0,
      heatBtu: 0,
      desc: 'Hava sızdırmaz fırçalı tip, patch kabloları gizleyen 1U yatay kablo tavası.',
      ports: []
    },
    'organizer-dring-1u': {
      name: '1U D-Ring Yatay Kablo Düzenleyici',
      u: 1,
      category: 'organizer',
      logo: 'ORGANIZER',
      modelTag: '1U 5x D-RING ORGANIZER',
      powerWatts: 0,
      heatBtu: 0,
      desc: '5 Adet Metal D-Ring kancalı 19" 1U yatay kablo düzenleyici organizer.',
      ports: []
    },
    'organizer-2u': {
      name: '2U Kapaklı Parmak Tipi Düzenleyici',
      u: 2,
      category: 'organizer',
      logo: 'ORGANIZER',
      modelTag: '2U FINGER-DUCT ORGANIZER',
      powerWatts: 0,
      heatBtu: 0,
      desc: 'Yüksek kapasiteli, ön kapaklı parmak tipi (finger duct) 2U organizer.',
      ports: []
    },
    'blank-panel-1u': {
      name: '1U Boşluk Kapatma Paneli',
      u: 1,
      category: 'blank',
      logo: 'BLANK',
      modelTag: '1U BLANKING PANEL',
      powerWatts: 0,
      heatBtu: 0,
      desc: 'Hava akışını yönlendirmek ve boş U yuvalarını kapatmak için kör panel.',
      ports: []
    }
  };

  const BUILTIN_KEYS = new Set(Object.keys(HARDWARE_CATALOG));

  function resolveCatalogItem(key) {
    if (!key) return null;
    return (HARDWARE_CATALOG && HARDWARE_CATALOG[key]) ||
           (RS.catalog && RS.catalog[key]) ||
           (RS.STATE?.customCatalog && RS.STATE.customCatalog[key]) ||
           (Array.isArray(window.CISCO_MASTER_CATALOG) ? window.CISCO_MASTER_CATALOG.find(m => m && m.id === key) : window.CISCO_MASTER_CATALOG?.[key]) ||
           (Array.isArray(RS.CISCO_MASTER_CATALOG) ? RS.CISCO_MASTER_CATALOG.find(m => m && m.id === key) : RS.CISCO_MASTER_CATALOG?.[key]) ||
           null;
  }

  RS.HARDWARE_CATALOG = HARDWARE_CATALOG;
  RS.catalog = HARDWARE_CATALOG;
  RS.BUILTIN_KEYS = BUILTIN_KEYS;
  RS.resolveCatalogItem = resolveCatalogItem;
  window.HARDWARE_CATALOG = HARDWARE_CATALOG;
})();
