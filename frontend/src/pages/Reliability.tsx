import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Activity,
  Cpu,
  BarChart2,
  Sparkles,
  Info,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { EmptyState } from '../components/common/EmptyState';
import { api } from '../services/api';
import { AgentReliabilityStats, ReliabilityOverviewResponse } from '../types/forensics';

export const Reliability: React.FC = () => {
  const navigate = useNavigate();
  const [data, setData] = useState<ReliabilityOverviewResponse | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('Worker');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadReliability();
  }, []);

  const loadReliability = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getReliabilityOverview();
      setData(res);
      // Default to Worker/Executor or first available
      if (res.agents) {
        if (res.agents['Worker']) setSelectedAgent('Worker');
        else {
          const first = Object.keys(res.agents)[0];
          if (first) setSelectedAgent(first);
        }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load reliability intelligence');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center font-mono space-y-3">
        <Activity className="w-8 h-8 text-faultline-magenta animate-spin mx-auto" />
        <p className="text-xs text-faultline-textDim uppercase tracking-wider">
          Aggregating historical agent telemetry...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 rounded-xl bg-faultline-red/10 border border-faultline-red/30 text-faultline-red font-mono text-xs flex justify-between items-center">
        <span>{error || 'No reliability intelligence available'}</span>
        <Button variant="secondary" size="sm" onClick={loadReliability}>
          Retry
        </Button>
      </div>
    );
  }

  const agentsList = Object.values(data.agents || {});
  const activeAgentStats: AgentReliabilityStats | undefined =
    data.agents[selectedAgent] || (selectedAgent === 'Executor' ? data.agents['Worker'] : undefined);

  return (
    <div className="space-y-8 animate-fadeIn pb-12">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight font-sans flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-violet-600" />
            AGENT RELIABILITY & FAILURE PREDICTION
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-1">
            Evidence-based reliability intelligence and failure risk learning from real historical investigations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-slate-700 bg-white/80 px-3.5 py-1.5 rounded-full border border-slate-200/80 shadow-sm">
            Status: <strong className="text-violet-700 uppercase">{data.message}</strong>
          </span>
          <Button
            variant="primary"
            size="sm"
            onClick={() => navigate('/investigation')}
          >
            Launch Investigation
          </Button>
        </div>
      </div>

      {/* Top 4 System Overview Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard glow="purple" className="flex items-center justify-between p-5 bg-white/80 border-slate-200/80">
          <div>
            <span className="text-[10.5px] uppercase tracking-wider font-mono text-violet-700 font-bold">
              Total Investigations
            </span>
            <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
              {data.total_runs}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Completed runs</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shadow-sm">
            <Activity className="w-6 h-6" />
          </div>
        </GlassCard>

        <GlassCard glow="green" className="flex items-center justify-between p-5 bg-white/80 border-slate-200/80">
          <div>
            <span className="text-[10.5px] uppercase tracking-wider font-mono text-emerald-700 font-bold">
              Clean Successful Runs
            </span>
            <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
              {data.successful_runs}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Zero failures detected</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-sm">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </GlassCard>

        <GlassCard glow={data.failed_runs > 0 ? 'red' : 'none'} className="flex items-center justify-between p-5 bg-white/80 border-slate-200/80">
          <div>
            <span className="text-[10.5px] uppercase tracking-wider font-mono text-rose-700 font-bold">
              Isolated Failures
            </span>
            <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
              {data.failed_runs}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Attributed root causes</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </GlassCard>

        <GlassCard glow="none" className="flex items-center justify-between p-5 bg-white/80 border-slate-200/80">
          <div>
            <span className="text-[10.5px] uppercase tracking-wider font-mono text-pink-700 font-bold">
              Agents Monitored
            </span>
            <div className="text-3xl font-extrabold font-mono text-slate-900 mt-1">
              {data.agents_monitored}
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Planner, Worker, Reviewer, Final</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-pink-100 border border-pink-200 flex items-center justify-center text-pink-600 shadow-sm">
            <Cpu className="w-6 h-6" />
          </div>
        </GlassCard>
      </div>

      {data.total_runs === 0 ? (
        <EmptyState
          title="INSUFFICIENT HISTORICAL DATA"
          description="Reliability intelligence learns directly from completed investigations. Execute multi-agent workflows from the Investigation workspace to populate deterministic agent reliability statistics and failure risk models."
          actionLabel="Run First Investigation"
          onAction={() => navigate('/investigation')}
          icon={<ShieldCheck className="w-8 h-8" />}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Area: Agent Risk & Reliability Table */}
          <div className="lg:col-span-7 space-y-6">
            <GlassCard className="p-0 overflow-hidden bg-white/80 border-slate-200/80">
              <div className="p-5 border-b border-slate-200/80 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wider font-sans text-slate-900 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-violet-600" />
                    Agent Reliability Matrix
                  </h3>
                  <p className="text-xs text-slate-500 font-mono mt-0.5">
                    Click any agent to inspect failure patterns and task-specific performance
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 bg-slate-50 text-slate-500 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">Agent</th>
                      <th className="py-3 px-4">Reliability</th>
                      <th className="py-3 px-4">Failure Rate</th>
                      <th className="py-3 px-4">Runs</th>
                      <th className="py-3 px-4">Root Cause Count</th>
                      <th className="py-3 px-4">Risk Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agentsList.map((ag) => {
                      const isSelected = selectedAgent === ag.agent || (selectedAgent === 'Executor' && ag.agent === 'Worker');
                      const displayName = ag.agent === 'Worker' ? 'Executor / Specialist' : ag.agent;
                      const relScore = ag.reliability_score;
                      
                      let riskLevel = 'LOW';
                      let riskColor = 'text-emerald-700 font-bold';
                      if (ag.failure_rate >= 40 || ag.root_cause_count >= 2) {
                        riskLevel = 'HIGH';
                        riskColor = 'text-rose-700 font-bold';
                      } else if (ag.failure_rate > 15 || ag.root_cause_count >= 1) {
                        riskLevel = 'MEDIUM';
                        riskColor = 'text-amber-800 font-bold';
                      }

                      return (
                        <tr
                          key={ag.agent}
                          onClick={() => setSelectedAgent(ag.agent)}
                          className={`cursor-pointer transition-colors duration-150 ${
                            isSelected
                              ? 'bg-violet-50 text-slate-900 font-semibold'
                              : 'hover:bg-slate-50/70 text-slate-700'
                          }`}
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-900 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-violet-600 shadow-sm' : 'bg-slate-300'}`} />
                            {displayName}
                          </td>
                          <td className="py-3.5 px-4">
                            {relScore !== null ? (
                              <span className="font-bold text-violet-700">
                                {relScore.toFixed(1)}%
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Insufficient data</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={ag.failure_rate > 0 ? 'text-rose-700 font-semibold' : 'text-slate-400'}>
                              {ag.failure_rate.toFixed(1)}%
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-900 font-bold">
                            {ag.runs}
                          </td>
                          <td className="py-3.5 px-4">
                            {ag.root_cause_count > 0 ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                                {ag.root_cause_count}
                              </span>
                            ) : (
                              <span className="text-slate-400">0</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className={riskColor}>
                              {riskLevel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </GlassCard>

            {/* Recent Failure Trend */}
            <GlassCard className="p-5 space-y-4 bg-white/80 border-slate-200/80">
              <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-600" />
                  <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
                    Investigation Run Sequence & Historical Trend
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Last {data.recent_trend.length} recorded runs
                </span>
              </div>

              {data.recent_trend.length < 2 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-center text-xs font-mono text-slate-500">
                  Not enough historical data for trend analysis. Run additional investigations.
                </div>
              ) : (
                <div className="space-y-2">
                  {data.recent_trend.map((trend, idx) => {
                    const failed = trend.has_failure;
                    return (
                      <div
                        key={trend.run_id || idx}
                        className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs font-mono shadow-sm"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-slate-500 font-medium">Run #{idx + 1}</span>
                          <span className="font-bold text-slate-900">{trend.run_id}</span>
                          <span className="text-slate-500">({trend.scenario})</span>
                        </div>
                        <div>
                          {failed ? (
                            <span className="px-2.5 py-1 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                              FAILED · Root: {trend.root_cause_agent || 'Unknown'}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                              PASSED (Clean)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>
          </div>

          {/* Right Area: Selected Agent Deep-Dive */}
          <div className="lg:col-span-5 space-y-6">
            {activeAgentStats ? (
              <GlassCard glow="magenta" className="p-5 space-y-5 bg-white/80 border-slate-200/80">
                <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
                  <div>
                    <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 block">
                      Agent Deep-Dive
                    </span>
                    <h3 className="text-base font-bold text-slate-900 font-sans flex items-center gap-2 mt-0.5">
                      {activeAgentStats.agent === 'Worker' ? 'Executor / Specialist' : activeAgentStats.agent}
                    </h3>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-mono text-slate-500 uppercase block">Reliability</span>
                    <span className="text-xl font-mono font-extrabold text-violet-700">
                      {activeAgentStats.reliability_display}
                    </span>
                  </div>
                </div>

                {/* Stat Grid */}
                <div className="grid grid-cols-3 gap-2.5 text-xs font-mono">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Runs</span>
                    <span className="text-lg font-bold text-slate-900">{activeAgentStats.runs}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Failures</span>
                    <span className="text-lg font-bold text-rose-700">{activeAgentStats.failed_runs}</span>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                    <span className="text-[10px] text-slate-500 block uppercase font-medium">Root Causes</span>
                    <span className="text-lg font-bold text-violet-700">{activeAgentStats.root_cause_count}</span>
                  </div>
                </div>

                {/* Common Failure Types */}
                <div className="space-y-2">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">
                    Observed Failure Patterns:
                  </span>
                  {Object.keys(activeAgentStats.failure_types || {}).length === 0 ? (
                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs font-mono text-emerald-800 shadow-sm">
                      ✓ No failure patterns detected for this agent across recorded runs.
                    </div>
                  ) : (
                    <div className="space-y-1.5 font-mono text-xs">
                      {Object.entries(activeAgentStats.failure_types).map(([ftype, count]) => (
                        <div
                          key={ftype}
                          className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-sm"
                        >
                          <span className="text-slate-800 font-medium">{ftype.replace(/_/g, ' ')}</span>
                          <span className="px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                            {count} event{count !== 1 ? 's' : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Task Specific Performance */}
                <div className="space-y-2 pt-2 border-t border-slate-200/80">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-500 font-semibold block">
                    Contextual Performance By Task Category:
                  </span>
                  {Object.keys(activeAgentStats.task_performance || {}).length === 0 ? (
                    <div className="text-xs font-mono text-slate-400 italic">
                      Insufficient contextual task data.
                    </div>
                  ) : (
                    <div className="space-y-2 font-mono text-xs">
                      {Object.entries(activeAgentStats.task_performance).map(([cat, perf]) => (
                        <div key={cat} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-bold text-slate-900">{cat}</span>
                            <span className={perf.failures > 0 ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold'}>
                              {perf.failure_rate.toFixed(1)}% fail rate
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-500">
                            <span>{perf.runs} total runs</span>
                            <span>{perf.failures} failures recorded</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            ) : (
              <div className="p-6 rounded-2xl bg-white/80 border border-slate-200/80 text-center text-xs font-mono text-slate-500 shadow-sm">
                Select an agent from the matrix to inspect its reliability profile.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
