---
feature_ids: [F183]
related_features: [F081, F123, F176, F184]
topics: [bubble, message-pipeline, identity-contract, reconcile, idb-cache, websocket, sequence-number, store-invariant]
doc_kind: decision
created: 2026-04-30
status: draft v1 — 三猫 Round 3 review pending
related: [F081, F123, F176, F183, F184, ADR-031]
---

# ADR-033: Bubble Pipeline Identity Contract — 消息气泡管线身份契约与不变量

> 状态：v1 草稿（2026-04-30，47 起草，吸收 Round 1 三猫素材；待 Round 3 review）
> 决策者：铲屎官 + 布偶猫(46/47) + 缅因猫(GPT-5.5) + 暹罗猫(Gemini)
> 触发：F183 立项 — F081 (done 2026-03-10) + F123 (done 2026-03-16) 修过的"气泡 bug"在新 provider / 新分支上反复发作，铲屎官 2026-04-30 报告 5 类症状（裂 / 不见 / F5 才正常 / F5 才出来 / 发完才出来）

## 背景

F081 (done) → F123 (done) → 至今"气泡 bug"以新 provider / 新 origin / 新 cache snapshot 的形式反复发作。F183 立项时四猫并行诊断 + 圆桌收敛同一根因：

1. **四个真相源在互相竞争**：MessageStore SoT / DraftStore TTL / IndexedDB / Zustand+Ledger
2. **identity 多键且按 provider/分支补 contract**：OUTER `parentInvocationId` (live broadcast) vs INNER `ownInvocationId` (formal persistence)，每加一个 provider 就要重写一次 #573 contract
3. **`messages` 写入口爆炸**：F081 audit 数过 104 个写入点；F123 KD-4 主动推迟"统一 MessageWriter"
4. **WebSocket fire-and-forget + 5min hard timeout**：in-process event bus 在长 invocation 下 backpressure (`dropped 32 events`)
5. **`mergeReplaceHydrationMessages()` 5 种匹配策略复杂度失控**：每加一种 origin 都要更新 merge

**根因是架构层欠债被反复 hotfix 包装，不是某一行代码写错**。本 ADR 沉淀消息气泡管线的身份契约 + 不变量，作为未来改动消息管线时的强制参考真相源；让"加一个新 provider/新路径"不再触发新一轮气泡 bug。

## 决策

### Section 1 — 四个真相源持久性对照表（46 主笔）

| 层 | 存储 | TTL | 写入方 | 读取方 | 冲突优先级 |
|---|---|---|---|---|---|
| **Redis MessageStore** | Redis hash + sorted set | 永久 | `route-{serial,parallel}.ts` persist 路径 | `GET /api/messages` | **1（SoT 真相源）** |
| **Redis DraftStore** | Redis hash | 5min TTL | `route-*.ts` stream 路径 | `GET /api/messages` draft merge | 2（仅在线时补位流式中间态） |
| **Zustand chatStore + Ledger** | 浏览器内存 | 页面生命周期 | `handleAgentMessage()` | React render | 3（实时优先但不权威） |
| **IndexedDB** | 浏览器持久化 | 手动清理（本 ADR 起加 schema invalidation hook） | `saveThreadMessages()` | 首屏 + 离线 fallback | 4（provisional cache，**不参与在线 merge**） |

**冲突仲裁原则**：在线时永远以 MessageStore 为最终真相源。Zustand 实时优先用于 UX 流畅，但 hydration / replace 永远以 SoT 覆盖。IndexedDB 在本 ADR 后**降级为 provisional cache**——只在冷启动减少白屏 + 网络断连时做 fallback，不参与 in-flight merge 仲裁。

### Section 2 — Identity Contract 仲裁规则（砚砚主笔）

#### 稳定身份两层定义

```
Thread-scoped store key  =  threadId + catId + canonicalInvocationId + bubbleKind
Bubble identity within thread  =  catId + canonicalInvocationId + bubbleKind
```

`threadId` 不进入气泡自身展示身份，但必须进入 store / replay / invariant 的查重边界。否则跨 thread 的背景流、handoff、历史 replay 会把"同一 invocation 是否应该共存"变成全局语义争议。

#### `canonicalInvocationId` 仲裁规则

1. **OUTER `parentInvocationId` 始终优先**。live broadcast / formal persistence / history hydration / IDB snapshot 都必须写同一个 canonical id。
2. INNER `ownInvocationId` 字段名应明确改成 `sourceInvocationId` / `providerInvocationId`，仅作 provider / runtime lifecycle id 保留，**禁止参与前端 bubble identity**。
3. canonicalization 必须在 **routing / message assembly 层兜底**。provider 可以提供 metadata，但 provider 不应承担最终契约——每加 provider 靠 provider 自觉注入，就是 PR #1433 (route-parallel) / Codex MCP callback metadata (`1ed5f5b46`) 一再复发的根因。
4. `messageId` 是实例 id，不是身份。`msg-${invocationId}-${catId}` 可作 deterministic instance id，但 invariant 不能只看 id。

#### `bubbleKind` 收紧成有限枚举

```
assistant_text       — cat 的最终回复主气泡
thinking             — scratchpad / 思考过程
tool_or_cli          — CLI tool execution / stdout
rich_block           — interactive / media / card / diff / checklist 等
system_status        — briefing / direction / handoff / timeout 等系统消息
```

同一个 `(catId, canonicalInvocationId)` 下哪些 kind 可共存、哪些是同一 bubble 的不同 phase，**Phase A 三猫 review 时收敛**（OQ-A）。

#### 无 `invocationId` 的 placeholder 规则

- 只能是 **local-only provisional bubble**
- **不能写入 IDB**
- **不能作为 authoritative history 参与 hydration merge**
- 一旦 canonical id 到达，**必须单调升级**到 canonical key
- 如果无法升级，只能触发 catch-up / diagnostic，**不能悄悄新建第二条 formal bubble**

#### 单调升级链

```
draft/local  →  stream  →  callback/history
```

只能变强，不能降级，也不能分叉。F123 已经把高频症状压住，但 TD113（placeholder 单调升级）需要在 F183 写成系统契约。

### Section 3 — 6 个不变量（砚砚版本，三猫 +1）

> 这 6 条在 Phase B-E 必须以 store invariant 形式落地（dev/test 硬断言；runtime warn + debug dump）。

1. **唯一性**：一个 thread 内同一 `(catId, canonicalInvocationId, bubbleKind)` 最多只能有一条 active bubble
2. **单调性**：`draft/local/stream` 可以被 `callback/history` 替换或升级，反向不允许
3. **同一 canonical key**：live socket、history API、IDB cache 对同一逻辑 bubble 必须给出同一个 canonical key
4. **placeholder 临时态**：无 canonical id 的 placeholder 是临时态，不能持久化为正常缓存真相
5. **provider 准入门槛**：新 provider / 新 origin / 新 bubble kind 合入前，**必须声明它产生哪类 `BubbleEvent`，以及 canonical id 从哪里来**——这是 F183 之后 review 路径的强制门槛
6. **dup invariant**：任何 duplicate stable identity 在 dev/test **必须失败**；runtime 可以先 warn + debug dump，但**不能静默吞掉**

### Section 4 — 视觉全景图（砚砚 SVG 渲染主笔；烁烁 Pencil 修复后补细节稿）

#### 中文版（主图）

![F183 消息气泡管线架构图（中文）](../features/assets/F183/architecture-map.cn.png)

#### English Version（对外 / 社区可用）

![F183 Bubble Pipeline Architecture Map (EN)](../features/assets/F183/architecture-map.en.png)

> **载体说明**：当前手绘风格架构图由砚砚 GPT-5.5 通过 SVG 模板渲染（保证文字精确，避免模型直接出图乱字）；SVG 源同步提交在 `docs/features/assets/F183/architecture-map.{cn,en}.svg`，可在 Phase B-E 持续微调。烁烁的 Pencil 插件修复后做细节分层稿补充（KD-A1 v2 路径）。

## 决策依据

- **F081 audit (2026-03-10)**：104 个 messages 写入点、13 场景状态矩阵
- **F123 KD-4 (2026-03-14)**：主动推迟统一 MessageWriter，留下 TD111-TD114（identity contract / store invariant / placeholder 单调升级 / duplicate 入口标识）
- **2026-04-27 bug-report**：
  - `frontend-idb-cache-dup-after-cat-spawn` —— route-parallel OUTER/INNER identity split (PR #1433)
  - `stream-event-delivery-lag` —— in-process bus dropped 32 events (PR #1432 timeout 分支补 catch-up，根因未修)
- **F183 Discussion (2026-04-30)**：四猫圆桌收敛 Round 1 + 47 Round 2 收敛 + 铲屎官 5 KD 拍板

## 后果

### 正面

- **架构防御层落地**：新 provider / 新 origin / 新 bubble kind 合入前必须声明 canonical id 来源（不变量 #5），终止"每加 provider 就漏 contract"的反复发作
- **store invariant 第一时间暴露 dup**：duplicate stable identity 在 dev/test 直接失败（不变量 #6），不再事后猜
- **IDB 角色降级**：不参与在线 merge → 减少一个真相源 → 减少一类气泡 bug
- **F184 (rendering mount 层独立排查) 串行约束**：避免 reducer / mount 并发引入新不一致（F183 KD-8）
- **架构图成为强制参考真相源**：未来改动消息管线必须先读 ADR-033 + 视觉图（AC-Z3 onboarding 路径）

### 负面

- **重构成本高**：现有 8+ 条 messages 写入口要收敛到 Single Writer / Reconcile Reducer（Phase B1）
- **IDB schema 升级**：5 metadata 字段（`identityContractVersion / cacheSchemaVersion / savedAt / containsLocalOnly / containsDuplicateStableIdentity`）需要新加，老缓存触发 invalidation
- **协议升级（Sequence Number）**：前后端同时改 broadcast 协议 + 客户端 lastSeq 跟踪 + gap detection
- **roadmap 串行约束**：F184 实施必须等 F183 Phase A done，不能并发（与铲屎官的紧迫感有 trade-off）

### 中性

- **F184 (rendering mount 层) 不属于本 ADR scope**：F176 撤销后真 bug 走独立排查路径（F184 spec），ADR-033 不收编
- **ADR-031（Harness Engineering）的"signal loop"原则在本 ADR 落地**：本 ADR 自身就是 F081/F123 失败信号 → 改进规格的产物（"签字时也要看代码已经吃了多少 hotfix"）

## Open Questions（Phase A 三猫 review 收敛）

| # | 问题 | 状态 |
|---|------|------|
| OQ-A | 同一 `(catId, canonicalInvocationId)` 下，哪些 `bubbleKind` 可共存？哪些是同一 bubble 的不同 phase？ | ⬜ Round 3 review 收敛 |
| OQ-B | `BubbleEvent` 类型枚举（砚砚 Round 1 给的 14 类）是否要在本 ADR 列出还是留 fixture-schema.md？ | ⬜ Round 3 review 收敛 |
| OQ-C | runtime warn + debug dump 的具体形态（log level / sampling / dump 接口）是否在本 ADR 写细，还是 Phase B0 实施时再定？ | ⬜ Round 3 review 收敛 |

## 链接

- [F183 spec](../features/F183-bubble-pipeline-architecture-consolidation.md)
- [F183 Discussion (Round 1 + Round 2 + 拍板结果)](../discussions/2026-04-30-f183-bubble-pipeline-architecture/README.md)
- [F184 spec](../features/F184-chatmessage-rendering-mount-investigation.md)
- [F081 done](../features/F081-bubble-continuity-observability.md)
- [F123 done](../features/F123-bubble-runtime-correctness.md)
- [F176 reverted](../features/F176-native-cli-assistant-speech-rendering.md)
- 中文架构图: [`docs/features/assets/F183/architecture-map.cn.png`](../features/assets/F183/architecture-map.cn.png)
- 英文架构图: [`docs/features/assets/F183/architecture-map.en.png`](../features/assets/F183/architecture-map.en.png)
- SVG 源（可微调）: `docs/features/assets/F183/architecture-map.{cn,en}.svg`

## Review Trail

| 日期 | 事件 |
|------|------|
| 2026-04-30 | ADR-033 v1 草稿（47 起，吸收 46 Round 1 Section 1 + 砚砚 Round 1 Section 2/3 + 砚砚画的 Section 4 视觉图） |
| 2026-05-01 (planned) | 三猫 Round 3 review（砚砚 Section 2+3 / 46 Section 1 / 烁烁 Section 4 视觉） |
| 2026-05-03 (planned) | 收敛 + 修订 v2 |
| 2026-05-04 (planned) | 铲屎官最终 ack 放行 → Phase A done → Phase B0 worktree 解锁 + F184 解锁立项 |
