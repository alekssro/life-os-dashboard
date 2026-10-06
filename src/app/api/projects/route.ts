export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFlexibleDate } from '@/lib/date';

type ProjectHealth = 'ON_TRACK' | 'WAITING' | 'QUIET' | 'AT_RISK' | 'COMPLETED';

function computeProjectHealth(project: any, tasks: any[], domainSlippingThreshold?: number): ProjectHealth {
  if (project.status === 'COMPLETED' || project.status === 'ARCHIVED') {
    return 'COMPLETED';
  }

  const now = new Date();
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== 'DONE'
  );
  const waitingTasks = tasks.filter((t) => t.status === 'WAITING');
  const daysSinceActivity = Math.floor(
    (now.getTime() - new Date(project.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const threshold = domainSlippingThreshold ?? 14;

  if (overdueTasks.length > 0) return 'AT_RISK';
  if (waitingTasks.length > 0) return 'WAITING';
  if (daysSinceActivity > threshold) return 'QUIET';
  return 'ON_TRACK';
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get('status');

  const where: any = {};
  if (status) {
    where.status = status;
  }

  const projects = await prisma.project.findMany({
    where,
    include: {
      domain: true,
      tasks: {
        where: { status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] } },
      },
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  const projectsWithHealth = projects.map((p) => ({
    ...p,
    health: computeProjectHealth(p, p.tasks, p.domain?.slippingThresholdDays ?? undefined),
  }));

  return NextResponse.json(projectsWithHealth);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const targetDate = parseFlexibleDate(data.targetDate);
    if (data.targetDate && !targetDate) {
      return NextResponse.json({ error: 'Invalid target date. Use dd/mm/yyyy.' }, { status: 400 });
    }

    const project = await prisma.project.create({
      data: {
        title: data.title,
        slug: data.title.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        type: data.type || 'MILESTONE',
        status: data.status || 'ACTIVE',
        targetDate,
        monthlyBudgetHours: data.monthlyBudgetHours ? parseFloat(data.monthlyBudgetHours) : null,
        domainId: data.domainId || null,
        waitingOn: data.waitingOn || null,
      },
      include: {
        domain: true,
        tasks: {
          where: { status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] } },
        },
      },
    });

    const projectWithHealth = {
      ...project,
      health: computeProjectHealth(project, project.tasks, project.domain?.slippingThresholdDays ?? undefined),
    };

    return NextResponse.json(projectWithHealth, { status: 201 });
  } catch (error) {
    console.error('Error creating project:', error);
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, ...data } = await req.json();
    if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

    if (data.targetDate) {
      const parsedTargetDate = parseFlexibleDate(data.targetDate);
      if (!parsedTargetDate) {
        return NextResponse.json({ error: 'Invalid target date. Use dd/mm/yyyy.' }, { status: 400 });
      }
      data.targetDate = parsedTargetDate;
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        lastActivityAt: new Date(),
      },
      include: {
        domain: true,
        tasks: {
          where: { status: { in: ['TODO', 'IN_PROGRESS', 'WAITING'] } },
        },
      },
    });

    const projectWithHealth = {
      ...updated,
      health: computeProjectHealth(updated, updated.tasks, updated.domain?.slippingThresholdDays ?? undefined),
    };

    return NextResponse.json(projectWithHealth);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing project id' }, { status: 400 });

    await prisma.task.updateMany({
      where: { projectId: id },
      data: { projectId: null },
    });

    await prisma.project.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
  }
}