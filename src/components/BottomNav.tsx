'use client';

import { ThemeType, useTheme } from '@/lib/theme';
import {
  BookOpen,
  CheckSquare,
  ClipboardList,
  Coffee,
  Flame,
  FolderKanban,
  Layers,
  Menu,
  Moon,
  Plus,
  Repeat,
  Settings,
  Sun,
  Tablet,
  Users,
  X,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';

export type NavItem =
  | 'today'
  | 'tasks'
  | 'routines'
  | 'projects'
  | 'people'
  | 'library'
  | 'domains'
  | 'weekly-review';

interface BottomNavProps {
  currentView: NavItem;
  onSelectView: (view: NavItem) => void;
  onOpenCapture: () => void;
  onOpenSettings: () => void;
  slippingCount?: number;
}

const mainNavItems: { id: NavItem; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number }[] = [
  { id: 'today', label: 'Today', icon: Flame },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'routines', label: 'Routines', icon: Repeat },
];

const moreNavItems: { id: NavItem; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'people', label: 'People', icon: Users },
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'domains', label: 'Domains', icon: Layers },
  { id: 'weekly-review', label: 'Weekly Review', icon: ClipboardList },
];

const themeOptions: { id: ThemeType; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'warm', label: 'Warm', icon: Coffee },
  { id: 'eink', label: 'E-Ink', icon: Tablet },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
];

export function BottomNav({
  currentView,
  onSelectView,
  onOpenCapture,
  onOpenSettings,
  slippingCount = 0,
}: BottomNavProps) {
  const { theme, setTheme, availableThemes } = useTheme();
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setIsMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMoreItemClick = (view: NavItem) => {
    onSelectView(view);
    setIsMoreOpen(false);
  };

  const handleThemeClick = (t: ThemeType) => {
    setTheme(t);
    setIsMoreOpen(false);
  };

  return (
    <>
      {/* Floating Action Button for Capture */}
      <button
        onClick={onOpenCapture}
        className="lg:hidden fixed bottom-20 right-4 z-40 w-14 h-14 rounded-full bg-[var(--paper-accent)] text-white shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-[var(--paper-accent)] focus:ring-offset-2 focus:ring-offset-[var(--paper-bg)]"
        aria-label="Capture (⌘J)"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* Bottom Navigation Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--paper-border)] bg-[var(--paper-card)] safe-area-bottom">
        <div className="grid grid-cols-4 gap-0">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            const badge = item.id === 'today' && slippingCount > 0 ? slippingCount : undefined;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors ${isActive
                  ? 'text-[var(--paper-accent)]'
                  : 'text-[var(--paper-muted)]'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-[var(--paper-accent)]' : 'text-[var(--paper-muted)]'}`} />
                <span className="text-[10px] font-medium">{item.label}</span>
                {badge && (
                  <span className="absolute -top-1 -right-1 text-[8px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--paper-accent)] text-white">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* More Menu Button */}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`flex flex-col items-center justify-center gap-1 py-2.5 px-1 transition-colors ${
                isMoreOpen ? 'text-[var(--paper-accent)]' : 'text-[var(--paper-muted)]'
              }`}
            >
              <Menu className={`w-5 h-5 ${isMoreOpen ? 'text-[var(--paper-accent)]' : 'text-[var(--paper-muted)]'}`} />
              <span className="text-[10px] font-medium">More</span>
            </button>

            {/* More Dropdown */}
            {isMoreOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 origin-bottom-right rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card)] shadow-xl ring-1 ring-[var(--paper-border)] animate-in fade-in-0 zoom-in-95 duration-150">
                {/* Views Section */}
                <div className="p-2">
                  <p className="text-[10px] font-mono uppercase text-[var(--paper-muted)] px-2 py-1">Views</p>
                  <div className="space-y-0.5">
                    {moreNavItems.map((item) => {
                      const Icon = item.icon;
                      const isActive = currentView === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleMoreItemClick(item.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-[var(--paper-card-subtle)] text-[var(--paper-text)] font-semibold'
                              : 'text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]'
                          }`}
                        >
                          <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--paper-accent)]' : ''}`} />
                          <span className="flex-1 text-left">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[var(--paper-border)] mx-2" />

                {/* Theme Section */}
                <div className="p-2">
                  <p className="text-[10px] font-mono uppercase text-[var(--paper-muted)] px-2 py-1">Theme</p>
                  <div className="grid grid-cols-4 gap-1">
                    {themeOptions.map((t) => {
                      const Icon = t.icon;
                      const isActive = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleThemeClick(t.id)}
                          title={t.label}
                          className={`flex items-center justify-center p-2 rounded border text-xs transition-colors ${
                            isActive
                              ? 'border-[var(--paper-accent)] bg-[var(--paper-card-subtle)] text-[var(--paper-text)]'
                              : 'border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[var(--paper-border)] mx-2" />

                {/* Settings */}
                <button
                  onClick={() => {
                    onOpenSettings();
                    setIsMoreOpen(false);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)] transition-colors"
                >
                  <Settings className="w-4 h-4 shrink-0" />
                  <span>Settings & API</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>
    </>
  );
}