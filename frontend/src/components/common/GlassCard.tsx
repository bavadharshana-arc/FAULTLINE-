import React from 'react';

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  glow?: 'none' | 'purple' | 'magenta' | 'red' | 'green' | 'violet' | 'cyan';
  hoverEffect?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  glow = 'none',
  hoverEffect = false,
  ...props
}) => {
  const glowStyles = {
    none: 'border-slate-200/80 shadow-panel',
    purple: 'shadow-glow-purple border-purple-200 ring-1 ring-purple-400/20',
    violet: 'shadow-glow-purple border-violet-200 ring-1 ring-violet-400/20',
    magenta: 'shadow-glow-magenta border-fuchsia-200 ring-1 ring-fuchsia-400/20',
    cyan: 'shadow-glow-cyan border-cyan-200 ring-1 ring-cyan-400/20',
    red: 'shadow-glow-red border-rose-300 ring-1 ring-rose-400/20 animate-glow-pulse',
    green: 'shadow-glow-green border-emerald-200 ring-1 ring-emerald-400/20',
  };

  const hoverClass = hoverEffect
    ? 'transition-all duration-300 hover:border-violet-300 hover:bg-white/95 hover:shadow-lg hover:-translate-y-0.5'
    : '';

  return (
    <div
      className={`relative bg-white/80 backdrop-blur-xl border rounded-2xl p-5 ${glowStyles[glow]} ${hoverClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
};
