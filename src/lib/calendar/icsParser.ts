/**
 * Lightweight, zero-dependency RFC 5545 iCalendar (ICS) parser for Google Calendar feeds
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

export function parseICS(icsContent: string): ParsedCalendarEvent[] {
  const events: ParsedCalendarEvent[] = [];
  // Unfold lines (RFC 5545: lines ending with CRLF followed by space/tab are continued)
  const unfolded = icsContent.replace(/\r\n[ \t]/g, '').replace(/\n[ \t]/g, '');
  const lines = unfolded.split(/\r\n|\n|\r/);

  let inEvent = false;
  let currentEvent: Partial<ParsedCalendarEvent> & { dtStartRaw?: string; dtEndRaw?: string } = {};

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    if (line === 'BEGIN:VEVENT') {
      inEvent = true;
      currentEvent = {};
      continue;
    }

    if (line === 'END:VEVENT') {
      inEvent = false;
      if (currentEvent.externalId && currentEvent.title && currentEvent.dtStartRaw) {
        const { date, startTime } = parseIcsDateTime(currentEvent.dtStartRaw);
        const { startTime: endTime } = currentEvent.dtEndRaw ? parseIcsDateTime(currentEvent.dtEndRaw) : { startTime: null };

        events.push({
          externalId: currentEvent.externalId,
          title: currentEvent.title,
          date,
          startTime,
          endTime,
          location: currentEvent.location || null,
          notes: currentEvent.notes || null,
        });
      }
      currentEvent = {};
      continue;
    }

    if (!inEvent) continue;

    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const rawKey = line.substring(0, colonIndex);
    const value = line.substring(colonIndex + 1).trim();

    // Clean property key (remove params like ;TZID=...)
    const key = rawKey.split(';')[0].toUpperCase();

    switch (key) {
      case 'UID':
        currentEvent.externalId = value;
        break;
      case 'SUMMARY':
        currentEvent.title = unescapeIcsText(value);
        break;
      case 'DESCRIPTION':
        currentEvent.notes = unescapeIcsText(value);
        break;
      case 'LOCATION':
        currentEvent.location = unescapeIcsText(value);
        break;
      case 'DTSTART':
        currentEvent.dtStartRaw = value;
        break;
      case 'DTEND':
        currentEvent.dtEndRaw = value;
        break;
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

function parseIcsDateTime(raw: string): { date: Date; startTime: string | null } {
  // Format 1: All Day "YYYYMMDD" (8 digits)
  if (/^\d{8}$/.test(raw)) {
    const year = parseInt(raw.substring(0, 4), 10);
    const month = parseInt(raw.substring(4, 6), 10) - 1;
    const day = parseInt(raw.substring(6, 8), 10);
    const d = new Date(year, month, day, 0, 0, 0);
    return { date: d, startTime: 'All Day' };
  }

  // Format 2: DateTime "YYYYMMDDTHHMMSS" or "YYYYMMDDTHHMMSSZ"
  const match = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z)?/);
  if (match) {
    const [_, y, m, d, hh, mm, ss, isUtc] = match;
    let date: Date;
    if (isUtc) {
      date = new Date(Date.UTC(+y, +m - 1, +d, +hh, +mm, +ss));
    } else {
      date = new Date(+y, +m - 1, +d, +hh, +mm, +ss);
    }

    // Format local time e.g. "2:30 PM"
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const startTime = `${displayHours}:${minutes} ${ampm}`;

    return { date, startTime };
  }

  const fallbackDate = new Date(raw);
  return {
    date: isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate,
    startTime: null,
  };
}
