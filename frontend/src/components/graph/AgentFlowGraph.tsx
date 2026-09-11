import React, { useMemo, useState, useEffect } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  MarkerType,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { AgentNode, AgentNodeData } from './AgentNode';
import { Diagnosis, TraceEvent, ReliabilityOverviewResponse } from '../../types/forensics';
import { api } from '../../services/api';

interface AgentFlowGraphProps {
  trace: TraceEvent[];
  diagnosis: Diagnosis;
  selectedAgent: string | null;
  onSelectAgent: (agent: string) => void;
  className?: string;
}

const nodeTypes = {
  agentNode: AgentNode,
};

const AGENT_ROLE_MAP: Record<string, string> = {
  Planner: 'Planning Agent',
  Worker: 'Execution Agent',
  Executor: 'Execution Agent',
  Reviewer: 'Review Agent',
  Final: 'Aggregation Step',
};

export const AgentFlowGraph: React.FC<AgentFlowGraphProps> = ({
  trace,
  diagnosis,
  selectedAgent,
  onSelectAgent,
  className = 'h-[540px]',
}) => {
  const [reliabilityData, setReliabilityData] = useState<ReliabilityOverviewResponse | null>(null);

  useEffect(() => {
    let isMounted = true;
    api.getReliabilityOverview()
      .then((res) => {
        if (isMounted) setReliabilityData(res);
      })
      .catch((err) => console.warn('Could not fetch reliability in AgentFlowGraph:', err));
    return () => { isMounted = false; };
  }, [diagnosis]);

  const { nodes, edges } = useMemo(() => {
    if (!trace || trace.length === 0) {
      return { nodes: [], edges: [] };
    }

    const isUnknown = Boolean(diagnosis.unknown);
    const hasFailure = Boolean(diagnosis.has_failure);
    const rootStep = diagnosis.root_cause_step;
    const downstreamSteps = new Set(diagnosis.downstream_steps || []);
    const independentSteps = new Set(diagnosis.independent_steps || []);

    // Sort trace events by step
    const sortedTrace = [...trace].sort((a, b) => a.step - b.step);
    const eventByStep = new Map(sortedTrace.map((e) => [e.step, e]));

    const generatedNodes: Node<AgentNodeData>[] = [];
    const generatedEdges: Edge[] = [];

    // Layout configuration: Top-to-bottom vertical flow
    const startX = 260;
    const startY = 30;
    const verticalGap = 145;

    sortedTrace.forEach((event, idx) => {
      const step = event.step;
      const agent = event.agent;
      const status = event.status;
      const failed = status === 'failed';
      const role = event.blame_role || (step === rootStep ? 'ROOT_CAUSE' : failed ? 'DOWNSTREAM' : 'PASSED');

      let tone: AgentNodeData['tone'] = 'neutral';
      let stateLabel = 'PASSED';
      let glyph = '✓';
      let isRoot = false;
      let isDominant = false;

      if (isUnknown) {
        if (failed) {
          tone = 'candidate';
          stateLabel = 'CANDIDATE';
          glyph = '?';
          isDominant = role === 'ROOT_CAUSE';
        } else {
          tone = 'success';
          stateLabel = 'PASSED';
          glyph = '✓';
        }
      } else if (hasFailure && step === rootStep) {
        tone = 'failure';
        stateLabel = 'ROOT CAUSE';
        glyph = '✕';
        isRoot = true;
        isDominant = true;
      } else if (downstreamSteps.has(step)) {
        tone = 'downstream';
        stateLabel = 'DOWNSTREAM';
        glyph = '⚠';
      } else if (independentSteps.has(step)) {
        tone = 'independent';
        stateLabel = 'INDEPENDENT';
        glyph = '⚠';
      } else if (failed) {
        tone = 'failure';
        stateLabel = 'FAILED';
        glyph = '✕';
      } else {
        tone = 'success';
        stateLabel = 'PASSED';
        glyph = '✓';
      }

      // Lookup real reliability stats for agent
      const relStat = reliabilityData?.agents
        ? reliabilityData.agents[agent] ||
          (agent === 'Worker' ? reliabilityData.agents['Worker'] : undefined) ||
          (agent === 'Executor' ? reliabilityData.agents['Worker'] : undefined) ||
          Object.values(reliabilityData.agents).find(
            (a) => a.agent.toLowerCase() === agent.toLowerCase()
          )
        : undefined;

      const riskLevel = relStat
        ? (relStat.failure_rate >= 40 || relStat.root_cause_count >= 2
            ? 'HIGH'
            : relStat.failure_rate > 15 || relStat.root_cause_count >= 1
            ? 'MEDIUM'
            : 'LOW')
        : undefined;

      // Resolve the causal parent from parent_step ancestry — never chronological order.
      const parentEvent = event.parent_step !== null ? eventByStep.get(event.parent_step) : undefined;
      const parentLabel = parentEvent
        ? `${parentEvent.agent} — Step ${parentEvent.step}`
        : event.parent_step !== null
        ? `Step ${event.parent_step}`
        : null;

      const nodeData: AgentNodeData = {
        agent,
        roleLabel: AGENT_ROLE_MAP[agent] || 'Agent',
        step,
        status,
        errorType: event.error_type,
        blameRole: role,
        tone,
        isRoot,
        isDominant,
        stateLabel,
        glyph,
        reason: event.reason,
        rawEvent: event,
        isSelected: selectedAgent === agent,
        reliabilityScore: relStat?.reliability_score ?? null,
        riskLevel,
        parentLabel,
        expected: isRoot ? diagnosis.root_cause_expected : null,
        actual: isRoot ? diagnosis.root_cause_actual : null,
      };

      generatedNodes.push({
        id: `node-${step}-${agent}`,
        type: 'agentNode',
        position: { x: startX, y: startY + idx * verticalGap },
        data: nodeData,
      });

      // Connect each step to next step
      if (idx > 0) {
        const prevEvent = sortedTrace[idx - 1];
        const isCausalFailure = isRoot || downstreamSteps.has(step);

        generatedEdges.push({
          id: `edge-${prevEvent.step}-${step}`,
          source: `node-${prevEvent.step}-${prevEvent.agent}`,
          target: `node-${step}-${agent}`,
          animated: isCausalFailure,
          label: isCausalFailure ? 'FAILURE PROPAGATED' : 'valid dependency',
          labelStyle: {
            fill: isCausalFailure ? '#e11d48' : '#64748b',
            fontWeight: 700,
            fontSize: 10,
            fontFamily: 'monospace',
          },
          labelBgStyle: { fill: '#ffffff', fillOpacity: 0.92 },
          labelBgPadding: [5, 3] as [number, number],
          labelBgBorderRadius: 6,
          style: {
            stroke: isCausalFailure ? '#e11d48' : 'rgba(139, 92, 246, 0.45)',
            strokeWidth: isCausalFailure ? 2.5 : 1.8,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isCausalFailure ? '#e11d48' : 'rgba(139, 92, 246, 0.75)',
            width: 14,
            height: 14,
          },
        });
      }
    });

    return { nodes: generatedNodes, edges: generatedEdges };
  }, [trace, diagnosis, selectedAgent, reliabilityData]);

  const onNodeClick = (_: React.MouseEvent, node: Node) => {
    const agentName = (node.data as unknown as AgentNodeData)?.agent;
    if (agentName) {
      onSelectAgent(agentName);
    }
  };

  return (
    <div className={`w-full rounded-3xl bg-white/80 backdrop-blur-2xl border border-slate-200/80 relative overflow-hidden shadow-panel ${className}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        minZoom={0.5}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="rgba(148, 163, 184, 0.35)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>

      {/* Floating graph status indicator */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 text-[11px] font-mono text-slate-700 shadow-sm">
        <span className="w-2 h-2 rounded-full bg-violet-600 shadow-sm" />
        <span className="font-semibold text-slate-900 font-sans">DOMINANT CAUSAL GRAPH</span>
        <span className="text-slate-500">· Reliability Lineage</span>
      </div>

      {/* Tone legend — how to read the graph in 5 seconds */}
      <div className="hidden sm:flex absolute top-4 right-4 z-10 items-center gap-2.5 bg-white/90 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-slate-200 text-[10px] font-mono font-bold uppercase tracking-wider shadow-sm">
        <span className="flex items-center gap-1.5 text-emerald-700">
          <span className="w-2 h-2 rounded-full bg-emerald-500" /> Passed
        </span>
        <span className="flex items-center gap-1.5 text-rose-700">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> Root Cause
        </span>
        <span className="flex items-center gap-1.5 text-amber-700">
          <span className="w-2 h-2 rounded-full bg-amber-500" /> Downstream
        </span>
      </div>
    </div>
  );
};
