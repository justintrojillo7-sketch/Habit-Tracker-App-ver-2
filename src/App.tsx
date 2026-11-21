/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { LifeHQProvider, useLifeHQ } from './context/LifeHQContext';
import { Layout } from './components/Layout';
import { SignInGate } from './components/SignInGate';
import { TodayView } from './components/TodayView';
import { CalendarView } from './components/CalendarView';
import { HabitsView } from './components/HabitsView';
import { PillarsView } from './components/PillarsView';
import { TrackView } from './components/TrackView';
import { InsightsView } from './components/InsightsView';
import { GoalsView } from './components/GoalsView';
import { SettingsView } from './components/SettingsView';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(err: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: err?.message || 'An unexpected error occurred.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('LifeHQ ErrorBoundary:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center px-4 bg-[#f8f9fb] dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100">
          <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#141b29] border border-slate-200 dark:border-slate-800 p-6 space-y-4">
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              LifeHQ encountered an unexpected error while loading your
              workspace. Reload to reconnect cleanly.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            >
              Reload LifeHQ
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const ActiveView: React.FC = () => {
  const { activeSection } = useLifeHQ();

  switch (activeSection) {
    case 'today':
      return <TodayView />;
    case 'calendar':
      return <CalendarView />;
    case 'habits':
      return <HabitsView />;
    case 'pillars':
      return <PillarsView />;
    case 'track':
      return <TrackView />;
    case 'insights':
      return <InsightsView />;
    case 'goals':
      return <GoalsView />;
    case 'settings':
      return <SettingsView />;
    default:
      return <TodayView />;
  }
};

const AuthenticatedWorkspace: React.FC = () => {
  const { cloudUser, cloudAuthReady, cloudLoading } = useLifeHQ();

  if (!cloudAuthReady || cloudLoading || !cloudUser || !cloudUser.emailVerified) {
    return <SignInGate />;
  }

  return (
    <Layout>
      <ActiveView />
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <LifeHQProvider>
        <AuthenticatedWorkspace />
      </LifeHQProvider>
    </ErrorBoundary>
  );
}
