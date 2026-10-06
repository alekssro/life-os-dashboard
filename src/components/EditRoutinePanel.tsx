'use client';

import React, { useState } from 'react';
import { Check, X } from 'lucide-react';

export const FREQUENCY_OPTIONS = [
  { value: 'DAILY', label: 'Daily' },
  { value: 'WEEKLY', label: 'Weekly (choose days)' },
  { value: 'MONTHLY', label: 'Monthly (choose day)' },
];

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sun' },
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
];

export function FrequencyBadge({ routine }: { routine: any }) {
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

interface EditRoutinePanelProps {
  routine: any;
  onSave: (updates: any) => void;
  onCancel: () => void;
}

export function EditRoutinePanel({ routine, onSave, onCancel }: EditRoutinePanelProps) {
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
  const [graceDays, setGraceDays] = useState(routine.graceDays ?? 1);
  const [targetPerWeek, setTargetPerWeek] = useState(routine.targetPerWeek ?? 7);
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
      graceDays,
      targetPerWeek,
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

      {/* Consistency settings */}
      <div className="flex flex-wrap gap-4 pt-2 border-t border-[var(--paper-border)]">
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-[var(--paper-muted)]">Grace days:</label>
          <input
            type="number"
            min={0}
            max={7}
            value={graceDays}
            onChange={(e) => setGraceDays(parseInt(e.target.value) || 0)}
            className="w-14 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs font-mono text-center"
            title="Days allowed to log after due date without penalty"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-mono text-[var(--paper-muted)]">Target/week:</label>
          <input
            type="number"
            min={1}
            max={7}
            value={targetPerWeek}
            onChange={(e) => setTargetPerWeek(parseInt(e.target.value) || 1)}
            className="w-14 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs font-mono text-center"
            title="Expected completions per week for consistency scoring"
          />
        </div>
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
