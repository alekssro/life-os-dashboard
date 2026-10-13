export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getStoredTokens } from '@/lib/superlistOAuth';

export async function GET() {
  const { accessToken, refreshToken, expiresAt } = await getStoredTokens();
  return NextResponse.json({
    connected: Boolean(accessToken),
    hasRefreshToken: Boolean(refreshToken),
    expiresAt: expiresAt || null,
    envTokenConfigured: Boolean(process.env.SUPERLIST_MCP_TOKEN),
  });
}