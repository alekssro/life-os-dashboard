import { prisma } from '@/lib/prisma';
import { parseICS } from './icsParser';

const DAY_MS = 24 * 60 * 60 * 1000;

// How far back and forward the feeds are synced and recurrences expanded.
const PAST_WINDOW_DAYS = 3;
const FUTURE_WINDOW_DAYS = 60;

export async function syncActiveCalendars() {
  const activeCalendars = await prisma.connectedCalendar.findMany({
    where: { isActive: true },
  });

  // Also remove events from inactive calendars so they don't clutter Up Next
  const inactiveCalendars = await prisma.connectedCalendar.findMany({
    where: { isActive: false },
    select: { id: true },
  });

  if (inactiveCalendars.length > 0) {
    await prisma.scheduleEvent.deleteMany({
      where: {
        calendarId: { in: inactiveCalendars.map((c: { id: string }) => c.id) },
      },
    });
  }

  let totalSynced = 0;
  const results: Array<{ calendarId: string; name: string; eventsSynced: number; error?: string }> = [];

  for (const cal of activeCalendars) {
    try {
      if (cal.type === 'GOOGLE_ICAL' && cal.feedUrl) {
        const res = await fetch(cal.feedUrl, {
          headers: {
            'User-Agent': 'LifeOS-Dashboard/1.0',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status} fetching iCal feed`);
        }

        const icsText = await res.text();

        // Filter events within window: past 3 days up to next 60 days
        const now = new Date();
        const pastWindow = new Date(now.getTime() - PAST_WINDOW_DAYS * DAY_MS);
        const futureWindow = new Date(now.getTime() + FUTURE_WINDOW_DAYS * DAY_MS);

        // parseICS expands recurring series (RRULE) into per-occurrence events
        // and applies EXDATE / RECURRENCE-ID overrides within this window.
        const parsedEvents = parseICS(icsText, { start: pastWindow, end: futureWindow });

        const relevant = parsedEvents.filter(
          (e) => e.date >= pastWindow && e.date <= futureWindow
        );

        for (const ev of relevant) {
          await prisma.scheduleEvent.upsert({
            where: { externalId: ev.externalId },
            create: {
              externalId: ev.externalId,
              title: ev.title,
              date: ev.date,
              startTime: ev.startTime,
              endTime: ev.endTime,
              location: ev.location,
              notes: ev.notes,
              source: 'GOOGLE_CALENDAR',
              calendarId: cal.id,
            },
            update: {
              title: ev.title,
              date: ev.date,
              startTime: ev.startTime,
              endTime: ev.endTime,
              location: ev.location,
              notes: ev.notes,
              calendarId: cal.id,
            },
          });
        }

        await prisma.connectedCalendar.update({
          where: { id: cal.id },
          data: { lastSyncedAt: new Date() },
        });

        // Drop rows for this calendar that are no longer in the feed (deleted
        // or rescheduled events, and old master rows from before recurrence
        // expansion). Scoped to calendarId so manually created events are
        // never touched.
        const externalIds = relevant.map((e) => e.externalId);
        await prisma.scheduleEvent.deleteMany({
          where: {
            calendarId: cal.id,
            ...(externalIds.length > 0
              ? { externalId: { notIn: externalIds } }
              : {}),
          },
        });

        totalSynced += relevant.length;
        results.push({ calendarId: cal.id, name: cal.name, eventsSynced: relevant.length });
      } else if (cal.type === 'GOOGLE_API') {
        // Optional Google API OAuth sync if configured
        results.push({ calendarId: cal.id, name: cal.name, eventsSynced: 0, error: 'Google OAuth not configured' });
      }
    } catch (err: any) {
      console.error(`Error syncing calendar ${cal.name}:`, err);
      results.push({ calendarId: cal.id, name: cal.name, eventsSynced: 0, error: err.message });
    }
  }

  return {
    totalSynced,
    activeCount: activeCalendars.length,
    results,
  };
}
