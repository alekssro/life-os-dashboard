export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

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
        where: { status: { in: ['TODO', 'IN_PROGRESS'] } },
      },
    },
    orderBy: { lastActivityAt: 'desc' },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const project = await prisma.project.create({
      data: {
        title: data.title,
        slug: data.title.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        type: data.type || 'MILESTONE',
        status: data.status || 'ACTIVE',
        targetDate: data.targetDate ? new Date(data.targetDate) : null,
        monthlyBudgetHours: data.monthlyBudgetHours ? parseFloat(data.monthlyBudgetHours) : null,
        domainId: data.domainId || null,
      },
      include: {
        domain: true,
      },
    });
    return NextResponse.json(project, { status: 201 });
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
      data.targetDate = new Date(data.targetDate);
    }

    const updated = await prisma.project.update({
      where: { id },
      data: {
        ...data,
        lastActivityAt: new Date(),
      },
      include: {
        domain: true,
      },
    });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing project id' }, { status: 400 });

    // Unlink tasks or cascade
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

