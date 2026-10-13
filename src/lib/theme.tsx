'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType = 'system' | 'warm' | 'eink' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  resolvedTheme: 'warm' | 'eink' | 'light' | 'dark';
  setTheme: (theme: ThemeType) => void;
  availableThemes: Array<{ id: ThemeType; label: string; desc: string }>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'warm',
  resolvedTheme: 'warm',
  setTheme: () => { },
  availableThemes: [],
});

export const availableThemes: Array<{ id: ThemeType; label: string; desc: string }> = [
  { id: 'system', label: 'System Default', desc: 'Follow OS light/dark preference' },
  { id: 'warm', label: 'Warm Paper', desc: 'Warm cream & terracotta' },
  { id: 'eink', label: 'E-Ink Tablet', desc: 'Pure high-contrast monochrome for Boox/Remarkable' },
  { id: 'light', label: 'Daylight', desc: 'Crisp minimal white for desktop & phone' },
  { id: 'dark', label: 'Midnight OLED', desc: 'Deep black for phone & evening use' },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('system');
  const [resolvedTheme, setResolvedTheme] = useState<'warm' | 'eink' | 'light' | 'dark'>('warm');

  const getSystemTheme = (): 'light' | 'dark' => {
    if (typeof window === 'undefined') return 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  };

  const resolveTheme = (t: ThemeType): 'warm' | 'eink' | 'light' | 'dark' => {
    if (t === 'system') return getSystemTheme();
    return t;
  };

  useEffect(() => {
    const saved = localStorage.getItem('lifeos_theme') as ThemeType | null;
    const initialTheme = saved && ['system', 'warm', 'eink', 'light', 'dark'].includes(saved) ? saved : 'system';
    setThemeState(initialTheme);
    setResolvedTheme(resolveTheme(initialTheme));
    document.documentElement.dataset.theme = resolveTheme(initialTheme);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        const newResolved = getSystemTheme();
        setResolvedTheme(newResolved);
        document.documentElement.dataset.theme = newResolved;
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('lifeos_theme', newTheme);
    const resolved = resolveTheme(newTheme);
    setResolvedTheme(resolved);
    document.documentElement.dataset.theme = resolved;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
