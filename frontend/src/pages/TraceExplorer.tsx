import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, ListTree, ArrowRight, Eye, X } from 'lucide-react';
import { useForensicsContext } from '../context/ForensicsContext';
import { GlassCard } from '../components/common/GlassCard';
import { EmptyState } from '../components/common/EmptyState';
import { StatusBadge } from '../components/common/StatusBadge';
import { Button } from '../components/common/Button';
import { TraceEvent } from '../types/forensics';

export const TraceExplorer: React.FC = () => {
  const navigate = useNavigate();
  const { currentRun } = useForensicsContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAgentFilter, setSelectedAgentFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [inspectedEvent, setInspectedEvent] = useState<TraceEvent | null>(null);

  if (!currentRun) {
    return (
      <EmptyState
        title="NO TRACE DATA AVAILABLE"
        description="Run a diagnostic workflow to generate detailed agent execution telemetry, payloads, and timestamps."
        actionLabel="Go to Investigation Workspace"
        onAction={() => navigate('/investigation')}
        icon={<ListTree className="w-8 h-8" />}
      />
    );
  }

  const { trace, diagnosis } = currentRun;

  const filteredTrace = useMemo(() => {
    return trace.filter((event) => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches =
          event.agent.toLowerCase().includes(q) ||
          (event.reason && event.reason.toLowerCase().includes(q)) ||
          event.error_type.toLowerCase().includes(q) ||
          String(event.output).toLowerCase().includes(q) ||
          String(event.input).toLowerCase().includes(q);
        if (!matches) return false;
      }

      // Agent filter
      if (selectedAgentFilter !== 'all' && event.agent !== selectedAgentFilter) {
        return false;
      }

      // Status filter
      if (selectedStatusFilter !== 'all' && event.status !== selectedStatusFilter) {
        return false;
      }

      return true;
    });
  }, [trace, searchQuery, selectedAgentFilter, selectedStatusFilter]);

  const uniqueAgents = Array.from(new Set(trace.map((t) => t.agent)));

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
            <ListTree className="w-5 h-5 text-violet-600" />
            TRACE TELEMETRY EXPLORER
          </h2>
          <p className="text-xs text-slate-500 font-mono mt-0.5">
            Granular step telemetry, input/output contracts, and validation assertions
          </p>
        </div>
        <span className="text-xs font-mono text-slate-700 bg-white/80 px-4 py-2 rounded-full border border-slate-200/80 shadow-sm backdrop-blur-md">
          Run: <strong className="text-violet-700">{currentRun.id}</strong>
        </span>
      </div>

      {/* Filter & Search Bar */}
      <GlassCard glow="cyan" className="p-4 bg-white/80 border-slate-200/80">
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search agent, error type, reason, payload..."
              className="w-full bg-slate-50 border border-slate-300 shadow-inner rounded-full pl-10 pr-4 py-2 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Agent Filter */}
            <select
              value={selectedAgentFilter}
              onChange={(e) => setSelectedAgentFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-full px-4 py-2 text-xs font-mono text-slate-700 focus:border-violet-500 focus:outline-none"
            >
              <option value="all">All Agents</option>
              {uniqueAgents.map((a) => (
                <option key={a} value={a} className="bg-white text-slate-900">
                  {a}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-full px-4 py-2 text-xs font-mono text-slate-700 focus:border-violet-500 focus:outline-none"
            >
              <option value="all">All Statuses</option>
              <option value="success">Success</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Telemetry Table */}
      <GlassCard glow="violet" className="overflow-hidden p-0 bg-white/80 border-slate-200/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200/80 text-slate-500 uppercase tracking-wider text-[10.5px] bg-slate-50">
                <th className="py-3.5 px-4">Step</th>
                <th className="py-3.5 px-4">Agent</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Error Type</th>
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredTrace.map((event) => {
                const isRoot = diagnosis.root_cause_agent === event.agent && diagnosis.has_failure && !diagnosis.unknown;
                const isDownstream = diagnosis.downstream_agents?.includes(event.agent);
                const failed = event.status === 'failed';

                return (
                  <tr
                    key={event.step}
                    className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                      inspectedEvent?.step === event.step ? 'bg-violet-50' : ''
                    }`}
                    onClick={() => setInspectedEvent(event)}
                  >
                    <td className="py-3.5 px-4 font-bold text-violet-700">
                      Step {event.step}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-900 uppercase font-mono">
                      {event.agent}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {isRoot ? (
                        <span className="text-rose-700 font-bold">Root Cause</span>
                      ) : isDownstream ? (
                        <span className="text-amber-800">Downstream</span>
                      ) : (
                        <span>Standard</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {isRoot ? (
                        <StatusBadge label="ROOT CAUSE" tone="root" size="sm" />
                      ) : isDownstream ? (
                        <StatusBadge label="DOWNSTREAM" tone="downstream" size="sm" />
                      ) : failed ? (
                        <StatusBadge label="FAILED" tone="failure" size="sm" />
                      ) : (
                        <StatusBadge label="PASSED" tone="passed" size="sm" />
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 uppercase">
                      {event.error_type !== 'None' ? event.error_type.replace(/_/g, ' ') : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '—'}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Eye className="w-3.5 h-3.5" />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setInspectedEvent(event);
                        }}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>

      {/* Inspected Event Detail Modal / Drawer */}
      {inspectedEvent && (
        <GlassCard glow="magenta" className="p-6 animate-fadeIn bg-white/90 border-slate-200/80">
          <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-200/80">
            <div className="flex items-center gap-3">
              <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full border border-violet-200">
                STEP {inspectedEvent.step}
              </span>
              <h3 className="text-base font-extrabold text-slate-900 uppercase font-sans">
                {inspectedEvent.agent} TELEMETRY DETAIL
              </h3>
            </div>
            <button
              onClick={() => setInspectedEvent(null)}
              className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-4 font-mono text-xs">
            <div>
              <span className="text-slate-500 uppercase font-semibold block mb-1">Reason:</span>
              <p className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-slate-700 shadow-sm">
                {inspectedEvent.reason || 'No failure reason reported.'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-slate-500 uppercase font-semibold block mb-1">Input Payload:</span>
                <pre className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 overflow-x-auto text-[11px] max-h-48 leading-relaxed shadow-sm">
                  {typeof inspectedEvent.input === 'string'
                    ? inspectedEvent.input
                    : JSON.stringify(inspectedEvent.input, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-slate-500 uppercase font-semibold block mb-1">Output Payload:</span>
                <pre className="p-3.5 rounded-2xl bg-slate-900 border border-slate-700 text-slate-100 overflow-x-auto text-[11px] max-h-48 leading-relaxed shadow-sm">
                  {typeof inspectedEvent.output === 'string'
                    ? inspectedEvent.output
                    : JSON.stringify(inspectedEvent.output, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </GlassCard>
      )}
    </div>
  );
};
