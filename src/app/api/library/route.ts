export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const resurface = searchParams.get('resurface');

  if (resurface === 'true') {
    // Pick one item that hasn't been resurfaced recently, or random
    const count = await prisma.libraryItem.count();
    if (count === 0) {
      return NextResponse.json(null);
    }

    const item = await prisma.libraryItem.findFirst({
      orderBy: { lastResurfacedAt: 'asc' },
    });

    if (item) {
      await prisma.libraryItem.update({
        where: { id: item.id },
        data: { lastResurfacedAt: new Date() },
      });
    }

    return NextResponse.json(item);
  }

  const items = await prisma.libraryItem.findMany({
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const item = await prisma.libraryItem.create({
      data: {
        title: data.title,
        body: data.body,
        author: data.author,
        source: data.source,
        type: data.type || 'QUOTE',
        tags: data.tags,
      },
    });
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create library item' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing library item id' }, { status: 400 });

    await prisma.libraryItem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete library item' }, { status: 500 });
  }
}

