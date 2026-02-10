/**
 * Brainstorm Mode Handler
 *
 * Round 1 (!roundOneComplete): routeParallel — 所有参与猫独立思考
 * Round 2+ (roundOneComplete): routeSerial — 按 speakingOrder 串行讨论 (含 A2A)
 *
 * @铲屎官 mid-chain break: 猫提到 @铲屎官 后暂停串行链，
 * 保留 remainingSpeakers 等用户回复后继续当前轮次。
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
  /**
   * Per-thread pause tracking: after @铲屎官 break, stores remaining speakers.
   * Set by execute(), consumed by getNextState() in the same invocation cycle.
   */
  private pauseInfo = new Map<string, CatId[]>();

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
      // If resuming from @铲屎官 pause, only route remaining speakers
      const serialCats = (state.pausedForUser && state.remainingSpeakers?.length)
        ? state.remainingSpeakers as CatId[]
        : speakingOrder;

      // Track which cats completed, for computing remaining on break
      const completedCats = new Set<string>();
      let mentionedUser = false;
      let mentionCatId: CatId | undefined;

      for await (const msg of routeSerial(
        ctx.strategyDeps,
        serialCats,
        ctx.message,
        ctx.userId,
        ctx.threadId,
        { ...ctx.routeOptions, promptTags: ['brainstorm-discussion'], modeSystemPromptByCat: modePromptByCat },
      )) {
        if (msg.type === 'text' && msg.content) {
          if (msg.content.includes('@铲屎官') || msg.content.includes('@user')) {
            mentionedUser = true;
            mentionCatId = msg.catId;
          }
        }
        yield msg;
        // After a cat finishes, if they mentioned @铲屎官, stop remaining cats
        if (msg.type === 'done') {
          completedCats.add(msg.catId);
          if (mentionedUser) {
            const remaining = serialCats.filter(c => !completedCats.has(c));
            this.pauseInfo.set(ctx.threadId, remaining);
            break;
          }
        }
      }

      // If a cat requested user input, notify frontend to wait
      if (mentionedUser) {
        yield {
          type: 'system_info' as const,
          catId: mentionCatId ?? serialCats[0] as CatId,
          content: '猫猫请求铲屎官回应。请输入您的想法后继续讨论。',
          timestamp: Date.now(),
        } as AgentMessage;
      }
    }
  }

  getNextState(config: ModeConfig, state: ModeState, threadId?: string): ModeState {
    if (!isBrainstormState(state)) return state;

    if (!state.roundOneComplete) {
      return { roundOneComplete: true, currentRound: 2 };
    }

    // If @铲屎官 caused a mid-chain break, preserve current round with remaining speakers
    if (threadId && this.pauseInfo.has(threadId)) {
      const remaining = this.pauseInfo.get(threadId)!;
      this.pauseInfo.delete(threadId);
      return {
        roundOneComplete: true,
        currentRound: state.currentRound,
        pausedForUser: true,
        remainingSpeakers: remaining,
      };
    }

    // Normal completion: advance to next round (clear any previous pause state)
    return { roundOneComplete: true, currentRound: state.currentRound + 1 };
  }

  shouldAutoEnd(): boolean {
    return false; // Brainstorm has no auto-end; user decides when to stop
  }
}
