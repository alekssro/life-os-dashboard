'use client';

import React, { useState } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { TaskHub } from '@/components/TaskHub';
import { EditTaskModal } from '@/components/EditTaskModal';

export function TasksView() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const tasks = useDashboardStore((s) => s.tasks);
  const domains = useDashboardStore((s) => s.domains);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const taskToEdit = tasks.find((t) => t.id === editingId);

  const handleSaveEdit = async (id: string, updates: any) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setEditingId(null);
    fetchDashboardData();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[var(--paper-border)]">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[var(--paper-text)]">
            Tasks
          </h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase tracking-wider">
            All tasks synchronized across Superlist & Local OS
          </p>
        </div>
      </div>

      {/* Primary Task Hub matching Today View and respecting active Focus Mode */}
      <TaskHub
        title="Tasks Overview"
        onEditTask={(id) => setEditingId(id)}
      />

      {/* Pop-up Edit Task Modal */}
      <EditTaskModal
        task={taskToEdit || null}
        domains={domains}
        isOpen={Boolean(editingId)}
        onClose={() => setEditingId(null)}
        onSave={(id, updates) => handleSaveEdit(id, updates)}
      />
    </div>
  );
}
