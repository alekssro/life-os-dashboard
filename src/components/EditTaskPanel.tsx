'use client';

import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { DateInput } from '@/components/DateInput';
import { toISODate } from '@/lib/date';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: title.trim(),
      domainId: domainId || null,
      dueDate: dueDate || null,
      isRecurring: Boolean(recurrenceRule),
      recurrenceRule: recurrenceRule || null,
      notes: notes.trim() || null,
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
        <DateInput
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

      {/* Notes */}
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notes (optional)…"
        rows={2}
        className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono resize-none focus:outline-none focus:border-[var(--paper-accent)]"
      />

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
