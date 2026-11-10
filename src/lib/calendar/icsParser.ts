/**
 * Lightweight, zero-dependency RFC 5545 iCalendar (ICS) parser for Google Calendar feeds.
 *
 * Besides plain one-off events it also:
 *  - expands recurring series (RRULE: DAILY / WEEKLY / MONTHLY / YEARLY with
 *    INTERVAL, COUNT, UNTIL, BYDAY and BYMONTHDAY) into individual occurrences
 *    within a time window,
 *  - honours EXDATE exclusions,
 *  - lets overridden instances (RECURRENCE-ID) replace the occurrence they
 *    override, and drops cancelled events.
 *
 * Timezones: UTC ("Z") timestamps are parsed as UTC; TZID/floating timestamps
 * are interpreted as server-local time (the deployment pins TZ to the user's
 * timezone). Recurrences expand in the same mode as their DTSTART so
 * wall-clock times survive DST changes.
 */

export interface ParsedCalendarEvent {
  externalId: string;
  title: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  notes: string | null;
}

export interface ParseWindow {
  start: Date;
  end: Date;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_OCCURRENCES = 5000; // safety cap for series expansion

// RFC 5545 weekday codes mapped to JS getDay() numbers (0 = Sunday).
const WEEKDAY_CODES: Record<string, number> = {
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
  SU: 0,
};

/** Default window used when none is supplied: past 3 days to next 60 days. */
function defaultWindow(): ParseWindow {
  const now = Date.now();
  return {
    start: new Date(now - 3 * DAY_MS),
    end: new Date(now + 60 * DAY_MS),
  };
}

interface RawEvent {
  uid: string;
  title: string;
  dtStartRaw: string;
  dtEndRaw?: string;
  location?: string;
  notes?: string;
  rrule?: string;
  exdateRaws: string[];
  recurrenceIdRaw?: string;
  cancelled?: boolean;
}

interface ParsedDateTime {
  date: Date;
  startTime: string | null; // "2:30 PM" style, "All Day" or null
  isAllDay: boolean;
  utc: boolean; // DTSTART was UTC ("Z") — expand in UTC time space
}

interface RRule {
  freq: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY';
  interval: number;
  count?: number;
  until?: Date;
  byDay: string[]; // e.g. "MO", "WE" (WEEKLY) or "2TU" / "-1SU" (MONTHLY)
  byMonthDay: number[];
  wkst: number; // JS weekday number of the week start
}

export function parseICS(icsContent: string, window?: ParseWindow): ParsedCalendarEvent[] {
  const win = window ?? defaultWindow();

  // Unfold lines (RFC 5545: lines ending with CRLF followed by space/tab are continued)
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);

  const rawEvents: RawEvent[] = [];
  let current: Partial<RawEvent> | null = null;

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
      current = { exdateRaws: [] };
      continue;
    }

    if (line === 'END:VEVENT') {
      if (current?.uid && current.title && current.dtStartRaw) {
        rawEvents.push(current as RawEvent);
      }
      current = null;
      continue;
    }

    if (!current) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const rawKey = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1).trim();

    // Clean property key (remove params like ;TZID=...)
    const key = rawKey.split(';')[0].toUpperCase();

    switch (key) {
      case 'UID':
        current.uid = value;
        break;
      case 'SUMMARY':
        current.title = unescapeIcsText(value);
        break;
      case 'DESCRIPTION':
        current.notes = unescapeIcsText(value);
        break;
      case 'LOCATION':
        current.location = unescapeIcsText(value);
        break;
      case 'DTSTART':
        current.dtStartRaw = value;
        break;
      case 'DTEND':
        current.dtEndRaw = value;
        break;
      case 'RRULE':
        current.rrule = value;
        break;
      case 'EXDATE':
        // A single EXDATE may list several comma-separated dates.
        (current.exdateRaws ??= []).push(
          ...value.split(',').map((v) => v.trim()).filter(Boolean)
        );
        break;
      case 'RECURRENCE-ID':
        current.recurrenceIdRaw = value;
        break;
      case 'STATUS':
        current.cancelled = value.toUpperCase() === 'CANCELLED';
        break;
    }
  }

  // Instances overriding (or cancelling) a single occurrence of a series,
  // grouped by their master UID. They replace the master's plain occurrence.
  const overridesByUid = new Map<string, RawEvent[]>();
  for (const ev of rawEvents) {
    if (!ev.recurrenceIdRaw) continue;
    const list = overridesByUid.get(ev.uid) ?? [];
    list.push(ev);
    overridesByUid.set(ev.uid, list);
  }

  const events: ParsedCalendarEvent[] = [];

  for (const ev of rawEvents) {
    if (ev.cancelled) continue;

    const start = parseIcsDateTime(ev.dtStartRaw);
    const end = ev.dtEndRaw ? parseIcsDateTime(ev.dtEndRaw) : null;
    const durationMs = end ? end.date.getTime() - start.date.getTime() : 0;

    // Every occurrence keeps the master's wall-clock duration.
    const endTimeFor = (occurrence: Date): string | null =>
      end && !end.isAllDay
        ? formatClock(new Date(occurrence.getTime() + durationMs))
        : null;

    const base = {
      title: ev.title,
      location: ev.location ?? null,
      notes: ev.notes ?? null,
    };

    if (ev.rrule && !ev.recurrenceIdRaw) {
      // Recurring series master: expand occurrences inside the window.
      const occurrences = expandRecurrence(ev.rrule, start, win);
      if (occurrences.length === 0) continue;

      const overrides = overridesByUid.get(ev.uid) ?? [];
      const replacedKeys = new Set<string>([
        ...ev.exdateRaws.map((raw) => occurrenceKey(parseIcsDateTime(raw).date)),
        ...overrides.map((o) => occurrenceKey(parseIcsDateTime(o.recurrenceIdRaw!).date)),
      ]);

      for (const occ of occurrences) {
        // Skip excluded dates and instances replaced by an override.
        if (replacedKeys.has(occurrenceKey(occ))) continue;
        events.push({
          externalId: `${ev.uid}#${occurrenceKey(occ)}`,
          date: occ,
          startTime: start.isAllDay ? 'All Day' : formatClock(occ),
          endTime: endTimeFor(occ),
          ...base,
        });
      }
    } else if (ev.recurrenceIdRaw) {
      // Overridden instance — replaces the series occurrence at RECURRENCE-ID.
      events.push({
        externalId: `${ev.uid}#${occurrenceKey(parseIcsDateTime(ev.recurrenceIdRaw).date)}`,
        date: start.date,
        startTime: start.startTime,
        endTime: endTimeFor(start.date),
        ...base,
      });
    } else {
      // Plain one-off event.
      events.push({
        externalId: ev.uid,
        date: start.date,
        startTime: start.startTime,
        endTime: endTimeFor(start.date),
        ...base,
      });
    }
  }

  return events;
}

function unescapeIcsText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\N/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

function parseIcsDateTime(raw: string): ParsedDateTime {
  // Format 1: All Day "YYYYMMDD" (8 digits)
  if (/^\d{8}$/.test(raw)) {
    const year = parseInt(raw.substring(0, 4), 10);
    const month = parseInt(raw.substring(4, 6), 10) - 1;
    const day = parseInt(raw.substring(6, 8), 10);
    const d = new Date(year, month, day, 0, 0, 0);
    return { date: d, startTime: 'All Day', isAllDay: true, utc: false };
  }

  // Format 2: DateTime "YYYYMMDDTHHMMSS" or "YYYYMMDDTHHMMSSZ"
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
  if (match) {
    const [_, y, m, d, hh, mm, ss, isUtc] = match;
    const date = isUtc
      ? new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss))
      : new Date(+y, +m - 1, +d, +hh, +mm, +ss);
    return { date, startTime: formatClock(date), isAllDay: false, utc: !!isUtc };
  }

  const fallbackDate = new Date(raw);
  return {
    date: isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate,
    startTime: null,
    isAllDay: false,
    utc: false,
  };
}

/** Format local time e.g. "2:30 PM" (never varies with the server locale). */
function formatClock(d: Date): string {
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes} ${ampm}`;
}

/**
 * Stable identity for a single occurrence of a series, e.g.
 * "uid@google.com#2026-11-11T09:15:00". Uses local wall-clock so the same
 * occurrence always maps to the same row on a given deployment.
 */
function occurrenceKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  );
}

function parseByDayCode(code: string): { ord?: number; dow: number } {
  const m = code.match(/^([+-]?\d+)?(MO|TU|WE|TH|FR|SA|SU)$/);
  if (!m) return { dow: -1 };
  return { ord: m[1] ? parseInt(m[1], 10) : undefined, dow: WEEKDAY_CODES[m[2]] };
}

function parseRRule(raw: string): RRule | null {
  const map: Record<string, string> = {};
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    map[part.slice(0, eq).trim().toUpperCase()] = part.slice(eq + 1).trim();
  }

  const freq = map.FREQ?.toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY' && freq !== 'MONTHLY' && freq !== 'YEARLY') {
    return null; // unsupported frequency — treat the series as absent
  }

  const interval = Math.max(1, parseInt(map.INTERVAL ?? '1', 10) || 1);
  const count = map.COUNT ? parseInt(map.COUNT, 10) || undefined : undefined;

  // Date-only UNTIL values are inclusive of the whole day.
  let until: Date | undefined;
  if (map.UNTIL) {
    const parsedUntil = parseIcsDateTime(map.UNTIL);
    until = /^\d{8}$/.test(map.UNTIL.trim())
      ? new Date(
          parsedUntil.date.getFullYear(),
          parsedUntil.date.getMonth(),
          parsedUntil.date.getDate(),
          23, 59, 59, 999
        )
      : parsedUntil.date;
  }

  const byDay = (map.BYDAY ?? '')
    .split(',')
    .map((v) => v.trim().toUpperCase())
    .filter(Boolean);
  const byMonthDay = (map.BYMONTHDAY ?? '')
    .split(',')
    .map((v) => parseInt(v.trim(), 10))
    .filter((n) => Number.isInteger(n));
  const wkstCode = map.WKST?.trim().toUpperCase();
  const wkst =
    wkstCode && WEEKDAY_CODES[wkstCode] !== undefined
      ? WEEKDAY_CODES[wkstCode]
      : WEEKDAY_CODES.MO;

  return { freq, interval, count, until, byDay, byMonthDay, wkst };
}

/**
 * Expand a recurrence rule into the occurrence start Dates that fall inside
 * the window. COUNT is honoured relative to the series start (including past
 * occurrences), matching RFC 5545 semantics.
 */
function expandRecurrence(ruleRaw: string, start: ParsedDateTime, win: ParseWindow): Date[] {
  const rule = parseRRule(ruleRaw);
  if (!rule) return [];

  const utc = start.utc;
  const mk = (y: number, mo: number, d: number, hh: number, mi: number, ss: number) =>
    utc ? new Date(Date.UTC(y, mo, d, hh, mi, ss)) : new Date(y, mo, d, hh, mi, ss);
  const parts = (d: Date) =>
    utc
      ? {
          y: d.getUTCFullYear(),
          mo: d.getUTCMonth(),
          d: d.getUTCDate(),
          hh: d.getUTCHours(),
          mi: d.getUTCMinutes(),
          ss: d.getUTCSeconds(),
          dow: d.getUTCDay(),
        }
      : {
          y: d.getFullYear(),
          mo: d.getMonth(),
          d: d.getDate(),
          hh: d.getHours(),
          mi: d.getMinutes(),
          ss: d.getSeconds(),
          dow: d.getDay(),
        };
  const addDays = (d: Date, n: number) => {
    const c = new Date(d.getTime());
    if (utc) c.setUTCDate(c.getUTCDate() + n);
    else c.setDate(c.getDate() + n); // keeps wall-clock time across DST changes
    return c;
  };
  const atTime = (d: Date, t: { hh: number; mi: number; ss: number }) => {
    const g = parts(d);
    return mk(g.y, g.mo, g.d, t.hh, t.mi, t.ss);
  };
  const daysInMonth = (y: number, mo: number) => {
    // Day 0 of next month = last day of this month.
    return parts(mk(y, mo + 1, 0, 0, 0, 0)).d;
  };
  const isValidDay = (y: number, mo: number, d: number) =>
    d >= 1 && d <= daysInMonth(y, mo);
  const dowOf = (y: number, mo: number, d: number) => parts(mk(y, mo, d, 0, 0, 0)).dow;

  const s = parts(start.date);
  const startMs = start.date.getTime();
  const out: Date[] = [];
  let counted = 0; // occurrences counted from the series start

  // Record a candidate. Returns false when expansion must stop entirely.
  const visit = (candidate: Date): boolean => {
    if (rule.until && candidate.getTime() > rule.until.getTime()) return false;
    counted++;
    if (rule.count !== undefined && counted > rule.count) return false;
    if (candidate.getTime() > win.end.getTime()) return false;
    if (candidate.getTime() >= win.start.getTime()) out.push(candidate);
    return true;
  };

  switch (rule.freq) {
    case 'DAILY': {
      // BYDAY acts as a weekday filter (e.g. FREQ=DAILY;BYDAY=MO,TU,WE).
      const filterDows = rule.byDay
        .map(parseByDayCode)
        .map((c) => c.dow)
        .filter((d) => d >= 0);
      let cursor = start.date;
      for (let i = 0; i < MAX_OCCURRENCES; i++) {
        if (filterDows.length === 0 || filterDows.includes(parts(cursor).dow)) {
          if (!visit(cursor)) break;
        }
        cursor = addDays(cursor, rule.interval);
      }
      break;
    }

    case 'WEEKLY': {
      // No BYDAY → same weekday as DTSTART.
      const dows = rule.byDay
        .map(parseByDayCode)
        .map((c) => c.dow)
        .filter((d) => d >= 0);
      const selected = dows.length > 0 ? dows : [s.dow];

      // Anchor to the WKST day of DTSTART's week, then step INTERVAL weeks.
      let weekAnchor = mk(s.y, s.mo, s.d, 0, 0, 0);
      weekAnchor = addDays(weekAnchor, -((parts(weekAnchor).dow - rule.wkst + 7) % 7));

      const offsets = selected
        .map((dow) => ({ dow, offset: (dow - rule.wkst + 7) % 7 }))
        .sort((a, b) => a.offset - b.offset);

      for (let i = 0; i < MAX_OCCURRENCES; i++) {
        let stop = false;
        for (const { offset } of offsets) {
          const candidate = atTime(addDays(weekAnchor, offset), s);
          if (candidate.getTime() < startMs) continue; // before the series start
          if (!visit(candidate)) {
            stop = true;
            break;
          }
        }
        if (stop) break;
        weekAnchor = addDays(weekAnchor, 7 * rule.interval);
      }
      break;
    }

    case 'MONTHLY': {
      // BYMONTHDAY wins; otherwise BYDAY (optionally with an ordinal such as
      // "2TU" = 2nd Tuesday or "-1SU" = last Sunday); otherwise the
      // day-of-month of DTSTART.
      const monthDays = (y: number, mo: number): number[] => {
        const last = daysInMonth(y, mo);
        if (rule.byMonthDay.length > 0) {
          return Array.from(new Set(rule.byMonthDay.filter((d) => isValidDay(y, mo, d)))).sort(
            (a, b) => a - b
          );
        }
        if (rule.byDay.length > 0) {
          const days = new Set<number>();
          for (const code of rule.byDay) {
            const { ord, dow } = parseByDayCode(code);
            if (dow < 0) continue;
            const matching: number[] = [];
            for (let d = 1; d <= last; d++) {
              if (dowOf(y, mo, d) === dow) matching.push(d);
            }
            if (matching.length === 0) continue;
            if (ord === undefined) {
              matching.forEach((d) => days.add(d));
            } else if (ord > 0) {
              const d = matching[ord - 1];
              if (d !== undefined) days.add(d);
            } else {
              const d = matching[matching.length + ord];
              if (d !== undefined) days.add(d);
            }
          }
          return Array.from(days).sort((a, b) => a - b);
        }
        return isValidDay(y, mo, s.d) ? [s.d] : [];
      };

      let y = s.y;
      let mo = s.mo;
      for (let i = 0; i < MAX_OCCURRENCES; i++) {
        let stop = false;
        for (const d of monthDays(y, mo)) {
          const candidate = mk(y, mo, d, s.hh, s.mi, s.ss);
          if (candidate.getTime() < startMs) continue;
          if (!visit(candidate)) {
            stop = true;
            break;
          }
        }
        if (stop) break;
        mo += rule.interval;
        y += Math.floor(mo / 12);
        mo %= 12;
      }
      break;
    }

    case 'YEARLY': {
      // Same month/day as DTSTART, every INTERVAL years.
      for (let i = 0; i < MAX_OCCURRENCES; i++) {
        const y = s.y + i * rule.interval;
        if (!isValidDay(y, s.mo, s.d)) continue;
        const candidate = mk(y, s.mo, s.d, s.hh, s.mi, s.ss);
        if (!visit(candidate)) break;
      }
      break;
    }
  }

  return out;
}
