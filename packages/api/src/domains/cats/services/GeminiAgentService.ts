/**
 * Gemini Agent Service
 * 使用 @google/generative-ai 调用暹罗猫 (Gemini)
 *
 * SDK API Notes:
 * - GoogleGenerativeAI(apiKey) creates the client
 * - genAI.getGenerativeModel({ model }) gets a model instance
 * - model.startChat({ history }) creates a chat session
 * - chat.sendMessage(prompt) sends a message and returns response
 * - response.response.text() gets the text content
 */

import { GoogleGenerativeAI, type Content } from '@google/generative-ai';
import { createCatId, generateSessionId } from '@cat-cafe/shared';
import type {
  AgentMessage,
  AgentService,
  AgentServiceOptions,
} from './types.js';

const CAT_ID = createCatId('gemini');
const DEFAULT_MODEL = 'gemini-2.0-flash';

/**
 * Maximum number of chat histories to keep in memory
 * Prevents unbounded memory growth before Redis migration in Phase 3
 */
const MAX_SESSIONS = 1000;

/**
 * Interface for GoogleGenerativeAI SDK (for dependency injection)
 */
interface GenAILike {
  getGenerativeModel(params: { model: string }): GenerativeModelLike;
}

interface GenerativeModelLike {
  startChat(params?: { history?: Content[] }): ChatSessionLike;
}

interface ChatSessionLike {
  sendMessage(prompt: string): Promise<GenerateContentResultLike>;
  getHistory(): Promise<Content[]>;
}

interface GenerateContentResultLike {
  response: {
    text(): string;
  };
}

/**
 * Options for GeminiAgentService constructor
 */
interface GeminiAgentServiceOptions {
  /** Injected GoogleGenerativeAI instance (for testing) */
  genAI?: GenAILike;
  /** Model name to use (default: gemini-2.0-flash) */
  model?: string;
}

/**
 * Service for invoking Gemini via the @google/generative-ai SDK
 */
export class GeminiAgentService implements AgentService {
  private genAI: GenAILike | null;
  private model: string;
  private apiKeyMissing: boolean;
  /**
   * In-memory chat history storage (keyed by sessionId)
   * In Phase 3, this will be migrated to Redis
   */
  private chatHistories: Map<string, Content[]>;

  constructor(options?: GeminiAgentServiceOptions) {
    this.model = options?.model ?? DEFAULT_MODEL;
    this.chatHistories = new Map();

    if (options?.genAI) {
      this.genAI = options.genAI;
      this.apiKeyMissing = false;
    } else {
      const apiKey = process.env['GOOGLE_API_KEY'];
      if (apiKey) {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.apiKeyMissing = false;
      } else {
        this.genAI = null;
        this.apiKeyMissing = true;
      }
    }
  }

  /**
   * Test helper to set history for a session ID
   * @internal Only for testing
   */
  _setHistoryForTest(sessionId: string, history: Content[]): void {
    this.chatHistories.set(sessionId, history);
  }

  async *invoke(
    prompt: string,
    options?: AgentServiceOptions
  ): AsyncIterable<AgentMessage> {
    // Check for missing API key
    if (this.apiKeyMissing || !this.genAI) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: 'GOOGLE_API_KEY environment variable is not set',
        timestamp: Date.now(),
      };
      return;
    }

    // Determine session ID (resume existing or create new)
    const sessionId = options?.sessionId ?? generateSessionId();

    // Yield session_init first
    yield {
      type: 'session_init',
      catId: CAT_ID,
      sessionId,
      timestamp: Date.now(),
    };

    try {
      // Get existing history for this session (or empty for new session)
      const existingHistory = this.chatHistories.get(sessionId) ?? [];

      // Get model and start chat with history
      const model = this.genAI.getGenerativeModel({ model: this.model });
      const chatParams =
        existingHistory.length > 0 ? { history: existingHistory } : {};
      const chat = model.startChat(chatParams);

      // Send message and get response
      const result = await chat.sendMessage(prompt);
      const responseText = result.response.text();

      // Update history with new exchange
      const updatedHistory: Content[] = [
        ...existingHistory,
        { role: 'user', parts: [{ text: prompt }] },
        { role: 'model', parts: [{ text: responseText }] },
      ];

      // Evict oldest entries if we're at capacity (simple LRU)
      // Delete existing key first so it moves to the end (most recent)
      if (this.chatHistories.has(sessionId)) {
        this.chatHistories.delete(sessionId);
      }
      while (this.chatHistories.size >= MAX_SESSIONS) {
        const oldestKey = this.chatHistories.keys().next().value;
        if (oldestKey !== undefined) {
          this.chatHistories.delete(oldestKey);
        }
      }
      this.chatHistories.set(sessionId, updatedHistory);

      // Yield text response
      yield {
        type: 'text',
        catId: CAT_ID,
        content: responseText,
        timestamp: Date.now(),
      };

      // Yield done
      yield {
        type: 'done',
        catId: CAT_ID,
        timestamp: Date.now(),
      };
    } catch (err) {
      yield {
        type: 'error',
        catId: CAT_ID,
        error: err instanceof Error ? err.message : String(err),
        timestamp: Date.now(),
      };
    }
  }
}
