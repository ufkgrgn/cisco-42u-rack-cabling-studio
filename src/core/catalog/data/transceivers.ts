export interface TransceiverCatalogItem {
  id: string;
  name: string;
  formFactor: 'SFP' | 'SFP+' | 'SFP28' | 'QSFP+' | 'QSFP28' | 'Breakout';
  partNumber: string;
  standard: string;
  connector: 'rj45' | 'lc' | 'mpo' | 'dac';
  wavelength?: string;
  mediaType: string;
  maxReachMeters: number;
  powerWatts: number;
  isDac: boolean;
}

export const TRANSCEIVERS: TransceiverCatalogItem[] = [
  // 1G SFP
  {
    id: 'glc-te',
    name: 'Cisco 1000BASE-T SFP Copper RJ45 Transceiver',
    formFactor: 'SFP',
    partNumber: 'GLC-TE',
    standard: '1000BASE-T',
    connector: 'rj45',
    mediaType: 'Cat5e/Cat6',
    maxReachMeters: 100,
    powerWatts: 1.0,
    isDac: false
  },
  {
    id: 'glc-sx-mmd',
    name: 'Cisco 1000BASE-SX SFP 850nm MMF Transceiver',
    formFactor: 'SFP',
    partNumber: 'GLC-SX-MMD',
    standard: '1000BASE-SX',
    connector: 'lc',
    wavelength: '850nm',
    mediaType: 'OM2/OM3/OM4 MMF',
    maxReachMeters: 550,
    powerWatts: 0.8,
    isDac: false
  },
  {
    id: 'glc-lh-smd',
    name: 'Cisco 1000BASE-LX/LH SFP 1310nm SMF Transceiver',
    formFactor: 'SFP',
    partNumber: 'GLC-LH-SMD',
    standard: '1000BASE-LX/LH',
    connector: 'lc',
    wavelength: '1310nm',
    mediaType: 'OS2 SMF',
    maxReachMeters: 10000,
    powerWatts: 1.0,
    isDac: false
  },

  // 10G SFP+
  {
    id: 'sfp-10g-sr',
    name: 'Cisco 10GBASE-SR SFP+ 850nm MMF Transceiver',
    formFactor: 'SFP+',
    partNumber: 'SFP-10G-SR',
    standard: '10GBASE-SR',
    connector: 'lc',
    wavelength: '850nm',
    mediaType: 'OM3/OM4 MMF',
    maxReachMeters: 300,
    powerWatts: 1.0,
    isDac: false
  },
  {
    id: 'sfp-10g-lr',
    name: 'Cisco 10GBASE-LR SFP+ 1310nm SMF Transceiver',
    formFactor: 'SFP+',
    partNumber: 'SFP-10G-LR',
    standard: '10GBASE-LR',
    connector: 'lc',
    wavelength: '1310nm',
    mediaType: 'OS2 SMF',
    maxReachMeters: 10000,
    powerWatts: 1.5,
    isDac: false
  },
  {
    id: 'sfp-10g-t',
    name: 'Cisco 10GBASE-T SFP+ RJ45 Transceiver',
    formFactor: 'SFP+',
    partNumber: 'SFP-10G-T-X',
    standard: '10GBASE-T',
    connector: 'rj45',
    mediaType: 'Cat6A STP',
    maxReachMeters: 30,
    powerWatts: 2.5,
    isDac: false
  },
  {
    id: 'sfp-h10gb-cu1m',
    name: 'Cisco 10GBASE-CU SFP+ 1m Direct Attach Copper DAC',
    formFactor: 'SFP+',
    partNumber: 'SFP-H10GB-CU1M',
    standard: '10G Twinax DAC',
    connector: 'dac',
    mediaType: 'Passive Twinax Copper',
    maxReachMeters: 1,
    powerWatts: 0.1,
    isDac: true
  },
  {
    id: 'sfp-h10gb-cu3m',
    name: 'Cisco 10GBASE-CU SFP+ 3m Direct Attach Copper DAC',
    formFactor: 'SFP+',
    partNumber: 'SFP-H10GB-CU3M',
    standard: '10G Twinax DAC',
    connector: 'dac',
    mediaType: 'Passive Twinax Copper',
    maxReachMeters: 3,
    powerWatts: 0.1,
    isDac: true
  },

  // 25G SFP28
  {
    id: 'sfp-25g-sr-s',
    name: 'Cisco 25GBASE-SR SFP28 850nm MMF Transceiver',
    formFactor: 'SFP28',
    partNumber: 'SFP-25G-SR-S',
    standard: '25GBASE-SR',
    connector: 'lc',
    wavelength: '850nm',
    mediaType: 'OM4 MMF',
    maxReachMeters: 100,
    powerWatts: 1.2,
    isDac: false
  },
  {
    id: 'sfp-25g-lr-s',
    name: 'Cisco 25GBASE-LR SFP28 1310nm SMF Transceiver',
    formFactor: 'SFP28',
    partNumber: 'SFP-25G-LR-S',
    standard: '25GBASE-LR',
    connector: 'lc',
    wavelength: '1310nm',
    mediaType: 'OS2 SMF',
    maxReachMeters: 10000,
    powerWatts: 1.8,
    isDac: false
  },
  {
    id: 'sfp-h25g-cu2m',
    name: 'Cisco 25GBASE-CU SFP28 2m Direct Attach Copper DAC',
    formFactor: 'SFP28',
    partNumber: 'SFP-H25G-CU2M',
    standard: '25G Twinax DAC',
    connector: 'dac',
    mediaType: 'Passive Twinax Copper',
    maxReachMeters: 2,
    powerWatts: 0.1,
    isDac: true
  },

  // 40G QSFP+
  {
    id: 'qsfp-40g-sr4',
    name: 'Cisco 40GBASE-SR4 QSFP+ MPO-12 MMF Transceiver',
    formFactor: 'QSFP+',
    partNumber: 'QSFP-40G-SR4',
    standard: '40GBASE-SR4',
    connector: 'mpo',
    wavelength: '850nm',
    mediaType: 'OM3/OM4 MMF',
    maxReachMeters: 150,
    powerWatts: 1.5,
    isDac: false
  },
  {
    id: 'qsfp-40g-sr-bd',
    name: 'Cisco 40G BiDi QSFP+ LC Duplex MMF Transceiver',
    formFactor: 'QSFP+',
    partNumber: 'QSFP-40G-SR-BD',
    standard: '40G BiDi',
    connector: 'lc',
    wavelength: '850/900nm',
    mediaType: 'OM3/OM4 MMF',
    maxReachMeters: 150,
    powerWatts: 3.5,
    isDac: false
  },
  {
    id: 'qsfp-40g-lr4',
    name: 'Cisco 40GBASE-LR4 QSFP+ LC SMF Transceiver',
    formFactor: 'QSFP+',
    partNumber: 'QSFP-40G-LR4',
    standard: '40GBASE-LR4',
    connector: 'lc',
    wavelength: 'CWDM4',
    mediaType: 'OS2 SMF',
    maxReachMeters: 10000,
    powerWatts: 3.5,
    isDac: false
  },

  // 100G QSFP28
  {
    id: 'qsfp-100g-sr4-s',
    name: 'Cisco 100GBASE-SR4 QSFP28 MPO-12 MMF Transceiver',
    formFactor: 'QSFP28',
    partNumber: 'QSFP-100G-SR4-S',
    standard: '100GBASE-SR4',
    connector: 'mpo',
    wavelength: '850nm',
    mediaType: 'OM4 MMF',
    maxReachMeters: 100,
    powerWatts: 2.5,
    isDac: false
  },
  {
    id: 'qsfp-100g-cwdm4',
    name: 'Cisco 100G CWDM4 QSFP28 LC SMF Transceiver',
    formFactor: 'QSFP28',
    partNumber: 'QSFP-100G-CWDM4',
    standard: '100G CWDM4',
    connector: 'lc',
    wavelength: '1271-1331nm',
    mediaType: 'OS2 SMF',
    maxReachMeters: 2000,
    powerWatts: 3.5,
    isDac: false
  },
  {
    id: 'qsfp-100g-lr4-s',
    name: 'Cisco 100GBASE-LR4 QSFP28 LC SMF Transceiver',
    formFactor: 'QSFP28',
    partNumber: 'QSFP-100G-LR4-S',
    standard: '100GBASE-LR4',
    connector: 'lc',
    wavelength: '1310nm',
    mediaType: 'OS2 SMF',
    maxReachMeters: 10000,
    powerWatts: 4.0,
    isDac: false
  },
  {
    id: 'qsfp-100g-cu2m',
    name: 'Cisco 100GBASE-CR4 QSFP28 2m Direct Attach Copper DAC',
    formFactor: 'QSFP28',
    partNumber: 'QSFP-100G-CU2M',
    standard: '100G Twinax DAC',
    connector: 'dac',
    mediaType: 'Passive Twinax Copper',
    maxReachMeters: 2,
    powerWatts: 0.2,
    isDac: true
  },
  {
    id: 'qsfp-100g-4x25g-cu2m',
    name: 'Cisco 100G to 4x 25G SFP28 Breakout Copper DAC (2m)',
    formFactor: 'Breakout',
    partNumber: 'QSFP-4SFP25G-CU2M',
    standard: '100G to 4x25G Splitter',
    connector: 'dac',
    mediaType: 'Passive Splitter DAC Copper',
    maxReachMeters: 2,
    powerWatts: 0.2,
    isDac: true
  }
];
