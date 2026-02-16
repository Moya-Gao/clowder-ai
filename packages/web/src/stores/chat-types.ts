/** Content block types matching backend MessageContent */
export interface TextContent {
  type: 'text';
  text: string;
}

export interface ImageContent {
  type: 'image';
  url: string;
}

export type MessageContent = TextContent | ImageContent;

/** F8: Token usage data from CLI invocations.
 *  inputTokens = TOTAL input (normalised across providers).
 *  cacheReadTokens = subset of inputTokens served from cache. */
export interface TokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
  costUsd?: number;
  durationMs?: number;
  durationApiMs?: number;
  numTurns?: number;
  /** F24: context window capacity (exact when provided by backend) */
  contextWindowSize?: number;
  /** F24: most recent context usage snapshot (Codex session token_count) */
  contextUsedTokens?: number;
  /** F24: reset timestamp (epoch ms) for context quota hint */
  contextResetsAtMs?: number;
}

export interface ChatMessageMetadata {
  provider: string;
  model: string;
  sessionId?: string;
  usage?: TokenUsage;
}

export interface EvidenceResultData {
  title: string;
  anchor: string;
  snippet: string;
  confidence: 'high' | 'mid' | 'low';
  sourceType: 'decision' | 'phase' | 'discussion' | 'commit';
}

export interface EvidenceData {
  results: EvidenceResultData[];
  degraded: boolean;
  degradeReason?: string;
}

export interface ToolEvent {
  id: string;
  type: 'tool_use' | 'tool_result';
  label: string;
  detail?: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant' | 'system' | 'summary';
  /** Visual variant for system messages */
  variant?: 'error' | 'info' | 'tool' | 'evidence' | 'a2a_followup';
  catId?: string;
  content: string;
  contentBlocks?: MessageContent[];
  toolEvents?: ToolEvent[];
  metadata?: ChatMessageMetadata;
  timestamp: number;
  isStreaming?: boolean;
  summary?: {
    id: string;
    topic: string;
    conclusions: string[];
    openQuestions: string[];
    createdBy: string;
  };
  evidence?: EvidenceData;
  /** A2A chain group ID — messages in the same A2A chain share this ID */
  a2aGroupId?: string;
}

export interface Thread {
  id: string;
  projectPath: string;
  title: string | null;
  createdBy: string;
  participants: string[];
  lastActiveAt: number;
  createdAt: number;
  pinned?: boolean;
  pinnedAt?: number | null;
  favorited?: boolean;
  favoritedAt?: number | null;
}

/** F24: Context health data from backend */
export interface ContextHealthData {
  usedTokens: number;
  windowTokens: number;
  fillRatio: number;
  source: 'exact' | 'approx';
  measuredAt: number;
}

/** F26: Individual task item in a cat's execution plan */
export interface TaskProgressItem {
  id: string;
  subject: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm?: string;
}

/** F26: Task progress state for a cat's current invocation */
export interface TaskProgressState {
  tasks: TaskProgressItem[];
  lastUpdate: number;
  /** Codex reasoning fallback (no structured tasks) */
  reasoningHint?: string;
}

export interface CatInvocationInfo {
  sessionId?: string;
  invocationId?: string;
  durationMs?: number;
  startedAt?: number;
  usage?: TokenUsage;
  /** F24: Latest context health snapshot */
  contextHealth?: ContextHealthData;
  /** F24 Phase B: Session chain sequence number (0-based) */
  sessionSeq?: number;
  /** F24 Phase B: Whether the session was just sealed (triggers UI indicator) */
  sessionSealed?: boolean;
  /** F26: Real-time task progress from cat's tool usage */
  taskProgress?: TaskProgressState;
}

export type CatStatusType = 'pending' | 'streaming' | 'done' | 'error';

export type ModeState = {
  name: string;
  config: Record<string, unknown>;
  startedAt: string;
  state?: Record<string, unknown>;
};

export type ModeSwitchProposal = {
  proposedMode: string;
  command: string;
  proposedBy: string;
  threadId: string;
};

/** Per-thread state — everything that varies by thread */
export interface ThreadState {
  messages: ChatMessage[];
  isLoading: boolean;
  isLoadingHistory: boolean;
  hasMore: boolean;
  /** Whether the thread has an active invocation (broader than isLoading — stays true during A2A chains) */
  hasActiveInvocation: boolean;
  intentMode: 'execute' | 'ideate' | null;
  targetCats: string[];
  catStatuses: Record<string, CatStatusType>;
  catInvocations: Record<string, CatInvocationInfo>;
  currentMode: ModeState | null;
  pendingModeSwitchProposal: ModeSwitchProposal | null;
  unreadCount: number;
  lastActivity: number;
}

export const DEFAULT_THREAD_STATE: ThreadState = {
  messages: [],
  isLoading: false,
  isLoadingHistory: false,
  hasMore: true,
  hasActiveInvocation: false,
  intentMode: null,
  targetCats: [],
  catStatuses: {},
  catInvocations: {},
  currentMode: null,
  pendingModeSwitchProposal: null,
  unreadCount: 0,
  lastActivity: 0,
};
