'use client';

/**
 * E-Paper Terminal Dashboard (800×480, strictly non-scrollable).
 *
 * Served on the dedicated /epaper route so the primary desktop UI is untouched.
 * Rendering rules for the e-ink panel it targets:
 *  - fixed 800×480 grid, overflow hidden everywhere — content is curated to
 *    essential items rather than made scrollable,
 *  - pure monochrome (#000000 on #FFFFFF), no grays, gradients, shadows or
 *    animations (ghosting / slow refresh),
 *  - text glyphs only (no emoji / icon fonts, which render poorly on e-ink).
 *
 * Physical function keys (reTerminal F1–F3 emit standard keyboard events):
 *  - F1: force full sync (Superlist pull + calendar + refetch)
 *  - F2: cycle focus context (ALL → WORK → HOMELAB → HOME)
 *  - F3: focus the scratchpad buffer (type + Enter to capture)
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { filterEventsByFocus, filterTasksByFocus } from '@/lib/focusFilter';
import { FocusMode } from '@/types';
import { formatDateDDMMYYYY, formatTimeHHMM, formatWeekday, todayISO, toISODate } from '@/lib/date';

// Focus modes cycled by F2. Labels mirror the WORK/HOME concept of the
// original reTerminal sketch using the app's real focus contexts.
const FOCUS_CYCLE: FocusMode[] = ['ALL', 'DEEP_WORK', 'HOMELAB', 'PERSONAL'];
const FOCUS_LABELS: Record<FocusMode, string> = {
  ALL: 'ALL',
  DEEP_WORK: 'WORK',
  HOMELAB: 'HOMELAB',
  PERSONAL: 'HOME',
};

const PRIORITY_RANK: Record<string, number> = {
  TOP_3: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
};

const DATA_POLL_MS = 5 * 60 * 1000; // refresh dashboard data every 5 minutes
const CLOCK_TICK_MS = 10 * 1000; // e-ink friendly: no need for per-second ticks

const SCRATCH_KEY = 'epaper-scratchpad';

/** Minutes since midnight for "H:MM AM/PM" / "HH:MM" strings; null when untimed. */
function timeToMinutes(t?: string | null): number | null {
  if (!t) return null;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

/** "9:15 AM" → "09:15"; "All Day" → "ALL DAY" (compact monochrome column). */
function formatEventTime(t?: string | null): string {
  if (!t) return '--:--';
  if (/^all[\s-]?day$/i.test(t.trim())) return 'ALL DAY';
  const mins = timeToMinutes(t);
  if (mins === null) return t;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function isAllDay(t?: string | null): boolean {
  return !!t && /^all[\s-]?day$/i.test(t.trim());
}

export function EPaperDashboard() {
  // Data + actions come from the same Zustand store the rest of the app uses.
  const tasks = useDashboardStore((s) => s.tasks);
  const events = useDashboardStore((s) => s.events);
  const routines = useDashboardStore((s) => s.routines);
  const focusMode = useDashboardStore((s) => s.focusMode);
  const setFocusMode = useDashboardStore((s) => s.setFocusMode);
  const isSyncing = useDashboardStore((s) => s.isSyncing);
  const lastSyncedAt = useDashboardStore((s) => s.lastSyncedAt);
  const syncNow = useDashboardStore((s) => s.syncNow);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const toggleTaskOptimistic = useDashboardStore((s) => s.toggleTaskOptimistic);
  const toggleHabitOptimistic = useDashboardStore((s) => s.toggleHabitOptimistic);

  const [now, setNow] = useState<Date>(() => new Date());
  const [scratch, setScratch] = useState('');
  const [scratchSent, setScratchSent] = useState(false);
  const scratchRef = useRef<HTMLInputElement>(null);

  // Clock (10s tick is plenty for a glanceable e-ink display).
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, CLOCK_TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Dashboard data on mount, then a slow poll.
  useEffect(() => {
    fetchDashboardData();
    const id = setInterval(() => fetchDashboardData(), DATA_POLL_MS);
    return () => clearInterval(id);
  }, [fetchDashboardData]);

  // Restore the scratchpad buffer from a previous session.
  useEffect(() => {
    try {
      setScratch(localStorage.getItem(SCRATCH_KEY) ?? '');
    } catch {
      /* private mode — the buffer just stays in memory */
    }
  }, []);

  const handleForceSync = useCallback(async () => {
    if (useDashboardStore.getState().isSyncing) return;
    await syncNow();
  }, [syncNow]);

  const handleCycleContext = useCallback(() => {
    const current = useDashboardStore.getState().focusMode;
    const next = FOCUS_CYCLE[(FOCUS_CYCLE.indexOf(current) + 1) % FOCUS_CYCLE.length];
    setFocusMode(next);
  }, [setFocusMode]);

  // Physical hardware button listeners (reTerminal F1–F3 keys arrive as
  // standard keyboard events). Reads fresh state via getState() so the
  // handler never goes stale.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F1') {
        e.preventDefault();
        handleForceSync();
      } else if (e.key === 'F2') {
        e.preventDefault();
        handleCycleContext();
      } else if (e.key === 'F3') {
        e.preventDefault();
        scratchRef.current?.focus();
        scratchRef.current?.select();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleForceSync, handleCycleContext]);

  const updateScratch = (value: string) => {
    setScratch(value);
    try {
      localStorage.setItem(SCRATCH_KEY, value);
    } catch {
      /* ignore */
    }
  };

  // Send the buffer through the standard capture pipeline (quick note in the
  // Library), then clear it. Enter in the input submits too.
  const sendScratch = async () => {
    const text = scratch.trim();
    if (!text) return;
    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'LIBRARY',
          text,
          details: { title: text.split('\n')[0].slice(0, 50), tags: 'epaper,quick-note' },
        }),
      });
      if (res.ok) {
        updateScratch('');
        setScratchSent(true);
        setTimeout(() => setScratchSent(false), 2500);
      }
    } catch (err) {
      console.error('E-paper scratchpad capture failed:', err);
    }
  };

  // ── Content curation: strictly essential items for glanceability ─────────
  const openTasks = filterTasksByFocus(
    tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED'),
    focusMode
  );
  const topTasks = [...openTasks]
    .sort((a, b) => {
      if (a.isTop3 !== b.isTop3) return a.isTop3 ? -1 : 1;
      const pr = (PRIORITY_RANK[a.priority] ?? 2) - (PRIORITY_RANK[b.priority] ?? 2);
      if (pr !== 0) return pr;
      const ad = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY;
      const bd = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY;
      return ad - bd;
    })
    .slice(0, 4);

  const currentFocus = topTasks[0];
  const remainingTasks = topTasks.slice(1);

  const todayStr = todayISO();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const nextEvents = filterEventsByFocus(events, focusMode)
    .filter((e) => {
      const day = toISODate(e.date);
      if (day > todayStr) return true; // future days always qualify
      if (day < todayStr) return false;
      // Today: skip events already in progress / finished (untimed & all-day stay).
      const start = timeToMinutes(e.startTime);
      return start === null || start >= nowMinutes;
    })
    .slice(0, 2);

  const todayHabits = routines.filter((r) => r.isDueToday).slice(0, 3);

  const syncLabel = isSyncing
    ? 'SYNC: ...'
    : lastSyncedAt
      ? `SYNC: ${formatTimeHHMM(lastSyncedAt)}`
      : 'SYNC: ---';

  return (
    <div className="w-[800px] h-[480px] bg-white text-black p-3 font-mono selection:bg-black selection:text-white border-4 border-black box-border overflow-hidden grid grid-rows-[45px_1fr_35px] gap-2">
      {/* ── TOP BAR: SYSTEM STATUS ────────────────────────────────────────── */}
      <header className="flex items-center justify-between border-b-2 border-black pb-1 min-h-0">
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-black tracking-tighter">{formatTimeHHMM(now)}</span>
          <span className="text-xs font-bold uppercase tracking-wider">
            {formatWeekday(now).slice(0, 3).toUpperCase()} {formatDateDDMMYYYY(now)}
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="border border-black px-1.5 py-0.5">{syncLabel}</span>
          <span className="bg-black text-white px-2 py-0.5 uppercase tracking-wide">
            {FOCUS_LABELS[focusMode]} MODE
          </span>
        </div>
      </header>

      {/* ── MAIN CONTENT GRID (2 COLUMNS) ─────────────────────────────────── */}
      <main className="grid grid-cols-[450px_1fr] gap-3 overflow-hidden min-h-0">
        {/* LEFT COLUMN: FOCUS & TOP TASKS */}
        <section className="flex flex-col gap-2 border-r-2 border-black pr-3 overflow-hidden min-h-0">
          {/* Active Focus Hero Box */}
          <div className="bg-black text-white p-2.5 shrink-0">
            <div className="text-[10px] font-bold tracking-widest uppercase mb-0.5">
              &gt; CURRENT FOCUS
            </div>
            <div className="text-base font-bold truncate">
              {currentFocus ? currentFocus.title : 'No active focus set'}
            </div>
          </div>

          {/* Top Priority Tasks */}
          <div className="flex-1 flex flex-col justify-start overflow-hidden min-h-0">
            <div className="text-xs font-black uppercase tracking-wider mb-1 border-b border-black pb-0.5">
              Priority Tasks ({topTasks.length})
            </div>
            <ul className="space-y-1.5">
              {remainingTasks.map((task) => (
                <li
                  key={task.id}
                  onClick={() => toggleTaskOptimistic(task.id)}
                  className="flex items-start gap-2 cursor-pointer text-sm leading-tight"
                >
                  <span className="inline-block w-4 h-4 border border-black text-center leading-[14px] font-bold mt-0.5 shrink-0">
                    {task.status === 'DONE' ? 'X' : ''}
                  </span>
                  <span className="truncate flex-1 font-medium">{task.title}</span>
                </li>
              ))}
              {topTasks.length === 0 && (
                <li className="text-sm italic">Nothing open in this context.</li>
              )}
            </ul>
          </div>
        </section>

        {/* RIGHT COLUMN: AGENDA, HABITS & SCRATCHPAD */}
        <section className="flex flex-col justify-between overflow-hidden min-h-0 gap-2">
          {/* Upcoming Events */}
          <div className="overflow-hidden">
            <div className="text-xs font-black uppercase tracking-wider mb-1 border-b border-black pb-0.5">
              Next Up
            </div>
            {nextEvents.length > 0 ? (
              <ul className="space-y-1 text-xs">
                {nextEvents.map((event) => {
                  const day = toISODate(event.date);
                  const dayLabel =
                    day === todayStr ? 'TODAY' : day === addDayISO(todayStr, 1) ? 'TMRW' : formatDateDDMMYYYY(event.date);
                  return (
                    <li key={event.id} className="flex justify-between items-center gap-2 py-0.5">
                      <span className="font-bold truncate">{event.title}</span>
                      <span className="flex items-center gap-1 shrink-0">
                        {!isAllDay(event.startTime) && event.startTime && (
                          <span className="font-mono text-[10px]">{formatEventTime(event.startTime)}</span>
                        )}
                        <span className="border border-black px-1 font-mono text-[10px] uppercase">
                          {dayLabel}
                        </span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-xs italic">No upcoming events</div>
            )}
          </div>

          {/* Today Habits */}
          <div className="overflow-hidden">
            <div className="text-xs font-black uppercase tracking-wider mb-1 border-b border-black pb-0.5">
              Today Habits
            </div>
            <div className="flex gap-1.5">
              {todayHabits.map((habit) => (
                <button
                  key={habit.id}
                  onClick={() => toggleHabitOptimistic(habit.id, todayISO())}
                  className={`flex-1 text-[11px] font-bold border border-black py-1 px-1 truncate text-center ${
                    habit.isCompletedToday ? 'bg-black text-white' : 'bg-white text-black'
                  }`}
                >
                  {habit.isCompletedToday ? `[X] ${habit.title}` : habit.title}
                </button>
              ))}
              {todayHabits.length === 0 && (
                <span className="text-xs italic">No habits due today.</span>
              )}
            </div>
          </div>

          {/* Quick Buffer / Note (F3) */}
          <div className="border-2 border-black p-1.5 overflow-hidden">
            <div className="text-[10px] font-black uppercase tracking-wider mb-1 flex justify-between">
              <span>Scratchpad Buffer [F3]</span>
              {scratchSent && <span>Captured ✓</span>}
            </div>
            <div className="flex gap-1.5">
              <input
                ref={scratchRef}
                type="text"
                value={scratch}
                onChange={(e) => updateScratch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    sendScratch();
                  }
                }}
                placeholder="type a note, press Enter..."
                className="flex-1 min-w-0 border border-black px-1.5 py-0.5 text-xs bg-white text-black outline-none placeholder:text-black placeholder:italic"
              />
              <button
                onClick={sendScratch}
                disabled={!scratch.trim()}
                className="border border-black px-2 text-[10px] font-black uppercase bg-white text-black disabled:opacity-30"
              >
                Send
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* ── FOOTER: HARDWARE BUTTON LEGEND ───────────────────────────────── */}
      <footer className="border-t-2 border-black flex items-center justify-between text-[11px] font-bold pt-1 min-h-0">
        <button onClick={handleForceSync} className="px-1">
          [F1] Sync
        </button>
        <button onClick={handleCycleContext} className="px-1">
          [F2] Context
        </button>
        <button
          onClick={() => {
            scratchRef.current?.focus();
            scratchRef.current?.select();
          }}
          className="px-1"
        >
          [F3] Buffer
        </button>
      </footer>
    </div>
  );
}

/** Tomorrow's ISO date (kept local like the rest of the app's date handling). */
function addDayISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}
