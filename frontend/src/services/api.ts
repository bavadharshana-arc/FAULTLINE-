import {
  Diagnosis,
  ReplayResult,
  Scenario,
  SystemStatus,
  TraceEvent,
  AgentReliabilityStats,
  ReliabilityOverviewResponse,
  PredictionResponse,
} from '../types/forensics';

const API_BASE = '/api';

export interface RunPipelineResponse {
  success: boolean;
  task: string;
  failure_mode: string;
  trace: TraceEvent[];
  diagnosis: Diagnosis;
  error?: string;
}

export interface ReplayPipelineResponse {
  success: boolean;
  replay: ReplayResult;
  error?: string;
}

export interface AnalyzeTraceResponse {
  success: boolean;
  trace?: TraceEvent[];
  diagnosis?: Diagnosis;
  error?: string;
}

export interface ScenariosResponse {
  default_task: string;
  scenarios: Scenario[];
}

export const api = {
  async getStatus(): Promise<SystemStatus> {
    const res = await fetch(`${API_BASE}/status`);
    if (!res.ok) {
      throw new Error(`Failed to fetch system status: ${res.statusText}`);
    }
    return res.json();
  },

  async getScenarios(): Promise<ScenariosResponse> {
    const res = await fetch(`${API_BASE}/scenarios`);
    if (!res.ok) {
      throw new Error(`Failed to fetch failure scenarios: ${res.statusText}`);
    }
    return res.json();
  },

  async runPipeline(task: string, failure_mode: string, numbers?: number[]): Promise<RunPipelineResponse> {
    const res = await fetch(`${API_BASE}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, failure_mode, numbers }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Workflow execution failed (${res.status})`);
    }
    return data;
  },

  async runReplay(task: string, failure_mode: string, numbers?: number[]): Promise<ReplayPipelineResponse> {
    const res = await fetch(`${API_BASE}/replay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, failure_mode, numbers }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Counterfactual replay failed (${res.status})`);
    }
    return data;
  },

  async analyzeCustomTrace(trace: TraceEvent[]): Promise<AnalyzeTraceResponse> {
    const res = await fetch(`${API_BASE}/analyze-trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trace }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || `Trace analysis failed (${res.status})`);
    }
    return data;
  },

  async getReliabilityOverview(): Promise<ReliabilityOverviewResponse> {
    const res = await fetch(`${API_BASE}/reliability`);
    if (!res.ok) {
      throw new Error(`Failed to fetch reliability overview: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  },

  async getAgentReliability(agent: string): Promise<AgentReliabilityStats> {
    const res = await fetch(`${API_BASE}/reliability/${encodeURIComponent(agent)}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch reliability for agent ${agent}: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  },

  async getRiskPrediction(task: string, scenario_key?: string): Promise<PredictionResponse> {
    const res = await fetch(`${API_BASE}/reliability/prediction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, scenario_key }),
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch risk prediction: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  },

  async getReliabilityHistory(limit = 50): Promise<any[]> {
    const res = await fetch(`${API_BASE}/reliability/history?limit=${limit}`);
    if (!res.ok) {
      throw new Error(`Failed to fetch reliability history: ${res.statusText}`);
    }
    const json = await res.json();
    return json.data;
  },
};
