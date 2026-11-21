import React from 'react';
import { BookOpen, Dumbbell, Film } from 'lucide-react';
import { useLifeHQ } from '../context/LifeHQContext';
import { PillarTab } from '../types/lifehq';
import { FaithWorkspace } from './FaithWorkspace';
import { FitnessWorkspace } from './FitnessWorkspace';
import { BeholdWorkspace } from './BeholdWorkspace';

const TABS: Array<{
  id: PillarTab;
  label: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    id: 'faith',
    label: 'Faith',
    subtitle: 'Devotion · Reading · Study queue',
    icon: BookOpen,
  },
  {
    id: 'fitness',
    label: 'Fitness',
    subtitle: 'Strength · Cardio · PRs',
    icon: Dumbbell,
  },
  {
    id: 'behold',
    label: 'Creative Craft',
    subtitle: 'Practice Modules · Projects',
    icon: Film,
  },
];

export const PillarsView: React.FC = () => {
  const { pillarTab, setPillarTab } = useLifeHQ();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-semibold tracking-tight text-slate-900 dark:text-white">
            Development Pillars
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Dedicated workspaces for spiritual rhythm, strength &amp;
            conditioning, and creative craft projects.
          </p>
        </div>

        {/* Segmented Control */}
        <div
          role="tablist"
          aria-label="Development pillar workspaces"
          className="inline-flex p-1 rounded-2xl bg-slate-200/70 dark:bg-slate-800/80 self-start sm:self-auto"
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = pillarTab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                type="button"
                onClick={() => setPillarTab(t.id)}
                className={`min-h-[40px] px-4 rounded-xl text-xs font-semibold flex items-center gap-2 transition ${
                  active
                    ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                    : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {pillarTab === 'faith' && <FaithWorkspace />}
      {pillarTab === 'fitness' && <FitnessWorkspace />}
      {pillarTab === 'behold' && <BeholdWorkspace />}
    </div>
  );
};
