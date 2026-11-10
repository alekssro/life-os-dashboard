'use client';

/**
 * Triage modal for Inbox items.
 *
 * Items that came from Superlist have no list, so a Domain is required:
 * picking one creates the matching Superlist list (when the Domain does not
 * have one yet) and files the task under it. Other captured items may be
 * triaged without a Domain.
 */

import React, { useEffect, useState } from 'react';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { useDashboardStore } from '@/store/useDashboardStore';

export interface TriageItem {
  id: string;
  title: string;
  source?: string | null;
  superlistId?: string | null;
}

interface TriageDomainModalProps {
  item: TriageItem | null;
  isOpen: boolean;
  onClose: () => void;
  onAssigned: (domainId?: string, warning?: string) => void;
}

export function TriageDomainModal({ item, isOpen, onClose, onAssigned }: TriageDomainModalProps) {
  const domains = useDashboardStore((s) => s.domains);
  const fetchDashboardData = useDashboardStore((s) => s.fetchDashboardData);

  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  // A Superlist task must be filed under a domain — it has no list of its own.
  const requiresDomain = !!item?.superlistId;

  useEffect(() => {
    if (isOpen) {
      setSelected(null);
      setNewName('');
      setError(null);
      setWarning(null);
    }
  }, [isOpen, item?.id]);

  if (!isOpen || !item) return null;

  const createDomain = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/domains', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Could not create the domain');
        return;
      }
      const created = await res.json();
      await fetchDashboardData();
      setSelected(created.id);
      setNewName('');
      if (created.superlistWarning) {
        setWarning(`Domain created, but its Superlist list could not be created: ${created.superlistWarning}`);
      }
    } catch {
      setError('Could not create the domain');
    } finally {
      setCreating(false);
    }
  };

  const assign = async (domainId?: string | null) => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/inbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          action: 'OWN',
          targetDomainId: domainId ?? undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Could not triage the item');
        return;
      }
      if (data?.superlistWarning) {
        setWarning(data.superlistWarning);
        setSaving(false);
        return;
      }
      onAssigned(domainId ?? undefined);
    } catch {
      setError('Could not triage the item');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-2xl p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between pb-3 mb-3 border-b border-[var(--paper-border)]">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[var(--paper-text)]">
              {requiresDomain ? 'File under a Domain' : 'Choose a Domain'}
            </h2>
            <p className="text-xs text-[var(--paper-muted)] mt-0.5 truncate">{item.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {requiresDomain && (
          <p className="text-xs text-[var(--paper-muted)] mb-3 leading-relaxed">
            This task came from the Superlist inbox. Pick a Domain and it will be moved into that
            list in Superlist — the list is created if the Domain does not have one yet.
          </p>
        )}

        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {domains.map((domain) => (
            <button
              key={domain.id}
              type="button"
              onClick={() => setSelected(domain.id)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg border text-left transition ${
                selected === domain.id
                  ? 'border-[var(--paper-accent)] bg-[var(--paper-accent)]/10 text-[var(--paper-text)]'
                  : 'border-[var(--paper-border)] hover:border-[var(--paper-border-strong)] text-[var(--paper-text)]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: domain.color || 'var(--paper-accent)' }}
                />
                <span className="text-xs font-medium truncate">{domain.name}</span>
              </span>
              <span className="flex items-center gap-2 shrink-0">
                {!domain.superlistListId && (
                  <span className="text-[9px] font-mono uppercase text-[var(--paper-muted)]">
                    new list
                  </span>
                )}
                {selected === domain.id && (
                  <Check className="w-3.5 h-3.5 text-[var(--paper-accent)]" />
                )}
              </span>
            </button>
          ))}

          {domains.length === 0 && (
            <p className="text-xs italic text-[var(--paper-muted)]">No domains yet.</p>
          )}
        </div>

        {/* Create a new Domain — it gets its own Superlist list */}
        <div className="mt-3 pt-3 border-t border-[var(--paper-border)]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  createDomain();
                }
              }}
              placeholder="New domain name…"
              className="flex-1 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1.5 rounded-lg border border-[var(--paper-border)] text-xs outline-none focus:border-[var(--paper-accent)]"
            />
            <button
              type="button"
              onClick={createDomain}
              disabled={!newName.trim() || creating}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[var(--paper-border-strong)] text-[10px] font-mono uppercase text-[var(--paper-text)] hover:border-[var(--paper-accent)] disabled:opacity-40"
            >
              {creating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Add
            </button>
          </div>
        </div>

        {error && (
          <p className="mt-3 text-xs text-red-500 leading-relaxed">{error}</p>
        )}
        {warning && (
          <p className="mt-3 text-xs text-amber-600 leading-relaxed">{warning}</p>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          {!requiresDomain && (
            <button
              type="button"
              onClick={() => assign(null)}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg text-[10px] font-mono uppercase border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)] disabled:opacity-40"
            >
              No domain
            </button>
          )}
          <button
            type="button"
            onClick={() => assign(selected)}
            disabled={saving || (requiresDomain && !selected)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--paper-accent)] text-white text-[10px] font-mono uppercase disabled:opacity-40"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {requiresDomain ? 'Assign & file in Superlist' : 'Assign'}
          </button>
        </div>
      </div>
    </div>
  );
}
