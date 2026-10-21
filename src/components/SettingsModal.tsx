'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Key,
  Smartphone,
  Bot,
  Copy,
  Check,
  Tablet,
  ShieldCheck,
  Calendar,
  Plus,
  RefreshCw,
  Trash2,
  ExternalLink,
  Info,
  ListTodo,
  Monitor,
  Coffee,
  Sun,
  Moon,
  Globe,
  Bell,
} from 'lucide-react';
import { useTheme, ThemeType } from '@/lib/theme';
import { formatDateDDMMYYYY } from '@/lib/date';
import {
  SLOT_LABELS,
  type NotificationPrefs,
  type ReminderSlot,
  disablePushNotifications,
  enablePushNotifications,
  getNotificationPermission,
  getServiceWorkerVersion,
} from '@/lib/pushClient';
import packageJson from '../../package.json';

const APP_VERSION = packageJson.version;

const REMINDER_SLOTS: ReminderSlot[] = ['MORNING', 'AFTERNOON', 'EVENING'];
const DEFAULT_SLOTS: NotificationPrefs['slots'] = {
  MORNING: '09:00',
  AFTERNOON: '15:00',
  EVENING: '21:00',
};

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { theme, setTheme, availableThemes } = useTheme();
  const [copiedCurl, setCopiedCurl] = useState(false);

  // Calendar management state
  const [calendars, setCalendars] = useState<any[]>([]);
  const [newCalName, setNewCalName] = useState('');
  const [newCalUrl, setNewCalUrl] = useState('');
  const [newCalColor, setNewCalColor] = useState('#4285F4');
  const [isAddingCal, setIsAddingCal] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [calStatusMsg, setCalStatusMsg] = useState<string | null>(null);

  // Superlist status state
  const [superlistInfo, setSuperlistInfo] = useState<{ totalSynced: number; openCount: number; linkedProjects: any[]; linkedDomains: any[]; linkedRoutines?: any[]; linkedRoutinesCount?: number } | null>(null);
  const [superlistAuth, setSuperlistAuth] = useState<{ connected: boolean; hasRefreshToken: boolean; expiresAt: number | null; envTokenConfigured: boolean } | null>(null);
  const [isSuperlistSyncing, setIsSuperlistSyncing] = useState(false);
  const [isSuperlistConnecting, setIsSuperlistConnecting] = useState(false);
  const [superlistSyncMsg, setSuperlistSyncMsg] = useState<string | null>(null);

  // Reminder notifications (Web Push) state
  const [notifPrefs, setNotifPrefs] = useState<NotificationPrefs | null>(null);
  const [swVersion, setSwVersion] = useState<string | null>(null);
  const [notifPushConfigured, setNotifPushConfigured] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [notifMsg, setNotifMsg] = useState<string | null>(null);
  const [isNotifBusy, setIsNotifBusy] = useState(false);
  const [notifDevices, setNotifDevices] = useState<number>(0);
  const [isNotifTestBusy, setIsNotifTestBusy] = useState(false);

  // Load calendars and superlist when opening
  const loadCalendars = async () => {
    try {
      const res = await fetch('/api/calendar');
      if (res.ok) setCalendars(await res.json());
    } catch (err) {
      console.error('Error loading calendars:', err);
    }
  };

  const loadSuperlistAuth = async () => {
    try {
      const res = await fetch('/api/integrations/superlist/oauth/status');
      if (res.ok) setSuperlistAuth(await res.json());
    } catch (err) {
      console.error('Error loading Superlist auth status:', err);
    }
  };

  const loadSuperlistInfo = async () => {
    try {
      const res = await fetch('/api/integrations/superlist');
      if (res.ok) setSuperlistInfo(await res.json());
    } catch (err) {
      console.error('Error loading Superlist info:', err);
    }
  };

  // Surface the result of an OAuth login redirect (?superlist=connected|error)
  useEffect(() => {
    if (!isOpen) return;
    const params = new URLSearchParams(window.location.search);
    const result = params.get('superlist');
    if (result === 'connected') {
      setSuperlistSyncMsg('Connected to Superlist. You can sync now.');
      loadSuperlistAuth();
      window.history.replaceState({}, '', window.location.pathname);
    } else if (result === 'error') {
      setSuperlistSyncMsg(`Superlist login error: ${params.get('message') || 'unknown error'}`);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isOpen]);

  const handleSuperlistConnect = async () => {
    setIsSuperlistConnecting(true);
    setSuperlistSyncMsg(null);
    try {
      const res = await fetch('/api/integrations/superlist/oauth', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.authorizationUrl) {
        // Navigate to Superlist's login page; it redirects back to
        // ?superlist=connected on success.
        window.location.href = data.authorizationUrl;
      } else {
        setSuperlistSyncMsg(data.error || 'Could not start Superlist login.');
      }
    } catch (err) {
      console.error('Error connecting Superlist:', err);
      setSuperlistSyncMsg('Could not start Superlist login — check the server logs.');
    } finally {
      setIsSuperlistConnecting(false);
    }
  };

  const handleSuperlistDisconnect = async () => {
    setSuperlistSyncMsg(null);
    try {
      await fetch('/api/integrations/superlist/oauth', { method: 'DELETE' });
      setSuperlistAuth(null);
      setSuperlistInfo(null);
      setSuperlistSyncMsg('Disconnected from Superlist.');
    } catch (err) {
      console.error('Error disconnecting Superlist:', err);
    }
  };

  const handleSuperlistSync = async () => {
    setIsSuperlistSyncing(true);
    setSuperlistSyncMsg(null);
    try {
      const res = await fetch('/api/integrations/superlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'SYNC_PULL' }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setSuperlistSyncMsg(data.message || 'Superlist sync completed.');
        loadSuperlistInfo();
      } else {
        setSuperlistSyncMsg(data.error || `Sync failed (${res.status})`);
        if (data.code === 'NOT_CONNECTED' || data.code === 'REAUTH_REQUIRED') {
          loadSuperlistAuth();
        }
      }
    } catch (err) {
      console.error('Error syncing Superlist:', err);
      setSuperlistSyncMsg('Sync failed — check the server logs.');
    } finally {
      setIsSuperlistSyncing(false);
    }
  };

  // Reminder notifications: load prefs + browser permission state
  const loadNotificationPrefs = async () => {
    setNotifPermission(getNotificationPermission());
    try {
      const res = await fetch('/api/notifications/preferences');
      if (res.ok) {
        const data = await res.json();
        setNotifPrefs(data.prefs);
        setNotifPushConfigured(Boolean(data.pushConfigured));
        if (typeof data.subscriptionCount === 'number') setNotifDevices(data.subscriptionCount);
      }
    } catch (err) {
      console.error('Error loading notification prefs:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCalendars();
      loadSuperlistInfo();
      loadSuperlistAuth();
      loadNotificationPrefs();
      // Which service worker build is this device actually running?
      getServiceWorkerVersion().then(setSwVersion).catch(() => setSwVersion(null));
    }
  }, [isOpen]);

  const handleAddCalendar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCalName.trim() || !newCalUrl.trim()) return;

    setIsAddingCal(true);
    setCalStatusMsg('Adding and verifying Google Calendar...');

    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCalName.trim(),
          feedUrl: newCalUrl.trim(),
          color: newCalColor,
          isActive: true,
        }),
      });

      if (res.ok) {
        setNewCalName('');
        setNewCalUrl('');
        setCalStatusMsg('✓ Calendar connected and synced!');
        loadCalendars();
      } else {
        const data = await res.json();
        setCalStatusMsg(data.error || 'Failed to add calendar');
      }
    } catch {
      setCalStatusMsg('Network error adding calendar');
    } finally {
      setIsAddingCal(false);
      setTimeout(() => setCalStatusMsg(null), 3000);
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    setCalendars((prev) =>
      prev.map((c) => (c.id === id ? { ...c, isActive: !currentActive } : c))
    );

    await fetch('/api/calendar', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isActive: !currentActive }),
    });

    loadCalendars();
  };

  const handleDeleteCalendar = async (id: string) => {
    if (!confirm('Are you sure you want to remove this calendar connection?')) return;
    setCalendars((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/calendar?id=${id}`, { method: 'DELETE' });
    loadCalendars();
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setCalStatusMsg('Syncing all active Google calendars...');
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setCalStatusMsg(`✓ Synced ${data.totalSynced} events across ${data.activeCount} calendars!`);
        loadCalendars();
      } else {
        setCalStatusMsg(data.error || 'Sync failed');
      }
    } catch {
      setCalStatusMsg('Network error during sync');
    } finally {
      setIsSyncing(false);
      setTimeout(() => setCalStatusMsg(null), 3000);
    }
  };

  if (!isOpen) return null;

  const curlExample = `curl -X POST http://localhost:3000/api/capture \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_SECRET_KEY" \\
  -d '{"text": "Call Sam tomorrow at 2pm #Work"}'`;

  const copyToClipboard = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ------------------------------------------------------------------------------
  // Reminder notifications (Web Push)
  // ------------------------------------------------------------------------------
  const persistNotificationPrefs = async (next: NotificationPrefs): Promise<string | null> => {
    try {
      const res = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error || 'Failed to save reminder settings.';
      setNotifPrefs(data.prefs ?? next);
      setNotifPushConfigured(Boolean(data.pushConfigured));
      return null;
    } catch {
      return 'Failed to save reminder settings.';
    }
  };

  const handleToggleNotifications = async (enable: boolean) => {
    setIsNotifBusy(true);
    setNotifMsg(null);
    try {
      const slots = notifPrefs?.slots ?? DEFAULT_SLOTS;
      if (enable) {
        const result = await enablePushNotifications();
        if (!result.ok) {
          setNotifMsg(result.error || 'Could not enable notifications on this device.');
          setNotifPermission(result.permission ?? getNotificationPermission());
          return;
        }
        const error = await persistNotificationPrefs({ enabled: true, slots });
        setNotifMsg(error ?? 'Reminders enabled — this device is subscribed.');
      } else {
        await disablePushNotifications();
        const error = await persistNotificationPrefs({ enabled: false, slots });
        setNotifMsg(error ?? 'Reminders disabled on this device.');
      }
      setNotifPermission(getNotificationPermission());
      // Refresh the registered-device count shown in the UI.
      loadNotificationPrefs().catch(() => {});
    } finally {
      setIsNotifBusy(false);
    }
  };

  const handleSendTestNotification = async () => {
    setIsNotifTestBusy(true);
    setNotifMsg(null);
    try {
      const res = await fetch('/api/notifications/test', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      setNotifMsg(
        res.ok
          ? `Test notification sent to ${data.recipients} device(s). Check this browser.`
          : data.error || 'Failed to send the test notification.'
      );
    } catch {
      setNotifMsg('Failed to send the test notification.');
    } finally {
      setIsNotifTestBusy(false);
    }
  };

  const handleSlotChange = (slot: ReminderSlot, value: string) => {
    if (!notifPrefs) return;
    setNotifPrefs({ ...notifPrefs, slots: { ...notifPrefs.slots, [slot]: value } });
  };

  const handleSlotSave = async () => {
    if (!notifPrefs) return;
    setNotifMsg(null);
    const error = await persistNotificationPrefs(notifPrefs);
    setNotifMsg(error ?? 'Reminder times saved.');
  };

  const notifPermissionLabel =
    notifPermission === 'granted'
      ? 'Allowed on this device'
      : notifPermission === 'denied'
      ? 'Blocked in browser settings'
      : notifPermission === 'unsupported'
      ? 'Not supported by this browser'
      : 'Not enabled on this device yet';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-2xl bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-lg p-6 shadow-xl relative max-h-[90vh] overflow-y-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--paper-border)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[var(--paper-accent)]" />
            <h2 className="font-serif text-xl font-bold text-[var(--paper-text)]">
              Life OS Configuration & Integrations
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 1. Google Calendar Integration & Active Calendars */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--paper-text)]">
              <Calendar className="w-4 h-4 text-[var(--paper-accent)]" />
              <span>Google Calendar Integration</span>
            </div>
            <button
              onClick={handleSyncAll}
              disabled={isSyncing}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-[var(--paper-border)] hover:bg-[var(--paper-card-subtle)] text-xs font-mono text-[var(--paper-text)] transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[var(--paper-accent)]' : ''}`} />
              <span>Sync All</span>
            </button>
          </div>

          <p className="text-xs text-[var(--paper-muted)] font-serif leading-relaxed">
            Connect one or more Google Calendars using your <strong>Secret address in iCal format</strong>. Toggle which calendars should actively display in the <strong>Up Next</strong> dashboard widget.
          </p>

          {/* Connected Calendars List */}
          <div className="space-y-2">
            {calendars.map((cal) => (
              <div
                key={cal.id}
                className="flex items-center justify-between p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card-subtle)]"
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={cal.isActive}
                    onChange={() => handleToggleActive(cal.id, cal.isActive)}
                    className="w-4 h-4 rounded text-[var(--paper-accent)] cursor-pointer"
                    title={cal.isActive ? 'Active calendar (showing in Up Next)' : 'Inactive calendar (hidden)'}
                  />
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: cal.color || '#4285F4' }}
                    />
                    <div>
                      <p className="text-sm font-medium text-[var(--paper-text)]">{cal.name}</p>
                      <p className="text-[10px] font-mono text-[var(--paper-muted)]">
                        {cal._count?.events || 0} events synced
                        {cal.lastSyncedAt && ` · Synced: ${formatDateDDMMYYYY(cal.lastSyncedAt)}`}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${
                      cal.isActive
                        ? 'border-[var(--paper-accent)] text-[var(--paper-accent)] font-semibold'
                        : 'border-[var(--paper-border)] text-[var(--paper-muted)]'
                    }`}
                  >
                    {cal.isActive ? 'Active' : 'Disabled'}
                  </span>
                  <button
                    onClick={() => handleDeleteCalendar(cal.id)}
                    className="p-1 rounded text-[var(--paper-muted)] hover:text-red-500 transition-colors"
                    title="Remove calendar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}

            {calendars.length === 0 && (
              <div className="p-3 rounded border border-dashed border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                No Google calendars connected yet. Add one below to see your agenda in Up Next.
              </div>
            )}
          </div>

          {/* Add Calendar Form */}
          <form onSubmit={handleAddCalendar} className="p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] space-y-3">
            <h4 className="text-xs font-mono font-semibold uppercase text-[var(--paper-text)]">
              Connect Google Calendar
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
              <input
                type="text"
                value={newCalName}
                onChange={(e) => setNewCalName(e.target.value)}
                placeholder="Calendar Label (e.g. Work, Family)..."
                className="sm:col-span-5 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs"
              />
              <input
                type="url"
                value={newCalUrl}
                onChange={(e) => setNewCalUrl(e.target.value)}
                placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
                className="sm:col-span-5 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
              />
              <div className="sm:col-span-2 flex items-center gap-1.5">
                <input
                  type="color"
                  value={newCalColor}
                  onChange={(e) => setNewCalColor(e.target.value)}
                  className="w-8 h-7 rounded border border-[var(--paper-border)] cursor-pointer"
                  title="Badge Color"
                />
                <button
                  type="submit"
                  disabled={isAddingCal || !newCalName.trim() || !newCalUrl.trim()}
                  className="flex-1 py-1.5 px-2 bg-[var(--paper-accent)] hover:opacity-90 disabled:opacity-50 text-white rounded text-xs font-mono flex items-center justify-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add</span>
                </button>
              </div>
            </div>
            <p className="text-[11px] text-[var(--paper-muted)] font-serif">
              Tip: In Google Calendar, go to <em>Settings for my calendars</em> → select calendar → scroll to <strong>Secret address in iCal format</strong> and copy the URL.
            </p>
          </form>

          {calStatusMsg && (
            <div className="p-2 rounded bg-[var(--paper-highlight)] border border-[var(--paper-border)] text-xs font-mono text-[var(--paper-accent)] flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" />
              <span>{calStatusMsg}</span>
            </div>
          )}
        </section>

        {/* 2. Superlist Integration */}
        <section className="space-y-3 pt-4 border-t border-[var(--paper-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--paper-text)]">
              <ListTodo className="w-4 h-4 text-red-500" />
              <span>Superlist Integration</span>
            </div>
            <a
              href="superlist://"
              className="text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-text)] flex items-center gap-1"
              title="Open Superlist app"
            >
              <span>Open Superlist</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <p className="text-xs text-[var(--paper-muted)] font-serif leading-relaxed">
            Link tasks and projects directly to your Superlist workspace. Tasks originating from Superlist show a distinct red badge and deep-link directly into the desktop/web app.
          </p>

          <div className="p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--paper-muted)]">Authorization:</span>
              <span className="flex items-center gap-1.5 font-semibold">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    superlistAuth?.connected ? 'bg-green-500' : 'bg-red-400'
                  }`}
                />
                <span className={superlistAuth?.connected ? 'text-green-600' : 'text-[var(--paper-text)]'}>
                  {superlistAuth === null
                    ? '…'
                    : superlistAuth.connected
                      ? 'Connected'
                      : superlistAuth.envTokenConfigured
                        ? 'Using env token'
                        : 'Not connected'}
                </span>
              </span>
            </div>
            {superlistAuth?.connected && superlistAuth.expiresAt && (
              <div className="flex items-center justify-between text-[11px] font-mono text-[var(--paper-muted)]">
                <span>Access token expires:</span>
                <span>{new Date(superlistAuth.expiresAt).toLocaleString()}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--paper-muted)]">Connected Superlist Tasks:</span>
              <span className="font-semibold text-[var(--paper-text)]">
                {superlistInfo?.totalSynced || 0} total ({superlistInfo?.openCount || 0} open)
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--paper-muted)]">Routines from Recurring Superlist Tasks:</span>
              <span className="font-semibold text-[var(--paper-text)]">
                {superlistInfo?.linkedRoutinesCount || 0} routines
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--paper-muted)]">Domains Linked to Superlist Lists:</span>
              <span className="font-semibold text-[var(--paper-text)]">
                {superlistInfo?.linkedDomains?.length || 0} domains
              </span>
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-[var(--paper-muted)]">Projects Linked to Superlist Lists:</span>
              <span className="font-semibold text-[var(--paper-text)]">
                {superlistInfo?.linkedProjects?.length || 0} projects
              </span>
            </div>
            <div className="pt-2 border-t border-[var(--paper-border)] text-[11px] font-mono text-[var(--paper-muted)]">
              <span>Sync Endpoint: </span>
              <code className="text-[var(--paper-text)]">POST /api/integrations/superlist</code>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {superlistAuth?.connected ? (
              <>
                <button
                  type="button"
                  onClick={handleSuperlistSync}
                  disabled={isSuperlistSyncing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] text-xs font-mono text-[var(--paper-text)] hover:border-[var(--paper-accent)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSuperlistSyncing ? 'animate-spin' : ''}`} />
                  {isSuperlistSyncing ? 'Syncing…' : 'Sync now'}
                </button>
                <button
                  type="button"
                  onClick={handleSuperlistConnect}
                  disabled={isSuperlistConnecting}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--paper-border)] bg-[var(--paper-card-subtle)] text-xs font-mono text-[var(--paper-muted)] hover:border-[var(--paper-accent)] hover:text-[var(--paper-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Re-authorize with a different Superlist account"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSuperlistConnecting ? 'animate-spin' : ''}`} />
                  {isSuperlistConnecting ? 'Redirecting…' : 'Reconnect'}
                </button>
                <button
                  type="button"
                  onClick={handleSuperlistDisconnect}
                  className="px-3 py-1.5 rounded border border-[var(--paper-border)] bg-transparent text-xs font-mono text-[var(--paper-muted)] hover:text-red-500 hover:border-red-400"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleSuperlistConnect}
                disabled={isSuperlistConnecting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--paper-accent)] bg-[var(--paper-card-subtle)] text-xs font-mono text-[var(--paper-text)] hover:bg-[var(--paper-accent)] hover:text-[var(--paper-bg)] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ListTodo className="w-3.5 h-3.5" />
                {isSuperlistConnecting ? 'Redirecting…' : 'Connect to Superlist'}
              </button>
            )}
            <span className="text-[10px] font-mono text-[var(--paper-muted)]">
              {superlistAuth?.connected
                ? 'Access tokens refresh automatically; reconnect if they are revoked.'
                : 'Authorize once in your browser — “Sync now” pulls open tasks via MCP.'}
            </span>
          </div>

          {superlistSyncMsg && (
            <p className="text-[11px] font-mono text-[var(--paper-text)] bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] rounded px-2 py-1.5">
              {superlistSyncMsg}
            </p>
          )}
        </section>

        {/* 3. Theme Configuration (Web / Phone vs E-Ink Tablets) */}
        <section className="space-y-3 pt-4 border-t border-[var(--paper-border)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--paper-text)]">
            <Tablet className="w-4 h-4 text-[var(--paper-accent)]" />
            <span>Display & Tablet Themes</span>
          </div>
          <p className="text-xs text-[var(--paper-muted)] font-serif">
            Select your preferred display mode. Switch to <strong>E-Ink Tablet</strong> on devices like Boox, Remarkable Paper Pro, or Supernote for pure high-contrast monochrome rendering.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableThemes.map((t) => {
              let icon: React.ReactNode = <Globe className="w-4 h-4" />;
              switch (t.id) {
                case 'system':
                  icon = <Monitor className="w-4 h-4" />;
                  break;
                case 'warm':
                  icon = <Coffee className="w-4 h-4" />;
                  break;
                case 'eink':
                  icon = <Tablet className="w-4 h-4" />;
                  break;
                case 'light':
                  icon = <Sun className="w-4 h-4" />;
                  break;
                case 'dark':
                  icon = <Moon className="w-4 h-4" />;
                  break;
              }
              return (
                <button
                  key={t.id}
                  onClick={() => setTheme(t.id)}
                  className={`p-3 rounded border text-left transition-colors flex items-center gap-3 ${
                    theme === t.id
                      ? 'border-[var(--paper-accent)] bg-[var(--paper-card-subtle)] ring-1 ring-[var(--paper-accent)]'
                      : 'border-[var(--paper-border)] hover:bg-[var(--paper-card-subtle)]'
                  }`}
                >
                  <span className="text-[var(--paper-accent)]">{icon}</span>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-[var(--paper-text)]">{t.label}</div>
                    <div className="text-[11px] text-[var(--paper-muted)] mt-0.5">{t.desc}</div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reminder Notifications (Web Push) */}
        <section className="space-y-3 pt-4 border-t border-[var(--paper-border)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[var(--paper-text)]">
              <Bell className="w-4 h-4 text-[var(--paper-accent)]" />
              <span>Reminder Notifications</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={Boolean(notifPrefs?.enabled)}
              disabled={isNotifBusy || !notifPrefs}
              onClick={() => handleToggleNotifications(!notifPrefs?.enabled)}
              className={`relative w-11 h-6 rounded-full transition-colors disabled:opacity-50 ${
                notifPrefs?.enabled ? 'bg-[var(--paper-accent)]' : 'bg-[var(--paper-border-strong)]'
              }`}
              title={notifPrefs?.enabled ? 'Turn reminders off' : 'Turn reminders on'}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  notifPrefs?.enabled ? 'translate-x-5' : ''
                }`}
              />
            </button>
          </div>

          <p className="text-xs text-[var(--paper-muted)] font-serif leading-relaxed">
            One notification per slot listing everything still pending that day. Routines follow their
            <strong> Morning / Afternoon / Evening</strong> slot; tasks use their reminder time (or due
            time) and default to the morning digest. The app day rolls over at 05:00, so late-night
            reminders stay on the same day.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {REMINDER_SLOTS.map((slot) => (
              <label
                key={slot}
                className="flex items-center justify-between gap-2 p-2 rounded border border-[var(--paper-border)] bg-[var(--paper-card-subtle)]"
              >
                <span className="text-xs font-mono text-[var(--paper-text)]">{SLOT_LABELS[slot]}</span>
                <input
                  type="time"
                  value={notifPrefs?.slots[slot] ?? DEFAULT_SLOTS[slot]}
                  onChange={(e) => handleSlotChange(slot, e.target.value)}
                  onBlur={handleSlotSave}
                  disabled={!notifPrefs}
                  className="bg-[var(--paper-card)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs font-mono disabled:opacity-50"
                  title={`${SLOT_LABELS[slot]} reminder time`}
                />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono text-[var(--paper-muted)]">
            <span>
              Permission: {notifPermissionLabel}
              {notifDevices > 0 ? ` · ${notifDevices} device(s) registered` : ' · no devices registered'}
              {swVersion ? ` · Worker: ${swVersion}` : ''}
            </span>
            {swVersion === null && (
              <span className="text-yellow-500">
                Service worker outdated — close and reopen the app to update it.
              </span>
            )}
            {!notifPushConfigured && (
              <span className="text-yellow-500">
                Server is missing VAPID keys (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSendTestNotification}
              disabled={isNotifTestBusy || !notifPushConfigured}
              className="px-3 py-1.5 text-xs font-mono rounded border border-[var(--paper-border-strong)] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] hover:bg-[var(--paper-card)] transition-colors disabled:opacity-50"
              title="Send an immediate push to every registered device"
            >
              {isNotifTestBusy ? 'Sending…' : 'Send test notification'}
            </button>
            {typeof window !== 'undefined' && !window.isSecureContext && (
              <span className="text-xs font-mono text-red-500">
                HTTPS required: browsers block push on plain http:// addresses.
              </span>
            )}
            {typeof navigator !== 'undefined' && /iP(hone|ad|od)/.test(navigator.userAgent) && (
              <span className="text-xs font-mono text-[var(--paper-muted)]">
                iOS: install the app to your Home Screen (Share → Add to Home Screen) for push to work.
              </span>
            )}
          </div>

          {notifMsg && (
            <p className="text-[11px] font-mono text-[var(--paper-text)] bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] rounded px-2 py-1.5">
              {notifMsg}
            </p>
          )}
        </section>

        {/* 3. Hybrid AI Engine & Zero-AI Offline Capture */}
        <section className="space-y-2 pt-4 border-t border-[var(--paper-border)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--paper-text)]">
            <Bot className="w-4 h-4 text-[var(--paper-accent)]" />
            <span>AI & Offline Capture Architecture</span>
          </div>
          <p className="text-xs text-[var(--paper-muted)] leading-relaxed font-serif">
            Quick Capture functions with <strong>100% reliability even without AI keys</strong>:
          </p>
          <ul className="text-xs text-[var(--paper-muted)] space-y-1 font-mono pl-4 list-disc">
            <li><strong>Zero-AI Explicit Mode</strong>: Select Task, Routine, Project, Person, Quote, or Domain in Capture modal.</li>
            <li><strong>Deterministic Regex Parser</strong>: Runs locally if cloud AI is unreachable.</li>
            <li><strong>Optional Local Ollama</strong>: <code className="bg-[var(--paper-card-subtle)] px-1 rounded">OLLAMA_BASE_URL</code> (100% open source).</li>
            <li><strong>Cloud LLMs</strong>: Claude, Gemini, OpenAI Whisper supported via environment variables.</li>
          </ul>
        </section>

        {/* 4. iOS Shortcuts & Apple Watch Integration */}
        <section className="space-y-3 pt-4 border-t border-[var(--paper-border)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--paper-text)]">
            <Smartphone className="w-4 h-4 text-[var(--paper-accent)]" />
            <span>iOS Shortcut & Apple Watch Quick Capture</span>
          </div>
          <div className="relative p-3 rounded bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] font-mono text-xs overflow-x-auto text-[var(--paper-text)]">
            <pre>{curlExample}</pre>
            <button
              onClick={() => copyToClipboard(curlExample, setCopiedCurl)}
              className="absolute top-2 right-2 p-1.5 rounded bg-[var(--paper-card)] border border-[var(--paper-border)] hover:bg-[var(--paper-highlight)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
              title="Copy cURL command"
            >
              {copiedCurl ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </section>

        {/* Version Info */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--paper-border)]">
          <div className="flex items-center gap-1.5 text-xs text-[var(--paper-muted)]">
            <Info className="w-3.5 h-3.5" />
            <span>Life OS Dashboard v{APP_VERSION}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded bg-[var(--paper-accent)] text-white text-xs font-mono font-medium hover:opacity-90"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
