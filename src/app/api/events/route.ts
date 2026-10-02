export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const startOfYesterday = new Date();
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const events = await prisma.scheduleEvent.findMany({
    where: {
      date: {
        gte: startOfYesterday,
      },
    },
    orderBy: { date: 'asc' },
    take: 15,
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
    const event = await prisma.scheduleEvent.create({
      data: {
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        date: data.date ? new Date(data.date) : new Date(),
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
