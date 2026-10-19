export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  DEFAULT_NOTIFICATION_PREFS,
  getNotificationPrefs,
  getVapidConfig,
  isPushConfigured,
  saveNotificationPrefs,
} from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

/** Read (or initialise) the reminder notification preferences. */
export async function GET() {
  const prefs = await getNotificationPrefs();
  const vapid = getVapidConfig();

  return NextResponse.json({
    prefs,
    // Push only works with a VAPID key pair configured on the server.
    pushConfigured: isPushConfigured(),
    publicKey: vapid?.publicKey ?? null,
    subscriptionCount: await prisma.pushSubscription.count(),
    defaults: DEFAULT_NOTIFICATION_PREFS,
  });
}

/** Save preferences: { enabled, slots: { MORNING, AFTERNOON, EVENING } }. */
export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const prefs = await saveNotificationPrefs({
      enabled: data?.enabled !== false,
      slots: {
        MORNING: data?.slots?.MORNING,
        AFTERNOON: data?.slots?.AFTERNOON,
        EVENING: data?.slots?.EVENING,
      },
    } as any);

    return NextResponse.json({ success: true, prefs, pushConfigured: isPushConfigured() });
  } catch (error) {
    console.error('Error saving notification prefs:', error);
    return NextResponse.json({ error: 'Failed to save notification preferences' }, { status: 500 });
  }
}
