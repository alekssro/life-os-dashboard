export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { sendTestReminder } from '@/lib/notifications';

/**
 * Send an immediate test push to every registered device. Used by the
 * "Send test notification" button in Settings → Reminder Notifications.
 */
export async function POST() {
  try {
    const result = await sendTestReminder();
    if (!result.ok) {
      return NextResponse.json({ error: result.error, recipients: result.recipients }, { status: 400 });
    }
    return NextResponse.json({ success: true, recipients: result.recipients });
  } catch (error) {
    console.error('Error sending test reminder:', error);
    return NextResponse.json({ error: 'Failed to send the test notification.' }, { status: 500 });
  }
}
