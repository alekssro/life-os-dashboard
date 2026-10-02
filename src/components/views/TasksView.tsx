'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Star,
  Plus,
  Trash2,
  Calendar,
  Repeat,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date';

const RECURRENCE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKDAYS', label: 'Weekdays (Mon–Fri)' },
  { value: 'WEEKLY', label: 'Weekly' },
  { value: 'BIWEEKLY', label: 'Bi-weekly' },
  { value: 'MONTHLY', label: 'Monthly' },
];

function EditTaskPanel({
  task,
  domains,
  onSave,
  onCancel,
}: {
  task: any;
  domains: any[];
  onSave: (updates: any) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [domainId, setDomainId] = useState(task.domainId || '');
  const [dueDate, setDueDate] = useState(
    task.dueDate ? new Date(task.dueDate).toISOString().split('T')[0] : ''
  );
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
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
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

export function TasksView() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [selectedDomain, setSelectedDomain] = useState<string>('ALL');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDomainId, setNewDomainId] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newRecurrence, setNewRecurrence] = useState('');

  const loadTasks = async () => {
    const [tasksRes, domainsRes] = await Promise.all([
      fetch('/api/tasks'),
      fetch('/api/domains'),
    ]);
    if (tasksRes.ok) setTasks(await tasksRes.json());
    if (domainsRes.ok) setDomains(await domainsRes.json());
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        domainId: newDomainId || null,
        dueDate: newDueDate || null,
        isRecurring: Boolean(newRecurrence),
        recurrenceRule: newRecurrence || null,
      }),
    });

    setNewTitle('');
    setNewDueDate('');
    setNewRecurrence('');
    loadTasks();
  };

  const handleSaveEdit = async (id: string, updates: any) => {
    if (updates.dueDate === '') updates.dueDate = null;
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setEditingId(null);
    loadTasks();
  };

  const toggleStatus = async (task: any) => {
    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: nextStatus } : t))
    );
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: nextStatus }),
    });
  };

  const toggleTop3 = async (task: any) => {
    const next = !task.isTop3;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isTop3: next } : t))
    );
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, isTop3: next }),
    });
  };

  const deleteTask = async (id: string) => {
    if (!confirm('Delete this task?')) return;
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' });
  };

  const filtered = tasks.filter((t) => {
    if (selectedDomain === 'ALL') return true;
    return t.domainId === selectedDomain;
  });

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--paper-text)]">Tasks</h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase">
            Master Task Management &amp; Top 3 Focus
          </p>
        </div>

        {/* Domain Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedDomain('ALL')}
            className={`px-3 py-1 rounded text-xs font-mono uppercase transition-colors ${
              selectedDomain === 'ALL'
                ? 'bg-[var(--paper-accent)] text-white'
                : 'border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
            }`}
          >
            All
          </button>
          {domains.map((d) => (
            <button
              key={d.id}
              onClick={() => setSelectedDomain(d.id)}
              className={`px-3 py-1 rounded text-xs font-mono uppercase whitespace-nowrap transition-colors ${
                selectedDomain === d.id
                  ? 'bg-[var(--paper-accent)] text-white'
                  : 'border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Add Task Form */}
      <form
        onSubmit={handleCreate}
        className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] flex flex-col sm:flex-row gap-3"
      >
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New task title…"
          className="flex-1 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
        />
        <select
          value={newDomainId}
          onChange={(e) => setNewDomainId(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
        >
          <option value="">No Domain</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <input
          type="date"
          value={newDueDate}
          onChange={(e) => setNewDueDate(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
        />
        <select
          value={newRecurrence}
          onChange={(e) => setNewRecurrence(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
        >
          {RECURRENCE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label || 'No Repeat'}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-[var(--paper-accent)] text-white font-mono text-xs flex items-center justify-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add</span>
        </button>
      </form>

      {/* Task List */}
      <div className="space-y-2">
        {filtered.map((task) => (
          <div
            key={task.id}
            className={`p-3 rounded border bg-[var(--paper-card)] transition-colors group ${
              editingId === task.id
                ? 'border-[var(--paper-accent)]'
                : 'border-[var(--paper-border)] hover:border-[var(--paper-border-strong)]'
            }`}
          >
            {/* Main row */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => toggleStatus(task)}
                  className="text-[var(--paper-muted)] hover:text-[var(--paper-accent)] shrink-0"
                >
                  {task.status === 'DONE' ? (
                    <CheckSquare className="w-4 h-4 text-[var(--paper-accent)]" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm ${
                      task.status === 'DONE'
                        ? 'line-through text-[var(--paper-muted)]'
                        : 'text-[var(--paper-text)] font-medium'
                    }`}
                  >
                    {task.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {task.domain && (
                      <span className="flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--paper-tag)]">
                        <span
                          className="w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: task.domain.color || 'var(--paper-accent)' }}
                        />
                        {task.domain.name}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className="text-[10px] font-mono text-[var(--paper-muted)] flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDateDDMMYYYY(task.dueDate)}
                      </span>
                    )}
                    {task.isRecurring && task.recurrenceRule && (
                      <span className="text-[10px] font-mono text-[var(--paper-muted)] flex items-center gap-0.5">
                        <Repeat className="w-3 h-3" />
                        {task.recurrenceRule.charAt(0) + task.recurrenceRule.slice(1).toLowerCase()}
                      </span>
                    )}
                    {task.notes && (
                      <span className="text-[10px] font-mono text-[var(--paper-muted)] italic truncate max-w-[200px]">
                        {task.notes}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1 ml-2 shrink-0">
                <button
                  onClick={() => setEditingId(editingId === task.id ? null : task.id)}
                  className={`p-1.5 rounded transition-colors ${
                    editingId === task.id
                      ? 'text-[var(--paper-accent)]'
                      : 'text-[var(--paper-muted)] hover:text-[var(--paper-text)] opacity-0 group-hover:opacity-100'
                  }`}
                  title="Edit task"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => toggleTop3(task)}
                  className={`p-1.5 rounded transition-colors ${
                    task.isTop3
                      ? 'text-[var(--paper-star)]'
                      : 'text-[var(--paper-muted)] hover:text-[var(--paper-star)] opacity-0 group-hover:opacity-100'
                  }`}
                  title="Top 3"
                >
                  <Star className={`w-4 h-4 ${task.isTop3 ? 'fill-current' : ''}`} />
                </button>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="p-1.5 rounded text-[var(--paper-muted)] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete task"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline edit panel */}
            {editingId === task.id && (
              <EditTaskPanel
                task={task}
                domains={domains}
                onSave={(updates) => handleSaveEdit(task.id, updates)}
                onCancel={() => setEditingId(null)}
              />
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="p-6 rounded border border-dashed border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
            No tasks found.
          </div>
        )}
      </div>
    </div>
  );
}
