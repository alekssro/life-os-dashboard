export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseCaptureInput } from '@/lib/ai/parser';
import { validateApiKey, checkRateLimit } from '@/lib/auth';

export async function POST(req: NextRequest) {
  // Rate limiting & security
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  if (!validateApiKey(req)) {
    return NextResponse.json({ error: 'Unauthorized: Invalid or missing API key' }, { status: 401 });
  }

  try {
    let textToProcess = '';
    let targetType: string | undefined = undefined;
    let extraDetails: any = {};
    const contentType = req.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      const body = await req.json();
      textToProcess = body.text || '';
      targetType = body.targetType;
      extraDetails = body.details || body;
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const rawText = formData.get('text');
      targetType = (formData.get('targetType') as string) || undefined;
      const audioFile = formData.get('audio') as Blob | null;

      if (rawText && typeof rawText === 'string') {
        textToProcess = rawText;
      } else if (audioFile && process.env.OPENAI_API_KEY) {
        // Forward audio blob to OpenAI Whisper API
        const whisperFormData = new FormData();
        whisperFormData.append('file', audioFile, 'memo.webm');
        whisperFormData.append('model', 'whisper-1');

        const whisperRes = await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: whisperFormData,
        });

        if (whisperRes.ok) {
          const whisperData = await whisperRes.json();
          textToProcess = whisperData.text || '';
        } else {
          return NextResponse.json({ error: 'Audio transcription failed' }, { status: 500 });
        }
      }
    }

    if (!textToProcess.trim()) {
      return NextResponse.json({ error: 'No text or content provided' }, { status: 400 });
    }

    // =========================================================================
    // 1. EXPLICIT TYPE ROUTING (100% Deterministic, Zero AI required)
    // =========================================================================
    if (targetType && targetType !== 'AUTO') {
      const cleanText = textToProcess.trim();

      // A. ROUTINE
      if (targetType === 'ROUTINE') {
        const timeOfDay = extraDetails.timeOfDay || 'MORNING';
        const maxOrder = await prisma.routine.findFirst({
          where: { timeOfDay },
          orderBy: { order: 'desc' },
          select: { order: true },
        });

        const routine = await prisma.routine.create({
          data: {
            title: cleanText,
            timeOfDay,
            icon: extraDetails.icon || '✨',
            frequency: extraDetails.frequency || 'DAILY',
            daysOfWeek: extraDetails.daysOfWeek || null,
            dayOfMonth: extraDetails.dayOfMonth ? parseInt(extraDetails.dayOfMonth) : null,
            order: (maxOrder?.order ?? 0) + 1,
          },
        });

        await prisma.systemNotification.create({
          data: {
            title: 'Routine created',
            message: `${routine.icon} ${routine.title} (${timeOfDay})`,
            type: 'INFO',
          },
        });

        return NextResponse.json({ success: true, type: 'ROUTINE', item: routine });
      }

      // B. PROJECT
      if (targetType === 'PROJECT') {
        const project = await prisma.project.create({
          data: {
            title: cleanText,
            slug: cleanText.toLowerCase().replace(/\s+/g, '-'),
            type: extraDetails.type || 'MILESTONE',
            domainId: extraDetails.domainId || null,
            monthlyBudgetHours: extraDetails.monthlyBudgetHours ? parseFloat(extraDetails.monthlyBudgetHours) : null,
          },
          include: { domain: true },
        });

        await prisma.systemNotification.create({
          data: {
            title: 'Project created',
            message: project.title,
            type: 'INFO',
          },
        });

        return NextResponse.json({ success: true, type: 'PROJECT', item: project });
      }

      // C. PERSON (CRM CONTACT)
      if (targetType === 'PERSON') {
        const contact = await prisma.crmContact.create({
          data: {
            name: cleanText,
            company: extraDetails.company || null,
            familyDetails: extraDetails.familyDetails || null,
            domainId: extraDetails.domainId || null,
          },
          include: { domain: true },
        });

        await prisma.systemNotification.create({
          data: {
            title: 'Contact created',
            message: contact.name,
            type: 'INFO',
          },
        });

        return NextResponse.json({ success: true, type: 'PERSON', item: contact });
      }

      // D. QUOTE / LIBRARY ITEM
      if (targetType === 'QUOTE' || targetType === 'LIBRARY') {
        const quote = await prisma.libraryItem.create({
          data: {
            title: extraDetails.title || cleanText.slice(0, 50),
            body: cleanText,
            author: extraDetails.author || null,
            type: 'QUOTE',
            tags: extraDetails.tags || null,
          },
        });

        await prisma.systemNotification.create({
          data: {
            title: 'Saved to Library',
            message: quote.title,
            type: 'INFO',
          },
        });

        return NextResponse.json({ success: true, type: 'LIBRARY', item: quote });
      }

      // E. DOMAIN
      if (targetType === 'DOMAIN') {
        const domain = await prisma.domain.create({
          data: {
            name: cleanText,
            slug: cleanText.toLowerCase().replace(/\s+/g, '-'),
            color: extraDetails.color || '#B84A39',
          },
        });

        await prisma.systemNotification.create({
          data: {
            title: 'Domain created',
            message: domain.name,
            type: 'INFO',
          },
        });

        return NextResponse.json({ success: true, type: 'DOMAIN', item: domain });
      }

      // F. TASK (Direct without AI)
      if (targetType === 'TASK') {
        const task = await prisma.task.create({
          data: {
            title: cleanText,
            notes: extraDetails.notes || null,
            status: 'TODO',
            priority: extraDetails.priority || 'NORMAL',
            dueDate: extraDetails.dueDate ? new Date(extraDetails.dueDate) : null,
            isTop3: Boolean(extraDetails.isTop3),
            domainId: extraDetails.domainId || null,
            projectId: extraDetails.projectId || null,
          },
          include: { domain: true },
        });

        await prisma.systemNotification.create({
          data: {
            title: 'Task created',
            message: task.title,
            type: 'TASK_CREATED',
          },
        });

        return NextResponse.json({ success: true, type: 'TASK', item: task });
      }
    }

    // =========================================================================
    // 2. AUTO NATURAL LANGUAGE INGESTION (AI with local rule-based fallback)
    // =========================================================================
    const parsed = await parseCaptureInput(textToProcess);

    // Find or match domain if domain_hint provided
    let domainId: string | null = null;
    if (parsed.domain_hint) {
      const domain = await prisma.domain.findFirst({
        where: {
          name: {
            contains: parsed.domain_hint,
            mode: 'insensitive',
          },
        },
      });
      if (domain) domainId = domain.id;
    }

    // If marked for triage or ambiguous, save to Inbox
    if (parsed.requires_triage || parsed.action === 'INBOX_TRIAGE') {
      const inboxItem = await prisma.inboxItem.create({
        data: {
          title: parsed.title,
          rawContent: textToProcess,
          source: 'QUICK_CAPTURE',
          status: 'NEEDS_REVIEW',
          suggestedDomain: parsed.domain_hint,
          suggestedType: parsed.action,
        },
      });

      await prisma.systemNotification.create({
        data: {
          title: 'Item added to Inbox for Review',
          message: parsed.title,
          type: 'INFO',
        },
      });

      return NextResponse.json({
        success: true,
        type: 'INBOX_TRIAGE',
        item: inboxItem,
        parsed,
      });
    }

    // Action routing
    if (parsed.action === 'CREATE_EVENT') {
      const eventDate = parsed.due_date ? new Date(parsed.due_date) : new Date();
      const event = await prisma.scheduleEvent.create({
        data: {
          title: parsed.title,
          startTime: parsed.due_time,
          date: eventDate,
          notes: parsed.notes,
          domainId,
          source: 'MANUAL',
        },
      });

      await prisma.systemNotification.create({
        data: {
          title: 'Event Scheduled',
          message: `${parsed.title} (${parsed.due_time || 'All Day'})`,
          type: 'INFO',
        },
      });

      return NextResponse.json({ success: true, type: 'EVENT', item: event, parsed });
    }

    if (parsed.action === 'CREATE_LIBRARY_ITEM') {
      const item = await prisma.libraryItem.create({
        data: {
          title: parsed.title,
          body: parsed.notes || parsed.title,
          type: 'QUOTE',
          tags: parsed.domain_hint,
        },
      });

      return NextResponse.json({ success: true, type: 'LIBRARY', item, parsed });
    }

    if (parsed.action === 'CREATE_CRM_CONTACT') {
      const contact = await prisma.crmContact.create({
        data: {
          name: parsed.contact_name || parsed.title,
          notes: parsed.notes,
          domainId,
        },
      });

      return NextResponse.json({ success: true, type: 'CONTACT', item: contact, parsed });
    }

    // Default: CREATE_TASK
    const dueDate = parsed.due_date ? new Date(parsed.due_date) : null;
    const isTop3 = parsed.priority === 'TOP_3';

    const task = await prisma.task.create({
      data: {
        title: parsed.title,
        notes: parsed.notes,
        status: 'TODO',
        priority: parsed.priority || 'NORMAL',
        dueDate,
        dueTime: parsed.due_time,
        isTop3,
        isRecurring: Boolean(parsed.recurrence),
        recurrenceRule: parsed.recurrence,
        domainId,
      },
      include: {
        domain: true,
      },
    });

    await prisma.systemNotification.create({
      data: {
        title: 'Task created',
        message: task.title,
        type: 'TASK_CREATED',
      },
    });

    return NextResponse.json({
      success: true,
      type: 'TASK',
      item: task,
      parsed,
    });
  } catch (error) {
    console.error('Error in capture endpoint:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
