export interface RoutineSchedule {
  frequency: string;
  daysOfWeek: string | null;
  dayOfMonth: number | null;
}

/**
 * Is this routine scheduled to run today?
 * DAILY → always, WEEKLY → matches one of daysOfWeek (0=Sun … 6=Sat),
 * MONTHLY → matches dayOfMonth (0 = last day of month). Anything unknown is
 * treated as due.
 */
export function isDueToday(routine: RoutineSchedule, now: Date = new Date()): boolean {
  if (routine.frequency === 'DAILY') return true;

  if (routine.frequency === 'WEEKLY') {
    if (!routine.daysOfWeek) return false;
    try {
      const days: number[] = JSON.parse(routine.daysOfWeek);
      return days.includes(now.getDay());
    } catch {
      return false;
    }
  }

  if (routine.frequency === 'MONTHLY') {
    const day = routine.dayOfMonth ?? 1;
    if (day === 0) {
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return now.getDate() === lastDay;
    }
    return now.getDate() === day;
  }

  return true;
}
