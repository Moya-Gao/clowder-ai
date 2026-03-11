# Cross-Thread Sync Skill 提案 v2

**提出者**: 布偶猫 (Opus 4.6)
**日期**: 2026-03-11
**状态**: v2 — 缅因猫 (GPT-5.4) 讨论收敛后定稿
**讨论 thread**: `thread_mmlv4v2oq6dxefr6`

---

## 问题

多个 session 并行工作时（同猫跨 thread 或 不同猫跨 thread），缺少协同指引：

1. **不知道怎么找到对方** — 不会用 `feat_index` / `list_threads` 定位平行 session
2. **不知道怎么通知对方** — 以为 thread 内说话对方能看到，实际需要 `cross_post_message`
3. **共享文件冲突** — 两个 session 改同一文件（BACKLOG、feature doc、源码），merge 时炸
4. **Feature 依赖无通知** — A 依赖 B 的 API，B 改了接口没告知 A，A 白做
5. **Ghost Thread Bug (P2, OPEN)** — cross-post 后 continuation 可能绑错 thread

## 设计决策（讨论收敛）

| # | 决策 | 来源 |
|---|------|------|
| 1 | **cross-post 是通知层，不是真相源** | GPT-5.4 P1 |
| 2 | **v1 不做文件级自动检测**，降级为 feature/thread 级 advisory | GPT-5.4 P1 |
| 3 | **3+2 升级制**：默认三件套，触碰 API/shared/不可逆 → 补 Why/Tradeoff | 共识 |
| 4 | **FYI / ACTION / BLOCKING** 三档同步级别 | GPT-5.4 补充 |
| 5 | **claim / 让路 / 升级** 争用协议 | GPT-5.4 补充 |
| 6 | **feat_index 优先** 发现机制 | GPT-5.4 补充 |
| 7 | **claim 要有 TTL / 释放条件** | GPT-5.4 P2 |
| 8 | **BLOCKING 要有超时升级路径** | GPT-5.4 P2 |
| 9 | **Ghost Thread 期间 cross-post 限定单次通知** | 共识 |
| 10 | **§15 阻塞依赖双写到可追溯状态** 进家规 | 共识 |

## Skill 骨架

### 核心流程

```
1. 发现 → feat_index + list_threads 找平行 session
2. 通知 → cross_post_message（3+2 件套 + FYI/ACTION/BLOCKING）
3. 协调 → claim / 让路 / 升级 争用协议
4. 确认 → FYI/ACTION 不等确认；BLOCKING 必须 ack + 超时升级
```

### 通知模板（3+2 升级制）

**默认三件套**（所有跨 thread 通知必须）：

| # | 项目 | 说明 |
|---|------|------|
| 1 | What Changed | 改了什么（文件路径 + 一句话） |
| 2 | Impact on You | 对你的影响 |
| 3 | Action Needed | `[FYI]` / `[ACTION]` / `[BLOCKING]` + 具体动作 |

**升级到五件套**（触碰以下任一 → 必须补 Why + Tradeoff）：
- API 契约变更（接口签名、入参出参）
- `packages/shared/**` 改动
- 共享状态文件（BACKLOG、feature doc status、cat-config.json）
- 不可逆决策（schema migration、数据删除）

### 争用协议

```
1. Claim: cross-post 声明 "我要改 X 文件"
   - 内容：threadId + 文件/范围 + claimedAt
   - TTL：完成后显式释放；超时未释放自动失效
2. 让路: 收到 claim 的 session 如果也要改，停下等对方完成
3. 升级: 双方都不能让 → 升级铲屎官决定优先级
```

### BLOCKING 超时升级

```
BLOCKING 发出 → 等 ack
  ├─ 收到 ack → 继续
  └─ 超时未 ack → 升级铲屎官（不能无限挂起）
```

### Ghost Thread 保守规则

- cross-post 只用于**单次通知**，不做来回对话
- BLOCKING 信息必须双写到可追溯状态（feature doc / workflow / task）
- 不做自动 hook 广播（避免路由 bug 扩大）

## 家规候选

**§15**: 跨 thread 的阻塞依赖不能只留在消息里，必须同时写入 feature doc / workflow / task 等可追溯状态。

## 和其他 skill 的关系

| Skill | 何时用 | 区别 |
|-------|--------|------|
| **cross-thread-sync** | 平行 session 之间的持续协同 | 3+2 件套、争用协议、FYI/ACTION/BLOCKING |
| `cross-cat-handoff` | 不同猫之间的一次性工作交接 | 完整五件套、知识转移、角色切换 |
| `parallel-execution` | 单 session 内分发多个 subagent | session 内部调度，不涉及跨 thread |
