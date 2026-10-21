const CACHE_NAME = 'life-os-v2';
const OFFLINE_URL = '/offline.html';
const API_CACHE_NAME = 'life-os-api-v1';

const STATIC_ASSETS = [
  '/',
  '/offline.html',
  '/icon.png',
  '/icon.svg',
  '/apple-icon.png',
  '/manifest.json',
];

const API_PATHS = [
  '/api/tasks',
  '/api/domains',
  '/api/projects',
  '/api/routines',
  '/api/contacts',
  '/api/events',
  '/api/inbox',
];

async function installServiceWorker() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(STATIC_ASSETS);
  await caches.open(API_CACHE_NAME);
  self.skipWaiting();
}

async function activateServiceWorker() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames
      .filter((name) => name !== CACHE_NAME && name !== API_CACHE_NAME)
      .map((name) => caches.delete(name))
  );
  await self.clients.claim();
}

async function fetchWithCacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return caches.match(OFFLINE_URL);
  }
}

async function fetchWithNetworkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function fetchWithStaleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        const cache = caches.open(API_CACHE_NAME);
        cache.then((c) => c.put(request, response.clone()));
      }
      return response;
    })
    .catch(() => cached);

  return cached || fetchPromise;
}

function isApiRequest(url) {
  return API_PATHS.some((path) => url.pathname.startsWith(path));
}

function isMutationRequest(request) {
  return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
}

async function handleRequest(request) {
  const url = new URL(request.url);

  if (isApiRequest(url)) {
    if (isMutationRequest(request)) {
      return handleMutation(request);
    }
    return fetchWithStaleWhileRevalidate(request);
  }

  // Any other /api/* endpoint (notifications, calendar, capture…) must always
  // hit the network. These used to fall through to fetchWithCacheFirst, which
  // froze the first response forever — e.g. the Settings notification toggle
  // read a stale preferences snapshot and appeared not to stick.
  if (url.pathname.startsWith('/api/')) {
    try {
      return await fetch(request);
    } catch {
      return new Response(JSON.stringify({ error: 'Offline' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  if (request.mode === 'navigate') {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      return caches.match(OFFLINE_URL);
    }
  }

  return fetchWithCacheFirst(request);
}

async function handleMutation(request) {
  try {
    const response = await fetch(request);
    return response;
  } catch {
    await queueOfflineMutation(request);
    return new Response(JSON.stringify({ queued: true, offline: true }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function queueOfflineMutation(request) {
  const db = await openOfflineDB();
  const tx = db.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');

  const body = await request.clone().text();
  await store.add({
    url: request.url,
    method: request.method,
    headers: [...request.headers.entries()],
    body,
    timestamp: Date.now(),
  });

  await tx.done;
  db.close();

  registerSync();
}

function openOfflineDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('LifeOSOffline', 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('mutations')) {
        db.createObjectStore('mutations', { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function registerSync() {
  if ('serviceWorker' in navigator && 'sync' in registration) {
    registration.sync.register('sync-mutations');
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(installServiceWorker());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(activateServiceWorker());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' && !isMutationRequest(event.request)) {
    return;
  }
  event.respondWith(handleRequest(event.request));
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-mutations') {
    event.waitUntil(syncMutations());
  }
});

async function syncMutations() {
  const db = await openOfflineDB();
  const tx = db.transaction('mutations', 'readwrite');
  const store = tx.objectStore('mutations');
  const mutations = await store.getAll();

  for (const mutation of mutations) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      });
      if (response.ok) {
        await store.delete(mutation.id);
      }
    } catch {
      // Keep in queue for next sync
    }
  }

  await tx.done;
  db.close();

  if (mutations.length > 0) {
    notifyClients('mutations-synced', { count: mutations.length });
  }
}

function notifyClients(type, data) {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) => {
      client.postMessage({ type, data });
    });
  });
}

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});

// ------------------------------------------------------------------------------
// Web Push reminders (daily task / routine notifications)
// ------------------------------------------------------------------------------
self.addEventListener('push', (event) => {
  let payload = { title: 'Life OS', body: '', tag: 'reminder', url: '/' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon.png',
      badge: '/icon.png',
      tag: payload.tag,
      data: { url: payload.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});