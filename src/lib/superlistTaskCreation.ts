/**
 * Mirror a newly created Life OS task into Superlist.
 *
 * When Superlist is connected, the task is created in Superlist (under the
 * task's domain list, creating the list if needed) and the local row is
 * updated with the Superlist ids/URL so the two stay linked. Failures are
 * non-fatal: the local task remains valid without a Superlist copy.
 *
 * Tasks that already have a Superlist id (e.g. imported from Superlist) are
 * skipped to avoid creating duplicates.
 */

import { prisma } from '@/lib/prisma';
import { serializeDueDate } from '@/lib/date';
import { buildSuperlistTaskUrl } from '@/lib/superlist';
import { resolveSuperlistAccessToken } from '@/lib/superlistOAuth';
import { ensureSuperlistListForDomain } from '@/lib/superlistDomains';
import { pushSuperlistTaskCreation } from '@/lib/superlistWrite';

export interface MirrorNewTaskParams {
  taskId: string;
  title: string;
  notes?: string | null;
  dueDate?: Date | string | null;
  priority?: string | null;
  domainId?: string | null;
  superlistId?: string | null;
  source?: string | null;
}

/**
 * After a Life OS task is created locally, mirror it into Superlist when
 * connected and update the local row with the Superlist ids/URL.
 */
export async function mirrorNewTaskToSuperlist(params: MirrorNewTaskParams): Promise<void> {
  // Skip if the task already exists in Superlist.
  if (params.superlistId || params.source === 'SUPERLIST') return;

  const resolved = await resolveSuperlistAccessToken();
  if (!resolved.ok) return;

  // Ensure the domain has a Superlist list to file the task under.
  let listId: string | null = null;
  if (params.domainId) {
    const ensured = await ensureSuperlistListForDomain(params.domainId);
    if (ensured.ok) listId = ensured.listId ?? null;
  }

  const created = await pushSuperlistTaskCreation(
    params.title,
    listId,
    serializeDueDate(params.dueDate),
    params.priority,
    params.notes ?? null
  );
  if (!created.ok || !created.taskId) {
    console.warn(`Superlist task creation failed for task ${params.taskId}: ${created.error}`);
    return;
  }

  await prisma.task.update({
    where: { id: params.taskId },
    data: {
      superlistId: created.taskId,
      superlistListId: created.listId ?? null,
      superlistUrl: created.url ?? buildSuperlistTaskUrl(created.listId ?? null, created.taskId),
      source: 'SUPERLIST',
    },
  });
}
