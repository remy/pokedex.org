require('regenerator/runtime');
require('serviceworker-cache-polyfill');

var semver = require('semver');
var keyValueStore = require('../shared/db/keyValueStore');

// Using jake archibald's service worker "semver" style here
// Pattern here is "a.b.c"
// a: version-isolated change, don't let both versions run together
// b: new feature
// c: bug fix
var version = '1.0.0';

var staticContent = [
  '/',
  '/js/worker.js',
  '/js/main.js'
];

var webpContent = [
  '/css/sprites-webp1.css',
  '/css/sprites-webp2.css',
  '/css/sprites-webp3.css'
];

var nonWebpContent = [
  '/css/sprites1.css',
  '/css/sprites2.css',
  '/css/sprites3.css'
];

self.addEventListener('install', function install (event) {
  event.waitUntil((async () => {
    var activeVersionPromise = keyValueStore.get('active-version');
    var cache = await caches.open('pokedex-static-' + version);

    await cache.addAll(staticContent);

    var activeVersion = await activeVersionPromise;

    if (!activeVersion ||
        semver.parse(activeVersion).major === semver.parse(version).major) {
      // wrapping in an if while Chrome 40 is still around.
      if (self.skipWaiting) {
        self.skipWaiting();
      }
    }
  })());
});

self.onmessage = async function onmessage (event) {
  console.log('got message', event.data);
  if (event.data.type === 'supportsWebp') {
    var supportsWebp = event.data.value;
    var cache = await caches.open('pokedex-static-' + version);
    await cache.addAll(supportsWebp ? webpContent : nonWebpContent);
  }
};

var expectedCaches = [
  'pokedex-static-' + version
];

self.addEventListener('activate', function(event) {
  event.waitUntil((async () => {
    // activate right now
    await self.clients.claim();
    // remove caches beginning "svgomg-" that aren't in
    // expectedCaches
    var cacheNames = await caches.keys();
    for (var cacheName of cacheNames) {
      if (!/^pokedex-/.test(cacheName)) {
        continue;
      }
      if (expectedCaches.indexOf(cacheName) == -1) {
        await caches.delete(cacheName);
      }
    }

    await keyValueStore.set('active-version', version);
  })());
});

self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request).then(r => r || fetch(event.request))
  );
});