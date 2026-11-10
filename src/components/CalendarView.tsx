'use client';

import React, { useMemo, useState } from 'react';
import {
  Calendar as CalendarIcon,
  MapPin,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Event } from '@/types';
import { useDashboardStore } from '@/store/useDashboardStore';
import { filterEventsByFocus } from '@/lib/focusFilter';
import {
  appDayStart,
  formatDateDDMMYYYY,
  formatDateYYYYMMDD,
  formatWeekday,
  getWeekEnd,
  getWeekStart,
  toISODate,
  todayISO,
} from '@/lib/date';

function getGoogleCalendarUrl(date: Date | string, title?: string): string {
  // Event dates are calendar days (YYYY-MM-DD) — read them as they are, so the
  // deep link never points at the previous day in another timezone.
  const iso = toISODate(date);
  const yyyy = iso.slice(0, 4);
  const mm = iso.slice(5, 7);
  const dd = iso.slice(8, 10);
  if (title) {
    return `https://calendar.google.com/calendar/u/0/r/search?q=${encodeURIComponent(title)}`;
  }
  return `https://calendar.google.com/calendar/u/0/r/day/${yyyy}/${mm}/${dd}`;
}

/**
 * Minutes since midnight for schedule sorting. Accepts "HH:MM" (24h) and
 * "H:MM AM/PM" strings; untimed events sort last within their day.
 */
function timeToMinutes(t?: string | null): number {
  if (!t) return Number.POSITIVE_INFINITY;
  const m = t.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
  if (!m) return Number.POSITIVE_INFINITY;

  let hours = Number(m[1]);
  const minutes = Number(m[2]);
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/**
 * Compact 24h clock time for the schedule column. Accepts "11:00 AM",
 * "7:30pm" and "19:00" → "11:00" / "19:30" / "19:00". "All Day" maps to null
 * so all-day rows render as a label instead of a broken time range.
 */
function formatEventTime(t?: string | null): string | null {
  if (!t) return null;
  const trimmed = t.trim();
  if (/^all[\s-]?day$/i.test(trimmed)) return null;
  const m = trimmed.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!m) return trimmed; // already 24h ("HH:MM") or another format
  let hours = Number(m[1]);
  const meridiem = m[3].toLowerCase();
  if (meridiem === 'pm' && hours !== 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  return `${String(hours).padStart(2, '0')}:${m[2]}`;
}

interface DayGroup {
  date: string; // YYYY-MM-DD
  events: Event[];
}

export function CalendarView() {
  const events = useDashboardStore((s) => s.events);
  const focusMode = useDashboardStore((s) => s.focusMode);

  // The week is the default view; "Show More" extends it to the next 14 days.
  const [showMore, setShowMore] = useState(false);

  // Filter events based on active Focus context (Deep Work, Homelab, Personal)
  const filteredEvents = filterEventsByFocus(events, focusMode);

  // Divide the upcoming events by day, schedule-style
  const dayGroups = useMemo<DayGroup[]>(() => {
    const groups = new Map<string, Event[]>();
    for (const event of filteredEvents) {
      const key = toISODate(event.date);
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(event);
      } else {
        groups.set(key, [event]);
      }
    }

    return Array.from(groups.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, dayEvents]) => ({
        date,
        events: [...dayEvents].sort(
          (a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)
        ),
      }));
  }, [filteredEvents]);

  const todayStr = todayISO();
  const tomorrowStr = addDaysISO(todayStr, 1);

  // This calendar week (Monday → Sunday), following the app's 05:00 day
  // boundary.
  const weekStartStr = formatDateYYYYMMDD(getWeekStart(appDayStart()));
  const weekEndStr = formatDateYYYYMMDD(getWeekEnd(appDayStart()));

  const weekGroups = useMemo(
    () => dayGroups.filter((g) => g.date >= weekStartStr && g.date <= weekEndStr),
    [dayGroups, weekStartStr, weekEndStr]
  );

  const laterGroups = useMemo(
    () => dayGroups.filter((g) => g.date > weekEndStr),
    [dayGroups, weekEndStr]
  );

  const visibleGroups = showMore ? dayGroups : weekGroups;
  const hiddenEventCount = laterGroups.reduce((count, g) => count + g.events.length, 0);

  const relativeLabel = (dateStr: string): string | null => {
    if (dateStr === todayStr) return 'Today';
    if (dateStr === tomorrowStr) return 'Tomorrow';
    return null;
  };

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[var(--paper-accent)]" />
          <h2 className="font-bold text-sm text-[var(--paper-text)]">Calendar</h2>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] text-[var(--paper-muted)]">
            {showMore ? 'Next 14 days' : 'This week'}
          </span>
        </div>
        <a
          href="https://calendar.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-[var(--paper-muted)] hover:text-[var(--paper-accent)] flex items-center gap-1"
        >
          <span>Google Cal</span>
          <ExternalLink className="w-3 h-3" />
        </a>
      </div>

      {dayGroups.length === 0 ? (
        <div className="text-xs text-[var(--paper-muted)] italic py-3 text-center">
          No upcoming events scheduled for this focus mode.
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleGroups.length === 0 && (
            <div className="text-xs text-[var(--paper-muted)] italic py-3 text-center">
              No events this week.
            </div>
          )}

          {visibleGroups.map((group) => {
            const label = relativeLabel(group.date);
            return (
              <div key={group.date} className="space-y-1">
                {/* Day header — divides the schedule by date */}
                <div className="flex items-center gap-2 pt-0.5">
                  <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--paper-text)]">
                    {label || formatWeekday(group.date)}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--paper-muted)]">
                    {formatDateDDMMYYYY(group.date)}
                  </span>
                  <span className="flex-1 border-t border-[var(--paper-border)]" />
                  <span className="text-[10px] font-mono text-[var(--paper-muted)]">
                    {group.events.length}
                  </span>
                </div>

                {group.events.map((event) => {
                  const calUrl = getGoogleCalendarUrl(event.date, event.title);
                  const startFmt = formatEventTime(event.startTime);
                  const endFmt = formatEventTime(event.endTime);
                  return (
                    <a
                      key={event.id}
                      href={calUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex gap-2 px-2 py-1.5 rounded-lg border border-[var(--paper-border)] hover:border-[var(--paper-border-strong)] bg-[var(--paper-card-subtle)] transition"
                    >
                      {/* Time column */}
                      <div className="w-[84px] shrink-0 flex items-center justify-end text-right border-r border-[var(--paper-border)] pr-2">
                        {startFmt ? (
                          <span className="text-[11px] font-mono font-semibold text-[var(--paper-text)] whitespace-nowrap">
                            {startFmt}
                            {endFmt && (
                              <span className="text-[var(--paper-muted)] font-normal">
                                –{endFmt}
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono uppercase text-[var(--paper-muted)]">
                            All day
                          </span>
                        )}
                      </div>

                      {/* Event body */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-[var(--paper-text)] group-hover:text-[var(--paper-accent)] transition truncate">
                            {event.title}
                          </span>
                          {event.calendar && (
                            <span
                              className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase shrink-0"
                              style={{
                                backgroundColor: `${event.calendar.color || '#4285F4'}15`,
                                color: event.calendar.color || '#4285F4',
                              }}
                            >
                              {event.calendar.name}
                            </span>
                          )}
                        </div>

                        {event.location && (
                          <div className="flex items-center gap-1 mt-0.5 text-[11px] text-[var(--paper-muted)]">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                      </div>
                    </a>
                  );
                })}
              </div>
            );
          })}

          {hiddenEventCount > 0 && (
            <button
              type="button"
              onClick={() => setShowMore((prev) => !prev)}
              className="w-full flex items-center justify-center gap-1 text-[11px] font-mono uppercase tracking-wider py-1.5 rounded-md border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:border-[var(--paper-border-strong)] transition"
            >
              {showMore ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  Show Less
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  Show More ({hiddenEventCount})
                </>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
