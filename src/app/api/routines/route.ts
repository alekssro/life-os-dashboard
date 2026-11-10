export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appDayStart, todayISO, toISODate } from '@/lib/date';
import { isDueToday } from '@/lib/routines';
import { computeStreak, StreakStats } from '@/lib/streaks';
import { pushSuperlistCompletion } from '@/lib/superlistWrite';

/**
 * Recomputes a habit's streak statistics from its full completion history.
 * The logs are the single source of truth — the cached columns on the routine
 * row are only a mirror of this result.
 */
async function computeRoutineStreak(routineId: string, routine: any): Promise<StreakStats> {
  const logs = await prisma.routineLog.findMany({
    where: { routineId, completed: true },
    select: { date: true },
  });
  return computeStreak(routine, logs.map((l) => l.date), appDayStart());
}

export async function GET() {
  // The app day rolls over at 05:00, so between midnight and 5 AM we keep
  // serving the previous day's routines as "today".
  const todayDate = appDayStart();
  const todayStr = toISODate(todayDate);

  const routines = await prisma.routine.findMany({
    where: { active: true },
    include: {
      logs: {
        where: { completed: true },
        orderBy: { date: 'asc' },
      },
    },
    orderBy: [
      { timeOfDay: 'asc' },
      { order: 'asc' },
      { createdAt: 'asc' },
    ],
  });

  const formatted = await Promise.all(
    routines.map(async (r) => {
      const isDue = isDueToday(r, todayDate);
      const todaysLog = r.logs.find((l) => l.date === todayStr);

      // Streaks are derived from the logs on every read, so a day that passes
      // without a completion decays the streak immediately instead of leaving
      // a stale number on screen.
      const streakStats = computeStreak(r, r.logs.map((l) => l.date), todayDate);
      const lastCompletedDate = r.logs.length ? r.logs[r.logs.length - 1].date : null;

      // Mirror the derived values back onto the row so any other consumer
      // (notifications, exports) sees the same numbers.
      if (
        r.streak !== streakStats.streak ||
        r.bestStreak !== streakStats.bestStreak ||
        Math.round(r.consistencyScore) !== streakStats.consistencyScore ||
        r.lastCompletedDate !== lastCompletedDate
      ) {
        await prisma.routine.update({
          where: { id: r.id },
          data: {
            streak: streakStats.streak,
            bestStreak: streakStats.bestStreak,
            consistencyScore: streakStats.consistencyScore,
            lastCompletedDate,
          },
        });
      }

      return {
        id: r.id,
        title: r.title,
        timeOfDay: r.timeOfDay,
        frequency: r.frequency,
        daysOfWeek: r.daysOfWeek,
        dayOfMonth: r.dayOfMonth,
        icon: r.icon,
        order: r.order,
        streak: streakStats.streak,
        bestStreak: streakStats.bestStreak,
        streakUnit: streakStats.unit,
        streakLabel: streakStats.label,
        streakShortLabel: streakStats.shortLabel,
        streakUnitLabel: streakStats.unitLabel,
        atRisk: streakStats.atRisk,
        graceUsed: streakStats.graceUsed,
        completedCurrentPeriod: streakStats.completedCurrentPeriod,
        consistencyScore: streakStats.consistencyScore,
        graceDays: r.graceDays,
        targetPerWeek: r.targetPerWeek,
        isDueToday: isDue,
        isCompletedToday: !!todaysLog?.completed,
        superlistId: r.superlistId,
        superlistListId: r.superlistListId,
        superlistUrl: r.superlistUrl,
      };
    })
  );

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

    // Logging past or scheduled dates is allowed: historical edits are
    // legitimate, and the streak is recomputed from the whole history anyway.

    // Snapshot the current log so we can tell a fresh completion from a repeat.
    const existingLog = await prisma.routineLog.findUnique({
      where: { routineId_date: { routineId, date: targetDate } },
    });

    if (completed) {
      await prisma.routineLog.upsert({
        where: { routineId_date: { routineId, date: targetDate } },
        create: { routineId, date: targetDate, completed: true, loggedAt: new Date() },
        update: { completed: true, loggedAt: new Date() },
      });
    } else {
      await prisma.routineLog.deleteMany({ where: { routineId, date: targetDate } });
    }

    // One recomputation for both paths: the streak, its personal best and the
    // consistency score all come from the same log history, so they can never
    // drift apart (and no longer depend on the habit's frequency).
    const stats = await computeRoutineStreak(routineId, routine);
    const lastLog = await prisma.routineLog.findFirst({
      where: { routineId, completed: true },
      orderBy: { date: 'desc' },
      select: { date: true },
    });

    await prisma.routine.update({
      where: { id: routineId },
      data: {
        streak: stats.streak,
        bestStreak: stats.bestStreak,
        consistencyScore: stats.consistencyScore,
        lastCompletedDate: lastLog?.date ?? null,
      },
    });

    // Two-way completion sync: mirror a fresh completion of a linked routine to
    // Superlist (which rolls the recurring task forward to its next occurrence).
    // Un-completing stays local because Superlist cannot reopen a task.
    if (completed && !existingLog?.completed && routine.superlistId) {
      const push = await pushSuperlistCompletion(routine.superlistId);
      if (!push.ok) {
        console.warn(`Superlist completion push failed for routine ${routineId}: ${push.error}`);
      }
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