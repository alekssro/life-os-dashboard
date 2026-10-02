export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { syncActiveCalendars } from '@/lib/calendar/sync';

export async function GET() {
  const calendars = await prisma.connectedCalendar.findMany({
    orderBy: { createdAt: 'asc' },
    include: {
      _count: {
        select: { events: true },
      },
    },
  });
  return NextResponse.json(calendars);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    if (!data.name || !data.feedUrl) {
      return NextResponse.json({ error: 'Calendar name and feed URL are required' }, { status: 400 });
    }

    const calendar = await prisma.connectedCalendar.create({
      data: {
        name: data.name.trim(),
        type: data.type || 'GOOGLE_ICAL',
        feedUrl: data.feedUrl.trim(),
        color: data.color || '#4285F4',
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : true,
      },
    });

    // Auto-sync the new calendar immediately
    if (calendar.isActive) {
      try {
        await syncActiveCalendars();
      } catch (err) {
        console.warn('Initial calendar sync notice:', err);
      }
    }

    return NextResponse.json(calendar, { status: 201 });
  } catch (error) {
    console.error('Error adding calendar:', error);
    return NextResponse.json({ error: 'Failed to add calendar' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, isActive, name, color, feedUrl } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing calendar id' }, { status: 400 });

    const updated = await prisma.connectedCalendar.update({
      where: { id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(name && { name }),
        ...(color && { color }),
        ...(feedUrl && { feedUrl }),
      },
    });

    // Run sync to update / clean events
    await syncActiveCalendars();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating calendar:', error);
    return NextResponse.json({ error: 'Failed to update calendar' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing calendar id' }, { status: 400 });

    await prisma.connectedCalendar.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting calendar:', error);
    return NextResponse.json({ error: 'Failed to delete calendar' }, { status: 500 });
  }
}
