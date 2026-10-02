import { NextRequest } from 'next/server';

/**
 * Validates API key for /api/capture and external automation (iOS Shortcuts, Apple Watch, webhooks)
 */
export function validateApiKey(request: NextRequest): boolean {
  const secretKey = process.env.API_SECRET_KEY;
  // If no secret key is configured, allow internal requests (convenient for local network)
  if (!secretKey) return true;

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
