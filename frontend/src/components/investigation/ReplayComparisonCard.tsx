import React from 'react';
import { RotateCcw, CheckCircle2, AlertOctagon, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { ReplayResult } from '../../types/forensics';
import { GlassCard } from '../common/GlassCard';
import { StatusBadge } from '../common/StatusBadge';
import { Button } from '../common/Button';

interface ReplayComparisonCardProps {
  replay: ReplayResult | null;
  onReplay: () => void;
  isReplaying: boolean;
  canReplay: boolean;
}

export const ReplayComparisonCard: React.FC<ReplayComparisonCardProps> = ({
  replay,
  onReplay,
  isReplaying,
  canReplay,
}) => {
  if (!canReplay && !replay) {
    return null;
  }

  const renderTraceColumn = (
    title: string,
    pair: [any[], any] | null,
    isAfter: boolean
  ) => {
    if (!pair) {
      return (
        <div className="p-5 rounded-xl bg-obsidian-card/60 border border-obsidian-border text-center text-xs font-mono text-faultline-textDim">
          No telemetry available
        </div>
      );
    }

    const [trace, diagnosis] = pair;
    const isWorkflowFailed = diagnosis?.has_failure;
    const finalEvent = trace.find((t) => t.agent === 'Final');

    let finalValue = '—';
    if (finalEvent) {
      try {
        const parsed = JSON.parse(finalEvent.output);
        finalValue = parsed.final_value !== undefined ? String(parsed.final_value) : String(finalEvent.output);
      } catch {
        finalValue = String(finalEvent.output);
      }
    }

    return (
      <div className={`p-4 rounded-2xl border flex flex-col justify-between shadow-sm ${
        isAfter
          ? 'bg-emerald-50/70 border-emerald-200'
          : 'bg-rose-50/70 border-rose-200'
      }`}>
        <div>
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-200/80">
            <span className={`text-xs font-bold uppercase font-sans ${isAfter ? 'text-emerald-700' : 'text-rose-700'}`}>
              {title}
            </span>
            <span className={`text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full font-bold border ${
              isWorkflowFailed
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
            }`}>
              {isWorkflowFailed ? 'WORKFLOW FAILED ✕' : 'WORKFLOW RESTORED ✓'}
            </span>
          </div>

          <div className="space-y-2 mb-4 font-mono text-xs">
            {trace.map((t) => {
              const isRoot = t.step === diagnosis?.root_cause_step && diagnosis?.has_failure;
              const isDownstream = diagnosis?.downstream_steps?.includes(t.step);
              const failed = t.status === 'failed';

              return (
                <div
                  key={t.step}
                  className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm"
                >
                  <span className="text-slate-800 font-semibold">
                    Step {t.step} · {t.agent}
                  </span>
                  {isRoot ? (
                    <span className="text-rose-600 font-bold">FAILED ✕</span>
                  ) : isDownstream ? (
                    <span className="text-amber-700 font-bold">DOWNSTREAM ⚠</span>
                  ) : failed ? (
                    <span className="text-rose-600 font-bold">FAILED ✕</span>
                  ) : (
                    <span className="text-emerald-700 font-bold">PASSED ✓</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200/80 flex items-center justify-between text-xs font-mono">
          <span className="text-slate-500">Terminal Result:</span>
          <span className={`font-bold font-mono ${isWorkflowFailed ? 'text-rose-700' : 'text-emerald-700'}`}>
            {finalValue}
          </span>
        </div>
      </div>
    );
  };

  return (
    <GlassCard glow="purple" className="mt-8 border-slate-200/80 bg-white/80">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-200/80">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider font-sans text-slate-900 flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-violet-600" />
            COUNTERFACTUAL CHECK
          </h3>
          <p className="text-xs text-slate-500 font-sans mt-0.5">
            Empirical verification: isolate the suspected root cause and re-evaluate the pipeline under identical inputs
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={onReplay}
          isLoading={isReplaying}
        >
          {replay ? 'Re-run Counterfactual Verification' : 'Execute Counterfactual Re-run'}
        </Button>
      </div>

      {replay && replay.applicable ? (
        <div className="space-y-4">
          <div className="text-xs font-mono text-slate-600">
            Isolated Root Agent: <strong className="text-slate-900 uppercase font-bold">{replay.fixed_agent}</strong>
          </div>

          {/* WITHOUT ROOT FAILURE flow — built from the same replay fields shown below */}
          <div className="flex items-center justify-center gap-1.5 flex-wrap text-[9.5px] font-mono uppercase font-bold tracking-wider">
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">Without Root Failure</span>
            <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">{replay.fixed_agent} Corrected</span>
            <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            <span className="px-2 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">Expected Execution</span>
            <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
            <span className={`px-2 py-1 rounded-full border ${replay.recovered ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`}>
              {replay.recovered ? 'Recovery · No Downstream Corruption' : 'Still Corrupted'}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {renderTraceColumn('ORIGINAL — FAULT PRESENT', replay.before, false)}
            {renderTraceColumn('COUNTERFACTUAL — FAULT REMOVED', replay.after, true)}
          </div>

          {/* Verification Banner */}
          {replay.recovered ? (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center gap-3 shadow-sm">
              <CheckCircle2 className="w-6 h-6 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="text-xs font-bold font-sans uppercase text-emerald-800 tracking-wider flex items-center gap-2">
                  ✅ EMPIRICAL PROOF CONFIRMED: REPLAY RESTORED PIPELINE
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 border border-emerald-300">RECOVERED: TRUE</span>
                </span>
                <span className="text-xs font-sans text-slate-600">
                  Removing the isolated fault from <strong className="text-slate-900 font-mono">{replay.fixed_agent}</strong> restored all downstream steps to clean execution without failures.
                </span>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-3 shadow-sm">
              <AlertOctagon className="w-6 h-6 text-rose-600 flex-shrink-0" />
              <div>
                <span className="text-xs font-bold font-sans uppercase text-rose-800 tracking-wider flex items-center gap-2">
                  REPLAY DID NOT RECOVER PIPELINE
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 border border-rose-300">RECOVERED: FALSE</span>
                </span>
                <span className="text-xs font-sans text-slate-600">
                  The pipeline still encountered errors during counterfactual replay. Root cause may be compound or outside target agent.
                </span>
              </div>
            </div>
          )}
        </div>
      ) : replay && !replay.applicable ? (
        <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600">
          {replay.reason || 'Counterfactual replay is not applicable for this run.'}
        </div>
      ) : (
        <div className="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-xs font-sans text-slate-600 space-y-2">
          <p>Click &ldquo;Execute Counterfactual Re-run&rdquo; above to isolate the suspected root fault and re-evaluate.</p>
          <p className="text-[11px] text-slate-500 font-mono">
            Proves causation by demonstrating that removing the fault directly restores correct execution.
          </p>
        </div>
      )}
    </GlassCard>
  );
};
