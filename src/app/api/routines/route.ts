export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayISO } from '@/lib/date';
import { isDueToday } from '@/lib/routines';

export async function GET() {
  const todayStr = todayISO();

  const routines = await prisma.routine.findMany({
    where: { active: true },
    include: {
      logs: {
        where: { date: todayStr },
      },
    },
    orderBy: [
      { timeOfDay: 'asc' },
      { order: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  const formatted = routines.map((r) => ({
    id: r.id,
    title: r.title,
    timeOfDay: r.timeOfDay,
    frequency: r.frequency,
    daysOfWeek: r.daysOfWeek,
    dayOfMonth: r.dayOfMonth,
    icon: r.icon,
    order: r.order,
    streak: r.streak,
    bestStreak: r.bestStreak,
    isDueToday: isDueToday(r),
    isCompletedToday: r.logs.length > 0 && r.logs[0].completed,
  }));

  // Only routines scheduled for today count toward the day's progress.
  const dueToday = formatted.filter((f) => f.isDueToday);
  const total = dueToday.length;
  const completedCount = dueToday.filter((f) => f.isCompletedToday).length;

  return NextResponse.json({
    routines: formatted,
    total,
    completedCount,
    todayStr,
  });
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    // 1. Creating a new routine
    if (data.title && !data.routineId) {
      const timeOfDay = data.timeOfDay || 'MORNING';
      const maxOrder = await prisma.routine.findFirst({
        where: { timeOfDay },
        orderBy: { order: 'desc' },
        select: { order: true },
      });

      const nextOrder = (maxOrder?.order ?? 0) + 1;

      const newRoutine = await prisma.routine.create({
        data: {
          title: data.title,
          timeOfDay,
          frequency: data.frequency || 'DAILY',
          daysOfWeek: data.daysOfWeek || null,
          dayOfMonth: data.dayOfMonth ? parseInt(data.dayOfMonth) : null,
          icon: data.icon || '✨',
          order: nextOrder,
        },
      });

      return NextResponse.json(newRoutine, { status: 201 });
    }

    // 2. Toggling routine completion
    const { routineId, completed } = data;
    const todayStr = todayISO();

    const routine = await prisma.routine.findUnique({ where: { id: routineId } });
    if (!routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    if (completed && !isDueToday(routine)) {
      return NextResponse.json(
        { error: `${routine.title} is not scheduled for today` },
        { status: 400 }
      );
    }

    if (completed) {
      await prisma.routineLog.upsert({
        where: { routineId_date: { routineId, date: todayStr } },
        create: { routineId, date: todayStr, completed: true },
        update: { completed: true },
      });

      const newStreak = routine.lastCompletedDate === todayStr ? routine.streak : routine.streak + 1;
      const newBestStreak = Math.max(newStreak, routine.bestStreak);

      await prisma.routine.update({
        where: { id: routineId },
        data: { streak: newStreak, bestStreak: newBestStreak, lastCompletedDate: todayStr },
      });
    } else {
      await prisma.routineLog.deleteMany({ where: { routineId, date: todayStr } });
      await prisma.routine.update({
        where: { id: routineId },
        data: { streak: Math.max(0, routine.streak - 1), lastCompletedDate: null },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling routine POST:', error);
    return NextResponse.json({ error: 'Failed to process routine request' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    const { id, direction, ...updates } = data;

    if (!id) {
      return NextResponse.json({ error: 'Missing routine id' }, { status: 400 });
    }

    // Handle reordering
    if (direction === 'UP' || direction === 'DOWN') {
      const current = await prisma.routine.findUnique({ where: { id } });
      if (!current) return NextResponse.json({ error: 'Routine not found' }, { status: 404 });

      const siblings = await prisma.routine.findMany({
        where: { timeOfDay: current.timeOfDay, active: true },
        orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
      });

      const currentIndex = siblings.findIndex((s) => s.id === id);
      if (currentIndex === -1) return NextResponse.json({ error: 'Routine not found in group' }, { status: 404 });

      const targetIndex = direction === 'UP' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex >= 0 && targetIndex < siblings.length) {
        const target = siblings[targetIndex];
        const tempOrder = target.order;
        await prisma.routine.update({ where: { id: target.id }, data: { order: current.order } });
        await prisma.routine.update({
          where: { id: current.id },
          data: {
            order:
              tempOrder === current.order
                ? direction === 'UP'
                  ? current.order - 1
                  : current.order + 1
                : tempOrder,
          },
        });
      }

      return NextResponse.json({ success: true });
    }

    // Direct field update (edit)
    const cleanUpdates: any = {};
    if (updates.title !== undefined) cleanUpdates.title = updates.title;
    if (updates.icon !== undefined) cleanUpdates.icon = updates.icon;
    if (updates.timeOfDay !== undefined) cleanUpdates.timeOfDay = updates.timeOfDay;
    if (updates.frequency !== undefined) cleanUpdates.frequency = updates.frequency;
    if (updates.daysOfWeek !== undefined) cleanUpdates.daysOfWeek = updates.daysOfWeek;
    if (updates.dayOfMonth !== undefined)
      cleanUpdates.dayOfMonth = updates.dayOfMonth ? parseInt(updates.dayOfMonth) : null;
    if (updates.active !== undefined) cleanUpdates.active = updates.active;

    const updated = await prisma.routine.update({ where: { id }, data: cleanUpdates });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating routine:', error);
    return NextResponse.json({ error: 'Failed to update routine' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing routine id' }, { status: 400 });

    await prisma.routine.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting routine:', error);
    return NextResponse.json({ error: 'Failed to delete routine' }, { status: 500 });
  }
}
