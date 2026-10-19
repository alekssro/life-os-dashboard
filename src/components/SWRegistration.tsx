'use client';

import React, { useEffect } from 'react';
import { ensurePushSubscription } from '@/lib/pushClient';

export function SWRegistration() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;

    const registerSW = async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js', {
          scope: '/',
        });

        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (!newWorker) return;

          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner();
            }
          });
        });

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        navigator.serviceWorker.addEventListener('message', (event) => {
          if (event.data.type === 'mutations-synced') {
            console.log(`Synced ${event.data.data.count} offline changes`);
          }
        });

        console.log('Service Worker registered:', registration.scope);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
    }

    // If this device already allowed notifications, silently (re)register it
    // for the daily reminder push — no permission prompt is shown.
    if ('Notification' in window && Notification.permission === 'granted') {
      ensurePushSubscription().catch(() => {});
    }

    return () => {
      window.removeEventListener('load', registerSW);
    };
  }, []);

  const showUpdateBanner = () => {
    const banner = document.createElement('div');
    banner.className = 'fixed top-4 left-4 right-4 md:top-6 md:left-auto md:right-6 md:w-80 z-50 animate-in slide-down duration-300';
    banner.innerHTML = `
      <div class="bg-[var(--paper-accent)] text-white rounded-xl p-4 shadow-xl flex items-center justify-between">
        <span className="text-sm">A new version is available!</span>
        <button id="sw-update-btn" class="px-3 py-1.5 text-xs font-medium bg-white text-[var(--paper-accent)] rounded-lg hover:opacity-90 transition-opacity">Refresh</button>
      </div>
    `;
    document.body.appendChild(banner);
    document.getElementById('sw-update-btn')?.addEventListener('click', () => {
      window.location.reload();
    });
  };

  return null;
}