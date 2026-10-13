export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { clearStoredTokens, getStoredTokens, refreshAccessToken, saveTokens } from '@/lib/superlistOAuth';
import { getSetting } from '@/lib/settings';

const REDIRECT_URI_SETTING = 'SUPERLIST_OAUTH_REDIRECT_URI';

export async function POST() {
  const redirectUri = await getSetting(REDIRECT_URI_SETTING);
  const { refreshToken } = await getStoredTokens();
  if (!redirectUri || !refreshToken) {
    return NextResponse.json(
      { error: 'No Superlist refresh token stored — connect again.' },
      { status: 400 }
    );
  }
  try {
    const tokens = await refreshAccessToken(refreshToken, redirectUri);
    await saveTokens(tokens, redirectUri);
    return NextResponse.json({ success: true, expiresAt: tokens.expiresAt || null });
  } catch (e) {
    await clearStoredTokens();
    return NextResponse.json(
      { error: (e as Error).message || 'Token refresh failed — connect again.' },
      { status: 401 }
    );
  }
}