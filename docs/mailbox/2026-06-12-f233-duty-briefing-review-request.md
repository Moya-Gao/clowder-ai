---
feature_ids: [F233]
related_features: [F167, F194]
doc_kind: review-request
created: 2026-06-12
---

# F233 Phase A — Duty Briefing Review Request

**Review-Target-ID:** f233
**Branch:** feat/f233-duty-briefing
**Author:** opus-48（宪宪）
**Reviewer:** @gpt52（缅因猫 GPT-5.4，跨族）
**Date:** 2026-06-12
**PR scope:** F233 Phase A 值班简报 MVP（纯增量：8 service 文件 + 1 route + index.ts wiring + shared DTO + 8 测试文件）

---

## Original Requirements（铲屎官原话，docs/features/F233-ball-custody-observability.md §Why）

> "球到底在谁手上我不知道。有时候我 @ 了一只猫，它说收到，然后就没有然后了。过几天我才想起来，一查发现球早就掉了。"
> "我要的不是又一个 dashboard 让我去刷。我要的是它主动告诉我：这些球掉了，这些球老了，这些球在空转。"

**请 reviewer 对照判断**：实现是否真的把"掉球"主动摆到 CVO 面前（而非又一个要刷的面板）。

## Architecture Ownership（F191）

- **Architecture cell:** `hub-action-surface`
- **Map delta:** none
- **Why:** 只读聚合 + rich block surface 全在既有 cell 边界内；球权事件流（new cell `ball-custody`）属 Phase B。
- **⚠️ 主动披露给 reviewer**：本 PR 新增 1 个 `Store`（`BriefingConfigStore`）。虽 Map delta=none，但这是 plan「Stateful Object Gate」已论证的**唯一必要新存储**（单 key Redis config，简报 thread 绑定）。KD-5 派生值零存储下唯一豁免——请 reviewer 确认这个新 Store 的合理性，以及 `degraded` 派生态确实零存储（实时投影）。

## 自检证据（Quality Gate Report 摘要）

| Step | 结果 |
|---|---|
| Step 0 VISION CHECK | ✅ AC-A1~A5 完整覆盖铲屎官 3 痛点（掉球无感/状态靠记忆/异常被淹没）|
| Step 0.5 DELIVERY | ✅ Phase A MVP 完整交付单元，Phase B/C 是规划非半成品 |
| Step 2.5 FOLLOW-UP SCAN | ✅ commit body 无阻塞尾巴；非 hotfix（全 feat/test commit）|
| Step 2.6 FALLBACK | ✅ 5 源各独立 try/catch = 横向并列降级，非纵向嵌套坐标系代偿 |
| Step 3 VERIFY（KD-4 只读）| ✅ collect 全只读（list/scan/get/snapshot）；aggregate 纯函数；唯一写=deliver 回调；invocation 死球用 `scanAll()` **绝不 reconcileZombies** |
| Step 7.5 ARTIFACT | ✅ 根目录无媒体工件（工作树+已提交差异）|

**验证命令输出（2026-06-12 本轮真实运行）：**
```
pnpm gate（5步聚合，env -u NODE_ENV 处理 production）→ ✅ gate passed
  [1/5] biome check ✅  [2/5] typecheck ✅  [3/5] build ✅  [4/5] unit ✅  [5/5] redis ✅
F233 测试子集（run-with-redis.mjs, 6398 ephemeral）→ tests 47 / pass 47 / fail 0（12 suites, 8.2s）
```

## AC↔实现映射

| AC | 实现位置 | 状态 |
|---|---|---|
| AC-A1 暴露 ≥1 掉球（三球同型）| collectDutyBriefingInput 5 源 + e2e fixture | ✅ |
| AC-A2 正常球只计数 | collect 源1/2 healthyCount + countHealthy | ✅ |
| AC-A3 晾龄降序+锚点+confidence | BallCustodyAggregator byAgeDesc + renderBriefingCard entryLine | ✅ |
| AC-A4 正文 ≤15 行截断 | renderBriefingCard MAX_BODY_LINES=15 + moreLine | ✅ |
| AC-A5 只读零副作用 | collect 全读接口 + generate 唯一写=deliver | ✅ |

## Open Questions（技术，给 reviewer）

1. **截断策略偏差**：实现为「死球优先 section 序 + section 内晾龄降序 + 尾部一刀切」。section 内符合 plan「晾龄升序先砍」，跨 section 是优先级序（plan 未明确）。实现版更合理（死球永不被截断），请确认可接受。
2. **rich block `card` kind schema**：`renderBriefingCard` 返回 `{kind:'card', v:1, id, title, lines}`。`lines` 字段是否被 card kind schema 接受、卡面能否正确渲染——靠 render 测试覆盖，真实卡面验收在 merge 后 alpha（plan Task 7）。请 reviewer 判断是否需 pre-merge 对照 `get_rich_block_rules`。
3. **Dogfood scope**：F233 是 user-visible（简报卡投递 thread），但完整 dogfood 依赖真实 runtime 异常数据 + cron 触发，plan Task 7 明确安排在 merge 后 `pnpm alpha:start`。pre-merge 用 e2e 测试（duty-briefing-e2e-redis：fixture→生成→投递→getByThread 真实查回→锚点正确）作为端到端替身。

## 价值 OQ（给 CVO）

无——surface / 交互边界 / 分工已全部 CVO 拍板（spec OQ-1 ✅、KD-6、Review Gate 段）。

## Reviewer 沙盒

```
Review-Target-ID: f233
Branch: feat/f233-duty-briefing
沙盒路径: /tmp/cat-cafe-review/f233/gpt52
启动: pnpm review:start（自动分配隔离端口 3201/3202）
```

## 我最可能错在哪（pre-register 撤回条件）

1. 截断策略跨 section 的"死球优先"如果让低优先级但高晾龄的搁置球被砍掉 → 可能漏掉真正该看的球（AC-A1 的"≥1 掉球"反而被截断）。
2. `card` kind 若不接受 `lines` → 卡面渲染失败，e2e 测的是 payload 结构不是真实渲染，可能假绿。
3. INV-5 当日重发判定在投递层（hasBriefingToday），若 metadata 标记口径与查询口径不一致 → 重复发卡或永不发（in-memory 测不到 Redis 索引差异，参 LL feedback_inmemory）。
