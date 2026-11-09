'use client';

import React, { useState } from 'react';
import {
  Flame,
  Plus,
} from 'lucide-react';
import { HabitTracker } from '@/components/HabitTracker';
import { useDashboardStore } from '@/store/useDashboardStore';
import {
  EditRoutinePanel,
  FrequencyBadge,
  FREQUENCY_OPTIONS,
  DAYS_OF_WEEK,
} from '@/components/EditRoutinePanel';

export function RoutinesView() {
  const routines = useDashboardStore((s) => s.routines);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newTimeOfDay, setNewTimeOfDay] = useState<'MORNING' | 'AFTERNOON' | 'EVENING'>('MORNING');
  const [newIcon, setNewIcon] = useState('✨');
  const [newFrequency, setNewFrequency] = useState('DAILY');
  const [newSelectedDays, setNewSelectedDays] = useState<number[]>([]);
  const [newDayOfMonth, setNewDayOfMonth] = useState('1');
  const [newGraceDays, setNewGraceDays] = useState(1);
  const [newTargetPerWeek, setNewTargetPerWeek] = useState(7);

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
        graceDays: newGraceDays,
        targetPerWeek: newTargetPerWeek,
      }),
    });

    setNewTitle('');
    setNewFrequency('DAILY');
    setNewSelectedDays([]);
    setNewGraceDays(1);
    setNewTargetPerWeek(7);
    fetchDashboardData();
  };

  const handleSaveEdit = async (id: string, updates: any) => {
    await fetch('/api/routines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setEditingId(null);
    fetchDashboardData();
  };

  const routineToEdit = routines.find((r) => r.id === editingId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--paper-border)]">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[var(--paper-text)]">
            Habits
          </h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase tracking-wider">
            Track daily, weekly and monthly streaks across GitHub-style heatmap matrices
          </p>
        </div>
      </div>

      {/* Main Habit Tracker with full Yearly multi-line GitHub commit grid enabled */}
      <HabitTracker
        title="Habit Matrix"
        isTodayOnly={false}
        allowYearlyView={true}
        showControls={true}
      />

      {/* Quick Add Habit Form */}
      <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-3">
        <h3 className="font-bold text-sm text-[var(--paper-text)] flex items-center gap-1.5">
          <Plus className="w-4 h-4 text-[var(--paper-accent)]" />
          Create New Habit
        </h3>

        <form onSubmit={handleCreateRoutine} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <input
              type="text"
              placeholder="Habit title (e.g. Read 20 pages, Gym, Meditate)..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="sm:col-span-6 px-3 py-2 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] outline-none focus:border-[var(--paper-accent)]"
            />
            <input
              type="text"
              placeholder="Icon (e.g. 📚)"
              value={newIcon}
              onChange={(e) => setNewIcon(e.target.value)}
              className="sm:col-span-2 px-3 py-2 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] outline-none focus:border-[var(--paper-accent)] text-center"
            />
            <select
              value={newTimeOfDay}
              onChange={(e: any) => setNewTimeOfDay(e.target.value)}
              className="sm:col-span-4 px-3 py-2 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] outline-none focus:border-[var(--paper-accent)]"
            >
              <option value="MORNING">Morning</option>
              <option value="AFTERNOON">Afternoon</option>
              <option value="EVENING">Evening</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={!newTitle.trim()}
            className="px-4 py-2 rounded-lg bg-[var(--paper-accent)] text-white font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Habit
          </button>
        </form>
      </div>

      {/* Routine Edit Drawer */}
      {routineToEdit && (
        <div className="p-4 rounded-xl border border-[var(--paper-border-strong)] bg-[var(--paper-card)] shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-[var(--paper-text)]">Edit Habit Details</h3>
          <EditRoutinePanel
            routine={routineToEdit}
            onSave={(updates) => handleSaveEdit(routineToEdit.id, updates)}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}
    </div>
  );
}
