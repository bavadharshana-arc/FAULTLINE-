import React from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw, ShieldCheck, CheckCircle2, AlertOctagon, Info } from 'lucide-react';
import { useForensicsContext } from '../context/ForensicsContext';
import { EmptyState } from '../components/common/EmptyState';
import { ReplayComparisonCard } from '../components/investigation/ReplayComparisonCard';
import { GlassCard } from '../components/common/GlassCard';

export const Replay: React.FC = () => {
  const navigate = useNavigate();
  const { currentRun, replayResult, replayWorkflow, phase } = useForensicsContext();

  if (!currentRun) {
    return (
      <EmptyState
        title="NO REPLAY DATA"
        description="Run an investigation to identify a failure, then execute a controlled counterfactual replay to verify whether removing the fault restores execution."
        actionLabel="Go to Investigation Workspace"
        onAction={() => navigate('/investigation')}
        icon={<RotateCcw className="w-8 h-8" />}
      />
    );
  }

  const isReplaying = phase === 'recovering';
  const canReplay = currentRun.diagnosis.has_failure && !currentRun.diagnosis.unknown;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-violet-600" />
            CONTROLLED COUNTERFACTUAL REPLAY
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Empirical verification: isolate the suspected root cause and re-evaluate pipeline under identical constraints
          </p>
        </div>
        <span className="text-xs font-mono text-slate-700 bg-white/80 px-4 py-2 rounded-full border border-slate-200/80 shadow-sm backdrop-blur-md">
          Target Case: <strong className="text-violet-700">{currentRun.id}</strong>
        </span>
      </div>

      {/* Epistemological Note Card */}
      <GlassCard glow="cyan" className="bg-white/80 border-slate-200/80">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-violet-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs font-mono text-slate-700 space-y-1">
            <span className="text-slate-900 font-bold block uppercase tracking-wider">
              Forensic Methodology Note:
            </span>
            <p className="leading-relaxed text-slate-600">
              Counterfactual replay re-executes the multi-agent workflow with the isolated fault removed from the suspected root-cause agent ({currentRun.diagnosis.root_cause_agent || 'suspected agent'}). This demonstrates empirical recovery rather than theoretical causal deduction.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Main Replay Comparison */}
      <ReplayComparisonCard
        replay={currentRun.replay || replayResult}
        onReplay={replayWorkflow}
        isReplaying={isReplaying}
        canReplay={canReplay}
      />
    </div>
  );
};
