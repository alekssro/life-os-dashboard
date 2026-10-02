export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getAttentionReport } from '@/lib/attention';

export async function GET() {
  try {
    const report = await getAttentionReport();
    return NextResponse.json(report);
  } catch (error) {
    console.error('Error in attention API:', error);
    return NextResponse.json({ error: 'Failed to generate attention report' }, { status: 500 });
  }
}
