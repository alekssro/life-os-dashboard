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

/** Today's date in the local timezone as YYYY-MM-DD. */
export function todayISO(): string {
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
