const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),cases=require('./catalog-pilot-cases.cjs'),window={RackStudio:{}};
for(const file of ['js/catalog-source-pack.js','js/integrations/catalog-reranker.js'])vm.runInNewContext(fs.readFileSync(path.join(root,file),'utf8'),{window,performance,setTimeout,clearTimeout});
const R=window.RackStudio,candidates=Object.entries(R.CatalogSourcePack.models).map(([id,item])=>R.CatalogReranker.publicCandidate(id,item)).filter(Boolean);
async function main(){
  const live=process.argv.includes('--live');if(live&&!process.env.TYPESAFE_API_KEY)throw new Error('Live evaluation needs TYPESAFE_API_KEY');const results=[];
  for(const item of cases){
    const shortlist=R.CatalogReranker.shortlist(item.query,candidates),baseline=shortlist.map(row=>row.id);let response=null;
    if(live)response=await R.CatalogReranker.rank(item.query,candidates,async input=>{
      const questions=Object.fromEntries(input.candidates.map((row,i)=>[`candidate_${i}`,{type:'noul',instructions:`Does candidates[${i}] match query? Use only supplied catalog facts. Unknown specifications are not matches.`,criteria:{true:'Candidate satisfies supplied request and evidence',false:'Irrelevant, incompatible or unknown'}}]));
      const res=await fetch('https://api.typesafe.ai/v1/systemone',{method:'POST',headers:{Authorization:'Bearer '+process.env.TYPESAFE_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({model:'jev-latest',state:input,questions}),signal:AbortSignal.timeout(1500)});if(!res.ok)throw new Error('AI HTTP '+res.status);const data=await res.json();return{scores:input.candidates.map((row,i)=>({id:row.id,score:data.answers?.['candidate_'+i]?.noul})),model:data.model,usage:data.usage};
    });
    const correct=ids=>item.expected.length?ids.slice(0,3).some(id=>item.expected.includes(id)):ids.length===0;
    results.push({...item,baseline,baselineCorrect:correct(baseline),ai:response,aiCorrect:response?.status==='ranked'||response?.status==='no-match'?correct(response.ids):null});
  }
  const technical=results.filter(row=>row.category==='technical'),score=(rows,key)=>rows.filter(row=>row[key]===true).length/rows.length;
  const improvement=live?score(technical,'aiCorrect')-score(technical,'baselineCorrect'):null;
  const report={format:'rack-studio-catalog-pilot',version:1,mode:live?'live':'baseline-only',createdAt:new Date().toISOString(),fixtureHash:crypto.createHash('sha256').update(JSON.stringify(cases)).digest('hex'),catalogHash:crypto.createHash('sha256').update(JSON.stringify(candidates)).digest('hex'),queries:results.length,publicCandidates:candidates.length,technicalTop3Improvement:improvement,
    gate:{passed:live&&improvement>=.1&&results.every(row=>row.aiCorrect!==null&&row.ai.elapsedMs<=1500)&&results.filter(row=>row.category==='exact').every(row=>row.aiCorrect),reason:live?'Check measured improvement, exact matches and latency':'No live credentials or quality/cost evidence; experiment stays off. Two public models cannot establish top-3 improvement.'},results};
  fs.mkdirSync(path.join(root,'docs/product-plan/results/p22-p31'),{recursive:true});fs.writeFileSync(path.join(root,'docs/product-plan/results/p22-p31/catalog-pilot.json'),JSON.stringify(report,null,2));console.log(`${report.queries} TR/EN queries · ${report.publicCandidates} public candidates · ${report.mode} · gate ${report.gate.passed?'passed':'open'}`);
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
