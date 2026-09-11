import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Cpu,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Activity,
  FileSearch,
  Lock,
  Workflow,
  Search,
  TrendingUp,
  BarChart3,
  Bot,
  ExternalLink,
  ChevronRight,
  Zap,
  Radio,
  Sliders,
  Terminal,
  Clock,
  ShieldAlert,
  ChevronDown,
  Info,
} from 'lucide-react';
import { RobotCharacter } from '../components/RobotCharacter';

export const Landing: React.FC = () => {
  const navigate = useNavigate();

  // Hero section — cursor is tracked relative to the robot within these bounds.
  const heroRef = useRef<HTMLDivElement>(null);

  // Background Parallax State (updated at low frequency by the robot's rAF loop,
  // consumed by the ambient hero shapes / floating agent node cards).
  const [smoothMouse, setSmoothMouse] = useState({ x: 0, y: 0 });
  const handleRobotParallax = useCallback((x: number, y: number) => {
    setSmoothMouse((prev) =>
      Math.abs(prev.x - x) + Math.abs(prev.y - y) > 0.0015 ? { x, y } : prev,
    );
  }, []);

  // Live Forensic Trace Simulation State
  const [traceStep, setTraceStep] = useState<number>(0); // 0: Idle, 1: Planner, 2: Executor fails, 3: Reviewer alerts, 4: Root Cause isolated
  const [isTracing, setIsTracing] = useState<boolean>(false);
  const [autoLoop, setAutoLoop] = useState<boolean>(true);

  // Interactive agent detail modal/popover
  const [selectedAgentDetail, setSelectedAgentDetail] = useState<'planner' | 'executor' | 'reviewer' | null>(null);

  // Interactive pipeline active step
  const [activePipelineStep, setActivePipelineStep] = useState<number>(1);

  // Live Trace Sequence Engine
  const runLiveTrace = () => {
    setIsTracing(true);
    setTraceStep(1); // Planner
  };

  useEffect(() => {
    if (!isTracing && !autoLoop) return;

    let timer: NodeJS.Timeout;
    if (isTracing) {
      if (traceStep === 1) {
        // Planner finished -> Executor activates
        timer = setTimeout(() => setTraceStep(2), 1600);
      } else if (traceStep === 2) {
        // Executor fails -> Reviewer downstream alert
        timer = setTimeout(() => setTraceStep(3), 1800);
      } else if (traceStep === 3) {
        // FAULTLINE attributes Root Cause to Executor
        timer = setTimeout(() => {
          setTraceStep(4);
          setIsTracing(false);
        }, 1800);
      }
    } else if (autoLoop && traceStep === 0) {
      timer = setTimeout(() => runLiveTrace(), 4000);
    }

    return () => clearTimeout(timer);
  }, [traceStep, isTracing, autoLoop]);

  const pipelineSteps = [
    {
      num: '01',
      name: 'TRACE',
      desc: 'Capture execution and interactions',
      detail: 'Extract every token, AST node, tool invocation, and dependency lineage in real-time telemetry.',
      icon: Activity,
    },
    {
      num: '02',
      name: 'ATTRIBUTE',
      desc: 'Find the causal agent and event',
      detail: 'Traverse the directed causal graph backwards from symptoms to pinpoint the first invalid state.',
      icon: Search,
    },
    {
      num: '03',
      name: 'PROVE',
      desc: 'Show evidence & competing hypotheses',
      detail: 'Calculate Bayesian causal probabilities against counter-explanations with explicit falsification tests.',
      icon: ShieldCheck,
    },
    {
      num: '04',
      name: 'COUNTERFACTUAL',
      desc: 'Verify with a rerun',
      detail: 'Substitute isolated agent failure with ground-truth intervention to prove downstream recovery.',
      icon: RotateCcw,
    },
    {
      num: '05',
      name: 'GUARDRAIL',
      desc: 'Recommend & re-test',
      detail: 'Synthesize deterministic AST validators and runtime schemas that automatically block recurrence.',
      icon: Lock,
    },
    {
      num: '06',
      name: 'LEARN',
      desc: 'Update reliability from outcomes',
      detail: 'Index agent failure modes into empirical reliability vectors categorized by task domain.',
      icon: Layers,
    },
    {
      num: '07',
      name: 'PREDICT',
      desc: 'Forecast next failures',
      detail: 'Pre-flight risk scorecards flag fragile agents before executing mission-critical workloads.',
      icon: TrendingUp,
    },
  ];

  return (
    <div className="min-h-screen bg-[#fafafc] text-slate-900 font-sans selection:bg-violet-600/20 selection:text-violet-900 overflow-x-hidden relative">
      {/* Background Soft Atmospheric Ambient Lights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[700px] rounded-full bg-gradient-to-b from-purple-200/35 via-violet-100/25 to-transparent blur-[120px] pointer-events-none -z-10" />
      <div className="fixed top-40 right-[-100px] w-[600px] h-[600px] rounded-full bg-gradient-to-bl from-pink-200/30 via-fuchsia-100/20 to-transparent blur-[140px] pointer-events-none -z-10" />
      <div className="fixed top-[600px] left-[-150px] w-[500px] h-[500px] rounded-full bg-gradient-to-tr from-indigo-200/25 to-purple-100/20 blur-[130px] pointer-events-none -z-10" />

      {/* Subtle fine dot matrix overlay */}
      <div
        className="fixed inset-0 pointer-events-none -z-10 opacity-[0.4]"
        style={{
          backgroundImage: 'radial-gradient(#94a3b8 0.75px, transparent 0.75px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* TOP NAVIGATION BAR */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/80 transition-all">
        <div className="max-w-7xl mx-auto px-6 h-18 flex items-center justify-between">
          {/* Brand Logo & Wordmark */}
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-600 via-purple-600 to-pink-500 flex items-center justify-center text-white shadow-sm shadow-purple-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-base tracking-wider text-slate-900 font-sans">
                FAULTLINE
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-pink-500 animate-pulse" />
            </div>
          </div>

          {/* Center Navigation Links */}
          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
            <a href="#pipeline" className="hover:text-violet-600 transition-colors">
              Pipeline
            </a>
            <a href="#problem" className="hover:text-violet-600 transition-colors">
              The Problem
            </a>
            <a href="#capabilities" className="hover:text-violet-600 transition-colors">
              Capabilities
            </a>
            <a href="#reliability" className="hover:text-violet-600 transition-colors">
              Reliability
            </a>
            <a href="#use-cases" className="hover:text-violet-600 transition-colors">
              Use Cases
            </a>
          </nav>

          {/* Right Action CTAs */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="hidden sm:inline-flex px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all"
            >
              Console
            </button>
            <button
              onClick={() => navigate('/investigation')}
              className="px-4 py-2 rounded-full text-xs font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:shadow-lg hover:shadow-purple-500/25 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 shadow-sm"
            >
              Launch Investigation
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section ref={heroRef} className="relative pt-12 pb-20 md:pt-16 md:pb-28 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          
          {/* LEFT COLUMN: Editorial SaaS Messaging */}
          <div className="lg:col-span-6 space-y-6 text-left z-20">
            {/* Eyebrow badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-100/70 border border-violet-200/80 text-[11px] font-bold tracking-wider text-violet-800 uppercase shadow-xs">
              <Sparkles className="w-3 h-3 text-violet-600" />
              Causal Forensics & Reliability Intelligence for Multi-Agent AI
            </div>

            {/* Giant Modern Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08] font-sans">
              When AI fails, <br />
              <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
                find the fault.
              </span>
            </h1>

            {/* Supporting Copy */}
            <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl font-sans">
              Trace multi-agent workflows, identify the first causal failure, prove it with evidence, verify the fix, and learn which agent is likely to fail next.
            </p>

            {/* Primary & Secondary CTAs */}
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <button
                onClick={() => navigate('/investigation')}
                className="px-6 py-3 rounded-full text-sm font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:shadow-xl hover:shadow-purple-500/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2 shadow-md"
              >
                START INVESTIGATION
                <ArrowRight className="w-4 h-4" />
              </button>

              <a
                href="#pipeline"
                className="px-6 py-3 rounded-full text-sm font-semibold text-slate-700 bg-white/90 border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 shadow-xs transition-all flex items-center gap-2"
              >
                <Play className="w-3.5 h-3.5 text-violet-600 fill-violet-600/20" />
                EXPLORE HOW IT WORKS
              </a>
            </div>

            {/* 4 Feature Value Props */}
            <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-slate-200/80">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Activity className="w-3.5 h-3.5 text-violet-600" />
                  Trace
                </div>
                <div className="text-[11px] text-slate-500">Every decision</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Prove
                </div>
                <div className="text-[11px] text-slate-500">With evidence</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <Lock className="w-3.5 h-3.5 text-purple-600" />
                  Fix
                </div>
                <div className="text-[11px] text-slate-500">With guardrails</div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                  <TrendingUp className="w-3.5 h-3.5 text-pink-600" />
                  Predict
                </div>
                <div className="text-[11px] text-slate-500">Who may fail next</div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Interactive Multi-Agent Spatial Visual with Friendly Robot & Parallax */}
          <div className="lg:col-span-6 relative flex items-center justify-center min-h-[480px] sm:min-h-[540px]">
            
            {/* Parallax Background Translucent Shapes */}
            <div
              className="absolute w-72 h-72 rounded-full bg-gradient-to-tr from-purple-200/50 to-pink-200/40 blur-3xl pointer-events-none transition-transform ease-out"
              style={{
                transform: `translate(${smoothMouse.x * 35}px, ${smoothMouse.y * 35}px)`,
              }}
            />
            <div
              className="absolute w-60 h-60 rounded-3xl bg-gradient-to-br from-violet-100/60 via-purple-50/40 to-transparent border border-purple-200/40 rotate-12 pointer-events-none -z-1 transition-transform ease-out"
              style={{
                transform: `translate(${-smoothMouse.x * 20}px, ${-smoothMouse.y * 20}px) rotate(${12 + smoothMouse.x * 4}deg)`,
              }}
            />

            {/* SVG Connecting Causal Lines between Agent Nodes */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
              <defs>
                <linearGradient id="flowGradActive" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="50%" stopColor="#ec4899" />
                  <stop offset="100%" stopColor="#f43f5e" />
                </linearGradient>
                <filter id="glowLine">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                  <feMerge>
                    <feMergeNode in="coloredBlur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* Curve: Planner (top-left) -> Executor (top-center) */}
              <path
                d="M 120 110 C 180 80, 220 80, 270 90"
                fill="none"
                stroke={traceStep >= 1 ? '#8b5cf6' : '#cbd5e1'}
                strokeWidth={traceStep >= 1 ? '2.5' : '1.5'}
                strokeDasharray={traceStep >= 1 ? '4 2' : 'none'}
                className={traceStep >= 1 ? 'animate-pulse' : ''}
                filter={traceStep >= 1 ? 'url(#glowLine)' : undefined}
              />

              {/* Curve: Executor (top-center) -> Reviewer (top-right) */}
              <path
                d="M 360 110 C 400 90, 440 90, 470 120"
                fill="none"
                stroke={traceStep >= 2 ? '#ec4899' : '#cbd5e1'}
                strokeWidth={traceStep >= 2 ? '2.5' : '1.5'}
                strokeDasharray={traceStep >= 2 ? '4 2' : 'none'}
                filter={traceStep >= 2 ? 'url(#glowLine)' : undefined}
              />

              {/* Curve: Reviewer -> Failure Detected Card (bottom-right) */}
              <path
                d="M 470 160 C 480 230, 460 270, 430 310"
                fill="none"
                stroke={traceStep >= 3 ? '#f43f5e' : '#cbd5e1'}
                strokeWidth={traceStep >= 3 ? '2.5' : '1.5'}
                strokeDasharray={traceStep >= 3 ? '4 2' : 'none'}
                filter={traceStep >= 3 ? 'url(#glowLine)' : undefined}
              />
            </svg>

            {/* CENTER: FRIENDLY FUTURISTIC AI ROBOT — multi-part interactive character */}
            <RobotCharacter
              boundsRef={heroRef}
              isTracing={isTracing}
              onClick={() => runLiveTrace()}
              onParallax={handleRobotParallax}
            />

            {/* AGENT NODE 1: PLANNER (Top Left) */}
            <div
              className={`absolute top-4 sm:top-8 left-2 sm:left-6 z-20 transition-all duration-300 cursor-pointer ${
                traceStep === 1
                  ? 'ring-2 ring-violet-500 ring-offset-2 scale-105 shadow-lg'
                  : 'hover:scale-102 shadow-md'
              }`}
              style={{
                transform: `translate(${smoothMouse.x * 12}px, ${smoothMouse.y * 12}px)`,
              }}
              onClick={() => setSelectedAgentDetail('planner')}
            >
              <div className="p-3.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/80 w-44 sm:w-48 shadow-sm transition-all hover:bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                      <Cpu className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 font-sans">
                      PLANNER
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">0.8s</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600 flex items-center gap-1">
                    <span className="text-emerald-600 font-semibold">Task analyzed</span>
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 fill-emerald-50" />
                </div>
              </div>
            </div>

            {/* AGENT NODE 2: EXECUTOR (Top Center / Right) — THE ROOT CAUSE */}
            <div
              className={`absolute top-2 sm:top-4 right-20 sm:right-32 z-25 transition-all duration-300 cursor-pointer ${
                traceStep >= 2
                  ? 'ring-2 ring-rose-500 ring-offset-2 scale-105 shadow-xl shadow-rose-500/20'
                  : 'hover:scale-102 shadow-md'
              }`}
              style={{
                transform: `translate(${smoothMouse.x * 8}px, ${smoothMouse.y * 8}px)`,
              }}
              onClick={() => setSelectedAgentDetail('executor')}
            >
              {/* Glowing ROOT CAUSE neon pill */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full bg-gradient-to-r from-rose-500 to-pink-500 text-white font-extrabold text-[9px] tracking-wider uppercase shadow-md shadow-rose-500/30 flex items-center gap-1 whitespace-nowrap animate-pulse">
                <ShieldAlert className="w-2.5 h-2.5" />
                ROOT CAUSE
              </div>

              <div className="p-3.5 pt-4 rounded-2xl bg-white/95 backdrop-blur-xl border-2 border-rose-400/80 w-48 sm:w-52 shadow-lg hover:bg-white transition-all">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                      <Terminal className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-950 font-sans">
                      EXECUTOR
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">2.4s</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-rose-600 font-bold">Action failed</span>
                  <XCircle className="w-3.5 h-3.5 text-rose-500 fill-rose-50" />
                </div>
              </div>
            </div>

            {/* AGENT NODE 3: REVIEWER (Top Right) */}
            <div
              className={`absolute top-20 sm:top-24 right-0 sm:right-4 z-20 transition-all duration-300 cursor-pointer ${
                traceStep >= 3
                  ? 'ring-2 ring-amber-500 ring-offset-2 scale-105 shadow-lg shadow-amber-500/10'
                  : 'hover:scale-102 shadow-md'
              }`}
              style={{
                transform: `translate(${smoothMouse.x * 16}px, ${smoothMouse.y * 16}px)`,
              }}
              onClick={() => setSelectedAgentDetail('reviewer')}
            >
              <div className="p-3.5 rounded-2xl bg-white/90 backdrop-blur-xl border border-slate-200/80 w-44 sm:w-48 shadow-sm transition-all hover:bg-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 font-sans">
                      REVIEWER
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-slate-400">1.2s</span>
                </div>
                <div className="mt-2.5 flex items-center justify-between text-[11px]">
                  <span className="text-slate-600">Validation check</span>
                  <span className="px-1.5 py-0.5 rounded text-[9.5px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                    Skipped ⊘
                  </span>
                </div>
              </div>
            </div>

            {/* LIVE FORENSIC INVESTIGATION STATUS CARD (Bottom Right) */}
            <div
              className="absolute bottom-2 sm:bottom-6 right-2 sm:right-6 z-25 transition-all duration-300"
              style={{
                transform: `translate(${smoothMouse.x * 6}px, ${smoothMouse.y * 6}px)`,
              }}
            >
              <div className="p-4 rounded-2xl bg-white/95 backdrop-blur-2xl border border-slate-200/90 w-64 sm:w-72 shadow-xl">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-[11px] font-extrabold text-slate-900 font-sans tracking-wide">
                        {traceStep === 4 ? 'ROOT CAUSE ISOLATED' : 'FAILURE DETECTED'}
                      </div>
                      <div className="text-[9.5px] font-mono text-slate-500">
                        {traceStep === 4 ? 'Deterministic AST Proof' : 'Tracing root cause...'}
                      </div>
                    </div>
                  </div>
                  {traceStep === 4 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
                      96.8%
                    </span>
                  )}
                </div>

                {/* Progress Checklist */}
                <div className="py-2.5 space-y-1.5 text-[11px] font-mono">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className={`w-1.5 h-1.5 rounded-full ${traceStep >= 1 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Analyzing trace logs</span>
                    {traceStep >= 1 && <span className="ml-auto text-[9.5px] text-emerald-600 font-sans font-bold">✓</span>}
                  </div>
                  <div className="flex items-center gap-2 text-slate-600">
                    <span className={`w-1.5 h-1.5 rounded-full ${traceStep >= 2 ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span>Comparing agent outputs</span>
                    {traceStep >= 2 && <span className="ml-auto text-[9.5px] text-emerald-600 font-sans font-bold">✓</span>}
                  </div>
                  <div className="flex items-center gap-2 text-slate-900 font-semibold">
                    <span className={`w-1.5 h-1.5 rounded-full ${traceStep >= 3 ? 'bg-rose-500 animate-ping' : 'bg-slate-300'}`} />
                    <span>Identifying first invalid state</span>
                    {traceStep === 4 && <span className="ml-auto text-[9.5px] text-rose-600 font-sans font-bold">FOUND</span>}
                  </div>
                </div>

                {/* Animated Glowing Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden mt-1">
                  <div
                    className="h-full bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 transition-all duration-700 rounded-full"
                    style={{
                      width: traceStep === 0 ? '20%' : traceStep === 1 ? '40%' : traceStep === 2 ? '70%' : traceStep === 3 ? '90%' : '100%',
                    }}
                  />
                </div>

                {/* Live Demonstration Button */}
                <div className="pt-3 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider font-mono">
                      LIVE TRACE
                    </span>
                  </div>
                  <button
                    onClick={runLiveTrace}
                    disabled={isTracing}
                    className="px-2.5 py-1 rounded-lg text-[10.5px] font-bold bg-violet-50 text-violet-700 hover:bg-violet-100 transition-all flex items-center gap-1 border border-violet-200/80 disabled:opacity-50"
                  >
                    <Play className="w-3 h-3 fill-violet-600" />
                    {isTracing ? 'Tracing...' : 'Run Live Trace'}
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Interactive Agent Modal/Popover for In-Depth Inspection */}
        {selectedAgentDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/30 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl p-6 max-w-md w-full relative space-y-4">
              <button
                onClick={() => setSelectedAgentDetail(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-700 font-bold text-sm"
              >
                ✕
              </button>

              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
                    selectedAgentDetail === 'executor'
                      ? 'bg-rose-50 text-rose-600 border border-rose-200'
                      : selectedAgentDetail === 'planner'
                      ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
                      : 'bg-amber-50 text-amber-600 border border-amber-200'
                  }`}
                >
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-base text-slate-900 uppercase font-sans">
                    {selectedAgentDetail} AGENT INSPECTOR
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    {selectedAgentDetail === 'executor'
                      ? 'Root Cause of Pipeline Failure'
                      : selectedAgentDetail === 'planner'
                      ? 'Execution Plan Decomposer'
                      : 'Downstream Validation Stage'}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <span
                    className={`font-bold ${
                      selectedAgentDetail === 'executor'
                        ? 'text-rose-600'
                        : selectedAgentDetail === 'planner'
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    }`}
                  >
                    {selectedAgentDetail === 'executor' ? 'FAILED (Action Error)' : selectedAgentDetail === 'planner' ? 'VALIDATED' : 'SKIPPED'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Causal Blame Confidence:</span>
                  <span className="font-bold text-slate-900">
                    {selectedAgentDetail === 'executor' ? '96.8% (ISOLATED ROOT)' : '0.0%'}
                  </span>
                </div>
                <div className="pt-2 border-t border-slate-200/60">
                  <div className="text-slate-500 mb-1">State Evaluation:</div>
                  <div className="text-slate-800 text-[11px] bg-white p-2.5 rounded-xl border border-slate-200">
                    {selectedAgentDetail === 'executor'
                      ? 'Invalid arithmetic syntax in formula execution: unexpected token at offset 14. Output was passed unverified.'
                      : selectedAgentDetail === 'planner'
                      ? 'Input prompt successfully decomposed into 3 sub-tasks with valid execution graph.'
                      : 'Reviewer omitted verification because Executor returned an unhandled schema exception.'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedAgentDetail(null);
                  navigate('/investigation');
                }}
                className="w-full py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-pink-500 hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
              >
                Inspect in Full Forensic Workspace
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </section>

      {/* SECTION 2: THE PROBLEM */}
      <section id="problem" className="py-20 bg-white/70 border-y border-slate-200/80 relative">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-widest text-violet-600 font-mono">
              THE BOTTLENECK OF AUTONOMOUS SYSTEMS
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              MULTI-AGENT FAILURE IS EASY TO SEE. <br />
              <span className="text-rose-600">CAUSE IS NOT.</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
              When an autonomous multi-agent pipeline crashes, downstream validators scream first. But a downstream agent can detect a failure without causing it. FAULTLINE traces execution lineage to isolate the earliest causal deviation.
            </p>
          </div>

          {/* Interactive Visual Comparison: Traditional Logging vs FAULTLINE Lineage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-stretch">
            {/* Box 1: Downstream Illusion */}
            <div className="p-6 rounded-3xl bg-slate-50 border border-slate-200/80 space-y-4 shadow-xs">
              <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
                <XCircle className="w-4 h-4" />
                Conventional Telemetry (Symptom Blame)
              </div>
              <div className="p-4 rounded-2xl bg-white border border-slate-200 space-y-2 font-mono text-xs text-slate-700">
                <div className="text-slate-400">// Final validator crashed:</div>
                <div className="text-rose-600 font-bold">ERROR: Reviewer validation check returned False</div>
                <div className="text-slate-500 text-[11px]">→ Engineers spend 4 hours debugging the Reviewer agent</div>
                <div className="text-amber-700 font-semibold text-[11px] bg-amber-50 p-2 rounded-lg border border-amber-200">
                  ⚠ FALSE ATTRIBUTION: Reviewer was just observing corrupt data sent by Executor!
                </div>
              </div>
            </div>

            {/* Box 2: Causal Isolation */}
            <div className="p-6 rounded-3xl bg-gradient-to-br from-violet-50/80 to-purple-50/80 border border-violet-200/80 space-y-4 shadow-sm">
              <div className="flex items-center gap-2 text-violet-700 font-bold text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                FAULTLINE Causal Forensic Engine
              </div>
              <div className="p-4 rounded-2xl bg-white border border-violet-200 space-y-2 font-mono text-xs text-slate-700">
                <div className="text-violet-600 font-bold">ROOT CAUSE ISOLATED: Executor (Step 2)</div>
                <div className="text-emerald-700 font-semibold text-[11px]">
                  ✓ Downstream Reviewer failure is purely consequential (Blast Radius: 2 steps)
                </div>
                <div className="text-slate-600 text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-200">
                  Isolated in 82ms with 96.8% confidence using mathematical AST verification.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: THE FAULTLINE PIPELINE (7 STEPS) */}
      <section id="pipeline" className="py-24 max-w-7xl mx-auto px-6 space-y-16">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-widest text-violet-600 font-mono">
            THE FAULTLINE PIPELINE
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
            From failure to fix — automatically.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
            A complete forensic and reliability loop for autonomous multi-agent AI systems.
          </p>
        </div>

        {/* 7 Connected Steps Strip with Icons (Matching Reference Design) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4">
          {pipelineSteps.map((step, idx) => {
            const Icon = step.icon;
            const isSelected = activePipelineStep === idx + 1;
            return (
              <div
                key={step.name}
                onClick={() => setActivePipelineStep(idx + 1)}
                className={`p-5 rounded-3xl transition-all cursor-pointer flex flex-col items-center text-center space-y-3 border relative ${
                  isSelected
                    ? 'bg-white shadow-xl border-violet-300 ring-2 ring-violet-500/20 scale-105 z-10'
                    : 'bg-white/70 hover:bg-white border-slate-200/80 shadow-xs hover:shadow-md'
                }`}
              >
                {/* Step Circle Icon with Pastel Glow */}
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all ${
                    isSelected
                      ? 'bg-gradient-to-br from-violet-600 to-pink-500 text-white shadow-md shadow-purple-500/20'
                      : 'bg-violet-50 text-violet-700 border border-violet-200/60'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 font-mono">{step.num}</div>
                  <div className="text-xs font-extrabold tracking-wider text-slate-900 font-sans uppercase">
                    {step.name}
                  </div>
                </div>

                <div className="text-[11px] text-slate-500 leading-snug line-clamp-2 font-sans">
                  {step.desc}
                </div>
              </div>
            );
          })}
        </div>

        {/* Active Step Feature Deep-Dive Card */}
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-slate-200/90 shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-violet-50 text-violet-700 font-mono text-xs font-bold border border-violet-200/80">
              STEP {pipelineSteps[activePipelineStep - 1].num} · {pipelineSteps[activePipelineStep - 1].name}
            </div>
            <h3 className="text-xl font-bold text-slate-900 font-sans">
              {pipelineSteps[activePipelineStep - 1].desc}
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              {pipelineSteps[activePipelineStep - 1].detail}
            </p>
          </div>

          <button
            onClick={() => navigate('/investigation')}
            className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-all flex items-center gap-2 shrink-0 shadow-sm"
          >
            Experience in Workspace
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </section>

      {/* SECTION 4: KEY CAPABILITIES (DEEP FORENSICS. REAL INTELLIGENCE.) */}
      <section id="capabilities" className="py-24 bg-white/70 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-widest text-violet-600 font-mono">
              KEY CAPABILITIES
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              Deep forensics. Real intelligence.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
              Everything you need to understand, fix, and prevent AI agent failures in production.
            </p>
          </div>

          {/* 4 Cards Grid Matching Reference Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Causal Blame Graph */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
                  <Workflow className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">Causal Blame Graph</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Visualize the causal path and identify the <strong className="text-rose-600">true root cause</strong> without symptom noise.
                  </p>
                </div>
              </div>

              {/* Mini Interactive Preview */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 font-mono text-[10.5px]">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200 text-slate-700">
                  <span>Planner</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                </div>
                <div className="text-center text-slate-400">↓</div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 font-bold">
                  <span>Executor ✕</span>
                  <span className="text-[8px] bg-rose-500 text-white px-1.5 py-0.5 rounded">ROOT CAUSE</span>
                </div>
                <div className="text-center text-slate-400">↓</div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
                  <span>Reviewer ⚠</span>
                  <span className="text-[9px]">Downstream</span>
                </div>
              </div>
            </div>

            {/* Card 2: Counterfactual Proof */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-600">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">Counterfactual Proof</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Test the hypothesis. Verify if repairing the isolated agent recovers the full pipeline.
                  </p>
                </div>
              </div>

              {/* Mini Side-by-Side Proof */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 font-mono text-[10.5px]">
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-white border border-slate-200">
                    <div className="text-[9.5px] text-slate-400 uppercase font-bold">Original</div>
                    <div className="text-rose-600 font-bold mt-1">✕ Failure</div>
                  </div>
                  <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                    <div className="text-[9.5px] text-emerald-700 uppercase font-bold">Replay</div>
                    <div className="text-emerald-700 font-bold mt-1">✓ Success</div>
                  </div>
                </div>
                <div className="p-1.5 rounded-lg bg-emerald-100/50 text-emerald-800 text-center font-bold text-[10px]">
                  CAUSALITY VERIFIED ✓
                </div>
              </div>
            </div>

            {/* Card 3: Evidence Engine */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
                  <FileSearch className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">Evidence Engine</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Transparent empirical evidence with competing probability distributions.
                  </p>
                </div>
              </div>

              {/* Mini Probability Bars */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2 font-mono text-[10.5px]">
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Planner</span>
                    <span>5%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 w-[5%]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Executor</span>
                    <span>91%</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-rose-500 w-[91%]" />
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-slate-600">
                    <span>Reviewer</span>
                    <span>4%</span>
                  </div>
                  <div className="w-full h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div className="h-full bg-slate-400 w-[4%]" />
                  </div>
                </div>
              </div>
            </div>

            {/* Card 4: Reliability Intelligence */}
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 font-sans">Reliability Intelligence</h3>
                  <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                    Learn from historical outcomes. Predict which agent will fail before running.
                  </p>
                </div>
              </div>

              {/* Mini Agent Reliability Matrix */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5 font-mono text-[10.5px]">
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200">
                  <span className="font-semibold text-slate-800">Planner</span>
                  <span className="text-emerald-600 font-bold">96% · Low</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-rose-50 border border-rose-200">
                  <span className="font-semibold text-rose-950">Executor</span>
                  <span className="text-rose-600 font-bold">81% · High Risk</span>
                </div>
                <div className="flex items-center justify-between p-1.5 rounded-lg bg-white border border-slate-200">
                  <span className="font-semibold text-slate-800">Reviewer</span>
                  <span className="text-amber-600 font-bold">91% · Med</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 5: THE GUARDRAIL LOOP */}
      <section className="py-20 max-w-6xl mx-auto px-6 space-y-12">
        <div className="text-center max-w-3xl mx-auto space-y-3">
          <div className="text-xs font-extrabold uppercase tracking-widest text-violet-600 font-mono">
            AUTOMATED REMEDIATION
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
            From Post-Mortem to Prevention.
          </h2>
          <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
            FAULTLINE doesn't just blame; it synthesizes deterministic guardrails that prevent future recurrence.
          </p>
        </div>

        {/* Interactive Guardrail Progression Flow */}
        <div className="p-8 rounded-3xl bg-white border border-slate-200/90 shadow-md">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center text-center">
            {/* Step 1 */}
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
              <div className="text-[10px] font-mono text-rose-500 uppercase font-bold">Trigger</div>
              <div className="text-xs font-bold text-rose-900">Failure Detected</div>
              <div className="text-[11px] text-rose-700">Invalid Schema</div>
            </div>

            <div className="hidden md:block text-slate-400 font-bold text-lg">➔</div>

            {/* Step 2 */}
            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-200 space-y-1">
              <div className="text-[10px] font-mono text-indigo-500 uppercase font-bold">Forensics</div>
              <div className="text-xs font-bold text-indigo-900">Root Cause Isolated</div>
              <div className="text-[11px] text-indigo-700">Executor AST Node</div>
            </div>

            <div className="hidden md:block text-slate-400 font-bold text-lg">➔</div>

            {/* Step 3 */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
              <div className="text-[10px] font-mono text-emerald-600 uppercase font-bold">Remediation</div>
              <div className="text-xs font-bold text-emerald-900">Guardrail Applied</div>
              <div className="text-[11px] text-emerald-700">✓ Prevented</div>
            </div>
          </div>

          <div className="mt-6 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-violet-600" />
              <span>Synthesized Guardrail: <code className="text-violet-700 font-bold">validate_schema(output, required_keys=['result', 'status'])</code></span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold">
              100% Deterministic Pass
            </span>
          </div>
        </div>
      </section>

      {/* SECTION 6: ENTERPRISE USE CASES */}
      <section id="use-cases" className="py-24 bg-white/70 border-t border-slate-200/80">
        <div className="max-w-7xl mx-auto px-6 space-y-16">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="text-xs font-extrabold uppercase tracking-widest text-violet-600 font-mono">
              PRODUCTION WORKLOADS
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight font-sans">
              Built for every multi-agent architecture.
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-sans">
              Whether deploying LangGraph, AutoGen, CrewAI, or custom orchestrators.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600">
                <Bot className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-sans">AI Coding & CI/CD Fleets</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Isolate syntax generation bugs, missing imports, and broken test assertions across architect, coder, and test-runner agents.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 border border-violet-200 flex items-center justify-center text-violet-600">
                <Search className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-sans">Deep Research & Retrieval</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Identify which retrieval tool hallucinated citations and trace why downstream summarizers accepted unverified facts.
              </p>
            </div>

            <div className="p-6 rounded-3xl bg-white border border-slate-200/90 shadow-sm hover:shadow-md transition-all space-y-3">
              <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-600">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-slate-900 font-sans">Enterprise Workflow Automation</h3>
              <p className="text-xs text-slate-600 leading-relaxed font-sans">
                Prevent catastrophic cascade errors in ERP, financial calculations, and compliance verification pipelines.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 7: PROVEN IMPACT STRIP (Matching Reference) */}
      <section className="py-16 max-w-7xl mx-auto px-6">
        <div className="p-8 sm:p-12 rounded-3xl bg-gradient-to-r from-violet-50 via-purple-50 to-pink-50 border border-purple-200/80 shadow-md grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-6 space-y-2">
            <div className="text-[11px] font-bold text-violet-700 tracking-wider uppercase font-mono">
              BUILT FOR A SAFER AI FUTURE
            </div>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-sans">
              Reliable agents. Confident decisions.
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-sans">
              FAULTLINE gives you the visibility, accountability, and intelligence to build AI systems you can trust.
            </p>
            <div className="pt-2">
              <button
                onClick={() => navigate('/investigation')}
                className="px-5 py-2.5 rounded-full text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-pink-500 hover:shadow-lg hover:shadow-purple-500/20 transition-all flex items-center gap-1.5 shadow-sm"
              >
                Launch Investigation
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="md:col-span-6 grid grid-cols-3 gap-4 text-center">
            <div className="p-4 rounded-2xl bg-white/80 border border-purple-100 shadow-xs">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Higher reliability</div>
              <div className="text-2xl font-extrabold text-violet-600 mt-1">↑ 73%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">avg. improvement</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 border border-purple-100 shadow-xs">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">Faster resolution</div>
              <div className="text-2xl font-extrabold text-pink-600 mt-1">↓ 68%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">debugging time</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/80 border border-purple-100 shadow-xs">
              <div className="text-[10px] text-slate-500 uppercase font-semibold">More confidence</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">100%</div>
              <div className="text-[10px] text-slate-400 mt-0.5">traceable decisions</div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL HIGH-IMPACT CALL TO ACTION */}
      <section className="py-24 text-center max-w-4xl mx-auto px-6 space-y-8">
        <div className="space-y-4">
          <h2 className="text-4xl sm:text-5xl font-extrabold text-slate-900 tracking-tight font-sans">
            YOUR AI SYSTEM CAN FAIL. <br />
            <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 bg-clip-text text-transparent">
              NOW YOU CAN KNOW WHY.
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-mono">
            Trace. Attribute. Prove. Fix. Learn. Predict.
          </p>
        </div>

        <button
          onClick={() => navigate('/investigation')}
          className="px-8 py-4 rounded-full text-base font-bold text-white bg-gradient-to-r from-violet-600 via-purple-600 to-pink-500 hover:shadow-2xl hover:shadow-purple-500/35 hover:scale-105 active:scale-95 transition-all inline-flex items-center gap-2 shadow-lg"
        >
          START YOUR INVESTIGATION
          <ArrowRight className="w-4 h-4" />
        </button>
      </section>

      {/* SAAS FOOTER */}
      <footer className="bg-white border-t border-slate-200/80 py-12 text-slate-600 text-xs">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-600 to-pink-500 flex items-center justify-center text-white shadow-xs">
              <Cpu className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="font-extrabold text-sm tracking-wide text-slate-900 font-sans">
                FAULTLINE
              </span>
              <p className="text-[10.5px] text-slate-400">Causal Forensics & Reliability Intelligence for Multi-Agent AI</p>
            </div>
          </div>

          <div className="flex items-center gap-6 font-semibold text-slate-600">
            <button onClick={() => navigate('/investigation')} className="hover:text-violet-600 transition-colors">
              Investigation Workspace
            </button>
            <button onClick={() => navigate('/reliability')} className="hover:text-violet-600 transition-colors">
              Agent Reliability
            </button>
            <button onClick={() => navigate('/agents')} className="hover:text-violet-600 transition-colors">
              Agent Graph
            </button>
            <button onClick={() => navigate('/settings')} className="hover:text-violet-600 transition-colors">
              Safety Guardrails
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            © 2026 FAULTLINE AI · Enterprise Forensic Intelligence
          </div>
        </div>
      </footer>
    </div>
  );
};
