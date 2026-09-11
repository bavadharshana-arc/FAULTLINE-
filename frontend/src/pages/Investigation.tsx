import React, { useState, useEffect } from 'react';
import { Play, RotateCcw, Sparkles, Terminal, Activity, ArrowRight, ShieldAlert, ShieldCheck, TrendingUp, HelpCircle, Info } from 'lucide-react';
import { useForensicsContext } from '../context/ForensicsContext';
import { Button } from '../components/common/Button';
import { EmptyState } from '../components/common/EmptyState';
import { HeaderMeta } from '../components/investigation/HeaderMeta';
import { AgentFlowGraph } from '../components/graph/AgentFlowGraph';
import { AgentInspectorDrawer } from '../components/investigation/AgentInspectorDrawer';
import { RootCauseCard } from '../components/investigation/RootCauseCard';
import { BlastRadiusCard } from '../components/investigation/BlastRadiusCard';
import { CausalProofPanel } from '../components/investigation/CausalProofPanel';
import { ForensicVerdictCard } from '../components/investigation/ForensicVerdictCard';
import { ForensicEvidenceViewer } from '../components/investigation/ForensicEvidenceViewer';
import { ReplayComparisonCard } from '../components/investigation/ReplayComparisonCard';
import { RawTraceModal } from '../components/investigation/RawTraceModal';
import { EvidenceUploader } from '../components/investigation/EvidenceUploader';
import { api } from '../services/api';
import { AgentRiskPrediction, PredictionResponse } from '../types/forensics';

export const Investigation: React.FC = () => {
  const {
    phase,
    taskPrompt,
    setTaskPrompt,
    selectedScenario,
    setSelectedScenario,
    scenarios,
    systemStatus,
    currentRun,
    replayResult,
    selectedAgent,
    setSelectedAgent,
    runWorkflow,
    replayWorkflow,
    resetState,
    loadCustomTrace,
    error,
    evidenceSources,
    addEvidenceFiles,
    removeEvidence,
  } = useForensicsContext();

  const [isRawTraceOpen, setIsRawTraceOpen] = useState(false);
  const [predictions, setPredictions] = useState<AgentRiskPrediction[]>([]);
  const [predictionStatus, setPredictionStatus] = useState<string>('loading');
  const [predictionMessage, setPredictionMessage] = useState<string>('');
  const [expandedEvidenceAgent, setExpandedEvidenceAgent] = useState<string | null>(null);

  const isRunning = phase === 'running';
  const isReplaying = phase === 'recovering';

  // Fetch failure risk prediction before execution
  useEffect(() => {
    let isMounted = true;
    api.getRiskPrediction(taskPrompt, selectedScenario)
      .then((res) => {
        if (!isMounted) return;
        setPredictions(res.predictions || []);
        setPredictionStatus(res.status);
        setPredictionMessage(res.message);
      })
      .catch(() => {
        if (!isMounted) return;
        setPredictionStatus('unavailable');
        setPredictionMessage('Prediction unavailable — insufficient historical evidence.');
      });
    return () => { isMounted = false; };
  }, [taskPrompt, selectedScenario, currentRun]);

  const demoScenarios = [
    { label: 'Normal Clean Run', task: 'Calculate the average of 10, 20, and 30.', scenario: 'none' },
    { label: 'Worker Failure', task: 'Calculate the average of 10, 20, and 30.', scenario: 'worker_syntax_error' },
    { label: 'Propagation Failure', task: 'Calculate the average of 10, 20, and 30.', scenario: 'propagation_failure' },
    { label: 'Insufficient Evidence', task: 'Write a note about the weather in Seattle.', scenario: 'worker_syntax_error' },
  ];

  const handleQuickRun = (task: string, scenario: string) => {
    setTaskPrompt(task);
    setSelectedScenario(scenario);
    runWorkflow(task, scenario);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Top Configuration & Execution Bar */}
      <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 backdrop-blur-xl shadow-panel">
        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-end">
          {/* Incident Description / Evidence Input */}
          <div className="flex-1">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-600 block mb-1.5 font-semibold">
              Incident Description / Evidence
            </label>
            <textarea
              value={taskPrompt}
              onChange={(e) => setTaskPrompt(e.target.value)}
              rows={3}
              placeholder="Describe what happened..."
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-mono text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition-all shadow-inner resize-y min-h-[76px]"
            />
            <EvidenceUploader
              sources={evidenceSources}
              onAddFiles={addEvidenceFiles}
              onRemove={removeEvidence}
              disabled={isRunning}
            />
          </div>

          {/* Scenario Selector */}
          <div className="w-full lg:w-72">
            <label className="text-[11px] font-mono uppercase tracking-wider text-slate-600 block mb-1.5 font-semibold">
              Controlled Failure Scenario:
            </label>
            <select
              value={selectedScenario}
              onChange={(e) => setSelectedScenario(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm font-mono text-slate-900 focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 focus:outline-none transition-all"
            >
              {scenarios.map((s) => (
                <option key={s.key} value={s.key} className="bg-white text-slate-900">
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              icon={<Play className="w-4 h-4 fill-white" />}
              onClick={() => runWorkflow()}
              isLoading={isRunning}
            >
              RUN WORKFLOW
            </Button>
            <Button
              variant="secondary"
              onClick={resetState}
              disabled={isRunning}
            >
              RESET
            </Button>
          </div>
        </div>

        {/* Engine mode status line */}
        <div className="mt-3.5 pt-3 border-t border-slate-200/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${systemStatus?.gemini_connected ? 'bg-violet-600 shadow-sm animate-pulse' : 'bg-emerald-600 shadow-sm'}`} />
            <span>
              {systemStatus?.gemini_connected
                ? 'Gemini 2.0 Connected (LLM text with deterministic assertions)'
                : 'Deterministic Validation Mode · Reproducible Ground-Truth Attribution'}
            </span>
          </div>
          <span className="text-slate-400 hidden sm:inline">
            AST Whitelist Guardrails Active
          </span>
        </div>

        {/* Pre-Execution Failure Risk Prediction Bar */}
        <div className="mt-4 pt-3.5 border-t border-slate-200/80">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-violet-600" />
              <span className="text-[11px] font-mono uppercase tracking-wider text-slate-800 font-bold">
                Pre-Execution Failure Risk Intelligence
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500">
              {predictionMessage || 'Evaluating historical failure models...'}
            </span>
          </div>

          {predictionStatus === 'unavailable' || predictions.length === 0 ? (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-600 flex items-center justify-between shadow-sm">
              <span>Prediction unavailable — insufficient historical evidence. Run investigations to build reliability data.</span>
              <span className="text-[10px] uppercase text-slate-400 font-semibold">0-1 Previous Runs</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {predictions.map((p) => {
                const isExpanded = expandedEvidenceAgent === p.agent;
                let badgeCol = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                if (p.risk_level === 'HIGH') badgeCol = 'bg-rose-50 text-rose-700 border-rose-200';
                else if (p.risk_level === 'MEDIUM') badgeCol = 'bg-amber-50 text-amber-800 border-amber-200';

                return (
                  <div
                    key={p.agent}
                    className="p-3 rounded-xl bg-slate-50 border border-slate-200 hover:border-violet-300 transition-all font-mono text-xs shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-bold text-slate-900">{p.agent}</span>
                      <span className={`px-2.5 py-0.5 rounded-full border text-[10px] font-extrabold ${badgeCol}`}>
                        {p.risk_level} · {p.risk_score.toFixed(0)}%
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                      <span>Reliability Score:</span>
                      <span className="text-violet-700 font-bold">
                        {p.reliability_score !== null ? `${p.reliability_score.toFixed(1)}%` : 'N/A'}
                      </span>
                    </div>

                    {/* Expandable Evidence toggle */}
                    <button
                      type="button"
                      onClick={() => setExpandedEvidenceAgent(isExpanded ? null : p.agent)}
                      className="text-[10px] text-violet-700 hover:text-violet-900 flex items-center gap-1 mt-1 font-semibold"
                    >
                      <Info className="w-3 h-3" />
                      {isExpanded ? 'Hide Evidence' : 'Why this risk?'}
                    </button>

                    {isExpanded && (
                      <div className="mt-2 pt-2 border-t border-slate-200 text-[10px] text-slate-600 space-y-1">
                        {p.evidence.map((ev, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span className="text-violet-600">•</span>
                            <span>{ev}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Error state if any */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-mono text-xs flex items-center justify-between shadow-sm">
          <span>{error}</span>
          <Button variant="ghost" size="sm" onClick={() => runWorkflow()}>
            Retry
          </Button>
        </div>
      )}

      {/* State Renderers */}
      {isRunning ? (
        /* Running Telemetry State */
        <div className="p-12 rounded-3xl bg-white/90 border border-slate-200/80 text-center space-y-6 max-w-xl mx-auto shadow-panel backdrop-blur-xl">
          <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600 mx-auto shadow-sm">
            <Activity className="w-8 h-8 animate-spin" />
          </div>
          <div>
            <h3 className="text-base font-extrabold uppercase font-sans tracking-wide text-slate-900">
              Executing Multi-Agent Workflow
            </h3>
            <p className="text-xs font-mono text-slate-500 mt-1">
              Tracing execution steps and validating agent contracts in real-time...
            </p>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-4 border-t border-slate-200 text-xs font-mono">
            {['Planner', 'Worker', 'Reviewer', 'Final'].map((agent, i) => (
              <div key={agent} className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center shadow-sm">
                <span className="text-violet-700 text-[10px] block font-bold">Step {i + 1}</span>
                <span className="text-slate-800 font-semibold">{agent}</span>
              </div>
            ))}
          </div>
        </div>
      ) : !currentRun || phase === 'idle' ? (
        /* Idle / Empty State with Quick Demo Launchers */
        <div className="space-y-6">
          <EmptyState
            title="NO ACTIVE INVESTIGATION"
            description="System ready. Enter a task prompt above or launch one of the verified demo scenarios below to trace multi-agent execution, isolate root causes, and verify recovery."
            actionLabel="Run Standard Demo"
            onAction={() => runWorkflow()}
          />

          {/* Quick Scenario Launch Cards */}
          <div className="max-w-4xl mx-auto">
            <div className="text-xs font-mono uppercase tracking-wider text-slate-500 font-bold mb-3">
              Verified Scenario Templates:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {demoScenarios.map((demo) => (
                <button
                  key={demo.label}
                  onClick={() => handleQuickRun(demo.task, demo.scenario)}
                  className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 hover:border-violet-300 text-left transition-all duration-200 group flex items-center justify-between shadow-sm hover:shadow-md"
                >
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 font-sans group-hover:text-violet-700 transition-colors">
                      {demo.label}
                    </h4>
                    <p className="text-xs font-mono text-slate-500 mt-0.5 max-w-xs truncate">
                      {demo.task}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Diagnosed / Active Investigation State */
        <div>
          {/* Header Metadata */}
          <HeaderMeta
            run={currentRun}
            phase={phase}
            onReplay={replayWorkflow}
            onReset={resetState}
            onOpenRawTrace={() => setIsRawTraceOpen(true)}
            isReplaying={isReplaying}
          />

          {/* Structured Trace Analysis banner — only when this run came from an uploaded 8-field JSON trace,
              never shown for a live simulated run. */}
          {currentRun.scenario_key === 'custom' && (
            <div className="mb-6 p-4 rounded-2xl bg-violet-50/70 border border-violet-200 backdrop-blur-xl shadow-panel flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-600" />
                <span className="text-xs font-extrabold uppercase tracking-wider font-sans text-violet-800">
                  Structured Trace Analysis
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap text-[10px] font-mono font-bold uppercase tracking-wider text-violet-700">
                <span className="px-2.5 py-1 rounded-full bg-white border border-violet-200">Trace Source: Uploaded JSON</span>
                <span className="px-2.5 py-1 rounded-full bg-white border border-violet-200">Analysis Mode: Deterministic Forensic Trace Analysis</span>
              </div>
            </div>
          )}

          {/* Post-Run Reliability Intelligence & Prediction Feedback Loop */}
          {(() => {
            const hasFailure = currentRun.diagnosis.has_failure && !currentRun.diagnosis.unknown;
            const actualRootAgent = currentRun.diagnosis.root_cause_agent;
            const highestRiskPred = predictions.length > 0 ? predictions[0] : null;

            let outcome = 'NOT ENOUGH DATA';
            let outcomeColor = 'border-slate-200/80 bg-white/80 text-slate-700 shadow-sm';

            if (predictions.length > 0 && predictionStatus === 'ready') {
              if (hasFailure && highestRiskPred) {
                const predictedMatches =
                  highestRiskPred.raw_agent === actualRootAgent ||
                  (highestRiskPred.agent === 'Executor' && actualRootAgent === 'Worker') ||
                  highestRiskPred.agent === actualRootAgent;
                if (predictedMatches) {
                  outcome = 'CORRECT';
                  outcomeColor = 'border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm';
                } else {
                  outcome = 'INCORRECT';
                  outcomeColor = 'border-amber-200 bg-amber-50 text-amber-800 shadow-sm';
                }
              } else if (!hasFailure) {
                const hadLowRisk = predictions.every((p) => p.risk_level === 'LOW');
                outcome = hadLowRisk ? 'CORRECT (Clean run expected)' : 'INCONCLUSIVE';
                outcomeColor = 'border-sky-200 bg-sky-50 text-sky-800 shadow-sm';
              }
            }

            return (
              <div className={`p-4 rounded-2xl border mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 font-mono text-xs backdrop-blur-xl ${outcomeColor}`}>
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-sm">
                    <TrendingUp className="w-4 h-4 text-violet-600" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 uppercase text-xs flex items-center gap-2">
                      Reliability Feedback Loop & Learning Outcome:
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] uppercase font-extrabold bg-slate-100 border border-slate-200 text-slate-800">
                        {outcome}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {highestRiskPred ? (
                        <span>
                          Prior Prediction: <strong className="text-slate-800">{highestRiskPred.agent} ({highestRiskPred.risk_level} Risk · {highestRiskPred.risk_score}%)</strong>
                          {'  |  '}
                          Actual Outcome: <strong className="text-slate-800">{hasFailure ? `${actualRootAgent} (ROOT CAUSE)` : 'Clean Run'}</strong>
                        </span>
                      ) : (
                        <span>Reliability intelligence updated from current investigation.</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[10.5px] text-slate-500">
                    Historical Ledger: <strong className="text-violet-700">Updated</strong>
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => window.location.assign('/reliability')}
                  >
                    View Reliability Matrix →
                  </Button>
                </div>
              </div>
            );
          })()}


          {/* Core Visual Workspace: Spatial Graph & Forensic Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Spatial Graph Area */}
            <div className="lg:col-span-7 space-y-6">
              <AgentFlowGraph
                trace={currentRun.trace}
                diagnosis={currentRun.diagnosis}
                selectedAgent={selectedAgent}
                onSelectAgent={setSelectedAgent}
                className="h-[540px]"
              />

              {/* Click-to-inspect Agent Detail Drawer */}
              {selectedAgent && (
                <AgentInspectorDrawer
                  agentName={selectedAgent}
                  trace={currentRun.trace}
                  diagnosis={currentRun.diagnosis}
                  onClose={() => setSelectedAgent(null)}
                  onReplay={replayWorkflow}
                />
              )}
            </div>

            {/* Right Forensic Cards Area */}
            <div className="lg:col-span-5 space-y-6">
              <RootCauseCard diagnosis={currentRun.diagnosis} />
              <BlastRadiusCard diagnosis={currentRun.diagnosis} />
              <ForensicVerdictCard diagnosis={currentRun.diagnosis} replay={currentRun.replay || replayResult} />
            </div>
          </div>

          {/* Causal Dependency-Chain Proof — the core innovation, made visually prominent */}
          <CausalProofPanel diagnosis={currentRun.diagnosis} />

          {/* Forensic Evidence Accordion Locker */}
          <ForensicEvidenceViewer
            trace={currentRun.trace}
            diagnosis={currentRun.diagnosis}
            isUploadedTrace={currentRun.scenario_key === 'custom'}
          />

          {/* Counterfactual Replay Card */}
          <ReplayComparisonCard
            replay={currentRun.replay || replayResult}
            onReplay={replayWorkflow}
            isReplaying={isReplaying}
            canReplay={currentRun.diagnosis.has_failure && !currentRun.diagnosis.unknown}
          />
        </div>
      )}

      {/* Raw Trace & Upload Modal */}
      {currentRun && (
        <RawTraceModal
          isOpen={isRawTraceOpen}
          onClose={() => setIsRawTraceOpen(false)}
          trace={currentRun.trace}
          diagnosis={currentRun.diagnosis}
          onUploadSuccess={loadCustomTrace}
        />
      )}
    </div>
  );
};
