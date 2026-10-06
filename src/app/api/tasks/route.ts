import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFlexibleDate } from '@/lib/date';

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

    return NextResponse.json(task);
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
