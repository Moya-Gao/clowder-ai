/**
 * Brainstorm Mode Handler
 *
 * Round 1 (!roundOneComplete): routeParallel — 所有参与猫独立思考
 * Round 2+ (roundOneComplete): routeSerial — 按 speakingOrder 串行讨论 (含 A2A)
 *
 * 设计文档：docs/plans/2026-02-10-f11-mode-system-design.md §3
 */

import type { CatId, ModeConfig, ModeState, BrainstormConfig, BrainstormState } from '@cat-cafe/shared';
import { isBrainstormConfig, isBrainstormState } from '@cat-cafe/shared';
import { routeSerial, routeParallel } from '../route-strategies.js';
import type { ModeHandler, ModeExecutionContext } from './mode-types.js';
import type { AgentMessage } from '../types.js';
import { buildBrainstormPrompt, buildModeSwitchInstruction } from './mode-prompts.js';

export class BrainstormMode implements ModeHandler {
  async *execute(
    ctx: ModeExecutionContext,
    config: ModeConfig,
    state: ModeState,
  ): AsyncIterable<AgentMessage> {
    if (!isBrainstormConfig(config)) throw new Error('BrainstormMode requires BrainstormConfig');
    if (!isBrainstormState(state)) throw new Error('BrainstormMode requires BrainstormState');

    const participants = config.participants as CatId[];
    const speakingOrder = (config.speakingOrder ?? config.participants) as CatId[];

    // Build per-cat mode prompts (P2-6: each cat gets its own perspective)
    const switchInstruction = buildModeSwitchInstruction();
    const modePromptByCat: Record<string, string> = {};
    for (const p of participants) {
      modePromptByCat[p as string] = buildBrainstormPrompt(config, state, p as CatId) + switchInstruction;
    }

    if (!state.roundOneComplete) {
      // Round 1: parallel independent thinking
      yield* routeParallel(
        ctx.strategyDeps,
        participants,
        ctx.message,
        ctx.userId,
        ctx.threadId,
        { ...ctx.routeOptions, promptTags: ['brainstorm-round1'], modeSystemPromptByCat: modePromptByCat },
      );
    } else {
      // Round 2+: serial discussion with A2A
      // P2-7: track cat text to detect @铲屎官 mention
      let mentionedUser = false;
      for await (const msg of routeSerial(
        ctx.strategyDeps,
        speakingOrder,
        ctx.message,
        ctx.userId,
        ctx.threadId,
        { ...ctx.routeOptions, promptTags: ['brainstorm-discussion'], modeSystemPromptByCat: modePromptByCat },
      )) {
        if (msg.type === 'text' && msg.content) {
          if (msg.content.includes('@铲屎官') || msg.content.includes('@user')) {
            mentionedUser = true;
          }
        }
        yield msg;
      }

      // P2-7: if any cat requested user input, notify frontend
      if (mentionedUser) {
        yield {
          type: 'system_info' as const,
          catId: speakingOrder[0] as CatId,
          content: '猫猫请求铲屎官回应。请输入您的想法后继续讨论。',
          timestamp: Date.now(),
        } as AgentMessage;
      }
    }
  }

  getNextState(config: ModeConfig, state: ModeState): ModeState {
    if (!isBrainstormState(state)) return state;

    if (!state.roundOneComplete) {
      // After round 1, mark complete and advance
      return { roundOneComplete: true, currentRound: 2 };
    }

    // Subsequent rounds just increment
    return { roundOneComplete: true, currentRound: state.currentRound + 1 };
  }

  shouldAutoEnd(): boolean {
    return false; // Brainstorm has no auto-end; user decides when to stop
  }
}
