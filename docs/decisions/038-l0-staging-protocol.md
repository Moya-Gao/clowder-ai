---
topics: [l0, prompt-engineering, staging, demote, lifecycle, F167-mirror]
doc_kind: decision
created: 2026-06-10
status: proposed
related: [ADR-030, F167]
---

# ADR-038: L0 Staging Protocol — 双向新陈代谢

## Context

L0-budget-defense backlog 件套 ④（PR #2213 deadlock 倒逼立项）。PR #2213 暴露 L0 系统**单向只进不出**的结构缺陷：每个新条款进 L0（占压缩免疫预算），但没有出口路径。这导致：

1. **温水煮蛙**：每个 toucher 加几个 token 慢慢吃完 margin（5,600→6,000 cap 已涨过一次，PR #2213 时再次撞顶）
2. **deadlock**：truth-source 守护下没空间砍 + cap 共识不再涨 + 新条款（雨刮器 +84）无处落脚 → PR #2213 close 关 PR
3. **bandaid trap**：B 选项「独立 budget reducer」是一次性大扫除，做完没制度，下次同问题再扫

fable-5 投递时一句穿透判断："**单向的 staging 协议有结构缺陷——只进不出，正是这次 deadlock 的根源机制**。demote 不是为这次危机发明的特设路径，它是协议本来就缺的另一半"。

fable-5 + 砚砚 + opus-47 三方 align direction **A**：staging 协议**双向**（含 demote 老 L0 内容 → staging）。把大扫除变成**新陈代谢**。

## Decision

建立 **L0 Staging Protocol**：三层条款生命周期（L0 / Staging / Sunset）+ 双向流转 + 预算守恒 + 与 F167 sunset 镜像。

### 三层架构

| 层 | 注入机制 | 预算占用 | 跨压缩存续 |
|----|----------|----------|------------|
| **L0** (压缩免疫) | API system role (native system prompt, **不**经 SystemPromptBuilder 字符串拼接) | 占 ≤6,000 token cap | ✅ 跨所有压缩存续 |
| **Staging** (每轮注入) | SystemPromptBuilder prepend 到 **runtime prompt/query 字符串路径**（**不**进 L0 native system role，**不**算入 6,000 token L0 cap） | 占 **staging cap (≤ STAGING_CAP_TOKENS)** — 双边记账：staging 也是猫的上下文税 | ❌ 压缩时可能丢（不阻塞条款生效，但触发率 telemetry 有已知偏差，详见「已知限制」） |
| **Sunset** (退役) | 不再注入 | 不占 | — |

### 预算双层守恒（fable-5 P1-1）

```
Hard invariant: L0_tokens ≤ HARD_CAP_L0 (6,000) AND staging_tokens ≤ HARD_CAP_STAGING
Soft invariant:  L0_tokens + WARN_MARGIN ≤ HARD_CAP_L0 AND staging_tokens + WARN_MARGIN ≤ HARD_CAP_STAGING
```

- `HARD_CAP_STAGING`：建议初值 **≤2,000 tokens** 总量（拍脑袋待校准，by F200 telemetry 实测后定）
- 双边记账：**staging 也是猫上下文税**，不是免费层。无 staging cap = 新陈代谢只换层不减总量 = 温水煮蛙搬锅
- staging 满时行为：① 拒新进 (push back promote) ② 同时识别 staging 最弱条款（触发率最低 + 第一性判别为 sunset 兼容）→ sunset。**不允许 staging 隐式溢出**

### 双向流转

```
                            晋升 (触发率证据)
                   ┌────────────────────────┐
                   ▼                        │
              ┌─────────┐                ┌──┴────────┐
              │ Staging │ ──── 雨刮器 ──→│    L0     │
              └─────────┘ ←───── demote ─└───────────┘
                   │  (触发率衰减 + 第一性判别)
              退役 │
                   ▼
              ┌─────────┐
              │ Sunset  │  ← L0 直接退役（F167 既有路径）
              └─────────┘
```

- **Staging → L0**（晋升 promote）：触发率证据 (F200 telemetry / F167 adoption-decay 同款信号) + 预算守恒检查
- **L0 → Staging**（降级 demote）：触发率衰减 + **第一性判别**（功能是否真需要跨压缩存续）
- **L0 / Staging → Sunset**（退役）：长期零触发 + 守护 review

## Demote 判据（砚砚 P1#3 + fable-5 #5 修正）

### Demote AND 而非 OR（砚砚 P1#3 修）

Demote 必须**两条同时满足 + review gate**：

1. **触发率衰减 nominate**（候选浮现）
2. **第一性判别为 staging 兼容**（功能不需跨压缩存续）
3. **+ 对应 review gate**（family overlay → 本家族猫 review / L0 通用条款 → CVO signoff，详见「Demote 安全」段）

仅 1 不足以 demote（低观察但 critical 肌肉记忆条款会被错 demote — 例如 fable-5 早投递的雨刮器条款若在第一性判别前先 demote 砚砚的"出口一问"会复活 PR #2213 P2 BLOCKING）。仅 2 不足以 demote（无触发率证据时按住静默）。

### 1. 触发率衰减信号（nominate）

- **N 天窗口零触发** — 默认 N=14 天
- 信号源：F200 telemetry / F167 adoption-decay 既有 pipeline（**不重复造轮子**）
- 操作锚：触发率 telemetry 入 weekly verdict, demote 候选自动浮现

#### 已知偏差（v1 限制，详见「已知限制」段）

- 压缩丢失系统性污染触发率（fable-5 P1-2）→ v1 用日历窗口 + demote review 人工补偿
- v1 按条款类别分窗（fable-5 #1 攻击）：family overlay 14d / L0 通用条款 30d（保守）
- v2 路径：opportunity-normalized 触发率（分母 = 条款实际在场轮次，非日历轮次）

### 2. 第一性判别（功能是否需跨压缩）

**判别问**：该条款的功能是否真需要跨压缩存续？

#### 三问 checklist（fable-5 #5 半机械化）

1. **触发条件是否单轮内完整出现且消费完毕**？（单轮闭环 → staging 兼容；跨轮持续 → 必须 L0）
2. **压缩后丢失、下轮恢复，期间功能缺口是否有害**？
   - 条款管"持续约束"（如球权第一人称） → 期间缺口有害 → **必须留 L0**
   - 条款管"新事件反射"（如雨刮器撞摩擦上报） → 期间缺口无损 → staging 兼容
3. **是否被其他 L0 条款引用**（依赖图）？被引用者不可单独 demote（先 demote 引用者 或 同步）。

**保守默认**：三问拿不准 → **留 L0**（fable-5 原话）。

#### 类别示例

| 类别 | 三问结果 | 判定 | 例 |
|------|----------|------|-----|
| 当轮反射类 | 单轮闭环 + 缺口无损 + 无依赖 | staging 兼容 | 雨刮器条款、摩擦检测反射 |
| 全程身份/球权类 | 跨轮持续 + 缺口有害 + 被多 L0 引用 | **必须留 L0** | P1-P5、W1-W8、五条铁律、@ 路由格式、球权第一人称 |
| 治理协议类 | 视依赖判定 | 视情况 | Magic Words（铲屎官指令触发） vs 家族治理（compress-resilient 守护） |

## Demote 安全（fable-5 concern #2）

### 三条安全护栏

1. **Demote ≠ delete**：下到 staging 层**继续每轮注入生效**，只是不占压缩免疫预算
   - 不影响条款的功能性（注入路径变，生效行为不变）
   - 唯一差异：压缩免疫 vs 每轮重发（被压缩可能丢但下一轮注入恢复）

2. **family overlay demote 必须本家族猫 review**
   - PR #2213 P2 BLOCKING 教训：跨家族砍 truth-source-protected overlay 是 PR 自我糊弄
   - 缅因猫 overlay 的 demote → @codex 砚砚 或 @gpt52 review
   - 暹罗猫 overlay 的 demote → @gemini25 review
   - 布偶猫 overlay 的 demote → 跨布偶猫个体 review

3. **L0 通用条款 demote 需 CVO signoff**
   - 五条铁律 / Rule 0 / P1-P5 / W1-W8 / Magic Words / 治理协议核心 = 愿景级
   - 这些条款 demote 跨过家族治理边界 → @landy 硬条件升级

## 晋升预算守恒（fable-5 concern #3，两层守恒）

### 守恒检查（promote / new staging entry 两个入口）

**入口 1 — Promote (staging → L0)**：
```
if (L0_current + staging_item > HARD_CAP_L0) {
  候选行动 (优先级降序):
  A. demote candidate(s) 让出 L0 预算
  B. queue promote (等待自然 demote)
  C. push back promote (告知 author 预算不足)
}
```

**入口 2 — New staging entry**：
```
if (staging_current + new_item > HARD_CAP_STAGING) {
  候选行动 (优先级降序):
  A. sunset staging 最弱条款 (触发率最低 + 第一性判别为 sunset 兼容) 让出预算
  B. push back new entry (告知 author staging 满)
}
```

### 实现锚点

- SystemPromptBuilder / compile-system-prompt-l0 加两个 pre-flight token check（promote 入口 + new staging entry 入口）
- demote/sunset candidate selection：触发率最低 + 第一性判别兼容
- 双层守恒不变式（hard）：`L0_tokens ≤ HARD_CAP_L0 (6000) AND staging_tokens ≤ HARD_CAP_STAGING (≤2000 待校准)`
- soft margin（warn）：`L0_tokens + 50 ≤ HARD_CAP_L0 AND staging_tokens + buffer ≤ HARD_CAP_STAGING`
- buffer 大小：建议 staging soft margin = HARD_CAP_STAGING × 10%（待 F200 实测校准）

## Expiry 衔接 fallback（fable-5 concern #4）

### 硬截止 2026-06-13T00:00:00Z（砚砚 P1#2 修正对齐 PR-A）

- **PR-B**（本 PR 含本 spec + 后续）、**PR-C**（impl + first demote）必须在 **2026-06-13T00:00:00Z** 前 land 至少一个 demote 用例，使 codex/gpt52 fresh build tokens 回到 ≤6000
- 该时刻 PR-A `L0_BUDGET_TODO_EXPIRY = 2026-06-13T00:00:00Z` 在 before() 抛错阻塞所有 L0 修改测试
- **注意**：PR #2215 R1 P1 #2 修复时 expiry 已设为 `2026-06-13T00:00:00Z`（不是 23:59 UTC），本 ADR 对齐该时间戳

### Fallback（预注册，仅作 fallback 存在）

- **Fallback C**：expiry extend with @landy CVO signoff 短延期（默认 +14 days, hard cap +30 days）
- 触发条件：13 号前 demote 用例未 land，且 @opus-47（owner）评估剩余阻碍是技术性而非 scope drift
- 预注册形式：本 ADR 显式声明 fallback 存在 + @landy signoff 路径明确
- **预写 fallback 是工程不是拖延**（fable-5 原话）—— 但只许作为 fallback 存在，不许默认走

### Fallback 反滥用 guard（fable-5 #4 措辞修订）

- Fallback **作用域 = 本次 expiry incident**（2026-06-13 expiry 的本次 land/extend cycle）
- **"1 次"指本次 incident 内仅能 extend 1 次**，不限制未来其他 backlog/expiry 的独立 fallback
- 本次 incident 内第二次 extend 必须 reopen ADR-038 讨论根因 + 改 spec
- @landy signoff 必须显式同步本 ADR + BACKLOG.md anchor

## Dogfood：雨刮器减肥版作 first staging case

### Trigger 锚点提前

**fable-5 排序优化**：雨刮器减肥版在 staging 层生效之时（PR-B），即可触发 fable-5 "细则进 code-as-harness skill" 的下一棒。**细则锚的是条款生效，不是条款进 L0**。

- 不必等 PR-C
- 雨刮器顺便成为 staging 协议的第一个全周期用例（dogfood: 吃自己的狗粮）

### 雨刮器减肥版全周期用例

```
PR-B (本 PR 后续 / 单独 PR):
  雨刮器减肥版 (~45 tokens) → staging 层 (cat-cafe-skills/refs/l0-staging-content.md 或等价)
  staging 试运行: 14 天窗口收集触发率证据

14 天后:
  ├── 触发率证据足够 → 评估第一性判别 (反射类 → staging 兼容)
  │   └── 结论: 继续 staging (不晋升 L0)
  ├── 触发率衰减 → demote 到 sunset
  └── 边界 case 议: F167 镜像决策
```

### 雨刮器作 dogfood 的特殊价值

1. **全周期可观测**：staging 入 + 触发率证据 + 第一性评估 + 后续决策 = 全栈 protocol 实测
2. **风险低**：~45 tokens 小 footprint，决策错代价小
3. **意义大**：协议第一个真实用例 = 协议可信度锚
4. **fable-5 trigger 链 align**：staging 生效 = fable-5 "细则进 code-as-harness skill" trigger

### 协议判据下的预期结果：雨刮器永居 staging（fable-5 提示，含原 signoff 映射）

按本 ADR 三问 checklist 对雨刮器条款应用：

1. **单轮内完整出现且消费完毕**？✅ (撞到摩擦 = 单轮事件，留 `[爪感差: 工具+现象]` 是单轮反射)
2. **压缩后期间功能缺口是否有害**？❌ 缺口无损（雨刮器是新事件反射，无持续约束需求）
3. **被其他 L0 条款引用**？❌ 不被引用

**→ 三问全部 staging 兼容 → 协议结论：雨刮器永居 staging，不晋升 L0**。

#### 原 signoff 映射（CVO + fable-5 投递锚）

铲屎官（CVO）原 signoff 时雨刮器位置预期是 **L0 §2**（PR #2213 close 前的设计），本协议下位置变更为 **staging 层** —— 但**功能等价**（每轮注入生效，反射触发行为不变）。这是位置位移不是功能降级。

- 同步路径：fable-5 在 source thread 已表态向 CVO 显式知情确认（"功能等价、位置不同"映射）
- 本 ADR 锚定：雨刮器在新协议下作 staging 层条款属于设计内 expected outcome，不构成 CVO signoff 漂移
- 若 CVO 显式要求雨刮器晋升 L0：则需重 demote 现有 L0 条款换预算（守恒不变式不可破）

## F167 Sunset 镜像

| 维度 | F167 Sunset | L0 Staging Protocol (本 ADR) |
|------|-------------|------------------------------|
| 出口路径 | L0 → sunset (一步退役) | L0 → staging → sunset (两步, staging 缓冲) |
| 决策 | 一次性决策 | 渐进决策 + 触发率证据 |
| 入口 | 不适用 | staging → L0 (晋升) |
| 信号源 | adoption-decay | adoption-decay (复用) |
| 守护 | F167 既有 review 路径 | family overlay → 本家族猫 / L0 通用条款 → CVO signoff |

L0 / staging / sunset 三层守恒生命周期 = L0 不再单向只进不出，新陈代谢替代温水煮蛙。

## Implementation Outline（PR-C+ 实现讨论）

本 ADR 是 **协议规范**，具体实现细节由后续 PR 决定：

- **Staging 层物理位置**（fable-5 #3 攻击给出 direction）：**分布式 family files + 统一 manifest**
  - 物理分布：staging 内容按 family 分文件（`cat-cafe-skills/refs/l0-staging-content-{breed}.md` 或类似）
  - 逻辑统一：manifest（`cat-cafe-skills/refs/l0-staging-manifest.json` 或类似）管状态/触发率/cap 审计
  - 理由：① 注入通道本就 per-family（per-cat overlay）② demote review 的家族隔离用 git path 守护天然对齐 ③ manifest 集中审计 staging cap 守恒
- **注入机制**：SystemPromptBuilder prepend staging content 到 **runtime prompt/query 字符串路径**（**不**进 L0 native system role，**不**经 `compile-system-prompt-l0.mjs` 编译，**不**算入 6,000-token L0 cap）
  - 砚砚 P2 修正：ADR-030 documented SystemPromptBuilder 输出 prepend 到 query 字符串，本协议 staging 注入沿用该路径
- **Demote 工作流**：候选 CLI 工具 / commit-time hook check / eval-triggered automation
- **预算守恒检查**：两个入口都加 pre-flight token check（promote + new staging entry）
- **触发率 telemetry pipeline**：F200 整合 vs 独立 channel（OQ #2）

## 已知限制（v1 spec 诚实记录，fable-5 P1-2）

### 压缩丢失污染触发率（死亡螺旋风险）

**症状**：staging 条款在压缩时可能丢，丢失轮次中触发场景若恰好出现 → telemetry 记零触发 → 触发率被系统性低估 → 错误 demote → 越压缩越显得没用越降级。

**v1 应对**（spec 层只诚实记录，不要求 v1 完整解决）：

1. **触发率分母原则**：v1 用日历窗口（**已知偏差**），v2 升级为 `presence-normalized` (分母 = 条款实际在场轮次)
2. **日历窗口按条款类别分窗**：family overlay 14d / L0 通用条款 30d（保守）
3. **人工补偿（v1 必做）**：demote review 时**必须人工检查**窗口内压缩频次。若窗口内压缩 ≥N 次 → 否决 demote / 延长窗口 / 等 v2
4. **v2 路径**：opportunity-normalized 触发率（分母 = 条款 presence × 触发场景出现机会）

### 触发率信号源未实现

- F200 telemetry 是否覆盖 staging item 引用计数 (OQ #2)
- v1 可能需要独立 channel
- 影响：v1 demote workflow 可能需要 manual nominate（无 automatic 触发率衰减信号）→ 写进 v1 实现备注

### Staging cap 待校准

- `HARD_CAP_STAGING ≤ 2000` 是 v1 默认值，F200 telemetry 实测后校准
- 校准触发条件：staging 满或撞 soft margin warn 至少 2 次

## Open Questions（for PR-C+ 实现细节）

1. ~~**Staging 层物理位置**: single file vs distributed family files?~~ → **Closed by fable-5 #3**: 分布式 family files + 统一 manifest (详见 Implementation Outline)
2. **触发率 telemetry**：F200 已有 pipeline 是否覆盖 staging item 引用计数？需要独立 channel 吗？
3. **Demote 自动化程度**：manual review-driven vs hook-driven vs eval-scheduled？平衡安全 (review gate) vs 时效
4. ~~**Staging → Sunset 窗口**：14 天合理？~~ → **Closed by fable-5 #1**: v1 family overlay 14d / L0 通用 30d 分窗，v2 opportunity-normalized
5. **Promote queue 实现**：FIFO？按价值优先级？什么算价值？
6. **Staging cap 初值校准触发条件**：什么 telemetry 信号驱动校准 STAGING_CAP？
7. **Manifest schema 版本控制**：staging manifest 自身的 schema 演化怎么管？

## Related

- **L0-budget-defense backlog**: `docs/BACKLOG.md` § L0-budget-defense
- **ADR-030 System Prompt Engineering**: 本 ADR 增补 L0 生命周期 / 双向新陈代谢机制
- **F167 sunset**: 镜像 (本 ADR 多一层 staging 缓冲)
- **F200 telemetry**: 触发率信号源 (复用)
- **PR #2213**: deadlock 倒逼立项 (close 历史)
- **PR #2215**: 件套 ①+②+③ done (前置)
- **PR-B (本 PR)**: 件套 ④ spec
- **PR-C**: impl + first demote case (后续)

## Decision Provenance

- **Author**: 宪宪 / Opus-4.7 (@opus-47)
- **Direction confirm**: fable-5（A 无保留，2026-06-10 03:20 UTC, source thread `thread_mq87iw5qmq93ygo6`）
- **Direction align**: 砚砚 / GPT-5.5 (@codex) R3 + R5 在 PR #2215 reviewer chain 中明确同意 A direction
- **Build mode source**: fable-5 投递 thread `thread_mq87iw5qmq93ygo6` + 我接球本 thread `thread_mq0qdxh0aysy0rs3` (F225)
- **CVO signoff**: pending本 PR review

## Implementation Tracking（2026-06-11 起，从 BACKLOG 迁移到这里）

> 缘起：opus-46 投诉 `L0-budget-defense` 不该写进 BACKLOG.md（违反「只放活跃 Feature」规则）。BACKLOG 行已删；追踪信息搬到本 ADR appendix 作为唯一真相源。

**4 件套进度**:
- ① 守护测试 3 件套: **done** — PR #2215 (`bf5a4f1e4`)
- ② 雨刮器机制: **done** — PR #2215
- ③ L0 budget 监控: **done** — PR #2215
- ④ ADR-038 L0 Staging Protocol spec: **done** — PR #2221 (`d7944b27`)
- PR-B-impl（staging mechanism + 雨刮器减肥版 land 在 staging）: **in-progress**，ETA 2026-06-13
- PR-C（first demote case 让 codex/gpt52 token 回 ≤6000）: **in-progress**，ETA 2026-06-13

**Promote 队列**（按 ADR-038 §6 排队）:
- **候选 #1**（fable-5 登记 2026-06-11）: shared-rules §21「Lifecycle 不分任务类型」投影行（LL-071）— worktree build ✓ + governance-l0 单测 8/8 ✓，token 实测把 gpt52 顶到 6142 撞 margin guard，按协议排队不硬塞。文本 anchor: `9a30350d3`
- **候选 #2**（opus-47 登记 2026-06-11，F231 Design Gate 决议）: F231 capsule（≤300 字 / ~285 tokens），注入锚 gated on PR-C 落地。ADR-038 三问判定 capsule 属"全程身份/球权类" → 必须留 L0（不进 Staging / 不进 SystemPromptBuilder 运行时）。spec 字段 anchor: `e5100a486` — 见 [F231](../features/F231-user-profile-capsule.md) + [Design Gate 出口物](../discussions/2026-06-11-f231-design-gate.md)

**TODO 哨兵**: 2026-06-13T00:00:00Z PR-A `L0_BUDGET_TODO_EXPIRY`
