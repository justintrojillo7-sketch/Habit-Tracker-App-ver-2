import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ExternalLink,
  Film,
  FolderGit2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import { BEHOLD_CORE_DISCIPLINES } from '../data/pillarSeedData';
import { BeholdWeekItem, BeholdWeekStatus } from '../types/lifehq';
import { getActiveBeholdWeek } from '../utils/pillarUtils';

function isSafeHttpUrl(val: string): boolean {
  const trimmed = val.trim().toLowerCase();
  return trimmed.startsWith('https://') || trimmed.startsWith('http://');
}

export const BeholdWorkspace: React.FC = () => {
  const { state, getCategoryMeta, upsertBeholdWeek } = useLifeHQ();
  const beholdMeta = getCategoryMeta('behold');

  const sortedWeeks = useMemo(
    () =>
      state.beholdWeeks
        .slice()
        .sort((a, b) => a.weekNumber - b.weekNumber),
    [state.beholdWeeks]
  );

  const activeRecommended = useMemo(
    () => getActiveBeholdWeek(sortedWeeks),
    [sortedWeeks]
  );

  const [selectedWeekId, setSelectedWeekId] = useState<string>(
    () => activeRecommended?.id ?? sortedWeeks[0]?.id ?? ''
  );

  const selectedWeek = useMemo(
    () =>
      sortedWeeks.find((w) => w.id === selectedWeekId) ??
      activeRecommended ??
      sortedWeeks[0] ??
      null,
    [sortedWeeks, selectedWeekId, activeRecommended]
  );

  const [draft, setDraft] = useState<BeholdWeekItem | null>(selectedWeek);
  const [newShotLabel, setNewShotLabel] = useState('');
  const [addingModule, setAddingModule] = useState(false);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleChallenge, setNewModuleChallenge] = useState('');
  const [newModulePhase, setNewModulePhase] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (selectedWeek) {
      setDraft({
        ...selectedWeek,
        shotList: selectedWeek.shotList.map((s) => ({ ...s })),
      });
    } else {
      setDraft(null);
    }
  }, [selectedWeek]);

  const linkedEventOptions = useMemo(() => {
    const matching = state.events
      .filter((e) => e.category === 'behold')
      .map((e) => ({
        id: e.id,
        label: `${e.title} (${e.startTime}–${e.endTime})`,
      }));
    if (
      draft?.linkedEventId &&
      !matching.some((m) => m.id === draft.linkedEventId)
    ) {
      matching.push({
        id: draft.linkedEventId,
        label: `Linked event (${draft.linkedEventId})`,
      });
    }
    return matching;
  }, [state.events, draft?.linkedEventId]);

  const stats = useMemo(() => {
    const completed = sortedWeeks.filter((w) => w.status === 'completed').length;
    const portfolio = sortedWeeks.filter((w) => w.portfolioReady).length;
    const clientMapped = sortedWeeks.filter((w) =>
      Boolean(w.clientProjectName.trim())
    ).length;
    return { completed, portfolio, clientMapped };
  }, [sortedWeeks]);

  const months = useMemo(() => {
    return [1, 2, 3]
      .map((phase) => ({
        phase,
        title:
          sortedWeeks.find((w) => w.monthPhase === phase)?.monthTitle ??
          `Phase ${phase}`,
        weeks: sortedWeeks.filter((w) => w.monthPhase === phase),
      }))
      .filter((m) => m.weeks.length > 0);
  }, [sortedWeeks]);

  const toggleShot = (shotId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      shotList: draft.shotList.map((s) =>
        s.id === shotId ? { ...s, completed: !s.completed } : s
      ),
    });
  };

  const addShot = () => {
    if (!draft || !newShotLabel.trim()) return;
    setDraft({
      ...draft,
      shotList: [
        ...draft.shotList,
        {
          id: `shot-${Date.now().toString(36)}`,
          label: newShotLabel.trim(),
          completed: false,
        },
      ],
    });
    setNewShotLabel('');
  };

  const removeShot = (shotId: string) => {
    if (!draft) return;
    setDraft({
      ...draft,
      shotList: draft.shotList.filter((s) => s.id !== shotId),
    });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft || !draft.title.trim()) return;
    upsertBeholdWeek({
      ...draft,
      title: draft.title.trim(),
      projectLink: draft.projectLink.trim(),
      clientProjectName: draft.clientProjectName.trim(),
    });
  };

  const handleCreateModule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    const nextNum =
      sortedWeeks.reduce((max, w) => Math.max(max, w.weekNumber), 0) + 1;
    const clampedNum = Math.min(52, Math.max(1, nextNum));
    const created: BeholdWeekItem = {
      id: `craft-wk-${Date.now().toString(36)}`,
      weekNumber: clampedNum,
      monthPhase: newModulePhase,
      monthTitle: `Phase ${newModulePhase}`,
      title: newModuleTitle.trim(),
      challenge: newModuleChallenge.trim() || 'Focused practical exercise',
      learningObjective: '',
      technicalFocus: '',
      practicalExercise: '',
      shotList: [],
      status: 'not-started',
      projectLink: '',
      clientProjectName: '',
      reflectionWorked: '',
      reflectionDidntWork: '',
      reflectionImprove: '',
      portfolioReady: false,
      updatedAt: new Date().toISOString(),
    };
    upsertBeholdWeek(created);
    setSelectedWeekId(created.id);
    setNewModuleTitle('');
    setNewModuleChallenge('');
    setAddingModule(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full mt-2 shrink-0"
              style={{ backgroundColor: beholdMeta.colour }}
            />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Creative Craft &amp; Project Tracker
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                Structured practice modules, production checklists, and post-session reflections.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <span className="text-xs font-mono tabular-nums text-slate-600 dark:text-slate-300">
              {stats.completed}/{sortedWeeks.length} modules · {stats.portfolio}{' '}
              portfolio-ready · {stats.clientMapped} project-linked
            </span>
            <button
              type="button"
              onClick={() => setAddingModule((v) => !v)}
              className="min-h-[38px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <Plus className="w-3.5 h-3.5" /> Add Practice Module
            </button>
          </div>
        </div>

        {addingModule && (
          <form
            onSubmit={handleCreateModule}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3"
          >
            <select
              value={newModulePhase}
              onChange={(e) =>
                setNewModulePhase(Number(e.target.value) as 1 | 2 | 3)
              }
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value={1}>Phase 1</option>
              <option value={2}>Phase 2</option>
              <option value={3}>Phase 3</option>
            </select>
            <input
              type="text"
              required
              value={newModuleTitle}
              onChange={(e) => setNewModuleTitle(e.target.value)}
              placeholder="Module title (e.g. Lighting & Framing)"
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <input
              type="text"
              value={newModuleChallenge}
              onChange={(e) => setNewModuleChallenge(e.target.value)}
              placeholder="Practical challenge (optional)"
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <button
              type="submit"
              className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold"
            >
              Create Module
            </button>
          </form>
        )}

        {BEHOLD_CORE_DISCIPLINES.length > 0 && (
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
              Core Disciplines
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
              {BEHOLD_CORE_DISCIPLINES.map((disc, idx) => (
                <div
                  key={disc}
                  className="rounded-xl border border-slate-200/70 dark:border-slate-800 p-2.5 text-xs"
                >
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {idx + 1}. {disc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Empty state or Module Navigator + Editor */}
      {sortedWeeks.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center space-y-3">
          <Film className="w-6 h-6 mx-auto text-slate-400" />
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            No practice modules added yet
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            Create weekly craft exercises, project checklists, and post-session reflections tailored to your creative work.
          </p>
          {!addingModule && (
            <button
              type="button"
              onClick={() => setAddingModule(true)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" /> Add first module
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Phase / Week Navigator */}
          <div className="lg:col-span-4 space-y-4">
            {months.map((m) => (
              <div
                key={m.phase}
                className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-4 space-y-2"
              >
                <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                  {m.title}
                </p>
                <div className="space-y-1.5">
                  {m.weeks.map((wk) => {
                    const isSel = selectedWeek?.id === wk.id;
                    return (
                      <button
                        key={wk.id}
                        type="button"
                        onClick={() => setSelectedWeekId(wk.id)}
                        className={`w-full text-left px-3 py-2 rounded-xl border transition ${
                          isSel
                            ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                            : 'bg-slate-50/70 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-medium truncate">
                            Wk {wk.weekNumber} · {wk.title}
                          </span>
                          <span
                            className={`text-[11px] shrink-0 ${
                              isSel
                                ? 'opacity-80'
                                : wk.status === 'completed'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : wk.status === 'in-progress'
                                ? 'text-amber-600 dark:text-amber-400'
                                : 'text-slate-400'
                            }`}
                          >
                            {wk.status === 'completed'
                              ? 'Done'
                              : wk.status === 'in-progress'
                              ? 'Active'
                              : 'Queued'}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Selected Week Editable Tracker */}
          {draft && (
            <form
              onSubmit={handleSave}
              className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Film
                    className="w-4 h-4 shrink-0"
                    style={{ color: beholdMeta.colour }}
                  />
                  <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
                    Phase {draft.monthPhase} · Week {draft.weekNumber}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={draft.status}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        status: e.target.value as BeholdWeekStatus,
                      })
                    }
                    className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-medium"
                  >
                    <option value="not-started">Not started</option>
                    <option value="in-progress">In progress</option>
                    <option value="completed">Completed</option>
                  </select>
                  <label className="inline-flex items-center gap-1.5 text-xs font-medium px-3 min-h-[38px] rounded-xl border border-slate-200 dark:border-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.portfolioReady}
                      onChange={(e) =>
                        setDraft({ ...draft, portfolioReady: e.target.checked })
                      }
                      className="w-4 h-4 rounded"
                    />
                    <span>Portfolio-ready</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Module title
                  </label>
                  <input
                    type="text"
                    value={draft.title}
                    onChange={(e) =>
                      setDraft({ ...draft, title: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-medium"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Linked calendar block
                  </label>
                  <select
                    value={draft.linkedEventId ?? ''}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        linkedEventId: e.target.value || undefined,
                      })
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  >
                    <option value="">None (unlinked)</option>
                    {linkedEventOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Weekly challenge
                </label>
                <input
                  type="text"
                  value={draft.challenge}
                  onChange={(e) =>
                    setDraft({ ...draft, challenge: e.target.value })
                  }
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Learning objective
                  </label>
                  <textarea
                    rows={2}
                    value={draft.learningObjective}
                    onChange={(e) =>
                      setDraft({ ...draft, learningObjective: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Technical focus
                  </label>
                  <textarea
                    rows={2}
                    value={draft.technicalFocus}
                    onChange={(e) =>
                      setDraft({ ...draft, technicalFocus: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Practical exercise
                </label>
                <textarea
                  rows={2}
                  value={draft.practicalExercise}
                  onChange={(e) =>
                    setDraft({ ...draft, practicalExercise: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                />
              </div>

              {/* Editable Production Checklist */}
              <div className="rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-200/80 dark:border-slate-800 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-slate-500" />
                    <p className="text-xs font-semibold">
                      Production Checklist (
                      {draft.shotList.filter((s) => s.completed).length}/
                      {draft.shotList.length})
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {draft.shotList.map((shot) => (
                    <div
                      key={shot.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                        <input
                          type="checkbox"
                          checked={shot.completed}
                          onChange={() => toggleShot(shot.id)}
                          className="w-4 h-4 rounded shrink-0"
                        />
                        <span
                          className={
                            shot.completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-800 dark:text-slate-200'
                          }
                        >
                          {shot.label}
                        </span>
                      </label>
                      <button
                        type="button"
                        onClick={() => removeShot(shot.id)}
                        className="p-1 text-slate-400 hover:text-rose-500"
                        aria-label="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newShotLabel}
                    onChange={(e) => setNewShotLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addShot();
                      }
                    }}
                    placeholder="Add step to checklist..."
                    className="flex-1 min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={addShot}
                    className="min-h-[36px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>

              {/* Project Mapping & Project Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                    Project mapping (optional)
                  </label>
                  <input
                    type="text"
                    value={draft.clientProjectName}
                    onChange={(e) =>
                      setDraft({ ...draft, clientProjectName: e.target.value })
                    }
                    placeholder="e.g. Short Film / Client Project"
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    <span className="inline-flex items-center gap-1.5">
                      <FolderGit2 className="w-3.5 h-3.5 text-slate-400" />
                      Project link or folder path
                    </span>
                    {isSafeHttpUrl(draft.projectLink) && (
                      <a
                        href={draft.projectLink.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] underline text-slate-600 dark:text-slate-300"
                      >
                        Open <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </label>
                  <input
                    type="text"
                    value={draft.projectLink}
                    onChange={(e) =>
                      setDraft({ ...draft, projectLink: e.target.value })
                    }
                    placeholder="https://... or local folder reference"
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              {/* Structured Reflection */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    What worked
                  </label>
                  <textarea
                    rows={2}
                    value={draft.reflectionWorked}
                    onChange={(e) =>
                      setDraft({ ...draft, reflectionWorked: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    What didn&apos;t work
                  </label>
                  <textarea
                    rows={2}
                    value={draft.reflectionDidntWork}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        reflectionDidntWork: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    What to improve next
                  </label>
                  <textarea
                    rows={2}
                    value={draft.reflectionImprove}
                    onChange={(e) =>
                      setDraft({ ...draft, reflectionImprove: e.target.value })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium hover:opacity-90 transition inline-flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  Save Week {draft.weekNumber} Progress
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};
