const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),hash=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function fingerprint(){const files=[];function walk(dir){for(const entry of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){if(['node_modules','target','gen','permissions','results'].includes(entry.name))continue;const file=(dir?dir+'/':'')+entry.name;if(entry.isDirectory())walk(file);else if(/\.(js|cjs|mjs|ts|tsx|json|toml|lock|sql|rs|css|html|bat|yml)$/.test(file))files.push(file);}}
  for(const dir of ['js','css','scripts','server','src-tauri','src','tests'])walk(dir);
  for(const file of ['index.html','field-sw.js','package.json','package-lock.json','vite.config.ts','tsconfig.json','tsconfig.active-product.json'])files.push(file);
  const entries=[...new Set(files)].sort().filter(file=>fs.existsSync(path.join(root,file))).map(file=>({file,sha256:hash(fs.readFileSync(path.join(root,file)))}));return{sha256:hash(JSON.stringify(entries)),entries};
}
module.exports={root,hash,fingerprint};
