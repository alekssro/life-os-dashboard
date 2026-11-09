'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  Flame,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Sun,
  Sunset,
  Moon,
  Pencil,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { toISODate, formatDateYYYYMMDD, appDayStart } from '@/lib/date';
import { Routine } from '@/types';
import { EditRoutinePanel } from '@/components/EditRoutinePanel';

interface HabitTrackerProps {
  title?: string;
  isTodayOnly?: boolean; // When true, filters habits strictly to those due today
  allowYearlyView?: boolean; // When false, only WEEK and MONTH are allowed
  showControls?: boolean;
  onEditHabit?: (habitId: string) => void;
}

export function HabitTracker({
  title = 'Habits',
  isTodayOnly = false,
  allowYearlyView = false,
  showControls = true,
  onEditHabit,
}: HabitTrackerProps) {
  const routines = useDashboardStore((s) => s.routines);
  const habitHistory = useDashboardStore((s) => s.habitHistory);
  const selectedDate = useDashboardStore((s) => s.selectedHabitDate);
  const setSelectedDate = useDashboardStore((s) => s.setSelectedHabitDate);
  const globalViewMode = useDashboardStore((s) => s.habitViewMode);
  const setGlobalViewMode = useDashboardStore((s) => s.setHabitViewMode);
  const toggleHabitOptimistic = useDashboardStore((s) => s.toggleHabitOptimistic);
  const loadHabitHistory = useDashboardStore((s) => s.loadHabitHistory);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const [inlineEditingId, setInlineEditingId] = useState<string | null>(null);

  const todayStr = useMemo(() => toISODate(appDayStart()), []);

  // In Today view where yearly view is disallowed, fall back to WEEK or MONTH
  const activeViewMode = !allowYearlyView && globalViewMode === 'YEAR' ? 'MONTH' : globalViewMode;

  useEffect(() => {
    loadHabitHistory();
  }, [loadHabitHistory]);

  // Date range for WEEK & MONTH (horizontal strip)
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const base = new Date(selectedDate || todayStr);
    const count = activeViewMode === 'WEEK' ? 7 : 30;

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      dates.push(formatDateYYYYMMDD(d));
    }
    return dates;
  }, [selectedDate, todayStr, activeViewMode]);

  // Date grid for YEAR (GitHub 7 rows: Mon-Sun, 52 columns: weeks)
  const yearlyGrid = useMemo(() => {
    if (activeViewMode !== 'YEAR') return null;

    // Anchor on the end of the current week (Sunday)
    const end = new Date(selectedDate || todayStr);
    const dayOfWeek = (end.getDay() + 6) % 7; // 0 = Mon, 6 = Sun
    end.setDate(end.getDate() + (6 - dayOfWeek));

    // 52 weeks = 364 days
    const totalDays = 52 * 7;
    const start = new Date(end);
    start.setDate(start.getDate() - (totalDays - 1));

    // Array of 52 weeks, each with 7 days (Mon=0..Sun=6)
    const weeks: string[][] = [];
    let curr = new Date(start);

    for (let w = 0; w < 52; w++) {
      const weekDays: string[] = [];
      for (let d = 0; d < 7; d++) {
        weekDays.push(formatDateYYYYMMDD(curr));
        curr.setDate(curr.getDate() + 1);
      }
      weeks.push(weekDays);
    }
    return weeks;
  }, [selectedDate, todayStr, activeViewMode]);

  const handleStepDate = (direction: 'prev' | 'next') => {
    const curr = new Date(selectedDate || todayStr);
    const step = activeViewMode === 'WEEK' ? 7 : activeViewMode === 'MONTH' ? 30 : 90;
    curr.setDate(curr.getDate() + (direction === 'next' ? step : -step));
    setSelectedDate(formatDateYYYYMMDD(curr));
  };

  const handleSaveInlineEdit = async (id: string, updates: any) => {
    await fetch('/api/routines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setInlineEditingId(null);
    fetchDashboardData();
  };

  // Filter routines if isTodayOnly is requested
  const visibleRoutines = useMemo(() => {
    if (!isTodayOnly) return routines;
    return routines.filter((r) => r.isDueToday);
  }, [routines, isTodayOnly]);

  // Segment routines into Morning, Afternoon, Evening
  const morningRoutines = visibleRoutines.filter((r) => r.timeOfDay === 'MORNING');
  const afternoonRoutines = visibleRoutines.filter((r) => r.timeOfDay === 'AFTERNOON');
  const eveningRoutines = visibleRoutines.filter((r) => r.timeOfDay === 'EVENING');

  const renderRoutineRow = (routine: Routine) => {
    const isCompletedSelectedDay =
      selectedDate === todayStr
        ? !!routine.isCompletedToday
        : !!habitHistory[routine.id]?.[selectedDate];

    const isEditingThis = inlineEditingId === routine.id;

    return (
      <div
        key={routine.id}
        className="p-2.5 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] space-y-2 hover:border-[var(--paper-border-strong)] transition"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => toggleHabitOptimistic(routine.id, selectedDate)}
              className="text-[var(--paper-muted)] hover:text-[var(--paper-accent)] transition active:scale-90 shrink-0"
              title={`Toggle completion for ${selectedDate}`}
            >
              {isCompletedSelectedDay ? (
                <CheckSquare className="w-4 h-4 text-[var(--paper-accent)]" />
              ) : (
                <Square className="w-4 h-4" />
              )}
            </button>
            <span
              onClick={() => {
                if (onEditHabit) onEditHabit(routine.id);
                else setInlineEditingId(isEditingThis ? null : routine.id);
              }}
              className="text-xs sm:text-sm font-medium text-[var(--paper-text)] truncate cursor-pointer hover:text-[var(--paper-accent)] transition"
              title="Click to edit habit"
            >
              {routine.icon} {routine.title}
            </span>
            <button
              type="button"
              onClick={() => {
                if (onEditHabit) onEditHabit(routine.id);
                else setInlineEditingId(isEditingThis ? null : routine.id);
              }}
              className="text-[var(--paper-muted)] hover:text-[var(--paper-text)] p-0.5 opacity-60 hover:opacity-100 transition"
              title="Edit habit"
            >
              <Pencil className="w-3 h-3" />
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono shrink-0">
            <span className="flex items-center gap-1 text-[var(--paper-accent)] font-bold">
              <Flame className="w-3.5 h-3.5 fill-current" />
              {routine.streak}d
            </span>
            <span className="text-[var(--paper-muted)] hidden sm:inline">
              Best: {routine.bestStreak}d
            </span>
          </div>
        </div>

        {/* View Mode: WEEK or MONTH horizontal strip */}
        {activeViewMode !== 'YEAR' && (
          <div className="flex items-center gap-1 overflow-x-auto py-1">
            {dateRange.map((dStr) => {
              const isDone =
                dStr === todayStr
                  ? !!routine.isCompletedToday
                  : !!habitHistory[routine.id]?.[dStr];
              const isSelected = dStr === selectedDate;

              return (
                <button
                  key={dStr}
                  type="button"
                  onClick={() => {
                    setSelectedDate(dStr);
                    toggleHabitOptimistic(routine.id, dStr);
                  }}
                  title={`${dStr}: ${isDone ? 'Completed' : 'Missed'} (Click to toggle)`}
                  className={`w-3.5 h-3.5 rounded-xs transition-all border ${
                    isSelected ? 'ring-2 ring-[var(--paper-accent)] ring-offset-1' : ''
                  } ${
                    isDone
                      ? 'bg-[var(--paper-accent)] border-[var(--paper-accent)]'
                      : 'bg-[var(--paper-card)] border-[var(--paper-border)] hover:border-[var(--paper-border-strong)]'
                  }`}
                />
              );
            })}
          </div>
        )}

        {/* View Mode: YEAR multi-line GitHub commit matrix (7 rows Mon-Sun, 52 cols) */}
        {activeViewMode === 'YEAR' && yearlyGrid && (
          <div className="pt-1.5 overflow-x-auto">
            <div className="flex items-start gap-1.5">
              {/* Day Labels precisely matched to the 7 rows */}
              <div className="flex flex-col gap-1 pr-1 text-[8px] font-mono text-[var(--paper-muted)] select-none">
                <span className="h-2.5 flex items-center leading-none">M</span>
                <span className="h-2.5 flex items-center leading-none">T</span>
                <span className="h-2.5 flex items-center leading-none">W</span>
                <span className="h-2.5 flex items-center leading-none">T</span>
                <span className="h-2.5 flex items-center leading-none">F</span>
                <span className="h-2.5 flex items-center leading-none">S</span>
                <span className="h-2.5 flex items-center leading-none">S</span>
              </div>
              {/* 52-week columns, each exactly 7 items arranged vertically */}
              <div className="flex items-start gap-1">
                {yearlyGrid.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((dStr) => {
                      const isDone =
                        dStr === todayStr
                          ? !!routine.isCompletedToday
                          : !!habitHistory[routine.id]?.[dStr];
                      const isSelected = dStr === selectedDate;

                      return (
                        <button
                          key={dStr}
                          type="button"
                          onClick={() => {
                            setSelectedDate(dStr);
                            toggleHabitOptimistic(routine.id, dStr);
                          }}
                          title={`${dStr}: ${isDone ? 'Completed' : 'Missed'} (Click to toggle)`}
                          className={`w-2.5 h-2.5 rounded-xs transition-all border block ${
                            isSelected ? 'ring-1 ring-[var(--paper-accent)]' : ''
                          } ${
                            isDone
                              ? 'bg-[var(--paper-accent)] border-[var(--paper-accent)]'
                              : 'bg-[var(--paper-card)] border-[var(--paper-border)] hover:border-[var(--paper-border-strong)]'
                          }`}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Inline Edit Panel when expanded */}
        {isEditingThis && (
          <div className="mt-2 pt-2 border-t border-[var(--paper-border)]">
            <EditRoutinePanel
              routine={routine}
              onSave={(updates) => handleSaveInlineEdit(routine.id, updates)}
              onCancel={() => setInlineEditingId(null)}
            />
          </div>
        )}
      </div>
    );
  };

  const availableViewModes = allowYearlyView
    ? (['WEEK', 'MONTH', 'YEAR'] as const)
    : (['WEEK', 'MONTH'] as const);

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-4">
      {/* Header & View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--paper-border)] pb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[var(--paper-accent)]" />
          <h2 className="font-bold text-base text-[var(--paper-text)]">{title}</h2>
          {isTodayOnly && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] text-[var(--paper-muted)]">
              Due Today ({visibleRoutines.length})
            </span>
          )}
        </div>

        {showControls && (
          <div className="flex items-center gap-2">
            {/* View Mode Tabs */}
            <div className="flex rounded-md bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] p-0.5 text-xs">
              {availableViewModes.map((mode) => (
                <button
                  key={mode}
                  onClick={() => setGlobalViewMode(mode)}
                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                    activeViewMode === mode
                      ? 'bg-[var(--paper-card)] text-[var(--paper-text)] shadow-xs border border-[var(--paper-border-strong)]'
                      : 'text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>

            {/* Date Navigator */}
            <div className="flex items-center gap-1 border border-[var(--paper-border)] rounded-md px-1 py-0.5 text-xs bg-[var(--paper-card-subtle)]">
              <button
                onClick={() => handleStepDate('prev')}
                className="p-1 hover:text-[var(--paper-accent)]"
                title="Previous period"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-transparent text-[11px] font-mono text-[var(--paper-text)] outline-none cursor-pointer"
              />
              <button
                onClick={() => handleStepDate('next')}
                className="p-1 hover:text-[var(--paper-accent)]"
                title="Next period"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Routine Sections Grouped by Morning / Afternoon / Evening */}
      {visibleRoutines.length === 0 ? (
        <div className="text-xs text-[var(--paper-muted)] italic py-4 text-center">
          {isTodayOnly
            ? 'No habits scheduled for today. Enjoy your day!'
            : 'No habits configured yet.'}
        </div>
      ) : (
        <div className="space-y-4">
          {morningRoutines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--paper-muted)]">
                <Sun className="w-3.5 h-3.5 text-amber-500" />
                <span>Morning ({morningRoutines.length})</span>
              </div>
              <div className="space-y-2">{morningRoutines.map(renderRoutineRow)}</div>
            </div>
          )}

          {afternoonRoutines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--paper-muted)]">
                <Sunset className="w-3.5 h-3.5 text-orange-500" />
                <span>Afternoon ({afternoonRoutines.length})</span>
              </div>
              <div className="space-y-2">{afternoonRoutines.map(renderRoutineRow)}</div>
            </div>
          )}

          {eveningRoutines.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[var(--paper-muted)]">
                <Moon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Evening ({eveningRoutines.length})</span>
              </div>
              <div className="space-y-2">{eveningRoutines.map(renderRoutineRow)}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
