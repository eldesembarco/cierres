// LucIA · Reply Helper - background service worker
// Por ahora minimal — el flow vive en el popup.

self.addEventListener('install', () => {
  // skip waiting para activar al instalar
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
