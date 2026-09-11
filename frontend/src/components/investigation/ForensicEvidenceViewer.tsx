import React, { useState } from 'react';
import { ChevronDown, ChevronUp, FileCode, ArrowRight, UploadCloud } from 'lucide-react';
import { Diagnosis, TraceEvent } from '../../types/forensics';
import { GlassCard } from '../common/GlassCard';
import { StatusBadge } from '../common/StatusBadge';

interface ForensicEvidenceViewerProps {
  trace: TraceEvent[];
  diagnosis: Diagnosis;
  /** Set when the current run came from an uploaded structured trace rather than a live simulation. */
  isUploadedTrace?: boolean;
}

export const ForensicEvidenceViewer: React.FC<ForensicEvidenceViewerProps> = ({
  trace,
  diagnosis,
  isUploadedTrace = false,
}) => {
  const isUnknown = Boolean(diagnosis.unknown);
  const rootStep = diagnosis.root_cause_step;
  const hasConfirmedRoot = diagnosis.has_failure && !isUnknown;
  const rootEvent = hasConfirmedRoot ? trace.find((t) => t.step === rootStep) : undefined;

  // By default, expand the root cause or candidate steps
  const [expandedSteps, setExpandedSteps] = useState<Record<number, boolean>>(() => {
    const initial: Record<number, boolean> = {};
    trace.forEach((t) => {
      if (t.step === rootStep || (isUnknown && t.status === 'failed')) {
        initial[t.step] = true;
      }
    });
    return initial;
  });

  const toggleStep = (step: number) => {
    setExpandedSteps((prev) => ({ ...prev, [step]: !prev[step] }));
  };

  const sortedTrace = [...trace].sort((a, b) => a.step - b.step);

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider font-sans text-slate-900 flex items-center gap-2">
            <FileCode className="w-4 h-4 text-violet-600" />
            Forensic Evidence Locker
          </h3>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Deterministic step telemetry verified against ground truth
          </p>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {trace.length} total events
        </span>
      </div>

      {/* Structured trace source banner — only rendered when this run actually came from an uploaded trace */}
      {isUploadedTrace && (
        <div className="mb-4 p-3.5 rounded-2xl bg-violet-50/70 border border-violet-200 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <UploadCloud className="w-4 h-4 text-violet-600" />
            <span className="text-xs font-extrabold uppercase tracking-wider font-sans text-violet-800">
              Structured Trace Analysis
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono font-bold uppercase tracking-wider text-violet-700">
            <span className="px-2.5 py-1 rounded-full bg-white border border-violet-200">Trace Source: Uploaded JSON</span>
            <ArrowRight className="w-3 h-3 text-violet-300" />
            <span className="px-2.5 py-1 rounded-full bg-white border border-violet-200">Analysis Mode: Deterministic Forensic Trace Analysis</span>
            <ArrowRight className="w-3 h-3 text-violet-300" />
            <span className="px-2.5 py-1 rounded-full bg-white border border-violet-200">
              {hasConfirmedRoot ? 'Root Cause Identified' : isUnknown ? 'Insufficient Evidence' : 'No Failure'}
            </span>
            {hasConfirmedRoot && (
              <>
                <ArrowRight className="w-3 h-3 text-violet-300" />
                <span className="px-2.5 py-1 rounded-full bg-white border border-violet-200">Propagation Traced</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Root-cause evidence hero card — the exact event that established attribution */}
      {hasConfirmedRoot && rootEvent && (
        <div className="mb-4 p-4 rounded-2xl bg-rose-50/60 border-2 border-rose-300 shadow-md">
          <div className="text-[10.5px] uppercase font-sans tracking-wider text-rose-700 font-extrabold mb-3">
            Root-Cause Trace Event
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px] font-mono mb-3">
            <div>
              <span className="text-slate-500 uppercase block text-[10px] font-semibold">Step</span>
              <span className="text-slate-900 font-extrabold">{rootEvent.step}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase block text-[10px] font-semibold">Agent</span>
              <span className="text-slate-900 font-extrabold">{rootEvent.agent}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase block text-[10px] font-semibold">Parent Step</span>
              <span className="text-slate-900 font-extrabold">{rootEvent.parent_step ?? '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase block text-[10px] font-semibold">Status</span>
              <span className="text-rose-700 font-extrabold uppercase">{rootEvent.status}</span>
            </div>
            <div>
              <span className="text-slate-500 uppercase block text-[10px] font-semibold">Error Type</span>
              <span className="text-rose-700 font-extrabold uppercase">{diagnosis.root_cause_error_type?.replace(/_/g, ' ') || '—'}</span>
            </div>
            {(diagnosis.root_cause_expected !== null || diagnosis.root_cause_actual !== null) && (
              <>
                <div>
                  <span className="text-slate-500 uppercase block text-[10px] font-semibold">Expected</span>
                  <span className="text-emerald-700 font-extrabold">{diagnosis.root_cause_expected ?? '—'}</span>
                </div>
                <div>
                  <span className="text-slate-500 uppercase block text-[10px] font-semibold">Actual</span>
                  <span className="text-rose-700 font-extrabold">{diagnosis.root_cause_actual ?? '—'}</span>
                </div>
              </>
            )}
          </div>

          {/* Relationship to downstream events — straight from the diagnosis arrays */}
          <div className="pt-3 border-t border-rose-200 flex items-center gap-2 flex-wrap text-[11px] font-mono">
            <span className="text-slate-500 uppercase font-semibold tracking-wider">Propagated to:</span>
            {diagnosis.downstream_steps?.length ? (
              diagnosis.downstream_steps.map((step) => {
                const stepAgent = trace.find((t) => t.step === step)?.agent;
                return (
                  <span key={step} className="px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-800 font-bold">
                    Step {step}{stepAgent ? ` · ${stepAgent}` : ''}
                  </span>
                );
              })
            ) : (
              <span className="text-emerald-700 font-bold">None (contained at origin)</span>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {sortedTrace.map((event) => {
          const isExpanded = Boolean(expandedSteps[event.step]);
          const isRoot = !isUnknown && event.step === rootStep && diagnosis.has_failure;
          const isFailed = event.status === 'failed';
          const isDownstream = diagnosis.downstream_steps?.includes(event.step);

          return (
            <div
              key={event.step}
              className={`rounded-2xl border transition-all duration-200 overflow-hidden backdrop-blur-xl ${
                isRoot
                  ? 'border-rose-300 bg-rose-50/50 shadow-sm'
                  : isFailed
                  ? 'border-amber-300 bg-amber-50/50'
                  : 'border-slate-200/80 bg-white/80 shadow-panel'
              }`}
            >
              {/* Header Accordion Bar */}
              <button
                onClick={() => toggleStep(event.step)}
                className="w-full px-4 py-3.5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-violet-700">
                    STEP {event.step}
                  </span>
                  <span className="font-mono font-bold text-sm text-slate-900 uppercase">
                    {event.agent}
                  </span>
                  {isRoot ? (
                    <StatusBadge label="ROOT CAUSE" tone="root" size="sm" pulse />
                  ) : isDownstream ? (
                    <StatusBadge label="DOWNSTREAM" tone="downstream" size="sm" />
                  ) : isFailed ? (
                    <StatusBadge label="FAILED" tone="failure" size="sm" />
                  ) : (
                    <StatusBadge label="PASSED" tone="passed" size="sm" />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  {event.error_type !== 'None' && (
                    <span className="text-xs font-mono text-rose-700 font-bold uppercase hidden sm:inline">
                      {event.error_type.replace(/_/g, ' ')}
                    </span>
                  )}
                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Content */}
              {isExpanded && (
                <div className="p-4 border-t border-slate-200/80 space-y-4 text-xs font-mono">
                  {/* Expected / Actual if Root Cause */}
                  {isRoot && (diagnosis.root_cause_expected !== null || diagnosis.root_cause_actual !== null) && (
                    <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-white border border-rose-200 shadow-sm">
                      <div>
                        <span className="text-emerald-700 font-bold uppercase block mb-1">
                          EXPECTED VALUE
                        </span>
                        <span className="text-sm font-extrabold text-emerald-800">
                          {diagnosis.root_cause_expected ?? '—'}
                        </span>
                      </div>
                      <div>
                        <span className="text-rose-700 font-bold uppercase block mb-1">
                          ACTUAL RECEIVED
                        </span>
                        <span className="text-sm font-extrabold text-rose-800">
                          {diagnosis.root_cause_actual ?? '—'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Reason */}
                  <div>
                    <span className="text-slate-500 uppercase tracking-wider block mb-1 font-semibold">
                      Validation Assessment:
                    </span>
                    <p className="text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 shadow-sm">
                      {event.reason || 'Step completed without validation failure.'}
                    </p>
                  </div>

                  {/* Input / Output Payloads */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <span className="text-slate-500 uppercase tracking-wider block mb-1 font-semibold">
                        Input Payload:
                      </span>
                      <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 overflow-x-auto text-[11px] max-h-48 leading-relaxed shadow-sm">
                        {typeof event.input === 'string' ? event.input : JSON.stringify(event.input, null, 2)}
                      </pre>
                    </div>
                    <div>
                      <span className="text-slate-500 uppercase tracking-wider block mb-1 font-semibold">
                        Output Payload:
                      </span>
                      <pre className="p-3 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 overflow-x-auto text-[11px] max-h-48 leading-relaxed shadow-sm">
                        {typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)}
                      </pre>
                    </div>
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-200">
                    <span>Parent: {event.parent_step !== null ? `Step ${event.parent_step}` : 'None'}</span>
                    <span>Timestamp: {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '—'}</span>
                    <span>Engine Mode: {event.generated_by || 'template'}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
