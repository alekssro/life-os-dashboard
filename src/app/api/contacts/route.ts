export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const contacts = await prisma.crmContact.findMany({
    include: {
      domain: true,
      interactions: {
        orderBy: { date: 'desc' },
        take: 3,
      },
    },
    orderBy: { lastInteractionAt: 'desc' },
  });
  return NextResponse.json(contacts);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const contact = await prisma.crmContact.create({
      data: {
        name: data.name,
        role: data.role,
        company: data.company,
        email: data.email,
        phone: data.phone,
        notes: data.notes,
        familyDetails: data.familyDetails,
        followUpDays: data.followUpDays ? parseInt(data.followUpDays) : 30,
        domainId: data.domainId || null,
      },
      include: {
        domain: true,
      },
    });
    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'Missing contact id' }, { status: 400 });

    await prisma.crmContact.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}

