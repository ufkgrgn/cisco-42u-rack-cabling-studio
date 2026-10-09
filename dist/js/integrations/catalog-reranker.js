(function(){
  'use strict';
  const R=window.RackStudio,cache=new Map();let generation=0;
  const normalize=value=>String(value||'').toLocaleLowerCase('tr').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i');
  function shortlist(query,candidates){
    const words=normalize(query).split(/\s+/).filter(Boolean);
    return candidates.map((candidate,index)=>({candidate,index,score:words.reduce((score,word)=>score+(normalize([candidate.id,candidate.model,candidate.name,candidate.description].join(' ')).includes(word)?1:0),0)}))
      .sort((a,b)=>b.score-a.score||a.index-b.index).slice(0,20).map(row=>row.candidate);
  }
  function publicCandidate(id,item){
    if(item.provenance?.source?.kind!=='manufacturer')return null;
    const ports={};for(const port of item.ports||[]){const key=String(port.type)+'@'+String(port.speed);ports[key]=(ports[key]||0)+1;}
    return{id,model:String(item.sku||item.modelTag||id),name:String(item.name||''),description:JSON.stringify({heightU:item.u,ports,poe:item.engineering?.poe?{budgetWatts:item.engineering.poe.budgetWatts,perPortWatts:item.engineering.poe.perPortWatts}:null,unknownFields:item.provenance.unknownFields||[]}).slice(0,2000),source:{title:String(item.provenance.source.title||''),reference:String(item.provenance.source.url||'')}};
  }
  function cancel(){generation++;}
  async function rank(query,candidates,transport,options={}){
    const current=++generation,start=performance.now(),list=shortlist(query,candidates),key=JSON.stringify([query,list]);
    if(!query.trim()||!list.length||!transport)return{status:'baseline',ids:[],elapsedMs:0};
    if(cache.has(key))return{...cache.get(key),cached:true};
    let timer;
    try{
      const response=await Promise.race([transport({query,candidates:list}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('timeout')),options.timeoutMs||1500);})]);
      if(current!==generation||options.isCurrent?.()===false)return{status:'stale',ids:[]};
      if(!Array.isArray(response.scores)||response.scores.length!==list.length||new Set(response.scores.map(row=>row.id)).size!==list.length||response.scores.some(row=>!list.some(item=>item.id===row.id)||typeof row.score!=='number'||!Number.isFinite(row.score)||row.score<0||row.score>1))throw new Error('Invalid rerank response');
      const ids=response.scores.filter(row=>row.score>=0.5).sort((a,b)=>b.score-a.score||list.findIndex(item=>item.id===a.id)-list.findIndex(item=>item.id===b.id)).map(row=>row.id);
      const result={status:ids.length?'ranked':'no-match',ids,elapsedMs:performance.now()-start,model:response.model,usage:response.usage};
      cache.set(key,result);if(cache.size>64)cache.delete(cache.keys().next().value);return result;
    }catch(error){return{status:current===generation?'fallback':'stale',ids:[],elapsedMs:performance.now()-start};}
    finally{clearTimeout(timer);}
  }
  R.CatalogReranker=Object.freeze({shortlist,publicCandidate,rank,cancel});
})();
