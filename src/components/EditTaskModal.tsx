'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { EditTaskPanel } from '@/components/EditTaskPanel';
import { Task, Domain } from '@/types';

interface EditTaskModalProps {
  task: Task | null;
  domains: Domain[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (taskId: string, updates: any) => void;
}

export function EditTaskModal({
  task,
  domains,
  isOpen,
  onClose,
  onSave,
}: EditTaskModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl max-h-[90vh] overflow-y-auto bg-[var(--paper-card)] border border-[var(--paper-border-strong)] rounded-2xl p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-[var(--paper-border)]">
          <h2 className="text-base font-bold text-[var(--paper-text)]">Edit Task</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--paper-muted)] hover:text-[var(--paper-text)] hover:bg-[var(--paper-card-subtle)] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <EditTaskPanel
          task={task}
          domains={domains}
          onSave={(updates) => {
            onSave(task.id, updates);
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
