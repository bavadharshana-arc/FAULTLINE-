import React from 'react';
import {
  AlertOctagon,
  CheckCircle2,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Wrench,
  Workflow,
  Target,
} from 'lucide-react';
import { Diagnosis } from '../../types/forensics';
import { GlassCard } from '../common/GlassCard';
import { StatusBadge } from '../common/StatusBadge';

interface RootCauseCardProps {
  diagnosis: Diagnosis;
}

export const RootCauseCard: React.FC<RootCauseCardProps> = ({ diagnosis }) => {
  const {
    has_failure,
    root_cause_agent,
    root_cause_step,
    root_cause_error_type,
    root_cause_reason,
    root_cause_expected,
    root_cause_actual,
    downstream_agents,
    unknown,
    unknown_reason,
    remediation,
    annotated_trace,
    blame_confidence,
  } = diagnosis;

  // Case 1: Workflow executed cleanly (no failure)
  if (!has_failure) {
    return (
      <GlassCard glow="green" className="bg-emerald-50/70 border-emerald-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-sans tracking-widest text-emerald-700 font-bold">
              Verification Clean · 100% Deterministic Match
            </span>
            <h3 className="text-base font-bold text-slate-900 font-sans">
              NO FAILURE DETECTED
            </h3>
          </div>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed font-sans">
          Every agent executed within valid contracts and verified against deterministic assertions. Zero root-cause attribution required.
        </p>
      </GlassCard>
    );
  }

  // Case 2: Insufficient Evidence / Ambiguous Attribution
  if (unknown) {
    const candidateFailures = annotated_trace?.filter((t) => t.status === 'failed') || [];

    return (
      <GlassCard glow="cyan" className="bg-amber-50/70 border-amber-200">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-700 shadow-sm">
            <HelpCircle className="w-6 h-6" />
          </div>
          <div>
            <StatusBadge label="INCONCLUSIVE EVIDENCE" tone="warning" glyph="?" size="sm" />
            <h3 className="text-base font-bold text-slate-900 font-sans mt-1">
              FORENSIC VERDICT · INSUFFICIENT EVIDENCE
            </h3>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white border border-amber-200 text-sm text-slate-700 mb-4 font-sans shadow-sm">
          Available evidence does not establish a deterministic first invalid execution state.
          <div className="mt-2 text-xs font-mono text-amber-800 font-bold">
            NO ROOT-CAUSE BLAME ASSIGNED (ZERO HEURISTIC GUESSWORK).
          </div>
        </div>

        {unknown_reason && (
          <div className="mb-4 text-xs font-mono text-slate-700 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm">
            <span className="text-slate-500 uppercase tracking-wider block mb-1 font-semibold">Why:</span>
            {unknown_reason}
          </div>
        )}

        {candidateFailures.length > 0 && (
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-slate-500 mb-2 font-bold">
              Candidate Steps Evaluated:
            </div>
            <div className="space-y-2">
              {candidateFailures.map((cand) => (
                <div
                  key={cand.step}
                  className="p-3 rounded-xl bg-white border border-slate-200 text-xs flex items-center justify-between shadow-sm"
                >
                  <span className="font-mono font-bold text-slate-900">
                    Step {cand.step} · {cand.agent}
                  </span>
                  <span className="font-mono text-rose-600 font-bold uppercase">
                    {cand.error_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </GlassCard>
    );
  }

  // Case 3: Confirmed Root Cause
  const hasExpectedActual = root_cause_expected !== null || root_cause_actual !== null;

  // Root cause's parent, resolved from the annotated trace — never invented.
  const rootTraceEvent = annotated_trace?.find((t) => t.step === root_cause_step);
  const parentStep = rootTraceEvent?.parent_step ?? null;
  const parentEvent = parentStep !== null ? annotated_trace?.find((t) => t.step === parentStep) : undefined;

  // Numeric expected/actual difference — only computed when both values are
  // genuinely numeric. Never fabricated when the comparison isn't numeric.
  const expectedNum = root_cause_expected !== null ? Number(root_cause_expected) : NaN;
  const actualNum = root_cause_actual !== null ? Number(root_cause_actual) : NaN;
  const hasNumericDiff = Number.isFinite(expectedNum) && Number.isFinite(actualNum);
  const diffValue = hasNumericDiff ? actualNum - expectedNum : null;

  // Concise, dynamically generated explanation — built only from fields the
  // backend already returned, never a hardcoded/fabricated narrative.
  const dynamicExplanation = hasExpectedActual
    ? `${root_cause_agent} Step ${root_cause_step} produced ${root_cause_actual ?? 'an invalid value'} when the validated expected value was ${root_cause_expected ?? 'a different result'}.`
    : null;

  return (
    <GlassCard glow="red" className="bg-rose-50/40 border-rose-200">
      {/* Top Banner */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3.5 border-b border-rose-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
            <AlertOctagon className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-sans tracking-widest text-rose-600 font-extrabold">
                ROOT CAUSE IDENTIFIED
              </span>
              {typeof blame_confidence === 'number' && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-mono font-bold border border-emerald-200">
                  {blame_confidence.toFixed(1)}% Confidence
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-slate-900 font-sans mt-0.5">
              {root_cause_agent?.toUpperCase()} (Step {root_cause_step})
            </h3>
          </div>
        </div>
        <StatusBadge label={root_cause_error_type?.replace(/_/g, ' ')} tone="root" size="sm" />
      </div>

      {/* FIRST INVALID STATE — dominant forensic summary */}
      <div className="mb-4 p-4 rounded-2xl bg-gradient-to-br from-rose-100/70 to-white border-2 border-rose-300 shadow-md">
        <div className="text-xs uppercase font-sans tracking-wider text-rose-700 font-extrabold mb-3 flex items-center gap-1.5">
          <Target className="w-3.5 h-3.5" />
          FIRST INVALID STATE
        </div>

        {/* Origin → Failure Type → Parent facts, straight from diagnosis */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs font-mono mb-3.5">
          <div>
            <span className="text-slate-500 uppercase tracking-wider block text-[10px] font-semibold">Root Origin</span>
            <span className="text-slate-900 font-bold">{root_cause_agent} — Step {root_cause_step}</span>
          </div>
          <div>
            <span className="text-slate-500 uppercase tracking-wider block text-[10px] font-semibold">Failure Type</span>
            <span className="text-rose-700 font-bold">{root_cause_error_type?.replace(/_/g, ' ') || 'unknown'}</span>
          </div>
          <div className="col-span-2">
            <span className="text-slate-500 uppercase tracking-wider block text-[10px] font-semibold">Parent</span>
            <span className="text-slate-900 font-bold">
              {parentEvent ? `${parentEvent.agent} — Step ${parentEvent.step}` : parentStep !== null ? `Step ${parentStep}` : 'None (initial step)'}
            </span>
          </div>
        </div>

        {/* Expected vs Actual */}
        {hasExpectedActual ? (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <span className="text-[10px] uppercase font-mono tracking-wider text-emerald-700 block font-bold">
                EXPECTED
              </span>
              <span className="text-lg font-bold font-mono text-emerald-800 mt-0.5 block">
                {root_cause_expected ?? '—'}
              </span>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
              <span className="text-[10px] uppercase font-mono tracking-wider text-rose-700 block font-bold">
                ACTUAL
              </span>
              <span className="text-lg font-bold font-mono text-rose-800 mt-0.5 block">
                {root_cause_actual ?? '—'}
              </span>
            </div>
          </div>
        ) : (
          <div className="text-xs font-mono text-slate-700 mb-3">
            {root_cause_reason || 'Discrepancy detected at first invalid state.'}
          </div>
        )}

        {/* Numeric difference + validation result — only when computable */}
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3.5">
          {hasNumericDiff && (
            <span className="text-[11px] font-mono font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-1 rounded-full">
              Difference: <span className={diffValue! > 0 ? 'text-rose-700' : 'text-amber-700'}>{diffValue! > 0 ? '+' : ''}{diffValue}</span>
            </span>
          )}
          <StatusBadge label="Validation Result: Invalid" tone="root" size="sm" />
        </div>

        {/* Dynamically generated one-line explanation */}
        {dynamicExplanation && (
          <p className="text-xs font-sans text-slate-900 font-semibold italic border-t border-rose-200/70 pt-2.5">
            &ldquo;{dynamicExplanation}&rdquo;
          </p>
        )}

        {/* Causal concept strip */}
        <div className="flex items-center justify-center gap-1.5 flex-wrap mt-3.5 pt-3 border-t border-rose-200/70 text-[9.5px] font-mono uppercase font-bold tracking-wider">
          <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Expected State</span>
          <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
          <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 border border-violet-200">Validation</span>
          <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
          <span className="px-2 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">Actual Invalid State</span>
          <ArrowRight className="w-3 h-3 text-slate-300 flex-shrink-0" />
          <span className="px-2 py-1 rounded-full bg-rose-600 text-white border border-rose-700">Root Cause</span>
        </div>
      </div>

      {/* Validation Reason */}
      <div className="p-3.5 rounded-2xl bg-white border border-slate-200 mb-4 shadow-sm">
        <div className="flex items-center gap-1.5 text-[10.5px] font-sans uppercase tracking-wider text-violet-700 font-bold mb-1">
          <ShieldCheck className="w-3.5 h-3.5 text-violet-600" />
          Validation Failure Proof
        </div>
        <p className="text-xs text-slate-700 font-mono leading-relaxed">
          {root_cause_reason || 'Discrepancy detected between expected specification and actual agent output.'}
        </p>
      </div>

      {/* Downstream Impact & Remediation */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-amber-800 uppercase tracking-wider font-bold mb-1 font-sans">
            <Workflow className="w-3 h-3 text-amber-600" />
            Downstream Impact
          </div>
          <span className="text-slate-800 font-mono font-medium">
            {downstream_agents?.length ? downstream_agents.join(', ') : 'None (Cascade prevented)'}
          </span>
        </div>

        <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
          <div className="flex items-center gap-1 text-[10px] text-violet-700 uppercase tracking-wider font-bold mb-1 font-sans">
            <Wrench className="w-3 h-3 text-violet-600" />
            Remediation Target
          </div>
          <span className="text-slate-800 font-mono font-medium truncate block" title={remediation}>
            {remediation || `Inspect prompt and validation rules for ${root_cause_agent}`}
          </span>
        </div>
      </div>
    </GlassCard>
  );
};
