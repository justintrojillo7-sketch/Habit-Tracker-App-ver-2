import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  Plus,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import {
  MORAVIAN_WATCHWORDS_LINKS,
  MORNING_FAITH_STEPS,
} from '../data/pillarSeedData';
import {
  BibleStudyNote,
  BibleStudyStatus,
  DevotionEntry,
} from '../types/lifehq';
import { addDays, formatDisplayDate } from '../utils/dateUtils';
import { getDevotionForDate, partitionBibleStudies } from '../utils/pillarUtils';

export const FaithWorkspace: React.FC = () => {
  const {
    state,
    now,
    getCategoryMeta,
    upsertDevotionEntry,
    upsertBibleStudy,
    deleteBibleStudy,
  } = useLifeHQ();

  const faithMeta = getCategoryMeta('faith');
  const [selectedDate, setSelectedDate] = useState(now.date);

  const existingMorning = useMemo(
    () => getDevotionForDate(state.devotionEntries, selectedDate, 'morning'),
    [state.devotionEntries, selectedDate]
  );
  const existingEvening = useMemo(
    () => getDevotionForDate(state.devotionEntries, selectedDate, 'evening'),
    [state.devotionEntries, selectedDate]
  );

  // Morning form state
  const [mHydrated, setMHydrated] = useState(false);
  const [mWatchwordsOpened, setMWatchwordsOpened] = useState(false);
  const [mRef, setMRef] = useState('');
  const [mReflection, setMReflection] = useState('');
  const [mPrayer, setMPrayer] = useState(false);
  const [mJournal, setMJournal] = useState('');
  const [mShortOrMoved, setMShortOrMoved] = useState(false);
  const [mMovedNote, setMMovedNote] = useState('');

  // Evening form state
  const [eRef, setERef] = useState('');
  const [eReflection, setEReflection] = useState('');
  const [ePrayer, setEPrayer] = useState(false);
  const [eThoughts, setEThoughts] = useState('');
  const [eQuestions, setEQuestions] = useState('');
  const [eGratitude, setEGratitude] = useState('');
  const [eApplication, setEApplication] = useState('');
  const [eShortOrMoved, setEShortOrMoved] = useState(false);
  const [eMovedNote, setEMovedNote] = useState('');

  useEffect(() => {
    setMHydrated(Boolean(existingMorning?.hydrated));
    setMWatchwordsOpened(Boolean(existingMorning?.watchwordsOpened));
    setMRef(existingMorning?.scriptureRef ?? '');
    setMReflection(existingMorning?.reflection ?? '');
    setMPrayer(Boolean(existingMorning?.prayerCompleted));
    setMJournal(existingMorning?.journalThoughts ?? '');
    setMShortOrMoved(Boolean(existingMorning?.shortOrMoved));
    setMMovedNote(existingMorning?.movedNote ?? '');
  }, [existingMorning, selectedDate]);

  useEffect(() => {
    setERef(existingEvening?.scriptureRef ?? '');
    setEReflection(existingEvening?.reflection ?? '');
    setEPrayer(Boolean(existingEvening?.prayerCompleted));
    setEThoughts(existingEvening?.journalThoughts ?? '');
    setEQuestions(existingEvening?.questions ?? '');
    setEGratitude(existingEvening?.gratitude ?? '');
    setEApplication(existingEvening?.application ?? '');
    setEShortOrMoved(Boolean(existingEvening?.shortOrMoved));
    setEMovedNote(existingEvening?.movedNote ?? '');
  }, [existingEvening, selectedDate]);

  const handleSaveMorning = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: DevotionEntry = {
      id: `dev-morning-${selectedDate}`,
      date: selectedDate,
      routineType: 'morning',
      hydrated: mHydrated,
      watchwordsOpened: mWatchwordsOpened,
      scriptureRef: mRef.trim(),
      reflection: mReflection.trim(),
      prayerCompleted: mPrayer,
      ...(mJournal.trim() ? { journalThoughts: mJournal.trim() } : {}),
      ...(mShortOrMoved ? { shortOrMoved: true } : {}),
      ...(mMovedNote.trim() ? { movedNote: mMovedNote.trim() } : {}),
      durationMinutes: 20,
      updatedAt: new Date().toISOString(),
    };
    upsertDevotionEntry(entry);
  };

  const handleSaveEvening = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: DevotionEntry = {
      id: `dev-evening-${selectedDate}`,
      date: selectedDate,
      routineType: 'evening',
      scriptureRef: eRef.trim(),
      reflection: eReflection.trim(),
      prayerCompleted: ePrayer,
      ...(eThoughts.trim() ? { journalThoughts: eThoughts.trim() } : {}),
      ...(eQuestions.trim() ? { questions: eQuestions.trim() } : {}),
      ...(eGratitude.trim() ? { gratitude: eGratitude.trim() } : {}),
      ...(eApplication.trim() ? { application: eApplication.trim() } : {}),
      ...(eShortOrMoved ? { shortOrMoved: true } : {}),
      ...(eMovedNote.trim() ? { movedNote: eMovedNote.trim() } : {}),
      durationMinutes: 15,
      updatedAt: new Date().toISOString(),
    };
    upsertDevotionEntry(entry);
  };

  // Bible Study Workspace state
  const { completed, active, upcoming } = useMemo(
    () => partitionBibleStudies(state.bibleStudies),
    [state.bibleStudies]
  );

  const [selectedStudyId, setSelectedStudyId] = useState<string>(
    () => active?.id ?? state.bibleStudies[0]?.id ?? ''
  );

  const selectedStudy = useMemo(
    () =>
      state.bibleStudies.find((s) => s.id === selectedStudyId) ??
      active ??
      state.bibleStudies[0] ??
      null,
    [state.bibleStudies, selectedStudyId, active]
  );

  const [studyDraft, setStudyDraft] = useState<BibleStudyNote | null>(
    selectedStudy
  );
  const [addingNewStudy, setAddingNewStudy] = useState(false);
  const [newBookTitle, setNewBookTitle] = useState('');
  const [newPassage, setNewPassage] = useState('');
  const [confirmDeleteStudyId, setConfirmDeleteStudyId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedStudy) {
      setStudyDraft({ ...selectedStudy });
    } else {
      setStudyDraft(null);
    }
  }, [selectedStudy]);

  const handleSaveStudy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!studyDraft || !studyDraft.book.trim()) return;
    upsertBibleStudy({
      ...studyDraft,
      book: studyDraft.book.trim(),
      passage: studyDraft.passage.trim(),
    });
  };

  const handleAddStudy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBookTitle.trim()) return;
    const maxOrder = state.bibleStudies.reduce(
      (max, s) => Math.max(max, s.orderIndex),
      0
    );
    const created: BibleStudyNote = {
      id: `study-${Date.now()}`,
      book: newBookTitle.trim(),
      passage: newPassage.trim() || `${newBookTitle.trim()} 1`,
      status: 'upcoming',
      orderIndex: maxOrder + 1,
      readingProgress: 'Queued',
      observations: '',
      historicalContext: '',
      theologicalInterpretation: '',
      crossReferences: '',
      practicalApplication: '',
      questions: '',
      prayerAndJournal: '',
      updatedAt: new Date().toISOString(),
    };
    upsertBibleStudy(created);
    setSelectedStudyId(created.id);
    setNewBookTitle('');
    setNewPassage('');
    setAddingNewStudy(false);
  };

  const recentDevotions = useMemo(
    () =>
      state.devotionEntries
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
    [state.devotionEntries]
  );

  return (
    <div className="space-y-6">
      {/* Intro & Date Navigator */}
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className="w-2.5 h-2.5 rounded-full mt-2 shrink-0"
            style={{ backgroundColor: faithMeta.colour }}
          />
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Faith &amp; Spiritual Development
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
              Consistent Scripture reading, prayer and theological reflection —
              gentle rhythm without legalistic performance metrics.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono tabular-nums"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="min-w-[40px] min-h-[40px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            aria-label="Next day"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          {selectedDate !== now.date && (
            <button
              type="button"
              onClick={() => setSelectedDate(now.date)}
              className="min-h-[40px] px-3 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-medium"
            >
              Today
            </button>
          )}
        </div>
      </div>

      {/* Daily Rhythm: Morning Devotional + Evening Reflection */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Morning Devotional */}
        <form
          onSubmit={handleSaveMorning}
          className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Sun className="w-4 h-4 text-amber-500" />
                <h3 className="text-sm font-semibold">
                  Morning Devotional Rhythm
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {formatDisplayDate(selectedDate, {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                · Scripture, reflection &amp; prayer
              </p>
            </div>
            {existingMorning && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                Saved
              </span>
            )}
          </div>

          {/* Morning Pattern Reference */}
          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200/60 dark:border-slate-800 p-3 space-y-1.5">
            {MORNING_FAITH_STEPS.map((step) => (
              <div
                key={step.time}
                className="flex items-baseline gap-2.5 text-xs"
              >
                <span className="font-mono tabular-nums text-[11px] text-slate-500 dark:text-slate-400 shrink-0 w-16">
                  {step.time}
                </span>
                <span className="text-slate-700 dark:text-slate-300">
                  {step.label}
                </span>
              </div>
            ))}
          </div>

          {MORAVIAN_WATCHWORDS_LINKS.length > 0 && (
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3 space-y-2">
              <div className="flex flex-wrap gap-3">
                {MORAVIAN_WATCHWORDS_LINKS.map((link) => (
                  <a
                    key={link.url}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMWatchwordsOpened(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-900 dark:text-slate-100 underline underline-offset-4 hover:opacity-80"
                  >
                    <span>{link.label}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quick Checkboxes */}
          <div className="flex flex-wrap gap-4">
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={mHydrated}
                onChange={(e) => setMHydrated(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Settled &amp; ready</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={mWatchwordsOpened}
                onChange={(e) => setMWatchwordsOpened(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Devotional read</span>
            </label>
            <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer min-h-[36px]">
              <input
                type="checkbox"
                checked={mPrayer}
                onChange={(e) => setMPrayer(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Prayer completed</span>
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Scripture / devotional reference
            </label>
            <input
              type="text"
              value={mRef}
              onChange={(e) => setMRef(e.target.value)}
              placeholder="e.g. Psalm 23 · Matthew 5:1–12"
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Short reflection
            </label>
            <textarea
              rows={2}
              value={mReflection}
              onChange={(e) => setMReflection(e.target.value)}
              placeholder="What stood out from today's reading?"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Optional morning prayer or journal note
            </label>
            <textarea
              rows={2}
              value={mJournal}
              onChange={(e) => setMJournal(e.target.value)}
              placeholder="People to pray for, gratitude, or perspective for the day..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <div className="pt-1 space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={mShortOrMoved}
                onChange={(e) => setMShortOrMoved(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>Shortened or shifted today (gentle, no penalty)</span>
            </label>
            {mShortOrMoved && (
              <input
                type="text"
                value={mMovedNote}
                onChange={(e) => setMMovedNote(e.target.value)}
                placeholder="Note e.g. prayed during morning commute / resumed at lunch"
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            )}
          </div>

          <button
            type="submit"
            className="w-full min-h-[42px] rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Morning Entry
          </button>
        </form>

        {/* Evening Devotional */}
        <form
          onSubmit={handleSaveEvening}
          className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Moon className="w-4 h-4 text-indigo-500" />
                <h3 className="text-sm font-semibold">
                  Evening Reading &amp; Reflection
                </h3>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Unhurried evening Scripture reading &amp; prayer · flexible on
                busy evenings
              </p>
            </div>
            {existingEvening && (
              <span className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                Saved
              </span>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Chapter / passage read
            </label>
            <input
              type="text"
              value={eRef}
              onChange={(e) => setERef(e.target.value)}
              placeholder="e.g. John 1:1–14"
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <label className="inline-flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer min-h-[36px]">
            <input
              type="checkbox"
              checked={ePrayer}
              onChange={(e) => setEPrayer(e.target.checked)}
              className="w-4 h-4 rounded"
            />
            <span>Evening prayer &amp; quiet surrender completed</span>
          </label>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Passage reflection
            </label>
            <textarea
              rows={2}
              value={eReflection}
              onChange={(e) => setEReflection(e.target.value)}
              placeholder="What does this reveal about Jesus and following Him?"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Journal thoughts
              </label>
              <textarea
                rows={2}
                value={eThoughts}
                onChange={(e) => setEThoughts(e.target.value)}
                placeholder="Optional reflections..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Gratitude
              </label>
              <textarea
                rows={2}
                value={eGratitude}
                onChange={(e) => setEGratitude(e.target.value)}
                placeholder="Thankful today for..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Questions
              </label>
              <textarea
                rows={2}
                value={eQuestions}
                onChange={(e) => setEQuestions(e.target.value)}
                placeholder="Questions to revisit..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Application
              </label>
              <textarea
                rows={2}
                value={eApplication}
                onChange={(e) => setEApplication(e.target.value)}
                placeholder="One way to live this tomorrow..."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>
          </div>

          <div className="pt-1 space-y-2">
            <label className="inline-flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
              <input
                type="checkbox"
                checked={eShortOrMoved}
                onChange={(e) => setEShortOrMoved(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <span>
                Shortened or excused tonight (late evening / rest)
              </span>
            </label>
            {eShortOrMoved && (
              <input
                type="text"
                value={eMovedNote}
                onChange={(e) => setEMovedNote(e.target.value)}
                placeholder="e.g. Late home — brief prayer before sleep"
                className="w-full min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            )}
          </div>

          <button
            type="submit"
            className="w-full min-h-[42px] rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-sm font-medium hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            Save Evening Entry
          </button>
        </form>
      </div>

      {/* Extended Bible Study Workspace */}
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" style={{ color: faithMeta.colour }} />
              <h3 className="text-base font-semibold">
                Extended Book &amp; Theology Study Queue
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Completed: {completed.map((c) => c.book).join(', ') || 'None'} ·
              Next queue:{' '}
              {[active, ...upcoming]
                .filter(Boolean)
                .map((s) => s!.book)
                .join(' → ') || 'Empty'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAddingNewStudy((v) => !v)}
            className="min-h-[40px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Book / OT Study
          </button>
        </div>

        {addingNewStudy && (
          <form
            onSubmit={handleAddStudy}
            className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-3"
          >
            <input
              type="text"
              required
              value={newBookTitle}
              onChange={(e) => setNewBookTitle(e.target.value)}
              placeholder="Book name (e.g. Isaiah or Psalms)"
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
            <input
              type="text"
              value={newPassage}
              onChange={(e) => setNewPassage(e.target.value)}
              placeholder="Starting passage (e.g. Isaiah 40)"
              className="flex-1 min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            />
            <button
              type="submit"
              className="min-h-[40px] px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-medium"
            >
              Add to Queue
            </button>
          </form>
        )}

        {state.bibleStudies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-6 text-center space-y-2.5">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
              No book studies queued yet
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mx-auto">
              Create your own reading queue and structured study notes for observations, historical context, and prayerful application.
            </p>
            {!addingNewStudy && (
              <button
                type="button"
                onClick={() => setAddingNewStudy(true)}
                className="inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" /> Add first study
              </button>
            )}
          </div>
        ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Study Queue Sidebar */}
          <div className="lg:col-span-4 space-y-4">
            {/* Active & Next */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Active &amp; Upcoming Queue
              </p>
              <div className="space-y-1.5">
                {[...(active ? [active] : []), ...upcoming].map((s, idx) => {
                  const isSel = selectedStudy?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudyId(s.id)}
                      className={`w-full text-left px-3.5 py-2.5 rounded-xl border transition ${
                        isSel
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                          : 'bg-slate-50 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {idx + 1}. {s.book}
                        </span>
                        <span
                          className={`text-[11px] font-medium shrink-0 ${
                            isSel
                              ? 'opacity-80'
                              : s.status === 'in-progress'
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {s.status === 'in-progress' ? 'Current' : 'Next'}
                        </span>
                      </div>
                      <p
                        className={`text-xs truncate mt-0.5 ${
                          isSel ? 'opacity-75' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {s.passage} · {s.readingProgress}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Completed Studies */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                Completed Studies
              </p>
              <div className="space-y-1.5">
                {completed.map((s) => {
                  const isSel = selectedStudy?.id === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setSelectedStudyId(s.id)}
                      className={`w-full text-left px-3.5 py-2 rounded-xl border transition ${
                        isSel
                          ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                          : 'bg-white dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium truncate">
                          {s.book}
                        </span>
                        <span
                          className={`text-[11px] ${
                            isSel
                              ? 'opacity-80'
                              : 'text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          Completed
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Structured Study Editor */}
          {studyDraft && (
            <form
              onSubmit={handleSaveStudy}
              className="lg:col-span-8 space-y-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/40 border border-slate-200/80 dark:border-slate-800 p-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Book / Series
                  </label>
                  <input
                    type="text"
                    value={studyDraft.book}
                    onChange={(e) =>
                      setStudyDraft({ ...studyDraft, book: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Passage Focus
                  </label>
                  <input
                    type="text"
                    value={studyDraft.passage}
                    onChange={(e) =>
                      setStudyDraft({ ...studyDraft, passage: e.target.value })
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Status
                  </label>
                  <select
                    value={studyDraft.status}
                    onChange={(e) =>
                      setStudyDraft({
                        ...studyDraft,
                        status: e.target.value as BibleStudyStatus,
                      })
                    }
                    className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                  >
                    <option value="in-progress">In progress</option>
                    <option value="upcoming">Upcoming queue</option>
                    <option value="completed">Completed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Reading progress
                </label>
                <input
                  type="text"
                  value={studyDraft.readingProgress}
                  onChange={(e) =>
                    setStudyDraft({
                      ...studyDraft,
                      readingProgress: e.target.value,
                    })
                  }
                  placeholder="e.g. Chapters 1–4 complete"
                  className="w-full min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Observations (what the text says)
                  </label>
                  <textarea
                    rows={3}
                    value={studyDraft.observations}
                    onChange={(e) =>
                      setStudyDraft({
                        ...studyDraft,
                        observations: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Historical &amp; literary context
                  </label>
                  <textarea
                    rows={3}
                    value={studyDraft.historicalContext}
                    onChange={(e) =>
                      setStudyDraft({
                        ...studyDraft,
                        historicalContext: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Theological interpretation
                  </label>
                  <textarea
                    rows={3}
                    value={studyDraft.theologicalInterpretation}
                    onChange={(e) =>
                      setStudyDraft({
                        ...studyDraft,
                        theologicalInterpretation: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Cross-references
                  </label>
                  <textarea
                    rows={3}
                    value={studyDraft.crossReferences}
                    onChange={(e) =>
                      setStudyDraft({
                        ...studyDraft,
                        crossReferences: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Practical application
                  </label>
                  <textarea
                    rows={3}
                    value={studyDraft.practicalApplication}
                    onChange={(e) =>
                      setStudyDraft({
                        ...studyDraft,
                        practicalApplication: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                    Questions for further investigation
                  </label>
                  <textarea
                    rows={3}
                    value={studyDraft.questions}
                    onChange={(e) =>
                      setStudyDraft({
                        ...studyDraft,
                        questions: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Optional prayer &amp; journal notes
                </label>
                <textarea
                  rows={2}
                  value={studyDraft.prayerAndJournal}
                  onChange={(e) =>
                    setStudyDraft({
                      ...studyDraft,
                      prayerAndJournal: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                {confirmDeleteStudyId === studyDraft.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-rose-600 dark:text-rose-400">
                      Remove this study?
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        deleteBibleStudy(studyDraft.id);
                        setConfirmDeleteStudyId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 text-white text-xs font-medium"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteStudyId(null)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteStudyId(studyDraft.id)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-rose-600 transition min-h-[36px]"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove study
                  </button>
                )}

                <button
                  type="submit"
                  className="min-h-[40px] px-5 rounded-xl bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 text-xs font-medium hover:opacity-90 transition flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  Save Study Notes
                </button>
              </div>
            </form>
          )}
        </div>
        )}
      </div>

      {/* Recent Recorded Devotionals */}
      <div className="rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200/80 dark:border-slate-800/80 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Heart className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold">Recent Devotional Journal</h3>
        </div>
        {recentDevotions.length === 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No morning or evening reflections logged yet. Save your first entry
            above when ready.
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {recentDevotions.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedDate(item.date)}
                className="w-full text-left py-2.5 flex items-start justify-between gap-4 hover:bg-slate-50/70 dark:hover:bg-slate-800/30 px-2 rounded-lg transition"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                    {item.routineType === 'morning'
                      ? 'Morning Devotion'
                      : 'Evening Reflection'}{' '}
                    · {item.scriptureRef || 'Prayer & reflection'}
                    {item.shortOrMoved ? ' · Shifted gently' : ''}
                  </p>
                  {item.reflection && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                      {item.reflection}
                    </p>
                  )}
                </div>
                <span className="text-[11px] font-mono tabular-nums text-slate-400 shrink-0">
                  {item.date}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
