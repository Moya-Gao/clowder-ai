/**
 * Mode Store
 * 模式状态管理：per-thread 模式的启动、查询、状态更新、结束。
 *
 * 独立于 ThreadStore（避免 IThreadStore/Redis schema 迁移），按 threadId 键控。
 * 内存实现，匹配 IMessageStore 的 T | Promise<T> 接口约定。
 *
 * 设计文档：docs/plans/2026-02-10-f11-mode-system-design.md
 */

import type { ModeConfig, ModeName, ModeState, ThreadMode, ThreadModeRecord } from '@cat-cafe/shared';

/**
 * Common interface for mode stores (in-memory and future Redis).
 * Return types use T | Promise<T> to support both sync and async implementations
 * (matching IMessageStore convention for Redis migration readiness).
 */
export interface IModeStore {
  /** Get current active mode for a thread (null if none) */
  getMode(threadId: string): ThreadMode | null | Promise<ThreadMode | null>;

  /** Start a new mode on a thread (ends any existing mode first) */
  startMode(
    threadId: string,
    name: ModeName,
    config: ModeConfig,
    triggeredBy: string,
    initialState: ModeState,
  ): ThreadMode | Promise<ThreadMode>;

  /** Update the runtime state of the active mode */
  updateState(threadId: string, state: ModeState): void | Promise<void>;

  /** End the current mode, optionally recording an outcome. Returns the ended record. */
  endMode(threadId: string, outcome?: string): ThreadModeRecord | null | Promise<ThreadModeRecord | null>;

  /** Get mode history for a thread */
  getModeHistory(threadId: string): ThreadModeRecord[] | Promise<ThreadModeRecord[]>;
}

/**
 * In-memory mode store.
 * Returns sync values (valid for T | Promise<T> interface).
 */
export class ModeStore implements IModeStore {
  private activeModes = new Map<string, ThreadMode>();
  private modeHistory = new Map<string, ThreadModeRecord[]>();

  getMode(threadId: string): ThreadMode | null {
    return this.activeModes.get(threadId) ?? null;
  }

  startMode(
    threadId: string,
    name: ModeName,
    config: ModeConfig,
    triggeredBy: string,
    initialState: ModeState,
  ): ThreadMode {
    // End any existing mode first
    this.endMode(threadId);

    const record: ThreadModeRecord = {
      name,
      config,
      startedAt: new Date().toISOString(),
      triggeredBy,
    };

    const mode: ThreadMode = { record, state: initialState };
    this.activeModes.set(threadId, mode);
    return mode;
  }

  updateState(threadId: string, state: ModeState): void {
    const mode = this.activeModes.get(threadId);
    if (mode) {
      mode.state = state;
    }
  }

  endMode(threadId: string, outcome?: string): ThreadModeRecord | null {
    const mode = this.activeModes.get(threadId);
    if (!mode) return null;

    const ended: ThreadModeRecord = {
      ...mode.record,
      endedAt: new Date().toISOString(),
      ...(outcome ? { outcome } : {}),
    };

    const threadHistory = this.modeHistory.get(threadId) ?? [];
    threadHistory.push(ended);
    this.modeHistory.set(threadId, threadHistory);
    this.activeModes.delete(threadId);

    return ended;
  }

  getModeHistory(threadId: string): ThreadModeRecord[] {
    const active = this.activeModes.get(threadId);
    const past = this.modeHistory.get(threadId) ?? [];
    return active ? [...past, active.record] : past;
  }
}

/** Create initial state for a mode */
export function createInitialState(name: ModeName): ModeState {
  if (name === 'brainstorm') {
    return { roundOneComplete: false, currentRound: 1 };
  }
  if (name === 'dev-loop') {
    return { phase: 'developing' as const, iteration: 0, p3Issues: [] };
  }
  return { currentRound: 1, nextSpeaker: 'catA' as const };
}
