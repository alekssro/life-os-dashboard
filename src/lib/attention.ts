import { prisma } from './prisma';

export interface AttentionReport {
  slippingProjects: Array<{
    id: string;
    title: string;
    domainName?: string;
    daysInactive: number;
    lastActivityAt: Date;
    health: string;
    waitingOn?: string | null;
  }>;
  atRiskProjects: Array<{
    id: string;
    title: string;
    domainName?: string;
    overdueTaskCount: number;
    waitingOn?: string | null;
  }>;
  waitingProjects: Array<{
    id: string;
    title: string;
    domainName?: string;
    waitingOn?: string | null;
  }>;
  quietProjects: Array<{
    id: string;
    title: string;
    domainName?: string;
    daysInactive: number;
    lastActivityAt: Date;
  }>;
  slippingContacts: Array<{
    id: string;
    name: string;
    daysSinceInteraction: number;
    followUpDays: number;
    company?: string | null;
  }>;
  overdueTasks: Array<{
    id: string;
    title: string;
    domainName?: string;
    dueDate: Date | null;
    daysOverdue: number;
  }>;
  needsReviewInboxCount: number;
  unreadNotificationsCount: number;
}

export async function getAttentionReport(): Promise<AttentionReport> {
  const now = new Date();
  const defaultThreshold = 14;
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  // Fetch all active projects with domain and tasks
  const activeProjects = await prisma.project.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      domain: true,
      tasks: {
        where: { status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] } },
      },
    },
    orderBy: {
      lastActivityAt: 'asc',
    },
  });

  const slippingProjects: AttentionReport['slippingProjects'] = [];
  const atRiskProjects: AttentionReport['atRiskProjects'] = [];
  const waitingProjects: AttentionReport['waitingProjects'] = [];
  const quietProjects: AttentionReport['quietProjects'] = [];

  for (const p of activeProjects) {
    const threshold = p.domain?.slippingThresholdDays ?? defaultThreshold;
    const daysSinceActivity = Math.floor(
      (now.getTime() - new Date(p.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
    );

    const overdueTasks = p.tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < todayStart && t.status !== 'DONE'
    );
    const waitingTasks = p.tasks.filter((t) => t.status === 'WAITING');

    let health = 'ON_TRACK';
    if (overdueTasks.length > 0) health = 'AT_RISK';
    else if (waitingTasks.length > 0) health = 'WAITING';
    else if (daysSinceActivity > threshold) health = 'QUIET';

    if (health === 'AT_RISK') {
      atRiskProjects.push({
        id: p.id,
        title: p.title,
        domainName: p.domain?.name,
        overdueTaskCount: overdueTasks.length,
        waitingOn: p.waitingOn,
      });
    } else if (health === 'WAITING') {
      waitingProjects.push({
        id: p.id,
        title: p.title,
        domainName: p.domain?.name,
        waitingOn: p.waitingOn,
      });
    } else if (health === 'QUIET') {
      quietProjects.push({
        id: p.id,
        title: p.title,
        domainName: p.domain?.name,
        daysInactive: daysSinceActivity,
        lastActivityAt: p.lastActivityAt,
      });
    } else if (daysSinceActivity > threshold) {
      // Also include in slipping for backward compatibility
      slippingProjects.push({
        id: p.id,
        title: p.title,
        domainName: p.domain?.name,
        daysInactive: daysSinceActivity,
        lastActivityAt: p.lastActivityAt,
        health: 'QUIET',
        waitingOn: p.waitingOn,
      });
    }
  }

  // 2. Contacts needing follow-up
  const allContacts = await prisma.crmContact.findMany({
    orderBy: {
      lastInteractionAt: 'asc',
    },
  });

  const slippingContacts = allContacts
    .filter((c) => {
      const diffMs = now.getTime() - new Date(c.lastInteractionAt).getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return days >= c.followUpDays;
    })
    .map((c) => {
      const diffMs = now.getTime() - new Date(c.lastInteractionAt).getTime();
      return {
        id: c.id,
        name: c.name,
        company: c.company,
        followUpDays: c.followUpDays,
        daysSinceInteraction: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
      };
    });

  // 3. Overdue Tasks
  const overdue = await prisma.task.findMany({
    where: {
      status: {
        in: ['TODO', 'IN_PROGRESS'],
      },
      dueDate: {
        lt: todayStart,
      },
    },
    include: {
      domain: true,
    },
    orderBy: {
      dueDate: 'asc',
    },
  });

  const overdueTasks = overdue.map((t) => {
    const due = t.dueDate ? new Date(t.dueDate) : now;
    const diff = Math.floor((todayStart.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return {
      id: t.id,
      title: t.title,
      domainName: t.domain?.name,
      dueDate: t.dueDate,
      daysOverdue: Math.max(1, diff),
    };
  });

  // 4. Inbox triage items & unread notifications
  const [needsReviewInboxCount, unreadNotificationsCount] = await Promise.all([
    prisma.inboxItem.count({ where: { status: 'NEEDS_REVIEW' } }),
    prisma.systemNotification.count({ where: { read: false } }),
  ]);

  return {
    slippingProjects,
    atRiskProjects,
    waitingProjects,
    quietProjects,
    slippingContacts,
    overdueTasks,
    needsReviewInboxCount,
    unreadNotificationsCount,
  };
}