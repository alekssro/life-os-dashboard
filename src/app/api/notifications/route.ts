export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const notifications = await prisma.systemNotification.findMany({
    orderBy: { createdAt: 'desc' },
    take: 15,
  });
  return NextResponse.json(notifications);
}

export async function POST(req: NextRequest) {
  try {
    const { id, markAllRead } = await req.json();
    if (markAllRead) {
      await prisma.systemNotification.updateMany({
        where: { read: false },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }
    if (id) {
      await prisma.systemNotification.update({
        where: { id },
        data: { read: true },
      });
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update notification' }, { status: 500 });
  }
}
