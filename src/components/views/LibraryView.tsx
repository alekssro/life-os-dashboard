'use client';

import React, { useState, useEffect } from 'react';
import { BookOpen, Plus, Quote, Sparkles, Trash2 } from 'lucide-react';

export function LibraryView() {
  const [items, setItems] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newAuthor, setNewAuthor] = useState('');

  const loadItems = async () => {
    const res = await fetch('/api/library');
    if (res.ok) setItems(await res.json());
  };

  useEffect(() => {
    loadItems();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBody.trim()) return;

    await fetch('/api/library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle || newBody.slice(0, 40),
        body: newBody,
        author: newAuthor || null,
        type: 'QUOTE',
      }),
    });

    setNewTitle('');
    setNewBody('');
    setNewAuthor('');
    loadItems();
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this item?')) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await fetch(`/api/library?id=${id}`, { method: 'DELETE' });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--paper-text)]">Library & Insights</h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase">
            Quotes, Highlights & Resurfacing Wisdom
          </p>
        </div>
      </div>

      {/* Add Item Form */}
      <form onSubmit={handleCreate} className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] space-y-3">
        <textarea
          rows={3}
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          placeholder="Quote or book highlight text..."
          className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] p-3 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
        />
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            value={newAuthor}
            onChange={(e) => setNewAuthor(e.target.value)}
            placeholder="Author / Book Title..."
            className="flex-1 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
          />
          <button
            type="submit"
            className="px-4 py-1.5 rounded bg-[var(--paper-accent)] text-white font-mono text-xs flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Save to Library</span>
          </button>
        </div>
      </form>

      {/* Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className="p-5 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] flex flex-col justify-between"
          >
            <p className="font-serif italic text-sm text-[var(--paper-text)] leading-relaxed">
              "{item.body}"
            </p>
            <div className="flex items-center justify-between mt-4 pt-2 border-t border-[var(--paper-border)]">
              <button
                onClick={() => handleDeleteItem(item.id)}
                className="p-1 rounded text-[var(--paper-muted)] hover:text-red-500 transition-colors"
                title="Delete item"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              {item.author && (
                <p className="font-mono text-xs text-[var(--paper-muted)] text-right">
                  — {item.author}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
