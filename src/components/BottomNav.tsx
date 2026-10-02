'use client';

import { ThemeType, useTheme } from '@/lib/theme';
import {
  BookOpen,
  CheckSquare,
  Coffee,
  Flame,
  FolderKanban,
  Layers,
  Moon,
  Repeat,
  Settings,
  Sun,
  Tablet,
  Users,
} from 'lucide-react';
import React from 'react';

export type NavItem =
  | 'today'
  | 'tasks'
  | 'routines'
  | 'projects'
  | 'people'
  | 'library'
  | 'domains';

interface BottomNavProps {
  currentView: NavItem;
  onSelectView: (view: NavItem) => void;
  slippingCount?: number;
}

export function BottomNav({
  currentView,
  onSelectView,
  slippingCount = 0,
}: BottomNavProps) {
  const { theme, setTheme, availableThemes } = useTheme();

  const navItems = [
    { id: 'today' as NavItem, label: 'Today', icon: Flame, badge: slippingCount > 0 ? slippingCount : undefined },
    { id: 'tasks' as NavItem, label: 'Tasks', icon: CheckSquare },
    { id: 'routines' as NavItem, label: 'Routines', icon: Repeat },
    { id: 'projects' as NavItem, label: 'Projects', icon: FolderKanban },
    { id: 'people' as NavItem, label: 'People', icon: Users },
    { id: 'library' as NavItem, label: 'Library', icon: BookOpen },
    { id: 'domains' as NavItem, label: 'Domains', icon: Layers },
  ];

  const getThemeIcon = (t: ThemeType) => {
    switch (t) {
      case 'eink': return <Tablet className="w-5 h-5" />;
      case 'warm': return <Coffee className="w-5 h-5" />;
      case 'light': return <Sun className="w-5 h-5" />;
      case 'dark': return <Moon className="w-5 h-5" />;
    }
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--paper-border)] bg-[var(--paper-card)] safe-area-bottom">
      <div className="grid grid-cols-4 gap-0">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectView(item.id)}
              className={`relative flex flex-col items-center justify-center gap-1 py-3 px-2 transition-colors ${isActive
                  ? 'text-[var(--paper-accent)]'
                  : 'text-[var(--paper-muted)]'
                }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'text-[var(--paper-accent)]' : 'text-[var(--paper-muted)]'}`} />
              <span className="text-xs font-medium">{item.label}</span>
              {item.badge && (
                <span className="absolute -top-1 -right-1 text-[9px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--paper-accent)] text-white">
                  {item.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-3 gap-0 border-t border-[var(--paper-border)] px-2 py-2">
        <select
          value={theme}
          onChange={(e) => setTheme(e.target.value as ThemeType)}
          className="col-span-1 bg-[var(--paper-bg)] border border-[var(--paper-border)] rounded text-[var(--paper-text)] text-xs px-2 py-1 appearance-none focus:outline-none focus:ring-2 focus:ring-[var(--paper-accent)]"
        >
          {availableThemes.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <button
          onClick={() => onSelectView('today')}
          className="col-span-1 flex flex-col items-center justify-center gap-1 py-2 px-2 text-[var(--paper-muted)] hover:text-[var(--paper-text)] transition-colors"
        >
          <Coffee className="w-5 h-5" />
          <span className="text-xs">Settings</span>
        </button>
        <button
          className="col-span-1 flex flex-col items-center justify-center gap-1 py-2 px-2 text-[var(--paper-muted)] hover:text-[var(--paper-text)] transition-colors"
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-xs">More</span>
        </button>
      </div>
    </nav>
  );
}
