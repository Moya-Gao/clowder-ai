/**
 * Debate Mode Handler
 *
 * 每次用户消息触发一轮：catA 发言 → catB 发言 (routeSerial [catA, catB])
 * maxA2ADepth: 0 — 辩论是结构化的，不允许自由 A2A
 * shouldAutoEnd: currentRound > config.rounds → ModeOrchestrator 调用 endMode
 *
 * 设计文档：docs/plans/2026-02-10-f11-mode-system-design.md §4
 */

import type { CatId, ModeConfig, ModeState, DebateConfig, DebateState } from '@cat-cafe/shared';
import { isDebateConfig, isDebateState, createCatId } from '@cat-cafe/shared';
import { routeSerial } from '../route-strategies.js';
import type { ModeHandler, ModeExecutionContext } from './mode-types.js';
import type { AgentMessage } from '../types.js';
import { buildDebatePrompt } from './mode-prompts.js';

const DEFAULT_ROUNDS = 3;

export class DebateMode implements ModeHandler {
  async *execute(
    ctx: ModeExecutionContext,
    config: ModeConfig,
    state: ModeState,
  ): AsyncIterable<AgentMessage> {
    if (!isDebateConfig(config)) throw new Error('DebateMode requires DebateConfig');
    if (!isDebateState(state)) throw new Error('DebateMode requires DebateState');

    const maxRounds = config.rounds ?? DEFAULT_ROUNDS;

    // Check if debate is already past max rounds (shouldAutoEnd handles endMode)
    if (state.currentRound > maxRounds) {
      yield {
        type: 'system_info',
        catId: createCatId('opus'),
        content: `辩论已结束（${maxRounds} 轮完成）。议题：${config.topic}`,
        timestamp: Date.now(),
      };
      return;
    }

    // Build per-cat mode prompts (catA=正方, catB=反方)
    const catA = config.catA as CatId;
    const catB = config.catB as CatId;
    const promptA = buildDebatePrompt(config, state, catA);
    const promptB = buildDebatePrompt(config, state, catB);

    // Execute one round: catA → catB (serial, no A2A)
    const speakers = [catA, catB];
    yield* routeSerial(
      ctx.strategyDeps,
      speakers,
      ctx.message,
      ctx.userId,
      ctx.threadId,
      {
        ...ctx.routeOptions,
        maxA2ADepth: 0,
        promptTags: [`debate-round${state.currentRound}`],
        modeSystemPromptByCat: {
          [catA as string]: promptA,
          [catB as string]: promptB,
        },
      },
    );
  }

  getNextState(config: ModeConfig, state: ModeState): ModeState {
    if (!isDebateState(state)) return state;

    const nextRound = state.currentRound + 1;
    const nextSpeaker = state.nextSpeaker === 'catA' ? 'catB' as const : 'catA' as const;

    return { currentRound: nextRound, nextSpeaker };
  }

  shouldAutoEnd(config: ModeConfig, state: ModeState): boolean {
    if (!isDebateConfig(config) || !isDebateState(state)) return false;
    const maxRounds = config.rounds ?? DEFAULT_ROUNDS;
    // After getNextState increments, check if we've exceeded
    return state.currentRound > maxRounds;
  }
}
