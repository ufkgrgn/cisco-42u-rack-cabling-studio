(function () {
  'use strict';
  const R = window.RackStudio;
  function assertEditable() { if (R.WorkflowViews?.canEdit() === false) throw new Error('Sunum görünümünde proje düzenlenemez.'); }
  function validate(before,after,ackUnknown = false) {
    R.validateTopology(after);
    const catalog = R.CatalogSources.map(after), previous = new Map(R.EngineeringIssues.collect(before).map(i => [i.issueId,i]));
    const issues = R.EngineeringIssues.collect(after);
    for (const cable of after.topology.cables) {
      const rules = R.NetworkRules.validateConnection(cable.from,cable.to,{...after.topology,catalogContext:after.catalogContext},catalog,true);
      const old = before.topology.cables.find(c => c.id === cable.id), prior = old && R.NetworkRules.validateConnection(old.from,old.to,before.topology,R.CatalogSources.map(before),true);
      if (!rules.allowed && (prior?.allowed !== false || prior.reason !== rules.reason)) throw new Error(rules.reason || 'Bağlantı kuralı ihlali.');
    }
    const introduced = issues.filter(i => !previous.has(i.issueId) || previous.get(i.issueId).status !== i.status || previous.get(i.issueId).text !== i.text);
    if (introduced.some(i => i.status === 'blocked')) throw new Error('Değişiklik yeni bir uyumluluk/güç ihlali oluşturuyor: ' + introduced.filter(i => i.status === 'blocked').map(i => i.text).join(' '));
    if (!ackUnknown && introduced.some(i => i.status === 'unknown')) throw new Error('Yeni belirsizlikler önizlemede açıkça kabul edilmeli.');
    return issues;
  }
  function preview(candidate,expected = R.ProjectCommands.begin()) {
    assertEditable(); const before = R.ProjectDocument.capture(R.STATE), next = R.ProjectDocument.normalize(candidate);
    if (next.projectId !== before.projectId) throw new Error('Değişiklik başka projeye ait.');
    R.validateTopology(next);
    return { expected, before, document:next, issues:R.EngineeringIssues.collect(next), beforeBasis:R.ProjectCommands.domainKey(before), candidateBasis:R.ProjectCommands.domainKey(next), diff:R.ProjectDiff.compare(before,next) };
  }
  async function apply(plan,ackUnknown = false) {
    assertEditable();
    if (R.ProjectCommands.domainKey(plan.document) !== plan.candidateBasis) throw new Error('Önizleme içeriği değişti; yeniden denetleyin.');
    const result = R.ProjectCommands.execute({ ...plan.expected, type:'ApplyEngineeringChange', payload:{topology:plan.document.topology,catalogContext:plan.document.catalogContext,ackUnknown} });
    if (window.is3DMode) window.__STUDIO3D__?.loadTopologyFromProject(R.ProjectDocument.capture(R.STATE));
    await result.committed; return result;
  }
  R.EngineeringChanges = Object.freeze({ validate,preview,apply,assertEditable });
})();
