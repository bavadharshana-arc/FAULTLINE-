import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Terminal, RefreshCw, AlertTriangle, CheckCircle2, Search } from 'lucide-react';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { useForensicsContext } from '../../context/ForensicsContext';

export const Topbar: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { phase, currentRun, resetState } = useForensicsContext();

  const getStatusDisplay = () => {
    if (phase === 'running') {
      return <StatusBadge label="INVESTIGATING" tone="info" pulse size="md" />;
    }
    if (phase === 'recovering') {
      return <StatusBadge label="REPLAYING" tone="info" pulse size="md" />;
    }
    if (phase === 'recovered') {
      return <StatusBadge label="RECOVERED" tone="passed" glyph="✓" size="md" />;
    }
    if (phase === 'error') {
      return <StatusBadge label="ERROR DETECTED" tone="failure" glyph="✕" size="md" />;
    }
    if (!currentRun) {
      return <StatusBadge label="SYSTEM READY" tone="neutral" size="md" />;
    }
    if (currentRun.diagnosis.unknown) {
      return <StatusBadge label="INSUFFICIENT EVIDENCE" tone="warning" glyph="?" size="md" />;
    }
    if (currentRun.diagnosis.has_failure) {
      return <StatusBadge label="ROOT CAUSE IDENTIFIED" tone="root" glyph="●" pulse size="md" />;
    }
    return <StatusBadge label="NO FAILURE DETECTED" tone="passed" glyph="✓" size="md" />;
  };

  const pageNames: Record<string, string> = {
    '/': 'Command Center & Overview',
    '/investigation': 'Investigation Workspace',
    '/agents': 'Spatial Agent Graph',
    '/trace': 'Trace Telemetry Explorer',
    '/evidence': 'Forensic Evidence Locker',
    '/replay': 'Counterfactual Replay',
    '/reports': 'Incident Forensics Report',
    '/reliability': 'Agent Reliability Intelligence',
    '/settings': 'Telemetry & Engine Settings',
  };

  const currentPageTitle = pageNames[location.pathname] || 'Forensics Console';

  return (
    <header className="h-16 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-20 shadow-[0_2px_12px_rgba(15,23,42,0.03)]">
      {/* Breadcrumb & Section Title */}
      <div className="flex items-center gap-3">
        <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent font-mono text-base font-bold">◆</span>
        <div>
          <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2 font-sans">
            {currentPageTitle}
            {currentRun && (
              <span className="text-xs font-normal font-mono text-slate-600 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                · {currentRun.id}
              </span>
            )}
          </h1>
          <div className="text-[10px] uppercase font-sans tracking-widest text-slate-500 font-semibold">
            FAULTLINE · Causal Forensics & Reliability Intelligence
          </div>
        </div>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-4">
        {/* Status Pill */}
        {getStatusDisplay()}

        {/* Quick Reset */}
        {currentRun && (
          <Button
            variant="secondary"
            size="sm"
            icon={<RefreshCw className="w-3.5 h-3.5 text-faultline-textMuted" />}
            onClick={resetState}
            title="Reset investigation to idle state"
          >
            Reset
          </Button>
        )}

        {/* New Investigation CTA */}
        <Button
          variant="primary"
          size="sm"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => {
            resetState();
            navigate('/investigation');
          }}
        >
          New Investigation
        </Button>
      </div>
    </header>
  );
};
