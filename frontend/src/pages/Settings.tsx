import React from 'react';
import { Settings as SettingsIcon, Shield, Cpu, Key, CheckCircle2, AlertCircle } from 'lucide-react';
import { GlassCard } from '../components/common/GlassCard';
import { useForensicsContext } from '../context/ForensicsContext';

export const Settings: React.FC = () => {
  const { systemStatus } = useForensicsContext();

  return (
    <div className="space-y-6 animate-fadeIn pb-12 max-w-4xl mx-auto">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight font-sans flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-violet-600" />
          FORENSIC ENGINE CONFIGURATION
        </h2>
        <p className="text-xs text-slate-500 font-mono mt-0.5">
          Observability parameters, safety whitelists, and model connections
        </p>
      </div>

      {/* Model & LLM Settings */}
      <GlassCard glow="violet" className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200/80">
          <Cpu className="w-4 h-4 text-violet-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
            Generative Model Integration
          </h3>
        </div>

        <div className="space-y-3 font-mono text-xs">
          <div className="p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-slate-900 font-bold block text-sm">Google Gemini API</span>
              <span className="text-slate-500 text-[11px]">
                {systemStatus?.gemini_connected
                  ? 'Active · gemini-2.0-flash configured'
                  : 'Omitted / Fallback · Deterministic template execution active'}
              </span>
            </div>
            {systemStatus?.gemini_connected ? (
              <span className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold flex items-center gap-1.5 shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Connected
              </span>
            ) : (
              <span className="px-3 py-1.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200 text-[11px] font-bold shadow-xs">
                Template Mode (Demo Ready)
              </span>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Security & AST Whitelist */}
      <GlassCard glow="cyan" className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200/80">
          <Shield className="w-4 h-4 text-emerald-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
            AST Safe Arithmetic Whitelist
          </h3>
        </div>

        <div className="space-y-2 font-mono text-xs text-slate-700 leading-relaxed">
          <p className="text-slate-600">
            Custom mathematical expressions are safely evaluated strictly through Python's Abstract Syntax Tree parser with node-type whitelisting:
          </p>
          <div className="p-3 rounded-xl bg-violet-50/80 border border-violet-200/80 text-violet-900 font-semibold text-[11px]">
            Constant, UnaryOp, BinOp, Add, Sub, Mult, Div, FloorDiv, Mod, Pow
          </div>
          <p className="text-[11px] text-slate-500">
            Raw eval() and exec() are completely blocked and rejected at the parse level.
          </p>
        </div>
      </GlassCard>

      {/* Trace Schema Contract */}
      <GlassCard glow="magenta" className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-200/80">
          <Key className="w-4 h-4 text-pink-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider font-sans text-slate-900">
            Mandatory 8-Field Telemetry Schema
          </h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-[11px]">
          {['task_id', 'step', 'agent', 'input', 'output', 'status', 'error_type', 'parent_step'].map((f) => (
            <div key={f} className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/80 shadow-xs text-center text-slate-700 font-semibold">
              {f}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
};
