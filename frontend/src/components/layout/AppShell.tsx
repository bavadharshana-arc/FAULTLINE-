import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export const AppShell: React.FC = () => {
  return (
    <div className="flex min-h-screen bg-obsidian text-faultline-text relative overflow-x-hidden selection:bg-violet-600/40 selection:text-white">
      <div className="ambient-glow" />
      {/* Luminous pearl depth spheres */}
      <div className="fixed top-10 right-20 w-96 h-96 rounded-full bg-gradient-to-tr from-fuchsia-300/25 via-purple-300/25 to-indigo-200/25 blur-[100px] pointer-events-none -z-0 animate-pulse-subtle" />
      <div className="fixed bottom-10 left-80 w-80 h-80 rounded-full bg-gradient-to-br from-violet-300/20 to-rose-200/25 blur-[100px] pointer-events-none -z-0" />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 z-10">
        <Topbar />
        <main className="flex-1 p-6 max-w-[1700px] w-full mx-auto overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
