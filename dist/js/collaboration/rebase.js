(function(){
  'use strict';const R=window.RackStudio,stable=value=>R.ProjectCommands.stable(value);
  function rebase(base,draft,remote,choices={}){
    if(base.projectId!==draft.projectId||base.projectId!==remote.projectId)throw new Error('Rebase proje kimliği uyuşmuyor.');
    const conflicts=[];
    function conflict(path,b,l,r,deleted=false){
      const allowed=deleted?['remote']:['remote','local'];
      if(allowed.includes(choices[path]))return structuredClone(choices[path]==='local'?l:r);
      conflicts.push({path,base:b,local:l,remote:r,deleted,choices:allowed});return structuredClone(r);
    }
    function merge(b,l,r,path){
      if(stable(l)===stable(b))return structuredClone(r);
      if(stable(l)===stable(r))return structuredClone(r);
      // A remote deletion cannot silently revive an edited identity.
      if(b!==undefined&&r===undefined&&l!==undefined)return conflict(path,b,l,r,true);
      if(stable(r)===stable(b))return structuredClone(l);
      if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)){
        const key=value=>value?.instanceId||value?.id;
        if([...b,...l,...r].every(value=>value&&typeof value==='object'&&typeof key(value)==='string')){
          const maps=[b,l,r].map(rows=>new Map(rows.map(value=>[key(value),value]))),ids=new Set([...r,...l,...b].map(key)),result=[];
          for(const id of ids){const value=merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),path+'['+id+']');if(value!==undefined)result.push(value);}return result;
        }
      }
      if([b,l,r].every(value=>value&&typeof value==='object'&&!Array.isArray(value))){
        const result={};for(const key of new Set([...Object.keys(r),...Object.keys(l),...Object.keys(b)])){const value=merge(b[key],l[key],r[key],path+'.'+key);if(value!==undefined)result[key]=value;}return result;
      }
      return conflict(path,b,l,r);
    }
    const clean=doc=>{const copy=R.ProjectCommands.semanticDocument(doc);delete copy.metadata.updatedAt;return copy;};
    let document=merge(clean(base),clean(draft),clean(remote),'project');document.revision=remote.revision;document.extensions[R.ProjectCommands.LEDGER]=R.ProjectCommands.receipts(remote);
    const timestamps=[draft.metadata.updatedAt,remote.metadata.updatedAt].filter(value=>Number.isFinite(Date.parse(value)));if(timestamps.length)document.metadata.updatedAt=timestamps.sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
    if(!conflicts.length){try{document=R.ProjectRepository.validate(document);}catch(error){conflicts.push({path:'physical-layout',message:error.message,choices:['edit-draft'],deleted:false});}}
    return{document,conflicts,ready:conflicts.length===0};
  }
  R.WorkspaceRebase=Object.freeze({rebase});
})();
