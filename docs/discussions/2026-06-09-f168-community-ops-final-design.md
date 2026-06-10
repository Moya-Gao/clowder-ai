# F168 终态设计 — Community Ops 事件协作系统（三猫收敛 v1）

> 执笔：宪宪 [宪宪/Fable-5🐾] · 2026-06-09
> 输入：三份独立思考（宪宪 `2026-06-09-community-ops-multiagent-coordination-fable.md` / 本 thread 砚砚 GPT-5.5 独立稿 / 运维砚砚 `2026-06-09-community-ops-eventbus-retrospective.md`）+ 铲屎官 2026-06-09 五条新约束
> 性质：终态设计（非脚手架）。等 CVO signoff F168 reopen 后转入 feature doc。

---

## 0. 三猫收敛点（已三方独立验证，不再论证）

- **诊断**：角色设计失败——一个 chat thread 被迫扮演事件收件箱/路由器/核验员/翻译/监工/书记员/状态板九个角色。chat 能承载对话，承载不了并发 case 的状态机。
- **方向**：event-sourced。chat 是交互面，**事件 + 读模型才是运营真相源**。
- **分工**：四模式各居其位——事件采集 = 纯代码 Message Bus；triage = 短命干净上下文的轻量角色；owner threads = 现有 Agent Teams 形态（不动）；台账 = Shared State 唯一真相源。
- **闭环**：closure 是状态机必经状态 + 强制 checklist，不是猫的美德。
- **CVO 界面**：只收 Decision Packet（人话 + 价值取舍题），证据折叠在卡片后面。

量化背书：clowder-ai 当前 453 issues / 28 PRs / **64 未回复积压**（铲屎官 2026-06-09 截图）——流量充分 justify 全套状态机，"低流量过度设计"的撤回条件不成立。

## 1. 铲屎官五条新约束 → 设计响应

| 约束（铲屎官原话要义） | 设计响应 |
|---|---|
| "不要脚手架设计，直接面向最终设计" | 不做"把看板和守门 thread 连起来"的管子。**把两者都降级为同一读模型的视图**——状态只有一份，联动问题在终态里不存在，而不是被修好 |
| "烁烁35 做 triage 好，但别人家可能用 glm5.1——不能硬编码" | **Role Registry**：引擎只认识 `narrator` / `case-owner` / `reconciler` 角色；role → (cat, model, prompt 模板) 绑定在 deployment 配置。先例：L0 队友名册以 runtime catalog 为准，不看静态文案 |
| "和 clowder-ai 解耦点——别人用这个能力管他们的开源社区" | repo 是数据维度不是常量。引擎 repo/cat/brand-agnostic，政策（repo 清单、role 绑定、SLA、语气）全部配置化。这正是 F168 原始愿景的回归："自用→开放，**多租户解耦是硬约束**" |
| "社区守门员 skill 要同步更新到 F168 新状态" | opensource-ops 从"教猫记住流程"改写为"教猫驱动状态机"（§6）。软层已惊人预言硬层：`external-wait`≈`awaiting_external`、"守门 thread 默认不修"≈分诊台不做手术、"谁接球谁负责等待"≈`nextOwner` |
| "F168 和 infra 守门 thread 没有联动？" | 确认，有代码实锤（§3）。终态解法 = §0 的"视图降级"，两条平行线合流进同一事件总线 |

## 2. 终态架构

```
事件源（多个，只产事件）          引擎（一个）                    视图（多个，只读投影 + 发起决策）
─────────────────────    ─────────────────────────    ─────────────────────────────
GitHub webhook ────┐     │ Event Log（持久、可审计） │     ┌─ Console 看板 = CVO 决策队列
5min 轮询兜底 ─────┤     │   ↓ project              │     ├─ owner thread 唤醒（压缩事件包）
看板路由动作 ──────┼──▶  │ CommunityObject 读模型    │ ──▶ ├─ narrator triage（短命 spawn）
内部协作事件 ──────┤     │   + 状态机                │     ├─ GitHub 公开回复（首反/closure）
merge/CI 事实事件 ─┘     │   + closure guard        │     └─ SLA / 掉球 cron 告警（死信重浮）
                         ─────────────────────────
```

**CommunityObject 读模型**（合并运维砚砚 schema + 本 thread 砚砚的 Case 概念）：

```text
CommunityObject {
  repo                    # 数据维度，多租户
  type: issue | pr
  number
  state                   # 状态机见下
  ownerThreadId / ownerRole
  nextOwner: role | external_author | ci | cvo | none   # 球在谁手上，一等公民
  blockedOn / lastExternalActivityAt / lastPublicCommentAt
  linkedIssues / linkedPrs
  closureChecklist        # 公开回复✓ label✓ linked PR✓ intake 决策✓ close 理由✓
  timeline[]              # 所有事件 append，可观测性 + 冷启动接手的全部上下文
}
```

**状态机**（三稿合并）：

```
new → triaged → routed → in_progress ⇄ awaiting_external → fixed → reported → closed
        │                                （等社区作者/云端review/CI，
        ├→ declined（误报/重复/不收）        静默不打扰，事件驱动唤醒）
        └→ needs_info（公开追问，SLA 计时）
```

- `fixed` 由 **merge/CI 事实事件**驱动，不由猫口头声明（消息不是真相源）
- `fixed` 未 `reported` 超 SLA → cron 提醒 owner + 自动生成回帖草稿
- 任何状态超 SLA → 浮回看板死信区，**没人接的 case 不许沉底**
- 打扰分级（采纳本 thread 砚砚）：事件分 state-changing / needs-human / needs-owner / informational / stale，只有前三类唤醒猫或人

## 3. F168 ↔ 守门 thread 联动：现状实锤与终态

**现状两条平行线（代码证据）**：

1. webhook → `ConnectorInvokeTrigger` → "社区 issue / pr 运维" thread（`thread_mp3ab0r9xqxrkrc5`）——事件耗散在 chat 历史里，台账不知道
2. 看板"发送给系统猫" → `POST /api/community-issues/:id/dispatch`（`community-issues.ts:151`，手动触发 triage）——台账 state 停在 F168 store，TaskStore/thread 进展不回写

铲屎官的体感"没有联动"= 这两条线状态互不可见。**终态不修管子**：两个入口都只产生事件进同一 Event Log，看板的"未回复 64"和守门视图的队列是同一份投影。"发送给系统猫"按钮升级为"路由决策"（推荐 role/thread + 下拉改派），点击 = 产生 `routed` 转换事件，进展自动回流——因为根本没有"另一边"。

## 4. Role Registry（不硬编码的具体形状)

```yaml
# deployment 配置（家里实例；别人家换绑定即可）
roles:
  narrator:                 # 讲人话 + 搜证初判 + 推荐路由；非 correctness owner
    binding: { cat: gemini35, model: gemini-3.5-flash }   # 别人家: glm5.1 / 任意
    spawn: per-event, clean-context                        # 短命，禁止变成状态 owner
    output: DirectionCard schema（结构化）
  case-owner:
    binding: per-case thread（Agent Teams 现状，不动）
  reconciler:
    binding: none            # 纯代码 cron：GitHub truth ⇄ Case truth diff
```

- 引擎代码零猫名、零模型名、零品牌（outbound sanitizer 不变式：sync 时零替换）
- narrator 的 prompt 模板、社区回复语气模板都是配置
- **eval 钩子内建**：owner 确认/推翻 narrator 初判 → 记入 timeline → F192 eval 闭环。自动路由权限用数据开，不用信任开

## 5. 多租户边界（与 clowder-ai 解耦的实操含义）

| 层 | 内容 | 归属 |
|---|---|---|
| 引擎（可开源复用） | 事件 schema、状态机、读模型、closure guard、SLA cron、Role Registry 机制 | `packages/`，repo/cat/brand-agnostic，可 sync 开源仓 |
| 政策（每租户） | repo 清单、role→cat 绑定、SLA 阈值、label 映射、DirectionCard/回复模板 | 配置文件 + Console 设置 |
| 文化（每租户） | 守门判断标准、双仓边界、intake 哲学 | skill（opensource-ops） |

## 6. opensource-ops skill 同步改写

原则：**红线从"猫要记住"变成"系统强制 + skill 解释为什么"**（ADR-031 软+硬+eval 三层）。

| 现 skill 软层 | 终态硬层 | skill 改写后职责 |
|---|---|---|
| "external-wait，先问作者意图" | `awaiting_external` 状态 + 事件驱动唤醒 | 教什么时候**判**该等 |
| "守门 thread 默认不修 bug" | narrator role 无 worktree/merge 权限 | 教边界的例外（P0 止血） |
| "Direction Card 五件套" | DirectionCard 结构化 schema（narrator 输出强制） | 教写好卡的判断质量 |
| "谁接球谁负责等待" | `nextOwner` 字段 + SLA cron | 教 ownership 转移的判断 |
| "GitHub 编号优先于技术域" | narrator 搜证清单内建（linked PR/issue 自动解析进 timeline） | 教歧义时怎么裁 |
| 闭环靠全量同步兜底 | closureChecklist guard：不满足不许 `closed` | 教 waive 的正当理由 |

skill 瘦身方向：流程细节让位给状态机，保留判断标准和文化——这恰好让 skill 也可被别人家复用（他们的猫读同一份判断标准，驱动同一个状态机，绑定他们自己的模型）。

## 7. Phase 划分（每 Phase = 终态的一个完整组件，无临时桥）

| Phase | 交付 | 性质 |
|---|---|---|
| A 引擎心脏 | Event Log + CommunityObject 读模型 + 状态机 + 事实事件驱动（merge/close 自动转换）；看板/thread 自此同源 | 纯后端，可逆，猫力零消耗 |
| B Issue Signals | comment/review/label/close/reopen 事件全量进引擎（webhook-first + 轮询兜底，复用 HMAC/去重/RepoScan 既有框架）；`routed` 自动注册 tracking | 复用 F140/F141 基础设施，不建平行系统 |
| C Narrator + 路由 | Role Registry + narrator 短命 spawn + DirectionCard + F128 扩展（路由到已有 thread + role 下拉） | 含 eval 钩子，第一天就采数据 |
| D Closure + Reconciler | closureChecklist guard + GitHub⇄Case diff cron + SLA/死信重浮 | 杀死"修完忘回报" |
| E 看板决策队列 | "未回复 64"式积压展示 → Decision Packet 队列 UX；opensource-ops skill 改写合入 | CVO 体验收口 |

过渡期（任何代码落地前）：运维砚砚 retrospective 的 6 条操作纪律即刻生效，不等产品。

## 8. 待 CVO signoff

1. **F168 reopen**（本设计作为 reopen 后 spec 基础；F141/F140 作实现依赖挂靠）——F 号操作硬条件，需明确签字
2. Phase A+B 先行开工（纯后端可逆，按决策漏斗可自决，列出来供知情）
3. 运维砚砚 retrospective md 当前仍 untracked，建议 commit 归档（authorship 归他）

## 9. 预注册撤回条件（这版设计最可能错在哪）

1. Role Registry 可能在 v1 过度抽象——若家里实际只有一个租户一个 narrator，配置层可以薄（但接缝必须留对，这是"不硬编码"的最低承诺）
2. 事件全量进引擎可能放大噪音——若 informational 事件占比 >90%，分级打扰的阈值要重调
3. "看板/thread 同源"依赖 Console 改造量可能被低估——Phase E 的 UX 工作量需要前端猫评估

[宪宪/Fable-5🐾]
