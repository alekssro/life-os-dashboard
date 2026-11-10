/**
 * Outbound (dashboard -> Superlist) writes.
 *
 * Completion is the only status change the Superlist API supports: a task can
 * be completed via `complete_task`, but there is no way to reopen one. So a
 * completion in the dashboard is pushed immediately, while un-completing is
 * local-only.
 */

import { resolveSuperlistAccessToken, tryRefreshStoredToken } from '@/lib/superlistOAuth';
import {
  completeSuperlistTask as completeSuperlistTaskWithToken,
  createSuperlistList as createSuperlistListWithToken,
  moveSuperlistTask as moveSuperlistTaskWithToken,
  updateSuperlistTask as updateSuperlistTaskWithToken,
  type UpdateSuperlistTaskArgs,
} from '@/lib/superlistSync';

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

export async function pushSuperlistUpdate(taskUuid: string, args: UpdateSuperlistTaskArgs): Promise<SuperlistWriteResult> {
  if (!taskUuid) return { ok: false, error: 'Missing Superlist task id' };

  const resolved = await resolveSuperlistAccessToken();
  if (!resolved.ok) return { ok: false, error: resolved.message };

  try {
    await updateSuperlistTaskWithToken(resolved.token, { ...args, task_uuid: taskUuid });
    return { ok: true };
  } catch (e) {
    const err = e as Error & { status?: number };
    if (err?.status === 401) {
      const refreshed = await tryRefreshStoredToken();
      if (refreshed) {
        try {
          await updateSuperlistTaskWithToken(refreshed, { ...args, task_uuid: taskUuid });
          return { ok: true };
        } catch (retryErr) {
          return { ok: false, error: (retryErr as Error).message };
        }
      }
      return { ok: false, error: 'Superlist access token expired and could not be refreshed' };
    }
    return { ok: false, error: err?.message || 'Superlist update failed' };
  }
}

export interface SuperlistListWriteResult extends SuperlistWriteResult {
  listId?: string;
  url?: string | null;
}

/**
 * Create a list in Superlist (used when a Life OS Domain has no list yet).
 */
export async function pushSuperlistListCreation(title: string): Promise<SuperlistListWriteResult> {
  if (!title?.trim()) return { ok: false, error: 'Missing list title' };

  const resolved = await resolveSuperlistAccessToken();
  if (!resolved.ok) return { ok: false, error: resolved.message };

  const attempt = async (token: string): Promise<SuperlistListWriteResult> => {
    try {
      const list = await createSuperlistListWithToken(token, title);
      return { ok: true, listId: list.listId, url: list.url };
    } catch (e) {
      return { ok: false, error: (e as Error).message };
    }
  };

  const first = await attempt(resolved.token);
  if (first.ok || !(first.error || '').includes('401')) return first;

  const refreshed = await tryRefreshStoredToken();
  if (!refreshed) {
    return { ok: false, error: 'Superlist access token expired and could not be refreshed' };
  }
  return attempt(refreshed);
}

/**
 * Move a Superlist task into a list (or back to the inbox when listUuid is null).
 */
export async function pushSuperlistTaskMove(
  taskUuid: string,
  listUuid: string | null
): Promise<SuperlistWriteResult> {
  if (!taskUuid) return { ok: false, error: 'Missing Superlist task id' };

  const resolved = await resolveSuperlistAccessToken();
  if (!resolved.ok) return { ok: false, error: resolved.message };

  const attempt = async (token: string): Promise<SuperlistWriteResult> => {
    try {
      await moveSuperlistTaskWithToken(token, taskUuid, listUuid);
      return { ok: true };
    } catch (e) {
      const err = e as Error & { status?: number };
      return { ok: false, error: err?.message || 'Superlist move failed', status: err?.status } as SuperlistWriteResult;
    }
  };

  const first = await attempt(resolved.token);
  if (first.ok || !(first.error || '').includes('401')) return first;

  const refreshed = await tryRefreshStoredToken();
  if (!refreshed) {
    return { ok: false, error: 'Superlist access token expired and could not be refreshed' };
  }
  return attempt(refreshed);
}