/**
 * F195 Phase B — Audio capture & transcription MCP tools.
 *
 * All tools proxy to the standalone audio-service (Python, default :9877).
 */

import { z } from 'zod';
import type { ToolResult } from './file-tools.js';
import { errorResult, successResult } from './file-tools.js';

const AUDIO_URL = process.env['AUDIO_SERVICE_URL'] ?? 'http://127.0.0.1:9877';

async function audioFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${AUDIO_URL}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string>) },
  });
}

function audioError(err: unknown): string {
  return `Cannot reach audio service at ${AUDIO_URL}: ${err instanceof Error ? err.message : String(err)}`;
}

// ── Schemas ──────────────────────────────────────────────────

export const audioListSourcesInputSchema = {};

export const audioCaptureStartInputSchema = {
  source: z
    .enum(['app', 'mic'])
    .describe('Audio source: "app" for app audio via ScreenCaptureKit, "mic" for microphone'),
  app_name: z
    .string()
    .optional()
    .describe('Target app name — REQUIRED when source="app" (e.g. "Google Chrome", "zoom.us", "腾讯会议")'),
  device: z.number().int().optional().describe('Mic device index for source=mic (omit for default)'),
  chunk_sec: z.number().min(0.5).optional().describe('ASR chunk duration in seconds (default 3.0, min 0.5)'),
};

export const audioCaptureStopInputSchema = {};

export const audioCaptureStatusInputSchema = {};

export const audioReadTranscriptInputSchema = {
  from: z.number().optional().describe('Start timestamp (unix epoch seconds)'),
  to: z.number().optional().describe('End timestamp (unix epoch seconds)'),
  latest: z.number().int().optional().describe('Return only the latest N lines'),
};

// ── Handlers ─────────────────────────────────────────────────

type SourceInfo = { apps: string[]; mics: Array<{ index: number; name: string; default: boolean }> };

export async function handleAudioListSources(): Promise<ToolResult> {
  try {
    const resp = await audioFetch('/sources');
    if (!resp.ok) return errorResult(`Audio service error: ${resp.status}`);
    const data = (await resp.json()) as SourceInfo;
    const apps = data.apps?.length ? data.apps.join(', ') : '(none detected)';
    const mics = data.mics?.length
      ? data.mics.map((m) => `  [${m.index}] ${m.name}${m.default ? ' (default)' : ''}`).join('\n')
      : '  (none)';
    return successResult(`Available audio sources:\n\nApps:\n  ${apps}\n\nMicrophones:\n${mics}`);
  } catch (err) {
    return errorResult(audioError(err));
  }
}

type StartInput = { source: 'app' | 'mic'; app_name?: string; device?: number; chunk_sec?: number };

export async function handleAudioCaptureStart(input: StartInput): Promise<ToolResult> {
  try {
    const resp = await audioFetch('/start', { method: 'POST', body: JSON.stringify(input) });
    const data = (await resp.json()) as {
      ok?: boolean;
      error?: string;
      status?: { source: string; app_name?: string };
    };
    if (!resp.ok) return errorResult(data.error ?? `Start failed: ${resp.status}`);
    const s = data.status;
    const label = s?.app_name ? `${s.source} (${s.app_name})` : s?.source;
    return successResult(`Audio capture started: ${label}. Transcription will appear as chunks are processed.`);
  } catch (err) {
    return errorResult(audioError(err));
  }
}

export async function handleAudioCaptureStop(): Promise<ToolResult> {
  try {
    const resp = await audioFetch('/stop', { method: 'POST' });
    const data = (await resp.json()) as {
      summary?: { chunks?: number; duration_s?: number; avg_asr_latency?: number; error?: string };
    };
    if (!resp.ok) return errorResult(`Stop failed: ${resp.status}`);
    const s = data.summary;
    if (!s || s.error) return successResult(s?.error ?? 'No active session.');
    return successResult(
      `Capture stopped.\n  Chunks: ${s.chunks}\n  Duration: ${s.duration_s}s\n  Avg ASR latency: ${s.avg_asr_latency}s`,
    );
  } catch (err) {
    return errorResult(audioError(err));
  }
}

type StatusResp = {
  running: boolean;
  source?: string;
  app_name?: string;
  duration_s?: number;
  chunk_count?: number;
  avg_asr_latency?: number;
};

export async function handleAudioCaptureStatus(): Promise<ToolResult> {
  try {
    const resp = await audioFetch('/status');
    if (!resp.ok) return errorResult(`Audio service error: ${resp.status}`);
    const s = (await resp.json()) as StatusResp;
    if (!s.running) return successResult('Not currently capturing audio.');
    const label = s.app_name ? `${s.source} (${s.app_name})` : (s.source ?? 'unknown');
    return successResult(
      `Capturing: ${label}\n  Duration: ${s.duration_s}s | Chunks: ${s.chunk_count} | Avg ASR: ${s.avg_asr_latency}s`,
    );
  } catch (err) {
    return errorResult(audioError(err));
  }
}

type TranscriptLine = { ts: number; elapsed_s: number; chunk_num: number; asr_latency: number; text: string };

export async function handleAudioReadTranscript(input: {
  from?: number;
  to?: number;
  latest?: number;
}): Promise<ToolResult> {
  try {
    const params = new URLSearchParams();
    if (input.from != null) params.set('from', String(input.from));
    if (input.to != null) params.set('to', String(input.to));
    if (input.latest != null) params.set('latest', String(input.latest));
    const qs = params.toString();
    const resp = await audioFetch(`/transcript${qs ? `?${qs}` : ''}`);
    if (!resp.ok) return errorResult(`Audio service error: ${resp.status}`);
    const data = (await resp.json()) as { lines: TranscriptLine[] };
    const lines = data.lines ?? [];
    if (lines.length === 0) return successResult('No transcript lines available.');
    const text = lines
      .map((l) => {
        const t = new Date(l.ts * 1000).toLocaleTimeString('zh-CN', { hour12: false });
        return `[${t}] ${l.text}`;
      })
      .join('\n');
    return successResult(`${lines.length} transcript lines:\n\n${text}`);
  } catch (err) {
    return errorResult(audioError(err));
  }
}

// ── Tool Definitions ─────────────────────────────────────────

export const audioTools = [
  {
    name: 'cat_cafe_audio_list_sources',
    description:
      'List available audio capture sources: running applications (for per-app ScreenCaptureKit capture) and microphone devices.',
    inputSchema: audioListSourcesInputSchema,
    handler: handleAudioListSources,
  },
  {
    name: 'cat_cafe_audio_capture_start',
    description:
      'Start real-time audio capture and transcription. source="app" captures a specific application\'s audio via ScreenCaptureKit (requires app_name). source="mic" captures from the system microphone. Audio is automatically chunked and transcribed via ASR.',
    inputSchema: audioCaptureStartInputSchema,
    handler: handleAudioCaptureStart,
  },
  {
    name: 'cat_cafe_audio_capture_stop',
    description:
      'Stop the current audio capture session. Returns a summary with chunk count, duration, and average ASR latency.',
    inputSchema: audioCaptureStopInputSchema,
    handler: handleAudioCaptureStop,
  },
  {
    name: 'cat_cafe_audio_capture_status',
    description: 'Check current audio capture status: whether capturing, source type, duration, and chunk count.',
    inputSchema: audioCaptureStatusInputSchema,
    handler: handleAudioCaptureStatus,
  },
  {
    name: 'cat_cafe_audio_read_transcript',
    description:
      'Read transcript lines from the current or most recent audio capture session. Use "latest" to get the N most recent lines, or "from"/"to" unix timestamps to filter by time range.',
    inputSchema: audioReadTranscriptInputSchema,
    handler: handleAudioReadTranscript,
  },
] as const;
