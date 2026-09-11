import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Layers,
  Play,
  ArrowUpRight,
  ShieldCheck,
  Terminal,
  Fingerprint,
  ArrowRight,
  Sparkles,
  Search,
  RotateCcw,
  Zap,
  Radio,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { StatusBadge } from '../components/common/StatusBadge';
import { useForensicsContext } from '../context/ForensicsContext';

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const {
    history,
    currentRun,
    runWorkflow,
    taskPrompt,
    setTaskPrompt,
    selectedScenario,
    setSelectedScenario,
    scenarios,
    phase,
    systemStatus,
    loadFromHistory,
  } = useForensicsContext();

  const isRunning = phase === 'running';
  const [activePreviewTab, setActivePreviewTab] = useState<'executor' | 'reviewer' | 'counterfactual'>('executor');

  // Derived real metrics from actual session history
  const activeCount = currentRun ? 1 : 0;
  const failedRunsCount = history.filter((h) => h.diagnosis.has_failure && !h.diagnosis.unknown).length;
  const resolvedCount = history.filter((h) => h.replay?.recovered).length;
  const totalAgentsMonitored = currentRun ? currentRun.trace.length : 4;

  const handleLaunch = async () => {
    navigate('/investigation');
    await runWorkflow();
  };

  const handleLiveDemo = async () => {
    setTaskPrompt('Calculate the average of 10, 20, and 30.');
    setSelectedScenario('worker_syntax_error');
    navigate('/investigation');
    await runWorkflow('Calculate the average of 10, 20, and 30.', 'worker_syntax_error');
  };

  return (
    <div className="space-y-10 animate-fadeIn pb-16">
      {/* ========================================================================= */}
      {/* 1. HERO PRODUCT LANDING BANNER                                            */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-gradient-to-b from-white/90 via-purple-50/40 to-white/90 p-8 sm:p-12 backdrop-blur-2xl shadow-panel">
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-96 h-96 rounded-full bg-gradient-to-br from-violet-200/40 via-fuchsia-200/30 to-transparent blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-1/3 -mb-16 w-80 h-80 rounded-full bg-gradient-to-tr from-cyan-100/40 to-transparent blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl space-y-6">
          {/* Pill Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-50 border border-violet-200 text-xs text-violet-700 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
            <span className="font-semibold tracking-wide uppercase text-[11px] bg-gradient-to-r from-violet-700 to-pink-600 bg-clip-text text-transparent">
              Causal Forensics & Reliability Intelligence
            </span>
          </div>

          {/* Headline & Positioning */}
          <div className="space-y-2">
            <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 font-sans">
              FAULTLINE
            </h1>
            <p className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-700 via-pink-600 to-slate-800 bg-clip-text text-transparent font-sans">
              CAUSAL FORENSICS FOR MULTI-AGENT AI
            </p>
            <p className="text-base sm:text-lg italic text-slate-600 font-medium">
              &ldquo;When AI fails, find the fault &mdash; not just the failure.&rdquo;
            </p>
          </div>

          {/* Supporting Bullet Copy */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-700 pt-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>Trace every agent decision across execution steps.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-violet-600 flex-shrink-0" />
              <span>Identify the first causal failure, not downstream noise.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-pink-600 flex-shrink-0" />
              <span>Prove root cause with deterministic ground-truth evidence.</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-cyan-600 flex-shrink-0" />
              <span>Verify fixes via controlled counterfactual re-runs.</span>
            </div>
          </div>

          {/* Call to Actions */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Button
              variant="primary"
              size="lg"
              icon={<Play className="w-4 h-4 fill-white" />}
              onClick={() => navigate('/investigation')}
            >
              Launch Investigation
            </Button>
            <Button
              variant="glow"
              size="lg"
              icon={<Sparkles className="w-4 h-4 text-pink-600" />}
              onClick={handleLiveDemo}
            >
              View Live Demo
            </Button>
            <Button
              variant="ghost"
              size="md"
              icon={<ArrowRight className="w-4 h-4" />}
              onClick={() => navigate('/reliability')}
            >
              Explore Reliability Matrix
            </Button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INTERACTIVE CAUSAL CHAIN PREVIEW                                          */}
        {/* ========================================================================= */}
        <div className="mt-10 pt-8 border-t border-slate-200/80">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-violet-600" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800 font-sans">
                Interactive Causal Lineage Architecture
              </span>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">
              Click nodes to inspect deterministic ground-truth attribution
            </span>
          </div>

          {/* Stepper Chain Nodes */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 relative">
            {/* Step 1: Planner */}
            <div className="p-4 rounded-2xl bg-white border border-slate-200 hover:border-emerald-400 transition-all flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Step 1 · Planner</span>
                <span className="text-emerald-700 text-xs font-bold flex items-center gap-1">
                  ✓ Validated
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 mb-1">Plan Generation</div>
              <p className="text-[11px] text-slate-600 leading-relaxed font-sans">
                Decomposed arithmetic task into 3 sequential agent operations. Contract valid.
              </p>
            </div>

            {/* Step 2: Executor (ROOT CAUSE) */}
            <div
              onClick={() => setActivePreviewTab('executor')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                activePreviewTab === 'executor'
                  ? 'bg-rose-50 border-rose-300 shadow-sm ring-1 ring-rose-300'
                  : 'bg-white border-rose-200 hover:border-rose-400 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-rose-700 uppercase">Step 2 · Executor</span>
                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-[10px] font-extrabold border border-rose-200 animate-pulse">
                  ✕ ROOT CAUSE
                </span>
              </div>
              <div className="text-sm font-bold text-rose-800 mb-1">Calculation Error</div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                First Invalid State: Output <code className="text-rose-700 font-mono">15.0</code> diverged from ground truth <code className="text-emerald-700 font-mono">20.0</code>.
              </p>
            </div>

            {/* Step 3: Reviewer (Cascade / Detection Failure) */}
            <div
              onClick={() => setActivePreviewTab('reviewer')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                activePreviewTab === 'reviewer'
                  ? 'bg-amber-50 border-amber-300 shadow-sm ring-1 ring-amber-300'
                  : 'bg-white border-amber-200 hover:border-amber-400 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-amber-800 uppercase">Step 3 · Reviewer</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-200">
                  ⚠ Cascade / Failed
                </span>
              </div>
              <div className="text-sm font-bold text-amber-900 mb-1">Validation Blindspot</div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                Downstream blast-radius victim: Evaluated corrupted input and approved without assertion check.
              </p>
            </div>

            {/* Step 4: Final Output (Failure State) */}
            <div
              onClick={() => setActivePreviewTab('counterfactual')}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                activePreviewTab === 'counterfactual'
                  ? 'bg-violet-50 border-violet-300 shadow-sm ring-1 ring-violet-300'
                  : 'bg-white border-slate-200 hover:border-violet-300 shadow-sm'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Step 4 · Terminal</span>
                <span className="px-2 py-0.5 rounded-full bg-pink-100 text-pink-700 text-[10px] font-bold border border-pink-200">
                  Counterfactual Fix
                </span>
              </div>
              <div className="text-sm font-bold text-slate-900 mb-1">Verified Recovery</div>
              <p className="text-[11px] text-slate-700 leading-relaxed font-sans">
                Isolating root cause and re-running restores execution to 100% deterministic success.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 2. FORENSIC COMMAND CENTER TELEMETRY ROW                                  */}
      {/* ========================================================================= */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
              <Radio className="w-5 h-5 text-violet-600" />
              FORENSIC COMMAND CENTER
            </h2>
            <p className="text-xs text-slate-500 font-sans">
              Live operational telemetry, multi-agent fault attribution, and automated reliability scoring
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700">
              System Engine: <strong className="text-emerald-700 font-semibold">{systemStatus?.gemini_connected ? 'Gemini 2.0 Flash' : 'Deterministic AST'}</strong>
            </span>
          </div>
        </div>

        {/* 4 Compact Telemetry Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <GlassCard glow="purple" className="p-5 flex items-center justify-between bg-white/80 border-slate-200/80">
            <div>
              <span className="text-[10.5px] uppercase tracking-wider font-mono text-violet-700 font-bold">
                Active Investigations
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 font-sans">
                {activeCount}
              </div>
              <span className="text-[11px] text-slate-500">Current live session</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-violet-100 border border-violet-200 flex items-center justify-center text-violet-700 shadow-sm">
              <Activity className="w-6 h-6" />
            </div>
          </GlassCard>

          <GlassCard glow={failedRunsCount > 0 ? 'red' : 'none'} className="p-5 flex items-center justify-between bg-white/80 border-slate-200/80">
            <div>
              <span className="text-[10.5px] uppercase tracking-wider font-mono text-rose-700 font-bold">
                Isolated Root Causes
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 font-sans">
                {failedRunsCount}
              </div>
              <span className="text-[11px] text-slate-500">First invalid states proven</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 border border-rose-200 flex items-center justify-center text-rose-600 shadow-sm">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </GlassCard>

          <GlassCard glow={resolvedCount > 0 ? 'green' : 'none'} className="p-5 flex items-center justify-between bg-white/80 border-slate-200/80">
            <div>
              <span className="text-[10.5px] uppercase tracking-wider font-mono text-emerald-700 font-bold">
                Counterfactual Fixes
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 font-sans">
                {resolvedCount}
              </div>
              <span className="text-[11px] text-slate-500">Empirically restored runs</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shadow-sm">
              <CheckCircle2 className="w-6 h-6" />
            </div>
          </GlassCard>

          <GlassCard className="p-5 flex items-center justify-between bg-white/80 border-slate-200/80">
            <div>
              <span className="text-[10.5px] uppercase tracking-wider font-mono text-cyan-700 font-bold">
                Monitored Agents
              </span>
              <div className="text-3xl font-extrabold text-slate-900 mt-1 font-sans">
                {totalAgentsMonitored}
              </div>
              <span className="text-[11px] text-slate-500">Planner, Executor, Reviewer</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-cyan-100 border border-cyan-200 flex items-center justify-center text-cyan-700 shadow-sm">
              <Cpu className="w-6 h-6" />
            </div>
          </GlassCard>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. TASK COMPOSER & RECENT INVESTIGATION PANEL                             */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Launch Console */}
        <GlassCard className="lg:col-span-1 flex flex-col justify-between bg-white/80 border-slate-200/80">
          <div>
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200/80">
              <Terminal className="w-4 h-4 text-violet-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
                Launch Diagnostic Run
              </h3>
            </div>

            <div className="space-y-4 text-xs font-mono">
              <div>
                <label className="text-slate-600 uppercase tracking-wider block mb-1.5 font-medium">
                  Task Specification:
                </label>
                <textarea
                  value={taskPrompt}
                  onChange={(e) => setTaskPrompt(e.target.value)}
                  className="w-full h-24 bg-slate-50 border border-slate-300 rounded-2xl p-3 text-slate-900 text-xs font-mono focus:border-violet-500 focus:ring-1 focus:ring-violet-400 focus:outline-none placeholder:text-slate-400 shadow-sm"
                  placeholder="Enter multi-agent prompt..."
                />
              </div>

              <div>
                <label className="text-slate-600 uppercase tracking-wider block mb-1.5 font-medium">
                  Failure Injection Scenario:
                </label>
                <select
                  value={selectedScenario}
                  onChange={(e) => setSelectedScenario(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl p-2.5 text-slate-900 text-xs font-mono focus:border-violet-500 focus:ring-1 focus:ring-violet-400 focus:outline-none shadow-sm"
                >
                  {scenarios.map((s) => (
                    <option key={s.key} value={s.key} className="bg-white text-slate-900">
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <Button
            variant="primary"
            className="w-full mt-6"
            icon={<Play className="w-4 h-4 fill-white" />}
            onClick={handleLaunch}
            isLoading={isRunning}
          >
            Execute Diagnostic Run
          </Button>
        </GlassCard>

        {/* Current / Recent Investigation Summary */}
        <GlassCard className="lg:col-span-2 flex flex-col justify-between bg-white/80 border-slate-200/80">
          <div>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-violet-600" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
                  Active Investigation Overview
                </h3>
              </div>
              {currentRun && (
                <span className="text-xs font-mono text-violet-700 bg-violet-50 px-3 py-1 rounded-full border border-violet-200 font-semibold">
                  {currentRun.id}
                </span>
              )}
            </div>

            {currentRun ? (
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-slate-500">
                      Scenario: <strong className="text-slate-800 font-bold">{currentRun.scenario_label}</strong>
                    </span>
                    {currentRun.diagnosis.unknown ? (
                      <StatusBadge label="INSUFFICIENT EVIDENCE" tone="warning" size="sm" />
                    ) : currentRun.diagnosis.has_failure ? (
                      <StatusBadge label="ROOT CAUSE IDENTIFIED" tone="root" size="sm" pulse />
                    ) : (
                      <StatusBadge label="PASSED CLEAN" tone="passed" size="sm" />
                    )}
                  </div>
                  <h4 className="text-base font-bold text-slate-900 mb-3 font-mono">
                    {currentRun.task}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs pt-3 border-t border-slate-200">
                    <div>
                      <span className="text-slate-500 block font-medium">Root Cause Agent:</span>
                      <span className="text-slate-900 font-bold font-mono">
                        {currentRun.diagnosis.root_cause_agent || 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">Failure Classification:</span>
                      <span className="text-rose-700 font-bold font-mono">
                        {currentRun.diagnosis.root_cause_error_type !== 'None'
                          ? currentRun.diagnosis.root_cause_error_type.replace(/_/g, ' ')
                          : 'None'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block font-medium">Blast Radius:</span>
                      <span className="text-amber-800 font-bold font-mono">
                        {currentRun.diagnosis.downstream_agents?.length || 0} downstream agents
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <Button
                    variant="glow"
                    size="sm"
                    icon={<ArrowUpRight className="w-4 h-4" />}
                    onClick={() => navigate('/investigation')}
                  >
                    Open Investigation Workspace
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-10 text-center text-xs font-mono text-slate-500 space-y-3">
                <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
                <p>No active investigation loaded in current session.</p>
                <p className="text-slate-400 text-[11px]">
                  Launch a diagnostic run or click &ldquo;View Live Demo&rdquo; in the hero banner above to trigger real-time blame attribution.
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </div>

      {/* ========================================================================= */}
      {/* 4. RECENT DIAGNOSTIC HISTORY TABLE                                        */}
      {/* ========================================================================= */}
      <GlassCard className="border-slate-200/80 bg-white/80">
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <Fingerprint className="w-4 h-4 text-violet-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
              Recent Forensic History
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-500">
            {history.length} logged runs
          </span>
        </div>

        {history.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[10.5px]">
                  <th className="py-2.5 px-3">Case ID</th>
                  <th className="py-2.5 px-3">Task Prompt</th>
                  <th className="py-2.5 px-3">Scenario</th>
                  <th className="py-2.5 px-3">Root Cause</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-3 font-bold text-violet-700">{run.id}</td>
                    <td className="py-3 px-3 text-slate-800 max-w-xs truncate font-medium">{run.task}</td>
                    <td className="py-3 px-3 text-slate-500">{run.scenario_label}</td>
                    <td className="py-3 px-3">
                      {run.diagnosis.root_cause_agent ? (
                        <span className="text-rose-700 font-bold">
                          {run.diagnosis.root_cause_agent} (Step {run.diagnosis.root_cause_step})
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Clean Run</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {run.replay?.recovered ? (
                        <StatusBadge label="RECOVERED" tone="passed" size="sm" />
                      ) : run.diagnosis.unknown ? (
                        <StatusBadge label="INSUFFICIENT" tone="warning" size="sm" />
                      ) : run.diagnosis.has_failure ? (
                        <StatusBadge label="ROOT CAUSE" tone="root" size="sm" />
                      ) : (
                        <StatusBadge label="PASSED" tone="passed" size="sm" />
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          loadFromHistory(run);
                          navigate('/investigation');
                        }}
                      >
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-xs font-mono text-slate-500">
            No previous investigations logged in memory. Executing a diagnostic workflow will record real forensic audit trails.
          </div>
        )}
      </GlassCard>
    </div>
  );
};
