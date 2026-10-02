import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseCaptureInput } from '@/lib/ai/parser';
import { validateApiKey } from '@/lib/auth';

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const subject = body.subject || 'Incoming Email Task';
    const textBody = body.text || body.body || body.html || '';
    const fromAddress = body.from || '';
    const messageId = body.messageId || '';

    // Generate direct Gmail permalink if messageId or subject exists
    let emailPermalink = '';
    if (messageId) {
      const cleanMsgId = messageId.replace(/[<>]/g, '');
      emailPermalink = `https://mail.google.com/mail/u/0/#search/rfc822msgid%3A${encodeURIComponent(cleanMsgId)}`;
    }

    const promptText = `Email Subject: ${subject}\nFrom: ${fromAddress}\nBody: ${textBody.slice(0, 1500)}`;
    const parsed = await parseCaptureInput(promptText);

    // Save as Task or Inbox Triage Item
    const task = await prisma.task.create({
      data: {
        title: parsed.title || subject,
        notes: `${parsed.notes || ''}\n\nFrom: ${fromAddress}${emailPermalink ? `\nEmail Link: ${emailPermalink}` : ''}`.trim(),
        status: 'TODO',
        priority: parsed.priority || 'NORMAL',
        dueDate: parsed.due_date ? new Date(parsed.due_date) : null,
      },
    });

    await prisma.systemNotification.create({
      data: {
        title: 'Email Task Ingested',
        message: task.title,
        type: 'EMAIL',
      },
    });

    return NextResponse.json({
      success: true,
      taskId: task.id,
      parsed,
      permalink: emailPermalink,
    });
  } catch (error) {
    console.error('Email webhook error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
