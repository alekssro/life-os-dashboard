'use client';

import { useEffect, useState } from 'react';

interface OfflineMutation {
  id?: number;
  url: string;
  method: string;
  headers: [string, string][];
  body: string;
  timestamp: number;
}

const DB_NAME = 'LifeOSOffline';
const STORE_NAME = 'mutations';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (db && !db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function promisifyTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function queueMutation(request: Request): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);

  const body = await request.clone().text();
  const headersArray: [string, string][] = [];
  request.headers.forEach((value, key) => {
    headersArray.push([key, value]);
  });
  await promisifyRequest(store.add({
    url: request.url,
    method: request.method,
    headers: headersArray,
    body,
    timestamp: Date.now(),
  }));

  await promisifyTransaction(tx);
  db.close();

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if ('sync' in reg) {
        await (reg as any).sync.register('sync-mutations');
      }
    } catch {
      // Ignore sync registration errors
    }
  }
}

export async function getPendingMutations(): Promise<OfflineMutation[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readonly');
  const store = tx.objectStore(STORE_NAME);
  const mutations = await promisifyRequest(store.getAll());
  await promisifyTransaction(tx);
  db.close();
  return mutations;
}

export async function clearMutation(id: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  await promisifyRequest(store.delete(id));
  await promisifyTransaction(tx);
  db.close();
}

export function useOfflineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
    };

    const updatePendingCount = async () => {
      const mutations = await getPendingMutations();
      setPendingCount(mutations.length);
    };

    updateOnlineStatus();
    updatePendingCount();

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'mutations-synced') {
          updatePendingCount();
        }
      });
    }

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  return { isOnline, pendingCount };
}

export async function retryPendingMutations(): Promise<void> {
  const mutations = await getPendingMutations();
  for (const mutation of mutations) {
    try {
      const response = await fetch(mutation.url, {
        method: mutation.method,
        headers: mutation.headers,
        body: mutation.body,
      });
      if (response.ok && mutation.id) {
        await clearMutation(mutation.id);
      }
    } catch {
      // Keep in queue
    }
  }
}

let onlineCheckInterval: ReturnType<typeof setInterval> | null = null;

export function startOnlineCheck(intervalMs = 30000) {
  if (onlineCheckInterval) return;
  onlineCheckInterval = setInterval(async () => {
    if (navigator.onLine) {
      await retryPendingMutations();
    }
  }, intervalMs);
}

export function stopOnlineCheck() {
  if (onlineCheckInterval) {
    clearInterval(onlineCheckInterval);
    onlineCheckInterval = null;
  }
}