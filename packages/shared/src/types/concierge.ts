/**
 * F229: 猫猫球前台猫 — 共享类型定义
 *
 * ConciergeConfig: per-deployment 配置，per-user 存储（TTL=0，铁律 5）
 * ConciergeBallState: 球的八态状态机（UI 侧驱动）
 * ConciergeCardAction: CardBlock concierge actions（前端 action handler 注册）
 */

/** ConciergeConfig: 前台猫配置（per-user 持久化，用户可见可追溯可恢复） */
export interface ConciergeConfig {
  /** 是否启用前台猫 (default true) */
  enabled: boolean;
  /** 皮肤 — Phase A 唯一内置皮肤，Phase E 开放自定义 */
  skin: 'yarn-ball';
  /** 前台猫显示名（KD-6: per-deployment 可配置，本家 Phase A 落地投票） */
  displayName: string;
  /** 一句话人设基调（注入岗位 prompt） */
  personaTone: string;
  /** 值班猫 profileId — 指向已配置的 cat profile (KD-7: provider-agnostic) */
  dutyCatProfileId: string;
  /**
   * 主动性等级（OQ-4 四级白名单）:
   * - 'ambient': Tier 0 仅环境感知，零主动文本
   * - 'quiet-badge': Tier 0-1 低优先级 badge，hover 才出文字（Phase A 默认）
   */
  proactivePolicy: 'ambient' | 'quiet-badge';
  /** 一键静音/隐藏整个球 (AC-A6) */
  muted: boolean;
  /** 球位置 (PR-A3b INV-P3: per-user 持久化) — null = default bottom-right */
  ballPosition: { x: number; y: number } | null;
}

/** ConciergeConfig 默认值（dutyCatProfileId 由 API 层根据 roster 解析） */
export const CONCIERGE_CONFIG_DEFAULTS: Omit<ConciergeConfig, 'dutyCatProfileId'> = {
  enabled: true,
  skin: 'yarn-ball',
  displayName: '猫猫球',
  personaTone: '温暖、简短、不啰嗦',
  proactivePolicy: 'quiet-badge',
  muted: false,
  ballPosition: null,
};

/**
 * 球八态状态机
 * idle        — 默认待机（呼吸动画）
 * sleeping    — 静音/非活跃（可配置降级态）
 * listening   — STT 录音中（Phase C）
 * thinking    — 值班猫 invocation 进行中
 * found       — 记忆/功能发现返回结果（态 3）
 * needs-confirmation — 待用户确认（态 4 转接 / 任何 action card）
 * handoff     — relay 投递完成，等回执
 * error       — 调用失败
 */
export type ConciergeBallState =
  | 'idle'
  | 'sleeping'
  | 'listening'
  | 'thinking'
  | 'found'
  | 'needs-confirmation'
  | 'handoff'
  | 'error';

/**
 * threadKind: Thread 字段扩展（F229）
 * concierge = 专属前台猫对话载体（per-user，sidebar 默认隐藏）
 */
export type ConciergeThreadKind = 'concierge';

/**
 * CardBlock concierge actions（前端 action handler 注册点）
 * 前台猫不直接执行跳转/传话——发确认卡，用户点击后由前端执行（调研红线）
 */
export type ConciergeCardAction =
  /** 去：F227 teleport 跳转到目标 thread/message */
  | { kind: 'concierge_teleport'; threadId: string; messageId?: string }
  /** 取：原地 inline 展开 anchor 前后往来原文（不离开当前页） */
  | { kind: 'concierge_peek'; threadId: string; messageId: string }
  /** 传话：cross_post 投递 + 注册回执监听 */
  | {
      kind: 'concierge_relay';
      targetThreadId: string;
      targetCats: string[];
      originalText: string;
      sourceMessageId: string;
    }
  /** 跟去：teleport 到目标 thread 跟进 */
  | { kind: 'concierge_go'; targetThreadId: string };

// ---------------------------------------------------------------------------
// RelayReceipt — §1a state machine (lifecycle owner = POST /api/concierge/relay)
// ---------------------------------------------------------------------------

/**
 * RelayReceipt 状态：
 *   draft(确认卡渲染) → confirmed(用户点传话) → dispatched(cross_post 成功)
 *                                              ↘ dispatch_failed(可手动重试 → confirmed)
 *
 * INV R1: 先落记录再投递（crash window 内可恢复）
 * INV R2: dispatch_failed 手动重试，不自动重试
 * INV R3: 同一 receipt 重试用同一 clientMessageId（幂等）
 * INV R4: 仅 relay 端点写 relay 记录（旁路禁令）
 */
export type RelayReceiptStatus = 'draft' | 'confirmed' | 'dispatched' | 'dispatch_failed';

export interface RelayReceipt {
  id: string;
  userId: string;
  conciergeThreadId: string;
  targetThreadId: string;
  targetCats: string[];
  /** 用户原话全文（KD-3/KD-13：不是模型复述） */
  originalText: string;
  /** concierge thread 中的源消息 ID */
  sourceMessageId: string;
  /** cross_post 幂等 key（INV R3） */
  clientMessageId: string;
  status: RelayReceiptStatus;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// PendingConfirmation — §1b state machine
// ---------------------------------------------------------------------------

/**
 * PendingConfirmation 状态：
 *   rendered → confirmed(执行一次) | cancelled(变灰)
 *   刷新后从持久层重建可点性
 *
 * INV C1: 点击即 disabled，double-click 不双发
 * INV C2: payload 自包含，执行 deterministic，不回查模型
 * INV C3: 确认/取消状态持久化，刷新后保持
 * INV C4: 未知 action 走 CardBlock:102 现有 warn 路径
 */
export type ConfirmationStatus = 'rendered' | 'confirmed' | 'cancelled';

export interface PendingConfirmation {
  id: string;
  userId: string;
  messageId: string;
  action: ConciergeCardAction;
  status: ConfirmationStatus;
  createdAt: number;
  updatedAt: number;
}
