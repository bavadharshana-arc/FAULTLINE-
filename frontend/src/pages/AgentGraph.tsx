import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Network, Activity, Clock, ShieldCheck, Play, ShieldAlert } from 'lucide-react';
import { useForensicsContext } from '../context/ForensicsContext';
import { AgentFlowGraph } from '../components/graph/AgentFlowGraph';
import { AgentInspectorDrawer } from '../components/investigation/AgentInspectorDrawer';
import { GlassCard } from '../components/common/GlassCard';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/common/Button';
import { api } from '../services/api';
import { ReliabilityOverviewResponse } from '../types/forensics';

export const AgentGraph: React.FC = () => {
  const navigate = useNavigate();
  const { currentRun, selectedAgent, setSelectedAgent, replayWorkflow } = useForensicsContext();
  const [reliabilityData, setReliabilityData] = useState<ReliabilityOverviewResponse | null>(null);

  useEffect(() => {
    api.getReliabilityOverview()
      .then(setReliabilityData)
      .catch((err) => console.warn('Could not fetch reliability in AgentGraph:', err));
  }, [currentRun]);

  if (!currentRun) {
    return (
      <EmptyState
        title="NO AGENT EXECUTION TO DISPLAY"
        description="Run a diagnostic workflow to render the multi-agent causal topology, execution flow, and per-agent latency breakdown."
        actionLabel="Go to Investigation Workspace"
        onAction={() => navigate('/investigation')}
        icon={<Network className="w-8 h-8" />}
      />
    );
  }

  const { trace, diagnosis } = currentRun;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
            <Network className="w-5 h-5 text-violet-600" />
            MULTI-AGENT CAUSAL TOPOLOGY
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Spatial causal lineage: Planner → Worker → Reviewer → Final
          </p>
        </div>

        <span className="text-xs font-mono text-slate-700 bg-white/80 px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-sm">
          Active Run: <strong className="text-violet-700 font-bold">{currentRun.id}</strong>
        </span>
      </div>

      {/* Main Graph Component */}
      <AgentFlowGraph
        trace={trace}
        diagnosis={diagnosis}
        selectedAgent={selectedAgent}
        onSelectAgent={setSelectedAgent}
        className="h-[600px]"
      />

      {/* Selected Agent Inspector */}
      {selectedAgent && (
        <AgentInspectorDrawer
          agentName={selectedAgent}
          trace={trace}
          diagnosis={diagnosis}
          onClose={() => setSelectedAgent(null)}
          onReplay={replayWorkflow}
        />
      )}

      {/* Agent Telemetry & Latency Breakdown */}
      <GlassCard className="border-slate-200/80 bg-white/80">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-violet-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
              Agent Execution & Telemetry Summary
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {trace.length} recorded steps
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs font-mono">
          {trace.map((event) => {
            const isRoot = diagnosis.root_cause_agent === event.agent && diagnosis.has_failure && !diagnosis.unknown;
            const isDownstream = diagnosis.downstream_agents?.includes(event.agent);
            const failed = event.status === 'failed';

            return (
              <div
                key={event.step}
                onClick={() => setSelectedAgent(event.agent)}
                className={`p-4 rounded-2xl border cursor-pointer transition-all duration-200 hover:scale-[1.02] shadow-sm ${
                  isRoot
                    ? 'border-rose-300 bg-rose-50/70'
                    : isDownstream
                    ? 'border-amber-300 bg-amber-50/70'
                    : failed
                    ? 'border-rose-200 bg-rose-50/50'
                    : 'border-slate-200 bg-white hover:border-violet-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-violet-700 font-bold">
                    STEP {event.step}
                  </span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                    isRoot
                      ? 'bg-rose-100 border border-rose-200 text-rose-700'
                      : isDownstream
                      ? 'bg-amber-100 border border-amber-200 text-amber-800'
                      : failed
                      ? 'bg-rose-100 border border-rose-200 text-rose-700'
                      : 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                  }`}>
                    {isRoot ? 'ROOT CAUSE' : isDownstream ? 'DOWNSTREAM' : failed ? 'FAILED' : 'PASSED'}
                  </span>
                </div>

                <h4 className="text-base font-extrabold text-slate-900 uppercase font-mono-code mb-1">
                  {event.agent}
                </h4>

                <p className="text-slate-500 text-[11px] truncate mb-2" title={event.reason}>
                  {event.reason || 'Executed normally.'}
                </p>

                {(() => {
                  const agStats = reliabilityData?.agents?.[event.agent] ||
                    (event.agent === 'Worker' ? reliabilityData?.agents?.['Worker'] : undefined);
                  const rel = agStats?.reliability_score;

                  return (
                    <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10.5px]">
                      <span className="text-slate-500">Reliability:</span>
                      <span className="font-bold text-violet-700">
                        {rel !== undefined && rel !== null ? `${rel.toFixed(1)}%` : 'Learning...'}
                      </span>
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};
