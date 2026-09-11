import React, { useCallback, useRef, useState } from 'react';
import { UploadCloud, FileText, Image as ImageIcon, X, AlertCircle, Check, Loader2 } from 'lucide-react';
import { EvidenceSource, FILE_ACCEPT, SOURCE_TYPE_LABEL } from '../../lib/evidence/types';

interface EvidenceUploaderProps {
  sources: EvidenceSource[];
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  disabled?: boolean;
}

const badgeTone: Record<string, string> = {
  PDF: 'bg-rose-50 text-rose-700 border-rose-200',
  IMAGE: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  JSON: 'bg-violet-50 text-violet-700 border-violet-200',
  TRACE: 'bg-violet-100 text-violet-800 border-violet-300',
  LOG: 'bg-slate-100 text-slate-700 border-slate-300',
  CSV: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  DOCX: 'bg-sky-50 text-sky-700 border-sky-200',
  TEXT: 'bg-slate-100 text-slate-700 border-slate-300',
};

export const EvidenceUploader: React.FC<EvidenceUploaderProps> = ({
  sources,
  onAddFiles,
  onRemove,
  disabled = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      onAddFiles(Array.from(fileList));
    },
    [onAddFiles],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (disabled) return;
      handleFiles(e.dataTransfer.files);
    },
    [disabled, handleFiles],
  );

  const extractingCount = sources.filter((s) => s.status === 'extracting').length;
  const readyCount = sources.filter((s) => s.status === 'ready').length;

  return (
    <div className="mt-3">
      {/* Dropzone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && !disabled) {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`w-full rounded-xl border border-dashed px-4 py-4 text-center transition-all cursor-pointer select-none ${
          isDragging
            ? 'border-violet-400 bg-violet-50/70'
            : 'border-slate-300 bg-slate-50/60 hover:border-violet-300 hover:bg-slate-50'
        } ${disabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        <div className="flex items-center justify-center gap-2 text-slate-600">
          <UploadCloud className="w-4 h-4 text-violet-500" />
          <span className="text-xs font-mono font-semibold text-slate-700">
            Drop evidence here or click to upload
          </span>
        </div>
        <div className="mt-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
          PDF • IMAGE • JSON • LOG • CSV • DOCX
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={FILE_ACCEPT}
          className="hidden"
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {/* Status line */}
      {sources.length > 0 && (
        <div className="mt-2.5 flex items-center justify-between text-[11px] font-mono">
          <span className="font-bold uppercase tracking-wider text-slate-700">
            Evidence Sources: {sources.length}
          </span>
          <span className="text-slate-400">
            {extractingCount > 0
              ? 'Extracting evidence...'
              : readyCount > 0
                ? 'Evidence extracted'
                : 'Evidence attached'}
          </span>
        </div>
      )}

      {/* Chips / cards */}
      {sources.length > 0 && (
        <ul className="mt-2 space-y-2">
          {sources.map((s) => {
            const isStructured = Boolean(s.structuredTrace && s.structuredTrace.length > 0);
            const label = isStructured ? 'TRACE' : SOURCE_TYPE_LABEL[s.sourceType];
            const isImageNoOcr =
              s.sourceType === 'image' && s.status === 'ready' && !s.ocrAvailable;
            return (
              <li
                key={s.id}
                className={`rounded-xl border px-3 py-2 flex items-start justify-between gap-3 shadow-sm ${
                  s.status === 'error'
                    ? 'bg-rose-50/70 border-rose-200'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span
                    className={`mt-0.5 shrink-0 px-1.5 py-0.5 rounded border text-[9.5px] font-mono font-extrabold tracking-wider ${
                      badgeTone[label] || badgeTone.TEXT
                    }`}
                  >
                    {label}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {s.sourceType === 'image' ? (
                        <ImageIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      )}
                      <span className="text-xs font-mono font-semibold text-slate-800 truncate">
                        {s.fileName}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[10.5px] font-mono text-slate-500 flex items-center gap-1.5">
                      {s.status === 'extracting' && (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin text-violet-500" />
                          <span>Extracting evidence...</span>
                        </>
                      )}
                      {s.status === 'error' && (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-500" />
                          <span className="text-rose-600">{s.error}</span>
                        </>
                      )}
                      {s.status === 'ready' && isImageNoOcr && (
                        <span className="text-amber-600">
                          Image evidence attached, but OCR is unavailable.
                        </span>
                      )}
                      {s.status === 'ready' && !isImageNoOcr && (
                        <>
                          <Check className="w-3 h-3 text-emerald-500" />
                          <span>
                            {isStructured
                              ? `Validated 8-field execution trace (${s.structuredTrace?.length} steps)`
                              : `${s.metadata.characterCount.toLocaleString()} characters${s.metadata.truncated ? ' (truncated)' : ''}`}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(s.id)}
                  className="shrink-0 flex items-center gap-1 text-[10.5px] font-mono font-semibold text-slate-400 hover:text-rose-600 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
