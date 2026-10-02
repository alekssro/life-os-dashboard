import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseFlexibleDate } from '@/lib/date';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();

    const interactionDate = data.date ? parseFlexibleDate(data.date) : new Date();
    if (data.date && !interactionDate) {
      return NextResponse.json({ error: 'Invalid date. Use dd/mm/yyyy.' }, { status: 400 });
    }

    const interaction = await prisma.crmInteraction.create({
      data: {
        contactId: data.contactId,
        type: data.type || 'NOTE',
        summary: data.summary,
        date: interactionDate ?? new Date(),
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
