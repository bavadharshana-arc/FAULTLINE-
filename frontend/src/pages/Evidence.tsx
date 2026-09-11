import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileSearch, ShieldCheck, CheckCircle2, AlertOctagon } from 'lucide-react';
import { useForensicsContext } from '../context/ForensicsContext';
import { EmptyState } from '../components/common/EmptyState';
import { ForensicEvidenceViewer } from '../components/investigation/ForensicEvidenceViewer';
import { GlassCard } from '../components/common/GlassCard';

export const Evidence: React.FC = () => {
  const navigate = useNavigate();
  const { currentRun } = useForensicsContext();

  if (!currentRun) {
    return (
      <EmptyState
        title="NO FORENSIC EVIDENCE TO DISPLAY"
        description="Run a diagnostic workflow to extract deterministic evidence, execution inputs, outputs, and validation assertions."
        actionLabel="Go to Investigation Workspace"
        onAction={() => navigate('/investigation')}
        icon={<FileSearch className="w-8 h-8" />}
      />
    );
  }

  const { trace, diagnosis } = currentRun;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
            <FileSearch className="w-5 h-5 text-violet-600" />
            FORENSIC EVIDENCE LOCKER
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Immutable trace records evaluated against deterministic ground truth
          </p>
        </div>
        <span className="text-xs font-mono text-slate-700 bg-white/80 px-4 py-2 rounded-full border border-slate-200/80 shadow-sm backdrop-blur-md">
          Case File: <strong className="text-violet-700">{currentRun.id}</strong>
        </span>
      </div>

      {/* Forensic Overview Strip */}
      <GlassCard glow="violet" className="bg-white/80 border-slate-200/80">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <span className="text-slate-500 uppercase block mb-1 font-semibold">Evidence Basis:</span>
            <span className="text-slate-900 font-bold flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {diagnosis.unknown ? 'Heuristic (Ambiguous)' : 'Deterministic Ground Truth'}
            </span>
          </div>

          <div>
            <span className="text-slate-500 uppercase block mb-1 font-semibold">Total Evidence Items:</span>
            <span className="text-slate-900 font-bold">{trace.length} Recorded Steps</span>
          </div>

          <div>
            <span className="text-slate-500 uppercase block mb-1 font-semibold">Attribution Verdict:</span>
            <span className={`font-bold ${diagnosis.has_failure ? 'text-rose-700' : 'text-emerald-700'}`}>
              {diagnosis.unknown
                ? 'Inconclusive'
                : diagnosis.has_failure
                ? `${diagnosis.root_cause_agent} (Step ${diagnosis.root_cause_step})`
                : 'Validated Clean'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Main Evidence Viewer */}
      <ForensicEvidenceViewer trace={trace} diagnosis={diagnosis} />
    </div>
  );
};
