/* Generated release identity and same-origin asset list are injected at build time. */
const RELEASE = __FIELD_RELEASE__;
const BASE = new URL('./', self.location.href);
const PREFIX = 'rack-studio-field:' + BASE.pathname + ':';
const CACHE = PREFIX + RELEASE.version;
const urls = RELEASE.assets.map(path => new URL(path, BASE).href);
self.addEventListener('install', event => event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  try { for(const url of urls){const response=await fetch(new Request(url,{cache:'reload'}));if(!response.ok)throw new Error('Offline asset unavailable: '+url);await cache.put(url,response);} }
  catch(error){await caches.delete(CACHE);throw error;}
  // No skipWaiting: an open field session adopts a new release explicitly.
})()));
self.addEventListener('activate', event=>event.waitUntil(self.clients.claim()));
self.addEventListener('message', event=>{
  if(event.data?.type==='ACTIVATE_FIELD_UPDATE')event.waitUntil((async()=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const others=clients.filter(c=>c.id!==event.source?.id&&c.url.startsWith(BASE.href));if(others.length){event.ports[0]?.postMessage({accepted:false,reason:'Diğer Rack Studio sekmelerini kapatıp tekrar deneyin.'});return;}event.ports[0]?.postMessage({accepted:true});await self.skipWaiting();})());
  if(event.data?.type==='FIELD_STATUS')event.waitUntil((async()=>{const cache=await caches.open(CACHE);let ready=true;for(const url of urls)if(!(await cache.match(url))){ready=false;break;}event.ports[0]?.postMessage({ready,version:RELEASE.version,count:urls.length});})());
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==BASE.origin||!url.pathname.startsWith(BASE.pathname))return;
  const key=event.request.mode==='navigate'?new URL('index.html',BASE).href:url.href;
  if(!urls.includes(key))return;
  event.respondWith((async()=>{const cached=await(await caches.open(CACHE)).match(key);return cached||fetch(event.request);})());
});
