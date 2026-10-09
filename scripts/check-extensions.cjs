const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),files=['js/2d/project-lifecycle.js','js/product-diagnostics.js'];
for(const directory of ['js/integrations','js/collaboration','server'])for(const entry of fs.readdirSync(path.join(root,directory),{withFileTypes:true}))if(entry.isFile()&&/\.(js|mjs)$/.test(entry.name))files.push(directory+'/'+entry.name);
for(const file of files){const result=spawnSync(process.execPath,['--check',file],{cwd:root,stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);}console.log(`${files.length} integration/workspace/lifecycle modules checked`);
