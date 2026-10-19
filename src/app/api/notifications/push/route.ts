export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import {
  deletePushSubscription,
  isPushConfigured,
  savePushSubscription,
} from '@/lib/notifications';
import { prisma } from '@/lib/prisma';

/**
 * Register a browser Push subscription (called after Notification.permission
 * was granted and the subscription was created with the VAPID public key).
 */
export async function POST(req: NextRequest) {
  try {
    if (!isPushConfigured()) {
      return NextResponse.json(
        { error: 'Push notifications are not configured on this server (VAPID keys missing).' },
        { status: 503 }
      );
    }

    const data = await req.json();
    const endpoint = data?.endpoint;
    const p256dh = data?.keys?.p256dh;
    const auth = data?.keys?.auth;

    if (typeof endpoint !== 'string' || !endpoint.startsWith('https://') || !p256dh || !auth) {
      return NextResponse.json({ error: 'Invalid push subscription payload' }, { status: 400 });
    }

    await savePushSubscription({
      endpoint,
      p256dh,
      auth,
      userAgent: req.headers.get('user-agent'),
    });

    return NextResponse.json({
      success: true,
      subscriptionCount: await prisma.pushSubscription.count(),
    });
  } catch (error) {
    console.error('Error saving push subscription:', error);
    return NextResponse.json({ error: 'Failed to save push subscription' }, { status: 500 });
  }
}

/** Remove a subscription (notifications switched off on this device). */
export async function DELETE(req: NextRequest) {
  try {
    const data = await req.json().catch(() => null);
    const endpoint = data?.endpoint;
    if (typeof endpoint !== 'string' || !endpoint) {
      return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });
    }

    await deletePushSubscription(endpoint);

    return NextResponse.json({
      success: true,
      subscriptionCount: await prisma.pushSubscription.count(),
    });
  } catch (error) {
    console.error('Error deleting push subscription:', error);
    return NextResponse.json({ error: 'Failed to delete push subscription' }, { status: 500 });
  }
}
