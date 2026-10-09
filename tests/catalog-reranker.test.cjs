const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function model(){const window={RackStudio:{}};vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,'../js/integrations/catalog-reranker.js'),'utf8'),{window,performance,setTimeout,clearTimeout});return window.RackStudio.CatalogReranker;}
const candidates=Array.from({length:30},(_,i)=>({id:'model-'+i,name:'Switch '+i,model:'SKU-'+i,description:'24 ports'}));
test('only filtered shortlist is scored; malformed or foreign model results fall back',async()=>{const R=model();let seen;
  const result=await R.rank('switch',candidates,async input=>{seen=input;return{scores:input.candidates.map(row=>({id:row.id,score:.9})),model:'fixture'};});assert.equal(seen.candidates.length,20);assert.equal(result.ids.length,20);
  assert.equal((await R.rank('bad',candidates,async()=>({scores:[{id:'foreign',score:1}]}))).status,'fallback');
  assert.equal((await R.rank('timeout',candidates,()=>new Promise(()=>{}),{timeoutMs:5})).status,'fallback');
  assert.equal((await R.rank('none',candidates,async input=>({scores:input.candidates.map(row=>({id:row.id,score:.1}))}))).status,'no-match');
});
test('late responses cannot replace a new search; cache and public catalog boundary hold',async()=>{const R=model();let finish;const late=R.rank('old',candidates,()=>new Promise(resolve=>{finish=resolve;}));R.cancel();finish({scores:candidates.slice(0,20).map(row=>({id:row.id,score:.8}))});assert.equal((await late).status,'stale');
  assert.equal(R.publicCandidate('custom',{name:'PRIVATE CUSTOMER HOSTNAME'}),null);
  const publicRow=R.publicCandidate('public',{name:'Public',ports:Array.from({length:48},()=>({type:'rj45',speed:'1000M'})),provenance:{source:{kind:'manufacturer',title:'Source',url:'https://example.test'},unknownFields:['power']},customer:'SECRET'});
  assert.doesNotMatch(JSON.stringify(publicRow),/SECRET/);assert.match(publicRow.description,/48/);
  const transport=async input=>({scores:input.candidates.map(row=>({id:row.id,score:.9}))});await R.rank('cached',candidates,transport);assert.equal((await R.rank('cached',candidates,()=>{throw new Error();})).cached,true);
});
