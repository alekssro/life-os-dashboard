'use client';

import React, { useState, useEffect } from 'react';
import { Layers, Plus, CheckCircle, Folder, Trash2 } from 'lucide-react';

export function DomainsView() {
  const [domains, setDomains] = useState<any[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#B84A39');

  const loadDomains = async () => {
    const res = await fetch('/api/domains');
    if (res.ok) setDomains(await res.json());
  };

  useEffect(() => {
    loadDomains();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    await fetch('/api/domains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        color: newColor,
      }),
    });

    setNewName('');
    loadDomains();
  };

  const handleDeleteDomain = async (id: string) => {
    if (!confirm('Are you sure you want to delete this domain? Associated projects and tasks will be unlinked.')) return;
    setDomains((prev) => prev.filter((d) => d.id !== id));
    await fetch(`/api/domains?id=${id}`, { method: 'DELETE' });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--paper-text)]">Life Domains</h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase">
            Top-Level Areas of Responsibility
          </p>
        </div>
      </div>

      {/* Add Domain Form */}
      <form onSubmit={handleCreate} className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] flex gap-3">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Work, Content, Home, Health, Finance..."
          className="flex-1 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
        />
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="w-10 h-8 p-1 rounded bg-[var(--paper-card-subtle)] border border-[var(--paper-border)] cursor-pointer"
        />
        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-[var(--paper-accent)] text-white font-mono text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Domain</span>
        </button>
      </form>

      {/* Domains Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {domains.map((domain) => (
          <div
            key={domain.id}
            className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] space-y-2"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: domain.color || 'var(--paper-accent)' }}
                />
                <h3 className="font-semibold text-base text-[var(--paper-text)]">{domain.name}</h3>
              </div>
              <button
                onClick={() => handleDeleteDomain(domain.id)}
                className="p-1 rounded text-[var(--paper-muted)] hover:text-red-500 transition-colors"
                title="Delete domain"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="pt-2 border-t border-[var(--paper-border)] text-xs font-mono text-[var(--paper-muted)] flex justify-between">
              <span>{domain._count?.projects || 0} projects</span>
              <span>{domain._count?.tasks || 0} tasks</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
