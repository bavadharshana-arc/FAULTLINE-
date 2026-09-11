import React from 'react';
import { Play, RotateCcw, Download, Terminal, Clock, Fingerprint } from 'lucide-react';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/StatusBadge';
import { Diagnosis, InvestigationPhase, InvestigationRun } from '../../types/forensics';

interface HeaderMetaProps {
  run: InvestigationRun;
  phase: InvestigationPhase;
  onReplay: () => void;
  onReset: () => void;
  onOpenRawTrace: () => void;
  isReplaying: boolean;
}

export const HeaderMeta: React.FC<HeaderMetaProps> = ({
  run,
  phase,
  onReplay,
  onReset,
  onOpenRawTrace,
  isReplaying,
}) => {
  const { id, task, scenario_label, diagnosis, timestamp } = run;
  const hasFailure = diagnosis.has_failure;
  const isUnknown = diagnosis.unknown;
  const canReplay = hasFailure && !isUnknown;

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div className="bg-white/80 border border-slate-200/80 rounded-2xl p-5 mb-6 backdrop-blur-xl shadow-panel">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Run Identifiers */}
        <div>
          <div className="flex items-center gap-3 mb-1.5 flex-wrap">
            <span className="font-mono text-xs font-bold text-violet-700 flex items-center gap-1.5 bg-violet-50 px-3 py-1 rounded-full border border-violet-200">
              <Fingerprint className="w-3.5 h-3.5" />
              {id}
            </span>
            <span className="text-xs font-mono text-slate-500 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {formattedTime}
            </span>
            <span className="text-xs font-mono text-slate-500">
              Scenario: <strong className="text-slate-800">{scenario_label}</strong>
            </span>
          </div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2 font-sans">
            <span className="text-violet-600 font-mono font-bold">❯</span> {task}
          </h2>
        </div>

        {/* Actions Strip */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {canReplay && (
            <Button
              variant="glow"
              size="sm"
              icon={<RotateCcw className="w-4 h-4" />}
              onClick={onReplay}
              isLoading={isReplaying}
            >
              {phase === 'recovered' ? 'Re-run Counterfactual' : 'Replay Without Fault'}
            </Button>
          )}

          <Button
            variant="secondary"
            size="sm"
            icon={<Terminal className="w-4 h-4 text-pink-600" />}
            onClick={onOpenRawTrace}
          >
            Raw Telemetry
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
};
