'use strict';
// File-open play is still supported; service worker activates on secure GitHub Pages hosting.
if('serviceWorker' in navigator && ['https:','http:'].includes(location.protocol)){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./service-worker.js',{scope:'./'}).catch(()=>{});
  });
}
