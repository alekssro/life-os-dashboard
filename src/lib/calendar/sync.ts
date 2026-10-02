import { prisma } from '@/lib/prisma';
import { parseICS } from './icsParser';

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
        const parsedEvents = parseICS(icsText);

        // Filter events within window: past 3 days up to next 60 days
        const now = new Date();
        const pastWindow = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
        const futureWindow = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);

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
