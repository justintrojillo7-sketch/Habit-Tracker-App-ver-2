import React, { useMemo, useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { CATEGORIES } from '../data/seedData';
import { useLifeHQ } from '../context/LifeHQContext';
import { CategoryId, Goal, Milestone } from '../types/lifehq';

export const GoalsView: React.FC = () => {
  const { state, getCategoryMeta, toggleMilestone, upsertGoal, deleteGoal } =
    useLifeHQ();

  const [filterCat, setFilterCat] = useState<CategoryId | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  // Modal fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<CategoryId>('behold');
  const [targetDate, setTargetDate] = useState('');
  const [measurableTarget, setMeasurableTarget] = useState('');
  const [progressMode, setProgressMode] = useState<Goal['progressMode']>('milestones');
  const [manualProgress, setManualProgress] = useState(0);
  const [status, setStatus] = useState<Goal['status']>('active');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [newMilestoneText, setNewMilestoneText] = useState('');

  const openModal = (goal?: Goal) => {
    if (goal) {
      setEditingGoal(goal);
      setTitle(goal.title);
      setDescription(goal.description);
      setCategory(goal.category);
      setTargetDate(goal.targetDate ?? '');
      setMeasurableTarget(goal.measurableTarget ?? '');
      setProgressMode(goal.progressMode);
      setManualProgress(goal.manualProgress);
      setStatus(goal.status);
      setMilestones(goal.milestones);
    } else {
      setEditingGoal(null);
      setTitle('');
      setDescription('');
      setCategory(filterCat === 'all' ? 'behold' : filterCat);
      setTargetDate('');
      setMeasurableTarget('');
      setProgressMode('milestones');
      setManualProgress(0);
      setStatus('active');
      setMilestones([]);
    }
    setNewMilestoneText('');
    setModalOpen(true);
  };

  const computeProgress = (g: Goal): number => {
    if (g.status === 'completed') return 100;
    if (g.progressMode === 'milestones' && g.milestones.length > 0) {
      const done = g.milestones.filter((m) => m.completed).length;
      return Math.round((done / g.milestones.length) * 100);
    }
    return g.manualProgress;
  };

  const filteredGoals = useMemo(
    () =>
      filterCat === 'all'
        ? state.goals
        : state.goals.filter((g) => g.category === filterCat),
    [state.goals, filterCat]
  );

  const handleSaveGoal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const payload: Goal = {
      id: editingGoal?.id ?? `goal-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      category,
      targetDate: targetDate || undefined,
      measurableTarget: measurableTarget.trim() || undefined,
      progressMode,
      manualProgress,
      status,
      milestones,
    };
    upsertGoal(payload);
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Goals &amp; Outcomes
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Progress is driven by real milestones and finished outputs rather
            than hours logged alone.
          </p>
        </div>

        <button
          onClick={() => openModal()}
          className="inline-flex items-center gap-1.5 min-h-[40px] px-4 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 self-start whitespace-nowrap"
        >
          <Plus className="w-4 h-4" /> New goal
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          onClick={() => setFilterCat('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
            filterCat === 'all'
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
          }`}
        >
          All ({state.goals.length})
        </button>
        {CATEGORIES.map((c) => {
          const count = state.goals.filter((g) => g.category === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setFilterCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                filterCat === c.id
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300'
              }`}
            >
              {c.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Goals Grid */}
      {filteredGoals.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-10 text-center space-y-2">
          <p className="text-sm font-medium">No goals in this category yet</p>
          <button
            onClick={() => openModal()}
            className="text-xs font-semibold underline"
          >
            Add one now
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredGoals.map((goal) => {
            const cat = getCategoryMeta(goal.category);
            const pct = computeProgress(goal);
            return (
              <div
                key={goal.id}
                className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: cat.colour }}
                      />
                      <span>{cat.label}</span>
                      <span>·</span>
                      <span className="capitalize">{goal.status}</span>
                      {goal.targetDate && (
                        <>
                          <span>·</span>
                          <span className="font-mono tabular-nums">
                            Due {goal.targetDate}
                          </span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => openModal(goal)}
                      className="text-xs font-medium text-slate-500 hover:text-slate-900 dark:hover:text-white"
                    >
                      Edit
                    </button>
                  </div>

                  <h2 className="text-base font-semibold mt-1.5">
                    {goal.title}
                  </h2>
                  {goal.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      {goal.description}
                    </p>
                  )}
                  {goal.measurableTarget && (
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 mt-2">
                      Target: {goal.measurableTarget}
                    </p>
                  )}
                </div>

                {/* Progress Bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-slate-500 dark:text-slate-400">
                      Progress
                    </span>
                    <span className="font-mono tabular-nums font-semibold">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: cat.colour,
                      }}
                    />
                  </div>
                </div>

                {/* Milestones */}
                {goal.milestones.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    {goal.milestones.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => toggleMilestone(goal.id, m.id)}
                        className="w-full flex items-center gap-2.5 text-left py-1 text-xs group"
                      >
                        <span
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition ${
                            m.completed
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 dark:border-slate-600 group-hover:border-slate-500'
                          }`}
                        >
                          {m.completed && <Check className="w-3 h-3" />}
                        </span>
                        <span
                          className={
                            m.completed
                              ? 'line-through text-slate-400'
                              : 'text-slate-700 dark:text-slate-200'
                          }
                        >
                          {m.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Goal Editor Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 p-5 sm:p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">
                {editingGoal ? 'Edit Goal' : 'New Goal'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveGoal} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryId)}
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value as Goal['status'])
                    }
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  >
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Target date
                  </label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">
                    Measurable target
                  </label>
                  <input
                    type="text"
                    value={measurableTarget}
                    onChange={(e) => setMeasurableTarget(e.target.value)}
                    placeholder="e.g. 5 reels"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1.5">
                  Milestones
                </label>
                <div className="space-y-1.5 mb-2">
                  {milestones.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between gap-2 text-xs bg-slate-50 dark:bg-slate-900 px-3 py-2 rounded-xl"
                    >
                      <span>{m.title}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setMilestones((prev) =>
                            prev.filter((item) => item.id !== m.id)
                          )
                        }
                        className="text-slate-400 hover:text-rose-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMilestoneText}
                    onChange={(e) => setNewMilestoneText(e.target.value)}
                    placeholder="Add milestone..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (!newMilestoneText.trim()) return;
                      setMilestones((prev) => [
                        ...prev,
                        {
                          id: `ms-${Date.now()}`,
                          title: newMilestoneText.trim(),
                          completed: false,
                        },
                      ]);
                      setNewMilestoneText('');
                    }}
                    className="px-3 py-2 rounded-xl text-xs font-medium bg-slate-100 dark:bg-slate-800"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                {editingGoal ? (
                  <button
                    type="button"
                    onClick={() => {
                      deleteGoal(editingGoal.id);
                      setModalOpen(false);
                    }}
                    className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 px-3 py-2 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/40"
                  >
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  >
                    Save goal
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
