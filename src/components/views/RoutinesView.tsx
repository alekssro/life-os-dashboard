'use client';

import React, { useState } from 'react';
import { Flame } from 'lucide-react';
import { HabitTracker } from '@/components/HabitTracker';
import { useDashboardStore } from '@/store/useDashboardStore';
import { EditRoutineModal } from '@/components/EditRoutineModal';
import { useDeleteTask } from '@/hooks/useDeleteTask';

export function RoutinesView() {
  const routines = useDashboardStore((s) => s.routines);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const [editingId, setEditingId] = useState<string | null>(null);
  const { confirmAndDeleteRoutine } = useDeleteTask();

  // Delete a habit (also removes it in Superlist when it came from there).
  const handleDeleteEdit = async (id: string) => {
    const routine = routines.find((r) => r.id === id);
    if (!routine) return;
    const error = await confirmAndDeleteRoutine(routine);
    setEditingId(null);
    if (error) alert(error);
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
        onEditHabit={(id) => setEditingId(id)}
      />

      {/* Pop-up Routine Edit Modal */}
      <EditRoutineModal
        routine={routineToEdit || null}
        isOpen={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        onSave={(id, updates) => handleSaveEdit(id, updates)}
        onDelete={handleDeleteEdit}
      />
    </div>
  );
}
