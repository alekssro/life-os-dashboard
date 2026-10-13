import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFlexibleDate } from '@/lib/date';
import { pushSuperlistCompletion, pushSuperlistUpdate } from '@/lib/superlistWrite';
import type { UpdateSuperlistTaskArgs } from '@/lib/superlistSync';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');
  const isTop3 = searchParams.get('isTop3');
  const domainId = searchParams.get('domainId');
  const since = searchParams.get('since');

  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (isTop3 !== null && isTop3 !== undefined && isTop3 !== '') {
    where.isTop3 = isTop3 === 'true';
  }
  if (domainId) {
    where.domainId = domainId;
  }
  if (since) {
    where.completedAt = {
      gte: new Date(since),
    };
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      domain: true,
      project: true,
    },
    orderBy: [
      { isTop3: 'desc' },
      { dueDate: 'asc' },
      { createdAt: 'desc' },
    ],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const dueDate = parseFlexibleDate(data.dueDate);
    if (data.dueDate && !dueDate) {
      return NextResponse.json({ error: 'Invalid due date. Use dd/mm/yyyy.' }, { status: 400 });
    }

    const task = await prisma.task.create({
      data: {
        title: data.title,
        notes: data.notes,
        status: data.status || 'TODO',
        priority: data.priority || 'NORMAL',
        dueDate,
        dueTime: data.dueTime,
        isTop3: Boolean(data.isTop3),
        domainId: data.domainId || null,
        projectId: data.projectId || null,
        isRecurring: Boolean(data.isRecurring),
        recurrenceRule: data.recurrenceRule,
        source: data.source || (data.superlistId ? 'SUPERLIST' : 'MANUAL'),
        superlistId: data.superlistId || null,
        superlistListId: data.superlistListId || null,
        superlistUrl: data.superlistUrl || null,
      },
      include: {
        domain: true,
        project: true,
      },
    });

    // Update project lastActivityAt if linked
    if (task.projectId) {
      await prisma.project.update({
        where: { id: task.projectId },
        data: { lastActivityAt: new Date() },
      });
    }

    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    console.error('Error creating task:', error);
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    const { id, ...updates } = data;

    if (!id) {
      return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
    }

    const existing = await prisma.task.findUnique({
      where: { id },
      include: {
        domain: true,
        project: true,
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Detect a fresh completion so we can mirror it to Superlist (only when the
    // task comes from Superlist and this is not a no-op re-save).
    const becameDone = updates.status === 'DONE' && existing.status !== 'DONE';

    if (updates.status === 'DONE') {
      updates.completedAt = new Date();
    } else if (updates.status === 'TODO') {
      updates.completedAt = null;
    }

    if (updates.dueDate) {
      const parsedDueDate = parseFlexibleDate(updates.dueDate);
      if (!parsedDueDate) {
        return NextResponse.json({ error: 'Invalid due date. Use dd/mm/yyyy.' }, { status: 400 });
      }
      updates.dueDate = parsedDueDate;
    }

    const task = await prisma.task.update({
      where: { id },
      data: updates,
      include: {
        domain: true,
        project: true,
      },
    });

    // Update project activity
    if (task.projectId) {
      await prisma.project.update({
        where: { id: task.projectId },
        data: { lastActivityAt: new Date() },
      });
    }

    // Two-way completion sync: push a completion to Superlist. Un-completing is
    // local-only because Superlist cannot reopen a completed task.
    let superlistPush: { ok: boolean; error?: string } | undefined;
    if (becameDone && task.superlistId) {
      superlistPush = await pushSuperlistCompletion(task.superlistId);
      if (!superlistPush.ok) {
        console.warn(`Superlist completion push failed for task ${task.id}: ${superlistPush.error}`);
      }
    }

    // Push other field updates to Superlist (title, notes, dueDate, priority)
    let superlistUpdate: { ok: boolean; error?: string } | undefined;
    if (task.superlistId && !becameDone) {
      const updateArgs: UpdateSuperlistTaskArgs = { task_uuid: task.superlistId };

      if (updates.title !== undefined && updates.title !== existing.title) {
        updateArgs.title = updates.title;
      }
      if (updates.notes !== undefined && updates.notes !== existing.notes) {
        updateArgs.notes = updates.notes;
      }
      if (updates.dueDate !== undefined && updates.dueDate !== existing.dueDate) {
        updateArgs.due_date = updates.dueDate ? updates.dueDate.toISOString() : null;
      }
      if (updates.priority !== undefined && updates.priority !== existing.priority) {
        const priorityMap: Record<string, 'high' | 'normal' | 'low'> = {
          HIGH: 'high',
          NORMAL: 'normal',
          LOW: 'low',
        };
        updateArgs.priority = priorityMap[updates.priority] || 'normal';
      }

      if (Object.keys(updateArgs).length > 1) { // more than just task_uuid
        superlistUpdate = await pushSuperlistUpdate(task.superlistId, updateArgs);
        if (!superlistUpdate.ok) {
          console.warn(`Superlist update push failed for task ${task.id}: ${superlistUpdate.error}`);
        }
      }
    }

    return NextResponse.json(superlistPush || superlistUpdate ? { ...task, superlistPush, superlistUpdate } : task);
  } catch (error) {
    console.error('Error updating task:', error);
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing task id' }, { status: 400 });
  }

  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
