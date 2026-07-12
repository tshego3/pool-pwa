/// <reference lib="webworker" />

import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// Workbox injects the precache manifest at build time. This precaches the whole
// app shell - every JS chunk (including the bot worker), CSS, fonts, icons, and
// sounds - so once installed the app runs fully offline with no runtime fetch.
precacheAndRoute(self.__WB_MANIFEST);

// Network-first for page navigations only: try the network so a fresh deploy is
// picked up when online, and fall back to the precached app shell (index.html)
// when offline. Gameplay uses the hash router, so it never triggers a
// navigation - the DevTools network tab stays empty during play.
const appShell = createHandlerBoundToURL('index.html');

self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      appShell({ request: event.request, event, url: new URL(event.request.url) }),
    ),
  );
});

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});
