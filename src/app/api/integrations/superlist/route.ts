export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateApiKey } from '@/lib/auth';
import { resolveSuperlistUrl } from '@/lib/superlist';
import { pullSuperlistTasks } from '@/lib/superlistSync';
import { resolveSuperlistAccessToken, tryRefreshStoredToken } from '@/lib/superlistOAuth';
import { findOrCreateDomainForList, resolveDomainIdForList } from '@/lib/superlistDomains';

/**
 * Superlist integration endpoint:
 * - GET: returns sync status, connected Superlist task counts, and list mappings
 * - POST: accepts Superlist task sync payload (e.g. from Superlist MCP / webhook / script)
 *         and upserts tasks into the Dashboard with source = 'SUPERLIST'
 */
export async function GET(req: NextRequest) {
  try {
    const superlistTasks = await prisma.task.findMany({
      where: { source: 'SUPERLIST' },
      include: { domain: true, project: true },
      orderBy: [{ isTop3: 'desc' }, { dueDate: 'asc' }],
    });

    const projectsWithSuperlist = await prisma.project.findMany({
      where: { superlistListId: { not: null } },
      select: {
        id: true,
        title: true,
        superlistListId: true,
        superlistUrl: true,
        domain: { select: { id: true, name: true } },
      },
    });

    const domainsWithSuperlist = await prisma.domain.findMany({
      where: { superlistListId: { not: null } },
      select: {
        id: true,
        name: true,
        slug: true,
        superlistListId: true,
        superlistUrl: true,
        _count: { select: { tasks: true, projects: true } },
      },
      orderBy: { order: 'asc' },
    });

    const totalSynced = superlistTasks.length;
    const openCount = superlistTasks.filter((t) => t.status !== 'DONE').length;

    return NextResponse.json({
      configured: true,
      totalSynced,
      openCount,
      tasks: superlistTasks,
      linkedProjects: projectsWithSuperlist,
      linkedDomains: domainsWithSuperlist,
    });
  } catch (error: any) {
    console.error('Error fetching Superlist sync status:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch status' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Validate API key if configured
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, tasks, task, listId, domainId, projectId } = body;

    // Action 1: Batch sync tasks from Superlist
    if (action === 'SYNC_BATCH' && Array.isArray(tasks)) {
      let created = 0;
      let updated = 0;

      for (const t of tasks) {
        if (!t.title) continue;

        const superlistId = t.id || t.uuid || t.superlistId;
        const taskListId = t.listId || t.superlistListId || listId || null;
        const taskUrl = resolveSuperlistUrl(t.url, taskListId, superlistId);
        const dueDate = t.dueDate ? new Date(t.dueDate) : null;
        const isDone = Boolean(t.isCompleted || t.completed || t.status === 'DONE');
        const taskDomainId = domainId || (await resolveDomainIdForList(taskListId));

        if (superlistId) {
          const existing = await prisma.task.findUnique({
            where: { superlistId },
          });

          if (existing) {
            await prisma.task.update({
              where: { superlistId },
              data: {
                title: t.title,
                notes: t.notes !== undefined ? t.notes : existing.notes,
                status: isDone ? 'DONE' : 'TODO',
                completedAt: isDone ? new Date() : null,
                dueDate: dueDate !== undefined ? dueDate : existing.dueDate,
                superlistUrl: taskUrl || existing.superlistUrl,
                superlistListId: taskListId || existing.superlistListId,
                domainId: taskDomainId || existing.domainId,
                projectId: projectId || existing.projectId,
              },
            });
            updated++;
          } else {
            await prisma.task.create({
              data: {
                title: t.title,
                notes: t.notes || null,
                status: isDone ? 'DONE' : 'TODO',
                priority: t.isTop3 ? 'TOP_3' : 'NORMAL',
                isTop3: Boolean(t.isTop3),
                dueDate,
                source: 'SUPERLIST',
                superlistId,
                superlistListId: taskListId,
                superlistUrl: taskUrl,
                domainId: taskDomainId || null,
                projectId: projectId || null,
              },
            });
            created++;
          }
        } else {
          await prisma.task.create({
            data: {
              title: t.title,
              notes: t.notes || null,
              status: isDone ? 'DONE' : 'TODO',
              priority: t.isTop3 ? 'TOP_3' : 'NORMAL',
              isTop3: Boolean(t.isTop3),
              dueDate,
              source: 'SUPERLIST',
              domainId: taskDomainId || null,
              projectId: projectId || null,
            },
          });
          created++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Synced ${tasks.length} tasks (${created} created, ${updated} updated)`,
        created,
        updated,
      });
    }

    // Action 2: Single task sync/capture
    if (action === 'SYNC_TASK' || task) {
      const item = task || body;
      const superlistId = item.id || item.uuid || item.superlistId;
      const taskListId = item.listId || item.superlistListId || listId || null;
      const taskUrl = resolveSuperlistUrl(item.url, taskListId, superlistId);
      const dueDate = item.dueDate ? new Date(item.dueDate) : null;
      const isDone = Boolean(item.isCompleted || item.completed || item.status === 'DONE');
      const taskDomainId = domainId || (await resolveDomainIdForList(taskListId));

      const saved = await prisma.task.upsert({
        where: { superlistId: superlistId || 'none' },
        create: {
          title: item.title,
          notes: item.notes || null,
          status: isDone ? 'DONE' : 'TODO',
          priority: item.isTop3 ? 'TOP_3' : 'NORMAL',
          isTop3: Boolean(item.isTop3),
          dueDate,
          source: 'SUPERLIST',
          superlistId: superlistId || null,
          superlistListId: taskListId,
          superlistUrl: taskUrl,
          domainId: taskDomainId || null,
          projectId: projectId || null,
        },
        update: {
          title: item.title,
          notes: item.notes !== undefined ? item.notes : undefined,
          status: isDone ? 'DONE' : 'TODO',
          dueDate: dueDate !== undefined ? dueDate : undefined,
          superlistUrl: taskUrl,
          superlistListId: taskListId || undefined,
          ...(taskDomainId ? { domainId: taskDomainId } : {}),
        },
      });

      return NextResponse.json({ success: true, task: saved });
    }

    // Action 3: Pull-on-demand sync from Superlist (OAuth token in settings,
    // or static SUPERLIST_MCP_TOKEN as a fallback)
    if (action === 'SYNC_PULL') {
      const resolved = await resolveSuperlistAccessToken();
      if (!resolved.ok) {
        return NextResponse.json(
          { error: resolved.message, code: 'NOT_CONNECTED' },
          { status: 400 }
        );
      }

      let pullResult;
      try {
        pullResult = await pullSuperlistTasks(resolved.token);
      } catch (err: any) {
        // Access token may have just expired — try a refresh and retry once.
        if (err?.status === 401) {
          const refreshed = await tryRefreshStoredToken();
          if (refreshed) {
            pullResult = await pullSuperlistTasks(refreshed);
          } else {
            return NextResponse.json(
              { error: 'Superlist access token expired and could not be refreshed. Reconnect in Settings → Superlist Integration.', code: 'REAUTH_REQUIRED' },
              { status: 401 }
            );
          }
        } else {
          console.error('Superlist sync failed:', err);
          return NextResponse.json({ error: err?.message || 'Superlist sync failed' }, { status: 502 });
        }
      }

      const { tasks, lists } = pullResult;

      // Map each Superlist list to a Life OS Domain (find linked -> match by
      // name -> create). Tasks then inherit the domain of their list.
      const domainIdByListId: Record<string, string> = {};
      let domainsCreated = 0;
      let domainsLinked = 0;
      for (const list of lists) {
        const outcome = await findOrCreateDomainForList(list);
        domainIdByListId[list.id] = outcome.domainId;
        if (outcome.created) domainsCreated++;
        if (outcome.linked) domainsLinked++;
      }

      let created = 0;
      let updated = 0;
      let skipped = 0;

      for (const item of tasks) {
        if (!item.title || !item.id) continue;

        const listDomainId = item.listId ? domainIdByListId[item.listId] ?? null : null;

        const existing = await prisma.task.findUnique({
          where: { superlistId: item.id },
        });

        if (existing) {
          // Assign the list's domain unless the user manually set a different
          // one and the task has not moved lists.
          const listChanged = existing.superlistListId !== item.listId;
          const nextDomainId =
            listDomainId && (listChanged || !existing.domainId) ? listDomainId : undefined;

          await prisma.task.update({
            where: { superlistId: item.id },
            data: {
              title: item.title,
              status: item.isCompleted ? 'DONE' : 'TODO',
              completedAt: item.isCompleted
                ? item.completedAt
                  ? new Date(item.completedAt)
                  : new Date()
                : null,
              dueDate: item.dueDate ? new Date(item.dueDate) : null,
              superlistListId: item.listId,
              superlistUrl: item.url,
              source: 'SUPERLIST',
              priority: item.priority as any,
              ...(nextDomainId ? { domainId: nextDomainId } : {}),
            },
          });
          updated++;
        } else {
          // Don't flood the dashboard with historical completed tasks.
          if (item.isCompleted) {
            skipped++;
            continue;
          }
          await prisma.task.create({
            data: {
              title: item.title,
              notes: null,
              status: 'TODO',
              priority: item.priority as any,
              isTop3: Boolean(item.isTop3),
              dueDate: item.dueDate ? new Date(item.dueDate) : null,
              source: 'SUPERLIST',
              superlistId: item.id,
              superlistListId: item.listId,
              superlistUrl: item.url,
              domainId: listDomainId,
            },
          });
          created++;
        }
      }

      const domainsUnchanged = lists.length - domainsCreated - domainsLinked;
      return NextResponse.json({
        success: true,
        message: `Synced ${tasks.length} tasks from ${lists.length} lists (${created} created, ${updated} updated, ${skipped} completed skipped). Domains: ${domainsCreated} created, ${domainsLinked} linked, ${domainsUnchanged} unchanged.`,
        lists: lists.length,
        total: tasks.length,
        created,
        updated,
        skipped,
        domains: {
          total: lists.length,
          created: domainsCreated,
          linked: domainsLinked,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action or payload' }, { status: 400 });
  } catch (error: any) {
    console.error('Error in Superlist API route:', error);
    return NextResponse.json({ error: error.message || 'Operation failed' }, { status: 500 });
  }
}
