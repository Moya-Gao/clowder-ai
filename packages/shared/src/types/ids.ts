/**
 * Branded Types for type-safe IDs
 * 使用 branded types 确保不同类型的 ID 不会混用
 */

// Brand symbol for type safety
declare const brand: unique symbol;

type Brand<T, B> = T & { readonly [brand]: B };

// Branded ID types
export type MessageId = Brand<string, 'MessageId'>;
export type CatId = Brand<'opus' | 'codex' | 'gemini', 'CatId'>;
export type ThreadId = Brand<string, 'ThreadId'>;
export type SessionId = Brand<string, 'SessionId'>;
export type UserId = Brand<string, 'UserId'>;

// Valid cat identifiers
const VALID_CAT_IDS = ['opus', 'codex', 'gemini'] as const;
type ValidCatId = (typeof VALID_CAT_IDS)[number];

/**
 * Generate a random ID with optional prefix
 */
export function generateId(prefix?: string): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
}

/**
 * Create a MessageId from a string
 */
export function createMessageId(id: string): MessageId {
  return id as MessageId;
}

/**
 * Generate a new MessageId
 */
export function generateMessageId(): MessageId {
  return createMessageId(generateId('msg'));
}

/**
 * Create a CatId from a string with validation
 * @throws Error if the id is not a valid cat identifier
 */
export function createCatId(id: string): CatId {
  if (!VALID_CAT_IDS.includes(id as ValidCatId)) {
    throw new Error(
      `Invalid cat ID: "${id}". Must be one of: ${VALID_CAT_IDS.join(', ')}`
    );
  }
  return id as CatId;
}

/**
 * Create a ThreadId from a string
 */
export function createThreadId(id: string): ThreadId {
  return id as ThreadId;
}

/**
 * Generate a new ThreadId
 */
export function generateThreadId(): ThreadId {
  return createThreadId(generateId('thread'));
}

/**
 * Create a SessionId from a string
 */
export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

/**
 * Generate a new SessionId
 */
export function generateSessionId(): SessionId {
  return createSessionId(generateId('session'));
}

/**
 * Create a UserId from a string
 */
export function createUserId(id: string): UserId {
  return id as UserId;
}
