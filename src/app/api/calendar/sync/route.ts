export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { syncActiveCalendars } from '@/lib/calendar/sync';

export async function POST() {
  try {
    const result = await syncActiveCalendars();
    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error during calendar sync:', error);
    return NextResponse.json({ error: error.message || 'Sync failed' }, { status: 500 });
  }
}
