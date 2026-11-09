import { useEffect, useRef } from 'react';
import { useDashboardStore } from '@/store/useDashboardStore';

const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * useSuperlistSync Hook
 * - Runs Superlist & Calendar background sync every 5 minutes.
 * - Pauses polling when document.visibilityState is 'hidden' to save battery and reduce network waste.
 * - Resumes immediately and polls once when tab returns to focus if last sync was > 5 mins ago.
 * - Cleans up interval timers on unmount to prevent memory leaks.
 */
export function useSuperlistSync() {
  const syncNow = useDashboardStore((s) => s.syncNow);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);
  const lastSyncedAt = useDashboardStore((s) => s.lastSyncedAt);
  const isSyncing = useDashboardStore((s) => s.isSyncing);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSyncTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Initial fetch on mount
    fetchDashboardData();

    const executePolling = async () => {
      if (document.visibilityState === 'hidden') return;
      try {
        await syncNow();
        lastSyncTimeRef.current = Date.now();
      } catch (err) {
        console.warn('Superlist background polling error:', err);
      }
    };

    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(executePolling, POLLING_INTERVAL_MS);
    };

    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    // Handle Page Visibility API
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const timeSinceLastSync = Date.now() - lastSyncTimeRef.current;
        if (timeSinceLastSync >= POLLING_INTERVAL_MS) {
          executePolling();
        }
        startTimer();
      } else {
        stopTimer();
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [syncNow, fetchDashboardData]);

  return {
    syncNow,
    isSyncing,
    lastSyncedAt,
  };
}
