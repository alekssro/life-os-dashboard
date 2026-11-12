'use client';

import {
  AlertCircle,
  ArrowRight,
  Bell,
  Calendar,
  CalendarPlus,
  Check,
  CheckSquare,
  Clock,
  ExternalLink,
  Flame,
  Inbox,
  Repeat,
  Sparkles,
  Square,
  Star,
  BookOpen,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { NavItem } from '../Sidebar';
import {
  appDayStart,
  formatDateDDMMYYYY,
  formatDateYYYYMMDD,
  formatTimeHHMM,
  formatWeekday,
  parseISODateLocal,
  toISODate,
  todayISO,
} from '@/lib/date';
import { CalendarDateInput } from '@/components/CalendarDateInput';
import { TaskHub } from '@/components/TaskHub';
import { CalendarView } from '@/components/CalendarView';
import { HabitTracker } from '@/components/HabitTracker';
import { ObsidianCapture } from '@/components/ObsidianCapture';
import { EditTaskModal } from '@/components/EditTaskModal';
import { TriageDomainModal } from '@/components/TriageDomainModal';
import { useDashboardStore } from '@/store/useDashboardStore';
import { useDeleteTask } from '@/hooks/useDeleteTask';

interface TodayDashboardProps {
  onNavigate: (view: NavItem) => void;
}

/** Superlist details carried on an Inbox item's metadata blob. */
function parseInboxMetadata(raw: any): { dueDate?: string | null; superlistId?: string | null } {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

export function TodayDashboard({ onNavigate }: TodayDashboardProps) {
  const [resurfacedItem, setResurfacedItem] = useState<any | null>(null);
  const [attention, setAttention] = useState<any | null>(null);
  const [inboxItems, setInboxItems] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [triageItem, setTriageItem] = useState<{
    id: string;
    title: string;
    source?: string | null;
    superlistId?: string | null;
  } | null>(null);

  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const toggleTaskStarOptimistic = useDashboardStore((s) => s.toggleTaskStarOptimistic);
  const { confirmAndDelete } = useDeleteTask();
  const tasks = useDashboardStore((s) => s.tasks);
  const domains = useDashboardStore((s) => s.domains);

  // Load dashboard secondary data
  const loadSecondaryData = async () => {
    try {
      const [libraryRes, attentionRes, inboxRes, notificationsRes] = await Promise.all([
        fetch('/api/library?resurface=true'),
        fetch('/api/attention'),
        fetch('/api/inbox'),
        fetch('/api/notifications'),
      ]);

      if (libraryRes.ok) setResurfacedItem(await libraryRes.json());
      if (attentionRes.ok) setAttention(await attentionRes.json());
      if (inboxRes.ok) setInboxItems(await inboxRes.json());
      if (notificationsRes.ok) setNotifications(await notificationsRes.json());
    } catch (err) {
      console.error('Error loading secondary dashboard data:', err);
    }
  };

  useEffect(() => {
    loadSecondaryData();
  }, []);

  // Inbox triage action
  const handleTriageAction = async (itemId: string, action: string) => {
    setInboxItems((prev) => prev.filter((item) => item.id !== itemId));
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, action }),
    });
    loadSecondaryData();
  };

  // "Own" opens the domain picker: a Superlist task has to be filed under a
  // Domain, which gives it its list in Superlist.
  const openTriage = (item: any) => {
    setTriageItem({
      id: item.id,
      title: item.title,
      source: item.source,
      superlistId: item.superlistId,
    });
  };

  // Delete a task from the edit modal (also removes it in Superlist).
  const handleDeleteTask = async (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const error = await confirmAndDelete(task);
    setEditingTaskId(null);
    if (error) alert(error);
  };

  const handleTriageAssigned = async (_domainId?: string, warning?: string) => {
    setTriageItem(null);
    if (warning) {
      console.warn('Triage warning:', warning);
    }
    loadSecondaryData();
    fetchDashboardData();
  };

  const completeOverdueTask = async (task: any) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: 'DONE' }),
    });
    fetchDashboardData();
    loadSecondaryData();
  };

  // Star an attention task so it joins the Top Priorities of the task hub.
  const starAttentionTask = async (task: any) => {
    await toggleTaskStarOptimistic(task.id);
    loadSecondaryData();
  };

  // Re-plan an overdue task for any date the user picks (today is just one option).
  const scheduleTaskOn = async (task: any, isoDate: string) => {
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, dueDate: isoDate }),
    });
    fetchDashboardData();
    loadSecondaryData();
  };

  // Re-plan an overdue task for today instead of leaving it in the past.
  // "today" is resolved by the server, so the app's current day wins over
  // whatever day the browser thinks it is.
  const scheduleTaskToday = async (task: any) => {
    await scheduleTaskOn(task, 'today');
  };

  const isTaskStarred = (taskId: string) => !!tasks.find((t) => t.id === taskId)?.isTop3;

  // The task's current due date as YYYY-MM-DD (used to highlight it in the picker).
  const dueDateISO = (task: any): string => {
    if (!task.dueDate) return '';
    // Due dates arrive as calendar days — parse them as local dates so they
    // never slip a day in a browser west of the server.
    const d = parseISODateLocal(task.dueDate);
    if (isNaN(d.getTime())) return '';
    return formatDateYYYYMMDD(d);
  };

  // The Attention panel only shows up when there is something to act on.
  const hasAttention =
    (attention?.overdueTasks?.length ?? 0) > 0 ||
    (attention?.atRiskProjects?.length ?? 0) > 0 ||
    (attention?.quietProjects?.length ?? 0) > 0;

  const saveTask = async (id: string, updates: any) => {
    setEditingTaskId(null);
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) fetchDashboardData();
  };

  const todayDate = appDayStart();
  const taskBeingEdited = tasks.find((t) => t.id === editingTaskId);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8 space-y-8">
      {/* Top Banner — the sync and capture actions live in the app bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[var(--paper-text)]">
            Today Briefing
          </h1>
          <p
            className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase tracking-wider"
            title="The day rolls over at 05:00"
          >
            {formatWeekday(todayDate)}, {formatDateDDMMYYYY(todayDate)}
          </p>
        </div>
      </div>

      {/* Main 2-Column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT / CENTER COLUMN (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* 1. Task Hub (Focus mode enabled, top priorities + today/overdue up
              front, "Other Tasks" collapsed so the dashboard stays focused) */}
          <TaskHub
            title="Task Hub"
            onEditTask={(id) => setEditingTaskId(id)}
            defaultCollapsed
          />

          {/* 2. Habits (divided by daily/weekly/monthly, only due today, default views) */}
          <HabitTracker
            title="Habits"
            isTodayOnly={true}
            allowYearlyView={false}
            showControls={false}
          />

          {/* 3. Obsidian Markdown Quick Capture */}
          <ObsidianCapture />

          {/* Edit Task Pop-up Modal */}
          <EditTaskModal
            task={taskBeingEdited || null}
            domains={domains}
            isOpen={Boolean(editingTaskId)}
            onClose={() => setEditingTaskId(null)}
            onSave={(id, updates) => saveTask(id, updates)}
          />
        </div>

        {/* RIGHT RAIL COLUMN (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* 1. Attention (Boxed + icon styling) — only shown when something needs it */}
          {hasAttention && (
            <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-500" />
                  <h2 className="font-bold text-sm text-[var(--paper-text)]">Attention</h2>
                </div>
              </div>

              <div className="space-y-3">
                {/* Overdue tasks */}
                {(attention?.overdueTasks?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase text-red-500 font-bold tracking-wider">
                      Overdue Tasks
                    </div>
                    {(attention?.overdueTasks ?? []).map((t: any) => (
                      <div
                        key={t.id}
                        className="p-2.5 rounded-lg border border-red-500/30 bg-red-500/5 flex items-start gap-2.5"
                      >
                        <button
                          onClick={() => completeOverdueTask(t)}
                          className="mt-0.5 text-[var(--paper-muted)] hover:text-red-500 transition"
                          title="Mark as done"
                        >
                          <Square className="w-4 h-4" />
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-[var(--paper-text)] truncate">
                            {t.title}
                          </p>
                          <span className="text-[10px] font-mono text-red-500 uppercase font-medium">
                            {formatDateDDMMYYYY(t.dueDate)} · {t.daysOverdue}d overdue
                          </span>
                        </div>

                        {/* Quick actions */}
                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            onClick={() => starAttentionTask(t)}
                            className={`p-1 rounded transition active:scale-90 ${
                              isTaskStarred(t.id)
                                ? 'text-[var(--paper-star)]'
                                : 'text-[var(--paper-muted)] hover:text-[var(--paper-star)]'
                            }`}
                            title={
                              isTaskStarred(t.id)
                                ? 'Remove star (Top 3 Focus)'
                                : 'Star as Top 3 Focus'
                            }
                          >
                            <Star
                              className={`w-3.5 h-3.5 ${
                                isTaskStarred(t.id) ? 'fill-current' : ''
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => scheduleTaskToday(t)}
                            className="p-1 rounded text-[var(--paper-muted)] hover:text-[var(--paper-accent)] transition active:scale-90"
                            title="Schedule for today"
                          >
                            <CalendarPlus className="w-3.5 h-3.5" />
                          </button>
                          <CalendarDateInput
                            iconOnly
                            icon={<Calendar className="w-3.5 h-3.5" />}
                            title="Schedule for another date"
                            value={dueDateISO(t)}
                            onChange={(iso) => scheduleTaskOn(t, iso)}
                            popupAlign="right"
                            className="p-1 rounded text-[var(--paper-muted)] hover:text-[var(--paper-accent)] transition active:scale-90"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Quiet Projects */}
                {(attention?.quietProjects?.length ?? 0) > 0 && (
                  <div className="space-y-2">
                    <div className="text-[10px] font-mono uppercase text-[var(--paper-muted)] font-bold tracking-wider">
                      Quiet Projects
                    </div>
                    {attention.quietProjects.map((p: any) => (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] flex items-center justify-between text-xs"
                      >
                        <span className="font-semibold text-[var(--paper-text)] truncate">{p.title}</span>
                        <span className="text-[10px] font-mono text-[var(--paper-muted)]">
                          {p.daysInactive}d inactive
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. Needs Review — hidden entirely when the inbox is clear */}
          {inboxItems.length > 0 && (
            <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Inbox className="w-4 h-4 text-[var(--paper-accent)]" />
                  <h2 className="font-bold text-sm text-[var(--paper-text)]">Needs Review</h2>
                  <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-[var(--paper-card-subtle)] text-[var(--paper-muted)]">
                    {inboxItems.length}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {inboxItems.slice(0, 3).map((item) => {
                  const meta = parseInboxMetadata(item.metadata);
                  const isSuperlist = item.source === 'SUPERLIST' || !!item.superlistId;
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-[var(--paper-text)]">{item.title}</p>
                        {isSuperlist && (
                          <span className="shrink-0 text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border border-[var(--paper-border-strong)] text-[var(--paper-muted)]">
                            Superlist
                          </span>
                        )}
                      </div>

                      {meta.dueDate && (
                        <p className="text-[10px] font-mono uppercase text-[var(--paper-muted)]">
                          Due {formatDateDDMMYYYY(meta.dueDate)}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          onClick={() => openTriage(item)}
                          className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] hover:border-[var(--paper-accent)] text-[var(--paper-text)]"
                        >
                          {isSuperlist ? 'Assign domain' : 'Own'}
                        </button>
                        {!isSuperlist && (
                          <button
                            onClick={() => handleTriageAction(item.id, 'READING')}
                            className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] hover:border-[var(--paper-accent)] text-[var(--paper-text)]"
                          >
                            Reading
                          </button>
                        )}
                        <button
                          onClick={() => handleTriageAction(item.id, 'CLEAR')}
                          className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
                        >
                          Clear
                        </button>
                      </div>
                    </div>
                  );
                })}

              </div>
            </div>
          )}
          {/* 3. Calendar (Google Calendar feeds filtered by active focus mode) */}
          <CalendarView />

          {/* 4. Resurfacing — hidden entirely when there is nothing to resurface */}
          {resurfacedItem && (
            <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-2.5">
              <div className="flex items-center gap-2 border-b border-[var(--paper-border)] pb-2.5">
                <BookOpen className="w-4 h-4 text-[var(--paper-accent)]" />
                <h2 className="font-bold text-sm text-[var(--paper-text)]">Resurfacing</h2>
              </div>
              <div className="p-3 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] space-y-1.5">
                <p className="text-xs font-serif italic text-[var(--paper-text)] leading-relaxed">
                  "{resurfacedItem.body || resurfacedItem.title}"
                </p>
                {resurfacedItem.author && (
                  <p className="text-[11px] font-mono text-[var(--paper-muted)] text-right">
                    — {resurfacedItem.author}
                  </p>
                )}
              </div>
            </div>
          )}


          {/* 5. Notifications — hidden entirely when there is nothing new */}
          {notifications.length > 0 && (
            <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-2.5">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-[var(--paper-accent)]" />
                  <h2 className="font-bold text-sm text-[var(--paper-text)]">Notifications</h2>
                </div>
                <span className="text-[10px] font-mono text-[var(--paper-muted)]">
                  {notifications.filter((n) => !n.read).length} unread
                </span>
              </div>

              <div className="space-y-1.5">
                {notifications.slice(0, 3).map((notif) => (
                  <div
                    key={notif.id}
                    className="p-2 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] text-xs flex items-center justify-between gap-2"
                  >
                    <span className="font-medium text-[var(--paper-text)] truncate">{notif.title}</span>
                    <span className="text-[10px] font-mono text-[var(--paper-muted)] shrink-0">
                      {formatTimeHHMM(notif.createdAt)}
                    </span>
                  </div>
                ))}

              </div>
            </div>
          )}
        </div>
      </div>

      {/* Triage an Inbox item under a Domain (required for Superlist tasks) */}
      <TriageDomainModal
        item={triageItem}
        isOpen={!!triageItem}
        onClose={() => setTriageItem(null)}
        onAssigned={handleTriageAssigned}
      />
    </div>
  );
}
