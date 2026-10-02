export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const items = await prisma.inboxItem.findMany({
    where: { status: 'NEEDS_REVIEW' },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  try {
    const { id, action, targetDomainId } = await req.json();

    const inboxItem = await prisma.inboxItem.findUnique({
      where: { id },
    });

    if (!inboxItem) {
      return NextResponse.json({ error: 'Item not found' }, { status: 404 });
    }

    if (action === 'CLEAR') {
      await prisma.inboxItem.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return NextResponse.json({ success: true, action: 'CLEARED' });
    }

    if (action === 'OWN') {
      // Create Task
      await prisma.task.create({
        data: {
          title: inboxItem.title,
          notes: inboxItem.rawContent,
          status: 'TODO',
          domainId: targetDomainId || null,
        },
      });
    } else if (action === 'READING') {
      // Create Library Item
      await prisma.libraryItem.create({
        data: {
          title: inboxItem.title,
          body: inboxItem.rawContent,
          type: 'NOTE',
          tags: 'Reading, Triage',
        },
      });
    } else if (action === 'MEETING') {
      // Create Schedule Event
      await prisma.scheduleEvent.create({
        data: {
          title: inboxItem.title,
          notes: inboxItem.rawContent,
          date: new Date(),
        },
      });
    } else if (action === 'BRAINSTORM') {
      // Create Content / Brainstorm item
      await prisma.contentItem.create({
        data: {
          title: inboxItem.title,
          notes: inboxItem.rawContent,
          type: 'ARTICLE',
          stage: 'IDEA',
          domainId: targetDomainId || null,
        },
      });
    }

    // Mark inbox item as TRIAGED
    await prisma.inboxItem.update({
      where: { id },
      data: { status: 'TRIAGED' },
    });

    return NextResponse.json({ success: true, action });
  } catch (error) {
    console.error('Error triaging inbox item:', error);
    return NextResponse.json({ error: 'Failed to triage item' }, { status: 500 });
  }
}
