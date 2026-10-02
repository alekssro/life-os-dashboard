'use client';

import {
  AlertCircle,
  ArrowRight,
  Bell,
  Check,
  CheckSquare,
  Clock,
  ExternalLink,
  Flame,
  Inbox,
  Plus,
  RefreshCw,
  Repeat,
  Sparkles,
  Square,
  Star,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { NavItem } from '../Sidebar';
import { formatDateDDMMYYYY, formatTimeHHMM, formatWeekday, toISODate } from '@/lib/date';
import { EditTaskPanel } from '@/components/EditTaskPanel';
import { EditRoutinePanel } from '@/components/EditRoutinePanel';

interface TodayDashboardProps {
  onNavigate: (view: NavItem) => void;
  onOpenCapture: () => void;
}

export function TodayDashboard({ onNavigate, onOpenCapture }: TodayDashboardProps) {
  const [tasks, setTasks] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [routinesData, setRoutinesData] = useState<{
    routines: any[];
    total: number;
    completedCount: number;
  }>({ routines: [], total: 0, completedCount: 0 });
  const [resurfacedItem, setResurfacedItem] = useState<any | null>(null);
  const [attention, setAttention] = useState<any | null>(null);
  const [inboxItems, setInboxItems] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncingCal, setIsSyncingCal] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);

  const handleSyncCalendar = async () => {
    setIsSyncingCal(true);
    try {
      await fetch('/api/calendar/sync', { method: 'POST' });
      const eventsRes = await fetch('/api/events');
      if (eventsRes.ok) setEvents(await eventsRes.json());
    } catch (err) {
      console.error('Error syncing calendar:', err);
    } finally {
      setIsSyncingCal(false);
    }
  };

  // Load dashboard data
  const loadData = async () => {
    try {
      const [
        tasksRes,
        domainsRes,
        eventsRes,
        routinesRes,
        libraryRes,
        attentionRes,
        inboxRes,
        notificationsRes,
      ] = await Promise.all([
        fetch('/api/tasks'),
        fetch('/api/domains'),
        fetch('/api/events'),
        fetch('/api/routines'),
        fetch('/api/library?resurface=true'),
        fetch('/api/attention'),
        fetch('/api/inbox'),
        fetch('/api/notifications'),
      ]);

      if (tasksRes.ok) setTasks(await tasksRes.json());
      if (domainsRes.ok) setDomains(await domainsRes.json());
      if (eventsRes.ok) setEvents(await eventsRes.json());
      if (routinesRes.ok) setRoutinesData(await routinesRes.json());
      if (libraryRes.ok) setResurfacedItem(await libraryRes.json());
      if (attentionRes.ok) setAttention(await attentionRes.json());
      if (inboxRes.ok) setInboxItems(await inboxRes.json());
      if (notificationsRes.ok) setNotifications(await notificationsRes.json());
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Task actions
  const toggleTaskStatus = async (task: any) => {
    const newStatus = task.status === 'DONE' ? 'TODO' : 'DONE';
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t))
    );

    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, status: newStatus }),
    });
  };

  const toggleTop3 = async (task: any) => {
    const newTop3 = !task.isTop3;
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, isTop3: newTop3 } : t))
    );

    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: task.id, isTop3: newTop3 }),
    });
  };

  // Routine action
  const toggleRoutine = async (routineId: string, currentCompleted: boolean) => {
    const nextVal = !currentCompleted;
    setRoutinesData((prev) => ({
      ...prev,
      routines: prev.routines.map((r) =>
        r.id === routineId
          ? {
            ...r,
            isCompletedToday: nextVal,
            streak: nextVal ? r.streak + 1 : Math.max(0, r.streak - 1),
          }
          : r
      ),
      completedCount: nextVal ? prev.completedCount + 1 : Math.max(0, prev.completedCount - 1),
    }));

    const res = await fetch('/api/routines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ routineId, completed: nextVal }),
    });

    // e.g. routine no longer scheduled for today — fall back to server truth
    if (!res.ok) loadData();
  };

  // Inline edit actions (tap the object, not the checkbox)
  const saveTask = async (id: string, updates: any) => {
    setEditingTaskId(null);
    const res = await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) loadData();
  };

  const saveRoutine = async (id: string, updates: any) => {
    setEditingRoutineId(null);
    const res = await fetch('/api/routines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    if (res.ok) loadData();
  };

  // Inbox triage action
  const handleTriageAction = async (itemId: string, action: string) => {
    setInboxItems((prev) => prev.filter((item) => item.id !== itemId));
    await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: itemId, action }),
    });
    loadData();
  };

  const top3Tasks = tasks.filter((t) => t.isTop3 && t.status !== 'DONE');
  const openTasks = tasks.filter((t) => !t.isTop3 && t.status !== 'DONE');

  // Only routines scheduled for today belong in the Today Briefing.
  const dueRoutines = routinesData.routines.filter((r) => r.isDueToday);
  const morningRoutines = dueRoutines.filter((r) => r.timeOfDay === 'MORNING');
  const afternoonRoutines = dueRoutines.filter((r) => r.timeOfDay === 'AFTERNOON');
  const eveningRoutines = dueRoutines.filter((r) => r.timeOfDay === 'EVENING');

  const openSpotsNeeded = Math.max(0, 3 - top3Tasks.length);

  // Single "now" for the whole render so the heading and date maths never disagree.
  const now = new Date();
  const todayISOStr = toISODate(now);

  // Tap the routine (not the checkbox) to edit it inline.
  const renderRoutineRow = (r: any) => (
    <div key={r.id}>
      <div
        onClick={() => setEditingRoutineId(editingRoutineId === r.id ? null : r.id)}
        className={`flex items-center justify-between p-2 rounded cursor-pointer text-xs ${
          editingRoutineId === r.id
            ? 'bg-[var(--paper-card-subtle)] ring-1 ring-[var(--paper-accent)]'
            : 'hover:bg-[var(--paper-card-subtle)]'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleRoutine(r.id, r.isCompletedToday);
            }}
            className="shrink-0"
            title={r.isCompletedToday ? 'Mark as not done' : 'Mark as done'}
          >
            {r.isCompletedToday ? (
              <CheckSquare className="w-4 h-4 text-[var(--paper-accent)]" />
            ) : (
              <Square className="w-4 h-4 text-[var(--paper-muted)]" />
            )}
          </button>
          <span
            className={
              r.isCompletedToday
                ? 'line-through text-[var(--paper-muted)]'
                : 'text-[var(--paper-text)] font-medium'
            }
          >
            {r.icon && <span className="mr-1.5">{r.icon}</span>}
            {r.title}
          </span>
        </div>
        {r.streak > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] font-mono text-[var(--paper-accent)]">
            <Flame className="w-3 h-3 fill-current" />
            {r.streak}
          </span>
        )}
      </div>

      {editingRoutineId === r.id && (
        <div className="mt-1.5 p-2 rounded border border-[var(--paper-accent)]/60 bg-[var(--paper-card-subtle)]">
          <EditRoutinePanel
            routine={r}
            onSave={(updates) => saveRoutine(r.id, updates)}
            onCancel={() => setEditingRoutineId(null)}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-8">
      {/* Top Banner / Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 mb-6 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-[var(--paper-text)]">
            Today Briefing
          </h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase tracking-wider">
            {formatWeekday(now)}, {formatDateDDMMYYYY(now)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="p-2 rounded border border-[var(--paper-border)] hover:bg-[var(--paper-card-subtle)] text-[var(--paper-muted)] hover:text-[var(--paper-text)] transition-colors"
            title="Refresh dashboard"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={onOpenCapture}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-[var(--paper-accent)] hover:opacity-90 text-white font-mono text-xs font-medium transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Capture (⌘J)</span>
          </button>
        </div>
      </div>

      {/* Main 2-Column Grid (Center Tasks/Events + Right Rail) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* LEFT / CENTER COLUMN (7 cols) */}
        <div className="lg:col-span-7 space-y-9">
          {/* 1. TOP 3 FOR TODAY */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                Top 3 For Today
              </h2>
            </div>

            <div className="space-y-2">
              {top3Tasks.map((task) => (
                <div
                  key={task.id}
                  onClick={() => setEditingTaskId(editingTaskId === task.id ? null : task.id)}
                  className={`p-3 rounded border bg-[var(--paper-card)] transition-colors group cursor-pointer ${
                    editingTaskId === task.id
                      ? 'border-[var(--paper-accent)]'
                      : 'border-[var(--paper-border)] hover:border-[var(--paper-border-strong)]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskStatus(task);
                        }}
                        className="mt-0.5 text-[var(--paper-muted)] hover:text-[var(--paper-accent)]"
                        title={task.status === 'DONE' ? 'Mark as not done' : 'Mark as done'}
                      >
                      {task.status === 'DONE' ? (
                        <CheckSquare className="w-4 h-4 text-[var(--paper-accent)]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--paper-text)] leading-snug">
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
                        <span className="text-[10px] font-mono text-[var(--paper-accent)] uppercase font-semibold">
                          Due Today
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTop3(task);
                    }}
                    className="p-1 text-[var(--paper-star)] hover:opacity-80 ml-2"
                    title="Remove from Top 3"
                  >
                    <Star className="w-4 h-4 fill-current" />
                  </button>
                  </div>

                  {editingTaskId === task.id && (
                    <EditTaskPanel
                      task={task}
                      domains={domains}
                      onSave={(updates) => saveTask(task.id, updates)}
                      onCancel={() => setEditingTaskId(null)}
                    />
                  )}
                </div>
              ))}

              {/* Open spot placeholders if fewer than 3 */}
              {Array.from({ length: openSpotsNeeded }).map((_, i) => (
                <div
                  key={`open-spot-${i}`}
                  className="p-3 rounded border border-dashed border-[var(--paper-border-strong)] bg-[var(--paper-card-subtle)]/50"
                >
                  <div className="flex items-center gap-3">
                    <Square className="w-4 h-4 text-[var(--paper-muted)]/50" />
                    <span className="text-sm italic text-[var(--paper-muted)] font-serif">
                      (open spot)
                    </span>
                  </div>
                  <p className="text-xs text-[var(--paper-muted)] mt-1 ml-7">
                    Star a task below to set it as today's top 3.
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 2. UP NEXT (Calendar / Schedule) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                  Up Next
                </h2>
                <button
                  onClick={handleSyncCalendar}
                  disabled={isSyncingCal}
                  className="p-1 rounded text-[var(--paper-muted)] hover:text-[var(--paper-text)] transition-colors"
                  title="Sync Active Google Calendars"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncingCal ? 'animate-spin text-[var(--paper-accent)]' : ''}`} />
                </button>
              </div>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-text)] flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {events.length > 0 ? (
                events.map((ev) => (
                  <div
                    key={ev.id}
                    className="flex items-start gap-4 p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card)]"
                  >
                    <div className="w-24 shrink-0 font-mono text-xs font-medium text-[var(--paper-muted)]">
                      <div>{ev.startTime || 'All Day'}</div>
                      {ev.date && toISODate(ev.date) !== todayISOStr && (
                        <div className="text-[10px] text-[var(--paper-muted)]/80">
                          {formatDateDDMMYYYY(ev.date)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--paper-text)]">{ev.title}</p>
                        {ev.calendar && (
                          <span
                            className="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border flex items-center gap-1 shrink-0"
                            style={{ borderColor: ev.calendar.color || 'var(--paper-accent)' }}
                          >
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: ev.calendar.color || 'var(--paper-accent)' }}
                            />
                            {ev.calendar.name}
                          </span>
                        )}
                      </div>
                      {ev.location && (
                        <p className="text-xs text-[var(--paper-muted)] mt-0.5 truncate">
                          {ev.location}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded border border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                  Nothing scheduled from today onwards.
                </div>
              )}
            </div>
          </section>

          {/* 3. ALL OPEN TASKS */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                  All Open
                </h2>
                <span className="text-xs font-mono text-[var(--paper-muted)]">
                  · {openTasks.length}
                </span>
              </div>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-text)] flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-2">
              {openTasks.slice(0, 10).map((task) => (
                <div
                  key={task.id}
                  onClick={() => setEditingTaskId(editingTaskId === task.id ? null : task.id)}
                  className={`p-3 rounded border bg-[var(--paper-card)] transition-colors group cursor-pointer ${
                    editingTaskId === task.id
                      ? 'border-[var(--paper-accent)]'
                      : 'border-[var(--paper-border)] hover:border-[var(--paper-border-strong)]'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleTaskStatus(task);
                        }}
                        className="mt-0.5 text-[var(--paper-muted)] hover:text-[var(--paper-accent)]"
                        title="Mark as done"
                      >
                        <Square className="w-4 h-4" />
                      </button>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--paper-text)] leading-snug">
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
                          <span className="text-[10px] font-mono text-[var(--paper-accent)] uppercase flex items-center gap-1">
                            {formatDateDDMMYYYY(task.dueDate)}
                            <span className="text-[var(--paper-muted)] font-semibold">
                              ·{' '}
                              {toISODate(task.dueDate) < todayISOStr
                                ? 'Overdue'
                                : toISODate(task.dueDate) === todayISOStr
                                ? 'Due Today'
                                : 'Upcoming'}
                            </span>
                          </span>
                        )}

                        {task.isRecurring && (
                          <span className="flex items-center gap-0.5 text-[10px] font-mono text-[var(--paper-muted)] uppercase">
                            <Repeat className="w-3 h-3" />
                            {task.recurrenceRule || 'Recurring'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTop3(task);
                    }}
                    className="p-1 text-[var(--paper-muted)] hover:text-[var(--paper-star)] ml-2"
                    title="Star to promote to Top 3"
                  >
                    <Star className="w-4 h-4" />
                  </button>
                  </div>

                  {editingTaskId === task.id && (
                    <EditTaskPanel
                      task={task}
                      domains={domains}
                      onSave={(updates) => saveTask(task.id, updates)}
                      onCancel={() => setEditingTaskId(null)}
                    />
                  )}
                </div>
              ))}

              {openTasks.length === 0 && (
                <div className="p-4 rounded border border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                  All open tasks are completed or organized into Top 3!
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT RAIL COLUMN (5 cols) */}
        <div className="lg:col-span-5 space-y-8">
          {/* 1. SLIPPING (Attention Engine) */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                Slipping
              </h2>
            </div>

            {attention?.slippingProjects?.length > 0 ? (
              <div className="space-y-2">
                {attention.slippingProjects.map((p: any) => (
                  <div
                    key={p.id}
                    className="p-3 rounded border border-[var(--paper-accent)]/40 bg-[var(--paper-card-subtle)]"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-[var(--paper-text)]">{p.title}</p>
                      <span className="text-[10px] font-mono text-[var(--paper-accent)] uppercase font-semibold">
                        Quiet {p.daysInactive}d
                      </span>
                    </div>
                    {p.domainName && (
                      <p className="text-[10px] font-mono text-[var(--paper-muted)] mt-1 uppercase">
                        Domain: {p.domainName}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--paper-muted)] leading-relaxed font-serif">
                Nothing slipping right now. Projects that go quiet — or miss patterns set on their domain — will surface here.
              </p>
            )}
          </section>

          {/* 2. ROUTINES */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                  Routines
                </h2>
                <span className="text-xs font-mono text-[var(--paper-muted)]">
                  · {routinesData.completedCount}/{routinesData.total}
                </span>
              </div>
              <button
                onClick={() => onNavigate('routines')}
                className="text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-text)] flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-4">
              {dueRoutines.length === 0 && (
                <div className="p-4 rounded border border-dashed border-[var(--paper-border-strong)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                  No routines scheduled for today.
                </div>
              )}

              {/* Morning */}
              {morningRoutines.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase text-[var(--paper-muted)] tracking-wider mb-1.5">
                    Morning
                  </h3>
                  <div className="space-y-1.5">
                    {morningRoutines.map(renderRoutineRow)}
                  </div>
                </div>
              )}

              {/* Afternoon */}
              {afternoonRoutines.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase text-[var(--paper-muted)] tracking-wider mb-1.5">
                    Afternoon
                  </h3>
                  <div className="space-y-1.5">
                    {afternoonRoutines.map(renderRoutineRow)}
                  </div>
                </div>
              )}

              {/* Evening */}
              {eveningRoutines.length > 0 && (
                <div>
                  <h3 className="text-[10px] font-mono uppercase text-[var(--paper-muted)] tracking-wider mb-1.5">
                    Evening
                  </h3>
                  <div className="space-y-1.5">
                    {eveningRoutines.map(renderRoutineRow)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* 3. RESURFACING */}
          <section>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                Resurfacing
              </h2>
            </div>
            {resurfacedItem ? (
              <div className="p-3.5 rounded border border-[var(--paper-border)] bg-[var(--paper-card)]">
                <p className="text-sm font-serif italic text-[var(--paper-text)] leading-relaxed">
                  "{resurfacedItem.body || resurfacedItem.title}"
                </p>
                {resurfacedItem.author && (
                  <p className="text-xs font-mono text-[var(--paper-muted)] mt-2 text-right">
                    — {resurfacedItem.author}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[var(--paper-muted)] font-serif leading-relaxed">
                One journal entry, quote, or saved verse rotates here daily.
              </p>
            )}
          </section>

          {/* 4. NEEDS REVIEW (Inbox Triage Cards) */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                  Needs Review
                </h2>
                <span className="text-xs font-mono text-[var(--paper-muted)]">
                  · {inboxItems.length}
                </span>
              </div>
              <button
                onClick={() => onNavigate('tasks')}
                className="text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-text)] flex items-center gap-1"
              >
                <span>View all</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            <div className="space-y-3">
              {inboxItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] space-y-2.5"
                >
                  <p className="text-xs font-semibold text-[var(--paper-text)] leading-snug">
                    {item.title}
                  </p>
                  {item.rawContent && item.rawContent !== item.title && (
                    <p className="text-xs text-[var(--paper-muted)] line-clamp-2 font-serif">
                      {item.rawContent}
                    </p>
                  )}

                  {/* 5 action buttons: [OWN] [READING] [MEETING] [BRAINSTORM] [✓ CLEAR] */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <button
                      onClick={() => handleTriageAction(item.id, 'OWN')}
                      className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] hover:border-[var(--paper-accent)] hover:text-[var(--paper-accent)] text-[var(--paper-text)]"
                    >
                      Own
                    </button>
                    <button
                      onClick={() => handleTriageAction(item.id, 'READING')}
                      className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] hover:border-[var(--paper-accent)] hover:text-[var(--paper-accent)] text-[var(--paper-text)]"
                    >
                      Reading
                    </button>
                    <button
                      onClick={() => handleTriageAction(item.id, 'MEETING')}
                      className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] hover:border-[var(--paper-accent)] hover:text-[var(--paper-accent)] text-[var(--paper-text)]"
                    >
                      Meeting
                    </button>
                    <button
                      onClick={() => handleTriageAction(item.id, 'BRAINSTORM')}
                      className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] hover:border-[var(--paper-accent)] hover:text-[var(--paper-accent)] text-[var(--paper-text)]"
                    >
                      Brainstorm
                    </button>
                    <button
                      onClick={() => handleTriageAction(item.id, 'CLEAR')}
                      className="px-2 py-0.5 text-[10px] font-mono uppercase rounded border border-[var(--paper-border-strong)] text-[var(--paper-muted)] hover:text-[var(--paper-accent)] flex items-center gap-0.5"
                    >
                      <Check className="w-3 h-3" />
                      Clear
                    </button>
                  </div>
                </div>
              ))}

              {inboxItems.length === 0 && (
                <div className="p-3 rounded border border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                  Inbox zero! All captured items have been triaged.
                </div>
              )}
            </div>
          </section>

          {/* 5. NOTIFICATIONS */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
                  Notifications
                </h2>
                <span className="text-xs font-mono text-[var(--paper-muted)]">
                  · {notifications.filter((n) => !n.read).length} unread
                </span>
              </div>
            </div>

            <div className="space-y-2">
              {notifications.slice(0, 3).map((notif) => (
                <div
                  key={notif.id}
                  className="flex items-start justify-between p-2 rounded text-xs border border-[var(--paper-border)] bg-[var(--paper-card)]"
                >
                  <div>
                    <p className="font-medium text-[var(--paper-text)]">{notif.title}</p>
                    <p className="text-[11px] text-[var(--paper-muted)] truncate max-w-xs">
                      {notif.message}
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-[var(--paper-muted)] uppercase shrink-0 ml-2">
                    {formatTimeHHMM(notif.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
