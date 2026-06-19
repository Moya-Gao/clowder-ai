/**
 * F245 Phase A — Friction Signal 结构化类型
 *
 * 把分散的摩擦信号（爪感差 marker / cancel / 用户反馈 / eval domain）统一成
 * 结构化值对象，供 harness-eval friction rollup 消费。
 *
 * 本文件只定义跨包共享的「值类型」；source port（IFrictionSignalSource）在 api 层
 * `harness-eval/friction/friction-signal-source.ts`（依赖 RedisMessageStore，不进 shared）。
 *
 * 注意：FrictionChannel 是 F245 自有通道枚举，独立先行；与 F236 的
 * domainId/sourceAdapter 注册枚举无关（Phase C 协调，勿混用）。
 */

/** 摩擦信号来源通道。Phase A 仅实现 'paw-feel'，其余 Phase B 起补齐。 */
export type FrictionChannel = 'paw-feel' | 'cancel' | 'user-feedback' | 'eval-domain';

/** 摩擦严重度。Phase A 采集层默认 'medium'，severity 推断留 Phase B。 */
export type FrictionSeverity = 'low' | 'medium' | 'high';

/**
 * 结构化摩擦信号——不可变值对象（DTO），无生命周期状态（无 draft→confirmed 流转）。
 * 幂等靠 deterministic `id`，零持久去重存储。
 */
export interface FrictionSignal {
  /** 幂等键，deterministic：`${channel}:${rawRef}`（同 message+marker → 同 id） */
  id: string;
  /** 来源通道 */
  channel: FrictionChannel;
  /** 触发摩擦的猫（可选，部分通道无归属） */
  catId?: string;
  /** 摩擦发生的 thread（可选） */
  threadId?: string;
  /** 信号时间戳，ISO8601 */
  timestamp: string;
  /** 解析出的工具名；解析失败或措辞无明确工具 = undefined（宁缺勿误拆） */
  tool?: string;
  /** 人话现象描述（marker 内容主体） */
  symptom: string;
  /** 回指源：`${messageId}#${markerIndex}`，幂等键的可追溯部分 */
  rawRef: string;
  /** 严重度。Phase A 采集层默认 'medium' */
  severity: FrictionSeverity;
  /** 原文摘录（整条 marker 文本），便于人工核查 */
  sourceEvidence?: string;
}
