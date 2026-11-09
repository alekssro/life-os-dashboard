'use client';

import React, { useState } from 'react';
import { FileText, Send, Sparkles, Check, Tag } from 'lucide-react';
import { QuickNote } from '@/types';

interface ObsidianCaptureProps {
  onNoteCaptured?: (note: QuickNote) => void;
}

export function ObsidianCapture({ onNoteCaptured }: ObsidianCaptureProps) {
  const [content, setContent] = useState('');
  const [tag, setTag] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setIsSaving(true);
    try {
      const notePayload: QuickNote = {
        title: content.trim().split('\n')[0].slice(0, 50),
        content: content.trim(),
        tags: tag.trim() ? [tag.trim().replace(/^#/, '')] : ['quick-note'],
        timestamp: new Date().toISOString(),
      };

      // Call API capture with QUOTE / LIBRARY target or custom markdown note
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetType: 'LIBRARY',
          text: content.trim(),
          details: {
            title: notePayload.title,
            tags: notePayload.tags?.join(','),
          },
        }),
      });

      if (res.ok) {
        setContent('');
        setTag('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 2500);
        if (onNoteCaptured) onNoteCaptured(notePayload);
      }
    } catch (err) {
      console.error('Failed to capture Obsidian note:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[var(--paper-accent)]" />
          <h3 className="font-semibold text-sm text-[var(--paper-text)]">Obsidian Quick Capture</h3>
        </div>
        <span className="text-[11px] text-[var(--paper-muted)] font-mono">#daily-notes</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2.5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Capture an idea, reference, or note formatted in markdown..."
          rows={3}
          className="w-full text-xs font-mono bg-[var(--paper-card-subtle)] text-[var(--paper-text)] border border-[var(--paper-border)] rounded-lg p-2.5 outline-none focus:border-[var(--paper-accent)] focus:ring-1 focus:ring-[var(--paper-accent)] placeholder:text-[var(--paper-muted)] resize-none"
        />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--paper-muted)]">
            <Tag className="w-3.5 h-3.5" />
            <input
              type="text"
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="tag (e.g. ideas)"
              className="bg-transparent border-b border-[var(--paper-border)] px-1 py-0.5 text-xs text-[var(--paper-text)] outline-none focus:border-[var(--paper-accent)] placeholder:text-[var(--paper-muted)]"
            />
          </div>

          <button
            type="submit"
            disabled={!content.trim() || isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--paper-accent)] text-white text-xs font-medium hover:bg-[var(--paper-accent-hover)] transition disabled:opacity-50"
          >
            {success ? (
              <>
                <Check className="w-3.5 h-3.5" /> Captured
              </>
            ) : isSaving ? (
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <Send className="w-3.5 h-3.5" /> Save Note
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
