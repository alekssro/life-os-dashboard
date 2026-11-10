/**
 * Frequency-aware streak engine.
 *
 * A habit's streak is counted in the period its own schedule produces:
 *   DAILY   → consecutive days
 *   WEEKLY  → consecutive weeks (one completion per week is enough)
 *   MONTHLY → consecutive months (one completion per month is enough)
 *
 * Rules:
 *  - A period counts as "hit" when the habit was completed at least once
 *    inside it.
 *  - The current period is still running, so an unfinished period never breaks
 *    the chain — it is flagged as "at risk" instead. The streak only breaks
 *    once the period closes unfinished.
 *  - `graceDays` tolerates that many missed periods in a row before the chain
 *    breaks. It is read in the habit's own unit (days / weeks / months).
 *  - Current streak, best streak and consistency are all derived from the same
 *    log history, so the numbers can never disagree.
 *
 * All date maths is local-time: log dates are plain YYYY-MM-DD strings and are
 * parsed with parseISODateLocal, never with `new Date('YYYY-MM-DD')` (which is
 * UTC and shifts the day in western timezones).
 */

import { getMonthStart, getWeekStart, parseISODateLocal, toISODate } from '@/lib/date';

export type StreakUnit = 'DAY' | 'WEEK' | 'MONTH';

export interface StreakSchedule {
  frequency?: string | null;
  daysOfWeek?: string | null;
  dayOfMonth?: number | null;
  graceDays?: number | null;
}

export interface StreakStats {
  /** Consecutive completed periods, counted in `unit`. */
  streak: number;
  /** Longest run of consecutive completed periods ever. */
  bestStreak: number;
  unit: StreakUnit;
  /** Plural unit name: "days" / "weeks" / "months". */
  unitLabel: string;
  /** Compact unit suffix: "d" / "w" / "mo". */
  shortUnit: string;
  /** Human label: "3 weeks". */
  label: string;
  /** Compact label: "3w". */
  shortLabel: string;
  /** Completion rate (0-100) over the trailing window of closed periods. */
  consistencyScore: number;
  /** Periods in the trailing consistency window. */
  windowPeriods: number;
  /** Periods completed inside that window. */
  completedPeriods: number;
  /** The current period is still running and not completed yet. */
  atRisk: boolean;
  /** Missed periods in the live chain that grace is currently covering. */
  graceUsed: number;
  /** Whether the current period has been completed. */
  completedCurrentPeriod: boolean;
}

const UNIT_META: Record<StreakUnit, { unitLabel: string; shortUnit: string }> = {
  DAY: { unitLabel: 'days', shortUnit: 'd' },
  WEEK: { unitLabel: 'weeks', shortUnit: 'w' },
  MONTH: { unitLabel: 'months', shortUnit: 'mo' },
};

/**
 * Trailing window (in periods) the consistency score is measured over:
 * roughly the last four weeks of days, two months of weeks, half a year of
 * months — long enough to be meaningful, short enough to stay actionable.
 */
const CONSISTENCY_WINDOW: Record<StreakUnit, number> = { DAY: 28, WEEK: 8, MONTH: 6 };

/** The unit a habit's streak is measured in. */
export function streakUnitFor(frequency?: string | null): StreakUnit {
  if (frequency === 'WEEKLY') return 'WEEK';
  if (frequency === 'MONTHLY') return 'MONTH';
  return 'DAY';
}

/** Start of the period a date belongs to (local midnight). */
export function periodStart(date: Date, unit: StreakUnit): Date {
  if (unit === 'WEEK') return getWeekStart(date);
  if (unit === 'MONTH') return getMonthStart(date);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Moves a period start by whole periods (negative = backwards). */
export function shiftPeriod(period: Date, unit: StreakUnit, steps: number): Date {
  const d = new Date(period);
  if (unit === 'DAY') d.setDate(d.getDate() + steps);
  else if (unit === 'WEEK') d.setDate(d.getDate() + 7 * steps);
  else d.setMonth(d.getMonth() + steps); // period starts are always the 1st
  return d;
}

/** "3 days" / "1 week" / "12 months". */
export function formatStreakLabel(count: number, unit: StreakUnit): string {
  const { unitLabel } = UNIT_META[unit];
  return `${count} ${count === 1 ? unitLabel.replace(/s$/, '') : unitLabel}`;
}

/** "3d" / "1w" / "12mo". */
export function formatStreakShortLabel(count: number, unit: StreakUnit): string {
  return `${count}${UNIT_META[unit].shortUnit}`;
}

/**
 * Computes the streak statistics of a habit from its completion history.
 *
 * @param schedule   the habit's frequency and grace setting
 * @param completedDates  YYYY-MM-DD dates the habit was completed on
 * @param today      the app day the streak is measured against
 */
export function computeStreak(
  schedule: StreakSchedule,
  completedDates: string[],
  today: Date = new Date()
): StreakStats {
  const unit = streakUnitFor(schedule.frequency);
  const meta = UNIT_META[unit];
  const grace = Math.max(0, schedule.graceDays ?? 0);

  // Every completion mapped onto the period it belongs to.
  const hitPeriods = new Set<string>();
  let earliest: Date | null = null;
  for (const raw of completedDates) {
    if (!raw) continue;
    const date = parseISODateLocal(raw);
    if (isNaN(date.getTime())) continue;
    const start = periodStart(date, unit);
    hitPeriods.add(toISODate(start));
    if (!earliest || start < earliest) earliest = start;
  }

  const current = periodStart(today, unit);
  const currentKey = toISODate(current);
  const completedCurrentPeriod = hitPeriods.has(currentKey);

  const empty: StreakStats = {
    streak: 0,
    bestStreak: 0,
    unit,
    unitLabel: meta.unitLabel,
    shortUnit: meta.shortUnit,
    label: formatStreakLabel(0, unit),
    shortLabel: formatStreakShortLabel(0, unit),
    consistencyScore: 0,
    windowPeriods: 0,
    completedPeriods: 0,
    atRisk: false,
    graceUsed: 0,
    completedCurrentPeriod,
  };

  if (!earliest) return empty;

  // Walk from the first period with a completion up to the current one.
  let period = earliest;
  let run = 0; // consecutive completed periods in the live chain
  let best = 0; // longest run seen
  let consecutiveMissed = 0; // missed periods in a row (decides when the chain breaks)
  let graceUsed = 0; // missed periods the live chain is surviving on
  let atRisk = false;
  let tracked = 0; // periods walked (first completion → current)

  for (;;) {
    const key = toISODate(period);
    const isCurrent = key === currentKey;
    tracked++;

    if (hitPeriods.has(key)) {
      run++;
      if (run > best) best = run;
      // Grace covers consecutive misses, so a completion clears the counter —
      // but the chain keeps the grace it already consumed.
      consecutiveMissed = 0;
    } else if (isCurrent) {
      // The current period is still running: it neither extends nor breaks
      // the chain — the habit is simply "at risk" until the period closes.
      atRisk = true;
    } else {
      consecutiveMissed++;
      graceUsed++;
      if (consecutiveMissed > grace) {
        run = 0; // chain broken
        consecutiveMissed = 0;
        graceUsed = 0;
      }
    }

    if (isCurrent) break;
    period = shiftPeriod(period, unit, 1);
  }

  // Consistency over the trailing window of *closed* periods — the running
  // period is left out so the score does not swing with the time of day.
  const windowPeriods = Math.max(0, Math.min(CONSISTENCY_WINDOW[unit], tracked - 1));
  let completedInWindow = 0;
  let cursor = shiftPeriod(current, unit, -1);
  for (let i = 0; i < windowPeriods; i++) {
    if (hitPeriods.has(toISODate(cursor))) completedInWindow++;
    cursor = shiftPeriod(cursor, unit, -1);
  }
  const consistencyScore =
    windowPeriods > 0
      ? Math.round((completedInWindow / windowPeriods) * 100)
      : completedCurrentPeriod
        ? 100
        : 0;

  const streak = run;

  return {
    streak,
    bestStreak: best,
    unit,
    unitLabel: meta.unitLabel,
    shortUnit: meta.shortUnit,
    label: formatStreakLabel(streak, unit),
    shortLabel: formatStreakShortLabel(streak, unit),
    consistencyScore,
    windowPeriods,
    completedPeriods: completedInWindow,
    // Nothing to protect when the chain is already broken.
    atRisk: atRisk && streak > 0,
    graceUsed,
    completedCurrentPeriod,
  };
}
