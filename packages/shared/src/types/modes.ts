/**
 * Mode Types — 线程执行模式
 *
 * 模式挂在 Thread 上（不是全局状态），控制猫猫的协作编排方式。
 * 设计文档：docs/plans/2026-02-10-f11-mode-system-design.md
 */

import type { CatId } from './ids.js';

// ─── Mode Names ──────────────────────────────────────────

/** 可用模式名 */
export type ModeName = 'brainstorm' | 'debate' | 'dev-loop';

// ─── Mode Configs ────────────────────────────────────────

/** 头脑风暴配置 */
export interface BrainstormConfig {
  /** 讨论议题 */
  topic: string;
  /** 参与猫猫（铲屎官选择） */
  participants: CatId[];
  /** 第二轮起的发言顺序（可选，默认同 participants） */
  speakingOrder?: CatId[];
}

/** 辩论配置 */
export interface DebateConfig {
  /** 辩论议题 */
  topic: string;
  /** 正方 */
  catA: CatId;
  /** 反方 */
  catB: CatId;
  /** 辩论轮次（默认 3） */
  rounds?: number;
}

/** 开发自闭环配置 */
export interface DevLoopConfig {
  /** 需求描述 */
  requirement: string;
  /** 主开发猫 */
  leadCat: CatId;
  /** Review 猫 */
  reviewCat: CatId;
  /** 最大修复轮次（默认 5） */
  maxIterations?: number;
}

/** 模式配置联合类型 */
export type ModeConfig = BrainstormConfig | DebateConfig | DevLoopConfig;

// ─── Mode State (跨 invocation 持久) ─────────────────────

/** 头脑风暴运行状态 */
export interface BrainstormState {
  /** 第一轮（并行）是否已完成 */
  roundOneComplete: boolean;
  /** 当前轮次（从 1 开始） */
  currentRound: number;
}

/** 辩论运行状态 */
export interface DebateState {
  /** 当前轮次（从 1 开始） */
  currentRound: number;
  /** 下一个发言者 */
  nextSpeaker: 'catA' | 'catB';
}

/** 开发自闭环运行状态 */
export interface DevLoopState {
  /** 当前阶段 */
  phase: 'developing' | 'reviewing' | 'fixing' | 'completed';
  /** 当前修复迭代（从 0 开始） */
  iteration: number;
  /** 累积的 P3 记录 */
  p3Issues: string[];
}

/** 模式状态联合类型 */
export type ModeState = BrainstormState | DebateState | DevLoopState;

// ─── Mode Records (审计 + 流转历史) ──────────────────────

/** 一次模式活动的记录 */
export interface ThreadModeRecord {
  /** 模式名 */
  name: ModeName;
  /** 模式配置 */
  config: ModeConfig;
  /** 开始时间 (ISO) */
  startedAt: string;
  /** 结束时间 (ISO)，活跃中为 undefined */
  endedAt?: string;
  /** 该模式阶段的产出/结论（串联下一个模式的输入） */
  outcome?: string;
  /** 触发者：userId 或 catId */
  triggeredBy: string;
}

/** 线程的当前模式（record + runtime state） */
export interface ThreadMode {
  /** 模式元信息 */
  record: ThreadModeRecord;
  /** 运行时状态（跨 invocation 持久） */
  state: ModeState;
}

// ─── Type Guards ─────────────────────────────────────────

export function isBrainstormConfig(config: ModeConfig): config is BrainstormConfig {
  return 'participants' in config;
}

export function isDebateConfig(config: ModeConfig): config is DebateConfig {
  return 'catA' in config && 'catB' in config;
}

export function isBrainstormState(state: ModeState): state is BrainstormState {
  return 'roundOneComplete' in state;
}

export function isDebateState(state: ModeState): state is DebateState {
  return 'nextSpeaker' in state;
}

export function isDevLoopConfig(config: ModeConfig): config is DevLoopConfig {
  return 'leadCat' in config && 'reviewCat' in config;
}

export function isDevLoopState(state: ModeState): state is DevLoopState {
  return 'phase' in state;
}
