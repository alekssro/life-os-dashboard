'use client';

import React from 'react';
import { Calendar as CalendarIcon, Clock, MapPin, ExternalLink } from 'lucide-react';
import { Event } from '@/types';
import { useDashboardStore } from '@/store/useDashboardStore';
import { filterEventsByFocus } from '@/lib/focusFilter';

function getGoogleCalendarUrl(date: Date | string, title?: string): string {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  if (title) {
    return `https://calendar.google.com/calendar/u/0/r/search?q=${encodeURIComponent(title)}`;
  }
  return `https://calendar.google.com/calendar/u/0/r/day/${yyyy}/${mm}/${dd}`;
}

export function CalendarView() {
  const events = useDashboardStore((s) => s.events);
  const focusMode = useDashboardStore((s) => s.focusMode);

  // Filter events based on active Focus context (Deep Work, Homelab, Personal)
  const filteredEvents = filterEventsByFocus(events, focusMode);

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm space-y-3">
      <div className="flex items-center justify-between border-b border-[var(--paper-border)] pb-2.5">
        <div className="flex items-center gap-2">
          <CalendarIcon className="w-4 h-4 text-[var(--paper-accent)]" />
          <h2 className="font-bold text-sm text-[var(--paper-text)]">Calendar</h2>
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

      {filteredEvents.length === 0 ? (
        <div className="text-xs text-[var(--paper-muted)] italic py-3 text-center">
          No upcoming events scheduled for this focus mode.
        </div>
      ) : (
        <div className="space-y-2">
          {filteredEvents.slice(0, 6).map((event) => {
            const calUrl = getGoogleCalendarUrl(event.date, event.title);
            return (
              <a
                key={event.id}
                href={calUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="group block p-2 rounded-lg border border-[var(--paper-border)] hover:border-[var(--paper-border-strong)] bg-[var(--paper-card-subtle)] transition"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-[var(--paper-text)] group-hover:text-[var(--paper-accent)] transition truncate">
                    {event.title}
                  </span>
                  {event.calendar && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase"
                      style={{
                        backgroundColor: `${event.calendar.color || '#4285F4'}15`,
                        color: event.calendar.color || '#4285F4',
                      }}
                    >
                      {event.calendar.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-3 mt-1 text-[11px] text-[var(--paper-muted)]">
                  {(event.startTime || event.endTime) && (
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3" />
                      {event.startTime || ''} {event.endTime ? `- ${event.endTime}` : ''}
                    </span>
                  )}
                  {event.location && (
                    <span className="flex items-center gap-1 truncate max-w-[150px]">
                      <MapPin className="w-3 h-3 shrink-0" />
                      {event.location}
                    </span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
