import React from 'react';
import { ShieldAlert, Terminal } from 'lucide-react';
import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) => {
  return (
    <div className="flex flex-col items-center justify-center text-center p-12 bg-white/80 border border-slate-200/80 rounded-3xl max-w-xl mx-auto backdrop-blur-xl shadow-panel">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-100 to-fuchsia-100 border border-violet-200 flex items-center justify-center text-violet-600 mb-5 shadow-sm">
        {icon || <ShieldAlert className="w-8 h-8" />}
      </div>
      <h3 className="text-lg font-bold text-slate-900 tracking-tight mb-2">{title}</h3>
      <p className="text-sm text-slate-600 max-w-md leading-relaxed mb-6 font-normal">
        {description}
      </p>
      {actionLabel && onAction && (
        <Button variant="primary" icon={<Terminal className="w-4 h-4" />} onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
