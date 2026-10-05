import { NextRequest } from 'next/server';

/**
 * Validates API key for /api/capture and external automation (iOS Shortcuts, Apple Watch, webhooks)
 * Internal same-origin requests (from the dashboard itself) are always allowed.
 */
export function validateApiKey(request: NextRequest): boolean {
  const secretKey = process.env.API_SECRET_KEY;
  // If no secret key is configured, allow all requests
  if (!secretKey) return true;

  // Allow same-origin requests (the dashboard itself calling its own API)
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');

  if (host) {
    const internalBase = `http://${host}`;
    const internalBaseHttps = `https://${host}`;
    if (
      (origin && (origin === internalBase || origin === internalBaseHttps)) ||
      (referer && (referer.startsWith(internalBase) || referer.startsWith(internalBaseHttps)))
    ) {
      return true;
    }
  }

  const authHeader = request.headers.get('authorization');
  const apiKeyHeader = request.headers.get('x-api-key');

  if (apiKeyHeader && apiKeyHeader === secretKey) {
    return true;
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    if (token === secretKey) return true;
  }

  return false;
}

/**
 * Simple in-memory rate limiter for public endpoints
 */
const rateLimitMap = new Map<string, { count: number; expiresAt: number }>();

export function checkRateLimit(ip: string, limit = 60, windowMs = 60000): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || record.expiresAt < now) {
    rateLimitMap.set(ip, { count: 1, expiresAt: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}
