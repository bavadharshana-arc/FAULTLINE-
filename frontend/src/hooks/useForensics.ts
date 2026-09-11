import { useState, useEffect, useCallback } from 'react';
import { Diagnosis, InvestigationPhase, InvestigationRun, ReplayResult, Scenario, SystemStatus, TraceEvent } from '../types/forensics';
import { api } from '../services/api';
import { EvidenceSource } from '../lib/evidence/types';
import { detectSourceType, extractEvidence, makeSourceId } from '../lib/evidence/extractors';
import { buildEvidenceContext } from '../lib/evidence/buildEvidenceContext';

const DEFAULT_TASK = 'Calculate the average of 10, 20, and 30.';

const DEFAULT_SCENARIOS: Scenario[] = [
  { key: 'none', label: 'Normal', description: 'Flawless execution (no injected failure)' },
  { key: 'planner_hallucination', label: 'Planner Failure', description: 'Planner fails (produces empty plan steps)' },
  { key: 'worker_syntax_error', label: 'Worker Failure', description: 'Worker calculation fails (expected 20, produced 27)' },
  { key: 'reviewer_oversight', label: 'Reviewer Failure', description: 'Reviewer wrongly rejects valid output (false negative)' },
  { key: 'propagation_failure', label: 'Propagation Failure', description: 'Worker corrupts calculation AND Reviewer misses it' },
];

export function useForensics() {
  const [phase, setPhase] = useState<InvestigationPhase>('idle');
  const [taskPrompt, setTaskPrompt] = useState<string>(DEFAULT_TASK);
  const [selectedScenario, setSelectedScenario] = useState<string>('none');
  const [scenarios, setScenarios] = useState<Scenario[]>(DEFAULT_SCENARIOS);
  const [systemStatus, setSystemStatus] = useState<SystemStatus | null>(null);

  const [currentRun, setCurrentRun] = useState<InvestigationRun | null>(null);
  const [replayResult, setReplayResult] = useState<ReplayResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);

  // --- multimodal incident evidence (browser-only extraction) ---------------
  const [evidenceSources, setEvidenceSources] = useState<EvidenceSource[]>([]);

  const addEvidenceFiles = useCallback((files: File[]) => {
    setEvidenceSources((prev) => {
      const existing = new Set(prev.map((s) => s.id));
      const queued: EvidenceSource[] = [];
      const toProcess: File[] = [];

      for (const file of files) {
        const id = makeSourceId(file);
        if (existing.has(id)) continue; // no duplicate processing
        existing.add(id);
        toProcess.push(file);
        queued.push({
          id,
          sourceType: detectSourceType(file) ?? 'text',
          fileName: file.name,
          extractedText: '',
          status: 'extracting',
          metadata: { size: file.size, type: file.type || 'unknown', characterCount: 0 },
        });
      }

      // Kick off extraction outside of the state updater.
      toProcess.forEach((file) => {
        const id = makeSourceId(file);
        extractEvidence(file)
          .then((result) => {
            setEvidenceSources((cur) =>
              cur.map((s) => (s.id === id ? result : s)),
            );
          })
          .catch(() => {
            setEvidenceSources((cur) =>
              cur.map((s) =>
                s.id === id
                  ? { ...s, status: 'error', error: 'Could not process this file.' }
                  : s,
              ),
            );
          });
      });

      return [...prev, ...queued];
    });
  }, []);

  const removeEvidence = useCallback((id: string) => {
    setEvidenceSources((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const clearEvidence = useCallback(() => setEvidenceSources([]), []);

  // Stored recent investigations history
  const [history, setHistory] = useState<InvestigationRun[]>(() => {
    try {
      const saved = localStorage.getItem('faultline_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Load scenarios and system status
  useEffect(() => {
    api.getStatus()
      .then(setSystemStatus)
      .catch((err) => console.warn('Could not fetch status:', err));

    api.getScenarios()
      .then((res) => {
        if (res.scenarios?.length) setScenarios(res.scenarios);
        if (res.default_task) setTaskPrompt(res.default_task);
      })
      .catch((err) => console.warn('Could not fetch scenarios:', err));
  }, []);

  // Save history on changes
  useEffect(() => {
    try {
      localStorage.setItem('faultline_history', JSON.stringify(history.slice(0, 20)));
    } catch {
      // ignore
    }
  }, [history]);

  const runWorkflow = useCallback(async (customTask?: string, customScenario?: string) => {
    // A quick-run with an explicit task is CONTROLLED VALIDATION — it never
    // merges uploaded evidence. The main RUN button (no args) is the USER
    // EVIDENCE path and combines the instruction with any extracted evidence.
    const isControlledQuickRun = customTask !== undefined;
    const userInstruction = (customTask ?? taskPrompt).trim();
    const scenarioToRun = customScenario ?? selectedScenario;

    let enginePrompt = userInstruction || DEFAULT_TASK;
    let displayTask = userInstruction || DEFAULT_TASK;

    // If the user uploaded a structured 8-field execution trace through the uploader,
    // route directly to the backend forensic trace analyzer instead of running a new simulation.
    const structuredSource = !isControlledQuickRun
      ? evidenceSources.find((s) => s.status === 'ready' && s.structuredTrace && s.structuredTrace.length > 0)
      : undefined;

    if (structuredSource && structuredSource.structuredTrace) {
      setPhase('running');
      setError(null);
      setReplayResult(null);

      try {
        const res = await api.analyzeCustomTrace(structuredSource.structuredTrace);
        if (!res.success || !res.trace || !res.diagnosis) {
          throw new Error(res.error || 'Failed to analyze uploaded trace');
        }

        const run: InvestigationRun = {
          id: res.diagnosis.task_id || `UPLOAD-${Date.now().toString().slice(-4)}`,
          timestamp: new Date().toISOString(),
          task: `Uploaded Trace Analysis: ${structuredSource.fileName}`,
          scenario_key: 'custom',
          scenario_label: 'Structured Trace Analysis',
          trace: res.trace,
          diagnosis: res.diagnosis,
          replay: null,
        };

        setCurrentRun(run);
        setHistory((prev) => [run, ...prev.filter((item) => item.id !== run.id)]);
        setPhase('diagnosed');
        setSelectedAgent(res.diagnosis.root_cause_agent || 'Worker');
        return;
      } catch (err: any) {
        setError(err?.message || 'Trace analysis failed');
        setPhase('error');
        return;
      }
    }

    if (!isControlledQuickRun) {
      const ctx = buildEvidenceContext(userInstruction, evidenceSources);
      if (ctx.usableSources > 0 || ctx.imageOnlySources > 0) {
        enginePrompt = ctx.prompt || DEFAULT_TASK;
        displayTask = ctx.label;
      }
    }

    setPhase('running');
    setError(null);
    setReplayResult(null);

    try {
      const res = await api.runPipeline(enginePrompt, scenarioToRun);
      const scenarioObj = scenarios.find((s) => s.key === scenarioToRun);
      const run: InvestigationRun = {
        id: res.diagnosis.task_id || `RUN-${Date.now().toString().slice(-4)}`,
        timestamp: new Date().toISOString(),
        task: displayTask,
        scenario_key: scenarioToRun,
        scenario_label: scenarioObj?.label || scenarioToRun,
        trace: res.trace,
        diagnosis: res.diagnosis,
        replay: null,
      };

      setCurrentRun(run);
      setHistory((prev) => [run, ...prev.filter((item) => item.id !== run.id)]);
      setPhase('diagnosed');
      setSelectedAgent(res.diagnosis.root_cause_agent || 'Worker');
    } catch (err: any) {
      setError(err?.message || 'Workflow execution failed');
      setPhase('error');
    }
  }, [taskPrompt, selectedScenario, scenarios, evidenceSources]);

  const replayWorkflow = useCallback(async () => {
    if (!currentRun || !currentRun.diagnosis.has_failure || currentRun.diagnosis.unknown) {
      return;
    }

    setPhase('recovering');
    setError(null);

    try {
      const res = await api.runReplay(currentRun.task, currentRun.scenario_key);
      setReplayResult(res.replay);

      if (res.replay.applicable && res.replay.recovered) {
        setPhase('recovered');
      } else {
        setPhase('diagnosed');
      }

      // Update current run with replay data
      setCurrentRun((prev) => prev ? { ...prev, replay: res.replay } : null);
    } catch (err: any) {
      setError(err?.message || 'Counterfactual replay failed');
      setPhase('diagnosed'); // keep diagnosis in view
    }
  }, [currentRun]);

  const resetState = useCallback(() => {
    setPhase('idle');
    setCurrentRun(null);
    setReplayResult(null);
    setError(null);
    setSelectedAgent(null);
  }, []);

  const loadFromHistory = useCallback((run: InvestigationRun) => {
    setCurrentRun(run);
    setTaskPrompt(run.task);
    setSelectedScenario(run.scenario_key);
    setReplayResult(run.replay);
    setPhase(run.replay?.recovered ? 'recovered' : 'diagnosed');
    setSelectedAgent(run.diagnosis.root_cause_agent || 'Worker');
  }, []);

  const loadCustomTrace = useCallback((trace: TraceEvent[], diagnosis: Diagnosis) => {
    const run: InvestigationRun = {
      id: diagnosis.task_id || `UPLOAD-${Date.now().toString().slice(-4)}`,
      timestamp: new Date().toISOString(),
      task: 'Custom External Trace Analysis',
      scenario_key: 'custom',
      scenario_label: 'External Telemetry',
      trace,
      diagnosis,
      replay: null,
    };
    setCurrentRun(run);
    setHistory((prev) => [run, ...prev]);
    setPhase('diagnosed');
    setSelectedAgent(diagnosis.root_cause_agent || 'Worker');
  }, []);

  return {
    phase,
    taskPrompt,
    setTaskPrompt,
    selectedScenario,
    setSelectedScenario,
    scenarios,
    systemStatus,
    currentRun,
    replayResult,
    error,
    selectedAgent,
    setSelectedAgent,
    history,
    evidenceSources,
    addEvidenceFiles,
    removeEvidence,
    clearEvidence,
    runWorkflow,
    replayWorkflow,
    resetState,
    loadFromHistory,
    loadCustomTrace,
  };
}

export type ForensicsContextType = ReturnType<typeof useForensics>;
