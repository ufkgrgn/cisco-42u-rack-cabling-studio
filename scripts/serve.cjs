const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const mime = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
http.createServer((req,res) => {
  let url;
  try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400).end(); return; }
  const relative = url === '/' ? 'index.html' : url.slice(1);
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || relative.split(/[\\/]/).some(part => part.startsWith('.'))) { res.writeHead(403).end(); return; }
  fs.readFile(target,(error,body) => {
    if(error) { res.writeHead(404).end('Not found'); return; }
    res.writeHead(200,{'Content-Type':mime[path.extname(target)] || 'application/octet-stream','Cache-Control':'no-cache'}); res.end(body);
  });
}).listen(Number(process.env.PORT || 4173),'127.0.0.1',() => console.log(`Rack Studio: http://127.0.0.1:${process.env.PORT || 4173}`));
