/**
 * Agent Router
 * 解析 @ 提及，路由到对应的 Agent Service
 *
 * Features:
 * - 有 @ 提及时路由到指定猫 + 更新对话参与者
 * - 无 @ 提及时路由到对话中所有活跃参与者
 * - 无参与者的新对话默认路由到布偶猫 (opus)
 * - 支持中英文提及模式
 * - ideate intent + 多猫 → 并行独立思考 (routeParallel)
 * - execute intent 或单猫 → 串行执行 (routeSerial)
 * - Session 管理委托给 SessionManager
 *
 * IMPORTANT: threadId 约束
 * 所有调用入口（execute, executeWithContext）必须传入正确的 threadId。
 * 跨线程鉴权、消息存储、InvocationTracker 都依赖此参数。
 * 虽然参数可选（兼容测试），但生产代码必须显式传入。
 */

import { CAT_CONFIGS, createCatId, escapeRegExp } from '@cat-cafe/shared';
import type { CatId, MessageContent } from '@cat-cafe/shared';
import type { SessionStore } from '@cat-cafe/shared/utils';
import { DEFAULT_THREAD_ID } from './stores/ports/ThreadStore.js';
import { SessionManager } from './SessionManager.js';
import { DeliveryCursorStore } from './stores/ports/DeliveryCursorStore.js';
import { parseIntent, stripIntentTags } from './IntentParser.js';
import type { IntentResult } from './IntentParser.js';
import { routeSerial, routeParallel } from './route-strategies.js';
import type { RouteStrategyDeps, PersistenceContext } from './route-strategies.js';
import type { InvocationRegistry } from './InvocationRegistry.js';
import type { IMessageStore } from './stores/ports/MessageStore.js';
import type { IThreadStore } from './stores/ports/ThreadStore.js';
import type { AgentMessage, AgentService } from './types.js';
import type { ISessionChainStore } from './stores/ports/SessionChainStore.js';
import type { TranscriptWriter } from './TranscriptWriter.js';
import type { TranscriptReader } from './TranscriptReader.js';
import type { ISessionSealer } from './SessionSealer.js';

/** Parsed mention with position for ordering */
interface ParsedMention {
  catId: CatId;
  position: number;
}

const MENTION_ALIASES = Array.from(
  new Set(
    Object.values(CAT_CONFIGS).flatMap((config) =>
      config.mentionPatterns.map((pattern) => pattern.replace(/^@/, '')),
    ),
  ),
).sort((a, b) => b.length - a.length);

const SPEECH_MENTION_RE = new RegExp(
  [
    '(^|\\s)',
    '(?:at|艾特|@\\s*[。｡\\.．])',
    '\\s*(?:咱的|我的)?\\s*',
    `(${MENTION_ALIASES.map(escapeRegExp).join('|')})`,
    '(?=$|\\s|[，。！？、,.:：;；])',
  ].join(''),
  'gi',
);

function normalizeSpeechMentions(message: string): string {
  return message.replace(SPEECH_MENTION_RE, (_match, prefix: string, mention: string) => `${prefix}@${mention}`);
}

/**
 * Options for AgentRouter constructor
 */
export interface AgentRouterOptions {
  claudeService: AgentService;
  codexService: AgentService;
  geminiService: AgentService;
  registry: InvocationRegistry;
  messageStore: IMessageStore;
  sessionStore?: SessionStore;
  deliveryCursorStore?: DeliveryCursorStore;
  threadStore?: IThreadStore;
  /** F24: Session chain store for context health tracking */
  sessionChainStore?: ISessionChainStore;
  /** F24 Phase C: Transcript writer for event recording */
  transcriptWriter?: TranscriptWriter;
  /** F24 Phase D: Transcript reader for bootstrap injection */
  transcriptReader?: TranscriptReader;
  /** F24 Phase B: Session sealer for auto-seal */
  sessionSealer?: ISessionSealer;
}

/**
 * Router that parses @ mentions and routes to appropriate agent services
 */
export class AgentRouter {
  private services: Record<string, AgentService>;
  private registry: InvocationRegistry;
  private messageStore: IMessageStore;
  private sessionManager: SessionManager;
  private deliveryCursorStore: DeliveryCursorStore;
  private threadStore: IThreadStore | null;
  private sessionChainStore: ISessionChainStore | undefined;
  private transcriptWriter: TranscriptWriter | undefined;
  private transcriptReader: TranscriptReader | undefined;
  private sessionSealer: ISessionSealer | undefined;

  constructor(options: AgentRouterOptions) {
    this.services = {
      opus: options.claudeService,
      codex: options.codexService,
      gemini: options.geminiService,
    };
    this.registry = options.registry;
    this.messageStore = options.messageStore;
    this.sessionManager = new SessionManager(options.sessionStore);
    this.deliveryCursorStore = options.deliveryCursorStore ?? new DeliveryCursorStore(options.sessionStore);
    this.threadStore = options.threadStore ?? null;
    this.sessionChainStore = options.sessionChainStore;
    this.transcriptWriter = options.transcriptWriter;
    this.transcriptReader = options.transcriptReader;
    this.sessionSealer = options.sessionSealer;
  }

  /** Parse message for @ mentions and return ordered list of cat IDs */
  /**
   * Parse @mentions from user message for routing.
   * Uses indexOf (anywhere in text) — different from parseA2AMentions which uses line-start matching.
   * Reason: User intent is clear when they type @猫名 anywhere; cat responses need stricter rules.
  */
  private parseMentions(message: string): CatId[] {
    const lowerMessage = normalizeSpeechMentions(message).toLowerCase();
    const mentions: ParsedMention[] = [];

    for (const config of Object.values(CAT_CONFIGS)) {
      let earliestPosition = -1;
      for (const pattern of config.mentionPatterns) {
        const position = lowerMessage.indexOf(pattern.toLowerCase());
        if (position !== -1 && (earliestPosition === -1 || position < earliestPosition)) {
          earliestPosition = position;
        }
      }
      if (earliestPosition !== -1) {
        mentions.push({ catId: config.id, position: earliestPosition });
      }
    }

    mentions.sort((a, b) => a.position - b.position);
    return mentions.map((m) => m.catId);
  }

  /**
   * Read-only target resolution: mentions → participants → default opus.
   * Does NOT mutate thread participants.
   */
  private async peekTargets(message: string, threadId: string): Promise<CatId[]> {
    const mentionedCats = this.parseMentions(message);
    if (mentionedCats.length > 0) return mentionedCats;

    if (this.threadStore) {
      const participants = await this.threadStore.getParticipants(threadId);
      if (participants.length > 0) return participants;
    }

    return [createCatId('opus')];
  }

  /** Resolve target cats and persist new mentions as thread participants */
  private async resolveTargets(message: string, threadId: string): Promise<CatId[]> {
    const mentionedCats = this.parseMentions(message);

    if (mentionedCats.length > 0) {
      if (this.threadStore) {
        await this.threadStore.addParticipants(threadId, mentionedCats);
      }
      return mentionedCats;
    }

    if (this.threadStore) {
      const participants = await this.threadStore.getParticipants(threadId);
      if (participants.length > 0) return participants;
    }

    return [createCatId('opus')];
  }

  /** Build shared strategy dependencies (public for ModeOrchestrator) */
  getStrategyDeps(): RouteStrategyDeps {
    const apiPort = process.env['API_SERVER_PORT'] ?? '3002';
    return {
      services: this.services,
      invocationDeps: {
        registry: this.registry,
        sessionManager: this.sessionManager,
        threadStore: this.threadStore,
        apiUrl: `http://127.0.0.1:${apiPort}`,
        ...(this.sessionChainStore ? { sessionChainStore: this.sessionChainStore } : {}),
        ...(this.transcriptWriter ? { transcriptWriter: this.transcriptWriter } : {}),
        ...(this.transcriptReader ? { transcriptReader: this.transcriptReader } : {}),
        ...(this.sessionSealer ? { sessionSealer: this.sessionSealer } : {}),
      },
      messageStore: this.messageStore,
      deliveryCursorStore: this.deliveryCursorStore,
    };
  }

  /**
   * Resolve targets and intent.
   * Default: read-only peek (safe to call before route()).
   * With persist: true, also writes @mentions to thread participants.
   */
  async resolveTargetsAndIntent(
    message: string,
    threadId?: string,
    options?: { persist?: boolean },
  ): Promise<{ targetCats: CatId[]; intent: IntentResult }> {
    const resolvedThreadId = threadId ?? DEFAULT_THREAD_ID;
    const targetCats = options?.persist
      ? await this.resolveTargets(message, resolvedThreadId)
      : await this.peekTargets(message, resolvedThreadId);
    const intent = parseIntent(message, targetCats.length);
    return { targetCats, intent };
  }

  /**
   * Route message to appropriate agent(s) based on @ mentions and thread participants.
   * @deprecated Use routeExecution() instead — route() couples message writing with execution.
   *             Will be removed after S4 migration is complete.
   */
  async *route(
    userId: string,
    message: string,
    threadId?: string,
    contentBlocks?: readonly MessageContent[],
    uploadDir?: string,
    signal?: AbortSignal,
  ): AsyncIterable<AgentMessage> {
    const resolvedThreadId = threadId ?? DEFAULT_THREAD_ID;
    const targetCats = await this.resolveTargets(message, resolvedThreadId);
    const intent = parseIntent(message, targetCats.length);
    const cleanMessage = stripIntentTags(message);

    if (this.threadStore) {
      await this.threadStore.updateLastActive(resolvedThreadId);
    }

    const storedUserMessage = await this.messageStore.append({
      userId,
      catId: null,
      content: message,  // Store original (with tags) for audit
      mentions: targetCats,
      timestamp: Date.now(),
      threadId: resolvedThreadId,
      ...(contentBlocks ? { contentBlocks } : {}),
    });

    const strategyDeps = this.getStrategyDeps();
    const routeOptions = {
      contentBlocks, uploadDir, signal,
      promptTags: intent.promptTags,
      currentUserMessageId: storedUserMessage.id,
    };

    if (intent.intent === 'ideate' && targetCats.length > 1) {
      yield* routeParallel(
        strategyDeps, targetCats, cleanMessage, userId, resolvedThreadId, routeOptions,
      );
    } else {
      yield* routeSerial(
        strategyDeps, targetCats, cleanMessage, userId, resolvedThreadId, routeOptions,
      );
    }
  }

  /**
   * Execute cat invocation without writing the user message (ADR-008 S1).
   * Message writing is decoupled — the caller writes the message and passes its ID.
   *
   * @param userMessageId - ID of the already-stored user message
   * @param targetCats - pre-resolved target cats (from resolveTargets)
   * @param intent - pre-parsed intent result
   */
  async *routeExecution(
    userId: string,
    message: string,
    threadId: string,
    userMessageId: string,
    targetCats: CatId[],
    intent: IntentResult,
    options?: {
      contentBlocks?: readonly MessageContent[];
      uploadDir?: string;
      signal?: AbortSignal;
      /** ADR-008 S3: pass a Map to collect cursor boundaries; caller acks after succeeded */
      cursorBoundaries?: Map<string, string>;
      /** P1-2: pass to track persistence failures across generator boundary */
      persistenceContext?: PersistenceContext;
    },
  ): AsyncIterable<AgentMessage> {
    const cleanMessage = stripIntentTags(message);

    if (this.threadStore) {
      await this.threadStore.updateLastActive(threadId);
    }

    const strategyDeps = this.getStrategyDeps();
    const routeOptions = {
      contentBlocks: options?.contentBlocks,
      uploadDir: options?.uploadDir,
      signal: options?.signal,
      promptTags: intent.promptTags,
      currentUserMessageId: userMessageId,
      ...(options?.cursorBoundaries ? { cursorBoundaries: options.cursorBoundaries } : {}),
      ...(options?.persistenceContext ? { persistenceContext: options.persistenceContext } : {}),
    };

    if (intent.intent === 'ideate' && targetCats.length > 1) {
      yield* routeParallel(
        strategyDeps, targetCats, cleanMessage, userId, threadId, routeOptions,
      );
    } else {
      yield* routeSerial(
        strategyDeps, targetCats, cleanMessage, userId, threadId, routeOptions,
      );
    }
  }

  /**
   * ADR-008 S3: Ack all cursor boundaries collected during execution.
   * Call ONLY after InvocationRecord.status = 'succeeded'.
   */
  async ackCollectedCursors(
    userId: string,
    threadId: string,
    boundaries: Map<string, string>,
  ): Promise<void> {
    for (const [catId, boundaryId] of boundaries) {
      try {
        await this.deliveryCursorStore.ackCursor(userId, catId as CatId, threadId, boundaryId);
      } catch (err) {
        console.error(`[ackCollectedCursors] failed for ${catId}:`, err);
      }
    }
  }
}
