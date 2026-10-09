// Windows indexers/previewers can briefly lock existing visual evidence files.
// Retry only generated PNG writes; product storage errors still fail immediately.
const fs=require('node:fs'),path=require('node:path');
if(process.platform==='win32'){
  const write=fs.promises.writeFile.bind(fs.promises),directory=path.resolve(__dirname,'../../docs/product-plan/results')+path.sep;
  fs.promises.writeFile=async function(file,...args){const target=typeof file==='string'?path.resolve(file):'';for(let attempt=0;;attempt++){try{return await write(file,...args);}catch(error){if(attempt>=4||!target.startsWith(directory)||!target.endsWith('.png')||!['UNKNOWN','EBUSY','EPERM','EACCES'].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,50*2**attempt));}}};
}
