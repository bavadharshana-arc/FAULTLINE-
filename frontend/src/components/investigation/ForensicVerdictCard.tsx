import React from 'react';
import { Award, GitBranch, RotateCcw } from 'lucide-react';
import { Diagnosis, ReplayResult } from '../../types/forensics';
import { GlassCard } from '../common/GlassCard';

interface ForensicVerdictCardProps {
  diagnosis: Diagnosis;
  replay: ReplayResult | null;
}

/**
 * SECTION 8 — FINAL FORENSIC VERDICT
 *
 * Compact summary tying together: ORIGIN → PROOF → PROPAGATION → IMPACT → RECOVERY.
 * Every value here is read straight off `diagnosis` / `replay` — nothing is invented.
 */
export const ForensicVerdictCard: React.FC<ForensicVerdictCardProps> = ({ diagnosis, replay }) => {
  const {
    has_failure,
    unknown,
    root_cause_agent,
    root_cause_step,
    root_cause_expected,
    root_cause_actual,
    downstream_agents,
    blame_confidence,
  } = diagnosis;

  let verdictLabel = 'NO FAILURE';
  let glow: 'green' | 'cyan' | 'red' = 'green';
  let badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';

  if (has_failure && unknown) {
    verdictLabel = 'INSUFFICIENT EVIDENCE';
    glow = 'cyan';
    badgeClass = 'bg-amber-50 text-amber-800 border-amber-200';
  } else if (has_failure) {
    verdictLabel = 'ROOT CAUSE CONFIRMED';
    glow = 'red';
    badgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
  }

  const counterfactualLabel = !replay || !replay.applicable
    ? 'NOT YET TESTED'
    : replay.recovered
      ? 'RECOVERED'
      : 'NOT RECOVERED';

  const counterfactualClass = !replay || !replay.applicable
    ? 'text-slate-400'
    : replay.recovered
      ? 'text-emerald-700'
      : 'text-rose-700';

  return (
    <GlassCard glow={glow} className="border-slate-200/80 bg-white/85">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200/80">
        <Award className="w-4 h-4 text-violet-600" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider font-sans text-slate-900">
          Forensic Verdict
        </h3>
        <span className={`ml-auto text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 rounded-full border ${badgeClass}`}>
          {verdictLabel}
        </span>
      </div>

      {!has_failure ? (
        <p className="text-xs font-sans text-slate-600 leading-relaxed">
          Every agent executed within valid, deterministically verified contracts. No root-cause attribution required.
        </p>
      ) : unknown ? (
        <p className="text-xs font-sans text-slate-600 leading-relaxed">
          Available evidence does not establish a deterministic first invalid execution state. No root cause is assigned.
        </p>
      ) : (
        <div className="space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 uppercase tracking-wider font-sans font-semibold">Root Cause</span>
            <span className="font-extrabold text-rose-700 text-right">{root_cause_agent} — Step {root_cause_step}</span>
          </div>

          {(root_cause_expected !== null || root_cause_actual !== null) && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500 uppercase tracking-wider font-sans font-semibold">First Invalid State</span>
              <span className="font-bold text-right">
                <span className="text-emerald-700">{root_cause_expected ?? '—'}</span>
                <span className="text-slate-400 mx-1">→</span>
                <span className="text-rose-700">{root_cause_actual ?? '—'}</span>
              </span>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 uppercase tracking-wider font-sans font-semibold flex items-center gap-1">
              <GitBranch className="w-3 h-3" /> Propagation
            </span>
            <span className="font-bold text-amber-700 text-right">
              {downstream_agents?.length ? downstream_agents.join(' → ') : 'Contained (no downstream)'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500 uppercase tracking-wider font-sans font-semibold">Validation</span>
            <span className="font-bold text-slate-800 text-right">
              {typeof blame_confidence === 'number'
                ? `${blame_confidence.toFixed(1)}% (deterministic assertion)`
                : 'Deterministic ground-truth mismatch'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3 pt-2.5 border-t border-slate-200">
            <span className="text-slate-500 uppercase tracking-wider font-sans font-semibold flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Counterfactual
            </span>
            <span className={`font-extrabold ${counterfactualClass}`}>{counterfactualLabel}</span>
          </div>
        </div>
      )}
    </GlassCard>
  );
};
