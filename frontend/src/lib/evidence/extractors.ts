/**
 * Browser-only evidence extraction.
 *
 * Every uploaded file is treated as UNTRUSTED DATA:
 *  - nothing is executed (no eval, no script/JS from PDFs, no code from any file)
 *  - values are only ever read as strings / parsed data structures
 *  - no file contents are rendered as HTML
 *  - no local filesystem paths are surfaced
 *
 * Heavy parsers (pdf.js, mammoth) are loaded lazily via dynamic import() so they
 * never touch the main bundle or the landing page.
 */

import {
  EvidenceSource,
  EvidenceSourceType,
  MAX_EXTRACTED_CHARS,
  MAX_FILE_BYTES,
} from './types';

/* ------------------------------------------------------------------ helpers */

export function makeSourceId(file: File): string {
  return `${file.name}::${file.size}`;
}

export function detectSourceType(file: File): EvidenceSourceType | null {
  const name = file.name.toLowerCase();
  const ext = name.slice(name.lastIndexOf('.'));
  switch (ext) {
    case '.pdf':
      return 'pdf';
    case '.docx':
      return 'docx';
    case '.json':
      return 'json';
    case '.csv':
      return 'csv';
    case '.log':
    case '.txt':
      return 'log';
    case '.png':
    case '.jpg':
    case '.jpeg':
    case '.webp':
      return 'image';
    default:
      if (file.type.startsWith('image/')) return 'image';
      if (file.type === 'application/pdf') return 'pdf';
      if (file.type === 'application/json') return 'json';
      if (file.type === 'text/csv') return 'csv';
      if (file.type === 'text/plain') return 'log';
      return null;
  }
}

function clip(text: string): { text: string; truncated: boolean } {
  if (text.length <= MAX_EXTRACTED_CHARS) return { text, truncated: false };
  return {
    text:
      text.slice(0, MAX_EXTRACTED_CHARS) +
      `\n\n[... evidence truncated at ${MAX_EXTRACTED_CHARS.toLocaleString()} characters ...]`,
    truncated: true,
  };
}

function baseSource(file: File, sourceType: EvidenceSourceType): EvidenceSource {
  return {
    id: makeSourceId(file),
    sourceType,
    fileName: file.name,
    extractedText: '',
    status: 'ready',
    metadata: {
      size: file.size,
      type: file.type || 'unknown',
      characterCount: 0,
      truncated: false,
    },
  };
}

function finalize(src: EvidenceSource, rawText: string): EvidenceSource {
  const { text, truncated } = clip(rawText);
  src.extractedText = text;
  src.metadata.characterCount = text.length;
  src.metadata.truncated = truncated;
  src.status = 'ready';
  return src;
}

function errored(src: EvidenceSource, message: string): EvidenceSource {
  src.status = 'error';
  src.error = message;
  src.extractedText = '';
  src.metadata.characterCount = 0;
  return src;
}

/* -------------------------------------------------------------- type parsers */

async function extractTextLike(file: File): Promise<string> {
  // .log / .txt — preserve content verbatim (timestamps, agent/event lines).
  return await file.text();
}

const REQUIRED_TRACE_FIELDS = [
  'task_id',
  'step',
  'agent',
  'input',
  'output',
  'status',
  'error_type',
  'parent_step',
] as const;

export function extractValidTraceArray(parsed: unknown): any[] | null {
  if (!parsed || typeof parsed !== 'object') return null;
  const list = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as any).trace)
      ? (parsed as any).trace
      : [parsed];

  if (!Array.isArray(list) || list.length === 0) {
    return null;
  }

  for (const item of list) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      return null;
    }
    for (const field of REQUIRED_TRACE_FIELDS) {
      if (!(field in item)) {
        return null;
      }
    }
  }

  return list;
}

function jsonToEvidence(value: unknown, filename: string): string {
  // Preserve the original structure; present it readably without losing fields.
  let pretty: string;
  try {
    pretty = JSON.stringify(value, null, 2);
  } catch {
    pretty = String(value);
  }

  const lines: string[] = [`Parsed JSON evidence from "${filename}".`];

  // If it looks like an execution trace / event list, add a compact readable
  // summary alongside the full structure (does not replace it).
  const events = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as any).trace)
      ? (value as any).trace
      : value && typeof value === 'object' && Array.isArray((value as any).events)
        ? (value as any).events
        : null;

  if (events && events.length && typeof events[0] === 'object') {
    lines.push('', 'Structured events:');
    events.slice(0, 200).forEach((ev: any, i: number) => {
      const step = ev.step ?? ev.index ?? i + 1;
      const agent = ev.agent ?? ev.node ?? ev.name ?? 'unknown';
      const status = ev.status ?? ev.result ?? '';
      const ts = ev.timestamp ?? ev.time ?? ev.ts ?? '';
      const note = ev.error_type ?? ev.error ?? ev.reason ?? ev.message ?? '';
      lines.push(
        `  - step ${step} | ${agent}` +
          (status ? ` | ${status}` : '') +
          (ts ? ` | ${ts}` : '') +
          (note ? ` | ${String(note).slice(0, 200)}` : ''),
      );
    });
    if (events.length > 200) lines.push(`  ... ${events.length - 200} more events`);
  }

  lines.push('', 'Full JSON structure:', pretty);
  return lines.join('\n');
}

// Minimal RFC-4180-ish CSV parser (handles quoted fields, embedded commas,
// escaped quotes and newlines inside quotes). No dependency.
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (inQuotes) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\r') {
      // ignore; handled by \n
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ''));
}

function csvToEvidence(text: string, filename: string): string {
  const rows = parseCsv(text);
  if (!rows.length) throw new Error('empty');
  const headers = rows[0].map((h) => h.trim());
  const dataRows = rows.slice(1);
  const lines: string[] = [
    `Parsed CSV telemetry from "${filename}" — ${dataRows.length} row(s), ${headers.length} column(s).`,
    `Columns: ${headers.join(', ')}`,
    '',
    'Rows:',
  ];
  dataRows.slice(0, 500).forEach((r, idx) => {
    const pairs = headers
      .map((h, ci) => `${h}=${(r[ci] ?? '').trim()}`)
      .join(', ');
    lines.push(`  [${idx + 1}] ${pairs}`);
  });
  if (dataRows.length > 500) lines.push(`  ... ${dataRows.length - 500} more rows`);
  return lines.join('\n');
}

async function extractPdf(file: File): Promise<string> {
  const pdfjsLib: any = await import('pdfjs-dist');
  // Bundled worker (kept in the lazy chunk, never the main bundle).
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjsLib.getDocument({
    data,
    isEvalSupported: false, // never eval content from the PDF
    disableFontFace: true,
    disableAutoFetch: true,
  }).promise;

  const parts: string[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((it: any) => (typeof it.str === 'string' ? it.str : ''))
      .join(' ')
      .replace(/[ \t]+\n/g, '\n')
      .trim();
    if (pageText) parts.push(`--- page ${p} ---\n${pageText}`);
    page.cleanup();
  }
  await doc.destroy();

  const out = parts.join('\n\n').trim();
  if (!out) throw new Error('no-text');
  return out;
}

async function extractDocx(file: File): Promise<string> {
  const mammoth: any = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
  const out = String(result?.value ?? '').trim();
  if (!out) throw new Error('no-text');
  return out;
}

/* ----------------------------------------------------------------- dispatch */

export async function extractEvidence(file: File): Promise<EvidenceSource> {
  const sourceType = detectSourceType(file);
  if (!sourceType) {
    const src = baseSource(file, 'text');
    return errored(src, 'Unsupported file type.');
  }

  const src = baseSource(file, sourceType);

  if (file.size > MAX_FILE_BYTES) {
    return errored(src, 'File exceeds the 10 MB limit.');
  }
  if (file.size === 0) {
    return errored(src, 'File is empty.');
  }

  try {
    switch (sourceType) {
      case 'pdf': {
        try {
          return finalize(src, await extractPdf(file));
        } catch {
          return errored(src, 'Could not extract text from this PDF.');
        }
      }
      case 'docx': {
        try {
          return finalize(src, await extractDocx(file));
        } catch {
          return errored(src, 'Could not extract text from this DOCX.');
        }
      }
      case 'json': {
        let parsed: unknown;
        try {
          parsed = JSON.parse(await file.text());
        } catch {
          return errored(src, 'Could not parse this JSON.');
        }
        const validTrace = extractValidTraceArray(parsed);
        if (validTrace) {
          src.structuredTrace = validTrace;
        }
        return finalize(src, jsonToEvidence(parsed, file.name));
      }
      case 'csv': {
        try {
          return finalize(src, csvToEvidence(await file.text(), file.name));
        } catch {
          return errored(src, 'Could not read this CSV.');
        }
      }
      case 'log': {
        try {
          return finalize(src, await extractTextLike(file));
        } catch {
          return errored(src, 'Could not read this file.');
        }
      }
      case 'image': {
        // No OCR ships with this project. Be honest: attach the reference,
        // do not pretend visual extraction occurred.
        src.ocrAvailable = false;
        src.status = 'ready';
        src.extractedText = '';
        src.metadata.characterCount = 0;
        src.error = undefined;
        return src;
      }
      default:
        return errored(src, 'Unsupported file type.');
    }
  } catch {
    return errored(src, 'Could not process this file.');
  }
}
