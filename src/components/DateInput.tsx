'use client';

import React, { useEffect, useState } from 'react';
import { formatDateDDMMYYYY, parseInputToISO } from '@/lib/date';

interface DateInputProps {
  /** Stored value in YYYY-MM-DD (or '' when empty). */
  value: string;
  onChange: (isoDate: string) => void;
  className?: string;
  placeholder?: string;
  id?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}

/**
 * Text input that always shows and accepts dates as dd/mm/yyyy,
 * while emitting YYYY-MM-DD for the API.
 */
export function DateInput({
  value,
  onChange,
  className = '',
  placeholder = 'dd/mm/yyyy',
  id,
  autoFocus,
  disabled,
}: DateInputProps) {
  const [text, setText] = useState(() => (value ? formatDateDDMMYYYY(value) : ''));
  const [invalid, setInvalid] = useState(false);

  useEffect(() => {
    setText(value ? formatDateDDMMYYYY(value) : '');
    setInvalid(false);
  }, [value]);

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
    // Restore the bound value if the field was left half typed or impossible.
    if (parseInputToISO(text) !== value) {
      setText(formatDateDDMMYYYY(value));
      setInvalid(false);
    }
  };

  return (
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      autoFocus={autoFocus}
      disabled={disabled}
      value={text}
      onChange={handleChange}
      onBlur={handleBlur}
      placeholder={placeholder}
      aria-label="Date (dd/mm/yyyy)"
      title="Format: dd/mm/yyyy"
      style={invalid ? { borderColor: '#dc2626' } : undefined}
      className={className}
    />
  );
}
