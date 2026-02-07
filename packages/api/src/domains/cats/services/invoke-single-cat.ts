/**
 * Single Cat Invocation
 * 单猫调用的核心逻辑，从 AgentRouter 提取。
 *
 * 处理: credentials 创建、session 获取、workingDirectory 解析、
 *       CLI 调用、消息 yield、错误处理。
 *
 * 不处理: system prompt 构建（由调用方负责 prepend）、
 *         消息存储（由调用方在 yield 后累积并存储）。
 */

import type { CatId, MessageContent } from '@cat-cafe/shared';
import { isUnderAllowedRoot } from '../../../utils/project-path.js';
import type { SessionManager } from './SessionManager.js';
import type { InvocationRegistry } from './InvocationRegistry.js';
import type { IThreadStore } from './ThreadStore.js';
import type { AgentMessage, AgentService, AgentServiceOptions } from './types.js';

/**
 * Shared dependencies for all cat invocations within one AgentRouter
 */
export interface InvocationDeps {
  readonly registry: InvocationRegistry;
  readonly sessionManager: SessionManager;
  readonly threadStore: IThreadStore | null;
  readonly apiUrl: string;
}

/**
 * Per-invocation parameters
 */
export interface InvocationParams {
  readonly catId: CatId;
  readonly service: AgentService;
  /** The fully-orchestrated prompt (system prompt + chain context already prepended by caller) */
  readonly prompt: string;
  readonly userId: string;
  readonly threadId: string;
  readonly contentBlocks?: readonly MessageContent[];
  readonly uploadDir?: string;
  readonly signal?: AbortSignal;
  readonly isLastCat: boolean;
}

/**
 * Invoke a single cat agent and yield messages.
 *
 * The caller is responsible for:
 * - Building and prepending the system prompt to params.prompt
 * - Accumulating text/metadata from yielded messages
 * - Storing the final response in messageStore
 */
export async function* invokeSingleCat(
  deps: InvocationDeps,
  params: InvocationParams,
): AsyncIterable<AgentMessage> {
  const { registry, sessionManager, threadStore, apiUrl } = deps;
  const { catId, service, prompt, userId, threadId, isLastCat, signal } = params;

  const { invocationId, callbackToken } = registry.create(userId, catId, threadId);
  const callbackEnv: Record<string, string> = {
    CAT_CAFE_API_URL: apiUrl,
    CAT_CAFE_INVOCATION_ID: invocationId,
    CAT_CAFE_CALLBACK_TOKEN: callbackToken,
  };

  try {
    let sessionId: string | undefined;
    try {
      sessionId = await sessionManager.get(userId, catId);
    } catch {
      // Redis read failure — continue without session
    }

    // Resolve workingDirectory from thread's projectPath
    let workingDirectory: string | undefined;
    if (threadStore) {
      const thread = await threadStore.get(threadId);
      if (thread?.projectPath && thread.projectPath !== 'default') {
        if (isUnderAllowedRoot(thread.projectPath)) {
          workingDirectory = thread.projectPath;
        }
      }
    }

    const options: AgentServiceOptions = {
      ...(sessionId ? { sessionId } : {}),
      callbackEnv,
      ...(workingDirectory ? { workingDirectory } : {}),
      ...(params.contentBlocks ? { contentBlocks: params.contentBlocks } : {}),
      ...(params.uploadDir ? { uploadDir: params.uploadDir } : {}),
      ...(signal ? { signal } : {}),
    };

    for await (const msg of service.invoke(prompt, options)) {
      if (msg.type === 'session_init' && msg.sessionId) {
        try {
          await sessionManager.store(userId, catId, msg.sessionId);
        } catch {
          // Redis write failure — session won't persist, but chain continues
        }
      }

      if (msg.type === 'done') {
        yield { ...msg, isFinal: isLastCat };
      } else {
        yield msg;
      }
    }
  } catch (err) {
    yield {
      type: 'error' as const,
      catId,
      error: err instanceof Error ? err.message : String(err),
      timestamp: Date.now(),
    };
    yield { type: 'done' as const, catId, isFinal: isLastCat, timestamp: Date.now() };
  }
}
