import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Award,
  Check,
  Dumbbell,
  Edit3,
  Flame,
  Plus,
  Shield,
  SlidersHorizontal,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import { STARTER_UPPER_LOWER_TEMPLATE } from '../data/pillarSeedData';
import {
  CardioSessionLog,
  CardioType,
  LoggedExercise,
  WorkoutExerciseTemplate,
  WorkoutPlanSession,
  WorkoutSessionKey,
  WorkoutSessionLog,
} from '../types/lifehq';
import { getIsoWeekday } from '../utils/dateUtils';
import {
  calculateFitnessPersonalRecords,
  getExerciseDoubleProgressionCue,
  getRebuildPhaseInfo,
  getSessionKeyForDateOrEvent,
  getWednesdayCardioPrescription,
} from '../utils/pillarUtils';

type FitnessSubTab = WorkoutSessionKey | 'cardio' | 'records';

export const FitnessWorkspace: React.FC = () => {
  const {
    state,
    now,
    getCategoryMeta,
    upsertWorkoutLog,
    deleteWorkoutLog,
    upsertCardioLog,
    deleteCardioLog,
    updateFitnessConfig,
    logDailyProtein,
  } = useLifeHQ();

  const fitMeta = getCategoryMeta('fitness');
  const config = state.fitnessConfig;

  const initialTab: FitnessSubTab = useMemo(() => {
    if (config.workoutPlan.length === 0) return 'upper_a';
    const wd = getIsoWeekday(now.date);
    if (wd === 3 && config.workoutPlan.length > 0) return 'cardio';
    if (wd === 1 || wd === 4 || wd === 5 || wd === 6) {
      const k = getSessionKeyForDateOrEvent(undefined, wd);
      if (config.workoutPlan.some((p) => p.key === k)) return k;
    }
    return config.workoutPlan[0].key;
  }, [now.date, config.workoutPlan]);

  const [activeTab, setActiveTab] = useState<FitnessSubTab>(initialTab);
  const [newSessionKey, setNewSessionKey] = useState<WorkoutSessionKey>('upper_a');
  const [newSessionTitle, setNewSessionTitle] = useState('');
  const [newSessionFocus, setNewSessionFocus] = useState('');
  const [showReviewPanel, setShowReviewPanel] = useState(false);
  const [reviewDraft, setReviewDraft] = useState(config.programmeReviewNotes);
  const [proteinInput, setProteinInput] = useState(
    () =>
      config.dailyProteinLogs[now.date] !== undefined
        ? String(config.dailyProteinLogs[now.date])
        : ''
  );
  const [editingProteinTargets, setEditingProteinTargets] = useState(false);
  const [minProteinDraft, setMinProteinDraft] = useState(
    String(config.proteinTargetMin)
  );
  const [maxProteinDraft, setMaxProteinDraft] = useState(
    String(config.proteinTargetMax)
  );

  useEffect(() => {
    setReviewDraft(config.programmeReviewNotes);
  }, [config.programmeReviewNotes]);

  const phaseInfo = useMemo(
    () =>
      getRebuildPhaseInfo(
        config.rebuildStartDate,
        now.date,
        config.lastReviewDate
      ),
    [config.rebuildStartDate, now.date, config.lastReviewDate]
  );

  // ========================
  // STRENGTH WORKOUT LOGGER STATE
  // ========================
  const selectedSessionPlan = useMemo(
    () =>
      config.workoutPlan.find((p) => p.key === activeTab) ??
      config.workoutPlan[0] ??
      null,
    [config.workoutPlan, activeTab]
  );

  const [sessionDate, setSessionDate] = useState(now.date);
  const [durationMinutes, setDurationMinutes] = useState(75);
  const [effortRpe, setEffortRpe] = useState<number>(7);
  const [soreness, setSoreness] = useState<number>(2);
  const [recoveryNotes, setRecoveryNotes] = useState('');
  const [recordInTimeline, setRecordInTimeline] = useState(true);
  const [exerciseDrafts, setExerciseDrafts] = useState<LoggedExercise[]>([]);
  const [editingPlan, setEditingPlan] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState(3);
  const [newExRepMin, setNewExRepMin] = useState(8);
  const [newExRepMax, setNewExRepMax] = useState(12);
  const [confirmDeleteWorkoutId, setConfirmDeleteWorkoutId] = useState<
    string | null
  >(null);

  const existingWorkoutForDate = useMemo(() => {
    if (activeTab === 'cardio' || activeTab === 'records') return undefined;
    return state.workoutLogs.find(
      (w) => w.sessionKey === activeTab && w.date === sessionDate
    );
  }, [state.workoutLogs, activeTab, sessionDate]);

  useEffect(() => {
    if (activeTab === 'cardio' || activeTab === 'records') return;
    if (existingWorkoutForDate) {
      setDurationMinutes(existingWorkoutForDate.durationMinutes);
      setEffortRpe(existingWorkoutForDate.effortRpe ?? 7);
      setSoreness(existingWorkoutForDate.soreness ?? 2);
      setRecoveryNotes(existingWorkoutForDate.recoveryNotes ?? '');
      setExerciseDrafts(
        existingWorkoutForDate.exercises.map((ex) => ({
          ...ex,
          sets: ex.sets.map((s) => ({ ...s })),
        }))
      );
      return;
    }

    // Build blank sets prefilled cleanly from last logged weight if available
    const plan = selectedSessionPlan;
    if (!plan) {
      setExerciseDrafts([]);
      return;
    }
    const prevSameSplit = state.workoutLogs
      .filter((w) => w.sessionKey === plan.key && w.date < sessionDate)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    setDurationMinutes(75);
    setEffortRpe(7);
    setSoreness(2);
    setRecoveryNotes('');
    setExerciseDrafts(
      plan.exercises.map((tpl) => {
        const prevEx = prevSameSplit?.exercises.find(
          (e) =>
            e.exerciseId === tpl.id ||
            e.name.toLowerCase() === tpl.name.toLowerCase()
        );
        const defaultWeight = prevEx?.sets[0]?.weightKg ?? 0;
        const sets = Array.from({ length: tpl.targetSets }, (_, i) => ({
          weightKg: prevEx?.sets[i]?.weightKg ?? defaultWeight,
          reps: prevEx?.sets[i]?.reps ?? tpl.repMin,
          completed: false,
        }));
        return {
          exerciseId: tpl.id,
          name: tpl.name,
          targetSets: tpl.targetSets,
          repMin: tpl.repMin,
          repMax: tpl.repMax,
          sets,
        };
      })
    );
  }, [
    activeTab,
    sessionDate,
    existingWorkoutForDate,
    selectedSessionPlan,
    state.workoutLogs,
  ]);

  const updateSetField = (
    exIdx: number,
    setIdx: number,
    patch: Partial<{ weightKg: number; reps: number; completed: boolean }>
  ) => {
    setExerciseDrafts((prev) =>
      prev.map((ex, ei) => {
        if (ei !== exIdx) return ex;
        return {
          ...ex,
          sets: ex.sets.map((s, si) =>
            si === setIdx ? { ...s, ...patch } : s
          ),
        };
      })
    );
  };

  const applySuggestedWeight = (exIdx: number, weightKg: number) => {
    setExerciseDrafts((prev) =>
      prev.map((ex, ei) =>
        ei === exIdx
          ? { ...ex, sets: ex.sets.map((s) => ({ ...s, weightKg })) }
          : ex
      )
    );
  };

  const handleSaveWorkout = (e: React.FormEvent) => {
    e.preventDefault();
    if (activeTab === 'cardio' || activeTab === 'records') return;
    const plan = selectedSessionPlan;
    if (!plan) return;
    const log: WorkoutSessionLog = {
      id: existingWorkoutForDate?.id ?? `wo-${plan.key}-${sessionDate}`,
      date: sessionDate,
      sessionKey: plan.key,
      sessionTitle: plan.title,
      linkedEventId: plan.linkedEventId,
      durationMinutes: Math.max(10, Math.min(240, durationMinutes)),
      exercises: exerciseDrafts,
      effortRpe,
      soreness,
      ...(recoveryNotes.trim() ? { recoveryNotes: recoveryNotes.trim() } : {}),
      completed: true,
      updatedAt: new Date().toISOString(),
    };
    upsertWorkoutLog(log, recordInTimeline);
  };

  const handleUpdateExerciseTemplate = (
    exId: string,
    patch: Partial<WorkoutExerciseTemplate>
  ) => {
    if (!selectedSessionPlan) return;
    const nextPlan = config.workoutPlan.map((session) => {
      if (session.key !== selectedSessionPlan.key) return session;
      return {
        ...session,
        exercises: session.exercises.map((ex) =>
          ex.id === exId ? { ...ex, ...patch } : ex
        ),
      };
    });
    updateFitnessConfig({ workoutPlan: nextPlan });
  };

  const handleDeleteExerciseTemplate = (exId: string) => {
    if (!selectedSessionPlan) return;
    const nextPlan = config.workoutPlan.map((session) => {
      if (session.key !== selectedSessionPlan.key) return session;
      return {
        ...session,
        exercises: session.exercises.filter((ex) => ex.id !== exId),
      };
    });
    updateFitnessConfig({ workoutPlan: nextPlan });
  };

  const handleAddExerciseTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionPlan || !newExName.trim()) return;
    const newTpl: WorkoutExerciseTemplate = {
      id: `ex-${Date.now().toString(36)}`,
      name: newExName.trim(),
      targetSets: Math.max(1, Math.min(8, newExSets)),
      repMin: Math.max(1, newExRepMin),
      repMax: Math.max(newExRepMin, newExRepMax),
    };
    const nextPlan = config.workoutPlan.map((session) =>
      session.key === selectedSessionPlan.key
        ? { ...session, exercises: [...session.exercises, newTpl] }
        : session
    );
    updateFitnessConfig({ workoutPlan: nextPlan });
    setNewExName('');
  };

  const handleCreateCustomSession = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSessionTitle.trim()) return;
    const title = newSessionTitle.trim();
    const defaultDayByKey: Record<WorkoutSessionKey, number> = {
      upper_a: 1,
      lower_a: 4,
      upper_b: 5,
      lower_b: 6,
    };
    const created: WorkoutPlanSession = {
      key: newSessionKey,
      title,
      shortLabel: title.slice(0, 22),
      dayOfWeek: defaultDayByKey[newSessionKey],
      focus: newSessionFocus.trim() || 'Custom strength & conditioning focus',
      exercises: [],
    };
    const nextPlan = [
      ...config.workoutPlan.filter((p) => p.key !== newSessionKey),
      created,
    ];
    updateFitnessConfig({ workoutPlan: nextPlan });
    setActiveTab(newSessionKey);
    setEditingPlan(true);
    setNewSessionTitle('');
    setNewSessionFocus('');
  };

  // ========================
  // WEDNESDAY CARDIO LOGGER STATE
  // ========================
  const [cardioDate, setCardioDate] = useState(now.date);
  const cardioRx = useMemo(
    () => getWednesdayCardioPrescription(cardioDate, state.settings),
    [cardioDate, state.settings]
  );
  const existingCardioForDate = useMemo(
    () => state.cardioLogs.find((c) => c.date === cardioDate),
    [state.cardioLogs, cardioDate]
  );

  const [cardioType, setCardioType] = useState<CardioType>(
    cardioRx.weekType === 'A' ? 'endurance' : 'sprint'
  );
  const [cardioDuration, setCardioDuration] = useState(25);
  const [cardioDistanceKm, setCardioDistanceKm] = useState('');
  const [cardioPace, setCardioPace] = useState('');
  const [sprintReps, setSprintReps] = useState(6);
  const [accelSeconds, setAccelSeconds] = useState(12);
  const [cardioRpe, setCardioRpe] = useState(6);
  const [recoveryQuality, setRecoveryQuality] = useState(
    'Full walking recovery (60–90s)'
  );
  const [cardioNotes, setCardioNotes] = useState('');
  const [cardioTimeline, setCardioTimeline] = useState(true);

  useEffect(() => {
    if (existingCardioForDate) {
      setCardioType(existingCardioForDate.cardioType);
      setCardioDuration(existingCardioForDate.durationMinutes);
      setCardioDistanceKm(
        existingCardioForDate.distanceKm !== undefined
          ? String(existingCardioForDate.distanceKm)
          : ''
      );
      setCardioPace(existingCardioForDate.averagePace ?? '');
      setSprintReps(existingCardioForDate.sprintReps ?? 6);
      setAccelSeconds(existingCardioForDate.accelerationSeconds ?? 12);
      setCardioRpe(existingCardioForDate.perceivedEffort ?? 6);
      setRecoveryQuality(
        existingCardioForDate.recoveryQuality ?? 'Full walking recovery (60–90s)'
      );
      setCardioNotes(existingCardioForDate.notes ?? '');
    } else {
      setCardioType(cardioRx.weekType === 'A' ? 'endurance' : 'sprint');
      setCardioDuration(cardioRx.weekType === 'A' ? 25 : 25);
      setCardioDistanceKm('');
      setCardioPace('');
      setSprintReps(6);
      setAccelSeconds(12);
      setCardioRpe(cardioRx.weekType === 'A' ? 5 : 7);
      setRecoveryQuality('Full walking recovery (60–90s)');
      setCardioNotes('');
    }
  }, [existingCardioForDate, cardioRx.weekType, cardioDate]);

  const handleSaveCardio = (e: React.FormEvent) => {
    e.preventDefault();
    const dist = parseFloat(cardioDistanceKm);
    const log: CardioSessionLog = {
      id: existingCardioForDate?.id ?? `cardio-${cardioDate}`,
      date: cardioDate,
      weekType: cardioRx.weekType,
      cardioType,
      durationMinutes: cardioType === 'skipped' ? 0 : Math.max(5, cardioDuration),
      ...(!Number.isNaN(dist) && dist > 0 ? { distanceKm: dist } : {}),
      ...(cardioPace.trim() ? { averagePace: cardioPace.trim() } : {}),
      ...(cardioType === 'sprint'
        ? { sprintReps, accelerationSeconds: accelSeconds }
        : {}),
      perceivedEffort: cardioRpe,
      ...(recoveryQuality.trim()
        ? { recoveryQuality: recoveryQuality.trim() }
        : {}),
      ...(cardioNotes.trim() ? { notes: cardioNotes.trim() } : {}),
      updatedAt: new Date().toISOString(),
    };
    upsertCardioLog(log, cardioTimeline);
  };

  // ========================
  // PRs & CHARTS DATA
  // ========================
  const personalRecords = useMemo(
    () => calculateFitnessPersonalRecords(state.workoutLogs),
    [state.workoutLogs]
  );

  const volumeChartData = useMemo(() => {
    return state.workoutLogs
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-12)
      .map((w) => {
        let volumeKg = 0;
        for (const ex of w.exercises) {
          for (const s of ex.sets) {
            if (s.completed && s.weightKg > 0 && s.reps > 0) {
              volumeKg += s.weightKg * s.reps;
            }
          }
        }
        return {
          label: `${w.date.slice(5)} (${w.sessionKey.replace('_', '').toUpperCase()})`,
          volumeKg: Math.round(volumeKg),
          durationMinutes: w.durationMinutes,
        };
      });
  }, [state.workoutLogs]);

  const recentWorkouts = useMemo(
    () =>
      state.workoutLogs
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
    [state.workoutLogs]
  );

  const recentCardio = useMemo(
    () =>
      state.cardioLogs
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 6),
    [state.cardioLogs]
  );

  return (
    <div className="space-y-6">
      {/* Phase, In-Season Adaptation & Protein Guidance Header */}
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <span
              className="w-2.5 h-2.5 rounded-full mt-2 shrink-0"
              style={{ backgroundColor: fitMeta.colour }}
            />
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Fitness &amp; Athletic Development · Strength, Cardio &amp; PRs
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-mono tabular-nums">
                {phaseInfo.label} · Start{' '}
                <span className="underline decoration-dotted">
                  {config.rebuildStartDate}
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                updateFitnessConfig({
                  volleyballCompetitiveMode: !config.volleyballCompetitiveMode,
                })
              }
              className={`min-h-[38px] px-3 rounded-xl border text-xs font-medium inline-flex items-center gap-1.5 transition ${
                config.volleyballCompetitiveMode
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-700 dark:text-emerald-300'
                  : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              <Shield className="w-3.5 h-3.5" />
              Reduced-Volume Sport Mode:{' '}
              {config.volleyballCompetitiveMode ? 'Active' : 'Off'}
            </button>
            <button
              type="button"
              onClick={() => setShowReviewPanel((v) => !v)}
              className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              6–8 Wk Review &amp; Phase
            </button>
          </div>
        </div>

        {config.volleyballCompetitiveMode && (
          <div className="rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/70 p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <strong>In-Season Sport Adaptation active:</strong> Prioritise
            explosive movement quality and fresh legs before match days. Reduce
            lower-body volume by 1 set when fatigued and keep RPE around 7–8.
          </div>
        )}

        {showReviewPanel && (
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Programme / Rebuild start date
                </label>
                <input
                  type="date"
                  value={config.rebuildStartDate}
                  onChange={(e) =>
                    e.target.value &&
                    updateFitnessConfig({ rebuildStartDate: e.target.value })
                  }
                  className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Last 6–8 week review date
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
                    {config.lastReviewDate ?? 'Not yet logged'}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      updateFitnessConfig({
                        lastReviewDate: now.date,
                        programmeReviewNotes: reviewDraft,
                      })
                    }
                    className="px-3 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-medium"
                  >
                    Mark reviewed today
                  </button>
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                6–8 week progression &amp; recovery review notes
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <textarea
                  rows={2}
                  value={reviewDraft}
                  onChange={(e) => setReviewDraft(e.target.value)}
                  placeholder="How are joints, energy, daily recovery, and key lifts responding?"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
                <button
                  type="button"
                  onClick={() =>
                    updateFitnessConfig({ programmeReviewNotes: reviewDraft })
                  }
                  className="min-h-[38px] px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-medium shrink-0 self-end"
                >
                  Save notes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Supportive Daily Protein Check-in (Optional, Non-Obsessive) */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-slate-600 dark:text-slate-300">
            <span className="font-medium">Optional protein guidance:</span>{' '}
            <span className="font-mono tabular-nums">
              {config.proteinTargetMin}–{config.proteinTargetMax} g/day
            </span>{' '}
            <button
              type="button"
              onClick={() => setEditingProteinTargets((v) => !v)}
              className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline ml-1"
            >
              {editingProteinTargets ? 'Close' : 'Adjust range'}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Today (g):</label>
            <input
              type="number"
              min={0}
              max={400}
              value={proteinInput}
              onChange={(e) => setProteinInput(e.target.value)}
              placeholder="e.g. 150"
              className="w-24 min-h-[36px] px-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono tabular-nums"
            />
            <button
              type="button"
              onClick={() => {
                const parsed = parseInt(proteinInput, 10);
                logDailyProtein(
                  now.date,
                  Number.isNaN(parsed) ? null : parsed
                );
              }}
              className="min-h-[36px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Log
            </button>
          </div>
        </div>

        {editingProteinTargets && (
          <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
            <span>Min (g):</span>
            <input
              type="number"
              value={minProteinDraft}
              onChange={(e) => setMinProteinDraft(e.target.value)}
              className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono"
            />
            <span>Max (g):</span>
            <input
              type="number"
              value={maxProteinDraft}
              onChange={(e) => setMaxProteinDraft(e.target.value)}
              className="w-20 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono"
            />
            <button
              type="button"
              onClick={() => {
                const minV = parseInt(minProteinDraft, 10) || 130;
                const maxV = Math.max(minV, parseInt(maxProteinDraft, 10) || 180);
                updateFitnessConfig({
                  proteinTargetMin: minV,
                  proteinTargetMax: maxV,
                });
                setEditingProteinTargets(false);
              }}
              className="px-3 py-1 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 font-medium"
            >
              Save range
            </button>
          </div>
        )}
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ...(config.workoutPlan.length > 0
              ? config.workoutPlan.map((session) => ({
                  id: session.key as FitnessSubTab,
                  label: session.shortLabel || session.title,
                }))
              : [{ id: 'upper_a' as FitnessSubTab, label: 'Strength Plan' }]),
            { id: 'cardio' as FitnessSubTab, label: 'Cardio (A/B)' },
            { id: 'records' as FitnessSubTab, label: 'PRs & Charts' },
          ] as Array<{ id: FitnessSubTab; label: string }>
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setActiveTab(tab.id);
                setEditingPlan(false);
              }}
              className={`min-h-[40px] px-3.5 rounded-xl text-xs font-medium transition ${
                active
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ======================== */}
      {/* STRENGTH SESSION LOGGER  */}
      {/* ======================== */}
      {activeTab !== 'cardio' && activeTab !== 'records' && !selectedSessionPlan && (
        <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-semibold">
                Set up your strength training plan
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Start with a standard 4-day Upper/Lower template or create your
                own custom workout session below.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                updateFitnessConfig({
                  workoutPlan: STARTER_UPPER_LOWER_TEMPLATE,
                });
                setActiveTab('upper_a');
              }}
              className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold shrink-0"
            >
              Load standard 4-day Upper/Lower template
            </button>
          </div>

          <form
            onSubmit={handleCreateCustomSession}
            className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/80 dark:border-slate-800 p-4 grid grid-cols-1 sm:grid-cols-4 gap-3"
          >
            <select
              value={newSessionKey}
              onChange={(e) =>
                setNewSessionKey(e.target.value as WorkoutSessionKey)
              }
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            >
              <option value="upper_a">Slot 1 (Upper A)</option>
              <option value="lower_a">Slot 2 (Lower A)</option>
              <option value="upper_b">Slot 3 (Upper B)</option>
              <option value="lower_b">Slot 4 (Lower B)</option>
            </select>
            <input
              type="text"
              required
              value={newSessionTitle}
              onChange={(e) => setNewSessionTitle(e.target.value)}
              placeholder="Session title (e.g. Full Body A)"
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <input
              type="text"
              value={newSessionFocus}
              onChange={(e) => setNewSessionFocus(e.target.value)}
              placeholder="Training focus (optional)"
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
            <button
              type="submit"
              className="min-h-[40px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              <Plus className="w-3.5 h-3.5" /> Create session
            </button>
          </form>
        </div>
      )}

      {activeTab !== 'cardio' && activeTab !== 'records' && selectedSessionPlan && (
        <div className="space-y-5">
          <form
            onSubmit={handleSaveWorkout}
            className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-5"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">
                  {selectedSessionPlan.title}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {selectedSessionPlan.focus}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="date"
                  value={sessionDate}
                  onChange={(e) => e.target.value && setSessionDate(e.target.value)}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setEditingPlan((v) => !v)}
                  className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  {editingPlan ? 'Done editing plan' : 'Edit exercise plan'}
                </button>
              </div>
            </div>

            {/* Editable Template Panel */}
            {editingPlan && (
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 p-4 space-y-3">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                  Customise {selectedSessionPlan.shortLabel} template exercises
                </p>
                <div className="space-y-2">
                  {selectedSessionPlan.exercises.map((tpl) => (
                    <div
                      key={tpl.id}
                      className="grid grid-cols-12 gap-2 items-center"
                    >
                      <input
                        type="text"
                        value={tpl.name}
                        onChange={(e) =>
                          handleUpdateExerciseTemplate(tpl.id, {
                            name: e.target.value,
                          })
                        }
                        className="col-span-5 min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      <input
                        type="number"
                        min={1}
                        max={8}
                        value={tpl.targetSets}
                        onChange={(e) =>
                          handleUpdateExerciseTemplate(tpl.id, {
                            targetSets: parseInt(e.target.value, 10) || 2,
                          })
                        }
                        title="Sets"
                        className="col-span-2 min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                      />
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={tpl.repMin}
                        onChange={(e) =>
                          handleUpdateExerciseTemplate(tpl.id, {
                            repMin: parseInt(e.target.value, 10) || 5,
                          })
                        }
                        title="Min reps"
                        className="col-span-2 min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                      />
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={tpl.repMax}
                        onChange={(e) =>
                          handleUpdateExerciseTemplate(tpl.id, {
                            repMax: parseInt(e.target.value, 10) || tpl.repMin,
                          })
                        }
                        title="Max reps"
                        className="col-span-2 min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteExerciseTemplate(tpl.id)}
                        className="col-span-1 min-h-[36px] flex items-center justify-center text-slate-400 hover:text-rose-500"
                        aria-label={`Remove ${tpl.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-slate-200/70 dark:border-slate-800 flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    value={newExName}
                    onChange={(e) => setNewExName(e.target.value)}
                    placeholder="Add exercise..."
                    className="flex-1 min-w-[160px] min-h-[36px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                  <input
                    type="number"
                    min={1}
                    max={8}
                    value={newExSets}
                    onChange={(e) => setNewExSets(Number(e.target.value))}
                    className="w-16 min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newExRepMin}
                    onChange={(e) => setNewExRepMin(Number(e.target.value))}
                    className="w-16 min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                  />
                  <input
                    type="number"
                    min={1}
                    value={newExRepMax}
                    onChange={(e) => setNewExRepMax(Number(e.target.value))}
                    className="w-16 min-h-[36px] px-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono text-center"
                  />
                  <button
                    type="button"
                    onClick={handleAddExerciseTemplate}
                    className="min-h-[36px] px-3 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-medium inline-flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add
                  </button>
                </div>
              </div>
            )}

            {/* Exercises & Sets Logger */}
            <div className="space-y-4">
              {exerciseDrafts.map((ex, exIdx) => {
                const tpl = selectedSessionPlan.exercises.find(
                  (t) => t.id === ex.exerciseId || t.name === ex.name
                ) ?? {
                  id: ex.exerciseId,
                  name: ex.name,
                  targetSets: ex.targetSets,
                  repMin: ex.repMin,
                  repMax: ex.repMax,
                };
                const cue = getExerciseDoubleProgressionCue(
                  tpl,
                  state.workoutLogs,
                  sessionDate
                );

                return (
                  <div
                    key={`${ex.exerciseId}-${exIdx}`}
                    className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-4 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {ex.name}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                          Target {ex.targetSets}×{ex.repMin}
                          {ex.repMax !== ex.repMin ? `–${ex.repMax}` : ''}
                          {tpl.repUnit ? ` ${tpl.repUnit}` : ' reps'}
                          {tpl.notes ? ` · ${tpl.notes}` : ''}
                        </p>
                      </div>
                      {cue.suggestedWeightKg !== undefined && (
                        <button
                          type="button"
                          onClick={() =>
                            applySuggestedWeight(exIdx, cue.suggestedWeightKg!)
                          }
                          className="min-h-[34px] px-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium inline-flex items-center gap-1.5 self-start sm:self-auto"
                        >
                          <TrendingUp className="w-3.5 h-3.5" />
                          Apply {cue.suggestedWeightKg} kg
                        </button>
                      )}
                    </div>

                    <p
                      className={`text-xs ${
                        cue.readyToIncrease
                          ? 'text-emerald-700 dark:text-emerald-400 font-medium'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {cue.message}
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {ex.sets.map((s, setIdx) => (
                        <div
                          key={setIdx}
                          className={`p-2.5 rounded-xl border flex items-center gap-2 ${
                            s.completed
                              ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800'
                              : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800'
                          }`}
                        >
                          <span className="text-[11px] font-mono text-slate-400 w-7 shrink-0">
                            S{setIdx + 1}
                          </span>
                          <div className="flex-1 min-w-0 flex items-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              max={500}
                              value={s.weightKg}
                              onChange={(e) =>
                                updateSetField(exIdx, setIdx, {
                                  weightKg: parseFloat(e.target.value) || 0,
                                })
                              }
                              aria-label={`Set ${setIdx + 1} weight kg`}
                              className="w-16 min-h-[34px] px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-center"
                            />
                            <span className="text-[11px] text-slate-400">kg</span>
                          </div>
                          <div className="flex-1 min-w-0 flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={s.reps}
                              onChange={(e) =>
                                updateSetField(exIdx, setIdx, {
                                  reps: parseInt(e.target.value, 10) || 0,
                                })
                              }
                              aria-label={`Set ${setIdx + 1} reps`}
                              className="w-12 min-h-[34px] px-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono tabular-nums text-center"
                            />
                            <span className="text-[11px] text-slate-400">r</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={s.completed}
                            onChange={(e) =>
                              updateSetField(exIdx, setIdx, {
                                completed: e.target.checked,
                              })
                            }
                            aria-label={`Complete set ${setIdx + 1}`}
                            className="w-4 h-4 rounded shrink-0 cursor-pointer"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Session Effort, Soreness & Recovery Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Duration (min)
                </label>
                <input
                  type="number"
                  min={10}
                  max={240}
                  value={durationMinutes}
                  onChange={(e) =>
                    setDurationMinutes(parseInt(e.target.value, 10) || 60)
                  }
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Session effort (RPE 1–10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={effortRpe}
                  onChange={(e) =>
                    setEffortRpe(
                      Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 7))
                    )
                  }
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Soreness / readiness (1–5)
                </label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={soreness}
                  onChange={(e) =>
                    setSoreness(
                      Math.min(5, Math.max(1, parseInt(e.target.value, 10) || 2))
                    )
                  }
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Recovery &amp; technique notes
              </label>
              <textarea
                rows={2}
                value={recoveryNotes}
                onChange={(e) => setRecoveryNotes(e.target.value)}
                placeholder="How did bar speed, joints, and energy feel?"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={recordInTimeline}
                  onChange={(e) => setRecordInTimeline(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>
                  Also record session in Time History (avoids double-counting
                  linked calendar block)
                </span>
              </label>

              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Workout Session
              </button>
            </div>
          </form>

          {/* Recent Logged Workouts */}
          <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <h3 className="text-sm font-semibold mb-3">
              Recent Strength Sessions
            </h3>
            {recentWorkouts.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No workouts recorded yet. Log your baseline weights above to
                unlock Personal Records and double-progression cues.
              </p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentWorkouts.map((w) => (
                  <div
                    key={w.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab(w.sessionKey);
                        setSessionDate(w.date);
                      }}
                      className="text-left min-w-0 flex-1 hover:opacity-80"
                    >
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                        {w.sessionTitle}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {w.date} · {w.durationMinutes} min
                        {w.effortRpe ? ` · RPE ${w.effortRpe}/10` : ''}
                      </p>
                    </button>
                    {confirmDeleteWorkoutId === w.id ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            deleteWorkoutLog(w.id);
                            setConfirmDeleteWorkoutId(null);
                          }}
                          className="px-2 py-1 rounded bg-rose-600 text-white text-[11px]"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteWorkoutId(null)}
                          className="px-2 py-1 rounded border border-slate-200 dark:border-slate-700 text-[11px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteWorkoutId(w.id)}
                        className="p-2 text-slate-400 hover:text-rose-500"
                        aria-label="Delete workout log"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================== */}
      {/* WEDNESDAY CARDIO (A / B) */}
      {/* ======================== */}
      {activeTab === 'cardio' && (
        <div className="space-y-5">
          <form
            onSubmit={handleSaveCardio}
            className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-emerald-500" />
                  <h3 className="text-base font-semibold">{cardioRx.title}</h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {cardioRx.prescription}
                </p>
              </div>
              <input
                type="date"
                value={cardioDate}
                onChange={(e) => e.target.value && setCardioDate(e.target.value)}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono tabular-nums"
              />
            </div>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/70 dark:border-slate-800 p-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {cardioRx.guidance}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(
                [
                  { id: 'endurance', label: 'Week A · Endurance' },
                  { id: 'sprint', label: 'Week B · Sprints' },
                  { id: 'low_impact', label: 'Low-Impact Alt' },
                  { id: 'skipped', label: 'Gentle Skip (Recovery)' },
                ] as Array<{ id: CardioType; label: string }>
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setCardioType(opt.id)}
                  className={`min-h-[40px] px-3 rounded-xl border text-xs font-medium transition ${
                    cardioType === opt.id
                      ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                      : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {cardioType !== 'skipped' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Duration (min)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={180}
                    value={cardioDuration}
                    onChange={(e) =>
                      setCardioDuration(parseInt(e.target.value, 10) || 20)
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                  />
                </div>

                {cardioType === 'sprint' ? (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Accelerations completed
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={sprintReps}
                        onChange={(e) =>
                          setSprintReps(parseInt(e.target.value, 10) || 6)
                        }
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Sprint length (seconds)
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={30}
                        value={accelSeconds}
                        onChange={(e) =>
                          setAccelSeconds(parseInt(e.target.value, 10) || 12)
                        }
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Distance (km, optional)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        min={0}
                        value={cardioDistanceKm}
                        onChange={(e) => setCardioDistanceKm(e.target.value)}
                        placeholder="e.g. 4.2"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                        Average pace (optional)
                      </label>
                      <input
                        type="text"
                        value={cardioPace}
                        onChange={(e) => setCardioPace(e.target.value)}
                        placeholder="e.g. 5:45 /km"
                        className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Perceived effort (RPE 1–10)
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={cardioRpe}
                  onChange={(e) =>
                    setCardioRpe(
                      Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 6))
                    )
                  }
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Recovery quality / rest intervals
                </label>
                <input
                  type="text"
                  value={recoveryQuality}
                  onChange={(e) => setRecoveryQuality(e.target.value)}
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={cardioNotes}
                onChange={(e) => setCardioNotes(e.target.value)}
                placeholder="Breathing rhythm, lower-leg readiness, recovery quality..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cardioTimeline}
                  onChange={(e) => setCardioTimeline(e.target.checked)}
                  className="w-4 h-4 rounded"
                />
                <span>Record session in Time History</span>
              </label>
              <button
                type="submit"
                className="min-h-[42px] px-5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Save Cardio Log
              </button>
            </div>
          </form>

          {recentCardio.length > 0 && (
            <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
              <h3 className="text-sm font-semibold mb-3">
                Recent Wednesday Conditioning Logs
              </h3>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentCardio.map((c) => (
                  <div
                    key={c.id}
                    className="py-2.5 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                        Week {c.weekType} · {c.cardioType.replace('_', ' ')}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono tabular-nums">
                        {c.date} · {c.durationMinutes} min
                        {c.distanceKm ? ` · ${c.distanceKm} km` : ''}
                        {c.sprintReps
                          ? ` · ${c.sprintReps}×${c.accelerationSeconds ?? 12}s`
                          : ''}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteCardioLog(c.id)}
                      className="p-2 text-slate-400 hover:text-rose-500"
                      aria-label="Delete cardio log"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ======================== */}
      {/* PERSONAL RECORDS & CHART */}
      {/* ======================== */}
      {activeTab === 'records' && (
        <div className="space-y-5">
          <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Award className="w-4 h-4 text-emerald-500" />
              <h3 className="text-base font-semibold">
                Personal Records (Actual Logged Lifts)
              </h3>
            </div>
            {personalRecords.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                No completed strength sets recorded yet. Log weights and reps
                under Upper A, Lower A, Upper B, or Lower B to populate your
                real Personal Records.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {personalRecords.map((pr) => (
                  <div
                    key={pr.exerciseName}
                    className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 bg-slate-50/70 dark:bg-slate-900/40"
                  >
                    <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {pr.exerciseName}
                    </p>
                    <p className="text-lg font-mono font-semibold tabular-nums mt-1 text-slate-900 dark:text-white">
                      {pr.maxWeightKg} kg × {pr.repsAtMaxWeight}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5">
                      Est. 1RM {pr.bestEst1RmKg} kg · {pr.totalSessionsLogged}{' '}
                      session{pr.totalSessionsLogged === 1 ? '' : 's'} ·{' '}
                      {pr.lastDate}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
            <div className="flex items-center gap-2 mb-3">
              <Dumbbell className="w-4 h-4 text-slate-400" />
              <h3 className="text-base font-semibold">
                Training Volume History (kg)
              </h3>
            </div>
            {volumeChartData.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Volume trend appears once at least one strength workout with
                weighted sets is saved.
              </p>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={volumeChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.18} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11 }}
                      interval={0}
                      angle={-15}
                      textAnchor="end"
                      height={50}
                    />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar
                      dataKey="volumeKg"
                      name="Volume (kg)"
                      fill={fitMeta.colour}
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
