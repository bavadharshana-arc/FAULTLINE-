import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, ArrowRight, Play, FileText, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { Diagnosis, TraceEvent } from '../../types/forensics';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';

interface AgentInspectorDrawerProps {
  agentName: string | null;
  trace: TraceEvent[];
  diagnosis: Diagnosis;
  onClose: () => void;
  onReplay: () => void;
}

export const AgentInspectorDrawer: React.FC<AgentInspectorDrawerProps> = ({
  agentName,
  trace,
  diagnosis,
  onClose,
  onReplay,
}) => {
  const navigate = useNavigate();

  if (!agentName) return null;

  const event = trace.find((t) => t.agent === agentName);
  if (!event) return null;

  const isRoot = diagnosis.root_cause_agent === agentName && diagnosis.has_failure && !diagnosis.unknown;
  const isDownstream = diagnosis.downstream_agents?.includes(agentName);
  const isFailed = event.status === 'failed';

  return (
    <div className="bg-white/90 border border-slate-200/80 rounded-2xl p-5 shadow-panel backdrop-blur-xl relative mt-6 animate-fadeIn">
      {/* Drawer Header */}
      <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 font-bold border border-violet-200">
            STEP {event.step}
          </span>
          <h3 className="text-base font-extrabold text-slate-900 uppercase font-mono-code">
            {event.agent} INSPECTOR
          </h3>
          {isRoot ? (
            <StatusBadge label="ROOT CAUSE" tone="root" pulse size="sm" />
          ) : isDownstream ? (
            <StatusBadge label="DOWNSTREAM" tone="downstream" size="sm" />
          ) : isFailed ? (
            <StatusBadge label="FAILED" tone="failure" size="sm" />
          ) : (
            <StatusBadge label="PASSED" tone="passed" size="sm" />
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Grid of Agent Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-xs font-mono">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
          <span className="text-slate-500 uppercase block mb-1 font-semibold">Failure Classification</span>
          <span className="text-slate-900 font-bold">
            {event.error_type !== 'None' ? event.error_type.replace(/_/g, ' ') : 'None (Validated)'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
          <span className="text-slate-500 uppercase block mb-1 font-semibold">Parent Step</span>
          <span className="text-slate-900 font-bold">
            {event.parent_step !== null ? `Step ${event.parent_step}` : 'None (Initial Root)'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
          <span className="text-slate-500 uppercase block mb-1 font-semibold">Execution Mode</span>
          <span className="text-slate-900 font-bold capitalize">
            {event.generated_by || 'Template'}
          </span>
        </div>
      </div>

      {/* Expected vs Actual if Root Cause */}
      {isRoot && (diagnosis.root_cause_expected !== null || diagnosis.root_cause_actual !== null) && (
        <div className="grid grid-cols-2 gap-3 mb-4 font-mono">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 shadow-sm">
            <span className="text-[10px] text-emerald-700 font-bold uppercase block mb-1">
              Expected Output
            </span>
            <span className="text-base font-extrabold text-emerald-800">
              {diagnosis.root_cause_expected ?? '—'}
            </span>
          </div>
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 shadow-sm">
            <span className="text-[10px] text-rose-700 font-bold uppercase block mb-1">
              Actual Output
            </span>
            <span className="text-base font-extrabold text-rose-800">
              {diagnosis.root_cause_actual ?? '—'}
            </span>
          </div>
        </div>
      )}

      {/* Validation Reason */}
      <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 mb-4 font-mono text-xs shadow-sm">
        <span className="text-slate-500 uppercase font-semibold block mb-1">
          Forensic Telemetry Reason:
        </span>
        <span className="text-slate-700 leading-relaxed font-medium">
          {event.reason || 'No failure flagged for this step.'}
        </span>
      </div>

      {/* Input / Output Snippets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4 font-mono text-xs">
        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
          <span className="text-slate-500 uppercase font-semibold block mb-1">Step Input</span>
          <pre className="p-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 overflow-x-auto text-[11px] max-h-32 shadow-sm">
            {typeof event.input === 'string' ? event.input : JSON.stringify(event.input, null, 2)}
          </pre>
        </div>

        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
          <span className="text-slate-500 uppercase font-semibold block mb-1">Step Output</span>
          <pre className="p-2.5 rounded-xl bg-slate-900 text-slate-100 border border-slate-700 overflow-x-auto text-[11px] max-h-32 shadow-sm">
            {typeof event.output === 'string' ? event.output : JSON.stringify(event.output, null, 2)}
          </pre>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-3 border-t border-slate-200/80 flex-wrap">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/trace')}
        >
          View in Trace Explorer
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={() => navigate('/evidence')}
        >
          View in Evidence Locker
        </Button>

        {isRoot && (
          <Button
            variant="glow"
            size="sm"
            onClick={onReplay}
          >
            Counterfactual Replay
          </Button>
        )}
      </div>
    </div>
  );
};
