/**
 * F252 Story Player — Core Types
 *
 * ReplayEvent is the normalized event type consumed by the Replay Engine.
 * TranscriptEvents (from events.jsonl / session API) are adapted into
 * ReplayEvents by the adapter before replay.
 */

// ---------------------------------------------------------------------------
// ReplayEvent — the universal replay unit
// ---------------------------------------------------------------------------

export type ReplayEventType =
  | 'message' // text/assistant/user/system → unified message
  | 'tool_call' // tool_use + matched tool_result
  | 'system' // session_init, done, error, etc.
  | 'thinking'; // thinking/reasoning content

export interface ReplayEvent {
  /** Monotonic index within the replay sequence */
  index: number;
  /** Event type after normalization */
  type: ReplayEventType;
  /** Original timestamp (epoch ms) */
  timestamp: number;
  /** Role: assistant / user / system */
  role: string;
  /** Text content */
  content: string;
  /** Invocation grouping */
  invocationId?: string;
  /** Tool name (normalized from toolName/name dual form) */
  toolName?: string;
  /** Tool input/arguments (stringified or structured) */
  toolInput?: string;
  /** Tool result content */
  toolResult?: string;
  /** Whether tool call errored */
  toolIsError?: boolean;
  /** Cat ID (actor) */
  catId?: string;
  /** Original eventNo for seek */
  eventNo: number;
  /** Original idle gap (ms) before this event that was auto-skipped (AC-B1) */
  idleSkipMs?: number;
  /** Whether this is a pass-ball event — @mention / cross_post (AC-B1) */
  isPassBall?: boolean;
}

// ---------------------------------------------------------------------------
// Replay Engine state
// ---------------------------------------------------------------------------

export type PlaybackState = 'idle' | 'playing' | 'paused' | 'ended';

export type SpeedMultiplier = 1 | 10 | 50 | 100 | 'max';

export interface ReplayEngineState {
  /** Current playback state */
  state: PlaybackState;
  /** Speed multiplier */
  speed: SpeedMultiplier;
  /** Index of the current event being displayed */
  currentIndex: number;
  /** Total number of events */
  totalEvents: number;
  /** Elapsed playback time in ms */
  elapsedMs: number;
  /** Total original duration in ms */
  totalDurationMs: number;
  /** Display mode */
  displayMode: 'cinematic' | 'faithful';
  /** Whether adaptive pacing is active (AC-B1) */
  adaptivePacing: boolean;
}

// ---------------------------------------------------------------------------
// Adapter input (matches TranscriptEvent from API)
// ---------------------------------------------------------------------------

export interface RawTranscriptEvent {
  v: number;
  t: number;
  threadId: string;
  catId: string;
  sessionId: string;
  cliSessionId: string;
  invocationId?: string;
  eventNo: number;
  event: Record<string, unknown>;
}
