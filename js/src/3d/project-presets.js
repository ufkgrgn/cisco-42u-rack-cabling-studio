/** MDF is one scene transaction, using canonical model and physical port definitions. */
export function loadMdfPreset(studio) {
  studio.state.devices = []; studio.state.cables = [];
  if (!studio.setRackHeight(42)) throw new Error('MDF kabin yüksekliği uygulanamadı.');
  const mount = (id, u) => {
    const device = studio.mountDevice(id, u, null, { silent: true });
    if (!device) throw new Error('MDF cihazı yerleştirilemedi: ' + id);
    return device;
  };
  const patch = mount('patch-cat6a-24p', 40);
  const core = mount('cisco-c9300-48p', 38);
  mount('cable-manager-1u', 37); mount('patch-cat6a-24p', 35);
  const spine = mount('cisco-c9500-32qc', 33);
  mount('cable-manager-1u', 32);
  const router = mount('cisco-isr4451', 28);
  mount('dell-r750', 20); mount('hpe-dl380-g10', 16);
  mount('blank-panel-1u', 12); mount('pdu-1u-8c13', 2);
  const connect = (a, indexA, b, indexB, color, name) => {
    if (!studio.connectPorts({ devId: a.id, portIdx: indexA }, { devId: b.id, portIdx: indexB }, color, name, '', { silent: true })) {
      throw new Error('MDF bağlantısı kurulamadı: ' + name);
    }
  };
  for (let index = 1; index <= 6; index++) connect(patch, index, core, index, 0x00d2ff, `Patch-P${index} → Switch-P${index}`);
  connect(core, 48, router, 1, 0xef4444, 'Uplink-Core-to-WAN');
  const uplink = core.portDefinitions.findIndex(port => port.type === 'sfp') + 1;
  const spinePort = spine.portDefinitions.findIndex(port => port.type === 'sfp') + 1;
  if (!uplink || !spinePort) throw new Error('MDF fiber uplink portu çözümlenemedi.');
  connect(core, uplink, spine, spinePort, 0xf97316, 'Spine-Trunk');
  return true;
}
