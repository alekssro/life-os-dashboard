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
  CalendarDays,
  Calendar,
  CalendarRange,
} from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import {
  toISODate,
  formatDateYYYYMMDD,
  formatDateDDMMYYYY,
  formatDateDDMMShort,
  formatMonthYear,
  appDayStart,
  addMonthsClamped,
  addYearsClamped,
  getMonthStart,
  getWeekStart,
  getWeekEnd,
  monthDatesISO,
  parseISODateLocal,
  weekDatesISO,
  weekStartsInMonth,
  weekStartsByMonthInYear,
} from '@/lib/date';
import { dueDateInMonth, firstDueDateInWeek } from '@/lib/routines';
import { Routine } from '@/types';
import { EditRoutineModal } from '@/components/EditRoutineModal';
import { CalendarDateInput } from '@/components/CalendarDateInput';

type ViewMode = 'WEEK' | 'MONTH' | 'YEAR';

interface HabitTrackerProps {
  title?: string;
  isTodayOnly?: boolean; // When true, filters habits strictly to those due today
  allowYearlyView?: boolean; // When false, the daily group offers no yearly overview
  showControls?: boolean; // When false, groups show their default view without controls
  onEditHabit?: (habitId: string) => void;
}

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTH_LABELS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

const DAILY_VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'WEEK', label: 'Week' },
  { id: 'MONTH', label: 'Month' },
  { id: 'YEAR', label: 'Year' },
];

const WEEKLY_VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'MONTH', label: 'Month' },
  { id: 'YEAR', label: 'Year' },
];

const MONTHLY_VIEWS: { id: ViewMode; label: string }[] = [{ id: 'YEAR', label: 'Year' }];

/** Moves the anchor of a group by one step of its current view. */
function stepAnchor(anchor: string, view: ViewMode, direction: 1 | -1): string {
  const date = parseISODateLocal(anchor);
  if (view === 'WEEK') {
    date.setDate(date.getDate() + 7 * direction);
  } else if (view === 'MONTH') {
    return formatDateYYYYMMDD(addMonthsClamped(date, direction));
  } else {
    return formatDateYYYYMMDD(addYearsClamped(date, direction));
  }
  return formatDateYYYYMMDD(date);
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
  const toggleHabitOptimistic = useDashboardStore((s) => s.toggleHabitOptimistic);
  const loadHabitHistory = useDashboardStore((s) => s.loadHabitHistory);
  const setHabitHistoryRange = useDashboardStore((s) => s.setHabitHistoryRange);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const [modalEditingId, setModalEditingId] = useState<string | null>(null);

  const todayStr = useMemo(() => toISODate(appDayStart()), []);

  // Every group keeps its own view and its own anchor date, so each frequency
  // can be browsed at its natural granularity.
  const [dailyView, setDailyView] = useState<ViewMode>('WEEK');
  const [weeklyView, setWeeklyView] = useState<ViewMode>('MONTH');
  const [dailyAnchor, setDailyAnchor] = useState(todayStr);
  const [weeklyAnchor, setWeeklyAnchor] = useState(todayStr);
  const [monthlyAnchor, setMonthlyAnchor] = useState(todayStr);

  /* ------------------------------------------------------------------ */
  /* Grouping                                                            */
  /* ------------------------------------------------------------------ */

  const visibleRoutines = useMemo(
    () => (isTodayOnly ? routines.filter((r) => r.isDueToday) : routines),
    [routines, isTodayOnly]
  );

  const dailyRoutines = visibleRoutines.filter((r) => (r.frequency || 'DAILY') === 'DAILY');
  const weeklyRoutines = visibleRoutines.filter((r) => r.frequency === 'WEEKLY');
  const monthlyRoutines = visibleRoutines.filter((r) => r.frequency === 'MONTHLY');

  const morningRoutines = dailyRoutines.filter((r) => r.timeOfDay === 'MORNING');
  const afternoonRoutines = dailyRoutines.filter((r) => r.timeOfDay === 'AFTERNOON');
  const eveningRoutines = dailyRoutines.filter((r) => r.timeOfDay === 'EVENING');

  /* ------------------------------------------------------------------ */
  /* Windows                                                             */
  /* ------------------------------------------------------------------ */

  // Daily — week view: the seven days of the anchor's week.
  const dailyWeek = useMemo(() => {
    const start = getWeekStart(parseISODateLocal(dailyAnchor));
    const end = getWeekEnd(parseISODateLocal(dailyAnchor));
    return {
      dates: weekDatesISO(parseISODateLocal(dailyAnchor)),
      label: `${formatDateDDMMShort(start)} – ${formatDateDDMMShort(end)}`,
    };
  }, [dailyAnchor]);

  // Daily — month view: the days of the anchor's month as a calendar grid.
  const dailyMonth = useMemo(() => {
    const anchor = parseISODateLocal(dailyAnchor);
    const first = getMonthStart(anchor);
    const leading = (first.getDay() + 6) % 7; // Monday-first offset
    const cells: (string | null)[] = [
      ...new Array<string | null>(leading).fill(null),
      ...monthDatesISO(anchor),
    ];
    while (cells.length % 7 !== 0) cells.push(null);

    const rows: (string | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

    return { rows, label: formatMonthYear(anchor) };
  }, [dailyAnchor]);

  // Daily — year view: every week of the anchor's calendar year.
  const dailyYear = useMemo(() => {
    const anchor = parseISODateLocal(dailyAnchor);
    const year = anchor.getFullYear();
    const start = getWeekStart(new Date(year, 0, 1));
    const end = new Date(year, 11, 31);
    const days = Math.round((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)) + 1;
    const totalWeeks = Math.ceil(days / 7);

    const weeks: string[][] = [];
    const current = new Date(start);
    for (let w = 0; w < totalWeeks; w++) {
      const week: string[] = [];
      for (let d = 0; d < 7; d++) {
        week.push(formatDateYYYYMMDD(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }

    return { weeks, label: String(year) };
  }, [dailyAnchor]);

  // Weekly — month view: the 4-5 weeks that begin inside the anchor's month.
  const weeklyMonth = useMemo(() => {
    const anchor = parseISODateLocal(weeklyAnchor);
    return {
      weeks: weekStartsInMonth(anchor),
      label: formatMonthYear(anchor),
    };
  }, [weeklyAnchor]);

  // Weekly — year view: the weeks of every month of the anchor's year.
  const weeklyYear = useMemo(() => {
    const year = parseISODateLocal(weeklyAnchor).getFullYear();
    return { months: weekStartsByMonthInYear(year), label: String(year) };
  }, [weeklyAnchor]);

  // Monthly — year view: the twelve months of the anchor's year.
  const monthlyYear = useMemo(() => {
    const year = parseISODateLocal(monthlyAnchor).getFullYear();
    return { year, label: String(year) };
  }, [monthlyAnchor]);

  // The history has to cover every window the matrices can show: whole months
  // and years, future-dated cells and the years the user navigates to.
  const historyRange = useMemo(() => {
    const years = [dailyAnchor, weeklyAnchor, monthlyAnchor].map((a) =>
      parseISODateLocal(a).getFullYear()
    );
    const minYear = Math.min(...years) - 1;
    const maxYear = Math.max(...years) + 1;
    return {
      start: formatDateYYYYMMDD(new Date(minYear, 0, 1)),
      end: formatDateYYYYMMDD(new Date(maxYear, 11, 31)),
    };
  }, [dailyAnchor, weeklyAnchor, monthlyAnchor]);

  useEffect(() => {
    setHabitHistoryRange(historyRange);
    loadHabitHistory(historyRange.start, historyRange.end);
  }, [historyRange, loadHabitHistory, setHabitHistoryRange]);

  /* ------------------------------------------------------------------ */
  /* Helpers                                                             */
  /* ------------------------------------------------------------------ */

  const isDoneOn = (routine: Routine, date: string) =>
    date === todayStr
      ? !!routine.isCompletedToday
      : !!habitHistory[routine.id]?.[date];

  /**
   * The date a habit is logged on for the period that is currently open:
   * today for daily habits, the first scheduled day of the current week for
   * weekly habits and its day-of-month for monthly ones.
   */
  const currentLogDate = (routine: Routine): string => {
    if (routine.frequency === 'WEEKLY') {
      return formatDateYYYYMMDD(
        firstDueDateInWeek(routine, getWeekStart(appDayStart()))
      );
    }
    if (routine.frequency === 'MONTHLY') {
      return formatDateYYYYMMDD(dueDateInMonth(routine, getMonthStart(appDayStart())));
    }
    return todayStr;
  };

  const toggle = (routine: Routine, date: string) => toggleHabitOptimistic(routine.id, date);

  const handleSaveModalEdit = async (id: string, updates: any) => {
    await fetch('/api/routines', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setModalEditingId(null);
    fetchDashboardData();
  };

  /* ------------------------------------------------------------------ */
  /* Matrices                                                            */
  /* ------------------------------------------------------------------ */

  const dailyMatrix = (routine: Routine) => {
    if (dailyView === 'MONTH') {
      return (
        <div className="grid grid-cols-7 gap-1">
          {dailyMonth.rows.map((row, rowIndex) =>
            row.map((date, colIndex) =>
              date ? (
                <MatrixCell
                  key={date}
                  done={isDoneOn(routine, date)}
                  isToday={date === todayStr}
                  title={`${formatDateDDMMYYYY(date)}: ${isDoneOn(routine, date) ? 'Completed' : 'Missed'}`}
                  onClick={() => toggle(routine, date)}
                  className="w-4 h-4"
                />
              ) : (
                <span key={`${rowIndex}-${colIndex}`} className="w-4 h-4" />
              )
            )
          )}
        </div>
      );
    }

    if (dailyView === 'YEAR') {
      return (
        <div className="flex items-start gap-1.5">
          <div className="flex flex-col gap-1 pr-1 text-[8px] font-mono text-[var(--paper-muted)] select-none">
            {DAY_LABELS.map((label, i) => (
              <span key={i} className="h-2.5 flex items-center leading-none">
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-start gap-1">
            {dailyYear.weeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((date) => (
                  <MatrixCell
                    key={date}
                    done={isDoneOn(routine, date)}
                    isToday={date === todayStr}
                    title={`${formatDateDDMMYYYY(date)}: ${isDoneOn(routine, date) ? 'Completed' : 'Missed'}`}
                    onClick={() => toggle(routine, date)}
                    className="w-2.5 h-2.5"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Week view (default)
    return (
      <div className="flex items-center gap-1.5">
        {dailyWeek.dates.map((date) => (
          <MatrixCell
            key={date}
            done={isDoneOn(routine, date)}
            isToday={date === todayStr}
            title={`${formatDateDDMMYYYY(date)}: ${isDoneOn(routine, date) ? 'Completed' : 'Missed'} (Click to toggle)`}
            onClick={() => toggle(routine, date)}
            className="w-6 h-6"
          />
        ))}
      </div>
    );
  };

  const weeklyMatrix = (routine: Routine) => {
    if (weeklyView === 'YEAR') {
      return (
        <div className="flex items-start gap-1.5">
          <div className="flex flex-col gap-1 pr-1 text-[8px] font-mono text-[var(--paper-muted)] select-none">
            {MONTH_LABELS.map((label, i) => (
              <span key={i} className="h-4 flex items-center leading-none">
                {label}
              </span>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            {weeklyYear.months.map((weeks, monthIndex) => (
              <div key={monthIndex} className="flex gap-1">
                {Array.from({ length: 5 }).map((_, weekIndex) => {
                  const weekStart = weeks[weekIndex];
                  if (!weekStart) {
                    return <span key={weekIndex} className="w-4 h-4" />;
                  }
                  const logDate = formatDateYYYYMMDD(
                    firstDueDateInWeek(routine, weekStart)
                  );
                  const done = isDoneOn(routine, logDate);
                  return (
                    <MatrixCell
                      key={logDate}
                      done={done}
                      title={`Week of ${formatDateDDMMShort(weekStart)}: ${done ? 'Completed' : 'Missed'} (Click to toggle)`}
                      onClick={() => toggle(routine, logDate)}
                      className="w-4 h-4"
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      );
    }

    // Month view (default): one square per week that begins in the month.
    return (
      <div className="flex items-center gap-1.5">
        {weeklyMonth.weeks.map((weekStart) => {
          const logDate = formatDateYYYYMMDD(firstDueDateInWeek(routine, weekStart));
          const done = isDoneOn(routine, logDate);
          return (
            <MatrixCell
              key={logDate}
              done={done}
              title={`Week of ${formatDateDDMMShort(weekStart)}: ${done ? 'Completed' : 'Missed'} (Click to toggle)`}
              onClick={() => toggle(routine, logDate)}
              className="w-7 h-7 text-[9px]"
              label={String(weekStart.getDate())}
            />
          );
        })}
      </div>
    );
  };

  const monthlyMatrix = (routine: Routine) => {
    const year = monthlyYear.year;
    return (
      <div className="flex items-center gap-1.5">
        {MONTH_LABELS.map((label, monthIndex) => {
          const monthStart = new Date(year, monthIndex, 1);
          const logDate = formatDateYYYYMMDD(dueDateInMonth(routine, monthStart));
          const done = isDoneOn(routine, logDate);
          return (
            <MatrixCell
              key={logDate}
              done={done}
              title={`${formatMonthYear(monthStart)}: ${done ? 'Completed' : 'Missed'} (Click to toggle)`}
              onClick={() => toggle(routine, logDate)}
              className="w-7 h-7 text-[9px]"
              label={String(monthIndex + 1)}
            />
          );
        })}
      </div>
    );
  };

  /* ------------------------------------------------------------------ */
  /* Rows                                                                */
  /* ------------------------------------------------------------------ */

  const renderHabitRow = (routine: Routine, matrix: React.ReactNode) => {
    const logDate = currentLogDate(routine);
    const isDone = isDoneOn(routine, logDate);

    return (
      <div
        key={routine.id}
        className="flex items-center gap-3 py-1 border-b border-[var(--paper-border)] last:border-b-0"
      >
        {/* Left: identity */}
        <div className="flex items-center gap-2 min-w-[120px] flex-1">
          <button
            type="button"
            onClick={() => toggleHabitOptimistic(routine.id, logDate)}
            className="text-[var(--paper-muted)] hover:text-[var(--paper-accent)] transition active:scale-90 shrink-0"
            title={`Toggle completion for ${formatDateDDMMYYYY(logDate)}`}
          >
            {isDone ? (
              <CheckSquare className="w-4 h-4 text-[var(--paper-accent)]" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>

          <span
            onClick={() => {
              if (onEditHabit) onEditHabit(routine.id);
              else setModalEditingId(routine.id);
            }}
            className="text-xs sm:text-sm font-medium text-[var(--paper-text)] truncate min-w-0 cursor-pointer hover:text-[var(--paper-accent)] transition"
            title="Click to edit habit"
          >
            {routine.icon} {routine.title}
          </span>

          <span className="flex items-center gap-2 text-xs font-mono shrink-0 ml-auto">
            <span className="flex items-center gap-1 text-[var(--paper-accent)] font-bold">
              <Flame className="w-3.5 h-3.5 fill-current" />
              {routine.streak}d
            </span>
            <span className="text-[var(--paper-muted)] hidden sm:inline">
              Best: {routine.bestStreak}d
            </span>
          </span>
        </div>

        {/* Right: matrix */}
        <div className="shrink-0">{matrix}</div>
      </div>
    );
  };

  const renderSlotHeader = (icon: React.ReactNode, label: string, count: number) => (
    <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--paper-muted)] pt-2">
      {icon}
      <span>
        {label} ({count})
      </span>
    </div>
  );

  const renderColumnLabels = (labels: string[], cellClass: string, gapClass = 'gap-1.5') => (
    <div className="flex items-center gap-3">
      <div className="flex-1" />
      <div className={`shrink-0 flex items-center ${gapClass}`}>
        {labels.map((label, i) => (
          <span
            key={`${label}-${i}`}
            className={`${cellClass} flex items-center justify-center text-[9px] font-mono text-[var(--paper-muted)]`}
          >
            {label}
          </span>
        ))}
      </div>
    </div>
  );

  const dailyViews = allowYearlyView ? DAILY_VIEWS : DAILY_VIEWS.filter((v) => v.id !== 'YEAR');

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-3">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-[var(--paper-accent)]" />
          <h2 className="font-bold text-base text-[var(--paper-text)]">{title}</h2>
          {isTodayOnly && (
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] text-[var(--paper-muted)]">
              Due Today ({visibleRoutines.length})
            </span>
          )}
        </div>
      </div>

      {/* ============================================================== */}
      {/* DAILY HABITS — week view by default, month and year overviews    */}
      {/* ============================================================== */}
      {dailyRoutines.length > 0 && (
        <div className="space-y-1">
          <GroupHeader
            icon={<CalendarDays className="w-4 h-4" />}
            label="Daily"
            count={dailyRoutines.length}
            periodLabel={dailyView === 'YEAR' ? dailyYear.label : dailyView === 'MONTH' ? dailyMonth.label : dailyWeek.label}
            views={dailyViews}
            view={dailyView}
            onViewChange={(view) => setDailyView(view)}
            anchor={dailyAnchor}
            onAnchorChange={setDailyAnchor}
            showControls={showControls}
          />

          {dailyView === 'WEEK' && renderColumnLabels(DAY_LABELS, 'w-6 h-6')}
          {dailyView === 'MONTH' && renderColumnLabels(DAY_LABELS, 'w-4 h-4', 'gap-1')}

          <div className="overflow-x-auto">
            {morningRoutines.length > 0 && (
              <div className="space-y-0.5">
                {renderSlotHeader(<Sun className="w-3.5 h-3.5 text-amber-500" />, 'Morning', morningRoutines.length)}
                {morningRoutines.map((r) => renderHabitRow(r, dailyMatrix(r)))}
              </div>
            )}

            {afternoonRoutines.length > 0 && (
              <div className="space-y-0.5">
                {renderSlotHeader(
                  <Sunset className="w-3.5 h-3.5 text-orange-500" />,
                  'Afternoon',
                  afternoonRoutines.length
                )}
                {afternoonRoutines.map((r) => renderHabitRow(r, dailyMatrix(r)))}
              </div>
            )}

            {eveningRoutines.length > 0 && (
              <div className="space-y-0.5">
                {renderSlotHeader(<Moon className="w-3.5 h-3.5 text-indigo-400" />, 'Evening', eveningRoutines.length)}
                {eveningRoutines.map((r) => renderHabitRow(r, dailyMatrix(r)))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* WEEKLY HABITS — month view (one square per week) by default      */}
      {/* ============================================================== */}
      {weeklyRoutines.length > 0 && (
        <div className="space-y-1">
          <GroupHeader
            icon={<Calendar className="w-4 h-4" />}
            label="Weekly"
            count={weeklyRoutines.length}
            periodLabel={weeklyView === 'YEAR' ? weeklyYear.label : weeklyMonth.label}
            views={WEEKLY_VIEWS}
            view={weeklyView}
            onViewChange={(view) => setWeeklyView(view)}
            anchor={weeklyAnchor}
            onAnchorChange={setWeeklyAnchor}
            showControls={showControls}
          />

          {weeklyView === 'MONTH' &&
            renderColumnLabels(
              weeklyMonth.weeks.map((w) => String(w.getDate())),
              'w-7 h-7'
            )}

          <div className="overflow-x-auto">
            {weeklyRoutines.map((r) => renderHabitRow(r, weeklyMatrix(r)))}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MONTHLY HABITS — year view (one square per month)                */}
      {/* ============================================================== */}
      {monthlyRoutines.length > 0 && (
        <div className="space-y-1">
          <GroupHeader
            icon={<CalendarRange className="w-4 h-4" />}
            label="Monthly"
            count={monthlyRoutines.length}
            periodLabel={monthlyYear.label}
            views={MONTHLY_VIEWS}
            view="YEAR"
            onViewChange={() => {}}
            anchor={monthlyAnchor}
            onAnchorChange={setMonthlyAnchor}
            showControls={showControls}
          />

          {renderColumnLabels(MONTH_LABELS, 'w-7 h-7')}

          <div className="overflow-x-auto">
            {monthlyRoutines.map((r) => renderHabitRow(r, monthlyMatrix(r)))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {visibleRoutines.length === 0 && (
        <div className="text-xs text-[var(--paper-muted)] italic py-4 text-center">
          {isTodayOnly
            ? 'No habits scheduled for today. Enjoy your day!'
            : 'No habits configured yet.'}
        </div>
      )}

      {/* Pop-up Edit Modal */}
      <EditRoutineModal
        routine={routines.find((r) => r.id === modalEditingId) || null}
        isOpen={Boolean(modalEditingId)}
        onClose={() => setModalEditingId(null)}
        onSave={handleSaveModalEdit}
      />
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* Group header: title, view switch and date navigator                   */
/* -------------------------------------------------------------------- */

function GroupHeader({
  icon,
  label,
  count,
  periodLabel,
  views,
  view,
  onViewChange,
  anchor,
  onAnchorChange,
  showControls,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  periodLabel: string;
  views: { id: ViewMode; label: string }[];
  view: ViewMode;
  onViewChange: (view: ViewMode) => void;
  anchor: string;
  onAnchorChange: (iso: string) => void;
  showControls: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-[var(--paper-accent)] shrink-0">{icon}</span>
        <span className="text-xs font-bold uppercase tracking-wider text-[var(--paper-text)]">
          {label} ({count})
        </span>
        <span className="text-[10px] font-mono text-[var(--paper-muted)] truncate">{periodLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        {showControls && views.length > 1 && (
          <div className="flex rounded-md bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] p-0.5 text-xs">
            {views.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => onViewChange(option.id)}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                  view === option.id
                    ? 'bg-[var(--paper-card)] text-[var(--paper-text)] shadow-xs border border-[var(--paper-border-strong)]'
                    : 'text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        {showControls && (
          <div className="flex items-center gap-1 border border-[var(--paper-border)] rounded-md px-1 py-0.5 text-xs bg-[var(--paper-card-subtle)]">
            <button
              type="button"
              onClick={() => onAnchorChange(stepAnchor(anchor, view, -1))}
              className="p-1 hover:text-[var(--paper-accent)] transition"
              title="Previous period"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <CalendarDateInput
              value={anchor}
              onChange={(iso) => onAnchorChange(iso)}
              popupAlign="right"
              className="bg-transparent text-[11px] font-mono text-[var(--paper-text)] outline-none cursor-pointer w-[78px]"
            />
            <button
              type="button"
              onClick={() => onAnchorChange(stepAnchor(anchor, view, 1))}
              className="p-1 hover:text-[var(--paper-accent)] transition"
              title="Next period"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------- */
/* A single matrix cell                                                 */
/* -------------------------------------------------------------------- */

function MatrixCell({
  done,
  isToday,
  title,
  onClick,
  className,
  label,
}: {
  done: boolean;
  isToday?: boolean;
  title: string;
  onClick: () => void;
  className: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`${className} rounded-xs transition-all border flex items-center justify-center font-mono ${
        done
          ? 'bg-[var(--paper-accent)] border-[var(--paper-accent)] text-white'
          : 'bg-[var(--paper-card)] border-[var(--paper-border)] hover:border-[var(--paper-border-strong)]'
      } ${isToday ? 'ring-1 ring-[var(--paper-accent)]' : ''}`}
    >
      {label}
    </button>
  );
}
