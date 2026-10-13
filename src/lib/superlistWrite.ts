/**
 * Outbound (dashboard -> Superlist) writes.
 *
 * Completion is the only status change the Superlist API supports: a task can
 * be completed via `complete_task`, but there is no way to reopen one. So a
 * completion in the dashboard is pushed immediately, while un-completing is
 * local-only.
 */

import { resolveSuperlistAccessToken, tryRefreshStoredToken } from '@/lib/superlistOAuth';
import { completeSuperlistTask as completeSuperlistTaskWithToken } from '@/lib/superlistSync';

export interface SuperlistWriteResult {
  ok: boolean;
  error?: string;
}

/**
 * Push a completion to Superlist for the given task/list UUID, refreshing the
 * access token once on a 401. Never throws — callers treat failure as
 * non-fatal so the local change still stands.
 */
export async function pushSuperlistCompletion(taskUuid: string): Promise<SuperlistWriteResult> {
  if (!taskUuid) return { ok: false, error: 'Missing Superlist task id' };

  const resolved = await resolveSuperlistAccessToken();
  if (!resolved.ok) return { ok: false, error: resolved.message };

  try {
    await completeSuperlistTaskWithToken(resolved.token, taskUuid);
    return { ok: true };
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err?.status === 401) {
      const refreshed = await tryRefreshStoredToken();
      if (refreshed) {
        try {
          await completeSuperlistTaskWithToken(refreshed, taskUuid);
          return { ok: true };
        } catch (retryErr) {
          return { ok: false, error: (retryErr as Error).message };
        }
      }
      return { ok: false, error: 'Superlist access token expired and could not be refreshed' };
    }
    return { ok: false, error: err?.message || 'Superlist completion failed' };
  }
}