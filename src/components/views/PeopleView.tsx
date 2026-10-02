'use client';

import React, { useState, useEffect } from 'react';
import { Users, Plus, Phone, Mail, MessageSquare, AlertCircle, Calendar, Trash2 } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date';

export function PeopleView() {
  const [contacts, setContacts] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newCompany, setNewCompany] = useState('');
  const [newFamilyDetails, setNewFamilyDetails] = useState('');
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [interactionSummary, setInteractionSummary] = useState('');

  const loadContacts = async () => {
    const res = await fetch('/api/contacts');
    if (res.ok) setContacts(await res.json());
  };

  useEffect(() => {
    loadContacts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await fetch('/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        company: newCompany,
        familyDetails: newFamilyDetails,
      }),
    });

    setNewName('');
    setNewCompany('');
    setNewFamilyDetails('');
    loadContacts();
  };

  const handleLogInteraction = async (contactId: string) => {
    if (!interactionSummary.trim()) return;

    await fetch('/api/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId,
        summary: interactionSummary,
        type: 'NOTE',
      }),
    });

    setInteractionSummary('');
    setActiveContactId(null);
    loadContacts();
  };

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact?')) return;
    setContacts((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/contacts?id=${id}`, { method: 'DELETE' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--paper-text)]">People & CRM</h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase">
            Relationship Nurturing & Interaction Cadence
          </p>
        </div>
      </div>

      {/* Add Contact Form */}
      <form onSubmit={handleCreate} className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] flex flex-wrap gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Contact Name..."
          className="flex-1 min-w-[180px] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
        />
        <input
          type="text"
          value={newCompany}
          onChange={(e) => setNewCompany(e.target.value)}
          placeholder="Company or Role..."
          className="w-48 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs"
        />
        <input
          type="text"
          value={newFamilyDetails}
          onChange={(e) => setNewFamilyDetails(e.target.value)}
          placeholder="Family / Personal Context (e.g. Mal, 2 kids)..."
          className="flex-1 min-w-[200px] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs"
        />
        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-[var(--paper-accent)] text-white font-mono text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Person</span>
        </button>
      </form>

      {/* Contacts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {contacts.map((contact) => {
          const daysSince = Math.floor(
            (new Date().getTime() - new Date(contact.lastInteractionAt).getTime()) /
              (1000 * 60 * 60 * 24)
          );
          const needsFollowUp = daysSince >= contact.followUpDays;

          return (
            <div
              key={contact.id}
              className={`p-4 rounded border bg-[var(--paper-card)] flex flex-col justify-between ${
                needsFollowUp
                  ? 'border-[var(--paper-accent)]/50 bg-[var(--paper-highlight)]/20'
                  : 'border-[var(--paper-border)]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold text-base text-[var(--paper-text)]">{contact.name}</h3>
                    {contact.company && (
                      <p className="text-xs text-[var(--paper-muted)] font-mono">{contact.company}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {needsFollowUp && (
                      <span className="text-[10px] font-mono text-[var(--paper-accent)] font-semibold flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Follow up ({daysSince}d)
                      </span>
                    )}
                    <button
                      onClick={() => handleDeleteContact(contact.id)}
                      className="p-1 rounded text-[var(--paper-muted)] hover:text-red-500 transition-colors"
                      title="Delete contact"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {contact.familyDetails && (
                  <p className="text-xs text-[var(--paper-text)] italic font-serif mt-2 p-2 rounded bg-[var(--paper-card-subtle)]">
                    {contact.familyDetails}
                  </p>
                )}

                {/* Recent Interaction */}
                {contact.interactions?.length > 0 && (
                  <div className="mt-3 text-xs text-[var(--paper-muted)]">
                    <span className="font-mono text-[10px] uppercase">
                      Last log {contact.interactions[0].date ? `(${formatDateDDMMYYYY(contact.interactions[0].date)})` : ''}:
                    </span>{' '}
                    {contact.interactions[0].summary}
                  </div>
                )}
              </div>

              {/* Log interaction box */}
              <div className="pt-3 mt-3 border-t border-[var(--paper-border)]">
                {activeContactId === contact.id ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={interactionSummary}
                      onChange={(e) => setInteractionSummary(e.target.value)}
                      placeholder="Note on meeting, call, or chat..."
                      className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2.5 py-1 rounded border border-[var(--paper-border)] text-xs"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setActiveContactId(null)}
                        className="px-2 py-0.5 text-xs text-[var(--paper-muted)]"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleLogInteraction(contact.id)}
                        className="px-2.5 py-0.5 text-xs bg-[var(--paper-accent)] text-white rounded font-mono"
                      >
                        Save Log
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setActiveContactId(contact.id);
                      setInteractionSummary('');
                    }}
                    className="text-xs font-mono text-[var(--paper-muted)] hover:text-[var(--paper-accent)] flex items-center gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Log Touchpoint</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
