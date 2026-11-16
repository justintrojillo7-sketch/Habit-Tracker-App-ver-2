/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { LifeHQProvider, useLifeHQ } from './context/LifeHQContext';
import { Layout } from './components/Layout';
import { TodayView } from './components/TodayView';
import { CalendarView } from './components/CalendarView';
import { TrackView } from './components/TrackView';
import { InsightsView } from './components/InsightsView';
import { GoalsView } from './components/GoalsView';
import { SettingsView } from './components/SettingsView';

const ActiveView: React.FC = () => {
  const { activeSection } = useLifeHQ();

  switch (activeSection) {
    case 'today':
      return <TodayView />;
    case 'calendar':
      return <CalendarView />;
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

export default function App() {
  return (
    <LifeHQProvider>
      <Layout>
        <ActiveView />
      </Layout>
    </LifeHQProvider>
  );
}
