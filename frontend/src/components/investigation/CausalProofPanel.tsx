import React from 'react';
import { ArrowDown, ShieldCheck, GitCommitHorizontal } from 'lucide-react';
import { Diagnosis } from '../../types/forensics';
import { GlassCard } from '../common/GlassCard';
import { StatusBadge, BadgeTone } from '../common/StatusBadge';

interface CausalProofPanelProps {
  diagnosis: Diagnosis;
}

/**
 * SECTION 3 — "WHY THIS IS THE ROOT CAUSE"
 *
 * Renders the deterministic dependency-chain proof: a step-by-step causal
 * comparison built entirely from diagnosis.annotated_trace (parent_step
 * ancestry), never from chronological order or invented narrative.
 */
export const CausalProofPanel: React.FC<CausalProofPanelProps> = ({ diagnosis }) => {
  const { has_failure, unknown, root_cause_agent, root_cause_step, annotated_trace } = diagnosis;

  // Only meaningful when a confirmed (non-ambiguous) root cause exists.
  if (!has_failure || unknown || !annotated_trace?.length) {
    return null;
  }

  const sortedTrace = [...annotated_trace].sort((a, b) => a.step - b.step);
  const stepIndex = new Map(sortedTrace.map((e) => [e.step, e]));

  return (
    <GlassCard glow="red" className="mt-8 border-rose-200 bg-white/85">
      <div className="flex items-center gap-2 mb-1">
        <GitCommitHorizontal className="w-4 h-4 text-rose-600" />
        <h3 className="text-sm font-extrabold uppercase tracking-wider font-sans text-slate-900">
          Why This Is The Root Cause
        </h3>
      </div>
      <p className="text-xs text-slate-500 font-mono mb-5">
        Causal comparison derived from parent_step dependency ancestry — not execution order.
      </p>

      <div className="flex flex-col items-stretch max-w-xl mx-auto">
        {sortedTrace.map((event, idx) => {
          const isRoot = event.step === root_cause_step;
          const isDownstream = event.blame_role === 'DOWNSTREAM';
          const isIndependent = event.blame_role === 'INDEPENDENT';
          const parentEvent = event.parent_step !== null ? stepIndex.get(event.parent_step) : undefined;

          let tone: BadgeTone = 'passed';
          let label = 'PASSED';
          let boxClass = 'bg-white border-slate-200';
          if (isRoot) {
            tone = 'root';
            label = 'FAILED';
            boxClass = 'bg-rose-50 border-rose-300';
          } else if (isDownstream) {
            tone = 'downstream';
            label = 'DOWNSTREAM';
            boxClass = 'bg-amber-50 border-amber-200';
          } else if (isIndependent) {
            tone = 'warning';
            label = 'INDEPENDENT';
            boxClass = 'bg-amber-50/60 border-amber-200';
          }

          return (
            <React.Fragment key={event.step}>
              <div className={`p-3.5 rounded-2xl border shadow-sm ${boxClass}`}>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-mono text-xs font-extrabold text-slate-900 uppercase tracking-wide">
                    STEP {event.step} — {event.agent}
                  </span>
                  <StatusBadge label={label} tone={tone} size="sm" />
                </div>
                <div className="text-[11px] font-mono text-slate-500">
                  Parent: {parentEvent ? `Step ${parentEvent.step} (${parentEvent.agent})` : event.parent_step !== null ? `Step ${event.parent_step}` : '—'}
                </div>

                {isRoot && (diagnosis.root_cause_expected !== null || diagnosis.root_cause_actual !== null) && (
                  <div className="mt-2.5 grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <span className="text-emerald-700 font-bold">
                      Expected: {diagnosis.root_cause_expected ?? '—'}
                    </span>
                    <span className="text-rose-700 font-bold">
                      Actual: {diagnosis.root_cause_actual ?? '—'}
                    </span>
                  </div>
                )}

                {isDownstream && (
                  <div className="mt-1.5 text-[10.5px] font-mono text-amber-700 font-bold">
                    Affected by Step {root_cause_step}
                  </div>
                )}
              </div>

              {idx < sortedTrace.length - 1 && (
                <div className="flex justify-center py-1.5">
                  <ArrowDown className="w-4 h-4 text-slate-300" />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="mt-5 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center gap-2.5 shadow-sm max-w-xl mx-auto">
        <ShieldCheck className="w-4 h-4 text-rose-600 flex-shrink-0" />
        <span className="text-xs font-bold font-sans text-rose-800">
          The {root_cause_agent} is the earliest invalid state in the dependency chain.
        </span>
      </div>
    </GlassCard>
  );
};
