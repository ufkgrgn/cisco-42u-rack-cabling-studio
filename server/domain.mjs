// Run the canonical browser validators/commands in a DOM-free host, not a second topology implementation.
import fs from 'node:fs';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const files=['js/2d/catalog.js','js/2d/cisco-catalyst-catalog.js','js/2d/cisco-nexus-routers-catalog.js','js/2d/cisco-master-catalog.js','js/2d/project-records.js','js/2d/project-document.js','js/2d/network-rules.js','js/2d/topology-io.js','js/2d/project-commands.js','js/catalog-source-pack.js','js/catalog-sources.js','js/field-observations.js','js/field-events.js','js/handover-repository.js'];
const sources=files.map(file=>fs.readFileSync(new URL('../'+file,import.meta.url),'utf8'));
function runtime(input){
  let document;
  const window={RackStudio:{STATE:{racks:[],cables:[],strictCompliance:true}},crypto:webcrypto};
  const context=vm.createContext({window,crypto:webcrypto,TextEncoder,console,structuredClone,document:{dispatchEvent(){}},CustomEvent:class{}});
  for(const source of sources)vm.runInContext(source,context);
  const R=window.RackStudio;
  R.FieldEvidence={isVerified:()=>false};
  document=R.CatalogSources.pin(R.ProjectDocument.normalize(input),true);
  R.ProjectDocument={...R.ProjectDocument,capture:()=>structuredClone(document)};
  R.loadCustomTopology=value=>{document=structuredClone(value);};R.refresh=()=>{};
  R.validateTopology(document);R.ProjectCommands.receipts(document);
  return{R,get:()=>structuredClone(document)};
}
export function validate(document){return runtime(document).get();}
export function domainKey(document){const{R}=runtime(document);return R.ProjectCommands.domainKey(document);}
export function fieldScope(document,ref){return runtime(document).R.FieldEvents.scope(document,ref);}
export function apply(document,command){const host=runtime(document),result=host.R.ProjectCommands.execute(command),next=host.get();
  // Every changed endpoint goes through the same deterministic connection rules.
  const old=new Map(document.topology.cables.map(row=>[row.id,row]));
  for(const cable of next.topology.cables){const prior=old.get(cable.id);if(prior&&host.R.ProjectCommands.stable(prior.from)===host.R.ProjectCommands.stable(cable.from)&&host.R.ProjectCommands.stable(prior.to)===host.R.ProjectCommands.stable(cable.to))continue;
    const rules=host.R.NetworkRules.validateConnection(cable.from,cable.to,{...next.topology,cables:next.topology.cables.filter(row=>row.id!==cable.id)},host.R.CatalogSources.map(next),true);if(!rules.allowed)throw new Error(rules.reason||'Invalid connection');}
  return next;
}
export function fieldDraft(document,draft,subject){
  const host=runtime(document),R=host.R,next=validate(draft),copy=structuredClone(document),stable=R.ProjectCommands.stable;
  for(const key of ['observations','fieldEvents','evidenceRefs'])for(const row of document[key])if(stable(row)!==stable(next[key].find(item=>item.id===row.id)))throw new Error('Field history is immutable');
  const observations=next.observations.filter(row=>!document.observations.some(old=>old.id===row.id));R.FieldObservations.appendToDocument(copy,observations);
  copy.integrationMappings=next.integrationMappings;copy.evidenceRefs=next.evidenceRefs;
  for(const event of next.fieldEvents.filter(row=>!document.fieldEvents.some(old=>old.id===row.id))){
    if(event.fieldEventVersion!==1||event.projectId!==document.projectId||stable(event.scope)!==stable(R.FieldEvents.scope(copy,event.entityRef)))throw new Error('Invalid field scope');
    R.FieldEvents.validateInput(event,copy);if(event.kind==='test'&&event.result==='pass'&&!event.evidenceIds.length)throw new Error('Passed test needs evidence');
    copy.fieldEvents.push({...event,actorSubject:subject,receivedAt:new Date().toISOString()});
  }
  const comparison=structuredClone(copy);comparison.fieldEvents=next.fieldEvents;
  if(domainKey(comparison)!==domainKey(next))throw new Error('Technician cannot change design fields');return copy;
}
