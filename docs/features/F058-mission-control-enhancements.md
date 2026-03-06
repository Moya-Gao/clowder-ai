---
feature_ids: [F058]
related_features: [F049, F037]
topics: [mission-control, backlog, reliability, ux]
doc_kind: spec
created: 2026-03-04
---

# F058: Mission Control 增强（F049++）

> **Status**: in-progress
> **Owner**: 布偶猫
> **Priority**: P1
> **依赖**: F049（Mission Control MVP 已合入）
> **Evolved from**: F049（MVP 使用中发现的 bug + 增强需求）

## 愿景

> **一句话**：指挥中心从"能用"进化到"好用"——做完的看得见，依赖关系画得出，派发不怕崩。

F049 MVP 让铲屎官有了一个任务指挥中心，但实际使用中暴露了三个 bug 和五个增强点。这个 Feature 把它们打包解决。

### 铲屎官原话（2026-03-04）

> "我发现我们的 f49 有 bug？现在 ft 同步好像只会增量 比如有 ft close 了他也不会更新，也不列出我们做完的 以及 feat 原本元数据就有依赖的 这个能不能也画出来？"
> "我觉得我们可以做一个 f49 ++ 单独的立项？新的 id 依赖 f49"

## Why（问题分析）

### Bug：指挥中心的数据盲区

| 维度 | 当前状态 | 缺口 | 风险 |
|------|---------|------|------|
| Feature 完成同步 | 导入只增不减 | 做完的 feature 从 BACKLOG 移除后，指挥中心还显示旧状态 | 🔴 高 |
| 完成状态 | BacklogStatus 无 `done` | 无法标记、展示、统计已完成工作 | 🔴 高 |
| 依赖关系 | Feature 文档有但不展示 | 铲屎官看不到 feature 间的依赖/演化关系 | 🟡 中 |

### 增强：指挥中心的可靠性与可用性

| 维度 | 当前状态 | 增强目标 |
|------|---------|---------|
| 派发原子性 | 多步分离操作，崩溃留半吊子状态 | Lua/CAS 原子化 |
| 消息幂等 | idempotencyKey 有临时值兜底 | 硬前置 + TTL lock |
| 态势图 | 单任务→单 thread | Feature→多 thread 鸟瞰 |
| 查询防御 | 无 ID 数量上限 | 加 N 上限 |
| 时间显示 | 只有相对时间 | hover 绝对时间 |

## What

### Phase A：Bug 修复（必做，高优先）

#### A1: 加 `done` 状态 + 完成转换

给 `BacklogStatus` 加第五个值 `done`，支持 `dispatched → done` 转换。

```typescript
// 现在
export type BacklogStatus = 'open' | 'suggested' | 'approved' | 'dispatched';

// 改后
export type BacklogStatus = 'open' | 'suggested' | 'approved' | 'dispatched' | 'done';
```

UI 上加一个"已完成"折叠区（默认收起），展示已完成的 backlog item。

#### A2: 导入同步"消失 = 完成"

`POST /api/backlog/import-active-features` 增加逻辑：
- 导入后，对比 Redis 中已有 item 和 BACKLOG.md 活跃表
- 在 BACKLOG.md 中消失、但 Redis 中仍为 `dispatched` 的 item → 自动标 `done`
- 同时读 `docs/features/*.md` 中 `Status: done` 的 feature，对应 item 也标 `done`

#### A3: 依赖关系展示

- 从 feature 文档 frontmatter 提取 `related_features` + 正文 Dependencies 段的 `Evolved from` / `Blocked by` / `Related`
- `BacklogItem` 类型加 `dependencies?: { evolvedFrom?: string[]; blockedBy?: string[]; related?: string[] }`
- UI 上每个 backlog item 卡片显示依赖标签（如"← F049"），点击可跳转

### Phase B：可靠性增强（高优先）

#### B1: 派发原子化

approve→dispatch 的多步操作（改状态→开 thread→写消息→标记完成）用 Lua 脚本做原子化。要么全成功，要么全不动。

#### B2: 消息幂等硬化

- `dispatchAttemptId ?? 'pending'` 改成硬前置（无 attemptId 直接报错）
- Redis idempotency 的"key 在但 message 丢失"分支升级成 in-flight TTL lock

### Phase C：态势图与 UX 增强（中/低优先）

#### C1: Feature 鸟瞰态势图

从"单 backlog item → 单 thread"升级到"一个 Feature → 多 thread"的聚合视图。一眼看到"F049 一共开了 5 个 thread，3 个在跑、1 个等 review、1 个已合入"。

数据来源：`feat_index` + threads 的 `backlogItemId` 反查。

#### C2: 查询安全限制

`/api/threads?backlogItemIds=...` 加 ID 数量上限（如 50），防止大量 ID 拖慢响应。

#### C3: 时间显示优化

态势图"最近活跃"的相对时间加 `title` tooltip 显示绝对时间（如 `2026-03-04 08:15`）。

### Phase D：导入状态映射 + Layout 修复（铲屎官实测发现的 bug）

> 2026-03-05 铲屎官实测截图暴露两个 Phase A 遗漏 bug。Phase A～C 代码审查全绿、云端 review 全通过，但布偶猫"愿景守护"只 grep 了代码就打勾，没有实际验证产品效果。铲屎官原话："明明不能用！刷新之后都进度不对吧？右下角那些东西看都看不到！你还不能 done"。

#### D1: 导入状态映射

**问题**：`buildBacklogInputFromFeature` 把 BACKLOG.md 的 `in-progress`/`in-review` 只存到 tags（`status:in-progress`），但 BacklogItem 的 `status` 永远是 `'open'`。导致 27 个 item 全堆在 Open 栏，Suggested/Dispatched 全空。

**修复方案**：导入时根据 BACKLOG.md 的 feature status 映射到合理的 BacklogStatus：
- `in-progress` → `dispatched`（正在做）
- `in-review` → `dispatched`（在 review 也是在做）
- `done` → `done`
- 其他（`spec`/`idea`/`planning`）→ `open`

对已存在的 item，refresh 时也同步更新 status（仅从 open→dispatched 方向，不降级）。

#### D2: 右侧面板 Layout 修复

**问题**：右侧 320px 放了 SuggestionDrawer + ThreadSituationPanel + FeatureBirdEyePanel，SuggestionDrawer 占满空间，后面两个面板被 `overflow-hidden` 截断，完全看不到。

**修复方案**：右侧面板加 `overflow-auto`，让三个面板都可滚动访问。

### 不做的事（明确排除）

| 提议 | 决定 | 理由 |
|------|------|------|
| 自动同步（无需点按钮） | ❌ 不做 | 增加后台轮询复杂度，手动刷新足够 |
| 依赖关系可视化图谱 | ❌ 不做 | 标签展示已够用，图谱是过度设计 |
| 跨 Feature 甘特图 | ❌ 不做 | 不是项目管理工具 |

## Acceptance Criteria

### Phase A（Bug 修复）
- [x] AC-A1: `BacklogStatus` 包含 `done`，`dispatched → done` 转换可用
- [x] AC-A2: 导入同步时，BACKLOG.md 中消失的 feature 对应 item 自动标 `done`
- [x] AC-A3: UI 有"已完成"折叠区，展示 done 状态的 item
- [x] AC-A4: `BacklogItem` 支持 `dependencies` 字段
- [x] AC-A5: UI 卡片显示依赖标签（可点击跳转）
- [x] AC-A6: `docs/features/*.md` 中 `Status: done` 的 feature 导入时也同步为 `done`

### Phase B（可靠性）
- [x] AC-B1: approve→dispatch 全链路原子化（Lua 脚本）
- [x] AC-B2: `dispatchAttemptId` 硬前置（无值报错）
- [x] AC-B3: Redis idempotency 升级为 TTL lock

### Phase C（UX）
- [x] AC-C1: Feature 鸟瞰态势图：聚合显示一个 Feature 下的多个 thread 状态
- [x] AC-C2: `/api/threads?backlogItemIds=...` 限制 ID 数量上限
- [x] AC-C3: 态势图相对时间加绝对时间 tooltip

### Phase D（实测 bug 修复）
- [x] AC-D1: 导入时 `in-progress`/`in-review` feature 映射为 `dispatched` 而非 `open`
- [x] AC-D2: 右侧面板（ThreadSituationPanel + FeatureBirdEyePanel）可见、可滚动

### Phase E（UX 收尾）
- [ ] AC-E1: Mission Hub 有"← 返回"按钮可回到对话页
- [ ] AC-E2: 线程态势面板无关联 thread 的项目紧凑显示 + 面板内滚动（max-h-64）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "ft close 了他也不会更新" | AC-A1, AC-A2, AC-A6 | test（导入后 done 状态 + UI 展示） | [x] |
| R2 | "也不列出我们做完的" | AC-A3 | test + screenshot（已完成折叠区） | [x] |
| R3 | "feat 原本元数据就有依赖的 能不能也画出来" | AC-A4, AC-A5 | test + screenshot（依赖标签） | [x] |
| R4 | 派发防崩溃（砚砚增强列表） | AC-B1 | test（Lua 原子化回归） | [x] |
| R5 | 消息不重复更可靠（砚砚增强列表） | AC-B2, AC-B3 | test（幂等回归） | [x] |
| R6 | 态势图升级（砚砚增强列表） | AC-C1 | test + screenshot（鸟瞰视图） | [x] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（AC-A3/A5/C1 需截图）

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F049-mission-control-backlog-center.md` | 上游：MVP 实现 |
| **Feature** | `docs/features/F037-agent-swarm.md` | 上游：协同范式（态势图升级相关） |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Bug 修复（Phase A）和增强（Phase B/C）分开 Phase | Bug 是必须修的，增强可以按优先级排 | 2026-03-04 |
| KD-2 | 依赖展示用标签而非图谱 | 够用且实现简单，图谱是过度设计 | 2026-03-04 |
| KD-3 | `done` 作为第五个 BacklogStatus | 最小改动，符合现有状态机模式 | 2026-03-04 |

## Dependencies

- **Evolved from**: F049（Mission Control MVP，已 done）
- **Related**: F037（Agent Swarm，态势图升级需要其数据模型）

## Risk

| 风险 | 缓解 |
|------|------|
| `done` 状态加入后影响现有状态转换 | 只允许 `dispatched → done`，不影响其他转换 |
| 导入"消失=完成"误判（临时从 BACKLOG 移除但未 done） | 只对 `dispatched` 状态的 item 自动标 done，其他状态不动 |
| Lua 原子化增加 Redis 依赖复杂度 | 保留现有非原子路径作 fallback |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | "已完成"区是折叠区还是独立 tab？ | ✅ 折叠区（默认收起）— PR #225 |
| OQ-2 | 依赖标签点击跳转到哪？feature 文档还是 backlog item？ | ✅ 显示标签，跳转 feature 文档 — PR #225 |
| OQ-3 | 鸟瞰态势图是在指挥中心内嵌还是独立页面？ | ✅ 内嵌在指挥中心 — PR #228 |

## Review Gate

- Phase A: 跨家族 review（缅因猫）
- Phase B: 跨家族 review（缅因猫）+ Redis 专项验证
- Phase C: 前端部分额外需要暹罗猫视觉 review

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-04 | 铲屎官报告三个 bug（同步/完成状态/依赖），结合砚砚增强列表立项 F058 |
| 2026-03-05 | Phase A 合入 main (PR #225) — done 状态 + 导入同步 + 依赖展示 |
| 2026-03-05 | Phase B 合入 main (PR #226) — atomic Lua + hard attemptId + TTL lock |
| 2026-03-05 | Phase C 合入 main (PR #228) — bird eye panel + query limit + time tooltip |
| 2026-03-05 | F058 全部 12 AC 验证通过，标记 done |
| 2026-03-05 | 🔴 铲屎官实测发现两个 bug：导入状态全是 open + 右侧面板看不到。回退 done→in-progress，追加 Phase D |
| 2026-03-05 | Phase D 合入 main (PR #236) — status mapping + layout overflow fix |
| 2026-03-05 | Phase E：铲屎官反馈无退出按钮 + 线程态势面板截断。追加 back button + 紧凑无 thread 卡片 + 面板内滚动 |
