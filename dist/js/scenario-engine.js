(function () {
  'use strict';
  const R = window.RackStudio;
  function applyOperations(base,operations) {
    if (!Array.isArray(operations) || operations.length > 500) throw new Error('Senaryo işlem sınırı geçersiz.');
    const doc = R.CatalogSources.pin(base);
    for (const op of operations) {
      if (op.type === 'removeCable') { if (!doc.topology.cables.some(c => c.id === op.id)) throw new Error('Senaryo kablosu bulunamadı.'); doc.topology.cables = doc.topology.cables.filter(c => c.id !== op.id); continue; }
      const rack = doc.topology.racks.find(r => r.devices.some(d => d.instanceId === op.id)), device = rack?.devices.find(d => d.instanceId === op.id);
      if (!device) throw new Error('Senaryo cihazı bulunamadı.');
      if (op.type === 'moveDevice') {
        const target = doc.topology.racks.find(r => r.id === op.rackId); if (!target || !Number.isInteger(op.topU)) throw new Error('Senaryo U/kabin konumu geçersiz.');
        rack.devices = rack.devices.filter(d => d !== device); target.devices.push(device); device.topU = op.topU;
        for (const c of doc.topology.cables) for (const e of [c.from,c.to]) if (e.instanceId === op.id) { e.rackId = op.rackId; delete c.estimatedLengthMeters; c.lengthRecalculationRequired = true; }
      } else if (op.type === 'replaceSwitch') {
        const model = R.CatalogSources.map(doc)[op.modelKey]; if (!model || !['switch','core','router'].includes(model.category)) throw new Error('Hedef switch modeli bulunamadı.');
        const mapping = op.portMapping || {}, used = doc.topology.cables.flatMap(c => [c.from,c.to]).filter(e => e.instanceId === op.id);
        for (const end of used) { if (!Object.hasOwn(mapping,end.portId) || !model.ports.some(p => p.id === mapping[end.portId])) throw new Error('Kullanılan her port için açık eşleme gerekli.'); end.portId = mapping[end.portId]; }
        const mapped = Object.entries(mapping).filter(([id]) => used.some(e => e.portId === id) || Object.hasOwn(device.portsConfig || {},id)).map(([,id]) => id);
        if (new Set(mapped).size !== mapped.length) throw new Error('Port eşleme tekil olmalı.');
        const configs = {}; for (const [id,config] of Object.entries(device.portsConfig || {})) if (mapping[id] && model.ports.some(p => p.id === mapping[id])) configs[mapping[id]] = config;
        device.portsConfig = configs; device.catalogKey = op.modelKey; device.uHeight = model.u; device.passThroughPairs = []; device.modules = []; device.transceivers = [];
        device.psus = []; if (device.powerPlan) { delete device.powerPlan.consumption; device.powerPlan.recheckRequired = true; }
        doc.catalogContext.models[op.modelKey] = { definition:structuredClone(model),modelVersion:model.modelVersion || 'unverified',source:model.provenance?.source || null };
      } else throw new Error('Desteklenmeyen senaryo işlemi.');
    }
    R.validateTopology(doc); return doc;
  }
  function create(base,baseSource = {kind:'current'}) {
    const expected = R.ProjectCommands.begin(), main = R.ProjectDocument.capture(R.STATE);
    if (base.projectId !== main.projectId) throw new Error('Senaryo tabanı başka projeye ait.');
    return { version:1,id:crypto.randomUUID(),baseDocument:R.CatalogSources.pin(base),baseSource:structuredClone(baseSource),mainBasis:R.ProjectCommands.domainKey(main),mainRevision:main.revision,expected,operations:[] };
  }
  async function analyze(branch) {
    const document = applyOperations(branch.baseDocument,branch.operations), before = await R.ReportModel.build(branch.baseDocument), after = await R.ReportModel.build(document);
    const capacity = d => { const cat = R.CatalogSources.map(d); return { occupiedU:d.topology.racks.flatMap(r => r.devices).reduce((n,x) => n + x.uHeight,0),ports:d.topology.racks.flatMap(r => r.devices).reduce((n,x) => n + (cat[x.catalogKey]?.ports.length || 0),0) }; };
    return { document,baseline:capacity(branch.baseDocument),candidate:capacity(document),bomBefore:R.BOM.build(before),bomAfter:R.BOM.build(after),diff:R.ProjectDiff.compare(branch.baseDocument,document),issues:R.EngineeringIssues.collect(document),impact:R.PhysicalPaths.impact(branch.baseDocument,document) };
  }
  function validateBranch(branch,doc) {
    if (!branch || branch.version !== 1 || typeof branch.id !== 'string' || typeof branch.mainBasis !== 'string' || !Number.isSafeInteger(branch.mainRevision) || branch.mainRevision < 0) throw new Error('Senaryo kaydı geçersiz.');
    const base = R.ProjectRepository.validate(branch.baseDocument);
    if (base.projectId !== doc.projectId || R.ProjectCommands.domainKey(applyOperations(base,branch.operations)) !== R.ProjectCommands.domainKey(doc)) throw new Error('Senaryo işlemleri kayıtla uyuşmuyor.');
    return branch;
  }
  async function save(branch,name) {
    const analysis = await analyze(branch), scenario = structuredClone(branch); delete scenario.expected;
    return R.ProjectRevisions.create({name,description:'What-if: belgelenmiş fiziksel plan alternatifi',scenario},analysis.document);
  }
  async function apply(branch,ackUnknown = false) {
    const main = R.ProjectDocument.capture(R.STATE);
    if (main.revision !== branch.mainRevision || R.ProjectCommands.domainKey(main) !== branch.mainBasis) throw new Error('Senaryo tabanı eskidi; güncel projeden yeni alternatif oluşturun.');
    const analysis = await analyze(branch), expected = branch.expected || R.ProjectCommands.begin();
    return R.EngineeringChanges.apply(R.EngineeringChanges.preview(analysis.document,expected),ackUnknown);
  }
  R.Scenarios = Object.freeze({ create,applyOperations,analyze,validateBranch,save,apply });
})();
