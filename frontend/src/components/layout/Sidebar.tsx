import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Microscope,
  ShieldCheck,
  Network,
  ListTree,
  FileSearch,
  RotateCcw,
  FileText,
  Settings,
  Cpu,
  Radio,
  Sparkles,
} from 'lucide-react';
import { useForensicsContext } from '../../context/ForensicsContext';

interface NavItem {
  name: string;
  path: string;
  icon: React.ReactNode;
  badge?: string;
}

export const Sidebar: React.FC = () => {
  const { phase, systemStatus, currentRun } = useForensicsContext();

  const isRunning = phase === 'running' || phase === 'recovering';
  const hasFailure = currentRun?.diagnosis.has_failure && !currentRun?.diagnosis.unknown;

  const navItems: NavItem[] = [
    { name: 'Product Home', path: '/', icon: <Sparkles className="w-4 h-4" /> },
    { name: 'Console', path: '/dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    {
      name: 'Investigation',
      path: '/investigation',
      icon: <Microscope className="w-4 h-4" />,
      badge: hasFailure ? 'FAILURE' : isRunning ? 'RUNNING' : 'HERO',
    },
    { name: 'Agent Graph', path: '/agents', icon: <Network className="w-4 h-4" /> },
    { name: 'Trace Explorer', path: '/trace', icon: <ListTree className="w-4 h-4" /> },
    { name: 'Evidence', path: '/evidence', icon: <FileSearch className="w-4 h-4" /> },
    { name: 'Replay', path: '/replay', icon: <RotateCcw className="w-4 h-4" /> },
    { name: 'Reports', path: '/reports', icon: <FileText className="w-4 h-4" /> },
    { name: 'Reliability', path: '/reliability', icon: <ShieldCheck className="w-4 h-4" /> },
  ];

  return (
    <aside className="w-64 bg-white/80 backdrop-blur-2xl border-r border-slate-200/80 flex flex-col justify-between h-screen sticky top-0 z-30 select-none shadow-[4px_0_24px_rgba(15,23,42,0.04)]">
      {/* Brand Header */}
      <div>
        <div className="p-5 border-b border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-md">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-base tracking-wider text-slate-900 font-sans flex items-center gap-1.5">
                FAULTLINE
                <span className="text-[10.5px] font-mono font-bold bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">v2.0</span>
              </div>
              <div className="text-[10px] uppercase tracking-widest text-slate-500 font-sans font-semibold">
                Causal Forensics SaaS
              </div>
            </div>
          </div>

          {/* System Pulse Indicator */}
          <div className="mt-4 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs shadow-sm">
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-pink-500 animate-ping' : 'bg-emerald-500 shadow-sm'}`} />
              <span className="text-[11px] text-slate-700 uppercase font-semibold font-mono">
                {isRunning ? 'PIPELINE ACTIVE' : 'SYSTEM READY'}
              </span>
            </div>
            <Radio className={`w-3.5 h-3.5 ${isRunning ? 'text-pink-500 animate-pulse' : 'text-emerald-600'}`} />
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="p-3 space-y-1">
          <div className="px-3 py-2 text-[10px] uppercase tracking-widest font-mono text-slate-400 font-bold">
            Platform
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 group ${
                  isActive
                    ? 'bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 text-white shadow-md shadow-violet-200 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`
              }
            >
              <div className="flex items-center gap-3">
                <span className="transition-colors group-hover:text-violet-600">
                  {item.icon}
                </span>
                <span>{item.name}</span>
              </div>
              {item.badge && (
                <span className={`text-[9px] font-mono px-2 py-0.5 rounded-full font-bold border ${
                  item.badge === 'FAILURE'
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : item.badge === 'RUNNING'
                    ? 'bg-pink-50 text-pink-700 border-pink-200 animate-pulse'
                    : 'bg-violet-50 text-violet-700 border-violet-200'
                }`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </div>

      {/* Footer / Status */}
      <div className="p-4 border-t border-slate-200/80 space-y-3">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
              isActive ? 'bg-slate-100 text-slate-900 font-bold' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
            }`
          }
        >
          <Settings className="w-4 h-4 text-slate-500" />
          <span>Engine Settings</span>
        </NavLink>

        <div className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-600 space-y-1">
          <div className="flex justify-between">
            <span>Model Engine:</span>
            <span className="text-slate-800 font-mono font-medium">
              {systemStatus?.gemini_connected ? 'Gemini 2.0' : 'Template AST'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Trace Schema:</span>
            <span className="text-emerald-700 font-mono font-bold">8-Field Strict</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
