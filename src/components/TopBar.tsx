'use client';

import React from 'react';
import { RefreshCw, Zap, Server, Home, Globe } from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';
import { FocusMode } from '@/types';

export function TopBar() {
  const focusMode = useDashboardStore((s) => s.focusMode);
  const setFocusMode = useDashboardStore((s) => s.setFocusMode);
  const syncNow = useDashboardStore((s) => s.syncNow);
  const isSyncing = useDashboardStore((s) => s.isSyncing);
  const lastSyncedAt = useDashboardStore((s) => s.lastSyncedAt);

  const formatLastSync = (iso: string | null) => {
    if (!iso) return 'Not synced yet';
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const focusOptions: { mode: FocusMode; label: string; icon: React.ElementType }[] = [
    { mode: 'ALL', label: 'All', icon: Globe },
    { mode: 'DEEP_WORK', label: 'Deep Work', icon: Zap },
    { mode: 'HOMELAB', label: 'Homelab / DevOps', icon: Server },
    { mode: 'PERSONAL', label: 'Personal / Family', icon: Home },
  ];

  return (
    <header className="w-full bg-[var(--paper-card)] border-b border-[var(--paper-border-strong)] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30 transition-colors">
      {/* Context & Focus Mode Switcher */}
      <div className="flex items-center gap-1.5 overflow-x-auto py-0.5">
        <span className="text-xs uppercase font-bold tracking-wider text-[var(--paper-muted)] mr-1 hidden sm:inline">
          Focus:
        </span>
        {focusOptions.map(({ mode, label, icon: Icon }) => {
          const isActive = focusMode === mode;
          return (
            <button
              key={mode}
              onClick={() => setFocusMode(mode)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold tracking-tight transition-all border ${
                isActive
                  ? 'bg-[var(--paper-accent)] text-white border-[var(--paper-accent)] shadow-sm'
                  : 'bg-[var(--paper-card-subtle)] text-[var(--paper-muted)] border-[var(--paper-border)] hover:text-[var(--paper-text)] hover:border-[var(--paper-border-strong)]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {/* Manual Sync Now Handler & Status */}
      <div className="flex items-center gap-3 ml-auto text-xs">
        <span className="text-[var(--paper-muted)] hidden md:inline">
          Synced: <strong className="text-[var(--paper-text)]">{formatLastSync(lastSyncedAt)}</strong>
        </span>
        <button
          onClick={() => syncNow()}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1 rounded-md border border-[var(--paper-border-strong)] bg-[var(--paper-card)] hover:bg-[var(--paper-card-subtle)] active:scale-95 text-[var(--paper-text)] transition disabled:opacity-60"
          title="Manual Sync Superlist & Google Calendar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[var(--paper-accent)]' : ''}`} />
          <span className="font-medium">{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>
    </header>
  );
}
