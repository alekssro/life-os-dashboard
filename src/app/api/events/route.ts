export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appDayStart, parseFlexibleDate, serializeDueDate } from '@/lib/date';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Math.max(Number(searchParams.get('days')) || 60, 1), 365);
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 300, 1), 1000);

  // Events from the app's current day onwards (the day rolls over at 05:00).
  const startOfToday = appDayStart();
  const windowEnd = new Date(startOfToday);
  windowEnd.setDate(windowEnd.getDate() + days);
  windowEnd.setHours(23, 59, 59, 999);

  const events = await prisma.scheduleEvent.findMany({
    where: {
      date: {
        gte: startOfToday,
        lte: windowEnd,
      },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    take: limit,
    include: {
      domain: true,
      calendar: true,
    },
  });

  // An event's date is a calendar day, so it travels as YYYY-MM-DD and never
  // shifts with the browser's timezone.
  return NextResponse.json(events.map((e) => ({ ...e, date: serializeDueDate(e.date) })));
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const eventDate = data.date ? parseFlexibleDate(data.date) : new Date();
    if (data.date && !eventDate) {
      return NextResponse.json({ error: 'Invalid date. Use dd/mm/yyyy.' }, { status: 400 });
    }

    const event = await prisma.scheduleEvent.create({
      data: {
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        date: eventDate ?? new Date(),
        location: data.location,
        notes: data.notes,
        domainId: data.domainId || null,
        source: data.source || 'MANUAL',
      },
      include: {
        domain: true,
      },
    });
    return NextResponse.json({ ...event, date: serializeDueDate(event.date) }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
