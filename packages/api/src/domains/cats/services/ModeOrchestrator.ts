/**
 * Mode Orchestrator
 * 编排层：读取当前模式 → 分发到对应 handler → yield 消息 → 更新状态
 *
 * 由 messages.ts 在 background execution 时调用。
 * 有 active mode → 走 ModeOrchestrator
 * 无 active mode → 走 AgentRouter.routeExecution()（向后兼容）
 *
 * R2 fixes: text accumulation for @mode:, auto-end broadcast, thread permission
 */

import type { ModeName } from '@cat-cafe/shared';
import type { IModeStore } from './ModeStore.js';
import type { AgentMessage } from './types.js';
import type { ModeHandler, ModeExecutionContext } from './modes/mode-types.js';
import type { SocketManager } from '../../../infrastructure/websocket/index.js';
import { BrainstormMode } from './modes/BrainstormMode.js';
import { DebateMode } from './modes/DebateMode.js';
import { DevLoopMode } from './modes/DevLoopMode.js';

/** Registry of mode handlers, extensible for future modes */
const MODE_HANDLERS: Record<ModeName, ModeHandler> = {
  brainstorm: new BrainstormMode(),
  debate: new DebateMode(),
  'dev-loop': new DevLoopMode(),
};

/** Detect @mode:<name> pattern in completed cat responses ([\w-]+ to support hyphenated names like dev-loop) */
const MODE_SWITCH_PATTERN = /^@mode:([\w-]+)/m;

export interface ModeOrchestratorOpts {
  modeStore: IModeStore;
  socketManager?: SocketManager;
}

export class ModeOrchestrator {
  private modeStore: IModeStore;
  private socketManager: SocketManager | undefined;

  constructor(opts: ModeOrchestratorOpts) {
    this.modeStore = opts.modeStore;
    this.socketManager = opts.socketManager ?? undefined;
  }

  /** Register a mode handler (useful in tests) */
  registerHandler(name: ModeName, handler: ModeHandler): void {
    MODE_HANDLERS[name] = handler;
  }

  /**
   * Execute one round of the active mode on this thread.
   * Yields all agent messages, then updates mode state.
   * Handles auto-end and cat-initiated mode switch detection.
   */
  async *execute(ctx: ModeExecutionContext): AsyncIterable<AgentMessage> {
    const mode = await this.modeStore.getMode(ctx.threadId);
    if (!mode) {
      throw new Error(`No active mode on thread ${ctx.threadId}`);
    }

    const handler = MODE_HANDLERS[mode.record.name];
    if (!handler) {
      throw new Error(`No handler registered for mode: ${mode.record.name}`);
    }

    // Accumulate text content per cat for @mode: detection (done has no content)
    const textByCat = new Map<string, string>();
    const doneCatIds: string[] = [];

    for await (const msg of handler.execute(ctx, mode.record.config, mode.state)) {
      if (msg.type === 'text' && msg.content) {
        const prev = textByCat.get(msg.catId) ?? '';
        textByCat.set(msg.catId, prev + msg.content);
      }
      if (msg.type === 'done') {
        doneCatIds.push(msg.catId);
      }
      yield msg;
    }

    // Update state after execution (threadId needed for per-thread result lookup in DevLoopMode)
    const nextState = handler.getNextState(mode.record.config, mode.state, ctx.threadId);
    await this.modeStore.updateState(ctx.threadId, nextState);

    // Auto-end check — if handler signals mode should end, call endMode + broadcast
    if (handler.shouldAutoEnd(mode.record.config, nextState)) {
      await this.modeStore.endMode(ctx.threadId, `auto-end after ${mode.record.name} completed`);
      this.socketManager?.broadcastToRoom(`thread:${ctx.threadId}`, 'mode_changed', {
        threadId: ctx.threadId,
        mode: null,
        action: 'ended',
      });
    }

    // Detect cat-initiated mode switch proposals in accumulated full text
    // P2-4: check switchRequiresApproval config to determine behavior
    const switchRequiresApproval = (process.env['MODE_SWITCH_REQUIRES_APPROVAL'] ?? 'true') !== 'false';

    for (const catId of doneCatIds) {
      const fullText = textByCat.get(catId) ?? '';
      const match = MODE_SWITCH_PATTERN.exec(fullText);
      if (match) {
        const proposedMode = match[1]!;
        if (switchRequiresApproval) {
          // Default: user must approve the switch
          yield {
            type: 'system_info',
            catId,
            content: `${catId} 提议切换到 ${proposedMode} 模式。使用 /mode ${proposedMode} 切换，或忽略此建议。`,
            timestamp: Date.now(),
          } as AgentMessage;
        } else {
          // Auto-switch enabled: emit structured proposal for frontend auto-execution
          yield {
            type: 'system_info',
            catId,
            content: JSON.stringify({
              type: 'mode_switch_proposal',
              proposedMode,
              proposedBy: catId,
              autoSwitch: true,
            }),
            timestamp: Date.now(),
          } as AgentMessage;
        }
        break; // Only detect first proposal
      }
    }
  }
}
