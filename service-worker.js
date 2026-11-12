/* Offline caching for GitHub Pages (also works at /repo-name/ subpaths). */
'use strict';
const CACHE_NAME = 'serena-nihongo-arcade-v2-2-0';
const CORE = [
  './','./index.html','./styles.css','./game.js','./data.js',
  './favicon.webp','./manifest.webmanifest',
  './assets/bg-tokyo.webp','./assets/bg-airport.webp','./assets/bg-train.webp',
  './assets/bg-hotel.webp','./assets/bg-restaurant.webp','./assets/bg-jpo.webp',
  './assets/bg-classroom.webp','./assets/bg-konbini.webp',
  './assets/bg-cafe.webp','./assets/bg-shopping.webp',
  './assets/npc-airport.webp','./assets/npc-train.webp',
  './assets/npc-hotel.webp','./assets/npc-restaurant.webp',
  './assets/npc-jpo.webp','./assets/npc-classroom.webp',
  './assets/npc-konbini.webp','./assets/npc-cafe.webp','./assets/npc-shopping.webp',
  './assets/serena-idle.webp','./assets/serena-cheer.webp',
  './assets/mascot.webp','./assets/mascot-wave.webp',
  './assets/concept-gallery.webp','./assets/app-icon-192.webp','./assets/app-icon-512.webp'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(names=>Promise.all(names.filter(n=>n.startsWith('serena-nihongo-arcade-')&&n!==CACHE_NAME).map(n=>caches.delete(n)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request=event.request;
  if(request.method!=='GET') return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin) return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy));}
      return response;
    }).catch(()=>caches.match('./index.html')));
  } else {
    event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{
      if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(request,copy));}
      return response;
    })));
  }
});
