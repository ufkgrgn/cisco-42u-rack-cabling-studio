/* Deliberately separate, synthetic training project. No customer data or attachments. */
(function(){
  const RS=window.RackStudio;
  RS.OnboardingExample=()=>{
    const rackId=crypto.randomUUID(),deviceId=crypto.randomUUID();
    const doc=RS.ProjectDocument.normalize({activeRackId:rackId,viewMode:'single',racks:[{id:rackId,name:'Örnek kabin',heightU:18,devices:[{instanceId:deviceId,catalogKey:'intro-switch',uHeight:1,topU:16,name:'Örnek switch'}]}],cables:[],customCatalog:{'intro-switch':{id:'intro-switch',name:'Eğitim switchi',category:'switch',u:1,ports:[{id:'p1',name:'GE1',type:'rj45'},{id:'p2',name:'GE2',type:'rj45'}]}}});
    doc.metadata={name:'İlk kullanım — ayrı örnek proje',customer:'Örnek',status:'draft'};
    doc.extensions.onboardingExample=true;
    doc.observations=[{id:crypto.randomUUID(),entityRef:{kind:'device',id:deviceId},source:{system:'training',label:'Sentetik örnek'},raw:{hostname:'SAHADA-ORNEK'},collectedAt:new Date().toISOString()}];
    return doc;
  };
})();
