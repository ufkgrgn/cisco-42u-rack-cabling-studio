const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function evaluate(input){if(input?.format!=='rack-studio-field-pilot'||input.version!==1||!Array.isArray(input.runs))throw new Error('Invalid pilot capture');
  const tasks=['prepare','install','label','qr','evidence','handover','reopen'],users=new Set(),projects=new Set(),blockers=[],runs=[];
  for(const row of input.runs){if(!/^[a-zA-Z0-9_-]{1,80}$/.test(row.participant)||!/^[a-zA-Z0-9_-]{1,80}$/.test(row.project))throw new Error('Use anonymous participant/project codes');
    if(!Array.isArray(row.tasks)||!Number.isFinite(row.baselineMinutes)||row.baselineMinutes<=0||!Number.isFinite(row.productMinutes)||row.productMinutes<=0||!Number.isInteger(row.helpCount)||row.helpCount<0)throw new Error('Missing comparable timings/tasks/help count');
    if(row.dataLoss)blockers.push('data-loss');if(tasks.some(task=>!row.tasks.some(result=>result.task===task&&result.completedByUser===true)))blockers.push('critical-task-incomplete');
    if(row.environment!=='real-field'||!row.evidenceReviewedBy||!Array.isArray(row.evidenceHashes)||!row.evidenceHashes.length||row.evidenceHashes.some(value=>!/^[a-f0-9]{64}$/.test(value)))blockers.push('field-evidence-missing');
    users.add(row.participant);projects.add(row.project);runs.push({participant:row.participant,project:row.project,savedMinutes:row.baselineMinutes-row.productMinutes,helpCount:row.helpCount});
  }
  if(users.size<3||projects.size<2)blockers.push('insufficient-users-or-projects');return{format:'rack-studio-field-pilot-evaluation',version:1,evidenceTier:'operator-reported; reviewer evidence required',participants:users.size,projects:projects.size,passed:blockers.length===0,blockers:[...new Set(blockers)],runs,inputHash:crypto.createHash('sha256').update(JSON.stringify(input)).digest('hex')};
}
module.exports={evaluate};if(require.main===module){const file=process.argv[2];if(!file)throw new Error('Provide an anonymous pilot capture JSON file');const report=evaluate(JSON.parse(fs.readFileSync(file,'utf8'))),target=path.resolve('docs/product-plan/results/p22-p31/field-pilot.json');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(report,null,2));console.log(`Field pilot: ${report.passed?'review evidence':'open'} · ${report.participants} participants · ${report.projects} projects`);}
