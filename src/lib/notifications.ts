/**
 * Daily reminder notifications (Web Push).
 *
 * Rules:
 *  - Three "slots" (Morning / Afternoon / Evening) each have a configurable
 *    hour (09:00 / 15:00 / 21:00 by default), stored in the Setting table.
 *  - Routines due today are reminded through their own timeOfDay slot.
 *  - Tasks are reminded through: explicit reminderAt → task dueTime → Morning.
 *    `reminderAt` may also be 'NONE' (never remind) or 'HH:MM' (exact time).
 *  - Each slot/time fires at most once per app day (the day rolls over at
 *    05:00 — see appDayStart in ./date), guaranteed by ReminderDelivery.
 *
 * Everything here runs on the server only: never import this module from a
 * client component (web-push + Prisma are Node-only).
 */
import webpush from 'web-push';
import { prisma } from './prisma';
import { appDayStart, toISODate } from './date';
import { isDueToday } from './routines';
import { getSetting, setSetting } from './settings';

export type ReminderSlot = 'MORNING' | 'AFTERNOON' | 'EVENING';

export const REMINDER_SLOTS: ReminderSlot[] = ['MORNING', 'AFTERNOON', 'EVENING'];

export const SLOT_LABELS: Record<ReminderSlot, string> = {
  MORNING: 'Morning',
  AFTERNOON: 'Afternoon',
  EVENING: 'Evening',
};

export interface NotificationPrefs {
  enabled: boolean;
  /** Hour of each slot as "HH:MM" (local server time). */
  slots: Record<ReminderSlot, string>;
}

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  enabled: true,
  slots: { MORNING: '09:00', AFTERNOON: '15:00', EVENING: '21:00' },
};

const PREFS_KEY = 'notification_prefs';
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** "9:5" → "09:05", anything unusable → null. */
export function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(TIME_RE);
  if (!match) return null;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

/** Accepts "14:30", "2:30 PM", "2:30PM" → { minutes, key: "14:30" }. */
export function parseLooseTime(value: unknown): { minutes: number; key: string } | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!match) return null;
  let hours = Number(match[1]);
  const minutes = Number(match[2]);
  const meridiem = match[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return {
    minutes: hours * 60 + minutes,
    key: `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`,
  };
}

export function toMinutes(time: string): number {
  const parsed = parseLooseTime(time);
  return parsed ? parsed.minutes : 0;
}

export async function getNotificationPrefs(): Promise<NotificationPrefs> {
  try {
    const raw = await getSetting(PREFS_KEY);
    if (!raw) return { ...DEFAULT_NOTIFICATION_PREFS, slots: { ...DEFAULT_NOTIFICATION_PREFS.slots } };
    const parsed = JSON.parse(raw);
    return {
      enabled: parsed?.enabled !== false,
      slots: {
        MORNING: normalizeTime(parsed?.slots?.MORNING) ?? DEFAULT_NOTIFICATION_PREFS.slots.MORNING,
        AFTERNOON: normalizeTime(parsed?.slots?.AFTERNOON) ?? DEFAULT_NOTIFICATION_PREFS.slots.AFTERNOON,
        EVENING: normalizeTime(parsed?.slots?.EVENING) ?? DEFAULT_NOTIFICATION_PREFS.slots.EVENING,
      },
    };
  } catch (error) {
    console.error('Failed to read notification prefs:', error);
    return { ...DEFAULT_NOTIFICATION_PREFS, slots: { ...DEFAULT_NOTIFICATION_PREFS.slots } };
  }
}

export async function saveNotificationPrefs(prefs: NotificationPrefs): Promise<NotificationPrefs> {
  const clean: NotificationPrefs = {
    enabled: prefs.enabled !== false,
    slots: {
      MORNING: normalizeTime(prefs.slots?.MORNING) ?? DEFAULT_NOTIFICATION_PREFS.slots.MORNING,
      AFTERNOON: normalizeTime(prefs.slots?.AFTERNOON) ?? DEFAULT_NOTIFICATION_PREFS.slots.AFTERNOON,
      EVENING: normalizeTime(prefs.slots?.EVENING) ?? DEFAULT_NOTIFICATION_PREFS.slots.EVENING,
    },
  };
  await setSetting(PREFS_KEY, JSON.stringify(clean));
  return clean;
}

// ------------------------------------------------------------------------------
// VAPID / subscriptions
// ------------------------------------------------------------------------------

export function getVapidConfig(): { subject: string; publicKey: string; privateKey: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return {
    subject: process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@localhost',
    publicKey,
    privateKey,
  };
}

export function isPushConfigured(): boolean {
  return getVapidConfig() !== null;
}

export interface PushSubscriptionInput {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}

export async function savePushSubscription(input: PushSubscriptionInput): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: input.endpoint },
    create: {
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      userAgent: input.userAgent ?? null,
      lastUsedAt: new Date(),
    },
    update: { p256dh: input.p256dh, auth: input.auth, lastUsedAt: new Date() },
  });
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

// ------------------------------------------------------------------------------
// Dispatch
// ------------------------------------------------------------------------------

interface ReminderPayload {
  title: string;
  body: string;
  tag: string;
  url: string;
}

interface DigestMoment {
  key: string;
  minutes: number;
  tasks: Array<{
    id: string;
    title: string;
    dueDate: Date | null;
    overdue: boolean;
  }>;
  routines: Array<{ id: string; title: string; icon: string | null }>;
}

const MAX_BODY_ITEMS = 6;

function taskLine(task: DigestMoment['tasks'][number]): string {
  return `• ${task.overdue ? '⚠ ' : ''}${task.title}`;
}

function routineLine(routine: DigestMoment['routines'][number]): string {
  return `• ${routine.icon || '✓'} ${routine.title}`;
}

function countText(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}

function buildPayload(
  moment: DigestMoment,
  date: string,
  slotLabel?: string
): ReminderPayload | null {
  const { tasks, routines } = moment;
  if (tasks.length === 0 && routines.length === 0) return null;

  const tag = `reminder-${date}-${moment.key}`;

  // Exact-time reminder for a single task: use its own title.
  if (!slotLabel && tasks.length > 0 && routines.length === 0) {
    const title = tasks.length === 1 ? tasks[0].title : tasks.map((t) => t.title).join(' · ');
    return {
      title,
      body: `Task reminder · ${moment.key}${tasks[0].overdue ? ' · overdue' : ''}`,
      tag,
      url: '/',
    };
  }

  const label = slotLabel || `${moment.key} reminder`;
  const parts = [
    tasks.length > 0 ? countText(tasks.length, 'task') : '',
    routines.length > 0 ? countText(routines.length, 'routine') : '',
  ].filter(Boolean);

  const lines = [
    ...tasks.map(taskLine),
    ...routines.map(routineLine),
  ];
  const overflow = lines.length - MAX_BODY_ITEMS;

  return {
    title: `${label} · ${parts.join(' · ')}`,
    body: lines.slice(0, MAX_BODY_ITEMS).join('\n') + (overflow > 0 ? `\n…and ${overflow} more` : ''),
    tag,
    url: '/',
  };
}

/**
 * Send every reminder moment whose time has passed for the current app day and
 * that has not been delivered yet. Safe to call as often as you like — the
 * ReminderDelivery table guarantees at most one delivery per moment per day.
 */
export async function dispatchDueReminders(
  now: Date = new Date()
): Promise<{ sent: number; moments: number }> {
  const prefs = await getNotificationPrefs();
  if (!prefs.enabled) return { sent: 0, moments: 0 };

  const vapid = getVapidConfig();
  if (!vapid) return { sent: 0, moments: 0 };

  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  } catch (error) {
    console.error('[reminders] invalid VAPID configuration:', error);
    return { sent: 0, moments: 0 };
  }

  // No early return when there are no subscriptions: the in-app digest and the
  // delivery bookkeeping must keep working so reminders still show up under
  // Today → Notifications (and so a device that subscribes later cannot get a
  // stale burst of already-consumed moments).
  const subscriptions = await prisma.pushSubscription.findMany();

  const dayStart = appDayStart(now);
  const date = toISODate(dayStart);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const slotMinutes: Record<ReminderSlot, number> = {
    MORNING: toMinutes(prefs.slots.MORNING),
    AFTERNOON: toMinutes(prefs.slots.AFTERNOON),
    EVENING: toMinutes(prefs.slots.EVENING),
  };

  const [routines, tasks] = await Promise.all([
    prisma.routine.findMany({
      where: { active: true },
      include: { logs: { where: { date } } },
      orderBy: [{ timeOfDay: 'asc' }, { order: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.task.findMany({
      // Everything still open that was due today or earlier (the day boundary
      // is 05:00, so "today" here is the app day, not the calendar day).
      where: {
        status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] },
        dueDate: { lt: new Date(dayStart.getTime() + 24 * 60 * 60 * 1000) },
      },
      select: { id: true, title: true, dueDate: true, dueTime: true, reminderAt: true },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    }),
  ]);

  const pendingRoutines = routines.filter(
    (r) => isDueToday(r, dayStart) && !r.logs.some((log) => log.date === date && log.completed)
  );

  const slotKeyAt = (minutes: number): ReminderSlot | null =>
    REMINDER_SLOTS.find((slot) => slotMinutes[slot] === minutes) ?? null;

  const moments = new Map<string, DigestMoment>();
  const ensureMoment = (key: string, minutes: number): DigestMoment => {
    let moment = moments.get(key);
    if (!moment) {
      moment = { key, minutes, tasks: [], routines: [] };
      moments.set(key, moment);
    }
    return moment;
  };

  for (const routine of pendingRoutines) {
    const slot: ReminderSlot = REMINDER_SLOTS.includes(routine.timeOfDay as ReminderSlot)
      ? (routine.timeOfDay as ReminderSlot)
      : 'MORNING';
    ensureMoment(slot, slotMinutes[slot]).routines.push({
      id: routine.id,
      title: routine.title,
      icon: routine.icon,
    });
  }

  for (const task of tasks) {
    const rawReminder = (task.reminderAt || '').trim();
    const upper = rawReminder.toUpperCase();

    if (upper === 'NONE') continue;

    let assignment: { key: string; minutes: number } | null = null;

    if (REMINDER_SLOTS.includes(upper as ReminderSlot)) {
      const slot = upper as ReminderSlot;
      assignment = { key: slot, minutes: slotMinutes[slot] };
    } else {
      const explicit = parseLooseTime(rawReminder);
      if (explicit) {
        assignment = { key: explicit.key, minutes: explicit.minutes };
      } else {
        const dueTime = parseLooseTime(task.dueTime);
        assignment = dueTime
          ? { key: dueTime.key, minutes: dueTime.minutes }
          : { key: 'MORNING', minutes: slotMinutes.MORNING };
      }
    }

    if (!assignment) continue;
    // An exact time that coincides with a slot hour folds into that slot, so a
    // single notification goes out instead of two at the same minute.
    const slotAtSameMinute = slotKeyAt(assignment.minutes);
    const key = slotAtSameMinute ?? assignment.key;

    ensureMoment(key, assignment.minutes).tasks.push({
      id: task.id,
      title: task.title,
      dueDate: task.dueDate,
      overdue: !!task.dueDate && new Date(task.dueDate) < dayStart,
    });
  }

  const ordered = Array.from(moments.values()).sort((a, b) => a.minutes - b.minutes);
  let sent = 0;

  // A moment is only delivered up to 60 minutes after its scheduled time
  // (covers a server restart or a missed tick). Anything older is consumed
  // silently so it can never fire as a stale burst later in the day.
  const CATCH_UP_WINDOW_MINUTES = 60;

  for (const moment of ordered) {
    if (moment.minutes > nowMinutes) continue;

    const slotLabel = REMINDER_SLOTS.includes(moment.key as ReminderSlot)
      ? SLOT_LABELS[moment.key as ReminderSlot]
      : undefined;

    const already = await prisma.reminderDelivery.findUnique({
      where: { date_key: { date, key: moment.key } },
    });
    if (already) continue;

    const lateMinutes = nowMinutes - moment.minutes;
    if (lateMinutes > CATCH_UP_WINDOW_MINUTES) {
      console.log(
        `[reminders] ${slotLabel || moment.key} moment is ${lateMinutes} min late — consuming without sending`
      );
      await prisma.reminderDelivery.create({
        data: { date, key: moment.key, title: `${slotLabel || moment.key} · skipped (late)`, recipients: 0 },
      });
      continue;
    }

    const payload = buildPayload(moment, date, slotLabel);

    // Consume the moment even when there is nothing pending, so it never fires
    // later in the day against an empty (or unexpected) list.
    if (!payload) {
      await prisma.reminderDelivery.create({
        data: { date, key: moment.key, title: `${slotLabel || moment.key} · nothing pending`, recipients: 0 },
      });
      continue;
    }

    const recipients = await sendToAll(subscriptions, payload);

    await prisma.systemNotification.create({
      data: { title: payload.title, message: payload.body, type: 'REMINDER' },
    });

    await prisma.reminderDelivery.upsert({
      where: { date_key: { date, key: moment.key } },
      create: { date, key: moment.key, title: payload.title, recipients },
      update: { title: payload.title, recipients, sentAt: new Date() },
    });

    console.log(
      `[reminders] dispatched "${payload.title}" to ${recipients}/${subscriptions.length} device(s)`
    );
    if (recipients > 0) sent += 1;
  }

  return { sent, moments: ordered.length };
}

async function sendToAll(
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: ReminderPayload
): Promise<number> {
  let delivered = 0;
  const body = JSON.stringify(payload);

  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        body,
        // High urgency: Android delays/defers 'normal' pushes under battery
        // optimizations, which silently breaks time-sensitive reminders.
        { TTL: 6 * 60 * 60, urgency: 'high' }
      );
      delivered += 1;
      await prisma.pushSubscription.updateMany({
        where: { endpoint: subscription.endpoint },
        data: { lastUsedAt: new Date() },
      });
    } catch (error: any) {
      // 404/410 = subscription expired or revoked by the browser.
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        console.warn(`[reminders] removing expired subscription ${subscription.endpoint.slice(0, 48)}…`);
        await deletePushSubscription(subscription.endpoint);
        continue;
      }
      console.warn(`[reminders] push to ${subscription.endpoint.slice(0, 48)}… failed:`, error?.message || error);
    }
  }

  return delivered;
}

/**
 * Send an immediate test push to every registered device. Used from
 * Settings → Reminder Notifications to verify the whole chain end-to-end
 * (VAPID → push service → service worker → notification).
 */
export async function sendTestReminder(): Promise<{ ok: boolean; recipients: number; error?: string }> {
  const vapid = getVapidConfig();
  if (!vapid) {
    return { ok: false, recipients: 0, error: 'The server is missing its VAPID keys (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).' };
  }

  try {
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);
  } catch (error) {
    console.error('[reminders] invalid VAPID configuration:', error);
    return { ok: false, recipients: 0, error: 'Invalid VAPID configuration on the server.' };
  }

  const subscriptions = await prisma.pushSubscription.findMany();
  if (subscriptions.length === 0) {
    return {
      ok: false,
      recipients: 0,
      error: 'No devices are registered. Turn Reminder Notifications on in a browser first (and allow the permission).',
    };
  }

  const payload: ReminderPayload = {
    title: 'LifeOS test reminder',
    body: 'Push notifications are working on this device. 🎉',
    tag: 'lifeos-test',
    url: '/',
  };

  const recipients = await sendToAll(subscriptions, payload);
  console.log(`[reminders] test push delivered to ${recipients}/${subscriptions.length} device(s)`);

  if (recipients === 0) {
    return { ok: false, recipients: 0, error: 'The server could not reach any registered device — check the server logs.' };
  }
  return { ok: true, recipients };
}
