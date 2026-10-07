export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFlexibleDate } from '@/lib/date';

export async function GET() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const events = await prisma.scheduleEvent.findMany({
    where: {
      date: {
        gte: startOfToday,
      },
    },
    orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    take: 10,
    include: {
      domain: true,
      calendar: true,
    },
  });
  return NextResponse.json(events);
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
    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 });
  }
}
