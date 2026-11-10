'use client';

import {
  BookOpen,
  Check,
  CheckSquare,
  ClipboardList,
  Coffee,
  Flame,
  Globe,
  Home,
  Layers,
  Menu,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  Repeat,
  Server,
  Settings,
  Sun,
  Tablet,
  X,
  Zap,
} from 'lucide-react';
import React, { useState, useRef, useEffect } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { FocusMode } from '@/types';
import { formatDateDDMMYYYY, formatTimeHHMM } from '@/lib/date';
import { useTheme, ThemeType } from '@/lib/theme';

/** Icon per display theme (matches the settings picker). */
const THEME_ICONS: Record<ThemeType, React.ElementType> = {
  system: Monitor,
  warm: Coffee,
  eink: Tablet,
  light: Sun,
  dark: Moon,
};

export type NavItem =
  | 'today'
  | 'tasks'
  | 'routines'
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
  { id: 'routines', label: 'Habits', icon: Repeat },
];

const moreNavItems: { id: NavItem; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'library', label: 'Library', icon: BookOpen },
  { id: 'domains', label: 'Domains', icon: Layers },
  { id: 'weekly-review', label: 'Weekly Review', icon: ClipboardList },
];

export function BottomNav({
  currentView,
  onSelectView,
  onOpenCapture,
  onOpenSettings,
  slippingCount = 0,
}: BottomNavProps) {
  const [isMoreOpen, setIsMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  // Focus context + sync status (the mobile home for the retired top bar).
  const focusMode = useDashboardStore((s) => s.focusMode);
  const setFocusMode = useDashboardStore((s) => s.setFocusMode);
  const syncNow = useDashboardStore((s) => s.syncNow);
  const isSyncing = useDashboardStore((s) => s.isSyncing);
  const lastSyncedAt = useDashboardStore((s) => s.lastSyncedAt);

  // Display theme (the mobile equivalent of the settings picker).
  const { theme, setTheme, availableThemes } = useTheme();

  const focusOptions: { mode: FocusMode; label: string; icon: React.ElementType }[] = [
    { mode: 'ALL', label: 'All focus', icon: Globe },
    { mode: 'DEEP_WORK', label: 'Deep Work', icon: Zap },
    { mode: 'HOMELAB', label: 'Homelab / DevOps', icon: Server },
    { mode: 'PERSONAL', label: 'Personal / Family', icon: Home },
  ];

  const syncLabel = isSyncing
    ? 'Syncing…'
    : lastSyncedAt
      ? `Synced ${formatDateDDMMYYYY(lastSyncedAt)} ${formatTimeHHMM(lastSyncedAt)}`
      : 'Not synced yet';

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
          <div className="relative flex items-center justify-center" ref={moreRef}>
            <button
              onClick={() => setIsMoreOpen(!isMoreOpen)}
              className={`relative flex flex-col items-center justify-center gap-1 py-2.5 px-1 w-full transition-colors ${
                isMoreOpen ? 'text-[var(--paper-accent)]' : 'text-[var(--paper-muted)]'
              }`}
            >
              <Menu className={`w-5 h-5 ${isMoreOpen ? 'text-[var(--paper-accent)]' : 'text-[var(--paper-muted)]'}`} />
              <span className="text-[10px] font-medium">More</span>
            </button>

            {/* More Dropdown */}
            {isMoreOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-56 max-h-[75vh] overflow-y-auto origin-bottom-right rounded-lg border border-[var(--paper-border)] bg-[var(--paper-card)] shadow-xl ring-1 ring-[var(--paper-border)] animate-in fade-in-0 zoom-in-95 duration-150">
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

                {/* Focus context */}
                <div className="p-2">
                  <p className="text-[10px] font-mono uppercase text-[var(--paper-muted)] px-2 py-1">
                    Focus
                  </p>
                  <div className="flex items-center gap-1.5 px-2 pb-1">
                    {focusOptions.map(({ mode, label, icon: Icon }) => {
                      const isActive = focusMode === mode;
                      return (
                        <button
                          key={mode}
                          onClick={() => setFocusMode(mode)}
                          title={label}
                          aria-label={label}
                          aria-pressed={isActive}
                          className={`flex items-center justify-center w-9 h-9 rounded-full transition-all border ${
                            isActive
                              ? 'bg-[var(--paper-accent)] text-white border-[var(--paper-accent)]'
                              : 'bg-[var(--paper-card-subtle)] text-[var(--paper-muted)] border-[var(--paper-border)]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[var(--paper-border)] mx-2" />

                {/* Display theme */}
                <div className="p-2">
                  <p className="text-[10px] font-mono uppercase text-[var(--paper-muted)] px-2 py-1">
                    Theme
                  </p>
                  <div className="space-y-0.5">
                    {availableThemes.map((t) => {
                      const Icon = THEME_ICONS[t.id] ?? Globe;
                      const isActive = theme === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => setTheme(t.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${
                            isActive
                              ? 'bg-[var(--paper-card-subtle)] text-[var(--paper-text)] font-semibold'
                              : 'text-[var(--paper-muted)] hover:bg-[var(--paper-card-subtle)] hover:text-[var(--paper-text)]'
                          }`}
                        >
                          <Icon
                            className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--paper-accent)]' : ''}`}
                          />
                          <span className="flex-1 text-left">{t.label}</span>
                          {isActive && (
                            <Check className="w-3.5 h-3.5 shrink-0 text-[var(--paper-accent)]" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[var(--paper-border)] mx-2" />

                {/* Sync status + manual sync */}
                <button
                  onClick={() => syncNow()}
                  disabled={isSyncing}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)] transition-colors disabled:opacity-60"
                >
                  <RefreshCw
                    className={`w-4 h-4 shrink-0 ${isSyncing ? 'animate-spin text-[var(--paper-accent)]' : ''}`}
                  />
                  <span className="flex-1 text-left font-mono text-[11px] uppercase tracking-wider">
                    {syncLabel}
                  </span>
                </button>

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