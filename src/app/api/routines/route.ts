export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { todayISO, getWeekStart, getWeekEnd, formatDateYYYYMMDD } from '@/lib/date';
import { isDueToday } from '@/lib/routines';

function calculateConsistencyScore(routine: any, logs: any[]): number {
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = getWeekEnd(now);

  const dueDatesInWeek: string[] = [];
  const current = new Date(weekStart);
  while (current <= weekEnd) {
    const dateStr = formatDateYYYYMMDD(current);
    const tempRoutine = { ...routine, frequency: routine.frequency, daysOfWeek: routine.daysOfWeek, dayOfMonth: routine.dayOfMonth };
    if (isDueToday({ ...tempRoutine, frequency: routine.frequency, daysOfWeek: routine.daysOfWeek, dayOfMonth: routine.dayOfMonth }, current)) {
      dueDatesInWeek.push(dateStr);
    }
    current.setDate(current.getDate() + 1);
  }

  if (dueDatesInWeek.length === 0) return 100;

  const completedInWeek = logs.filter((log) =>
    dueDatesInWeek.includes(log.date) && log.completed
  ).length;

  const score = Math.round((completedInWeek / dueDatesInWeek.length) * 100);
  return Math.min(100, Math.max(0, score));
}

export async function GET() {
  const todayStr = todayISO();
  const weekStartStr = formatDateYYYYMMDD(getWeekStart(new Date()));
  const weekEndStr = formatDateYYYYMMDD(getWeekEnd(new Date()));

  const routines = await prisma.routine.findMany({
    where: { active: true },
    include: {
      logs: {
        where: {
          date: {
            gte: weekStartStr,
            lte: weekEndStr,
          },
        },
      },
    },
    orderBy: [
      { timeOfDay: 'asc' },
      { order: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  const formatted = routines.map((r) => {
    const isDue = isDueToday(r);
    const todaysLog = r.logs.find((l) => l.date === todayStr);
    const consistencyScore = calculateConsistencyScore(r, r.logs);

    return {
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
      consistencyScore,
      graceDays: r.graceDays,
      targetPerWeek: r.targetPerWeek,
      isDueToday: isDue,
      isCompletedToday: !!todaysLog?.completed,
    };
  });

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
          graceDays: data.graceDays ?? 1,
          targetPerWeek: data.targetPerWeek ?? 7,
        },
      });

      return NextResponse.json(newRoutine, { status: 201 });
    }

    const { routineId, completed, date: logDate } = data;
    const targetDate = logDate || todayISO();

    const routine = await prisma.routine.findUnique({ where: { id: routineId } });
    if (!routine) {
      return NextResponse.json({ error: 'Routine not found' }, { status: 404 });
    }

    const isDue = isDueToday(routine, new Date(targetDate));
    const graceDays = routine.graceDays ?? 1;

    if (completed && !isDue) {
      const lastDueDate = getLastDueDate(routine, new Date(targetDate));
      const daysSinceDue = lastDueDate ? Math.floor((new Date(targetDate).getTime() - lastDueDate.getTime()) / (1000 * 60 * 60 * 24)) : 999;

      if (daysSinceDue > graceDays) {
        return NextResponse.json(
          { error: `${routine.title} was not scheduled for ${targetDate} (grace period: ${graceDays} day${graceDays !== 1 ? 's' : ''})` },
          { status: 400 }
        );
      }
    }

    if (completed) {
      await prisma.routineLog.upsert({
        where: { routineId_date: { routineId, date: targetDate } },
        create: { routineId, date: targetDate, completed: true, loggedAt: new Date() },
        update: { completed: true, loggedAt: new Date() },
      });

      const logs = await prisma.routineLog.findMany({
        where: { routineId, completed: true },
        orderBy: { date: 'desc' },
        take: 50,
      });

      let newStreak = 0;
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      for (const log of logs) {
        const logDateObj = new Date(log.date);
        const expectedDate = new Date(checkDate);
        expectedDate.setDate(expectedDate.getDate() - newStreak);

        if (isDueToday(routine, logDateObj) && formatDateYYYYMMDD(logDateObj) === formatDateYYYYMMDD(expectedDate)) {
          newStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (logDateObj < expectedDate) {
          break;
        }
      }

      const newBestStreak = Math.max(newStreak, routine.bestStreak);

      const weekStart = getWeekStart(new Date());
      const weekEnd = getWeekEnd(new Date());
      const weekLogs = await prisma.routineLog.findMany({
        where: {
          routineId,
          date: { gte: formatDateYYYYMMDD(weekStart), lte: formatDateYYYYMMDD(weekEnd) },
          completed: true,
        },
      });
      const consistencyScore = calculateConsistencyScore(routine, weekLogs);

      await prisma.routine.update({
        where: { id: routineId },
        data: {
          streak: newStreak,
          bestStreak: newBestStreak,
          consistencyScore,
          lastCompletedDate: targetDate,
        },
      });
    } else {
      await prisma.routineLog.deleteMany({ where: { routineId, date: targetDate } });

      const logs = await prisma.routineLog.findMany({
        where: { routineId, completed: true },
        orderBy: { date: 'desc' },
        take: 50,
      });

      let newStreak = 0;
      const checkDate = new Date();
      checkDate.setHours(0, 0, 0, 0);

      for (const log of logs) {
        const logDateObj = new Date(log.date);
        const expectedDate = new Date(checkDate);
        expectedDate.setDate(expectedDate.getDate() - newStreak);

        if (isDueToday(routine, logDateObj) && formatDateYYYYMMDD(logDateObj) === formatDateYYYYMMDD(expectedDate)) {
          newStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else if (logDateObj < expectedDate) {
          break;
        }
      }

      const weekStart = getWeekStart(new Date());
      const weekEnd = getWeekEnd(new Date());
      const weekLogs = await prisma.routineLog.findMany({
        where: {
          routineId,
          date: { gte: formatDateYYYYMMDD(weekStart), lte: formatDateYYYYMMDD(weekEnd) },
          completed: true,
        },
      });
      const consistencyScore = calculateConsistencyScore(routine, weekLogs);

      await prisma.routine.update({
        where: { id: routineId },
        data: {
          streak: newStreak,
          consistencyScore,
          lastCompletedDate: newStreak > 0 ? targetDate : null,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error handling routine POST:', error);
    return NextResponse.json({ error: 'Failed to process routine request' }, { status: 500 });
  }
}

function getLastDueDate(routine: any, beforeDate: Date): Date | null {
  const checkDate = new Date(beforeDate);
  checkDate.setDate(checkDate.getDate() - 1);

  for (let i = 0; i < 30; i++) {
    if (isDueToday(routine, checkDate)) {
      return new Date(checkDate);
    }
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return null;
}

export async function PATCH(req: NextRequest) {
  try {
    const data = await req.json();
    const { id, direction, ...updates } = data;

    if (!id) {
      return NextResponse.json({ error: 'Missing routine id' }, { status: 400 });
    }

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

    const cleanUpdates: any = {};
    if (updates.title !== undefined) cleanUpdates.title = updates.title;
    if (updates.icon !== undefined) cleanUpdates.icon = updates.icon;
    if (updates.timeOfDay !== undefined) cleanUpdates.timeOfDay = updates.timeOfDay;
    if (updates.frequency !== undefined) cleanUpdates.frequency = updates.frequency;
    if (updates.daysOfWeek !== undefined) cleanUpdates.daysOfWeek = updates.daysOfWeek;
    if (updates.dayOfMonth !== undefined)
      cleanUpdates.dayOfMonth = updates.dayOfMonth ? parseInt(updates.dayOfMonth) : null;
    if (updates.active !== undefined) cleanUpdates.active = updates.active;
    if (updates.graceDays !== undefined) cleanUpdates.graceDays = updates.graceDays;
    if (updates.targetPerWeek !== undefined) cleanUpdates.targetPerWeek = updates.targetPerWeek;

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