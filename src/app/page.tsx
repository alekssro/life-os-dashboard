'use client';

import React, { useState, useEffect } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { BottomNav } from '@/components/BottomNav';
import { TopBar } from '@/components/TopBar';
import { TodayDashboard } from '@/components/views/TodayDashboard';
import { TasksView } from '@/components/views/TasksView';
import { RoutinesView } from '@/components/views/RoutinesView';
import { LibraryView } from '@/components/views/LibraryView';
import { DomainsView } from '@/components/views/DomainsView';
import { WeeklyReviewView } from '@/components/views/WeeklyReviewView';
import { CaptureModal } from '@/components/CaptureModal';
import { SettingsModal } from '@/components/SettingsModal';
import { useSuperlistSync } from '@/hooks/useSuperlistSync';

export default function HomePage() {
  const [currentView, setCurrentView] = useState<'today' | 'tasks' | 'routines' | 'library' | 'domains' | 'weekly-review'>('today');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [slippingCount, setSlippingCount] = useState(0);

  // Initialize background polling & visibility management
  const { syncNow } = useSuperlistSync();

  // Global keyboard shortcut (⌘J or ⌘K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'k')) {
        e.preventDefault();
        setIsCaptureOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch slipping count for attention badge
  useEffect(() => {
    fetch('/api/attention')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.slippingProjects) {
          setSlippingCount(data.slippingProjects.length);
        }
      })
      .catch(() => {});
  }, []);

  // After a Superlist OAuth login redirect, re-open the settings modal
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (params.has('superlist')) {
      setIsSettingsOpen(true);
    }
  }, []);

  const handleCaptured = () => {
    syncNow();
  };

  return (
    <div className="flex min-h-screen bg-[var(--paper-bg)] text-[var(--paper-text)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col justify-between border-r border-[var(--paper-border)] bg-[var(--paper-card)] select-none transition-all duration-150 w-56 px-4 py-6 h-screen sticky top-0">
        <Sidebar
          currentView={currentView}
          onSelectView={(v) => setCurrentView(v)}
          onOpenCapture={() => setIsCaptureOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
          slippingCount={slippingCount}
        />
      </aside>

      {/* Main View Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-y-auto lg:pb-0 pb-28">
          {currentView === 'today' && (
            <TodayDashboard
              onNavigate={(v) => setCurrentView(v)}
              onOpenCapture={() => setIsCaptureOpen(true)}
            />
          )}
          {currentView === 'tasks' && <TasksView />}
          {currentView === 'routines' && <RoutinesView />}
          {currentView === 'library' && <LibraryView />}
          {currentView === 'domains' && <DomainsView />}
          {currentView === 'weekly-review' && <WeeklyReviewView />}
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        currentView={currentView}
        onSelectView={(v) => setCurrentView(v)}
        onOpenCapture={() => setIsCaptureOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        slippingCount={slippingCount}
      />

      {/* Modals */}
      <CaptureModal
        isOpen={isCaptureOpen}
        onClose={() => setIsCaptureOpen(false)}
        onCaptured={handleCaptured}
      />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
