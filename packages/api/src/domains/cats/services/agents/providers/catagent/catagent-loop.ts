/**
 * CatAgent Loop — F152: Thin Agent Runtime
 *
 * Core think→act→observe loop. Borrowed patterns from Claude Code:
 * - System prompt rebuilt every turn (anti-drift)
 * - Serial tool execution (spike; parallel in Phase 3)
 * - Clean termination conditions
 *
 * Loop: callLLM → check tool_use → dispatch tools → collect results → next turn
 */

import Anthropic from '@anthropic-ai/sdk';
import type { CatId } from '@cat-cafe/shared';
import { createModuleLogger } from '../../../../../../infrastructure/logger.js';
import type { AgentMessage, MessageMetadata } from '../../../types.js';
import { buildKernelPrompt } from './catagent-kernel-prompt.js';
import { microcompact } from './catagent-microcompact.js';
import { createToolRegistry, getToolSchemas } from './catagent-tools.js';
import type { CatAgentLoopConfig, CatAgentTool, SessionTokenUsage } from './catagent-types.js';

const log = createModuleLogger('catagent-loop');

type ContentBlock = Anthropic.Messages.ContentBlock;
type ToolUseBlock = Anthropic.Messages.ToolUseBlock;
type ToolResultBlockParam = Anthropic.Messages.ToolResultBlockParam;

/** Run the CatAgent loop, yielding AgentMessages */
export async function* runCatAgentLoop(
  prompt: string,
  config: CatAgentLoopConfig,
  customSystemPrompt?: string,
): AsyncGenerator<AgentMessage, void, undefined> {
  // biome-ignore lint: test seam — cast mock client to Anthropic for DI
  const client = (config._testClient ?? new Anthropic({ apiKey: config.apiKey, baseURL: config.baseURL })) as Anthropic;
  const toolRegistry = createToolRegistry(config.workingDirectory);
  const toolSchemas = getToolSchemas(toolRegistry);
  const messages: Anthropic.Messages.MessageParam[] = [{ role: 'user', content: prompt }];
  const sessionId = `catagent-${config.catId}-${Date.now()}`;

  const usage: SessionTokenUsage = { totalInputTokens: 0, totalOutputTokens: 0, turns: 0 };

  yield makeMessage(config.catId, 'session_init', { sessionId });

  for (let turn = 1; turn <= config.maxTurns; turn++) {
    if (config.signal?.aborted) break;

    // Budget guard: stop if cumulative tokens exceed limit
    if (config.tokenBudgetLimit > 0) {
      const total = usage.totalInputTokens + usage.totalOutputTokens;
      if (total >= config.tokenBudgetLimit) {
        log.warn(`[turn ${turn}] token budget exhausted: ${total}/${config.tokenBudgetLimit}`);
        yield makeMessage(config.catId, 'text', {
          content: `[Token budget exhausted: ${total} tokens used of ${config.tokenBudgetLimit} limit. Stopping.]`,
        });
        break;
      }
    }

    const systemPrompt = buildKernelPrompt({
      catId: config.catId,
      catName: getCatDisplayName(config.catId),
      model: config.model,
      workingDirectory: config.workingDirectory,
      turnNumber: turn,
      customSystemPrompt,
    });

    // MicroCompact: strip old tool results before API call (Claude Code pattern)
    const compactedMessages = microcompact(messages);
    log.debug(
      `[turn ${turn}] calling API with ${compactedMessages.length} messages, tokens=${usage.totalInputTokens + usage.totalOutputTokens}`,
    );

    let response: Anthropic.Messages.Message;
    try {
      response = await client.messages.create({
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: compactedMessages,
        tools: toolSchemas.length > 0 ? toolSchemas : undefined,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      log.error(`[turn ${turn}] API error: ${msg}`);
      yield makeMessage(config.catId, 'error', { error: `API error: ${msg}` });
      return;
    }

    // Track cumulative usage
    usage.totalInputTokens += response.usage.input_tokens;
    usage.totalOutputTokens += response.usage.output_tokens;
    usage.turns = turn;

    const textContent = extractText(response.content);
    if (textContent) {
      yield makeMessage(config.catId, 'text', {
        content: textContent,
        metadata: buildSessionMetadata(sessionId, response, usage),
      });
    }

    const toolUseBlocks = response.content.filter(isToolUse);
    if (toolUseBlocks.length === 0) break;

    messages.push({ role: 'assistant', content: response.content });
    const toolResults = yield* executeTools(toolUseBlocks, toolRegistry, config.catId, turn);
    messages.push({ role: 'user', content: toolResults });
  }

  yield makeMessage(config.catId, 'done', {
    isFinal: true,
    metadata: {
      provider: 'anthropic-api',
      model: config.model,
      sessionId,
      usage: {
        inputTokens: usage.totalInputTokens,
        outputTokens: usage.totalOutputTokens,
        numTurns: usage.turns,
      },
    },
  });
}

/** Execute tool calls serially, yielding progress messages */
async function* executeTools(
  toolUseBlocks: ToolUseBlock[],
  registry: Map<string, CatAgentTool>,
  catId: CatId,
  turn: number,
): AsyncGenerator<AgentMessage, ToolResultBlockParam[], undefined> {
  const results: ToolResultBlockParam[] = [];

  for (const toolUse of toolUseBlocks) {
    const tool = registry.get(toolUse.name);
    if (!tool || tool.permission === 'deny') {
      const denied = `Tool "${toolUse.name}" is not permitted.`;
      log.warn(`[turn ${turn}] denied: ${toolUse.name}`);
      results.push({ type: 'tool_result', tool_use_id: toolUse.id, content: denied, is_error: true });
      continue;
    }

    yield makeMessage(catId, 'tool_use', {
      toolName: toolUse.name,
      toolInput: toolUse.input as Record<string, unknown>,
    });

    const result = await executeSingleTool(tool, toolUse);
    yield makeMessage(catId, 'tool_result', { content: typeof result.content === 'string' ? result.content : '' });
    results.push(result);
  }

  return results;
}

async function executeSingleTool(tool: CatAgentTool, toolUse: ToolUseBlock): Promise<ToolResultBlockParam> {
  try {
    const raw = await tool.execute(toolUse.input as Record<string, unknown>);
    const content = raw.length > 30_000 ? `${raw.slice(0, 30_000)}\n... (truncated)` : raw;
    return { type: 'tool_result', tool_use_id: toolUse.id, content };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { type: 'tool_result', tool_use_id: toolUse.id, content: msg, is_error: true };
  }
}

// --- Helpers ---

function isToolUse(block: ContentBlock): block is ToolUseBlock {
  return block.type === 'tool_use';
}

function extractText(content: ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

function buildSessionMetadata(
  sessionId: string,
  response: Anthropic.Messages.Message,
  cumulative: SessionTokenUsage,
): MessageMetadata {
  return {
    provider: 'anthropic-api',
    model: response.model,
    sessionId,
    usage: {
      inputTokens: cumulative.totalInputTokens,
      outputTokens: cumulative.totalOutputTokens,
      lastTurnInputTokens: response.usage.input_tokens,
      numTurns: cumulative.turns,
    },
  };
}

function getCatDisplayName(catId: CatId): string {
  const names: Record<string, string> = {
    opus: '布偶猫/宪宪',
    sonnet: '布偶猫 Sonnet',
    codex: '缅因猫/砚砚',
    gpt52: '缅因猫 GPT-5.4',
    gemini: '暹罗猫/烁烁',
  };
  return names[catId] ?? `CatAgent(${catId})`;
}

function makeMessage(catId: CatId, type: AgentMessage['type'], fields: Partial<AgentMessage>): AgentMessage {
  return { type, catId, timestamp: Date.now(), ...fields };
}
