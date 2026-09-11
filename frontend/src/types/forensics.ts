/**
 * FAULTLINE Forensic Data Contracts & Schemas
 * Strictly matches Python backend engine.py and bridge.py contracts.
 */

export interface TraceEvent {
  task_id: string;
  step: number;
  agent: string;
  input: string;
  output: string;
  status: 'success' | 'failed' | string;
  error_type: string;
  parent_step: number | null;
  reason?: string;
  timestamp?: string | null;
  generated_by?: string;
  blame_role?: 'ROOT_CAUSE' | 'DOWNSTREAM' | 'INDEPENDENT' | 'PASSED';
}

export interface CompetingHypothesis {
  agent: string;
  probability: number;
  status: 'root_cause' | 'downstream' | 'rejected' | 'candidate' | 'passed' | string;
  reason: string;
}

export interface GuardrailRecommendation {
  root_cause_summary: string;
  recommended_guardrail: string;
  before_pipeline: string[];
  after_pipeline: string[];
}

export interface Diagnosis {
  task_id: string;
  has_failure: boolean;
  root_cause_step: number | null;
  root_cause_agent: string | null;
  root_cause_error_type: string;
  root_cause_reason: string | null;
  root_cause_expected: string | null;
  root_cause_actual: string | null;
  downstream_steps: number[];
  downstream_agents: string[];
  independent_steps: number[];
  independent_agents: string[];
  unknown: boolean;
  unknown_reason: string | null;
  explanation: string;
  remediation: string;
  annotated_trace: TraceEvent[];
  // Optional fields already returned by the backend (bridge.py) but not
  // previously modeled here — surfaced by the forensic UI where present.
  // Never fabricate these on the frontend; only render when the API sends them.
  blame_confidence?: number | null;
  competing_hypotheses?: CompetingHypothesis[];
  guardrail?: GuardrailRecommendation | null;
  first_invalid_step?: number | null;
}

export interface ReplayAgentComparison {
  agent: string;
  label: 'PASSED' | 'FAILED' | 'DOWNSTREAM' | 'INDEPENDENT';
  tone: 'success' | 'failure' | 'downstream' | 'independent';
}

export interface ReplayResult {
  applicable: boolean;
  reason: string | null;
  fixed_agent: string | null;
  recovered: boolean;
  before: [TraceEvent[], Diagnosis] | null;
  after: [TraceEvent[], Diagnosis] | null;
}

export interface Scenario {
  key: string;
  label: string;
  description: string;
}

export interface SystemStatus {
  status: string;
  gemini_connected: boolean;
  gemini_mode: string;
  version: string;
  engine: string;
}

export type InvestigationPhase =
  | 'idle'
  | 'running'
  | 'diagnosed'
  | 'recovering'
  | 'recovered'
  | 'error';

export interface InvestigationRun {
  id: string;
  timestamp: string;
  task: string;
  scenario_key: string;
  scenario_label: string;
  trace: TraceEvent[];
  diagnosis: Diagnosis;
  replay: ReplayResult | null;
}

export interface AgentReliabilityStats {
  agent: string;
  runs: number;
  successful_runs: number;
  failed_runs: number;
  root_cause_count: number;
  failure_rate: number;
  reliability_score: number | null;
  reliability_display: string;
  recent_failure_trend: { run_id: string; failed: boolean }[];
  failure_types: Record<string, number>;
  task_performance: Record<string, { runs: number; failures: number; failure_rate: number }>;
  avg_duration_s: number | null;
}

export interface AgentRiskPrediction {
  agent: string;
  raw_agent: string;
  risk_score: number;
  risk_level: 'HIGH' | 'MEDIUM' | 'LOW';
  reliability_score: number | null;
  evidence: string[];
}

export interface ReliabilityOverviewResponse {
  total_runs: number;
  successful_runs: number;
  failed_runs: number;
  agents_monitored: number;
  agents: Record<string, AgentReliabilityStats>;
  recent_trend: {
    run_id: string;
    timestamp: string;
    has_failure: boolean;
    root_cause_agent: string | null;
    scenario: string;
  }[];
  status: 'ready' | 'limited_data' | 'insufficient_data';
  message: string;
}

export interface PredictionResponse {
  status: 'ready' | 'unavailable';
  message: string;
  predictions: AgentRiskPrediction[];
}
