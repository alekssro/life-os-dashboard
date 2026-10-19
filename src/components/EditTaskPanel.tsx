'use client';

import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { CalendarDateInput } from '@/components/CalendarDateInput';
import { toISODate } from '@/lib/date';
import { SLOT_LABELS } from '@/lib/pushClient';
import { buildSuperlistTaskUrl, extractSuperlistIds } from '@/lib/superlist';

export const RECURRENCE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Weekdays (Mon–Fri)' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

interface EditTaskPanelProps {
  task: any;
  domains: any[];
  onSave: (updates: any) => void;
  onCancel: () => void;
}

export function EditTaskPanel({ task, domains, onSave, onCancel }: EditTaskPanelProps) {
  const [title, setTitle] = useState(task.title);
  const [domainId, setDomainId] = useState(task.domainId || '');
  const [dueDate, setDueDate] = useState(task.dueDate ? toISODate(task.dueDate) : '');
  const [recurrenceRule, setRecurrenceRule] = useState(task.recurrenceRule || '');
  const [notes, setNotes] = useState(task.notes || '');
  const [superlistUrl, setSuperlistUrl] = useState(task.superlistUrl || '');
  // null → Morning digest; 'SLOT' | 'HH:MM' | 'NONE' otherwise.
  const [reminderAt, setReminderAt] = useState(task.reminderAt || 'MORNING');
  const isCustomTime = /^([01]?\d|2[0-3]):([0-5]\d)$/.test(reminderAt);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = superlistUrl.trim() || null;
    const parsed = extractSuperlistIds(raw);
    // Fall back to ids already known on the task / its linked project.
    const listId = parsed.listId || task.superlistListId || task.project?.superlistListId || null;
    const taskId = parsed.taskId || task.superlistId || null;

    let url: string | null = raw;
    if (raw && !/^(https?:\/\/|superlist:\/\/)/i.test(raw)) {
      // Bare UUID(s) — normalize into a canonical list-scoped URL when possible.
      url = buildSuperlistTaskUrl(listId, taskId);
    }
    onSave({
      title: title.trim(),
      domainId: domainId || null,
      dueDate: dueDate || null,
      isRecurring: Boolean(recurrenceRule),
      recurrenceRule: recurrenceRule || null,
      notes: notes.trim() || null,
      reminderAt,
      superlistUrl: url,
      superlistId: taskId,
      superlistListId: listId,
      source: (url || task.source === 'SUPERLIST') ? 'SUPERLIST' : 'MANUAL',
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 pt-3 border-t border-[var(--paper-border)] space-y-2"
    >
      {/* Title */}
      <input
        autoFocus
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1.5 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
        placeholder="Task title…"
        required
      />

      <div className="flex flex-wrap gap-2">
        {/* Domain */}
        <select
          value={domainId}
          onChange={(e) => setDomainId(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs font-mono flex-1 min-w-[120px]"
        >
          <option value="">No Domain</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>

        {/* Due Date */}
        <CalendarDateInput
          value={dueDate}
          onChange={setDueDate}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs font-mono flex-1 min-w-[130px]"
        />

        {/* Recurrence */}
        <select
          value={recurrenceRule}
          onChange={(e) => setRecurrenceRule(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs font-mono flex-1 min-w-[130px]"
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Reminder (daily notification) */}
      <div className="flex items-center gap-2">
        <select
          value={isCustomTime ? 'CUSTOM' : reminderAt}
          onChange={(e) => {
            const value = e.target.value;
            setReminderAt(value === 'CUSTOM' ? (isCustomTime ? reminderAt : '12:00') : value);
          }}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs font-mono flex-1 min-w-[150px]"
          title="When to remind about this task"
        >
          <option value="MORNING">Remind · {SLOT_LABELS.MORNING}</option>
          <option value="AFTERNOON">Remind · {SLOT_LABELS.AFTERNOON}</option>
          <option value="EVENING">Remind · {SLOT_LABELS.EVENING}</option>
          <option value="CUSTOM">Remind · Specific time…</option>
          <option value="NONE">No reminder</option>
        </select>
        {isCustomTime && (
          <input
            type="time"
            value={reminderAt}
            onChange={(e) => setReminderAt(e.target.value)}
            className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs font-mono"
            title="Exact reminder time"
          />
        )}
      </div>

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono resize-none focus:outline-none focus:border-[var(--paper-accent)]"
      />

      {/* Superlist Link */}
      <div>
        <label className="text-[10px] font-mono text-[var(--paper-muted)] flex items-center justify-between">
          <span>Superlist Task Link or UUID:</span>
          <span className="text-[9px] text-[var(--paper-muted)]/70">e.g. https://app.superlist.com/lists/LIST-ID/tasks/TASK-ID</span>
        </label>
        <input
          type="text"
          value={superlistUrl}
          onChange={(e) => setSuperlistUrl(e.target.value)}
          placeholder="https://app.superlist.com/lists/.../tasks/..."
          className="w-full mt-0.5 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs font-mono"
        />
      </div>

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1 rounded border border-[var(--paper-border)] text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
        <button
          type="submit"
          className="flex items-center gap-1 px-3 py-1 rounded bg-[var(--paper-accent)] text-white text-xs font-mono"
        >
          <Check className="w-3 h-3" /> Save
        </button>
      </div>
    </form>
  );
}
