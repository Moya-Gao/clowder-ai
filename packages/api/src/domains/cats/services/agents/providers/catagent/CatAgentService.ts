/**
 * CatAgent Service — F152: Thin Agent Runtime
 *
 * Implements AgentService by calling the Anthropic Messages API directly
 * (not via CLI subprocess). Designed as an opt-in provider under F143,
 * not a replacement for the CLI subprocess main path (ADR-001).
 *
 * API key resolution: env override → account resolver (credentials.json).
 * Spike scope: read-only tools, serial execution, kernel prompt rebuild per turn.
 */

import type { CatId } from '@cat-cafe/shared';
import { getCatModel } from '../../../../../../config/cat-models.js';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import type { AgentMessage, AgentService, AgentServiceOptions } from '../../../types.js';
import { resolveApiCredentials } from './catagent-credentials.js';
import { runCatAgentLoop } from './catagent-loop.js';

const log = createModuleLogger('catagent-service');

/** Default max turns before forced stop */
const DEFAULT_MAX_TURNS = 20;
/** Default max output tokens per LLM call */
const DEFAULT_MAX_TOKENS = 8192;
/** Default cumulative token budget (input+output). ~200K = ~10 substantial turns. */
const DEFAULT_TOKEN_BUDGET = 200_000;

export class CatAgentService implements AgentService {
  private readonly catId: CatId;

  constructor({ catId }: { catId: CatId }) {
    this.catId = catId;
  }

  async *invoke(prompt: string, options?: AgentServiceOptions): AsyncIterable<AgentMessage> {
    const creds = resolveApiCredentials();
    if (!creds) {
      yield {
        type: 'error',
        catId: this.catId,
        error:
          'CatAgent: no Anthropic API key found. Set CATAGENT_ANTHROPIC_API_KEY or configure an anthropic account.',
        timestamp: Date.now(),
      };
      return;
    }

    const model = getCatModel(this.catId);
    const workingDirectory = options?.workingDirectory ?? process.cwd();

    log.info(`CatAgent invoke: cat=${this.catId} model=${model} creds=${creds.source} cwd=${workingDirectory}`);

    yield* runCatAgentLoop(
      prompt,
      {
        catId: this.catId,
        model,
        apiKey: creds.apiKey,
        baseURL: creds.baseURL,
        maxTurns: DEFAULT_MAX_TURNS,
        maxTokens: DEFAULT_MAX_TOKENS,
        tokenBudgetLimit: DEFAULT_TOKEN_BUDGET,
        workingDirectory,
        signal: options?.signal,
      },
      options?.systemPrompt,
    );
  }
}
