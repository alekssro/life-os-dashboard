'use client';

import React, { useState, useEffect } from 'react';
import { FolderKanban, Clock, AlertTriangle, Plus, CheckCircle2, Trash2 } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date';

export function ProjectsView() {
  const [projects, setProjects] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('MILESTONE');
  const [newDomainId, setNewDomainId] = useState('');
  const [newMonthlyBudget, setNewMonthlyBudget] = useState('');

  const loadProjects = async () => {
    const [pRes, dRes] = await Promise.all([
      fetch('/api/projects'),
      fetch('/api/domains'),
    ]);
    if (pRes.ok) setProjects(await pRes.json());
    if (dRes.ok) setDomains(await dRes.json());
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle,
        type: newType,
        domainId: newDomainId || null,
        monthlyBudgetHours: newMonthlyBudget || null,
      }),
    });

    setNewTitle('');
    setNewMonthlyBudget('');
    loadProjects();
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
  };

  const isSlipping = (lastActivity: string) => {
    const days = Math.floor(
      (new Date().getTime() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24)
    );
    return days >= 14 ? days : null;
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--paper-text)]">Projects</h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase">
            Milestones, Retainers & Activity Health
          </p>
        </div>
      </div>

      {/* Quick Add Form */}
      <form onSubmit={handleCreate} className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)] flex flex-wrap gap-3">
        <input
          type="text"
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="New Project Title..."
          className="flex-1 min-w-[200px] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
        >
          <option value="MILESTONE">Milestone</option>
          <option value="RETAINER">Monthly Retainer</option>
          <option value="ONGOING_AREA">Ongoing Area</option>
        </select>
        <select
          value={newDomainId}
          onChange={(e) => setNewDomainId(e.target.value)}
          className="bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
        >
          <option value="">No Domain</option>
          {domains.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
        {newType === 'RETAINER' && (
          <input
            type="number"
            value={newMonthlyBudget}
            onChange={(e) => setNewMonthlyBudget(e.target.value)}
            placeholder="Budget Hrs/mo"
            className="w-32 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
          />
        )}
        <button
          type="submit"
          className="px-4 py-1.5 rounded bg-[var(--paper-accent)] text-white font-mono text-xs flex items-center gap-1.5"
        >
          <Plus className="w-4 h-4" />
          <span>Add Project</span>
        </button>
      </form>

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {projects.map((project) => {
          const slippingDays = isSlipping(project.lastActivityAt);
          return (
            <div
              key={project.id}
              className={`p-4 rounded border bg-[var(--paper-card)] flex flex-col justify-between transition-colors ${
                slippingDays
                  ? 'border-[var(--paper-accent)]/60 bg-[var(--paper-highlight)]/30'
                  : 'border-[var(--paper-border)]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base text-[var(--paper-text)]">
                    {project.title}
                  </h3>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-[var(--paper-border)] text-[var(--paper-muted)]">
                    {project.type.replace('_', ' ')}
                  </span>
                </div>

                {project.domain && (
                  <p className="text-xs font-mono text-[var(--paper-tag)] uppercase mb-3">
                    ● {project.domain.name}
                  </p>
                )}

                {/* Retainer metrics if applicable */}
                {project.type === 'RETAINER' && project.monthlyBudgetHours && (
                  <div className="mb-3 p-2 rounded bg-[var(--paper-card-subtle)] text-xs font-mono flex items-center justify-between">
                    <span className="text-[var(--paper-muted)]">Monthly Retainer:</span>
                    <span className="font-semibold text-[var(--paper-text)]">
                      {project.hoursLogged || 0} / {project.monthlyBudgetHours} hrs
                    </span>
                  </div>
                )}

                <div className="text-xs text-[var(--paper-muted)]">
                  {project.tasks?.length || 0} open active tasks
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 mt-3 border-t border-[var(--paper-border)] flex items-center justify-between text-xs font-mono">
                {slippingDays ? (
                  <span className="flex items-center gap-1 text-[var(--paper-accent)] font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Inactive {slippingDays} days (Slipping)
                  </span>
                ) : (
                  <span className="text-[var(--paper-muted)] flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    Active
                  </span>
                )}
                <div className="flex items-center gap-2">
                  {project.targetDate && (
                    <span className="text-[10px] text-[var(--paper-muted)]">
                      Due: {formatDateDDMMYYYY(project.targetDate)}
                    </span>
                  )}
                  <span className="text-[10px] uppercase text-[var(--paper-muted)]">
                    {project.status}
                  </span>
                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="p-1 rounded text-[var(--paper-muted)] hover:text-red-500 transition-colors ml-1"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
