const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..');
fs.mkdirSync(path.join(root,'js/vendor'),{recursive:true});
for(const [from,to]of [['jsqr/dist/jsQR.js','js/vendor/jsqr.js'],['qrcode-generator/qrcode.js','js/vendor/field-qrcode.js'],['jsqr/LICENSE','js/vendor/jsqr-LICENSE.txt'],['pdfmake/build/pdfmake.min.js','js/vendor/pdfmake.min.js'],['pdfmake/build/vfs_fonts.js','js/vendor/vfs_fonts.js'],['pdfmake/LICENSE','js/vendor/pdfmake-LICENSE.txt'],['fflate/umd/index.js','js/vendor/fflate.js'],['fflate/LICENSE','js/vendor/fflate-LICENSE.txt']])fs.copyFileSync(path.join(root,'node_modules',from),path.join(root,to));
const notices=['Roboto font\n'+fs.readFileSync(path.join(root,'assets/licenses/Roboto-LICENSE.txt'),'utf8'),'pdfmake\n'+fs.readFileSync(path.join(root,'node_modules/pdfmake/LICENSE'),'utf8'),'fflate\n'+fs.readFileSync(path.join(root,'node_modules/fflate/LICENSE'),'utf8')].join('\n\n');
fs.writeFileSync(path.join(root,'js/vendor/delivery-notices.js'),'window.RackStudioDeliveryNotices = '+JSON.stringify(notices)+';\n');
const index=fs.readFileSync(path.join(root,'index.html'),'utf8'),assets=new Set(['index.html','field-manifest.webmanifest']);
for(const match of index.matchAll(/(?:src|href)="([^"#]+)"/g)){const file=match[1];if(!file.includes(':')&&fs.existsSync(path.join(root,file))&&fs.statSync(path.join(root,file)).isFile())assets.add(file);}
function walk(dir){for(const e of fs.readdirSync(path.join(root,dir),{withFileTypes:true})){const name=dir+'/'+e.name;if(e.isDirectory())walk(name);else assets.add(name);}}
walk('assets');walk('css');
const list=[...assets].sort(),template=fs.readFileSync(path.join(root,'scripts/field-sw-template.js'),'utf8'),hash=crypto.createHash('sha256').update(template);for(const file of list)hash.update(file).update(fs.readFileSync(path.join(root,file)));
const release={version:hash.digest('hex').slice(0,16),assets:list};
fs.writeFileSync(path.join(root,'field-sw.js'),template.replace('__FIELD_RELEASE__',JSON.stringify(release)));
console.log('Offline release '+release.version+' · '+list.length+' local assets');
