'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateDDMMYYYY, parseInputToISO, toISODate, realTodayISO } from '@/lib/date';

interface CalendarDateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const WEEKDAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

export function CalendarDateInput({
  value,
  onChange,
  className = '',
  placeholder = 'dd/mm/yyyy',
  id,
  autoFocus,
  disabled,
}: CalendarDateInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState(() => (value ? formatDateDDMMYYYY(value) : ''));
  const [invalid, setInvalid] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    if (value) {
      const d = new Date(value);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  });
  const [calendarYear, setCalendarYear] = useState(() => calendarMonth.getFullYear());

  useEffect(() => {
    setText(value ? formatDateDDMMYYYY(value) : '');
    setInvalid(false);
  }, [value]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 8);

    let formatted = digits;
    if (digits.length > 4) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
    } else if (digits.length > 2) {
      formatted = `${digits.slice(0, 2)}/${digits.slice(2)}`;
    }

    setText(formatted);
    setInvalid(false);

    if (digits.length === 0) {
      onChange('');
      return;
    }
    if (digits.length === 8) {
      const iso = parseInputToISO(formatted);
      if (iso) onChange(iso);
      else setInvalid(true);
    }
  };

  const handleBlur = () => {
    if (!value) {
      setText('');
      setInvalid(false);
      return;
    }
    if (parseInputToISO(text) !== value) {
      setText(formatDateDDMMYYYY(value));
      setInvalid(false);
    }
  };

  const handleFocus = () => {
    if (!disabled) setShowCalendar(true);
  };

  const handleClickOutside = (e: MouseEvent) => {
    // Ignore clicks on the input or calendar itself
    if (
      inputRef.current &&
      (inputRef.current === e.target || inputRef.current.contains(e.target as Node))
    ) return;
    if (
      calendarRef.current &&
      (calendarRef.current === e.target || calendarRef.current.contains(e.target as Node))
    ) return;
    setShowCalendar(false);
  };

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectDate = (day: number) => {
    const iso = toISODate(new Date(calendarYear, calendarMonth.getMonth(), day));
    onChange(iso);
    setText(formatDateDDMMYYYY(iso));
    setInvalid(false);
    setShowCalendar(false);
  };

  const goToMonth = (delta: number) => {
    const newMonth = addMonths(calendarMonth, delta);
    setCalendarMonth(newMonth);
    setCalendarYear(newMonth.getFullYear());
  };

  const goToToday = () => {
    const today = new Date();
    setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setCalendarYear(today.getFullYear());
    // Date picking always uses the real calendar day, never the 05:00 app day.
    const iso = realTodayISO();
    onChange(iso);
    setText(formatDateDDMMYYYY(iso));
    setInvalid(false);
    setShowCalendar(false);
  };

  const daysInMonth = getDaysInMonth(calendarYear, calendarMonth.getMonth());
  const firstDayIndex = getFirstDayOfMonth(calendarYear, calendarMonth.getMonth());
  const prevMonthDays = getDaysInMonth(
    calendarYear,
    calendarMonth.getMonth() === 0 ? 11 : calendarMonth.getMonth() - 1
  );
  const today = realTodayISO();

  return (
    <div className="relative" ref={calendarRef}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        value={text}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
        placeholder={placeholder}
        aria-label="Date (dd/mm/yyyy)"
        title="Format: dd/mm/yyyy"
        style={invalid ? { borderColor: '#dc2626' } : undefined}
        className={className}
      />

      {showCalendar && !disabled && (
        <div
          className="absolute z-50 mt-1 w-64 bg-[var(--paper-card)] border border-[var(--paper-border)] rounded-lg shadow-lg p-3 animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ left: 0 }}
        >
          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => goToMonth(-1)}
              className="p-1 rounded hover:bg-[var(--paper-card-subtle)] text-[var(--paper-muted)]"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-mono text-[var(--paper-text)] capitalize">
              {MONTHS[calendarMonth.getMonth()]} {calendarYear}
            </span>
            <button
              type="button"
              onClick={() => goToMonth(1)}
              className="p-1 rounded hover:bg-[var(--paper-card-subtle)] text-[var(--paper-muted)]"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center text-[11px] font-mono text-[var(--paper-muted)] mb-1">
            {WEEKDAYS_SHORT.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDayIndex }, (_, i) => (
              <button
                key={`prev-${i}`}
                type="button"
                className="p-1.5 rounded text-[12px] text-[var(--paper-muted)]/50 hover:bg-[var(--paper-card-subtle)]"
                onClick={() => selectDate(prevMonthDays - firstDayIndex + i + 1)}
              >
                {prevMonthDays - firstDayIndex + i + 1}
              </button>
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const iso = toISODate(new Date(calendarYear, calendarMonth.getMonth(), day));
              const isToday = iso === today;
              const isSelected = iso === value;
              return (
                <button
                  key={day}
                  type="button"
                  className={`p-1.5 rounded text-[12px] transition-colors ${
                    isSelected
                      ? 'bg-[var(--paper-accent)] text-white font-semibold'
                      : isToday
                      ? 'bg-[var(--paper-highlight)] text-[var(--paper-accent)] font-semibold'
                      : 'text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]'
                  }`}
                  onClick={() => selectDate(day)}
                >
                  {day}
                </button>
              );
            })}
            {Array.from({ length: 42 - firstDayIndex - daysInMonth }, (_, i) => (
              <button
                key={`next-${i}`}
                type="button"
                className="p-1.5 rounded text-[12px] text-[var(--paper-muted)]/50 hover:bg-[var(--paper-card-subtle)]"
                onClick={() => selectDate(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={goToToday}
            className="w-full mt-2 px-2 py-1 text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-text)] rounded border border-[var(--paper-border)]"
          >
            Today
          </button>
        </div>
      )}
    </div>
  );
}