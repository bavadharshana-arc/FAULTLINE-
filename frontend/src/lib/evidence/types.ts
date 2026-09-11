/**
 * Normalized incident-evidence model.
 *
 * Uploaded files are EVIDENCE SOURCES only. They are extracted to text/structured
 * text entirely in the browser and handed to the existing FAULTLINE analysis
 * pipeline as additional context. Extraction never determines the root cause —
 * the forensic engine does that from execution telemetry.
 */

export type EvidenceSourceType =
  | 'text'
  | 'pdf'
  | 'image'
  | 'json'
  | 'log'
  | 'csv'
  | 'docx';

export type EvidenceStatus = 'extracting' | 'ready' | 'error';

export interface EvidenceSource {
  /** Stable client id (name + size). Also used to de-duplicate. */
  id: string;
  sourceType: EvidenceSourceType;
  fileName: string;
  /** Normalized, plain-text / readable-structured evidence. Never HTML. */
  extractedText: string;
  status: EvidenceStatus;
  /** Present when status === 'error'. */
  error?: string;
  /** Present when the uploaded JSON is a validated 8-field execution trace. */
  structuredTrace?: any[];
  /**
   * Images only: whether visual (OCR) extraction actually happened.
   * This project ships no OCR, so this is always false for images and the
   * UI is explicit that visual extraction is unavailable.
   */
  ocrAvailable?: boolean;
  metadata: {
    size: number;
    /** Best-effort MIME type. */
    type: string;
    characterCount: number;
    /** True when extractedText was clipped because the source was very large. */
    truncated?: boolean;
  };
}

/** Per-file hard limit. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

/** Cap on extracted text kept per source (defensive — keeps the prompt sane). */
export const MAX_EXTRACTED_CHARS = 200_000;

/** Cap on the whole combined evidence context handed to the pipeline. */
export const MAX_CONTEXT_CHARS = 24_000;

export const SUPPORTED_EXTENSIONS = [
  '.pdf',
  '.json',
  '.log',
  '.txt',
  '.csv',
  '.docx',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
] as const;

/** `accept` attribute for the hidden file input. */
export const FILE_ACCEPT =
  SUPPORTED_EXTENSIONS.join(',') +
  ',application/pdf,application/json,text/plain,text/csv,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'image/png,image/jpeg,image/webp';

export const SOURCE_TYPE_LABEL: Record<EvidenceSourceType, string> = {
  text: 'TEXT',
  pdf: 'PDF',
  image: 'IMAGE',
  json: 'JSON',
  log: 'LOG',
  csv: 'CSV',
  docx: 'DOCX',
};
