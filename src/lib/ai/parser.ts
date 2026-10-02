export interface ParsedCapture {
  action: 'CREATE_TASK' | 'CREATE_EVENT' | 'CREATE_CRM_CONTACT' | 'CREATE_LIBRARY_ITEM' | 'CREATE_CONTENT_ITEM' | 'INBOX_TRIAGE';
  title: string;
  notes?: string;
  due_date?: string; // YYYY-MM-DD
  due_time?: string; // e.g. "14:30" or "2:30 PM"
  priority?: 'TOP_3' | 'HIGH' | 'NORMAL' | 'LOW';
  domain_hint?: string;
  project_hint?: string;
  contact_name?: string;
  recurrence?: string;
  confidence: number;
  requires_triage: boolean;
  provider_used: string;
}

const SYSTEM_PROMPT = `You are the parsing engine for a personal Life OS dashboard.
Extract structured information from the user's natural language input (typed, spoken memo, or forwarded email).
Return strictly JSON with the following schema:
{
  "action": "CREATE_TASK" | "CREATE_EVENT" | "CREATE_CRM_CONTACT" | "CREATE_LIBRARY_ITEM" | "CREATE_CONTENT_ITEM" | "INBOX_TRIAGE",
  "title": "Clean, concise title",
  "notes": "Any extra contextual details or description",
  "due_date": "YYYY-MM-DD or null if unspecified",
  "due_time": "Time string like '2:30 PM' or null",
  "priority": "TOP_3" | "HIGH" | "NORMAL" | "LOW",
  "domain_hint": "Life domain name if identifiable (e.g. Work, Content, Life/Home, Health, Finance)",
  "project_hint": "Project name if matched",
  "contact_name": "Person name if CRM interaction or contact creation",
  "recurrence": "DAILY" | "WEEKLY" | "MONTHLY" | null,
  "confidence": 0.0 to 1.0,
  "requires_triage": true or false (true if ambiguous or confidence < 0.7)
}
Only output valid JSON. Do not include markdown codeblocks or explanation.`;

// 1. Local Ollama Provider (Open Source)
async function parseWithOllama(text: string): Promise<ParsedCapture | null> {
  const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'llama3.2';
  try {
    const res = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${SYSTEM_PROMPT}\n\nUser Input: "${text}"\n\nJSON output:`,
        stream: false,
        format: 'json',
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const parsed = JSON.parse(data.response);
    return {
      ...parsed,
      provider_used: `ollama (${model})`,
    };
  } catch {
    return null;
  }
}

// 2. Google Gemini Provider
async function parseWithGemini(text: string): Promise<ParsedCapture | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: `${SYSTEM_PROMPT}\n\nInput: "${text}"` }
            ]
          }
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        }
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return null;
    const parsed = JSON.parse(rawText);
    return {
      ...parsed,
      provider_used: `gemini (${model})`,
    };
  } catch {
    return null;
  }
}

// 3. Anthropic Claude Provider
async function parseWithClaude(text: string): Promise<ParsedCapture | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-haiku-20241022';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: text }],
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.content?.[0]?.text;
    if (!content) return null;

    const cleaned = content.replace(/^```json\s*/, '').replace(/```$/, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      ...parsed,
      provider_used: `claude (${model})`,
    };
  } catch {
    return null;
  }
}

// 4. OpenAI Provider
async function parseWithOpenAI(text: string): Promise<ParsedCapture | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return {
      ...parsed,
      provider_used: `openai (${model})`,
    };
  } catch {
    return null;
  }
}

// 5. Offline Rule-Based Engine (Guaranteed zero-failure fallback)
export function parseRuleBased(text: string): ParsedCapture {
  const trimmed = text.trim();
  const lower = trimmed.toLowerCase();

  // Quote or highlight detection
  if (trimmed.startsWith('"') || lower.startsWith('quote:') || lower.startsWith('highlight:') || lower.includes('— ') || lower.includes(' - ')) {
    if (lower.startsWith('quote:') || lower.startsWith('highlight:')) {
      const body = trimmed.replace(/^(quote|highlight):\s*/i, '').trim();
      return {
        action: 'CREATE_LIBRARY_ITEM',
        title: body.slice(0, 60),
        notes: body,
        confidence: 0.9,
        requires_triage: false,
        provider_used: 'rule-based-offline',
      };
    }
  }

  // Meeting / Calendar event detection
  const isEvent = lower.includes('meeting') || lower.includes('dinner') || lower.includes('lunch') || lower.includes('call with') || lower.includes('coffee with');
  const timeMatch = trimmed.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm))\b/i);

  // Today / Tomorrow / Day detection
  const today = new Date();
  let dueDate: string | undefined = undefined;
  if (lower.includes('today')) {
    dueDate = today.toISOString().split('T')[0];
  } else if (lower.includes('tomorrow')) {
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    dueDate = tomorrow.toISOString().split('T')[0];
  }

  // Priority detection
  let priority: 'TOP_3' | 'HIGH' | 'NORMAL' | 'LOW' = 'NORMAL';
  if (lower.includes('top 3') || lower.includes('top3') || lower.includes('urgent') || lower.includes('asap')) {
    priority = 'TOP_3';
  } else if (lower.includes('priority') || lower.includes('important')) {
    priority = 'HIGH';
  }

  // Recurrence detection
  let recurrence: string | undefined = undefined;
  if (lower.includes('daily') || lower.includes('every day')) recurrence = 'DAILY';
  else if (lower.includes('weekly') || lower.includes('every week')) recurrence = 'WEEKLY';
  else if (lower.includes('monthly') || lower.includes('every month')) recurrence = 'MONTHLY';

  // Domain tag extraction (e.g. #Work, #Life, #Content)
  const tagMatch = trimmed.match(/#(\w+)/);
  const domainHint = tagMatch ? tagMatch[1] : undefined;

  const cleanTitle = trimmed
    .replace(/#\w+/g, '')
    .replace(/\b(today|tomorrow|asap|urgent|top\s*3)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    action: isEvent ? 'CREATE_EVENT' : 'CREATE_TASK',
    title: cleanTitle || trimmed,
    notes: trimmed,
    due_date: dueDate,
    due_time: timeMatch ? timeMatch[1].toUpperCase() : undefined,
    priority,
    domain_hint: domainHint,
    recurrence,
    confidence: 0.75,
    requires_triage: false,
    provider_used: 'rule-based-offline',
  };
}

/**
 * Main Hybrid Ingestion Router
 * Evaluates provider preference, tries local Ollama or cloud providers, with seamless fallback.
 */
export async function parseCaptureInput(text: string): Promise<ParsedCapture> {
  const preferred = (process.env.AI_PROVIDER || 'auto').toLowerCase();

  // Explicit Ollama requested
  if (preferred === 'ollama') {
    const result = await parseWithOllama(text);
    if (result) return result;
  }

  // Explicit Gemini requested
  if (preferred === 'gemini') {
    const result = await parseWithGemini(text);
    if (result) return result;
  }

  // Explicit Claude requested
  if (preferred === 'claude') {
    const result = await parseWithClaude(text);
    if (result) return result;
  }

  // Explicit OpenAI requested
  if (preferred === 'openai') {
    const result = await parseWithOpenAI(text);
    if (result) return result;
  }

  // Auto Mode: Prioritize Ollama if configured/reachable, then Gemini, Claude, OpenAI
  if (preferred === 'auto') {
    if (process.env.OLLAMA_BASE_URL) {
      const result = await parseWithOllama(text);
      if (result) return result;
    }

    if (process.env.GEMINI_API_KEY) {
      const result = await parseWithGemini(text);
      if (result) return result;
    }

    if (process.env.ANTHROPIC_API_KEY) {
      const result = await parseWithClaude(text);
      if (result) return result;
    }

    if (process.env.OPENAI_API_KEY) {
      const result = await parseWithOpenAI(text);
      if (result) return result;
    }
  }

  // Deterministic local rule-based fallback
  return parseRuleBased(text);
}
