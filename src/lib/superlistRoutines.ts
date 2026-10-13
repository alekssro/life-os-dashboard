/**
 * Map Superlist task repetition rules onto Life OS routines.
 *
 * Superlist tasks can carry a `repetition` object (see the Superlist MCP
 * `add_task`/`update_task` tools). Life OS routines only understand
 * DAILY / WEEKLY (specific weekdays) / MONTHLY (day of month), so some Superlist
 * patterns (intervals such as "every 2 weeks", or "the first Monday of the
 * month") can only be approximated.
 *
 * Weekday numbering differs:
 *   - Superlist: 1 = Monday … 7 = Sunday
 *   - JavaScript `Date.getDay()` / Life OS `daysOfWeek`: 0 = Sunday … 6 = Saturday
 */

export type RoutineFrequency = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export type RoutineTimeOfDay = 'MORNING' | 'AFTERNOON' | 'EVENING';

export interface SuperlistRepetition {
  /** Repetition pattern. */
  type: 'daily' | 'weekly' | 'monthly' | 'days_of_week' | 'nth_weekday_of_month';
  /** Interval (days/weeks/months). Life OS routines have no interval, so it is ignored. */
  every?: number | null;
  /** 1-7 (1 = Monday). Used by `weekly` and `nth_weekday_of_month`. */
  day_of_week?: number | null;
  /** Non-empty list of weekdays (1 = Monday). Used by `days_of_week`. */
  days_of_week?: number[] | null;
  /** Day of month (1-31), or 0 meaning "last day of month". Used by `monthly`. */
  day?: number | null;
  /** 1-5. Used by `nth_weekday_of_month`. */
  week_of_month?: number | null;
}

export interface RoutineSchedule {
  frequency: RoutineFrequency;
  /** JSON array string of JS weekdays (0 = Sunday … 6 = Saturday). */
  daysOfWeek: string | null;
  /** 1-31, or 0 for "last day of month". */
  dayOfMonth: number | null;
}

/** Superlist weekday (1 = Monday … 7 = Sunday) to JS `getDay()` (0 = Sunday … 6 = Saturday). */
export function superlistWeekdayToJs(day: number): number {
  return ((day % 7) + 7) % 7;
}

/**
 * Best-effort translation of a Superlist repetition rule into a Life OS routine
 * schedule. Returns null when there is no repetition.
 *
 * - `daily`               → DAILY (interval ignored)
 * - `weekly`              → WEEKLY on `day_of_week`
 * - `days_of_week`        → WEEKLY on the selected weekdays
 * - `monthly`             → MONTHLY on `day` (0 = last day of month)
 * - `nth_weekday_of_month`→ MONTHLY anchored to the due date's day (approximation)
 */
export function mapRepetitionToRoutineSchedule(
  repetition: SuperlistRepetition | null | undefined,
  dueDate?: string | null
): RoutineSchedule | null {
  if (!repetition || !repetition.type) return null;

  switch (repetition.type) {
    case 'daily':
      return { frequency: 'DAILY', daysOfWeek: null, dayOfMonth: null };

    case 'weekly': {
      const days =
        typeof repetition.day_of_week === 'number'
          ? [superlistWeekdayToJs(repetition.day_of_week)]
          : [];
      return { frequency: 'WEEKLY', daysOfWeek: JSON.stringify(days), dayOfMonth: null };
    }

    case 'days_of_week': {
      const days = Array.isArray(repetition.days_of_week)
        ? Array.from(new Set(repetition.days_of_week.map(superlistWeekdayToJs))).sort((a, b) => a - b)
        : [];
      return { frequency: 'WEEKLY', daysOfWeek: JSON.stringify(days), dayOfMonth: null };
    }

    case 'monthly': {
      let day = typeof repetition.day === 'number' ? repetition.day : 1;
      if (day < 0 || day > 31) day = 1;
      // 0 means "last day of the month" and is understood by isDueToday.
      return { frequency: 'MONTHLY', daysOfWeek: null, dayOfMonth: day };
    }

    case 'nth_weekday_of_month': {
      // Not representable exactly. Anchor to the day-of-month of the next due
      // date when available, otherwise fall back to the (week - 1) * 7 + 1
      // approximation.
      let day = NaN;
      if (dueDate) {
        const parsed = new Date(dueDate);
        if (!Number.isNaN(parsed.getTime())) day = parsed.getUTCDate();
      }
      if (!Number.isFinite(day) || day < 1) {
        const week = repetition.week_of_month ?? 1;
        day = (week - 1) * 7 + 1;
      }
      day = Math.min(31, Math.max(1, day));
      return { frequency: 'MONTHLY', daysOfWeek: null, dayOfMonth: day };
    }

    default:
      return null;
  }
}

/**
 * Pick a routine time-of-day bucket from a Superlist due date. Dates without a
 * time (or unparseable values) default to MORNING. When a timezone is given the
 * wall-clock hour is resolved in that timezone (Superlist due dates are UTC).
 */
export function routineTimeOfDayFromDue(
  dueDate: string | null | undefined,
  timezone?: string | null
): RoutineTimeOfDay {
  if (!dueDate || !/T\d{1,2}:\d{2}/.test(dueDate)) return 'MORNING';

  let hour = NaN;
  try {
    if (timezone) {
      hour = parseInt(
        new Intl.DateTimeFormat('en-US', {
          timeZone: timezone,
          hour: 'numeric',
          hourCycle: 'h23',
        }).format(new Date(dueDate)),
        10
      );
    } else {
      hour = new Date(dueDate).getUTCHours();
    }
  } catch {
    hour = new Date(dueDate).getUTCHours();
  }

  if (!Number.isFinite(hour)) return 'MORNING';
  if (hour < 12) return 'MORNING';
  if (hour < 18) return 'AFTERNOON';
  return 'EVENING';
}
