'use client';

import React from 'react';
import {
  CheckSquare,
  Square,
  Star,
  ExternalLink,
  Plus,
  Filter,
} from 'lucide-react';
import { Task } from '@/types';
import { useDashboardStore } from '@/store/useDashboardStore';
import { filterTasksByFocus } from '@/lib/focusFilter';
import { resolveSuperlistUrl } from '@/lib/superlist';

interface SuperlistTaskHubProps {
  onOpenCapture?: () => void;
  onEditTask?: (taskId: string) => void;
}

export function SuperlistTaskHub({ onOpenCapture, onEditTask }: SuperlistTaskHubProps) {
  const tasks = useDashboardStore((s) => s.tasks);
  const focusMode = useDashboardStore((s) => s.focusMode);
  const toggleTaskOptimistic = useDashboardStore((s) => s.toggleTaskOptimistic);

  // Filter tasks using active Focus Mode
  const filteredTasks = filterTasksByFocus(tasks, focusMode);

  const top3Tasks = filteredTasks.filter((t) => t.isTop3 && t.status !== 'DONE');
  const otherOpenTasks = filteredTasks.filter((t) => !t.isTop3 && t.status !== 'DONE');
  const completedTasks = filteredTasks.filter((t) => t.status === 'DONE');

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-[var(--paper-accent)]" />
          <h2 className="font-bold text-base text-[var(--paper-text)]">Superlist Task Hub</h2>
          {focusMode !== 'ALL' && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] text-[var(--paper-muted)] flex items-center gap-1">
              <Filter className="w-2.5 h-2.5" />
              {focusMode.replace('_', ' ')}
            </span>
          )}
        </div>

        <button
          onClick={onOpenCapture}
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-md bg-[var(--paper-card-subtle)] text-[var(--paper-text)] border border-[var(--paper-border)] hover:border-[var(--paper-accent)] transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Task
        </button>
      </div>

      {/* Top 3 High Priority Section */}
      {top3Tasks.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--paper-accent)]">
            <Star className="w-3.5 h-3.5 fill-current" />
            Top Priorities
          </div>
          <div className="space-y-1">
            {top3Tasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => toggleTaskOptimistic(task.id)}
                onEdit={() => onEditTask && onEditTask(task.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Remaining Open Tasks */}
      <div className="space-y-1.5">
        <div className="text-xs font-bold uppercase tracking-wider text-[var(--paper-muted)]">
          Tasks ({otherOpenTasks.length})
        </div>
        {otherOpenTasks.length === 0 ? (
          <div className="text-xs text-[var(--paper-muted)] italic py-2">
            No active tasks for current focus context.
          </div>
        ) : (
          <div className="space-y-1">
            {otherOpenTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => toggleTaskOptimistic(task.id)}
                onEdit={() => onEditTask && onEditTask(task.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Recently Completed */}
      {completedTasks.length > 0 && (
        <details className="pt-2 border-t border-[var(--paper-border)] text-xs text-[var(--paper-muted)]">
          <summary className="cursor-pointer hover:text-[var(--paper-text)] font-medium">
            Completed ({completedTasks.length})
          </summary>
          <div className="mt-2 space-y-1 opacity-70">
            {completedTasks.slice(0, 5).map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onToggle={() => toggleTaskOptimistic(task.id)}
                onEdit={() => onEditTask && onEditTask(task.id)}
              />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}

function TaskItem({
  task,
  onToggle,
  onEdit,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const isDone = task.status === 'DONE';
  const superlistUrl = resolveSuperlistUrl(
    task.superlistUrl,
    task.superlistListId || task.project?.superlistListId,
    task.superlistId
  );

  return (
    <div
      onClick={onEdit}
      className={`group flex items-center justify-between p-2 rounded-lg border transition-all cursor-pointer ${
        isDone
          ? 'bg-[var(--paper-card-subtle)] border-[var(--paper-border)] text-[var(--paper-muted)] line-through'
          : 'bg-[var(--paper-card)] border-[var(--paper-border)] hover:border-[var(--paper-border-strong)] text-[var(--paper-text)] shadow-xs'
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 pr-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="shrink-0 text-[var(--paper-muted)] hover:text-[var(--paper-accent)] transition"
        >
          {isDone ? (
            <CheckSquare className="w-4 h-4 text-[var(--paper-accent)]" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>

        <span className="text-xs truncate font-medium">{task.title}</span>

        {task.domain && (
          <span
            className="text-[10px] px-1.5 py-0.2 rounded border font-mono shrink-0"
            style={{
              borderColor: task.domain.color || 'var(--paper-border)',
              color: task.domain.color || 'var(--paper-muted)',
            }}
          >
            {task.domain.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {task.dueDate && (
          <span className="text-[10px] text-[var(--paper-muted)] font-mono">
            {new Date(task.dueDate).toLocaleDateString([], { month: 'short', day: 'numeric' })}
          </span>
        )}

        {superlistUrl && (
          <a
            href={superlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[var(--paper-muted)] hover:text-[var(--paper-accent)] p-0.5"
            title="Open in Superlist"
          >
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}
