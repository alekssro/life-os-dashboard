'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeType = 'warm' | 'eink' | 'light' | 'dark';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  availableThemes: Array<{ id: ThemeType; label: string; desc: string }>;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'warm',
  setTheme: () => { },
  availableThemes: [],
});

export const availableThemes: Array<{ id: ThemeType; label: string; desc: string }> = [
  { id: 'warm', label: 'Warm Paper', desc: 'Warm cream & terracotta)' },
  { id: 'eink', label: 'E-Ink Tablet', desc: 'Pure high-contrast monochrome for Boox/Remarkable' },
  { id: 'light', label: 'Daylight', desc: 'Crisp minimal white for desktop & phone' },
  { id: 'dark', label: 'Midnight OLED', desc: 'Deep black for phone & evening use' },
];

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeType>('warm');

  useEffect(() => {
    // Check localStorage
    const saved = localStorage.getItem('lifeos_theme') as ThemeType | null;
    if (saved && ['warm', 'eink', 'light', 'dark'].includes(saved)) {
      setThemeState(saved);
      document.documentElement.dataset.theme = saved;
    } else {
      document.documentElement.dataset.theme = 'warm';
    }
  }, []);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
    localStorage.setItem('lifeos_theme', newTheme);
    document.documentElement.dataset.theme = newTheme;
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, availableThemes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
