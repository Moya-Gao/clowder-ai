# F245 Phase A — 爪感差采集器 (PawFeelAdapter) Implementation Plan

**Feature:** F245 — `docs/features/F245-friction-signal-eval.md`
**Goal:** 回扫 message store，把 `[爪感差: 工具+现象]` 自由文本 marker 提取成结构化 `FrictionSignal[]`。
**Acceptance Criteria:**
- AC-A1: 爪感差 marker 采集器——回扫消息提取 `[爪感差: …]`，结构化字段（catId/threadId/timestamp/tool/symptom），红→绿测试覆盖
- AC-A2: 采集覆盖验证——给定含 N 条爪感差的消息 fixture，采集出 N 条结构化 signal，precision/recall gate
**Architecture cell:** harness-eval
**Map delta:** update required
**Map delta why:** 新增 `harness-eval/friction/` 子目录（paw-feel-adapter）+ `shared/types/friction-signal.ts` 新类型；harness-eval cell canonical files 登记这些 anchor（Design Gate OQ-4）。
**Architecture:** `PawFeelAdapter implements IFrictionSignalSource`，`pull(since, until)` 枚举 active thread → `getByThread` 拉消息 → 正则提取 marker → 组装 `FrictionSignal`。**纯 pull，无持久状态**（KD-4 只读 rollup 域）。
**Tech Stack:** TypeScript, Redis message store (`RedisMessageStore.getByThread`), `IThreadStore`, vitest + Redis 隔离测试
**前端验证:** No（纯后端 adapter）

---

## Finish Line (A→B)

**B 定义**：`PawFeelAdapter.pull(sinceMs, untilMs): Promise<FrictionSignal[]>` 返回时间窗内全部爪感差 marker 的结构化 signal，幂等（同 message+marker → 同 signal id）。

**NOT building（Phase A 不做）**：
- ❌ dedup/cluster（语义聚合 → Phase B，砚砚：采集层只幂等，语义合并等 rollup）
- ❌ 其他 3 通道 adapter（Cancel/F222/EvalDomain → Phase B）
- ❌ FrictionAggregator / rollup sink / domain 注册（Phase C/D）
- ❌ 实时打标（KD：transport 不该有 domain 知识）

## Terminal Schema（步骤围绕它建，非脚手架）

```typescript
// packages/shared/src/types/friction-signal.ts
export type FrictionChannel = 'paw-feel' | 'cancel' | 'user-feedback' | 'eval-domain';
export type FrictionSeverity = 'low' | 'medium' | 'high';

export interface FrictionSignal {
  id: string;              // deterministic: `${channel}:${rawRef}` — 幂等键
  channel: FrictionChannel;
  catId?: string;
  threadId?: string;
  timestamp: string;       // ISO8601
  tool?: string;           // 爪感差 marker 解析出的工具名（解析失败 = undefined）
  symptom: string;         // 人话现象描述（marker 内容）
  rawRef: string;          // 回指源：`${messageId}#${markerIndex}`
  severity: FrictionSeverity;  // Phase A 默认 medium，severity 推断留 Phase B
  sourceEvidence?: string; // 原文摘录（整条 marker 文本）
}

// packages/api/src/infrastructure/harness-eval/friction/friction-signal-source.ts
export interface IFrictionSignalSource {
  readonly channelId: FrictionChannel;
  pull(sinceMs: number, untilMs: number): Promise<FrictionSignal[]>;
}
```

每步输出都 extend-only 进最终系统：FrictionSignal 类型 Phase B/C/D 复用；IFrictionSignalSource 是 4 adapter 共享 port；PawFeelAdapter 是其首个实现。

## Stateful Object Gate 普查（F229，缺普查 = gate 形同虚设）

**逐个列出 Phase A 涉及的对象 + 是否有生命周期：**

| 对象 | 有生命周期状态？ | 判定 |
|------|----------------|------|
| `PawFeelAdapter` | ❌ 纯 pull/transform，无字段状态 | 无状态机 |
| `FrictionSignal` | ❌ 不可变值对象（DTO），无 draft→confirmed 流转 | 无状态机 |
| message store | ✅ 但**已有、Phase A 只读**（不拥有、不写） | 非本 Phase 新状态 |
| 幂等去重 | ❌ deterministic id（messageId#markerIndex），**纯计算无持久存储** | 派生值规则：零存储 |

**普查结论**：Phase A **无新增有生命周期状态对象**——PawFeelAdapter 是无状态纯函数式 adapter，幂等靠 deterministic id（派生值，零存储 → 无失同步）。**不需要状态×事件转移表 / INV 清单 / 对抗场景三件套**。

> ⚠️ 注意 Phase B 起会出现状态对象（rollup sink 的 verdict artifact 持久化、N-day cadence 的 last-run gate）——那时 Stateful Object Gate 必须重做普查。Phase A 豁免仅限纯采集。

## TDD Tasks

### Task 1: FrictionSignal + IFrictionSignalSource 类型
- **Create**: `packages/shared/src/types/friction-signal.ts`（上述 schema）
- **Modify**: `packages/shared/src/types/index.ts`（export）
- Step: 写类型 → `pnpm --filter @cat-cafe/shared build` 通过 → commit

### Task 2: marker 提取纯函数（核心，AC-A1 + AC-A2 主战场）
- **Create**: `packages/api/src/infrastructure/harness-eval/friction/paw-feel-marker.ts`
- 函数 `extractPawFeelMarkers(text: string): { tool?: string; symptom: string; raw: string }[]`
- 提取逻辑：
  - 正则 `/\[爪感差[:：]\s*(.+?)\]/g` 抓每条 marker 内容
  - 内容解析 tool/symptom：含分隔符（`工具:现象` / `工具 现象`）→ 拆 tool+symptom；无明确工具 → tool=undefined, symptom=整段（46 警告：措辞自由，宁可 tool 留空也别误拆）
- **Step 1 (red)**: 写 fixture 测试——多种格式（`[爪感差: rg 噪音大]` / `[爪感差：hold_ball 重复唤醒]` / `[爪感差: 直接一句话现象]`），断言提取数 + tool/symptom 拆分
- **Step 2**: 跑测试 FAIL
- **Step 3 (green)**: 实现 extractPawFeelMarkers
- **Step 4**: 跑测试 PASS（precision: 正常文本不误抓 / recall: 所有 marker 抓到）
- **Step 5**: commit

### Task 3: PawFeelAdapter.pull（回扫组装）
- **Create**: `packages/api/src/infrastructure/harness-eval/friction/friction-signal-source.ts`（port）+ `paw-feel-adapter.ts`
- 依赖注入 `IThreadStore` + `RedisMessageStore`（构造器注入，便于 stub 测试）
- `pull(sinceMs, untilMs)`：枚举 active thread（IThreadStore）→ 逐 thread `getByThread` → 过滤 timestamp 窗口 → 对每条 message `extractPawFeelMarkers` → 组装 FrictionSignal（id=`paw-feel:${messageId}#${idx}`, channel='paw-feel', catId/threadId/timestamp 从 message, severity='medium'）
- **Step 1 (red)**: Redis 隔离测试（`test:redis`）——seed N 条含爪感差的 message 跨 M thread → pull → 断言 N 条 signal + 字段正确 + 时间窗过滤 + 幂等（重复 pull 同 id）
  - ⚠️ 必须 Redis-backed 测试，不能纯 in-memory stub（feedback_inmemory_store_tests_miss_redis_behavior）
- **Step 2-4**: red → green → pass
- **Step 5**: commit

### Task 4: precision/recall fixture（AC-A2 gate）
- **Create**: `packages/api/src/infrastructure/harness-eval/friction/__fixtures__/paw-feel-corpus.ts`
- 含已知 N 条爪感差 + 干扰项（正常含"["的文本 / 半截 marker / 嵌套括号）
- 断言：recall=N/N（全抓）+ precision（干扰项零误抓）
- **Step**: red → green → commit

## Open Questions（Phase A）
- **技术 OQ-A1**（自决）：tool/symptom 拆分用什么分隔启发式？→ 实现时定，fixture 驱动（先支持 `工具:` / `工具 ` 前缀，覆盖率不足再补）
- 无价值 OQ（无需 CVO）

## 下一步
plan commit → `worktree`（Redis 6398 隔离）→ `tdd` 实现 Task 1-4。
