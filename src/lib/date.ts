/**
 * Date formatting utility ensuring strict DD/MM/YYYY format across the dashboard
 */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function formatDateDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return '';

  // Date-only strings carry no timezone, so map them directly (never shifts a day).
  if (typeof date === 'string') {
    const dateOnly = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) return `${dateOnly[3]}/${dateOnly[2]}/${dateOnly[1]}`;
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTimeDDMMYYYY(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const dateStr = formatDateDDMMYYYY(d);
  return `${dateStr} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local calendar date as YYYY-MM-DD (never uses the UTC day). */
export function toISODate(date: Date | string): string {
  if (typeof date === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
    const parsed = new Date(date);
    if (isNaN(parsed.getTime())) return '';
    return toISODate(parsed);
  }
  if (isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Hour at which the app rolls over to the next day. A "day" therefore runs from
 * 05:00 until 04:59:59.999 of the following calendar day, so late-night sessions
 * (past midnight) keep working on the same day until 5 AM.
 */
export const DAY_BOUNDARY_HOUR = 5;

/**
 * Midnight (local) of the day the app currently treats as "today".
 * Between 00:00 and 04:59 it is yesterday's midnight.
 */
export function appDayStart(now: Date = new Date()): Date {
  const d = new Date(now);
  if (d.getHours() < DAY_BOUNDARY_HOUR) d.setDate(d.getDate() - 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * End of the app's current day (exclusive) as a Date, i.e. the midnight that
 * starts the next app day. Used to tell "due today" apart from "overdue".
 */
export function appDayEnd(now: Date = new Date()): Date {
  const end = appDayStart(now);
  end.setDate(end.getDate() + 1);
  return end;
}

/**
 * Today's date in the local timezone as YYYY-MM-DD, honouring the 05:00 day
 * boundary: between midnight and 05:00 this returns yesterday's date.
 */
export function todayISO(now: Date = new Date()): string {
  return toISODate(appDayStart(now));
}

/**
 * The real calendar day as YYYY-MM-DD, unaffected by the 05:00 boundary.
 * Use it when the user explicitly picks a date (due dates, "Today" button).
 */
export function realTodayISO(): string {
  return toISODate(new Date());
}

function buildLocalDate(year: string, month: string, day: string, time?: string): Date | null {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;

  const result = new Date(y, m - 1, d);
  // Rejects impossible dates such as 31/02/2026
  if (result.getFullYear() !== y || result.getMonth() !== m - 1 || result.getDate() !== d) {
    return null;
  }

  if (time) {
    const [hh = '0', mm = '0', ss = '0'] = time.split(':');
    result.setHours(Number(hh), Number(mm), Number(ss), 0);
  }

  return result;
}

/**
 * Parses any date the app may receive from the UI, an API client or the AI parser.
 * Accepts DD/MM/YYYY (day first), YYYY-MM-DD, full ISO timestamps and Date objects.
 * Returns null when the value is missing or not a real calendar date.
 */
export function parseFlexibleDate(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;

  const raw = value.trim();
  if (!raw) return null;

  const dayFirst = raw.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})(?:[ T](.+))?$/);
  if (dayFirst) {
    return buildLocalDate(dayFirst[3], dayFirst[2], dayFirst[1], dayFirst[4]);
  }

  const isoDateOnly = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDateOnly) {
    return buildLocalDate(isoDateOnly[1], isoDateOnly[2], isoDateOnly[3]);
  }

  // Anything else only counts when it carries a full year (ISO timestamps,
  // "5 October 2026", …). Bare fragments such as "05/10" are rejected.
  if (raw.length >= 6 && /\d{4}/.test(raw)) {
    const parsed = new Date(raw);
    return isNaN(parsed.getTime()) ? null : parsed;
  }

  return null;
}

/**
 * Converts text typed into a DD/MM/YYYY field into the YYYY-MM-DD value stored
 * and sent over the wire. Returns '' when incomplete or invalid.
 */
export function parseInputToISO(value: string): string {
  const parsed = parseFlexibleDate(value);
  return parsed ? toISODate(parsed) : '';
}

/** Weekday name (e.g. "Friday") so the heading never depends on number formatting. */
export function formatWeekday(date: Date | string | null | undefined): string {
  if (!date) return '';

  // Date-only strings carry no timezone — build a local Date so the weekday
  // never shifts a day in western timezones.
  if (typeof date === 'string') {
    const iso = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (iso) {
      return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(
        new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
      );
    }
  }

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(d);
}

/** Time as HH:MM (24h) so it never varies with the browser locale. */
export function formatTimeHHMM(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Start of current week (Monday) as Date at 00:00:00 local. */
export function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** End of current week (Sunday) as Date at 23:59:59 local. */
export function getWeekEnd(date: Date = new Date()): Date {
  const d = getWeekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Local calendar date as YYYY-MM-DD string. */
export function formatDateYYYYMMDD(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const MONTH_NAMES_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

/**
 * Parses a YYYY-MM-DD string into a local Date at midnight.
 * `new Date('2026-11-10')` would be parsed as UTC and could shift the day in
 * western timezones, so date-only strings are always built from their parts.
 */
export function parseISODateLocal(iso: string): Date {
  const match = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return new Date(iso);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** First day of the month containing `date`, at local midnight. */
export function getMonthStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/** Number of days in the month containing `date` (28–31). */
export function daysInMonth(date: Date): number {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
}

/**
 * Every calendar day of the month containing `date` as YYYY-MM-DD strings,
 * from the 1st through the last day of that month.
 */
export function monthDatesISO(date: Date): string[] {
  const start = getMonthStart(date);
  const count = daysInMonth(start);
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(formatDateYYYYMMDD(d));
  }
  return dates;
}

/**
 * Every calendar day of the week containing `date` as YYYY-MM-DD strings,
 * from Monday through Sunday.
 */
export function weekDatesISO(date: Date): string[] {
  const start = getWeekStart(date);
  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    dates.push(formatDateYYYYMMDD(d));
  }
  return dates;
}

/**
 * Moves `date` by whole months, clamping to the last day of the target month
 * (31 Jan + 1 month → 28/29 Feb instead of spilling into March).
 */
export function addMonthsClamped(date: Date, months: number): Date {
  const d = new Date(date);
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, daysInMonth(d)));
  return d;
}

/** Month and year label, e.g. "November 2026". */
export function formatMonthYear(date: Date): string {
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** Compact date label, e.g. "10 Nov". */
export function formatDateDDMMShort(date: Date): string {
  return `${pad(date.getDate())} ${MONTH_NAMES_SHORT[date.getMonth()]}`;
}
