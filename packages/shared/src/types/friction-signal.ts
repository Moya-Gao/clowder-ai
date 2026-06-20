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

/**
 * F245 Phase B — 聚类成员（回指某条 FrictionSignal，保留可追溯锚点）。
 */
export interface FrictionClusterMember {
  /** 成员 FrictionSignal.id */
  signalId: string;
  /** 回指源（messageId#idx / signalRowId / issueId / verdictId#component#metric） */
  rawRef: string;
  /** 成员来源通道 */
  channel: FrictionChannel;
}

/**
 * F245 Phase B — 摩擦聚类。同类信号折叠成 1 cluster（含 count + 成员 evidence refs）。
 * 不可变值对象，无生命周期状态（KD-5 内存聚合，不持久化）。
 */
export interface FrictionCluster {
  /** deterministic：sha1(归一化 cluster key) 前 12 位 */
  clusterId: string;
  /** 代表 symptom（最高频成员，cluster 标题） */
  representative: string;
  /** 成员涉及的通道（去重升序）；跨通道出现 = 强信号（Phase C 排序用 channel diversity） */
  channels: FrictionChannel[];
  /** 成员数（=== members.length） */
  count: number;
  /** 成员 evidence refs */
  members: FrictionClusterMember[];
  /** 此 cluster 由哪层聚出（rule 精确归一 / embedding 语义近似），便于误聚合归因 */
  method: 'rule' | 'embedding';
}

/**
 * F245 Phase B — Friction rollup 的纯函数输入（Phase C rollup 消费）。
 * 给定窗口 → dedup 后全量 signals + cluster 列表 + degraded 标志。可独立测试（fixture → 断言）。
 */
export interface FrictionRollupInput {
  /** 采集窗口 [sinceMs, untilMs) */
  window: { sinceMs: number; untilMs: number };
  /** dedup + intent-filter 后的全量 signal（cluster 成员的并集 ⊆ 此） */
  signals: FrictionSignal[];
  /** 聚类结果 */
  clusters: FrictionCluster[];
  /** 不完整标志：embedding 降级 OR 有采集通道抛错被丢。Phase C 不应把 degraded rollup 当完整发布 */
  degraded: boolean;
  /** 抛错被降级跳过的采集通道（degraded 的明细，便于 Phase C 知道缺了哪个通道；无丢则 []） */
  droppedChannels: FrictionChannel[];
}
