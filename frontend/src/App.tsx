import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ForensicsProvider } from './context/ForensicsContext';
import { AppShell } from './components/layout/AppShell';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { Investigation } from './pages/Investigation';
import { AgentGraph } from './pages/AgentGraph';
import { TraceExplorer } from './pages/TraceExplorer';
import { Evidence } from './pages/Evidence';
import { Replay } from './pages/Replay';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';
import { Reliability } from './pages/Reliability';

export const App: React.FC = () => {
  return (
    <ForensicsProvider>
      <BrowserRouter>
        <Routes>
          {/* Dedicated Full-Width SaaS Landing Page */}
          <Route path="/" element={<Landing />} />

          {/* Forensic Workspace Application Shell */}
          <Route element={<AppShell />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/investigation" element={<Investigation />} />
            <Route path="/reliability" element={<Reliability />} />
            <Route path="/agents" element={<AgentGraph />} />
            <Route path="/trace" element={<TraceExplorer />} />
            <Route path="/evidence" element={<Evidence />} />
            <Route path="/replay" element={<Replay />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ForensicsProvider>
  );
};
