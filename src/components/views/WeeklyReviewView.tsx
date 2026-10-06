'use client';

import React, { useState, useEffect } from 'react';
import {
  CheckSquare,
  Square,
  Flame,
  BookOpen,
  AlertTriangle,
  PauseCircle,
  Hourglass,
  Activity,
  Trash2,
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatDateDDMMYYYY, getWeekStart, getWeekEnd, formatDateYYYYMMDD } from '@/lib/date';
import { formatWeekday } from '@/lib/date';

export function WeeklyReviewView() {
  const [data, setData] = useState<{
    completedTasks: any[];
    routines: any[];
    projects: any[];
    libraryItems: any[];
    weekStart: string;
    weekEnd: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(true);
  const [showRoutines, setShowRoutines] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showLibrary, setShowLibrary] = useState(true);
  const [notes, setNotes] = useState({
    whatMovedForward: '',
    whatGotStuck: '',
    nextWeekFocus: '',
  });

  useEffect(() => {
    loadWeeklyReview();
  }, []);

  const loadWeeklyReview = async () => {
    setIsLoading(true);
    try {
      const weekStart = getWeekStart(new Date());
      const weekEnd = getWeekEnd(new Date());
      const weekStartStr = formatDateYYYYMMDD(weekStart);
      const weekEndStr = formatDateYYYYMMDD(weekEnd);

      const [tasksRes, routinesRes, projectsRes, libraryRes] = await Promise.all([
        fetch(`/api/tasks?status=DONE&since=${weekStartStr}`),
        fetch('/api/routines'),
        fetch('/api/projects'),
        fetch(`/api/library?since=${weekStartStr}&limit=10`),
      ]);

      const completedTasks = tasksRes.ok ? await tasksRes.json() : [];
      const routinesData = routinesRes.ok ? await routinesRes.json() : { routines: [] };
      const projects = projectsRes.ok ? await projectsRes.json() : [];
      const libraryItems = libraryRes.ok ? await libraryRes.json() : [];

      setData({
        completedTasks,
        routines: routinesData.routines || [],
        projects,
        libraryItems,
        weekStart: weekStartStr,
        weekEnd: weekEndStr,
      });
    } catch (err) {
      console.error('Error loading weekly review:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getHealthConfig = (health: string) => {
    switch (health) {
      case 'ON_TRACK':
        return { icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/40', label: 'On Track' };
      case 'WAITING':
        return { icon: PauseCircle, color: 'text-yellow-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', label: 'Waiting' };
      case 'QUIET':
        return { icon: Hourglass, color: 'text-gray-500', bg: 'bg-gray-500/10', border: 'border-gray-500/40', label: 'Quiet' };
      case 'AT_RISK':
        return { icon: AlertTriangle, color: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/40', label: 'At Risk' };
      case 'COMPLETED':
        return { icon: CheckSquare, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/40', label: 'Completed' };
      default:
        return { icon: Activity, color: 'text-green-500', bg: 'bg-green-500/10', border: 'border-green-500/40', label: 'On Track' };
    }
  };

  const handleExportMarkdown = () => {
    if (!data) return;

    const weekStartDate = new Date(data.weekStart);
    const weekEndDate = new Date(data.weekEnd);
    const markdown = `# Weekly Review: ${formatWeekday(weekStartDate)}, ${formatDateDDMMYYYY(weekStartDate)} – ${formatDateDDMMYYYY(weekEndDate)}

## ✅ Completed Tasks (${data.completedTasks.length})
${data.completedTasks.map((t: any) => `- ${t.title}${t.domain ? ` [${t.domain.name}]` : ''}${t.project ? ` (${t.project.title})` : ''}`).join('\n') || 'No tasks completed this week.'}

## 🔥 Routine Consistency
${data.routines.map((r: any) => `- ${r.icon} ${r.title}: ${r.consistencyScore}% (streak: ${r.streak})`).join('\n') || 'No routines tracked.'}

## 📊 Project Health
${data.projects.map((p: any) => {
  const h = getHealthConfig(p.health || 'ON_TRACK');
  return `- **${p.title}** [${h.label}]${p.waitingOn ? ` – Waiting on: ${p.waitingOn}` : ''}${p.domain ? ` (${p.domain.name})` : ''}`;
}).join('\n') || 'No projects.'}

## 📚 Resurfaced Wisdom
${data.libraryItems.map((item: any) => `- "${item.body}"${item.author ? ` — ${item.author}` : ''}`).join('\n') || 'No library items resurfaced.'}

## 📝 Reflection
**What moved forward this week:**
${notes.whatMovedForward || '_(add your thoughts)_'}

**What got stuck:**
${notes.whatGotStuck || '_(add your thoughts)_'}

**Next week's Top 3 focus:**
${notes.nextWeekFocus || '_(add your thoughts)_'}
`;

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-review-${data.weekStart}-to-${data.weekEnd}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--paper-accent)] mx-auto"></div>
        <p className="mt-4 text-[var(--paper-muted)]">Loading weekly review...</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 text-center">
        <p className="text-[var(--paper-muted)]">Failed to load weekly review data.</p>
      </div>
    );
  }

  const weekStartDate = new Date(data.weekStart);
  const weekEndDate = new Date(data.weekEnd);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--paper-border)] gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-[var(--paper-text)]">Weekly Review</h1>
          <p className="text-xs font-mono text-[var(--paper-muted)] mt-1 uppercase">
            {formatWeekday(weekStartDate)}, {formatDateDDMMYYYY(weekStartDate)} – {formatDateDDMMYYYY(weekEndDate)}
          </p>
        </div>
        <button
          onClick={handleExportMarkdown}
          className="flex items-center gap-2 px-4 py-2 rounded bg-[var(--paper-accent)] text-white font-mono text-xs hover:opacity-90"
        >
          <Download className="w-4 h-4" />
          <span>Export Markdown</span>
        </button>
      </div>

      {/* Section Toggles */}
      <div className="flex flex-wrap gap-2 p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card)]">
        <button
          onClick={() => setShowCompleted(!showCompleted)}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            showCompleted
              ? 'bg-[var(--paper-accent)] text-white'
              : 'border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
          }`}
        >
          ✅ Completed ({data.completedTasks.length})
        </button>
        <button
          onClick={() => setShowRoutines(!showRoutines)}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            showRoutines
              ? 'bg-[var(--paper-accent)] text-white'
              : 'border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
          }`}
        >
          🔥 Routines ({data.routines.length})
        </button>
        <button
          onClick={() => setShowProjects(!showProjects)}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            showProjects
              ? 'bg-[var(--paper-accent)] text-white'
              : 'border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
          }`}
        >
          📊 Projects ({data.projects.length})
        </button>
        <button
          onClick={() => setShowLibrary(!showLibrary)}
          className={`px-3 py-1.5 rounded text-xs font-mono transition-colors ${
            showLibrary
              ? 'bg-[var(--paper-accent)] text-white'
              : 'border border-[var(--paper-border)] text-[var(--paper-muted)] hover:text-[var(--paper-text)]'
          }`}
        >
          📚 Library ({data.libraryItems.length})
        </button>
      </div>

      {/* Completed Tasks */}
      {showCompleted && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
            Completed Tasks
          </h2>
          <div className="space-y-2">
            {data.completedTasks.length > 0 ? (
              data.completedTasks.map((task: any) => (
                <div
                  key={task.id}
                  className="p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card)]"
                >
                  <div className="flex items-center gap-3">
                    <CheckSquare className="w-4 h-4 text-[var(--paper-accent)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--paper-text)] line-through">{task.title}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        {task.domain && (
                          <span className="flex items-center gap-1 text-[10px] font-mono uppercase text-[var(--paper-tag)]">
                            <span
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ backgroundColor: task.domain.color || 'var(--paper-accent)' }}
                            />
                            {task.domain.name}
                          </span>
                        )}
                        {task.project && (
                          <span className="text-[10px] font-mono text-[var(--paper-muted)]">
                            {task.project.title}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded border border-dashed border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                No tasks completed this week.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Routines */}
      {showRoutines && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
            Routine Consistency
          </h2>
          <div className="space-y-2">
            {data.routines.length > 0 ? (
              data.routines.map((r: any) => (
                <div
                  key={r.id}
                  className="p-3 rounded border border-[var(--paper-border)] bg-[var(--paper-card)]"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-base">{r.icon}</span>
                      <div>
                        <p className="text-sm font-medium text-[var(--paper-text)]">{r.title}</p>
                        <p className="text-[10px] font-mono uppercase text-[var(--paper-muted)]">
                          {r.frequency} · {r.timeOfDay}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className={`flex items-center gap-1 font-mono font-semibold ${
                        r.consistencyScore >= 80 ? 'text-green-500' : r.consistencyScore >= 50 ? 'text-yellow-500' : 'text-red-500'
                      }`}>
                        <Flame className="w-4 h-4 fill-current" />
                        {r.consistencyScore}%
                      </span>
                      {r.streak > 0 && (
                        <span className="flex items-center gap-1 text-[10px] font-mono text-[var(--paper-muted)]">
                          🔥 {r.streak}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-4 rounded border border-dashed border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                No routines configured.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Projects */}
      {showProjects && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
            Project Health
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.projects.length > 0 ? (
              data.projects.map((p: any) => {
                const health = getHealthConfig(p.health || 'ON_TRACK');
                const HealthIcon = health.icon;
                return (
                  <div
                    key={p.id}
                    className={`p-4 rounded border ${health.border} ${health.bg}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="font-semibold text-base text-[var(--paper-text)]">{p.title}</h3>
                      <div className="flex items-center gap-1.5">
                        <HealthIcon className={`w-3 h-3 ${health.color}`} />
                        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${health.border} ${health.color} font-semibold`}>
                          {health.label}
                        </span>
                      </div>
                    </div>

                    {p.domain && (
                      <p className="text-xs font-mono text-[var(--paper-tag)] uppercase mb-2">
                        ● {p.domain.name}
                      </p>
                    )}

                    {p.waitingOn && p.health === 'WAITING' && (
                      <p className="text-xs text-[var(--paper-muted)] italic mb-2">
                        Waiting on: {p.waitingOn}
                      </p>
                    )}

                    {p.type === 'RETAINER' && p.monthlyBudgetHours && (
                      <div className="mb-2 p-2 rounded bg-[var(--paper-card-subtle)] text-xs font-mono flex items-center justify-between">
                        <span className="text-[var(--paper-muted)]">Retainer:</span>
                        <span className="font-semibold text-[var(--paper-text)]">
                          {p.hoursLogged || 0} / {p.monthlyBudgetHours} hrs
                        </span>
                      </div>
                    )}

                    <div className="text-xs text-[var(--paper-muted)]">
                      {p.tasks?.length || 0} open tasks
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 p-4 rounded border border-dashed border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                No projects found.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Library / Resurfaced */}
      {showLibrary && (
        <section className="space-y-3">
          <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
            Resurfaced Wisdom
          </h2>
          <div className="space-y-3">
            {data.libraryItems.length > 0 ? (
              data.libraryItems.map((item: any) => (
                <div
                  key={item.id}
                  className="p-4 rounded border border-[var(--paper-border)] bg-[var(--paper-card)]"
                >
                  <p className="font-serif italic text-sm text-[var(--paper-text)] leading-relaxed">
                    "{item.body}"
                  </p>
                  {item.author && (
                    <p className="text-xs font-mono text-[var(--paper-muted)] mt-2 text-right">
                      — {item.author}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <div className="p-4 rounded border border-dashed border-[var(--paper-border)] text-xs text-[var(--paper-muted)] italic text-center font-serif">
                No library items resurfaced this week.
              </div>
            )}
          </div>
        </section>
      )}

      {/* Reflection Notes */}
      <section className="space-y-4 pt-4 border-t border-[var(--paper-border)]">
        <h2 className="text-xs font-mono font-semibold tracking-wider uppercase text-[var(--paper-muted)]">
          Reflection & Planning
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-mono text-[var(--paper-muted)] mb-1">
              What moved forward this week?
            </label>
            <textarea
              value={notes.whatMovedForward}
              onChange={(e) => setNotes({ ...notes, whatMovedForward: e.target.value })}
              rows={3}
              className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] p-3 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
              placeholder="What progressed? What did you ship? What decisions were made?"
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[var(--paper-muted)] mb-1">
              What got stuck?
            </label>
            <textarea
              value={notes.whatGotStuck}
              onChange={(e) => setNotes({ ...notes, whatGotStuck: e.target.value })}
              rows={3}
              className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] p-3 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
              placeholder="Blockers, delays, things that didn't move. Be honest."
            />
          </div>
          <div>
            <label className="block text-xs font-mono text-[var(--paper-muted)] mb-1">
              Next week's Top 3 focus
            </label>
            <textarea
              value={notes.nextWeekFocus}
              onChange={(e) => setNotes({ ...notes, nextWeekFocus: e.target.value })}
              rows={3}
              className="w-full bg-[var(--paper-card-subtle)] text-[var(--paper-text)] placeholder-[var(--paper-muted)] p-3 rounded border border-[var(--paper-border)] text-sm focus:outline-none focus:border-[var(--paper-accent)]"
              placeholder="What are the 3 most important things to advance next week?"
            />
          </div>
        </div>
      </section>
    </div>
  );
}