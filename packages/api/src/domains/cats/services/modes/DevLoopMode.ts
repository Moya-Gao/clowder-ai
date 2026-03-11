/**
 * Dev-Loop Mode Handler — 开发自闭环
 *
 * 与 brainstorm/debate 不同，dev-loop 的 execute() 在一次调用中
 * 运行完整的 develop → review → fix → re-review 循环。
 *
 * 设计文档：docs/plans/2026-02-10-f11-mode-system-design.md §2.3
 */

import type { CatId, DevLoopConfig, DevLoopState, ModeConfig, ModeState } from '@cat-cafe/shared';
import { isDevLoopConfig, isDevLoopState } from '@cat-cafe/shared';
import { getDefaultCatId } from '../../../../config/cat-config-loader.js';
import { routeSerial } from '../agents/routing/route-serial.js';
import type { AgentMessage } from '../types.js';
import { buildDevLoopSummary, parseReviewResult } from './dev-loop-parser.js';
import { buildDevLoopDevPrompt, buildDevLoopFixPrompt, buildDevLoopReviewPrompt } from './mode-prompts.js';
import type { ModeExecutionContext, ModeHandler } from './mode-types.js';

const DEFAULT_MAX_ITERATIONS = 5;

export class DevLoopMode implements ModeHandler {
  async *execute(ctx: ModeExecutionContext, config: ModeConfig, state: ModeState): AsyncIterable<AgentMessage> {
    if (!isDevLoopConfig(config)) throw new Error('DevLoopMode requires DevLoopConfig');
    if (!isDevLoopState(state)) throw new Error('DevLoopMode requires DevLoopState');

    const cfg = config as DevLoopConfig;
    const st = state as DevLoopState;

    if (st.phase === 'completed') {
      yield this.sysInfo(`开发自闭环已完成。需求：${cfg.requirement}`);
      return;
    }

    const maxIter = cfg.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const allP3: string[] = [...st.p3Issues];
    let iteration = st.iteration;

    // ── Phase 1: Develop ──────────────────────────────────
    yield this.sysInfo(`📝 阶段：开发 (第 ${iteration + 1} 轮)`);
    const devSysPrompt = buildDevLoopDevPrompt(cfg, iteration);

    let devText = '';
    for await (const msg of this.routeCat(ctx, cfg.leadCat, devSysPrompt, ctx.message)) {
      if (msg.type === 'text' && msg.content) devText += msg.content;
      yield msg;
    }

    // ── Review Loop ───────────────────────────────────────
    for (; iteration < maxIter; iteration++) {
      // Review phase
      yield this.sysInfo(`🔍 阶段：Review (第 ${iteration + 1} 轮)`);
      const reviewSysPrompt = buildDevLoopReviewPrompt(cfg);

      let reviewText = '';
      for await (const msg of this.routeCat(ctx, cfg.reviewCat, reviewSysPrompt, devText)) {
        if (msg.type === 'text' && msg.content) reviewText += msg.content;
        yield msg;
      }

      const result = parseReviewResult(reviewText);
      allP3.push(...result.p3);

      if (result.approved) {
        yield this.sysInfo(`✅ Review 通过 (第 ${iteration + 1} 轮)`);
        break;
      }

      // Not approved — check if we can still fix
      if (iteration + 1 >= maxIter) {
        yield this.sysInfo(`⚠️ 达到最大修复轮次 (${maxIter})，强制结束`);
        break;
      }

      // Fix phase
      yield this.sysInfo(`🔧 阶段：修复 (第 ${iteration + 1} 轮)`);
      const fixSysPrompt = buildDevLoopFixPrompt(cfg, result);

      devText = '';
      for await (const msg of this.routeCat(ctx, cfg.leadCat, fixSysPrompt, ctx.message)) {
        if (msg.type === 'text' && msg.content) devText += msg.content;
        yield msg;
      }
    }

    // ── Summary ───────────────────────────────────────────
    const summary = buildDevLoopSummary(cfg, iteration + 1, allP3);
    yield this.sysInfo(summary);

    // Store result keyed by threadId — safe for concurrent threads on singleton handler
    this._resultsByThread.set(ctx.threadId, { iteration: iteration + 1, p3Issues: allP3 });
  }

  getNextState(_config: ModeConfig, state: ModeState, threadId?: string): ModeState {
    if (!isDevLoopState(state)) return state;
    const key = threadId ?? '';
    const result = this._resultsByThread.get(key) ?? { iteration: state.iteration, p3Issues: state.p3Issues };
    this._resultsByThread.delete(key); // Clean up after read
    return {
      phase: 'completed' as const,
      iteration: result.iteration,
      p3Issues: result.p3Issues,
    };
  }

  shouldAutoEnd(_config: ModeConfig, state: ModeState): boolean {
    if (!isDevLoopState(state)) return false;
    return state.phase === 'completed';
  }

  // ── Private helpers ─────────────────────────────────────

  /** Per-thread result storage — avoids concurrent corruption on singleton handler */
  private _resultsByThread = new Map<string, { iteration: number; p3Issues: string[] }>();

  private sysInfo(content: string): AgentMessage {
    return {
      type: 'system_info',
      catId: getDefaultCatId(),
      content,
      timestamp: Date.now(),
    };
  }

  private routeCat(
    ctx: ModeExecutionContext,
    catId: CatId,
    systemPrompt: string,
    message: string,
  ): AsyncIterable<AgentMessage> {
    return routeSerial(ctx.strategyDeps, [catId], message, ctx.userId, ctx.threadId, {
      ...ctx.routeOptions,
      maxA2ADepth: 0,
      promptTags: ['dev-loop'],
      modeSystemPromptByCat: {
        [catId as string]: systemPrompt,
      },
    });
  }
}
