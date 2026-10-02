'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Mic,
  MicOff,
  Send,
  Sparkles,
  Check,
  Loader2,
  CheckSquare,
  Repeat,
  FolderKanban,
  Users,
  BookOpen,
  Layers,
  Star,
} from 'lucide-react';

export type CaptureType = 'AUTO' | 'TASK' | 'ROUTINE' | 'PROJECT' | 'PERSON' | 'QUOTE' | 'DOMAIN';

interface CaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCaptured: () => void;
}

export function CaptureModal({ isOpen, onClose, onCaptured }: CaptureModalProps) {
  const [activeType, setActiveType] = useState<CaptureType>('AUTO');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Extra fields for deterministic creation without AI
  const [domains, setDomains] = useState<any[]>([]);
  const [domainId, setDomainId] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('NORMAL');
  const [isTop3, setIsTop3] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<'MORNING' | 'AFTERNOON' | 'EVENING'>('MORNING');
  const [routineIcon, setRoutineIcon] = useState('✨');
  const [projectType, setProjectType] = useState('MILESTONE');
  const [company, setCompany] = useState('');
  const [familyDetails, setFamilyDetails] = useState('');
  const [author, setAuthor] = useState('');
  const [domainColor, setDomainColor] = useState('#B84A39');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Load domains when opening
  useEffect(() => {
    if (isOpen) {
      fetch('/api/domains')
        .then((res) => (res.ok ? res.json() : []))
        .then((data) => setDomains(data))
        .catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
      setStatusMsg(null);
    }
  }, [isOpen]);

  // Global keyboard shortcuts (Cmd+J / Cmd+K / Esc)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'j' || e.key === 'k')) {
        e.preventDefault();
        if (isOpen) {
          onClose();
        }
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset form fields
  const resetForm = () => {
    setText('');
    setDomainId('');
    setDueDate('');
    setPriority('NORMAL');
    setIsTop3(false);
    setTimeOfDay('MORNING');
    setRoutineIcon('✨');
    setProjectType('MILESTONE');
    setCompany('');
    setFamilyDetails('');
    setAuthor('');
    setDomainColor('#B84A39');
    setStatusMsg(null);
  };

  // Voice recording
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          stream.getTracks().forEach((track) => track.stop());

          setIsSubmitting(true);
          setStatusMsg('Transcribing and processing voice memo...');

          const formData = new FormData();
          formData.append('audio', audioBlob, 'voice-memo.webm');
          formData.append('targetType', activeType);

          try {
            const res = await fetch('/api/capture', {
              method: 'POST',
              body: formData,
            });
            const data = await res.json();
            if (res.ok) {
              setStatusMsg(`✓ Captured: ${data.item?.title || data.item?.name || 'Item created'}`);
              setTimeout(() => {
                onCaptured();
                onClose();
                resetForm();
              }, 1000);
            } else {
              setStatusMsg(data.error || 'Audio transcription failed');
            }
          } catch {
            setStatusMsg('Network error capturing voice');
          } finally {
            setIsSubmitting(false);
          }
        };

        mediaRecorder.start();
        setIsRecording(true);
        setStatusMsg('Recording audio... Speak naturally.');
      } catch {
        setStatusMsg('Microphone access denied or unavailable.');
      }
    }
  };

  // Submit capture
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setStatusMsg('Saving item...');

    const payload = {
      text: text.trim(),
      targetType: activeType,
      details: {
        domainId: domainId || null,
        dueDate: dueDate || null,
        priority,
        isTop3,
        timeOfDay,
        icon: routineIcon,
        type: projectType,
        company,
        familyDetails,
        author,
        color: domainColor,
      },
    };

    try {
      const res = await fetch('/api/capture', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`✓ Saved: ${data.item?.title || data.item?.name || 'Created successfully'}`);
        setTimeout(() => {
          onCaptured();
          onClose();
          resetForm();
        }, 600);
      } else {
        setStatusMsg(data.error || 'Capture failed');
      }
    } catch {
      setStatusMsg('Network error while capturing');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const typeTabs: Array<{ id: CaptureType; label: string; icon: any }> = [
    { id: 'AUTO', label: 'Auto (AI/Rule)', icon: Sparkles },
    { id: 'TASK', label: 'Task', icon: CheckSquare },
    { id: 'ROUTINE', label: 'Routine', icon: Repeat },
    { id: 'PROJECT', label: 'Project', icon: FolderKanban },
    { id: 'PERSON', label: 'Person', icon: Users },
    { id: 'QUOTE', label: 'Quote', icon: BookOpen },
    { id: 'DOMAIN', label: 'Domain', icon: Layers },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-xl bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-lg p-5 shadow-lg relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--paper-border)]">
          <div className="flex items-center gap-2">
            <h2 className="font-serif text-lg font-medium text-[var(--paper-text)]">
              Quick Ingestion & Capture
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type / Target Selector Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-4 border-b border-[var(--paper-border)]">
          {typeTabs.map((t) => {
            const Icon = t.icon;
            const isSelected = activeType === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setActiveType(t.id);
                  setStatusMsg(null);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono uppercase whitespace-nowrap transition-colors ${
                  isSelected
                    ? 'bg-[var(--paper-accent)] text-white font-semibold'
                    : 'border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* Dynamic Form based on selected Type */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Main Title / Body Input */}
          {activeType === 'AUTO' || activeType === 'QUOTE' ? (
            <div>
              <label className="block text-xs font-mono text-[var(--paper-muted)] uppercase mb-1">
                {activeType === 'AUTO' ? 'Dump thoughts, task, or paste quote:' : 'Quote or Note Body:'}
              </label>
              <textarea
                ref={inputRef as any}
                rows={4}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  activeType === 'AUTO'
                    ? "Dump anything here:\n• Task: Check oil Ford Ranger due Friday #Home\n• Routine: Drink 500ml water #Morning\n• Contact: Met with Sam Josephson\n• Quote: 'The unexamined life is not worth living'"
                    : 'Type or paste the quote or book excerpt here...'
                }
                className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] p-3 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)] resize-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-xs font-mono text-[var(--paper-muted)] uppercase mb-1">
                {activeType === 'PERSON'
                  ? 'Person Name:'
                  : activeType === 'DOMAIN'
                  ? 'Domain Name:'
                  : `${activeType.charAt(0) + activeType.slice(1).toLowerCase()} Title:`}
              </label>
              <input
                ref={inputRef as any}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={
                  activeType === 'TASK'
                    ? 'Task title (e.g. Schedule meeting with Mal)'
                    : activeType === 'ROUTINE'
                    ? 'Routine title (e.g. Morning 10-min meditation)'
                    : activeType === 'PROJECT'
                    ? 'Project title (e.g. Launch New Website)'
                    : activeType === 'PERSON'
                    ? 'Full Name'
                    : 'Domain Name (e.g. Health & Fitness)'
                }
                className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-2 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
              />
            </div>
          )}

          {/* Type-Specific Fields */}
          {activeType === 'TASK' && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Domain
                </label>
                <select
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
                >
                  <option value="">No Domain</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Due Date
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => setIsTop3(!isTop3)}
                  className={`w-full flex items-center justify-center gap-1.5 p-1.5 rounded border text-xs font-mono transition-colors ${
                    isTop3
                      ? 'border-[var(--paper-star)] bg-[var(--paper-card-subtle)] text-[var(--paper-star)] font-bold'
                      : 'border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
                  }`}
                >
                  <Star className={`w-3.5 h-3.5 ${isTop3 ? 'fill-current' : ''}`} />
                  <span>Top 3 Focus</span>
                </button>
              </div>
            </div>
          )}

          {activeType === 'ROUTINE' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Time of Day
                </label>
                <select
                  value={timeOfDay}
                  onChange={(e) => setTimeOfDay(e.target.value as any)}
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
                >
                  <option value="MORNING">Morning</option>
                  <option value="AFTERNOON">Afternoon</option>
                  <option value="EVENING">Evening</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Emoji Icon
                </label>
                <input
                  type="text"
                  value={routineIcon}
                  onChange={(e) => setRoutineIcon(e.target.value)}
                  placeholder="✨"
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs"
                />
              </div>
            </div>
          )}

          {activeType === 'PROJECT' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Type
                </label>
                <select
                  value={projectType}
                  onChange={(e) => setProjectType(e.target.value)}
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
                >
                  <option value="MILESTONE">Milestone Deliverable</option>
                  <option value="RETAINER">Monthly Retainer</option>
                  <option value="ONGOING_AREA">Ongoing Area</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Domain
                </label>
                <select
                  value={domainId}
                  onChange={(e) => setDomainId(e.target.value)}
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
                >
                  <option value="">No Domain</option>
                  {domains.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeType === 'PERSON' && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Company or Role
                </label>
                <input
                  type="text"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Acme Inc, Partner..."
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                  Family / Personal Context
                </label>
                <input
                  type="text"
                  value={familyDetails}
                  onChange={(e) => setFamilyDetails(e.target.value)}
                  placeholder="e.g. Spouse Mal, 2 kids..."
                  className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs"
                />
              </div>
            </div>
          )}

          {activeType === 'QUOTE' && (
            <div>
              <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                Author / Source
              </label>
              <input
                type="text"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. Marcus Aurelius, Steve Jobs, Book title..."
                className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] p-1.5 rounded border border-[var(--paper-border)] text-xs"
              />
            </div>
          )}

          {activeType === 'DOMAIN' && (
            <div>
              <label className="block text-[10px] font-mono text-[var(--paper-muted)] uppercase mb-0.5">
                Color Tag
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={domainColor}
                  onChange={(e) => setDomainColor(e.target.value)}
                  className="w-8 h-8 rounded border border-[var(--paper-border)] cursor-pointer"
                />
                <span className="text-xs font-mono text-[var(--paper-muted)]">{domainColor}</span>
              </div>
            </div>
          )}

          {/* Status Message */}
          {statusMsg && (
            <div className="flex items-center gap-2 text-xs font-mono text-[var(--paper-accent)] bg-[var(--paper-highlight)] p-2 rounded border border-[var(--paper-border)]">
              {isSubmitting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>{statusMsg}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--paper-border)]">
            <div className="flex items-center gap-2">
              {activeType === 'AUTO' && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-mono border transition-colors ${
                    isRecording
                      ? 'border-red-600 bg-red-500/10 text-red-600 animate-pulse'
                      : 'border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)]'
                  }`}
                >
                  {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                  <span>{isRecording ? 'Stop Recording' : 'Voice Memo'}</span>
                </button>
              )}
              <span className="text-[11px] text-[var(--paper-muted)] font-mono hidden sm:inline">
                {activeType === 'AUTO' ? 'Works online & 100% offline' : 'Direct zero-AI creation'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !text.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-medium bg-[var(--paper-accent)] hover:opacity-90 text-white disabled:opacity-50 transition-opacity"
              >
                {isSubmitting ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Save</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
