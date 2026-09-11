import React from 'react';

export type BadgeTone = 'root' | 'failure' | 'downstream' | 'passed' | 'warning' | 'neutral' | 'info';

interface StatusBadgeProps {
  label: string;
  tone?: BadgeTone;
  glyph?: string;
  pulse?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  label,
  tone = 'neutral',
  glyph,
  pulse = false,
  size = 'md',
}) => {
  const toneStyles: Record<BadgeTone, { bg: string; text: string; border: string; glow: string }> = {
    root: {
      bg: 'bg-rose-50',
      text: 'text-rose-700 font-extrabold',
      border: 'border-rose-200 shadow-sm',
      glow: 'shadow-[0_0_12px_rgba(244,63,94,0.18)]',
    },
    failure: {
      bg: 'bg-rose-50',
      text: 'text-rose-700 font-bold',
      border: 'border-rose-200',
      glow: '',
    },
    downstream: {
      bg: 'bg-amber-50',
      text: 'text-amber-800 font-bold',
      border: 'border-amber-200',
      glow: '',
    },
    passed: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700 font-bold',
      border: 'border-emerald-200',
      glow: '',
    },
    warning: {
      bg: 'bg-amber-50',
      text: 'text-amber-800 font-bold',
      border: 'border-amber-300',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.15)]',
    },
    neutral: {
      bg: 'bg-slate-100',
      text: 'text-slate-700 font-medium',
      border: 'border-slate-200',
      glow: '',
    },
    info: {
      bg: 'bg-violet-50',
      text: 'text-violet-700 font-bold',
      border: 'border-violet-200',
      glow: 'shadow-[0_0_12px_rgba(139,92,246,0.18)]',
    },
  };

  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 tracking-wider',
    md: 'text-xs px-2.5 py-1 tracking-wider',
    lg: 'text-sm px-3.5 py-1.5 tracking-widest',
  };

  const current = toneStyles[tone];
  const pulseClass = pulse ? 'animate-pulse' : '';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold font-mono-code uppercase rounded-full border ${current.bg} ${current.text} ${current.border} ${current.glow} ${sizeStyles[size]} ${pulseClass}`}
    >
      {glyph && <span className="text-[1.1em]">{glyph}</span>}
      <span>{label}</span>
    </span>
  );
};
