'use client';

import React, { useState, useEffect } from 'react';
import {
  Flame,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Pencil,
  X,
  Check,
} from 'lucide-react';

const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly (choose days)' },
  { value: 'MONTHLY', label: 'Monthly (choose day)' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

function FrequencyBadge({ routine }: { routine: any }) {
  if (routine.frequency === 'DAILY') return null;
  if (routine.frequency === 'WEEKLY') {
    try {
      const days: number[] = JSON.parse(routine.daysOfWeek || '[]');
      const labels = days.map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.label).filter(Boolean);
      return (
        <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-[var(--paper-border)] text-[var(--paper-muted)]">
          {labels.join(' · ')}
        </span>
      );
    } catch {
      return null;
    }
  }
  if (routine.frequency === 'MONTHLY') {
    return (
      <span className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-[var(--paper-border)] text-[var(--paper-muted)]">
        Monthly / day {routine.dayOfMonth || 1}
      </span>
    );
  }
  return null;
}

function EditRoutinePanel({
  routine,
  onSave,
  onCancel,
}: {
  routine: any;
  onSave: (updates: any) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(routine.title);
  const [icon, setIcon] = useState(routine.icon || '✨');
  const [timeOfDay, setTimeOfDay] = useState(routine.timeOfDay);
  const [frequency, setFrequency] = useState(routine.frequency || 'DAILY');
  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    try {
      return JSON.parse(routine.daysOfWeek || '[]');
    } catch {
      return [];
    }
  });
  const [dayOfMonth, setDayOfMonth] = useState(String(routine.dayOfMonth || 1));

  const toggleDay = (d: number) =>
    setSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      title: title.trim(),
      icon: icon.trim() || '✨',
      timeOfDay,
      frequency,
      daysOfWeek: frequency === 'WEEKLY' ? JSON.stringify(selectedDays) : null,
      dayOfMonth: frequency === 'MONTHLY' ? dayOfMonth : null,
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      onClick={(e) => e.stopPropagation()}
      className="mt-3 pt-3 border-t border-[var(--paper-border)] space-y-2"
    >
      <div className="flex gap-2">
        <input
          type="text"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className="w-14 text-center bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1.5 rounded border border-[var(--paper-border)] text-sm"
          title="Emoji"
        />
        <input
          autoFocus
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1.5 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
          placeholder="Routine title…"
          required
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {/* Time of day */}
        <select
          value={timeOfDay}
          onChange={(e) => setTimeOfDay(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs font-mono"
        >
          <option value="MORNING">Morning</option>
          <option value="AFTERNOON">Afternoon</option>
          <option value="EVENING">Evening</option>
        </select>

        {/* Frequency */}
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs font-mono"
        >
          {FREQUENCY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* Weekly day picker */}
      {frequency === 'WEEKLY' && (
        <div className="flex flex-wrap gap-1">
          {DAYS_OF_WEEK.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDay(d.value)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border transition-colors ${
                selectedDays.includes(d.value)
                  ? 'bg-[var(--paper-accent)] text-white border-[var(--paper-accent)]'
                  : 'border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Monthly day picker */}
      {frequency === 'MONTHLY' && (
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-[var(--paper-muted)]">Day of month:</label>
          <input
            type="number"
            min={1}
            max={31}
            value={dayOfMonth}
            onChange={(e) => setDayOfMonth(e.target.value)}
            className="w-16 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs font-mono text-center"
          />
        </div>
      )}

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

export function RoutinesView() {
  const [routinesData, setRoutinesData] = useState<any>({ routines: [] });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTimeOfDay, setNewTimeOfDay] = useState<'MORNING' | 'AFTERNOON' | 'EVENING'>('MORNING');
  const [newIcon, setNewIcon] = useState('✨');
  const [newFrequency, setNewFrequency] = useState('DAILY');
  const [newSelectedDays, setNewSelectedDays] = useState<number[]>([]);
  const [newDayOfMonth, setNewDayOfMonth] = useState('1');

  const loadRoutines = async () => {
    const res = await fetch('/api/routines');
    if (res.ok) setRoutinesData(await res.json());
  };

  useEffect(() => {
    loadRoutines();
  }, []);

  const handleCreateRoutine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        timeOfDay: newTimeOfDay,
        icon: newIcon.trim() || '✨',
        frequency: newFrequency,
        daysOfWeek: newFrequency === 'WEEKLY' ? JSON.stringify(newSelectedDays) : undefined,
        dayOfMonth: newFrequency === 'MONTHLY' ? newDayOfMonth : undefined,
      }),
    });

    setNewTitle('');
    setNewFrequency('DAILY');
    setNewSelectedDays([]);
    loadRoutines();
  };

  const handleSaveEdit = async (id: string, updates: any) => {
    await fetch('/api/routines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setEditingId(null);
    loadRoutines();
  };

  const toggleRoutine = async (routineId: string, currentCompleted: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId, completed: !currentCompleted }),
    });
    loadRoutines();
  };

  const handleMoveRoutine = async (id: string, direction: 'UP' | 'DOWN', e: React.MouseEvent) => {
    e.stopPropagation();
    await fetch('/api/routines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, direction }),
    });
    loadRoutines();
  };

  const handleDeleteRoutine = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this routine?')) return;
    await fetch(`/api/routines?id=${id}`, { method: 'DELETE' });
    loadRoutines();
  };

  const toggleNewDay = (d: number) =>
    setNewSelectedDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d].sort()));

  const sections = [
    { key: 'MORNING', label: 'Morning Routines' },
    { key: 'AFTERNOON', label: 'Afternoon Routines' },
    { key: 'EVENING', label: 'Evening Routines' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-bold text-[var(--paper-text)]">Routines</h1>
        <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase">
          Habits &amp; Consistent Practices
        </p>
      </div>

      {/* Add Routine Form */}
      <form
        onSubmit={handleCreateRoutine}
        className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] space-y-3"
      >
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="Icon"
            className="w-14 text-center bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1.5 rounded border border-[var(--paper-border)] text-sm"
            title="Emoji or icon"
          />
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="New Routine Title…"
            className="flex-1 min-w-[180px] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
          />
          <select
            value={newTimeOfDay}
            onChange={(e) => setNewTimeOfDay(e.target.value as any)}
            className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
          >
            <option value="MORNING">Morning</option>
            <option value="AFTERNOON">Afternoon</option>
            <option value="EVENING">Evening</option>
          </select>
          <select
            value={newFrequency}
            onChange={(e) => { setNewFrequency(e.target.value); setNewSelectedDays([]); }}
            className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
          >
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-[var(--paper-accent)] text-white font-mono text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Add Routine</span>
          </button>
        </div>

        {/* Weekly day picker (new) */}
        {newFrequency === 'WEEKLY' && (
          <div className="flex flex-wrap gap-1 pl-1">
            {DAYS_OF_WEEK.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleNewDay(d.value)}
                className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase border transition-colors ${
                  newSelectedDays.includes(d.value)
                    ? 'bg-[var(--paper-accent)] text-white border-[var(--paper-accent)]'
                    : 'border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}

        {/* Monthly picker (new) */}
        {newFrequency === 'MONTHLY' && (
          <div className="flex items-center gap-2 pl-1">
            <label className="text-xs font-mono text-[var(--paper-muted)]">Day of month:</label>
            <input
              type="number"
              min={1}
              max={31}
              value={newDayOfMonth}
              onChange={(e) => setNewDayOfMonth(e.target.value)}
              className="w-16 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs font-mono text-center"
            />
          </div>
        )}
      </form>

      {/* Routine Sections */}
      {sections.map(({ key, label }) => {
        const items = (routinesData.routines || []).filter((r: any) => r.timeOfDay === key);
        const dueItems = items.filter((r: any) => r.isDueToday);
        const completedDue = dueItems.filter((r: any) => r.isCompletedToday).length;

        return (
          <section key={key} className="space-y-3">
            <h2 className="text-xs font-mono font-bold uppercase tracking-wider text-[var(--paper-muted)] pb-1 border-b border-[var(--paper-border)]">
              {label}{dueItems.length > 0 ? ` (${completedDue}/${dueItems.length})` : ''}
            </h2>

            <div className="space-y-2">
              {items.map((r: any, idx: number) => (
                <div
                  key={r.id}
                  className={`p-3 rounded border bg-[var(--paper-card)] transition-colors group ${
                    editingId === r.id
                      ? 'border-[var(--paper-accent)]'
                      : !r.isDueToday
                      ? 'border-[var(--paper-border)] opacity-50'
                      : 'border-[var(--paper-border)] hover:border-[var(--paper-border-strong)]'
                  }`}
                >
                  {/* Main row */}
                  <div className="flex items-center justify-between">
                    <div
                      className="flex items-center gap-3 flex-1 min-w-0 mr-2 cursor-pointer"
                      onClick={(e) => r.isDueToday && toggleRoutine(r.id, r.isCompletedToday, e)}
                    >
                      {r.isCompletedToday ? (
                        <CheckSquare className="w-5 h-5 text-[var(--paper-accent)] shrink-0" />
                      ) : r.isDueToday ? (
                        <Square className="w-5 h-5 text-[var(--paper-muted)] shrink-0" />
                      ) : (
                        <Square className="w-5 h-5 text-[var(--paper-muted)]/30 shrink-0" />
                      )}
                      <span className="text-base shrink-0">{r.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span
                          className={`text-sm truncate block ${
                            r.isCompletedToday
                              ? 'line-through text-[var(--paper-muted)]'
                              : 'text-[var(--paper-text)] font-medium'
                          }`}
                        >
                          {r.title}
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                          <FrequencyBadge routine={r} />
                          {!r.isDueToday && (
                            <span className="text-[9px] font-mono uppercase text-[var(--paper-muted)]/60">
                              Not scheduled today
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-mono shrink-0">
                      {r.isDueToday && (
                        <span className="flex items-center gap-1 text-[var(--paper-accent)] font-semibold">
                          <Flame className="w-4 h-4 fill-current" />
                          {r.streak}
                        </span>
                      )}

                      {/* Controls */}
                      <div className="flex items-center gap-0.5 border-l border-[var(--paper-border)] pl-2">
                        <button
                          onClick={() => setEditingId(editingId === r.id ? null : r.id)}
                          className={`p-1 rounded transition-colors ${
                            editingId === r.id
                              ? 'text-[var(--paper-accent)]'
                              : 'text-[var(--paper-muted)] hover:text-[var(--paper-text)] opacity-0 group-hover:opacity-100'
                          }`}
                          title="Edit routine"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleMoveRoutine(r.id, 'UP', e)}
                          disabled={idx === 0}
                          className="p-1 rounded text-[var(--paper-muted)] hover:text-[var(--paper-text)] disabled:opacity-30"
                          title="Move Up"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleMoveRoutine(r.id, 'DOWN', e)}
                          disabled={idx === items.length - 1}
                          className="p-1 rounded text-[var(--paper-muted)] hover:text-[var(--paper-text)] disabled:opacity-30"
                          title="Move Down"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteRoutine(r.id, e)}
                          className="p-1 rounded text-[var(--paper-muted)] hover:text-red-500 transition-colors ml-1"
                          title="Delete routine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Edit panel */}
                  {editingId === r.id && (
                    <EditRoutinePanel
                      routine={r}
                      onSave={(updates) => handleSaveEdit(r.id, updates)}
                      onCancel={() => setEditingId(null)}
                    />
                  )}
                </div>
              ))}

              {items.length === 0 && (
                <div className="p-3 rounded border border-dashed border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                  No routines added for this time of day yet.
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
