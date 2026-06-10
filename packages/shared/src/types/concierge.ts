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
}

/** ConciergeConfig 默认值（dutyCatProfileId 由 API 层根据 roster 解析） */
export const CONCIERGE_CONFIG_DEFAULTS: Omit<ConciergeConfig, 'dutyCatProfileId'> = {
  enabled: true,
  skin: 'yarn-ball',
  displayName: '猫猫球',
  personaTone: '温暖、简短、不啰嗦',
  proactivePolicy: 'quiet-badge',
  muted: false,
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
  | { kind: 'concierge_relay'; targetThreadId: string; targetCats: string[] }
  /** 跟去：teleport 到目标 thread 跟进 */
  | { kind: 'concierge_go'; targetThreadId: string };
