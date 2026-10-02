import { prisma } from './prisma';

export interface AttentionReport {
  slippingProjects: Array<{
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
  const slippingDaysThreshold = 14;
  const projectCutoff = new Date(now.getTime() - slippingDaysThreshold * 24 * 60 * 60 * 1000);

  // 1. Projects with no activity in 14+ days
  const activeProjects = await prisma.project.findMany({
    where: {
      status: 'ACTIVE',
      lastActivityAt: {
        lt: projectCutoff,
      },
    },
    include: {
      domain: true,
    },
    orderBy: {
      lastActivityAt: 'asc',
    },
  });

  const slippingProjects = activeProjects.map((p) => {
    const diffMs = now.getTime() - new Date(p.lastActivityAt).getTime();
    const daysInactive = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return {
      id: p.id,
      title: p.title,
      domainName: p.domain?.name,
      daysInactive,
      lastActivityAt: p.lastActivityAt,
    };
  });

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
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

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
    slippingContacts,
    overdueTasks,
    needsReviewInboxCount,
    unreadNotificationsCount,
  };
}
