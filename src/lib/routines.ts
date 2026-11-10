export interface RoutineSchedule {
  frequency: string;
  daysOfWeek?: string | null;
  dayOfMonth?: number | null;
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

/**
 * The date a weekly routine is logged on for a given week: the first scheduled
 * day inside that week, so streaks and consistency scores recognise it.
 * Falls back to the Monday of the week when nothing is scheduled in it.
 */
export function firstDueDateInWeek(routine: RoutineSchedule, weekStart: Date): Date {
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    if (isDueToday(routine, d)) return d;
  }
  return new Date(weekStart);
}

/**
 * The date a monthly routine is logged on inside a given month: its
 * day-of-month (0 = last day of the month).
 */
export function dueDateInMonth(routine: RoutineSchedule, monthStart: Date): Date {
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  const day = routine.dayOfMonth ?? 1;
  const target = day === 0 ? lastDay : Math.min(Math.max(day, 1), lastDay);
  const d = new Date(monthStart);
  d.setDate(target);
  return d;
}
