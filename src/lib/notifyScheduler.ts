/**
 * In-process reminder scheduler. Ticks every 30s and asks the notification
 * layer to send any due-but-undelivered reminder moment for the current app
 * day (days roll over at 05:00).
 *
 * Started once per server process from src/instrumentation.ts — the globalThis
 * guard keeps dev HMR from stacking extra intervals.
 */
import { dispatchDueReminders } from './notifications';

const TICK_MS = 30_000;
const STARTUP_DELAY_MS = 15_000;

const globalStore = globalThis as unknown as {
  /** Interval handle; `unref` exists on Node timers (typed loosely for DOM/node lib overlap). */
  __lifeOsReminderScheduler?: { unref?: () => void };
};

function tick() {
  dispatchDueReminders().catch((error) => {
    console.error('[reminders] dispatch failed:', error);
  });
}

export function ensureReminderScheduler(): void {
  if (globalStore.__lifeOsReminderScheduler) return;

  const interval = setInterval(tick, TICK_MS) as unknown as { unref?: () => void };
  interval.unref?.();
  globalStore.__lifeOsReminderScheduler = interval;

  // First pass shortly after boot: a restart at 10:00 still delivers the 09:00
  // moment (the ReminderDelivery table prevents duplicates).
  const startupTimer = setTimeout(tick, STARTUP_DELAY_MS) as unknown as { unref?: () => void };
  startupTimer.unref?.();
}
