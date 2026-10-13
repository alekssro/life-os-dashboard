/**
 * Superlist OAuth (PKCE) client for the dashboard.
 *
 * Superlist exposes an OAuth 2.0 authorization server for its MCP endpoint:
 *   - discovery:  https://app.superlist.com/.well-known/oauth-authorization-server
 *   - authorize:  https://app.superlist.com/oauth/authorize        (PKCE S256, public client)
 *   - token:      https://app.superlist.com/oauth/token            (authorization_code + refresh_token)
 *   - register:   https://app.superlist.com/oauth/register         (dynamic client registration)
 *
 * Tokens are stored per-app in the DB `settings` table so they survive env
 * changes and can be refreshed in-app (no container restart needed).
 *
 * The flow: register client → build authorize URL → user logs in at
 * app.superlist.com → callback exchanges the code → "Sync now" uses the
 * stored access token, auto-refreshing when it expires.
 */

import crypto from 'crypto';
import { getSetting, setSetting } from '@/lib/settings';

export const SUPERLIST_MCP_URL =
  process.env.SUPERLIST_MCP_URL || 'https://app.superlist.com/mcp';

export const SUPERLIST_ISSUER = new URL(SUPERLIST_MCP_URL).origin;

const AUTH_METADATA_URL = `${SUPERLIST_ISSUER}/.well-known/oauth-authorization-server`;

const CLIENTS_SETTING = 'SUPERLIST_OAUTH_CLIENTS'; // JSON map: redirectUri -> clientId
const ACCESS_TOKEN_SETTING = 'SUPERLIST_OAUTH_ACCESS_TOKEN';
const REFRESH_TOKEN_SETTING = 'SUPERLIST_OAUTH_REFRESH_TOKEN';
const TOKEN_TYPE_SETTING = 'SUPERLIST_OAUTH_TOKEN_TYPE';
const EXPIRES_AT_SETTING = 'SUPERLIST_OAUTH_EXPIRES_AT';
const REDIRECT_URI_SETTING = 'SUPERLIST_OAUTH_REDIRECT_URI';

interface AuthServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  code_challenge_methods_supported?: string[];
  grant_types_supported?: string[];
}

let metadataCache: AuthServerMetadata | null = null;
let metadataPromise: Promise<AuthServerMetadata> | null = null;

async function getAuthServerMetadata(): Promise<AuthServerMetadata> {
  if (metadataCache) return metadataCache;
  if (!metadataPromise) {
    metadataPromise = fetch(AUTH_METADATA_URL).then(async (res) => {
      if (!res.ok) {
        throw new Error(`Unable to discover Superlist OAuth metadata (${res.status})`);
      }
      const data = (await res.json()) as AuthServerMetadata;
      if (!data.authorization_endpoint || !data.token_endpoint) {
        throw new Error('Superlist OAuth metadata is incomplete');
      }
      return data;
    });
  }
  metadataCache = await metadataPromise;
  return metadataCache;
}

export function base64UrlEncode(input: Buffer | Uint8Array): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function createPkce(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(crypto.randomBytes(64));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function createOAuthState(): string {
  return base64UrlEncode(crypto.randomBytes(32));
}

// ---------------------------------------------------------------------------
// Client registration (dynamic, one client per redirect URI)
// ---------------------------------------------------------------------------

export async function getClientId(redirectUri: string): Promise<string | null> {
  const raw = await getSetting(CLIENTS_SETTING);
  if (!raw) return null;
  try {
    return ((JSON.parse(raw) as Record<string, string>) || {})[redirectUri] || null;
  } catch {
    return null;
  }
}

async function storeClientId(redirectUri: string, clientId: string): Promise<void> {
  const raw = await getSetting(CLIENTS_SETTING);
  const map: Record<string, string> = raw ? JSON.parse(raw) : {};
  map[redirectUri] = clientId;
  await setSetting(CLIENTS_SETTING, JSON.stringify(map));
}

export async function registerClient(redirectUri: string): Promise<string> {
  const existing = await getClientId(redirectUri);
  if (existing) return existing;

  const meta = await getAuthServerMetadata();
  if (!meta.registration_endpoint) {
    throw new Error('Superlist OAuth client registration is not supported');
  }

  const res = await fetch(meta.registration_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: 'Life OS Dashboard',
      redirect_uris: [redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'web',
      scope: 'mcp',
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.client_id) {
    throw new Error(`Superlist client registration failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }
  await storeClientId(redirectUri, data.client_id);
  return data.client_id as string;
}

// ---------------------------------------------------------------------------
// Authorize / token exchange
// ---------------------------------------------------------------------------

export async function buildAuthorizationUrl(
  redirectUri: string,
  codeChallenge: string,
  state: string
): Promise<{ url: string; clientId: string }> {
  const meta = await getAuthServerMetadata();
  const clientId = await registerClient(redirectUri);
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    scope: 'mcp',
  });
  return { url: `${meta.authorization_endpoint}?${params.toString()}`, clientId };
}

export interface SuperlistTokens {
  accessToken: string;
  refreshToken: string | null;
  tokenType: string;
  expiresAt: number; // epoch ms, 0 = unknown
}

function parseTokens(data: any): SuperlistTokens {
  if (!data?.access_token) {
    throw new Error(`Superlist token response missing access_token: ${JSON.stringify(data).slice(0, 200)}`);
  }
  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token || null,
    tokenType: data.token_type || 'Bearer',
    expiresAt: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : 0,
  };
}

async function tokenRequest(params: URLSearchParams): Promise<SuperlistTokens> {
  const meta = await getAuthServerMetadata();
  const res = await fetch(meta.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`Superlist token request failed (${res.status}): ${JSON.stringify(data).slice(0, 200)}`);
  }
  return parseTokens(data);
}

export async function exchangeAuthorizationCode(
  code: string,
  verifier: string,
  redirectUri: string
): Promise<SuperlistTokens> {
  const clientId = await getClientId(redirectUri);
  if (!clientId) throw new Error('No registered Superlist client for this redirect URI');
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    })
  );
}

export async function refreshAccessToken(
  refreshToken: string,
  redirectUri: string
): Promise<SuperlistTokens> {
  const clientId = await getClientId(redirectUri);
  if (!clientId) throw new Error('No registered Superlist client for this redirect URI');
  return tokenRequest(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    })
  );
}

// ---------------------------------------------------------------------------
// Token storage (DB settings table)
// ---------------------------------------------------------------------------

export async function saveTokens(tokens: SuperlistTokens, redirectUri: string): Promise<void> {
  await setSetting(ACCESS_TOKEN_SETTING, tokens.accessToken);
  await setSetting(REFRESH_TOKEN_SETTING, tokens.refreshToken);
  await setSetting(TOKEN_TYPE_SETTING, tokens.tokenType);
  await setSetting(EXPIRES_AT_SETTING, tokens.expiresAt ? String(tokens.expiresAt) : '0');
  await setSetting(REDIRECT_URI_SETTING, redirectUri);
}

export async function getStoredTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number;
}> {
  const [accessToken, refreshToken, expiresAt] = await Promise.all([
    getSetting(ACCESS_TOKEN_SETTING),
    getSetting(REFRESH_TOKEN_SETTING),
    getSetting(EXPIRES_AT_SETTING),
  ]);
  return {
    accessToken,
    refreshToken,
    expiresAt: parseInt(expiresAt || '0', 10) || 0,
  };
}

export async function getStoredRedirectUri(): Promise<string | null> {
  return getSetting(REDIRECT_URI_SETTING);
}

export async function clearStoredTokens(): Promise<void> {
  await Promise.all([
    setSetting(ACCESS_TOKEN_SETTING, null),
    setSetting(REFRESH_TOKEN_SETTING, null),
    setSetting(TOKEN_TYPE_SETTING, null),
    setSetting(EXPIRES_AT_SETTING, null),
    setSetting(REDIRECT_URI_SETTING, null),
  ]);
}

// ---------------------------------------------------------------------------
// Token resolution for sync (auto-refresh before expiry)
// ---------------------------------------------------------------------------

export type ResolvedAccessToken =
  | { ok: true; token: string }
  | { ok: false; message: string };

export async function resolveSuperlistAccessToken(): Promise<ResolvedAccessToken> {
  const stored = await getStoredTokens();
  const redirectUri = await getStoredRedirectUri();

  if (stored.accessToken) {
    const isExpired = stored.expiresAt > 0 && Date.now() >= stored.expiresAt - 60_000;
    if (isExpired && stored.refreshToken && redirectUri) {
      try {
        const refreshed = await refreshAccessToken(stored.refreshToken, redirectUri);
        await saveTokens(refreshed, redirectUri);
        return { ok: true, token: refreshed.accessToken };
      } catch (e) {
        console.error('Superlist token refresh failed:', (e as Error).message);
        // fall through — try the stored token; a 401 will surface a re-auth error
      }
    }
    return { ok: true, token: stored.accessToken };
  }

  // Static fallback for automated setups
  if (process.env.SUPERLIST_MCP_TOKEN) {
    return { ok: true, token: process.env.SUPERLIST_MCP_TOKEN };
  }

  return {
    ok: false,
    message:
      'Not connected to Superlist. Open Settings → Superlist Integration and click “Connect to Superlist” to authorize.',
  };
}

/** Try to refresh using the stored refresh token. Returns the new access token or null. */
export async function tryRefreshStoredToken(): Promise<string | null> {
  const stored = await getStoredTokens();
  const redirectUri = await getStoredRedirectUri();
  if (!stored.refreshToken || !redirectUri) return null;
  try {
    const refreshed = await refreshAccessToken(stored.refreshToken, redirectUri);
    await saveTokens(refreshed, redirectUri);
    return refreshed.accessToken;
  } catch (e) {
    console.error('Superlist token refresh failed:', (e as Error).message);
    return null;
  }
}