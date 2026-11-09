export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { appDayStart, toISODate, formatDateYYYYMMDD } from '@/lib/date';

/**
 * GET /api/routines/history
 * Query params:
 *   - startDate: YYYY-MM-DD
 *   - endDate: YYYY-MM-DD
 *   - routineId?: string
 * Returns logs mapped by routineId and date for heatmap/streak visualizers.
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const routineId = searchParams.get('routineId');
    const today = appDayStart();
    const todayStr = toISODate(today);

    // Default to last 365 days if not specified
    const defaultStart = new Date(today);
    defaultStart.setDate(defaultStart.getDate() - 365);
    const startDate = searchParams.get('startDate') || formatDateYYYYMMDD(defaultStart);
    const endDate = searchParams.get('endDate') || todayStr;

    const whereClause: any = {
      date: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (routineId) {
      whereClause.routineId = routineId;
    }

    const logs = await prisma.routineLog.findMany({
      where: whereClause,
      select: {
        id: true,
        routineId: true,
        date: true,
        completed: true,
        completedAt: true,
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      startDate,
      endDate,
      logs,
    });
  } catch (error: any) {
    console.error('Error fetching routine history:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch routine history' }, { status: 500 });
  }
}
