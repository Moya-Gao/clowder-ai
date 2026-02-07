/**
 * Types Index
 * 导出所有类型定义
 */

// ID types
export type {
  MessageId,
  CatId,
  ThreadId,
  SessionId,
  UserId,
} from './ids.js';

export {
  generateId,
  createMessageId,
  generateMessageId,
  createCatId,
  createThreadId,
  generateThreadId,
  createSessionId,
  generateSessionId,
  createUserId,
} from './ids.js';

// Cat types
export type {
  CatProvider,
  CatStatus,
  CatColor,
  CatConfig,
  CatState,
} from './cat.js';

export {
  CAT_CONFIGS,
  findCatByMention,
  getAllCatIds,
} from './cat.js';

// Cat breed/variant types (Breed+Variant two-layer schema)
export type {
  ContextBudget,
  CliConfig,
  CatVariant,
  CatBreed,
  CatCafeConfig,
} from './cat-breed.js';

// Message types
export type {
  MessageSender,
  TextContent,
  ImageContent,
  CodeContent,
  ToolCallContent,
  ToolResultContent,
  MessageContent,
  MessageStatus,
  Message,
  AgentStreamMessage,
} from './message.js';

export {
  createUserMessage,
  createCatMessage,
} from './message.js';

// Task types (毛线球)
export type {
  TaskStatus,
  TaskItem,
  CreateTaskInput,
  UpdateTaskInput,
} from './task.js';

// Summary types (拍立得照片墙)
export type {
  ThreadSummary,
  CreateSummaryInput,
} from './summary.js';

// Memory types (F3-lite 显式记忆)
export type {
  MemoryEntry,
  MemoryInput,
} from './memory.js';
