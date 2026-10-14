'use client';

import {
  BookOpen,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Flame,
  FolderKanban,
  Layers,
  Plus,
  Repeat,
  Settings,
  Users,
  ClipboardList,
} from 'lucide-react';
import React from 'react';

export type NavItem =
  | 'today'
  | 'tasks'
  | 'routines'
  | 'projects'
  | 'people'
  | 'library'
  | 'domains'
  | 'weekly-review';

interface SidebarProps {
  currentView: NavItem;
  onSelectView: (view: NavItem) => void;
  onOpenCapture: () => void;
  onOpenSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  slippingCount?: number;
}

export function Sidebar({
  currentView,
  onSelectView,
  onOpenCapture,
  onOpenSettings,
  isCollapsed,
  onToggleCollapse,
  slippingCount = 0,
}: SidebarProps) {
  const navItems = [
    { id: 'today' as NavItem, label: 'Today', icon: Flame, badge: slippingCount > 0 ? slippingCount : undefined },
    { id: 'tasks' as NavItem, label: 'Tasks', icon: CheckSquare },
    { id: 'routines' as NavItem, label: 'Routines', icon: Repeat },
    { id: 'projects' as NavItem, label: 'Projects', icon: FolderKanban },
    { id: 'people' as NavItem, label: 'People', icon: Users },
    { id: 'library' as NavItem, label: 'Library', icon: BookOpen },
    { id: 'domains' as NavItem, label: 'Domains', icon: Layers },
    { id: 'weekly-review' as NavItem, label: 'Weekly Review', icon: ClipboardList },
  ];

  return (
    <div className="flex flex-col justify-between h-full">
      <div>
        {/* Header / Brand */}
        <div className="flex items-center justify-between mb-8 px-2">
          {!isCollapsed && (
            <div>
              <h1 className="font-serif text-xl tracking-tight font-semibold text-[var(--paper-text)]">
                Life OS
              </h1>
              <p className="text-xs text-[var(--paper-muted)] tracking-wider uppercase font-mono">
                alekssro Edition
              </p>
            </div>
          )}
          <button
            onClick={onToggleCollapse}
            aria-label="Toggle sidebar"
            className="p-1.5 rounded text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Capture Button */}
        <button
          onClick={onOpenCapture}
          className={`w-full mb-6 flex items-center justify-center gap-2 py-2 px-3 rounded border border-[var(--paper-border-strong)] bg-[var(--paper-card)] hover:bg-[var(--paper-card-subtle)] text-[var(--paper-text)] font-mono text-xs transition-colors`}
        >
          <Plus className="w-4 h-4 text-[var(--paper-accent)]" />
          {!isCollapsed && (
            <span className="flex-1 text-left flex items-center justify-between">
              <span>Capture</span>
              <kbd className="text-[10px] bg-[var(--paper-card-subtle)] px-1.5 py-0.5 rounded border border-[var(--paper-border)]">
                ⌘J
              </kbd>
            </span>
          )}
        </button>

        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onSelectView(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm font-medium transition-colors ${isActive
                    ? 'bg-[var(--paper-card-subtle)] text-[var(--paper-text)] font-semibold border-l-2 border-[var(--paper-accent)]'
                    : 'text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]'
                  }`}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--paper-accent)]' : ''}`} />
                {!isCollapsed && <span className="flex-1 text-left">{item.label}</span>}
                {!isCollapsed && item.badge && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-[var(--paper-accent)] text-white">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer: Settings */}
      <div className="pt-4 border-t border-[var(--paper-border)] space-y-2">
        {/* Settings button */}
        <button
          onClick={onOpenSettings}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]`}
        >
          <Settings className="w-4 h-4 shrink-0" />
          {!isCollapsed && <span>Settings & API</span>}
        </button>
      </div>
    </div>
  );
}
