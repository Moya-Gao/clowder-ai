# F233 Phase A — 值班简报 MVP Implementation Plan

**Feature:** F233 — `docs/features/F233-ball-custody-observability.md`
**Goal:** 每天 07:00（CVO 时区）一张只读值班简报 rich block 卡自动出现在固定「值班简报」thread（+ on-demand 呼出），用真实 runtime 数据暴露掉球异常（搁置/死球/超龄 blocked/虚空传球），正常球只计数。
**Acceptance Criteria:** AC-A1（暴露 ≥1 件 CVO 不知道的掉球，fixture=spike 三球同型，全结构化面）/ AC-A2（正常球不出现正文仅计数）/ AC-A3（候选区晾龄降序+锚点+confidence 标记可区分）/ AC-A4（默认态正文 ≤15 行）/ AC-A5（生成全程只读零写副作用）
**Architecture cell:** `hub-action-surface`
**Map delta:** none
**Map delta why:** 只读聚合 + rich block surface 全在既有 cell 边界内；事件流（new cell `ball-custody`）属 Phase B，本 Phase 不建。
**Architecture:** 一个纯投影聚合器（BallCustodyAggregator，零新存储）从 5 个现存数据源收集球权异常 → DutyBriefing DTO → rich block 渲染 → 投递到绑定 thread。cron 复用 F160 scheduled-task 体系。
**Tech Stack:** packages/api（service + route）、packages/shared（DTO types）、rich block（card kind）、Redis-backed 测试（`pnpm --filter @cat-cafe/api test:redis`）
**前端验证:** No（rich block 走现有渲染管线，无新前端组件；AC-A4 人工看卡）

---

## ⚠️ Coder 必读：从 spec 复制过来的硬边界（不是参考，是约束）

1. **KD-4 只读**：聚合全程零写副作用（唯一写 = 发简报消息本身）。AC-A5 是 reviewer 检查项。
2. **KD-6 卡面交互诚实**：Phase A 卡上**零按钮**——唯一交互 = 条目锚点跳转。不要"顺手"加任何动作控件。
3. **KD-3 异常优先**：🟢 健康球永远只有一行计数，不列条目。
4. **R1 数据分级**：mention 面（`mentionsUser` boolean）只产 `confidence: 'heuristic'` 候选；task/invocation/F167 面是 `'structured'`。卡面两者视觉可区分。
5. **派生值规则**：一切状态能用纯投影（查询现存数据）表达的，禁止落新存储。Phase A 唯一新存储 = briefing thread binding 配置（见 Stateful Object Gate）。

## Straight-Line Check

- **B 终点**：上述 Goal 一句话 + 5 条 AC。
- **NOT building**（防 scope 蔓延）：动作按钮 / 球权事件流 / probe 字段 / intent 字段 / 轨迹视图 / Hub 面板 / 安乐死通道——全部属 Phase B/C。
- **终态 schema 先行**（Task 1，所有后续步骤围绕它，无丢弃式脚手架）。

## Stateful Object Gate（普查）

Phase A 是纯投影设计，普查结果：**2 个有生命周期对象**（均极小，但按 F229 教训给全三件套）：

### 对象 1：BriefingThreadBinding（简报 thread 绑定配置）

唯一 lifecycle owner：`BriefingConfigStore`（packages/api，单 key Redis config）。旁路 API（thread 删除）不感知 binding——靠投递时校验自愈。

**状态×事件转移表：**

| 当前态 | 事件 | 次态 | 动作 |
|---|---|---|---|
| `unbound` | CVO/猫执行绑定（设置 threadId） | `bound` | 写 config |
| `bound` | 投递时 thread 存在 | `bound` | 正常投递 |
| `bound` | 投递时 thread 不存在/已删 | `degraded` | **不静默**：投递降级到触发来源 thread（on-demand 场景）或记 error log + 跳过（cron 场景），下次简报头部带"⚠️ 绑定失效"行 |
| `degraded` | 重新绑定 | `bound` | 写 config |

**不变量：**
- INV-1：任意时刻至多一个 active binding（单 key 天然满足，测试断言重复绑定 = 覆盖而非累加）
- INV-2：binding 失效不静默吞简报（对抗测试：删 thread 后触发生成，断言 error 路径可见）
- INV-3：绑定操作不自动创建 thread（thread 由 CVO 手动建好后绑定，避免猫乱开 thread——F128 边界）

### 对象 2：cron 注册（复用 F160 scheduled-task 体系）

生命周期归 F160 体系管，本 Phase 只是注册方。
- INV-4：注册幂等——同 key（`f233-duty-briefing-daily`）重复注册 = upsert，不产生双 cron（对抗测试：注册两次 → 触发一次只发一卡）
- INV-5：**当日重发判定用纯投影**——cron 触发时查绑定 thread 当日是否已有简报卡消息（按消息 metadata 标记），已有则跳过。**零新存储**（不建 last-sent 表）。

**对抗场景测试清单：**
1. thread 删除后 cron 触发（INV-2 路径）
2. 双 cron 并发触发同日（INV-5：第二发查到已有卡 → 跳过；竞态窗口内重复发卡可接受为 P2，不做分布式锁——YAGNI，简报重复无害）
3. 数据源之一不可用（如 F167 telemetry 读取失败）→ **部分降级**：该分区显示"数据源不可用"，整卡照发不崩（每 collector 独立 try/catch）

## Tasks

> 节奏：每 Task 内 TDD（失败测试 → 最小实现 → 绿 → commit）。Redis-backed store 查询一律用 `pnpm --filter @cat-cafe/api test:redis`（in-memory 假绿教训）。

### Task 0：数据源探查 Spike（time-boxed ≤半天，输出是结论不是交付物）🔴

> 为什么第一步是这个：plan 作者（fable）只实测过 task 面（list_tasks），其余数据源的**真实可读路径是假设**。凭印象开工 = F-coalesce 教训重演。逐源确认后**回写本 plan 的 Task 2 collector 清单**，砍掉不可达源。

| # | 数据源 | 要确认的 | 起点线索 |
|---|---|---|---|
| 1 | tasks（blocked/doing + 晾龄） | ✅ 已实测（kickoff spike 用过 list_tasks） | `TaskStore` ports |
| 2 | hold_ball 状态（活跃 hold + 过期） | 存储位置 / 可查询接口 | `callback-hold-ball-routes.ts`、F167 spec C1 |
| 3 | invocation 终态（error/spend-limit/timeout + 归属 thread/cat） | InvocationTracker / cliDiagnostics 的持久形态与查询面 | `dispatch` cell 文件清单、F212 |
| 4 | F167 telemetry（ping-pong streak / forced-pass / zombie-hold） | WorklistRegistry 与 friction counter 的持久化与读取路径 | `packages/api/src/infrastructure/harness-eval/f167-eval.ts` |
| 5 | mention 启发式（thread 尾部 @landy / mentionsUser） | MessageStore 查询面（按 thread 取尾部消息 + mentionsUser 过滤） | `MessageStore.ts:114`（gpt52 R1 已钉字段存在） |

产出格式（贴回本 plan 末尾附录）：每源一行 `可达性 ✅/❌ + 读取入口（文件:函数）+ 关键字段 + 样例值`。**❌ 的源从 Task 2 砍掉并在 PR 描述声明**（如 F177-G 守卫拦截若无持久化记录，虚空传球区降级为 F167 forced-pass 单源——诚实降级优于假数据）。

### Task 1：终态 Schema（packages/shared）

**Files:**
- Create: `packages/shared/src/types/duty-briefing.ts`
- Test: type-level（tsc）+ 后续 Task 消费

```ts
export interface DutyBriefing {
  generatedAt: number;
  bindingStatus: 'bound' | 'degraded';
  counts: { active: number; needsUser: number; dead: number; voidPass: number; staleBlocked: number };
  needsUser: BallEntry[];      // 晾龄降序
  deadBalls: BallEntry[];
  voidPasses: BallEntry[];
  staleBlocked: BallEntry[];   // Phase A 的"睡美人近似"：blocked 超龄（>7d）
  healthy: { count: number; oldestHeartbeatMs: number };
  degradedSources: string[];   // 部分降级时的数据源名
}

export interface BallEntry {
  kind: 'task' | 'mention-heuristic' | 'invocation-death' | 'void-pass' | 'stale-blocked';
  confidence: 'structured' | 'heuristic';   // R1 数据分级，卡面视觉区分
  title: string;
  ageMs: number;
  anchor: { threadId?: string; messageId?: string; taskId?: string };
  detail?: string;             // 死球带"最后扫描点"，如 "末扫 03:08 spend-limit"
}
```

改 shared 后跑 `pnpm --filter @cat-cafe/shared build`（家规）。Commit。

### Task 2：BallCustodyAggregator（纯投影聚合器）

**Files:**
- Create: `packages/api/src/domains/cats/services/duty-briefing/BallCustodyAggregator.ts`（按 Task 0 结论组织 collectors，每源一个函数：`collectNeedsUser` / `collectDeadBalls` / `collectVoidPasses` / `collectStaleBlocked` / `countHealthy`）
- Test: `packages/api/test/duty-briefing-aggregator.test.js`（Redis-backed）

TDD 顺序（每个 collector 一轮红绿 + commit）：
1. **AC-A1 fixture 先行**：注入 spike 三球同型数据（① blocked task 30 天 owner=codex ② invocation error 终态 + 该猫该 thread 后续无消息 ③ F167 forced-pass 事件）→ 断言三球分别落入 staleBlocked / deadBalls / voidPasses，confidence 全 `structured`
2. **AC-A2**：注入正常活跃球（猫接球后持续有消息）→ 断言不出现在任何异常区、healthy.count 计入
3. **AC-A3 排序**：多球注入 → needsUser 按 ageMs 降序；mention 启发式候选 confidence='heuristic'
4. **部分降级**：mock 单 collector 抛错 → briefing 照常返回 + degradedSources 含该源名（对抗场景 3）
5. **AC-A5 只读**：测试收尾断言聚合前后 store 写计数为零（或 reviewer 走查数据访问面——两者择可行者，Task 0 后定）

死球判定 v1（钉死阈值，可调参数化）：invocation 终态 ∈ {error, killed, timeout} 且该 catId 在该 threadId 此后 **≥2h** 无任何消息。超龄 blocked 阈值：**>7d**。阈值放 config 常量，不硬编码散落。

### Task 3：BriefingThreadBinding（唯一新存储）

**Files:**
- Create: `packages/api/src/domains/cats/services/duty-briefing/BriefingConfigStore.ts`
- Test: 同上 test 文件追加（Redis-backed）

按上方转移表逐态测试：绑定 / 覆盖绑定（INV-1）/ thread 不存在时投递走 degraded 路径且不静默（INV-2，对抗场景 1）/ 不自动建 thread（INV-3）。

### Task 4：rich block 渲染器

**Files:**
- Create: `packages/api/src/domains/cats/services/duty-briefing/renderBriefingCard.ts`
- Test: 快照测试（DutyBriefing fixture → card payload）

约束（先取 `cat_cafe_get_rich_block_rules` 对齐 schema——字段 `kind`/`v`/`id` 不是 `type`）：头部计数行 → 三异常区（每球一行：标题 + 晾龄 + 锚点链接 + heuristic 标记）→ 🟢 一行收口。**默认态正文 ≤15 行**（AC-A4：条目超限时截断 + "另有 N 条"行，截断顺序 = 晾龄升序先砍）。**零按钮**（KD-6）。

### Task 5：route + cron 注册

**Files:**
- Create: `packages/api/src/routes/duty-briefing.ts`（on-demand 生成 + 绑定管理，挂 `hub-action-surface` cell 既有 route 注册面）
- Modify: F160 schedule 注册点（Task 0 确认具体文件）——注册 `f233-duty-briefing-daily`，默认 07:00 America/Los_Angeles
- Test: route 测试 + INV-4 幂等（注册两次单卡）+ INV-5 当日已发跳过（纯投影判定，对抗场景 2）

### Task 6：e2e 信号链

Fixture 注入 → cron/on-demand 触发 → 绑定 thread 收到卡 → 卡内锚点指向正确 thread/task/message。覆盖 AC-A1+A3 全链。

### Task 7：收尾

- `pnpm gate` 全绿 → quality-gate skill 自检（含 AC↔实现映射表）→ request-review（reviewer：缅因猫，R1 起 gpt52）
- alpha 验收：merge 后 `pnpm alpha:start`，真数据生成一张卡，AC-A4 人工 10 秒读完测试 + 截图存档
- merge-gate Step 7.5 同步 spec Phase A 状态

## AC 映射

| AC | 落点 |
|---|---|
| AC-A1 | Task 2.1 fixture + Task 6 e2e |
| AC-A2 | Task 2.2 |
| AC-A3 | Task 2.3 + Task 4 渲染 |
| AC-A4 | Task 4 ≤15 行截断 + Task 7 alpha 人工 |
| AC-A5 | Task 2.5 + reviewer 数据访问面走查 |

## Open Questions

- **技术 OQ（48 自决）**：rich block 具体 kind 选型；invocation"后续无消息"查询的索引方式；阈值常量归置。
- **价值 OQ**：无——surface / 交互边界 / 分工已全部 CVO 拍板（spec OQ-1 ✅、KD-6、Review Gate 段）。
- **探查后修订**：Task 0 结论若砍源（尤其 F167 telemetry 读取面、F177-G 持久化），回写本 plan + PR 描述声明，**不需要回 CVO**（诚实降级是 plan 内置路径）。

## 风险与回退

| 风险 | 处置 |
|---|---|
| Task 0 发现关键源不可读（如 invocation 终态无查询面） | 该区降级 + plan 回写；若 needsUser+staleBlocked 两区都立不起来（task 面已实测可达，概率低）→ 停，回 fable 重排 Phase |
| 死球误报刷屏 | 阈值常量可调 + Eval Contract friction metric 兜底（连续一周 ≥1/3 假阳性 → 校准） |
| 回滚 | Phase A 全部增量代码 + 1 个 config key + 1 个 cron 注册，单 PR revert + 注销 cron 即净回滚 |
