export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const startTime = Date.now();
  let dbStatus = 'healthy';
  let dbError = null;

  try {
    // Ping database with a lightweight raw query
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    dbStatus = 'unhealthy';
    dbError = err.message || 'Database connection error';
  }

  const isHealthy = dbStatus === 'healthy';
  const responsePayload = {
    status: isHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      app: 'healthy',
      database: dbStatus,
    },
    latencyMs: Date.now() - startTime,
    ...(dbError && { error: dbError }),
  };

  return NextResponse.json(responsePayload, {
    status: isHealthy ? 200 : 503,
  });
}
