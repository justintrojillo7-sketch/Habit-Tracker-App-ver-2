import React, { useEffect, useState } from 'react';
import { Check, Clock, Play, RotateCcw, Sparkles, Square, Trash2, X } from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import { Habit } from '../types/lifehq';
import {
  formatHabitStackText,
  formatPreferredWindow,
  getHabitStarterAttempt,
} from '../utils/habitUtils';

interface TwoMinuteStarterModalProps {
  isOpen: boolean;
  onClose: () => void;
  habit: Habit | null;
  date: string;
}

const TWO_MIN_SECONDS = 120;

function formatCountdown(secs: number): string {
  const clamped = Math.max(0, Math.floor(secs));
  const m = Math.floor(clamped / 60);
  const s = clamped % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export const TwoMinuteStarterModal: React.FC<TwoMinuteStarterModalProps> = ({
  isOpen,
  onClose,
  habit,
  date,
}) => {
  const {
    state,
    getCategoryMeta,
    logStarterAttempt,
    clearStarterAttempt,
    setHabitStatus,
    startTimer,
  } = useLifeHQ();

  const [secondsLeft, setSecondsLeft] = useState<number>(TWO_MIN_SECONDS);
  const [timerRunning, setTimerRunning] = useState<boolean>(false);
  const [note, setNote] = useState<string>('');

  const existingStarter = habit
    ? getHabitStarterAttempt(habit.id, date, state.habitLogs)
    : null;

  useEffect(() => {
    if (!isOpen || !habit) return;
    setSecondsLeft(TWO_MIN_SECONDS);
    setTimerRunning(false);
    setNote(existingStarter?.notes ?? '');
  }, [isOpen, habit?.id, date, existingStarter?.notes]);

  useEffect(() => {
    if (!isOpen || !timerRunning) return;
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [isOpen, timerRunning]);

  if (!isOpen || !habit) return null;

  const cat = getCategoryMeta(habit.category);
  const stackText = formatHabitStackText(habit, state.events);
  const preferredWindow = formatPreferredWindow(habit);
  const starterAction =
    habit.twoMinuteRule?.trim() || `Begin ${habit.title.toLowerCase()} for two minutes`;
  const elapsedSeconds = TWO_MIN_SECONDS - secondsLeft;

  const handleLogStarterAttempt = () => {
    logStarterAttempt(
      habit.id,
      date,
      note.trim() || undefined,
      elapsedSeconds > 0 ? elapsedSeconds : undefined
    );
    onClose();
  };

  const handleContinueFullActivity = () => {
    startTimer({
      category: habit.category,
      subcategory: cat.subcategories[0] ?? 'General',
      title: habit.title,
      notes: note.trim() || undefined,
    });
    onClose();
  };

  const handleCompleteFullHabit = () => {
    setHabitStatus(habit.id, date, 'done', 'manual', note.trim() || undefined);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-sm p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Two-Minute Starter: ${habit.title}`}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-lg max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 shadow-xl p-5 sm:p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <span
                className="w-2.5 h-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: cat.colour }}
                aria-hidden="true"
              />
              <span>{cat.label}</span>
              <span aria-hidden="true">·</span>
              <span>Two-minute starter</span>
              {preferredWindow && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{preferredWindow}</span>
                </>
              )}
            </div>
            <h2 className="text-lg font-semibold mt-1">{habit.title}</h2>
            {stackText && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {stackText}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 shrink-0"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Starter Action Card */}
        <div className="rounded-2xl bg-slate-50 dark:bg-slate-900/80 border border-slate-200/80 dark:border-slate-800 p-4 space-y-1.5">
          <p className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
            <Sparkles className="w-3.5 h-3.5" />
            Starting action
          </p>
          <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {starterAction}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Just show up and begin. Logging a starter attempt records your effort separately without marking the full habit complete.
          </p>
        </div>

        {/* Optional Two-Minute Timer */}
        <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Optional 2-minute timer
            </p>
            <p className="font-mono tabular-nums text-3xl font-semibold tracking-tight mt-0.5">
              {formatCountdown(secondsLeft)}
            </p>
            {secondsLeft === 0 && (
              <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                Two minutes complete — log your start or keep going.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setTimerRunning((r) => !r)}
              className="min-h-[40px] px-4 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition"
            >
              {timerRunning ? (
                <>
                  <Square className="w-3.5 h-3.5" /> Pause
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5" />{' '}
                  {secondsLeft < TWO_MIN_SECONDS && secondsLeft > 0
                    ? 'Resume'
                    : 'Start 2:00'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                setTimerRunning(false);
                setSecondsLeft(TWO_MIN_SECONDS);
              }}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Reset timer"
              aria-label="Reset two-minute timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Existing Starter Attempt Banner (if already recorded today) */}
        {existingStarter && (
          <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-100 dark:bg-slate-800/70 px-3.5 py-2.5 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              Starter attempt recorded for this date
              {existingStarter.actualValue
                ? ` (${Math.max(1, Math.round(existingStarter.actualValue))}s)`
                : ''}
            </span>
            <button
              type="button"
              onClick={() => {
                clearStarterAttempt(habit.id, date);
              }}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 font-medium"
            >
              <Trash2 className="w-3.5 h-3.5" /> Clear
            </button>
          </div>
        )}

        {/* Optional Note */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
            Note (optional)
          </label>
          <input
            type="text"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Organised timeline bins, got changed and packed bag..."
            className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={handleLogStarterAttempt}
            className="w-full min-h-[42px] px-4 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition inline-flex items-center justify-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {existingStarter ? 'Update starter attempt' : 'Log starter attempt'}
          </button>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleContinueFullActivity}
              className="min-h-[40px] px-3.5 rounded-xl text-xs font-medium border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 transition inline-flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5" /> Continue to full activity
            </button>
            <button
              type="button"
              onClick={handleCompleteFullHabit}
              className="min-h-[40px] px-3.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white hover:bg-emerald-700 transition inline-flex items-center justify-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" /> Mark full habit done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
