import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { StatusBadge, BadgeTone } from '../common/StatusBadge';
import { TraceEvent } from '../../types/forensics';

export interface AgentNodeData extends Record<string, unknown> {
  agent: string;
  roleLabel: string;
  step: number;
  status: string;
  errorType?: string;
  blameRole?: string;
  tone: 'success' | 'failure' | 'downstream' | 'candidate' | 'independent' | 'neutral';
  isRoot: boolean;
  isDominant: boolean;
  stateLabel: string;
  glyph: string;
  reason?: string;
  elapsedMs?: number | null;
  rawEvent?: TraceEvent;
  isSelected?: boolean;
  reliabilityScore?: number | null;
  riskLevel?: string;
  parentLabel?: string | null;
  expected?: string | null;
  actual?: string | null;
}

export const AgentNode: React.FC<{ data: AgentNodeData }> = memo(({ data }) => {
  const {
    agent,
    roleLabel,
    step,
    errorType,
    tone,
    isRoot,
    stateLabel,
    glyph,
    isSelected,
    elapsedMs,
    reliabilityScore,
    riskLevel,
    parentLabel,
    expected,
    actual,
  } = data;

  const getToneBorder = () => {
    if (isRoot) return 'border-rose-400 shadow-[0_4px_20px_rgba(244,63,94,0.25)] ring-2 ring-rose-200 animate-glow-pulse';
    if (tone === 'failure') return 'border-rose-300 shadow-[0_4px_16px_rgba(244,63,94,0.15)]';
    if (tone === 'downstream') return 'border-amber-300 shadow-[0_4px_16px_rgba(245,158,11,0.15)]';
    if (tone === 'candidate') return 'border-amber-200';
    if (tone === 'independent') return 'border-violet-300 shadow-[0_4px_16px_rgba(139,92,246,0.15)]';
    if (tone === 'success') return 'border-emerald-300 shadow-sm';
    return 'border-slate-200 shadow-glass';
  };

  const getToneBg = () => {
    if (isRoot) return 'bg-rose-50/90';
    if (tone === 'downstream') return 'bg-amber-50/80';
    if (tone === 'success') return 'bg-white/90';
    return 'bg-white/90';
  };

  const badgeTone: BadgeTone = isRoot
    ? 'root'
    : tone === 'downstream'
    ? 'downstream'
    : tone === 'failure'
    ? 'failure'
    : tone === 'candidate'
    ? 'warning'
    : tone === 'success'
    ? 'passed'
    : 'neutral';

  return (
    <div
      className={`relative rounded-2xl border-2 transition-all duration-300 w-72 backdrop-blur-xl p-4 cursor-pointer select-none ${getToneBg()} ${getToneBorder()} ${
        isSelected ? 'ring-2 ring-violet-500 ring-offset-2 ring-offset-white' : ''
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-violet-600 !w-3 !h-3 !border-2 !border-white !shadow-sm"
      />

      {/* Dominant Root Cause Floating Badge */}
      {isRoot && (
        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-[10px] font-extrabold uppercase px-3 py-0.5 rounded-full shadow-md tracking-wider border border-white/40 flex items-center gap-1.5 z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
          FIRST INVALID STATE · ROOT CAUSE
        </div>
      )}

      {/* Header with Step and Elapsed Time */}
      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 mb-1.5 font-medium">
        <span className="font-bold tracking-wider text-violet-700">STEP {step}</span>
        {elapsedMs !== undefined && elapsedMs !== null && (
          <span>{elapsedMs >= 1 ? `${Math.round(elapsedMs)} ms` : '< 1 ms'}</span>
        )}
      </div>

      {/* Agent Name and Role */}
      <div className="flex items-baseline justify-between mb-1.5">
        <h4 className="text-base font-bold tracking-tight text-slate-900 uppercase font-sans">
          {agent}
        </h4>
        <span className="text-[10.5px] text-slate-500 uppercase tracking-wider font-sans font-medium">
          {roleLabel}
        </span>
      </div>

      {/* Dependency lineage — which step this one causally depends on */}
      <div className="text-[10px] font-mono text-slate-400 mb-2">
        Parent: <span className="text-slate-600 font-semibold">{parentLabel || 'None (initial step)'}</span>
      </div>

      {/* Expected vs Actual — shown only on the root-cause node, only when the diagnosis provides it */}
      {isRoot && (expected !== undefined && expected !== null || actual !== undefined && actual !== null) && (
        <div className="grid grid-cols-2 gap-1.5 mb-2 text-[10px] font-mono">
          <div className="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-200">
            <span className="text-emerald-700 font-bold block leading-tight">EXPECTED</span>
            <span className="text-emerald-900 font-extrabold">{expected ?? '—'}</span>
          </div>
          <div className="px-2 py-1 rounded-lg bg-rose-50 border border-rose-200">
            <span className="text-rose-700 font-bold block leading-tight">ACTUAL</span>
            <span className="text-rose-900 font-extrabold">{actual ?? '—'}</span>
          </div>
        </div>
      )}

      {/* Embedded Reliability Metric Signal */}
      {reliabilityScore !== undefined && reliabilityScore !== null && (
        <div className="flex items-center justify-between py-1 px-2 mb-2 rounded-lg bg-slate-50 border border-slate-200 text-[10px] font-mono">
          <span className="text-slate-500">Reliability:</span>
          <span className="flex items-center gap-1">
            <strong className="text-violet-700 font-bold">{reliabilityScore.toFixed(0)}%</strong>
            {riskLevel === 'HIGH' && (
              <span className="text-rose-700 font-bold px-1.5 rounded bg-rose-100 text-[9px]">
                HIGH RISK
              </span>
            )}
            {riskLevel === 'MEDIUM' && (
              <span className="text-amber-800 font-bold px-1.5 rounded bg-amber-100 text-[9px]">
                MED RISK
              </span>
            )}
          </span>
        </div>
      )}

      {/* Status & Error Tag */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-200/80">
        <StatusBadge label={stateLabel} tone={badgeTone} glyph={glyph} size="sm" />
        {errorType && errorType !== 'None' && (
          <span className="text-[10px] font-mono uppercase text-rose-600 font-semibold max-w-[120px] truncate" title={errorType}>
            {errorType.replace(/_/g, ' ')}
          </span>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-purple-600 !w-3 !h-3 !border-2 !border-white !shadow-sm"
      />
    </div>
  );
});

AgentNode.displayName = 'AgentNode';
