/**
 * Helpers for building canonical Superlist URLs.
 *
 * Superlist task deep links must be list-scoped:
 *   https://app.superlist.com/lists/<listId>/tasks/<taskId>
 * (not the bare https://app.superlist.com/tasks/<taskId> form).
 */

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

export const SUPERLIST_BASE_URL = 'https://app.superlist.com';

export interface SuperlistIds {
  listId: string | null;
  taskId: string | null;
}

/**
 * Extract the Superlist list and task UUIDs from a URL or raw UUID string.
 *
 * For a task URL (`/lists/<listId>/tasks/<taskId>`) the last UUID is the task
 * and the one before it is the list. A single UUID is treated as a task id.
 */
export function extractSuperlistIds(input: string | null | undefined): SuperlistIds {
  if (!input) return { listId: null, taskId: null };

  const matches = input.match(UUID_RE);
  if (!matches || matches.length === 0) {
    return { listId: null, taskId: null };
  }
  if (matches.length === 1) {
    return { listId: null, taskId: matches[0] };
  }
  return {
    listId: matches[matches.length - 2],
    taskId: matches[matches.length - 1],
  };
}

/** Build a canonical Superlist task URL from a list and task id. */
export function buildSuperlistTaskUrl(
  listId?: string | null,
  taskId?: string | null
): string | null {
  if (listId && taskId) {
    return `${SUPERLIST_BASE_URL}/lists/${listId}/tasks/${taskId}`;
  }
  if (listId) return `${SUPERLIST_BASE_URL}/lists/${listId}`;
  if (taskId) return `${SUPERLIST_BASE_URL}/tasks/${taskId}`;
  return null;
}

/** Build a canonical Superlist list URL. */
export function buildSuperlistListUrl(listId?: string | null): string | null {
  return listId ? `${SUPERLIST_BASE_URL}/lists/${listId}` : null;
}

/**
 * Resolve the best available URL, preferring a canonical list-scoped task URL
 * whenever both ids are known, then falling back to an explicit URL / partial.
 */
export function resolveSuperlistUrl(
  explicitUrl: string | null | undefined,
  listId?: string | null,
  taskId?: string | null
): string | null {
  if (listId && taskId) return buildSuperlistTaskUrl(listId, taskId);
  return explicitUrl || buildSuperlistTaskUrl(listId, taskId);
}

export interface SuperlistLinkableTask {
  superlistUrl?: string | null;
  superlistId?: string | null;
  superlistListId?: string | null;
  project?: { superlistListId?: string | null } | null;
}

/** Resolve a task's Superlist URL, preferring a canonical list-scoped link. */
export function resolveSuperlistTaskUrl(task: SuperlistLinkableTask | null | undefined): string | null {
  if (!task) return null;
  const listId = task.superlistListId || task.project?.superlistListId || null;
  const taskId = task.superlistId || null;
  return resolveSuperlistUrl(task.superlistUrl, listId, taskId);
}
