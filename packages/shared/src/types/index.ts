/**
 * Types Index
 * 导出所有类型定义
 */

// Capability types (F041 统一能力模型)
export type {
  CapabilitiesConfig,
  CapabilityBoardItem,
  CapabilityBoardResponse,
  CapabilityEntry,
  CapabilityPatchRequest,
  CatCapabilityOverride,
  CatFamily,
  McpServerDescriptor,
  McpToolInfo,
  SkillHealthSummary,
} from './capability.js';
// Authorization types (猫猫授权系统)
export type {
  AuthorizationAuditEntry,
  AuthorizationRequestEvent,
  AuthorizationRespondEvent,
  AuthorizationRule,
  PendingRequestRecord,
  PermissionRequest,
  PermissionResponse,
  PermissionStatusResponse,
  RespondScope,
} from './authorization.js';
// Connector types (F97 外部信息源抽象)
export type {
  ConnectorDefinition,
  ConnectorSource,
} from './connector.js';
export {
  getAllConnectorDefinitions,
  getConnectorDefinition,
} from './connector.js';
// Cat types
export type {
  CatColor,
  CatConfig,
  CatProvider,
  CatState,
  CatStatus,
} from './cat.js';
export {
  CAT_CONFIGS,
  findCatByMention,
  getAllCatIds,
} from './cat.js';
// Cat breed/variant types (Breed+Variant two-layer schema)
export type {
  CatBreed,
  CatCafeConfig,
  CatCafeConfigV1,
  CatCafeConfigV2,
  CatFeatures,
  CatVariant,
  CliConfig,
  ContextBudget,
  MissionHubSelfClaimScope,
  // F032: Roster types for collaboration rules
  ReviewPolicy,
  Roster,
  RosterEntry,
} from './cat-breed.js';
// Deliberate types (4-E 两轮制 - 类型预埋)
export type {
  DeliberateEvent,
  DeliberatePhase,
  DeliberateSession,
  DeliberateTransition,
} from './deliberate.js';
// ID types
export type {
  CatId,
  MessageId,
  SessionId,
  ThreadId,
  UserId,
} from './ids.js';
export {
  createCatId,
  createMessageId,
  createSessionId,
  createThreadId,
  createUserId,
  generateId,
  generateMessageId,
  generateSessionId,
  generateThreadId,
} from './ids.js';
// Memory types (F3-lite 显式记忆)
export type {
  MemoryEntry,
  MemoryInput,
} from './memory.js';
// Message types
export type {
  AgentStreamMessage,
  CodeContent,
  ImageContent,
  Message,
  MessageContent,
  MessageSender,
  MessageStatus,
  TextContent,
  ToolCallContent,
  ToolResultContent,
} from './message.js';
export {
  createCatMessage,
  createUserMessage,
} from './message.js';
// Mode types (F11 模式系统)
export type {
  BrainstormConfig,
  BrainstormState,
  DebateConfig,
  DebateState,
  DevLoopConfig,
  DevLoopState,
  ModeConfig,
  ModeName,
  ModeState,
  ThreadMode,
  ThreadModeRecord,
} from './modes.js';
export {
  isBrainstormConfig,
  isBrainstormState,
  isDebateConfig,
  isDebateState,
  isDevLoopConfig,
  isDevLoopState,
} from './modes.js';
// Rich block types (F22 Rich Blocks 富消息系统)
export type {
  RichAudioBlock,
  RichBlock,
  RichBlockBase,
  RichBlockKind,
  RichCardBlock,
  RichChecklistBlock,
  RichDiffBlock,
  RichMediaGalleryBlock,
  RichMessageExtra,
} from './rich.js';
export { normalizeRichBlock } from './rich.js';
// Session chain types (F24 Session Chain + Context Health)
export type {
  ContextHealth,
  ContextHealthConfig,
  SealReason,
  SealResult,
  SessionRecord,
  SessionStatus,
  SessionStrategy,
  SessionStrategyConfig,
  SessionUsageSnapshot,
  StrategyAction,
} from './session.js';
// Signals types (F21 Signal Hunter)
export type {
  SignalArticle,
  SignalArticleStatus,
  SignalCategory,
  SignalFetchMethod,
  SignalKeywordFilter,
  SignalScheduleFrequency,
  SignalSource,
  SignalSourceConfig,
  SignalSourceFetchConfig,
  SignalSourceSchedule,
  SignalTier,
} from './signals.js';
// Summary types (拍立得照片墙)
export type {
  CreateSummaryInput,
  ThreadSummary,
} from './summary.js';
// Backlog types (F049 Mission Control)
export type {
  AcquireBacklogLeaseInput,
  BacklogAuditAction,
  BacklogAuditActor,
  BacklogAuditEntry,
  BacklogClaimSuggestion,
  BacklogItem,
  BacklogLease,
  BacklogLeaseState,
  BacklogPriority,
  BacklogStatus,
  BacklogSuggestionStatus,
  CreateBacklogItemInput,
  DecideBacklogClaimInput,
  DispatchBacklogItemInput,
  HeartbeatBacklogLeaseInput,
  ReclaimBacklogLeaseInput,
  RefreshBacklogItemInput,
  ReleaseBacklogLeaseInput,
  SuggestBacklogClaimInput,
  ThreadPhase,
  BacklogDependencies,
  MarkDoneInput,
  UpdateBacklogDispatchProgressInput,
} from './backlog.js';
// Task types (毛线球)
export type {
  CreateTaskInput,
  TaskItem,
  TaskStatus,
  UpdateTaskInput,
} from './task.js';
// TTS types (F34 TTS Provider)
export type {
  ITtsProvider,
  TtsSynthesizeRequest,
  TtsSynthesizeResult,
  VoiceConfig,
} from './tts.js';
