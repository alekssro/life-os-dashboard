'use client';

import React, { useEffect, useMemo } from 'react';
import {
  Flame,
  CheckSquare,
  Square,
  ChevronLeft,
  ChevronRight,
  Calendar,
  Award,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { toISODate, formatDateYYYYMMDD, appDayStart } from '@/lib/date';
import { Routine } from '@/types';

export function HabitTracker() {
  const routines = useDashboardStore((s) => s.routines);
  const habitHistory = useDashboardStore((s) => s.habitHistory);
  const selectedDate = useDashboardStore((s) => s.selectedHabitDate);
  const setSelectedDate = useDashboardStore((s) => s.setSelectedHabitDate);
  const viewMode = useDashboardStore((s) => s.habitViewMode);
  const setViewMode = useDashboardStore((s) => s.setHabitViewMode);
  const toggleHabitOptimistic = useDashboardStore((s) => s.toggleHabitOptimistic);
  const loadHabitHistory = useDashboardStore((s) => s.loadHabitHistory);

  const todayStr = useMemo(() => toISODate(appDayStart()), []);

  useEffect(() => {
    loadHabitHistory();
  }, [loadHabitHistory]);

  // Compute date array based on viewMode (WEEK, MONTH, YEAR)
  const dateRange = useMemo(() => {
    const dates: string[] = [];
    const base = new Date(selectedDate || todayStr);

    let count = 7;
    if (viewMode === 'WEEK') count = 7;
    else if (viewMode === 'MONTH') count = 30;
    else if (viewMode === 'YEAR') count = 84; // 12 weeks representation for e-paper / low latency

    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(base);
      d.setDate(d.getDate() - i);
      dates.push(formatDateYYYYMMDD(d));
    }
    return dates;
  }, [selectedDate, todayStr, viewMode]);

  const handleStepDate = (direction: 'prev' | 'next') => {
    const curr = new Date(selectedDate || todayStr);
    const step = viewMode === 'WEEK' ? 7 : viewMode === 'MONTH' ? 30 : 90;
    curr.setDate(curr.getDate() + (direction === 'next' ? step : -step));
    setSelectedDate(formatDateYYYYMMDD(curr));
  };

  const isTodaySelected = selectedDate === todayStr;

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-4">
      {/* Header & View Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--paper-border)] pb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[var(--paper-accent)]" />
          <h2 className="font-bold text-base text-[var(--paper-text)]">Habits & Routine Matrix</h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Day / Week / Month / Year View Tabs */}
          <div className="flex rounded-md bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] p-0.5 text-xs">
            {(['WEEK', 'MONTH', 'YEAR'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  viewMode === mode
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
      </div>

      {/* Routine Rows with Daily Checkbox and Mini Commit Heatmap */}
      {routines.length === 0 ? (
        <div className="text-xs text-[var(--paper-muted)] italic py-4 text-center">
          No habits configured yet. Add habits in the Routines view.
        </div>
      ) : (
        <div className="space-y-3">
          {routines.map((routine) => {
            const isCompletedSelectedDay =
              selectedDate === todayStr
                ? !!routine.isCompletedToday
                : !!habitHistory[routine.id]?.[selectedDate];

            return (
              <div
                key={routine.id}
                className="p-2.5 rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] space-y-2 hover:border-[var(--paper-border-strong)] transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleHabitOptimistic(routine.id, selectedDate)}
                      className="text-[var(--paper-muted)] hover:text-[var(--paper-accent)] transition active:scale-90"
                      title={`Toggle completion for ${selectedDate}`}
                    >
                      {isCompletedSelectedDay ? (
                        <CheckSquare className="w-4 h-4 text-[var(--paper-accent)]" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <span className="text-sm font-medium text-[var(--paper-text)]">
                      {routine.icon} {routine.title}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono">
                    <span className="flex items-center gap-1 text-[var(--paper-accent)] font-bold">
                      <Flame className="w-3.5 h-3.5 fill-current" />
                      {routine.streak}d streak
                    </span>
                    <span className="text-[var(--paper-muted)] hidden sm:inline">
                      Best: {routine.bestStreak}d
                    </span>
                  </div>
                </div>

                {/* Github Commit-like Heatmap Grid */}
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
