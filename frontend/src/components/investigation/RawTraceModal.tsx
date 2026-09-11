import React, { useState } from 'react';
import { X, Copy, Check, Download, Upload, AlertCircle } from 'lucide-react';
import { Diagnosis, TraceEvent } from '../../types/forensics';
import { Button } from '../common/Button';
import { api } from '../../services/api';

interface RawTraceModalProps {
  isOpen: boolean;
  onClose: () => void;
  trace: TraceEvent[];
  diagnosis: Diagnosis;
  onUploadSuccess: (trace: TraceEvent[], diagnosis: Diagnosis) => void;
}

export const RawTraceModal: React.FC<RawTraceModalProps> = ({
  isOpen,
  onClose,
  trace,
  diagnosis,
  onUploadSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'view' | 'upload'>('view');
  const [copied, setCopied] = useState(false);
  const [uploadJson, setUploadJson] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  if (!isOpen) return null;

  const fullData = {
    trace,
    diagnosis,
  };

  const jsonString = JSON.stringify(fullData, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `faultline-trace-${diagnosis.task_id || 'run'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeUpload = async () => {
    setUploadError(null);
    try {
      const parsed = JSON.parse(uploadJson);
      const traceList = Array.isArray(parsed) ? parsed : parsed.trace;
      if (!Array.isArray(traceList)) {
        throw new Error('JSON must contain a list of trace events or { "trace": [...] }');
      }

      setIsAnalyzing(true);
      const res = await api.analyzeCustomTrace(traceList);
      if (res.success && res.trace && res.diagnosis) {
        onUploadSuccess(res.trace, res.diagnosis);
        onClose();
      } else {
        throw new Error(res.error || 'Failed to analyze trace');
      }
    } catch (err: any) {
      setUploadError(err.message || 'Invalid JSON format');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn">
      <div className="bg-white/95 border border-slate-200/80 rounded-3xl w-full max-w-3xl flex flex-col max-h-[85vh] shadow-2xl overflow-hidden backdrop-blur-2xl">
        {/* Header */}
        <div className="p-4 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('view')}
              className={`text-xs font-mono font-bold uppercase px-3.5 py-1.5 rounded-full transition-colors ${
                activeTab === 'view' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Raw Telemetry View
            </button>
            <button
              onClick={() => setActiveTab('upload')}
              className={`text-xs font-mono font-bold uppercase px-3.5 py-1.5 rounded-full transition-colors ${
                activeTab === 'upload' ? 'bg-violet-100 text-violet-700 border border-violet-200' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Upload Custom Trace
            </button>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 flex-1 overflow-y-auto">
          {activeTab === 'view' ? (
            <div>
              <div className="flex items-center justify-between mb-3 text-xs font-mono text-slate-500">
                <span>Task ID: <strong className="text-slate-900">{diagnosis.task_id}</strong></span>
                <div className="flex items-center gap-2">
                  <Button variant="secondary" size="sm" icon={copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} onClick={handleCopy}>
                    {copied ? 'Copied' : 'Copy'}
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Download className="w-3.5 h-3.5" />} onClick={handleDownload}>
                    Download
                  </Button>
                </div>
              </div>
              <pre className="p-4 rounded-2xl bg-slate-900 text-slate-100 border border-slate-700 overflow-x-auto text-xs font-mono max-h-[55vh] leading-relaxed shadow-sm">
                {jsonString}
              </pre>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-xs font-mono text-slate-600 font-medium">
                Paste an external multi-agent trace adhering to the mandatory 8-field schema (task_id, step, agent, input, output, status, error_type, parent_step).
              </p>
              <textarea
                value={uploadJson}
                onChange={(e) => setUploadJson(e.target.value)}
                placeholder='[ { "task_id": "TASK-001", "step": 1, "agent": "Planner", "input": "...", "output": "...", "status": "failed", "error_type": "missing_information", "parent_step": null } ]'
                className="w-full h-64 bg-slate-50 border border-slate-300 rounded-2xl p-3 text-xs font-mono text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500/50 shadow-inner"
              />
              {uploadError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs font-mono text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{uploadError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={onClose}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  icon={<Upload className="w-4 h-4" />}
                  onClick={handleAnalyzeUpload}
                  isLoading={isAnalyzing}
                  disabled={!uploadJson.trim()}
                >
                  Analyze Trace
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
