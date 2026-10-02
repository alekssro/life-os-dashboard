import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const interaction = await prisma.crmInteraction.create({
      data: {
        contactId: data.contactId,
        type: data.type || 'NOTE',
        summary: data.summary,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });

    // Update lastInteractionAt on contact
    await prisma.crmContact.update({
      where: { id: data.contactId },
      data: { lastInteractionAt: new Date() },
    });

    return NextResponse.json(interaction, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to log interaction' }, { status: 500 });
  }
}
