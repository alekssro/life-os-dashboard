/**
 * Runs once when the Next.js server (Node.js runtime) boots.
 * Starts the reminder scheduler that pushes daily task/routine notifications.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ensureReminderScheduler } = await import('./lib/notifyScheduler');
    ensureReminderScheduler();
  }
}
