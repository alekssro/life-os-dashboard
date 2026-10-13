'use client';

import React, { useState, useEffect } from 'react';
import { FolderKanban, Clock, AlertTriangle, Plus, CheckCircle2, Trash2, Hourglass, PauseCircle, Activity, ExternalLink } from 'lucide-react';
import { formatDateDDMMYYYY } from '@/lib/date';

const HEALTH_COLORS = {
  ON_TRACK: { bg: 'bg-green-500/20', border: 'border-green-500/40', text: 'text-green-500', icon: Activity },
  WAITING: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/40', text: 'text-yellow-500', icon: PauseCircle },
  QUIET: { bg: 'bg-gray-500/20', border: 'border-gray-500/40', text: 'text-gray-500', icon: Hourglass },
  AT_RISK: { bg: 'bg-red-500/20', border: 'border-red-500/40', text: 'text-red-500', icon: AlertTriangle },
  COMPLETED: { bg: 'bg-blue-500/20', border: 'border-blue-500/40', text: 'text-blue-500', icon: CheckCircle2 },
};

const HEALTH_LABELS = {
  ON_TRACK: 'On Track',
  WAITING: 'Waiting',
  QUIET: 'Quiet',
  AT_RISK: 'At Risk',
  COMPLETED: 'Completed',
};

export function ProjectsView() {
  const [projects, setProjects] = useState<any[]>([]);
  const [domains, setDomains] = useState<any[]>([]);
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState('MILESTONE');
  const [newDomainId, setNewDomainId] = useState('');
  const [newMonthlyBudget, setNewMonthlyBudget] = useState('');
  const [newWaitingOn, setNewWaitingOn] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editWaitingOn, setEditWaitingOn] = useState('');
  const [editSuperlistUrl, setEditSuperlistUrl] = useState('');

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
        waitingOn: newWaitingOn || null,
      }),
    });

    setNewTitle('');
    setNewMonthlyBudget('');
    setNewWaitingOn('');
    loadProjects();
  };

  const handleSaveEdit = async (id: string, updates: any) => {
    await fetch('/api/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setEditingProjectId(null);
    loadProjects();
  };

  const handleDeleteProject = async (id: string) => {
    if (!confirm('Are you sure you want to delete this project?')) return;
    setProjects((prev) => prev.filter((p) => p.id !== id));
    await fetch(`/api/projects?id=${id}`, { method: 'DELETE' });
  };

  const getHealthIcon = (health: string) => {
    const config = HEALTH_COLORS[health as keyof typeof HEALTH_COLORS] || HEALTH_COLORS.ON_TRACK;
    return config.icon;
  };

  const getHealthStyle = (health: string) => {
    const config = HEALTH_COLORS[health as keyof typeof HEALTH_COLORS] || HEALTH_COLORS.ON_TRACK;
    return config;
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
        <input
          type="text"
          value={newWaitingOn}
          onChange={(e) => setNewWaitingOn(e.target.value)}
          placeholder="Waiting on... (client, vendor, approval)"
          className="flex-1 min-w-[180px] bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] px-3 py-1.5 rounded border border-[var(--paper-border)] text-xs font-mono"
        />
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
          const health = project.health || 'ON_TRACK';
          const healthStyle = getHealthStyle(health);
          const HealthIcon = getHealthIcon(health);

          return (
            <div
              key={project.id}
              onClick={() => {
                if (editingProjectId === project.id) {
                  setEditingProjectId(null);
                } else {
                  setEditingProjectId(project.id);
                  setEditWaitingOn(project.waitingOn || '');
                  setEditSuperlistUrl(project.superlistUrl || (project.superlistListId ? `https://app.superlist.com/lists/${project.superlistListId}` : ''));
                }
              }}
              className={`p-4 rounded border bg-[var(--paper-card)] flex flex-col justify-between transition-colors cursor-pointer ${
                editingProjectId === project.id
                  ? 'border-[var(--paper-accent)] ring-1 ring-[var(--paper-accent)]'
                  : healthStyle.border + ' hover:border-[var(--paper-border-strong)]'
              } ${healthStyle.bg}`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-base text-[var(--paper-text)]">
                    {project.title}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <HealthIcon className={`w-3 h-3 ${healthStyle.text}`} />
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${healthStyle.border} ${healthStyle.text} font-semibold`}>
                      {HEALTH_LABELS[health as keyof typeof HEALTH_LABELS]}
                    </span>
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border border-[var(--paper-border)] text-[var(--paper-muted)]">
                      {project.type.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                {project.domain && (
                  <p className="text-xs font-mono text-[var(--paper-tag)] uppercase mb-3">
                    ● {project.domain.name}
                  </p>
                )}

                {project.waitingOn && health === 'WAITING' && (
                  <p className="text-xs text-[var(--paper-muted)] italic mb-2">
                    Waiting on: {project.waitingOn}
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

                <div className="flex items-center justify-between text-xs text-[var(--paper-muted)]">
                  <span>{project.tasks?.length || 0} open active tasks</span>
                  {(project.superlistUrl || project.superlistListId) && (
                    <a
                      href={project.superlistUrl || `https://app.superlist.com/lists/${project.superlistListId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-[11px] font-mono text-red-600 dark:text-red-400 hover:underline"
                      title="Open list in Superlist"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      Superlist List
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="pt-4 mt-3 border-t border-[var(--paper-border)] flex items-center justify-between text-xs font-mono">
                <div className="flex items-center gap-1">
                  <span className={`flex items-center gap-1 ${healthStyle.text} font-semibold`}>
                    <HealthIcon className="w-3.5 h-3.5" />
                    {HEALTH_LABELS[health as keyof typeof HEALTH_LABELS]}
                  </span>
                  {project.lastActivityAt && (
                    <span className="text-[10px] text-[var(--paper-muted)]">
                      ({formatDateDDMMYYYY(project.lastActivityAt)})
                    </span>
                  )}
                </div>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProject(project.id);
                    }}
                    className="p-1 rounded text-[var(--paper-muted)] hover:text-red-500 transition-colors ml-1"
                    title="Delete project"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Inline edit panel */}
              {editingProjectId === project.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="mt-3 pt-3 border-t border-[var(--paper-border)] space-y-2"
                >
                  <div>
                    <label className="text-xs font-mono text-[var(--paper-muted)]">Waiting on:</label>
                    <input
                      type="text"
                      value={editWaitingOn}
                      onChange={(e) => setEditWaitingOn(e.target.value)}
                      placeholder="Client, vendor, approval..."
                      className="w-full mt-1 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-mono text-[var(--paper-muted)] flex items-center justify-between">
                      <span>Superlist List Link or UUID:</span>
                      <span className="text-[10px] text-[var(--paper-muted)]/70">e.g. https://app.superlist.com/lists/UUID</span>
                    </label>
                    <input
                      type="text"
                      value={editSuperlistUrl}
                      onChange={(e) => setEditSuperlistUrl(e.target.value)}
                      placeholder="https://app.superlist.com/lists/..."
                      className="w-full mt-1 bg-[var(--paper-card-subtle)] text-[var(--paper-text)] px-2 py-1 rounded border border-[var(--paper-border)] text-xs font-mono"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setEditingProjectId(null)}
                      className="px-2 py-1 text-xs text-[var(--paper-muted)] hover:text-[var(--paper-text)]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => {
                        let listId: string | null = null;
                        let url: string | null = editSuperlistUrl.trim() || null;
                        if (url) {
                          const uuidMatch = url.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                          if (uuidMatch) {
                            listId = uuidMatch[0];
                            if (!url.startsWith('http') && !url.startsWith('superlist://')) {
                              url = `https://app.superlist.com/lists/${listId}`;
                            }
                          }
                        }
                        handleSaveEdit(project.id, {
                          waitingOn: editWaitingOn || null,
                          superlistUrl: url,
                          superlistListId: listId,
                        });
                      }}
                      className="px-2 py-1 text-xs bg-[var(--paper-accent)] text-white rounded font-mono"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}