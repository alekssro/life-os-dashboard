'use client';

import React, { useState } from 'react';
import {
  CheckSquare,
  Plus,
  Filter,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { TaskHub } from '@/components/TaskHub';
import { EditTaskPanel } from '@/components/EditTaskPanel';
import { CaptureModal } from '@/components/CaptureModal';

export function TasksView() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
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

        <button
          onClick={() => setIsCaptureOpen(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--paper-accent)] text-white text-xs font-semibold hover:opacity-90 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Task</span>
        </button>
      </div>

      {/* Primary Task Hub matching Today View and respecting active Focus Mode */}
      <TaskHub
        title="Tasks Overview"
        onOpenCapture={() => setIsCaptureOpen(true)}
        onEditTask={(id) => setEditingId(id)}
      />

      {/* Inline edit drawer/modal if task selected */}
      {taskToEdit && (
        <div className="p-4 rounded-xl border border-[var(--paper-border-strong)] bg-[var(--paper-card)] shadow-lg space-y-3">
          <h3 className="font-bold text-sm text-[var(--paper-text)]">Edit Task</h3>
          <EditTaskPanel
            task={taskToEdit}
            domains={domains}
            onSave={(updates) => handleSaveEdit(taskToEdit.id, updates)}
            onCancel={() => setEditingId(null)}
          />
        </div>
      )}

      <CaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        onCaptured={() => fetchDashboardData()}
      />
    </div>
  );
}
