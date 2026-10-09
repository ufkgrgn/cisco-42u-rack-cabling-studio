/** Non-modal training in an isolated project, using existing commands. */
(function () {
  'use strict';
  const RS = window.RackStudio, storage = RS.ProjectStorageIDB;
  const node = (tag, text) => { const el = document.createElement(tag); if (text) el.textContent = text; return el; };
  const button = (text, fn) => { const el = node('button', text); el.type = 'button'; el.addEventListener('click', fn); return el; };
  const read = async () => storage.read(await RS.ProjectRepository.database, 'meta', 'onboarding-v1');
  const write = async value => storage.transaction(await RS.ProjectRepository.database, ['meta'], 'readwrite', tx => tx.objectStore('meta').put(value, 'onboarding-v1'));
  let panel, content, status, session, busy = false, collapsed = false, opener, interval;
  const activeSample = () => session && RS.STATE.projectDocument.projectId === session.sampleId && RS.STATE.projectDocument.extensions.onboardingExample;
  async function run(fn, repaint = true) {
    if (busy) return; busy = true; panel?.setAttribute('aria-busy', 'true');
    try { await fn(); if (panel) { status.textContent = ''; if (repaint) render(); } }
    catch (error) { if (panel) status.textContent = error.message; }
    finally { busy = false; panel?.removeAttribute('aria-busy'); }
  }
  function close() { clearInterval(interval); panel?.remove(); panel = null; if (opener?.isConnected) opener.focus(); }
  async function back() { await RS.openStoredProject(session.returnId); session.completed = session.step >= 4; await write(session); close(); }
  async function start() {
    const expected = RS.ProjectManagement.prepare(), returnId = expected.projectId;
    await RS.saveProjectNow();
    const result = await RS.importProjectDocument(RS.OnboardingExample(), expected);
    if (window.is3DMode) window.__STUDIO3D__.loadTopologyFromProject(RS.ProjectDocument.capture(RS.STATE));
    session = { returnId, sampleId: result.projectId, step: 1, completed: false, flow: 2 };
    await write(session); await RS.setStudioMode(false); RS.WorkflowViews.set('design'); RS.setStudioWorkMode('layout');
  }
  async function check(repaint = true) {
    if (!panel || !activeSample() || session.completed) return;
    const devices = RS.STATE.racks[0].devices.filter(d => d.catalogKey === 'intro-switch');
    if (session.step === 1 && devices.some(d => d.topU === 12) && devices.length >= 2) { session.step = 2; await write(session); if (repaint) render(); }
    else if (session.step === 2 && RS.STATE.cables.some(c => devices.some(d => d.instanceId === c.from.instanceId) && devices.some(d => d.instanceId === c.to.instanceId) && c.from.instanceId !== c.to.instanceId && c.from.portId === 'p1' && c.to.portId === 'p1')) { session.step = 3; await write(session); if (repaint) render(); }
  }
  async function automatic() {
    if (!activeSample()) throw new Error('Örnek proje açık değil. Örneğe devam edin.');
    const rack = RS.STATE.racks[0];
    if (session.step === 1) {
      if (!RS.mountDeviceAt('intro-switch', 12)) throw new Error('12U dolu. Örnek cihaz için bu alanı boşaltın.');
      document.dispatchEvent(new CustomEvent('rackstudio:change', { detail: { immediate: true } }));
      document.dispatchEvent(new CustomEvent('rackstudio:refresh')); await RS.saveProjectNow();
    } else if (session.step === 2) {
      RS.setStudioWorkMode('cabling');
      const devices = rack.devices.filter(d => d.catalogKey === 'intro-switch');
      const result = RS.ProjectCommands.execute({ ...RS.ProjectManagement.prepare(), type: 'ConnectCable', payload: { cable: {
        id: crypto.randomUUID(), name: 'Örnek bağlantı', color: '#2563eb',
        from: { rackId: rack.id, instanceId: devices[0].instanceId, portId: 'p1' },
        to: { rackId: rack.id, instanceId: devices[1].instanceId, portId: 'p1' }, lengthMeters: 2
      } } }); await result.committed;
    }
    await check(false);
  }
  function render() {
    if (!panel) return; content.replaceChildren(); content.hidden = collapsed;
    if (!session || session.completed) { content.append(node('p', 'Cihaz yerleştirme ve port bağlamayı ayrı bir örnek projede deneyin. Açık projeniz önce kaydedilir. Rehberi kapatmak örneği silmez.'), button('Ayrı örnek projeyi başlat', () => run(start))); return; }
    if (!activeSample()) { content.append(node('p', 'Yarım kalan örnek projeniz mevcut. Devam edebilir veya kendi projenize dönebilirsiniz.'), button('Örneğe devam et', () => run(async () => { await RS.openStoredProject(session.sampleId); await RS.setStudioMode(false); })), button('Kendi projeme dön', () => run(back))); return; }
    content.append(node('p', `Adım ${Math.min(session.step, 3)} / 3 · Ayrı örnek proje`));
    if (session.step === 1) content.append(node('h3', 'Cihaz yerleştir'), node('p', 'Eğitim switchini kütüphaneden boş 12U alanına yerleştirin. Doğru yerleşim algılandığında rehber ilerler.'));
    else if (session.step === 2) content.append(node('h3', 'Portları bağla'), node('p', 'Kablolama’yı seçin. Portlar görünene kadar yakınlaşın. İki eğitim switchinin GE1 portlarını sırayla seçin.'), button('Kablolama görünümüne geç', () => { RS.setStudioWorkMode('cabling'); RS.setZoom(1.3); }));
    else if (session.step === 3) content.append(node('h3', 'Bağlantıyı kontrol et'), node('p', 'Bağlantılar listesini açıp iki eğitim switchinin GE1 uçlarını kontrol edin.'), button('Bağlantı listesini aç', () => { RS.setStudioWorkMode('cabling'); document.getElementById('btn-3d-schedule-modal')?.click(); }), button('Bağlantıyı kontrol ettim', () => run(async () => { session.step = 4; await write(session); })));
    else content.append(node('h3', 'Örnek tamamlandı'), node('p', 'Örnek kayıt ayrı tutulur. Saha görünümü planla gözlemi karşılaştırır; Teslim merkezi rapor, malzeme ve etiket çıktılarını hazırlar. Bu eğitim projesi gerçek saha kanıtı içermez.'));
    const actions = node('div'); actions.className = 'onboarding-actions';
    if (session.step < 3) actions.append(button('Örneği benim için yap', () => run(automatic)));
    actions.append(button('Bu adımın yardımı', () => RS.Help.open(session.step === 1 ? 'devices' : 'cabling')), button('Kendi projeme dön', () => run(back))); content.append(actions);
  }
  async function open() {
    if (panel) { panel.querySelector('button').focus(); return; }
    session = await read();
    if (session && session.flow !== 2 && !session.completed) { session.step = 1; session.flow = 2; await write(session); }
    document.getElementById('onboarding-invite')?.remove(); opener = document.activeElement; collapsed = false;
    try { localStorage.setItem('rackstudio-intro-invite', 'dismissed'); } catch (_) {}
    panel = node('aside'); panel.id = 'onboarding-panel'; panel.className = 'onboarding-panel'; panel.setAttribute('aria-label', 'İlk kullanım');
    const header = node('header'), title = node('h2', 'İlk kullanım');
    const collapse = button('Daralt', () => { collapsed = !collapsed; collapse.textContent = collapsed ? 'Genişlet' : 'Daralt'; collapse.setAttribute('aria-expanded', String(!collapsed)); render(); }); collapse.setAttribute('aria-expanded', 'true');
    header.append(title, collapse, button('Kapat', close)); content = node('section'); status = node('p'); status.setAttribute('role', 'status');
    panel.append(header, content, status); (document.getElementById('workspace-scene') || document.body).prepend(panel); render();
    panel.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } }); panel.querySelector('button').focus();
    interval = setInterval(() => { if (!busy) run(check, false); }, 700);
  }
  function invite() {
    if (panel) return;
    try { if (localStorage.getItem('rackstudio-intro-invite')) return; } catch (_) { return; }
    const box = node('aside'); box.id = 'onboarding-invite'; box.className = 'onboarding-invite'; box.setAttribute('aria-label', 'Başlangıç daveti');
    function dismiss() { try { localStorage.setItem('rackstudio-intro-invite', 'dismissed'); } catch (_) {} box.remove(); }
    box.append(node('strong', 'İlk kez mi kullanıyorsunuz?'), node('p', 'Ayrı bir örnek projede cihaz yerleştirmeyi ve kablo bağlamayı deneyin.'));
    const actions = node('div'); actions.className = 'onboarding-actions'; actions.append(button('Rehberi aç', () => { dismiss(); open().catch(e => window.UIActions?.notify(e.message)); }), button('Daha sonra', dismiss)); box.append(actions); (document.querySelector('.catalog-tools') || document.body).append(box);
    const onWork = event => { if (!box.contains(event.target)) { queueMicrotask(dismiss); document.removeEventListener('click', onWork, true); } };
    document.addEventListener('click', onWork, true);
  }
  RS.Onboarding = Object.freeze({ open });
  document.getElementById('btn-onboarding')?.addEventListener('click', () => open().catch(e => window.UIActions?.notify(e.message)));
  // Show the invitation with the editor's ready state, before the user starts working.
  function waitForEditor() {
    const editor = document.querySelector('.studio-editor');
    if (!editor) return;
    if (editor.dataset.ready === 'true') { invite(); return; }
    const ready = new MutationObserver(() => {
      if (editor.dataset.ready === 'true') { ready.disconnect(); invite(); }
    });
    ready.observe(editor, { attributes: true, attributeFilter: ['data-ready'] });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForEditor); else waitForEditor();
})();
