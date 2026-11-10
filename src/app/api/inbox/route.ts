export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFlexibleDate } from '@/lib/date';
import { buildSuperlistTaskUrl } from '@/lib/superlist';
import { ensureSuperlistListForDomain } from '@/lib/superlistDomains';
import { pushSuperlistTaskMove } from '@/lib/superlistWrite';

interface SuperlistInboxMetadata {
  superlistId?: string;
  listId?: string | null;
  url?: string | null;
  dueDate?: string | null;
  priority?: string;
}

function parseMetadata(raw: string | null): SuperlistInboxMetadata {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SuperlistInboxMetadata) : {};
  } catch {
    return {};
  }
}

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

    const meta = parseMetadata(inboxItem.metadata);
    const superlistId = inboxItem.superlistId || meta.superlistId || null;

    if (action === 'CLEAR') {
      await prisma.inboxItem.update({
        where: { id },
        data: { status: 'ARCHIVED' },
      });
      return NextResponse.json({ success: true, action: 'CLEARED' });
    }

    if (action === 'OWN') {
      // A task that came from Superlist has no domain yet: the user must file
      // it under one. That domain gets a Superlist list (created on demand) and
      // the task is moved into it.
      if (superlistId && !targetDomainId) {
        return NextResponse.json(
          { error: 'Pick a domain for this task — it will be filed under that list in Superlist.' },
          { status: 400 }
        );
      }

      let domainId = targetDomainId || null;
      let superlistListId: string | null = null;
      let superlistUrl: string | null = null;
      let superlistWarning: string | undefined;

      if (superlistId && domainId) {
        const ensured = await ensureSuperlistListForDomain(domainId);
        if (!ensured.ok || !ensured.listId) {
          superlistWarning = ensured.error || 'Could not create the Superlist list';
        } else {
          superlistListId = ensured.listId;
          superlistUrl = buildSuperlistTaskUrl(ensured.listId, superlistId);
          const moved = await pushSuperlistTaskMove(superlistId, ensured.listId);
          if (!moved.ok) {
            superlistWarning = moved.error || 'Could not move the task in Superlist';
          }
        }
      }

      // Link the dashboard task to the Superlist task so later syncs update it.
      const existingTask = superlistId
        ? await prisma.task.findUnique({ where: { superlistId } })
        : null;

      const taskData = {
        title: inboxItem.title,
        notes: inboxItem.rawContent,
        status: 'TODO' as const,
        domainId,
        ...(superlistId ? { superlistId, superlistListId, superlistUrl, source: 'SUPERLIST' as const } : {}),
      };

      const task = existingTask
        ? await prisma.task.update({ where: { id: existingTask.id }, data: taskData })
        : await prisma.task.create({ data: taskData });

      await prisma.inboxItem.update({
        where: { id },
        data: { status: 'TRIAGED', suggestedDomain: domainId },
      });

      return NextResponse.json({ success: true, action, task, superlistWarning });
    }

    if (action === 'READING') {
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
