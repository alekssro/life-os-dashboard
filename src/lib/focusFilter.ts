import { Task, Event, FocusMode } from '@/types';

/**
 * Keywords and heuristics to map domain/list/title to FocusMode
 */
export function matchesFocusMode(
  focusMode: FocusMode,
  item: {
    domainName?: string | null;
    domainSlug?: string | null;
    title?: string | null;
    category?: string | null;
  }
): boolean {
  if (focusMode === 'ALL') return true;

  const text = `${item.domainName || ''} ${item.domainSlug || ''} ${item.title || ''} ${item.category || ''}`.toLowerCase();

  switch (focusMode) {
    case 'DEEP_WORK':
      return (
        text.includes('work') ||
        text.includes('client') ||
        text.includes('project') ||
        text.includes('business') ||
        text.includes('consulting') ||
        text.includes('dev') ||
        text.includes('code') ||
        text.includes('engineering') ||
        text.includes('deep')
      );

    case 'HOMELAB':
      return (
        text.includes('homelab') ||
        text.includes('devops') ||
        text.includes('server') ||
        text.includes('infra') ||
        text.includes('k8s') ||
        text.includes('docker') ||
        text.includes('nas') ||
        text.includes('linux') ||
        text.includes('network') ||
        text.includes('cluster')
      );

    case 'PERSONAL':
      return (
        text.includes('personal') ||
        text.includes('family') ||
        text.includes('health') ||
        text.includes('routine') ||
        text.includes('home') ||
        text.includes('finance') ||
        text.includes('fitness') ||
        text.includes('errand')
      );

    default:
      return true;
  }
}

export function filterTasksByFocus(tasks: Task[], focusMode: FocusMode): Task[] {
  if (focusMode === 'ALL') return tasks;
  return tasks.filter((t) =>
    matchesFocusMode(focusMode, {
      domainName: t.domain?.name,
      domainSlug: t.domain?.slug,
      title: t.title,
    })
  );
}

export function filterEventsByFocus(events: Event[], focusMode: FocusMode): Event[] {
  if (focusMode === 'ALL') return events;
  return events.filter((e) =>
    matchesFocusMode(focusMode, {
      domainName: e.domain?.name,
      domainSlug: e.domain?.slug,
      title: e.title,
      category: e.calendar?.name,
    })
  );
}
