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
