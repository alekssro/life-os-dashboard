/**
 * Server-side Superlist pull via the Superlist MCP (Streamable HTTP JSON-RPC).
 *
 * The dashboard is normally push-only (tasks are POSTed to
 * /api/integrations/superlist). This module lets the app pull on demand using
 * a Superlist OAuth access token configured as `SUPERLIST_MCP_TOKEN` (the same
 * credential used by the `superlist` MCP server in opencode).
 *
 * Requires `SUPERLIST_MCP_TOKEN` (and optionally `SUPERLIST_MCP_URL`, which
 * defaults to the official Superlist MCP endpoint).
 */

import { buildSuperlistTaskUrl, buildSuperlistListUrl } from '@/lib/superlist';

const PROTOCOL_VERSION = '2025-06-18';

export interface SuperlistTaskItem {
  title: string;
  id: string | null; // Superlist task UUID
  listId: string | null; // Superlist list UUID
  url: string | null; // canonical list-scoped URL
  dueDate: string | null;
  isCompleted: boolean;
  completedAt: string | null;
  priority: string; // dashboard TaskPriority
  isTop3: boolean;
  notes: string | null;
}

export interface SuperlistListItem {
  id: string; // Superlist list UUID
  title: string;
  url: string | null; // canonical list URL
}

export interface SuperlistPullResult {
  tasks: SuperlistTaskItem[];
  lists: SuperlistListItem[];
}

const PRIORITY_MAP: Record<string, string> = {
  high: 'HIGH',
  medium: 'NORMAL',
  low: 'LOW',
  none: 'NORMAL',
};

interface JsonRpcMessage {
  jsonrpc: string;
  id?: number;
  method: string;
  params?: any;
  result?: any;
  error?: any;
}

/** Parse a Streamable HTTP response that may be JSON or SSE. */
function parseResponseBody(text: string): JsonRpcMessage {
  const lines = text.split(/\r?\n/);
  const dataLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('data:')) {
      const payload = trimmed.slice(5).trim();
      if (payload) dataLines.push(payload);
    }
  }
  const raw = dataLines.length > 0 ? dataLines[dataLines.length - 1] : text.trim();
  if (!raw.startsWith('{')) {
    throw new Error(`Unexpected Superlist MCP response: ${text.slice(0, 200)}`);
  }
  return JSON.parse(raw) as JsonRpcMessage;
}

async function mcpRequest(
  url: string,
  token: string,
  message: JsonRpcMessage,
  sessionId?: string
): Promise<{ message: JsonRpcMessage; sessionId?: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
    Authorization: `Bearer ${token}`,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;

  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
    });
  } catch (e) {
    throw new Error(`Superlist MCP request failed: ${(e as Error).message}`);
  }

  const nextSessionId = res.headers.get('mcp-session-id') || sessionId;
  const body = await res.text();
  if (!res.ok) {
    const err = new Error(`Superlist MCP error (${res.status}): ${body.slice(0, 300)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }

  const parsed = parseResponseBody(body);
  if (parsed.error) {
    throw new Error(`Superlist MCP error: ${JSON.stringify(parsed.error)}`);
  }
  return { message: parsed, sessionId: nextSessionId };
}

/** Extract the structured payload from a tools/call result. */
function extractToolResult(result: any): any {
  if (result && result.structuredContent !== undefined) return result.structuredContent;
  const contents = Array.isArray(result?.content) ? result.content : [];
  const text = contents
    .filter((c: any) => c && c.type === 'text' && typeof c.text === 'string')
    .map((c: any) => c.text)
    .join('\n');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

/**
 * Pull the user's Superlist lists and tasks (via the Superlist MCP) and
 * normalize them into dashboard task rows. Only uncompleted tasks are
 * intended for creation; completed tasks are still returned so existing
 * dashboard rows can be marked done.
 */
export async function pullSuperlistTasks(token: string): Promise<SuperlistPullResult> {
  if (!token) {
    throw new Error('SUPERLIST_MCP_TOKEN is not configured');
  }

  const url = process.env.SUPERLIST_MCP_URL || 'https://app.superlist.com/mcp';

  // 1. initialize
  const init = await mcpRequest(url, token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'life-os-dashboard', version: '1.0.0' },
    },
  });

  // 2. initialized notification (optional server session)
  await mcpRequest(
    url,
    token,
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    init.sessionId
  ).catch(() => undefined);

  // 3. list the user's lists
  const listsResp = await mcpRequest(
    url,
    token,
    {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/call',
      params: { name: 'get_lists', arguments: {} },
    },
    init.sessionId
  );
  const listsData = extractToolResult(listsResp.message.result) || {};
  const rawLists = Array.isArray(listsData.lists) ? listsData.lists : [];
  const listMeta: SuperlistListItem[] = [];
  const listsSeen: Record<string, boolean> = {};

  // 4. enumerate tasks per list
  const tasks: SuperlistTaskItem[] = [];
  let callId = 3;
  for (const list of rawLists) {
    const listId = list?.uuid || null;
    if (!listId || listsSeen[listId]) continue;
    listsSeen[listId] = true;

    const title = (list?.title || list?.name || '').trim();
    listMeta.push({ id: listId, title, url: buildSuperlistListUrl(listId) });

    const listResp = await mcpRequest(
      url,
      token,
      {
        jsonrpc: '2.0',
        id: callId++,
        method: 'tools/call',
        params: { name: 'get_list', arguments: { list_uuid: listId } },
      },
      init.sessionId
    );
    const listData = extractToolResult(listResp.message.result) || {};
    const rawTasks = Array.isArray(listData.tasks) ? listData.tasks : [];

    for (const t of rawTasks) {
      const taskId = t?.uuid || null;
      if (!taskId) continue;
      tasks.push({
        title: t.title || '',
        id: taskId,
        listId,
        url: buildSuperlistTaskUrl(listId, taskId),
        dueDate: t.due_date || null,
        isCompleted: t.status === 'completed',
        completedAt: t.completed_at || null,
        priority: PRIORITY_MAP[t.priority] || 'NORMAL',
        isTop3: false,
        notes: null,
      });
    }
  }

  return { tasks, lists: listMeta };
}