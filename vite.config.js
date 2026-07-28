import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

function offlineServiceWorker() {
  return {
    name: 'offline-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const generated = Object.keys(bundle).filter(file => !file.endsWith('.map')).map(file => `/${file}`)
      const precache = [...new Set(['/', '/index.html', '/manifest.webmanifest', '/icons/icon.svg', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', ...generated])]
      const source = `const CACHE='learnit-${Date.now()}';const PRECACHE=${JSON.stringify(precache)};
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(PRECACHE)));self.skipWaiting()});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))));self.clients.claim()});
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.startsWith('/supabase/'))return;if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put('/index.html',response.clone()));return response}).catch(()=>caches.match('/index.html')));return}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(event.request,response.clone()));return response})))})`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  plugins: [
    vue(),
    offlineServiceWorker(),
  ],
})
