export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  buildAuthorizationUrl,
  clearStoredTokens,
  createOAuthState,
  createPkce,
  exchangeAuthorizationCode,
  saveTokens,
} from '@/lib/superlistOAuth';

const CALLBACK_PATH = '/api/integrations/superlist/oauth';

/** Start the OAuth login flow: returns the Superlist authorization URL. */
export async function POST(req: NextRequest) {
  try {
    const reqUrl = new URL(req.url);
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const host = req.headers.get('host') || reqUrl.host;
    const redirectUri = `${proto}://${host}${CALLBACK_PATH}`;

    const { verifier, challenge } = createPkce();
    const state = createOAuthState();

    const cookieOptions = {
      httpOnly: true,
      sameSite: 'lax' as const,
      path: '/',
      maxAge: 600,
      secure: proto === 'https',
    };
    const cookieStore = cookies();
    cookieStore.set('sl_pkce', verifier, cookieOptions);
    cookieStore.set('sl_state', state, cookieOptions);

    const { url } = await buildAuthorizationUrl(redirectUri, challenge, state);
    return NextResponse.json({ authorizationUrl: url, redirectUri });
  } catch (e) {
    console.error('Superlist OAuth start failed:', e);
    return NextResponse.json({ error: (e as Error).message || 'Failed to start Superlist login' }, { status: 500 });
  }
}

/** OAuth redirect target: after a successful login Superlist calls back here with a code. */
export async function GET(req: NextRequest) {
  const reqUrl = new URL(req.url);
  const code = reqUrl.searchParams.get('code');
  const state = reqUrl.searchParams.get('state');
  const error = reqUrl.searchParams.get('error');
  const proto = req.headers.get('x-forwarded-proto') || 'http';
  const host = req.headers.get('host') || reqUrl.host;
  const home = `${proto}://${host}/`;

  const cookieStore = cookies();
  const expectedState = cookieStore.get('sl_state')?.value;
  const verifier = cookieStore.get('sl_pkce')?.value;

  if (error) {
    return NextResponse.redirect(`${home}?superlist=error&message=${encodeURIComponent(error)}`);
  }
  if (!code || !state || state !== expectedState || !verifier) {
    return NextResponse.redirect(
      `${home}?superlist=error&message=${encodeURIComponent('Superlist login did not complete — please try again.')}`
    );
  }

  try {
    const redirectUri = `${proto}://${host}${CALLBACK_PATH}`;
    const tokens = await exchangeAuthorizationCode(code, verifier, redirectUri);
    await saveTokens(tokens, redirectUri);
    cookieStore.delete('sl_pkce');
    cookieStore.delete('sl_state');
    return NextResponse.redirect(`${home}?superlist=connected`);
  } catch (e) {
    console.error('Superlist OAuth callback failed:', e);
    return NextResponse.redirect(
      `${home}?superlist=error&message=${encodeURIComponent((e as Error).message || 'Token exchange failed.')}`
    );
  }
}

/** Disconnect: clear stored Superlist tokens. */
export async function DELETE() {
  await clearStoredTokens();
  return NextResponse.json({ success: true });
}