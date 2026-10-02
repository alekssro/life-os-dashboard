export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const domains = await prisma.domain.findMany({
    orderBy: { order: 'asc' },
    include: {
      _count: {
        select: {
          tasks: true,
          projects: true,
        },
      },
    },
  });
  return NextResponse.json(domains);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const domain = await prisma.domain.create({
      data: {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
        description: data.description,
        color: data.color || '#B84A39',
        order: data.order || 0,
      },
    });
    return NextResponse.json(domain, { status: 201 });
  } catch (error) {
    console.error('Error creating domain:', error);
    return NextResponse.json({ error: 'Failed to create domain' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing domain id' }, { status: 400 });

    await prisma.domain.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting domain:', error);
    return NextResponse.json({ error: 'Failed to delete domain' }, { status: 500 });
  }
}
