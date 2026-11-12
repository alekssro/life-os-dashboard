'use client';

/**
 * Shared "delete a task" flow.
 *
 * A task that came from Superlist is deleted there too (it lands in the
 * Superlist trash, so it stays restorable from there). The dashboard only
 * removes its local copy once Superlist has accepted the delete — otherwise
 * the next sync would simply pull the task back.
 */

import { useCallback } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { Routine, Task } from '@/types';

export function useDeleteTask() {
  const deleteTask = useDashboardStore((s) => s.deleteTask);
  const deleteRoutine = useDashboardStore((s) => s.deleteRoutine);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  /**
   * Confirms with the user, deletes the task (locally + Superlist) and
   * refreshes the dashboard. Returns an error message when it failed, or
   * undefined on success.
   */
  const confirmAndDelete = useCallback(
    async (task: Task): Promise<string | undefined> => {
      const confirmed = confirm(
        `Delete "${task.title}"?` +
          (task.superlistId
            ? '\n\nIt will also be deleted in Superlist (moved to the Superlist trash).'
            : '\n\nThis cannot be undone.')
      );
      if (!confirmed) return undefined;

      const result = await deleteTask(task.id);
      if (!result.ok) {
        return result.error || 'Could not delete the task';
      }

      await fetchDashboardData();
      return result.warning;
    },
    [deleteTask, fetchDashboardData]
  );

  /**
   * Same flow for a habit: deletes it locally and, when it came from a
   * recurring Superlist task, there too.
   */
  const confirmAndDeleteRoutine = useCallback(
    async (routine: Routine): Promise<string | undefined> => {
      const confirmed = confirm(
        `Delete the habit "${routine.title}"?` +
          (routine.superlistId
            ? '\n\nIt will also be deleted in Superlist (moved to the Superlist trash).'
            : '\n\nIts streak and history will be lost.')
      );
      if (!confirmed) return undefined;

      const result = await deleteRoutine(routine.id);
      if (!result.ok) {
        return result.error || 'Could not delete the habit';
      }

      await fetchDashboardData();
      return result.warning;
    },
    [deleteRoutine, fetchDashboardData]
  );

  return { confirmAndDelete, confirmAndDeleteRoutine };
}
