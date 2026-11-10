import { create } from 'zustand';
import { Task, Event, Routine, Domain, FocusMode, HabitHistoryMap } from '@/types';
import { toISODate, appDayStart } from '@/lib/date';

interface DashboardState {
  // Focus & UI Mode
  focusMode: FocusMode;
  setFocusMode: (mode: FocusMode) => void;

  // Sync Timestamp & Indicators
  lastSyncedAt: string | null;
  isSyncing: boolean;
  syncError: string | null;

  // Data Stores
  tasks: Task[];
  events: Event[];
  routines: Routine[];
  domains: Domain[];
  habitHistory: HabitHistoryMap;
  // Range the loaded history covers, so refreshes keep the same window.
  habitHistoryRange: { start: string; end: string } | null;

  // State Setters
  setTasks: (tasks: Task[]) => void;
  setEvents: (events: Event[]) => void;
  setRoutines: (routines: Routine[]) => void;
  setDomains: (domains: Domain[]) => void;
  setHabitHistoryRange: (range: { start: string; end: string } | null) => void;

  // Actions
  fetchDashboardData: () => Promise<void>;
  syncNow: () => Promise<void>;
  toggleTaskOptimistic: (taskId: string) => Promise<boolean>;
  toggleTaskStarOptimistic: (taskId: string) => Promise<boolean>;
  clearCompletedTasks: () => Promise<number>;
  toggleHabitOptimistic: (routineId: string, dateStr?: string) => Promise<boolean>;
  loadHabitHistory: (startDate?: string, endDate?: string) => Promise<void>;
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  focusMode: 'ALL',
  setFocusMode: (focusMode) => set({ focusMode }),

  lastSyncedAt: null,
  isSyncing: false,
  syncError: null,

  tasks: [],
  events: [],
  routines: [],
  domains: [],
  habitHistory: {},
  habitHistoryRange: null,

  setTasks: (tasks) => set({ tasks }),
  setEvents: (events) => set({ events }),
  setRoutines: (routines) => set({ routines }),
  setDomains: (domains) => set({ domains }),
  setHabitHistoryRange: (habitHistoryRange) => set({ habitHistoryRange }),

  fetchDashboardData: async () => {
    try {
      const [tasksRes, eventsRes, routinesRes, domainsRes] = await Promise.all([
        fetch('/api/tasks'),
        // Today briefing horizon: current day + next 14 days.
        fetch('/api/events?days=14&limit=200'),
        fetch('/api/routines'),
        fetch('/api/domains'),
      ]);

      const tasks = tasksRes.ok ? await tasksRes.json() : get().tasks;
      const events = eventsRes.ok ? await eventsRes.json() : get().events;
      const routinesData = routinesRes.ok ? await routinesRes.json() : { routines: [] };
      const domains = domainsRes.ok ? await domainsRes.json() : get().domains;

      set({
        tasks: Array.isArray(tasks) ? tasks : [],
        events: Array.isArray(events) ? events : [],
        routines: Array.isArray(routinesData?.routines) ? routinesData.routines : [],
        domains: Array.isArray(domains) ? domains : [],
        lastSyncedAt: new Date().toISOString(),
      });
    } catch (err: any) {
      console.error('Failed to fetch dashboard data:', err);
    }
  },

  syncNow: async () => {
    set({ isSyncing: true, syncError: null });
    try {
      // 1. Pull Superlist changes if configured
      const superlistPullPromise = fetch('/api/integrations/superlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_PULL' }),
      }).catch((e) => console.warn('Superlist sync skip/warn:', e));

      // 2. Trigger Google Calendar sync
      const calSyncPromise = fetch('/api/calendar/sync', {
        method: 'POST',
      }).catch((e) => console.warn('Calendar sync skip/warn:', e));

      await Promise.allSettled([superlistPullPromise, calSyncPromise]);

      // 3. Re-fetch fresh state across all domains
      await get().fetchDashboardData();
      await get().loadHabitHistory();

      set({
        lastSyncedAt: new Date().toISOString(),
        isSyncing: false,
      });
    } catch (err: any) {
      console.error('Error during manual sync:', err);
      set({
        isSyncing: false,
        syncError: err?.message || 'Sync failed',
      });
    }
  },

  toggleTaskOptimistic: async (taskId: string) => {
    const prevTasks = get().tasks;
    const task = prevTasks.find((t) => t.id === taskId);
    if (!task) return false;

    const nextStatus = task.status === 'DONE' ? 'TODO' : 'DONE';

    // 1. Apply Optimistic Update
    set({
      tasks: prevTasks.map((t) =>
        t.id === taskId
          ? {
              ...t,
              status: nextStatus,
              completedAt: nextStatus === 'DONE' ? new Date().toISOString() : null,
            }
          : t
      ),
    });

    // 2. Network Dispatch with Fast Rollback on failure
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, status: nextStatus }),
      });

      if (!res.ok) {
        throw new Error(`Failed to update task: ${res.statusText}`);
      }

      const updatedTask = await res.json();
      set({
        tasks: get().tasks.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t)),
      });
      return true;
    } catch (err) {
      console.error('Task update failed, rolling back:', err);
      // Fast rollback
      set({ tasks: prevTasks });
      return false;
    }
  },

  toggleTaskStarOptimistic: async (taskId: string) => {
    const prevTasks = get().tasks;
    const task = prevTasks.find((t) => t.id === taskId);
    if (!task) return false;

    const nextStarred = !task.isTop3;

    // 1. Apply Optimistic Update
    set({
      tasks: prevTasks.map((t) => (t.id === taskId ? { ...t, isTop3: nextStarred } : t)),
    });

    // 2. Network Dispatch With Fast Rollback on failure
    try {
      const res = await fetch('/api/tasks', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: taskId, isTop3: nextStarred }),
      });

      if (!res.ok) {
        throw new Error(`Failed to star task: ${res.statusText}`);
      }

      const updatedTask = await res.json();
      set({
        tasks: get().tasks.map((t) => (t.id === taskId ? { ...t, ...updatedTask } : t)),
      });
      return true;
    } catch (err) {
      console.error('Task star update failed, rolling back:', err);
      // Fast rollback
      set({ tasks: prevTasks });
      return false;
    }
  },

  clearCompletedTasks: async () => {
    const prevTasks = get().tasks;
    const isClosed = (t: Task) => t.status === 'DONE' || t.status === 'CANCELLED';
    const closedCount = prevTasks.filter(isClosed).length;
    if (closedCount === 0) return 0;

    // Optimistic: drop every closed task from the local list.
    set({ tasks: prevTasks.filter((t) => !isClosed(t)) });

    try {
      // Bulk delete — Superlist has no delete API, so completed tasks stay
      // completed there; only the local copies are removed.
      const res = await fetch('/api/tasks?status=DONE,CANCELLED', { method: 'DELETE' });

      if (!res.ok) {
        throw new Error(`Failed to clear completed tasks: ${res.statusText}`);
      }

      return closedCount;
    } catch (err) {
      console.error('Failed to clear completed tasks, rolling back:', err);
      // Fast rollback
      set({ tasks: prevTasks });
      return 0;
    }
  },

  toggleHabitOptimistic: async (routineId: string, dateStr?: string) => {
    const todayStr = dateStr || toISODate(appDayStart());
    const prevRoutines = get().routines;
    const prevHistory = get().habitHistory;

    const routine = prevRoutines.find((r) => r.id === routineId);
    if (!routine) return false;

    const currentCompleted =
      dateStr === toISODate(appDayStart()) || !dateStr
        ? !!routine.isCompletedToday
        : !!prevHistory[routineId]?.[todayStr];

    const nextCompleted = !currentCompleted;

    // Optimistic Update for routines list & history map
    const updatedHistory = {
      ...prevHistory,
      [routineId]: {
        ...(prevHistory[routineId] || {}),
        [todayStr]: nextCompleted,
      },
    };

    const deltaStreak = nextCompleted ? 1 : Math.max(0, routine.streak - 1);

    set({
      routines: prevRoutines.map((r) =>
        r.id === routineId
          ? {
              ...r,
              isCompletedToday:
                todayStr === toISODate(appDayStart()) ? nextCompleted : r.isCompletedToday,
              streak:
                todayStr === toISODate(appDayStart())
                  ? (nextCompleted ? r.streak + 1 : Math.max(0, r.streak - 1))
                  : r.streak,
            }
          : r
      ),
      habitHistory: updatedHistory,
    });

    try {
      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          routineId,
          completed: nextCompleted,
          date: todayStr,
        }),
      });

      if (!res.ok) {
        throw new Error(`Habit update failed with status ${res.status}`);
      }

      // Re-fetch routines and history quietly to get exact server state
      await Promise.all([
        get().loadHabitHistory(),
        fetch('/api/routines')
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.routines) set({ routines: data.routines });
          }),
      ]);
      return true;
    } catch (err) {
      console.error('Failed to toggle habit, rolling back:', err);
      set({
        routines: prevRoutines,
        habitHistory: prevHistory,
      });
      return false;
    }
  },

  loadHabitHistory: async (startDate?: string, endDate?: string) => {
    try {
      // Fall back to the range the matrices are currently showing, so a
      // refresh never drops logs from a year the user navigated to.
      const range = get().habitHistoryRange;
      const start = startDate ?? range?.start;
      const end = endDate ?? range?.end;

      const url = new URL('/api/routines/history', window.location.origin);
      if (start) url.searchParams.set('startDate', start);
      if (end) url.searchParams.set('endDate', end);

      const res = await fetch(url.toString());
      if (!res.ok) return;

      const data = await res.json();
      const historyMap: HabitHistoryMap = {};

      if (Array.isArray(data.logs)) {
        data.logs.forEach((log: { routineId: string; date: string; completed: boolean }) => {
          if (!historyMap[log.routineId]) {
            historyMap[log.routineId] = {};
          }
          historyMap[log.routineId][log.date] = log.completed;
        });
      }

      set({ habitHistory: historyMap });
    } catch (err) {
      console.error('Failed to load habit history:', err);
    }
  },
}));
