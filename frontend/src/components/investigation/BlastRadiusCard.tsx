import React from 'react';
import { ArrowDown, AlertTriangle, ShieldCheck, Flame } from 'lucide-react';
import { Diagnosis } from '../../types/forensics';
import { GlassCard } from '../common/GlassCard';

interface BlastRadiusCardProps {
  diagnosis: Diagnosis;
}

export const BlastRadiusCard: React.FC<BlastRadiusCardProps> = ({ diagnosis }) => {
  const { has_failure, unknown, root_cause_agent, root_cause_step, downstream_agents, downstream_steps } = diagnosis;

  if (!has_failure || unknown) {
    return null;
  }

  const affectedCount = downstream_agents?.length || 0;
  const affectedStepCount = downstream_steps?.length || 0;

  return (
    <GlassCard glow="purple" className="mt-6 border-slate-200/80 bg-white/80">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5 text-amber-600" />
          <h3 className="text-sm font-bold uppercase tracking-wider font-sans text-slate-900">
            Blast Radius & Downstream Impact
          </h3>
        </div>
        <span className="text-xs font-mono text-slate-500">
          {affectedCount} {affectedCount === 1 ? 'agent' : 'agents'} affected
        </span>
      </div>

      {/* Data-derived summary strip — counts come directly from the diagnosis arrays */}
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200">
          <span className="block text-lg font-extrabold font-mono text-rose-700">1</span>
          <span className="block text-[9.5px] uppercase font-mono tracking-wider text-rose-600 font-bold">Root Cause</span>
        </div>
        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200">
          <span className="block text-lg font-extrabold font-mono text-amber-700">{affectedCount}</span>
          <span className="block text-[9.5px] uppercase font-mono tracking-wider text-amber-700 font-bold">Downstream Agents</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
          <span className="block text-lg font-extrabold font-mono text-slate-700">{affectedStepCount}</span>
          <span className="block text-[9.5px] uppercase font-mono tracking-wider text-slate-600 font-bold">Affected Steps</span>
        </div>
      </div>

      <div className="flex flex-col items-center py-2 space-y-2">
        {/* Origin / Root Cause */}
        <div className="w-full max-w-sm p-3.5 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping" />
            <span className="font-mono font-extrabold text-sm text-rose-700 uppercase">
              {root_cause_agent} ✕
            </span>
          </div>
          <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200 font-bold">
            Root Origin (Step {root_cause_step})
          </span>
        </div>

        {/* Causal Propagation Arrow */}
        {affectedCount > 0 ? (
          <>
            <div className="flex flex-col items-center text-amber-600 my-1">
              <ArrowDown className="w-5 h-5 animate-bounce" />
              <span className="text-[9.5px] uppercase font-mono tracking-widest text-slate-500 font-bold">
                Failure Propagated
              </span>
            </div>

            {/* Affected Agents */}
            <div className="w-full max-w-sm space-y-2">
              {downstream_agents.map((agent) => (
                <div
                  key={agent}
                  className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between shadow-sm"
                >
                  <div className="flex items-center gap-2.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="font-mono font-bold text-sm text-amber-800 uppercase">
                      {agent} ⚠
                    </span>
                  </div>
                  <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200 font-semibold">
                    Downstream / Corrupted
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-1 text-xs font-mono text-emerald-700 bg-emerald-50 p-3.5 rounded-2xl border border-emerald-200 w-full max-w-sm justify-center mt-2 shadow-sm text-center">
            <div className="flex items-center gap-2 font-extrabold uppercase tracking-wider text-[11px]">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              NO DOWNSTREAM IMPACT
            </div>
            <span className="text-[10.5px] text-emerald-700/80 font-normal">
              Fault contained at origin — no propagation to dependent agents.
            </span>
          </div>
        )}
      </div>
    </GlassCard>
  );
};
