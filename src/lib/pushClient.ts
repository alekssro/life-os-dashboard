/**
 * Browser-side helpers for Web Push reminders.
 *
 * This module is client-only: it must never import server code (Prisma,
 * web-push, src/lib/notifications.ts).
 */

export type ReminderSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';

export const SLOT_LABELS: Record<ReminderSlot, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  EVENING: 'Evening',
};

export interface NotificationPrefs {
  enabled: boolean;
  /** Hour of each slot as "HH:MM". */
  slots: Record<ReminderSlot, string>;
}

export interface PushResult {
  ok: boolean;
  error?: string;
  permission?: NotificationPermission | 'unsupported';
}

export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getServerConfig(): Promise<{ publicKey: string | null; pushConfigured: boolean }> {
  const res = await fetch('/api/notifications/preferences');
  if (!res.ok) throw new Error('Could not load notification settings.');
  const data = await res.json();
  return { publicKey: data.publicKey ?? null, pushConfigured: Boolean(data.pushConfigured) };
}

/**
 * Subscribe this device. Prompts for permission unless `requestPermission` is
 * false (silent re-subscribe on page load for an already-granted permission).
 */
async function syncSubscription(requestPermission: boolean): Promise<PushResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push notifications are not supported in this browser.', permission: 'unsupported' };
  }

  let permission = Notification.permission;
  if (permission !== 'granted') {
    if (!requestPermission) return { ok: false, permission };
    permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return {
        ok: false,
        permission,
        error:
          permission === 'denied'
            ? 'Notifications are blocked for this site. Enable them in your browser settings.'
            : 'Notification permission was not granted.',
      };
    }
  }

  try {
    const { publicKey, pushConfigured } = await getServerConfig();
    if (!pushConfigured || !publicKey) {
      return {
        ok: false,
        permission,
        error: 'The server is missing its VAPID keys (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).',
      };
    }

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const json = subscription.toJSON();
    const res = await fetch('/api/notifications/push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: json.endpoint,
        keys: { p256dh: json.keys?.p256dh, auth: json.keys?.auth },
      }),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({}));
      return { ok: false, permission, error: error.error || 'Failed to register this device.' };
    }

    return { ok: true, permission };
  } catch (error: any) {
    return { ok: false, permission, error: error?.message || 'Failed to register this device.' };
  }
}

/** Ask for permission and register this device for reminders. */
export function enablePushNotifications(): Promise<PushResult> {
  return syncSubscription(true);
}

/** Re-register silently when permission was already granted earlier. */
export function ensurePushSubscription(): Promise<PushResult> {
  return syncSubscription(false);
}

/** Unregister this device (used when reminders are switched off). */
export async function disablePushNotifications(): Promise<PushResult> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return { ok: true };

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    const subscription = await registration?.pushManager.getSubscription();
    if (subscription) {
      await fetch('/api/notifications/push', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: subscription.endpoint }),
      });
      await subscription.unsubscribe();
    }
    return { ok: true, permission: Notification.permission };
  } catch (error: any) {
    return { ok: false, error: error?.message || 'Failed to unregister this device.' };
  }
}
