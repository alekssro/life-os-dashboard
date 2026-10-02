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
} from 'lucide-react';
import { useTheme, ThemeType } from '@/lib/theme';
import { formatDateDDMMYYYY } from '@/lib/date';

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

  // Load calendars when opening
  const loadCalendars = async () => {
    try {
      const res = await fetch('/api/calendar');
      if (res.ok) setCalendars(await res.json());
    } catch (err) {
      console.error('Error loading calendars:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadCalendars();
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

        {/* 2. Theme Configuration (Web / Phone vs E-Ink Tablets) */}
        <section className="space-y-3 pt-4 border-t border-[var(--paper-border)]">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--paper-text)]">
            <Tablet className="w-4 h-4 text-[var(--paper-accent)]" />
            <span>Display & Tablet Themes</span>
          </div>
          <p className="text-xs text-[var(--paper-muted)] font-serif">
            Select your preferred display mode. Switch to <strong>E-Ink Tablet</strong> on devices like Boox, Remarkable Paper Pro, or Supernote for pure high-contrast monochrome rendering.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {availableThemes.map((t) => (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                className={`p-3 rounded border text-left transition-colors ${
                  theme === t.id
                    ? 'border-[var(--paper-accent)] bg-[var(--paper-card-subtle)] ring-1 ring-[var(--paper-accent)]'
                    : 'border-[var(--paper-border)] hover:bg-[var(--paper-card-subtle)]'
                }`}
              >
                <div className="text-xs font-bold text-[var(--paper-text)]">{t.label}</div>
                <div className="text-[11px] text-[var(--paper-muted)] mt-0.5">{t.desc}</div>
              </button>
            ))}
          </div>
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

        {/* Close Button */}
        <div className="flex justify-end pt-2 border-t border-[var(--paper-border)]">
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
