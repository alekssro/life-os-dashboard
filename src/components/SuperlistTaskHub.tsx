'use client';

import React, { useMemo, useState } from 'react';
import {
  CheckSquare,
  Square,
  Star,
  ExternalLink,
  Filter,
  ChevronDown,
  ChevronRight,
  Clock,
  Trash2,
} from 'lucide-react';
import { Task } from '@/types';
import { useDashboardStore } from '@/store/useDashboardStore';
import { filterTasksByFocus } from '@/lib/focusFilter';
import { resolveSuperlistUrl } from '@/lib/superlist';
import { appDayEnd, appDayStart, formatDateDDMMShort, parseISODateLocal } from '@/lib/date';

interface TaskHubProps {
  onEditTask?: (taskId: string) => void;
  title?: string;
  showFocusBadge?: boolean;
  /** When true the "Other Tasks" section starts collapsed (home/dashboard view). */
  defaultCollapsed?: boolean;
}

/** A task is actionable while it is neither done nor cancelled. */
function isOpenTask(task: Task): boolean {
  return task.status !== 'DONE' && task.status !== 'CANCELLED';
}

/** Overdue first, then due today — the ones that need attention now. */
function sortByDueDate(a: Task, b: Task): number {
  const av = a.dueDate ? parseISODateLocal(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
  const bv = b.dueDate ? parseISODateLocal(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
  if (av !== bv) return av - bv;
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

/** Most recently completed first. */
function sortByCompletedAt(a: Task, b: Task): number {
  const av = a.completedAt ? new Date(a.completedAt).getTime() : 0;
  const bv = b.completedAt ? new Date(b.completedAt).getTime() : 0;
  if (av !== bv) return bv - av;
  return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
}

/**
 * True when the task is due before the end of the app's current day, i.e. it is
 * either overdue (due date in the past) or due today. "Today" honours the
 * 05:00 app-day boundary.
 */
function isDueTodayOrOverdue(task: Task, dayEnd: Date): boolean {
  if (!task.dueDate) return false;
  // Due dates are calendar days — parse them as local dates so the comparison
  // does not slip a day in a browser west of the server.
  const due = parseISODateLocal(task.dueDate);
  if (isNaN(due.getTime())) return false;
  return due.getTime() < dayEnd.getTime();
}

export function TaskHub({
  onEditTask,
  title = 'Task Hub',
  showFocusBadge = true,
  defaultCollapsed = false,
}: TaskHubProps) {
  const tasks = useDashboardStore((s) => s.tasks);
  const focusMode = useDashboardStore((s) => s.focusMode);
  const toggleTaskOptimistic = useDashboardStore((s) => s.toggleTaskOptimistic);
  const toggleTaskStarOptimistic = useDashboardStore((s) => s.toggleTaskStarOptimistic);
  const clearCompletedTasks = useDashboardStore((s) => s.clearCompletedTasks);

  const [isTodayCollapsed, setIsTodayCollapsed] = useState(false);
  const [isOtherCollapsed, setIsOtherCollapsed] = useState(defaultCollapsed);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(true);
  const [isClearing, setIsClearing] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);

  // "Today" follows the app's 05:00 day boundary.
  const dayEnd = useMemo(() => appDayEnd(), []);

  const { topTasks, todayTasks, otherTasks, completedTasks } = useMemo(() => {
    const openTasks = tasks.filter(isOpenTask);

    // Focus mode narrows the actionable lists…
    const focused = filterTasksByFocus(openTasks, focusMode);

    const top = focused.filter((t) => t.isTop3).sort(sortByDueDate);
    const today = focused
      .filter((t) => !t.isTop3 && isDueTodayOrOverdue(t, dayEnd))
      .sort(sortByDueDate);
    const other = focused
      .filter((t) => !t.isTop3 && !isDueTodayOrOverdue(t, dayEnd))
      .sort(sortByDueDate);

    // …but the completed list is a history log: it always shows every closed
    // task, otherwise the focus filter silently hides finished work.
    const completed = tasks.filter((t) => !isOpenTask(t)).sort(sortByCompletedAt);

    return {
      topTasks: top,
      todayTasks: today,
      otherTasks: other,
      completedTasks: completed,
    };
  }, [tasks, focusMode, dayEnd]);

  const renderTaskList = (list: Task[]) =>
    list.map((task) => (
      <TaskItem
        key={task.id}
        task={task}
        onToggle={() => toggleTaskOptimistic(task.id)}
        onStar={() => toggleTaskStarOptimistic(task.id)}
        onEdit={() => onEditTask && onEditTask(task.id)}
      />
    ));

  const handleClearCompleted = async () => {
    const count = completedTasks.length;
    if (count === 0 || isClearing) return;

    const confirmed = confirm(
      `Clear ${count} completed ${count === 1 ? 'task' : 'tasks'}?\n\n` +
        'They stay completed in Superlist — only the local copies are removed.'
    );
    if (!confirmed) return;

    setIsClearing(true);
    setClearError(null);

    const cleared = await clearCompletedTasks();

    setIsClearing(false);
    if (cleared === 0) {
      setClearError('Could not clear completed tasks — please try again.');
    }
  };

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-5 h-5 text-[var(--paper-accent)]" />
          <h2 className="font-bold text-base text-[var(--paper-text)]">{title}</h2>
          {showFocusBadge && focusMode !== 'ALL' && (
            <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] text-[var(--paper-muted)] flex items-center gap-1">
              <Filter className="w-2.5 h-2.5" />
              {focusMode.replace('_', ' ')}
            </span>
          )}
        </div>
      </div>

      {/* 1. Top Priorities (Never Collapsed) */}
      {topTasks.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--paper-accent)]">
            <Star className="w-3.5 h-3.5 fill-current" />
            Top Priorities ({topTasks.length})
          </div>
          <div className="space-y-2">{renderTaskList(topTasks)}</div>
        </div>
      )}

      {/* 2. Today / Overdue */}
      {todayTasks.length > 0 && (
        <div className="space-y-2">
          <SectionHeader
            icon={<Clock className="w-3.5 h-3.5" />}
            label="Today / Overdue"
            count={todayTasks.length}
            isCollapsed={isTodayCollapsed}
            onToggle={() => setIsTodayCollapsed(!isTodayCollapsed)}
            tone="accent"
          />
          {!isTodayCollapsed && <div className="space-y-2">{renderTaskList(todayTasks)}</div>}
        </div>
      )}

      {/* 3. Other Open Tasks Section with Collapse Toggle */}
      <div className="space-y-2">
        <SectionHeader
          icon={<Square className="w-3.5 h-3.5" />}
          label="Other Tasks"
          count={otherTasks.length}
          isCollapsed={isOtherCollapsed}
          onToggle={() => setIsOtherCollapsed(!isOtherCollapsed)}
        />

        {!isOtherCollapsed && (
          <>
            {otherTasks.length === 0 ? (
              <div className="text-xs text-[var(--paper-muted)] italic py-2">
                No active tasks for current focus context.
              </div>
            ) : (
              <div className="space-y-2">{renderTaskList(otherTasks)}</div>
            )}
          </>
        )}
      </div>

      {/* 4. Completed */}
      {completedTasks.length > 0 && (
        <div className="space-y-2 pt-2 border-t border-[var(--paper-border)]">
          <SectionHeader
            icon={<CheckSquare className="w-3.5 h-3.5" />}
            label="Completed"
            count={completedTasks.length}
            isCollapsed={isCompletedCollapsed}
            onToggle={() => setIsCompletedCollapsed(!isCompletedCollapsed)}
            tone="muted"
          />

          {!isCompletedCollapsed && (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] font-mono text-[var(--paper-muted)]">
                  {completedTasks.length} closed {completedTasks.length === 1 ? 'task' : 'tasks'}
                </span>
                <button
                  type="button"
                  onClick={handleClearCompleted}
                  disabled={isClearing}
                  className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-red-500 hover:border-red-500/50 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Remove completed tasks from this dashboard"
                >
                  <Trash2 className="w-3 h-3" />
                  {isClearing ? 'Clearing…' : 'Clear completed'}
                </button>
              </div>

              {clearError && (
                <div className="text-[10px] font-mono text-red-500">{clearError}</div>
              )}

              <div className="space-y-2 opacity-70">{renderTaskList(completedTasks)}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Collapsible section header with a chevron and a Collapsed/Expanded hint. */
function SectionHeader({
  icon,
  label,
  count,
  isCollapsed,
  onToggle,
  tone = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  isCollapsed: boolean;
  onToggle: () => void;
  tone?: 'default' | 'accent' | 'muted';
}) {
  const toneClass =
    tone === 'accent'
      ? 'text-[var(--paper-accent)]'
      : tone === 'muted'
        ? 'text-[var(--paper-muted)]'
        : 'text-[var(--paper-text)]';

  return (
    <div className="flex items-center justify-between">
      <button
        type="button"
        onClick={onToggle}
        className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${toneClass} hover:text-[var(--paper-text)] transition select-none`}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
        {icon}
        <span>
          {label} ({count})
        </span>
      </button>
      <span className="text-[10px] font-mono text-[var(--paper-muted)]">
        {isCollapsed ? 'Collapsed' : 'Expanded'}
      </span>
    </div>
  );
}

function TaskItem({
  task,
  onToggle,
  onStar,
  onEdit,
}: {
  task: Task;
  onToggle: () => void;
  onStar: () => void;
  onEdit: () => void;
}) {
  const isDone = task.status === 'DONE';
  const superlistUrl = resolveSuperlistUrl(
    task.superlistUrl,
    task.superlistListId || task.project?.superlistListId,
    task.superlistId
  );

  const due = task.dueDate ? parseISODateLocal(task.dueDate) : null;
  const validDue = due && !isNaN(due.getTime()) ? due : null;
  const isOverdue = !!validDue && !isDone && validDue.getTime() < appDayStart().getTime();

  return (
    <div
      onClick={onEdit}
      className={`group flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all cursor-pointer ${
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
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onStar();
          }}
          className={`shrink-0 transition active:scale-90 ${
            task.isTop3
              ? 'text-[var(--paper-star)]'
              : 'text-[var(--paper-muted)] hover:text-[var(--paper-star)]'
          }`}
          title={task.isTop3 ? 'Remove star (Top 3 Focus)' : 'Star as Top 3 Focus'}
        >
          <Star className={`w-3.5 h-3.5 ${task.isTop3 ? 'fill-current' : ''}`} />
        </button>

        {validDue && (
          <span className="flex items-center gap-1 shrink-0">
            <span
              className={`text-[10px] font-mono ${
                isOverdue ? 'text-red-500' : 'text-[var(--paper-muted)]'
              }`}
              title={isOverdue ? 'Overdue' : 'Due date'}
            >
              {formatDateDDMMShort(validDue)}
            </span>
            {isOverdue && (
              <span className="text-[9px] font-mono uppercase text-red-500 tracking-wider">
                overdue
              </span>
            )}
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

// Keep export alias for backwards-compatibility
export { TaskHub as SuperlistTaskHub };
