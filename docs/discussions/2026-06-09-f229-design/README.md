---
feature_ids: [F229]
related_features: [F226, F227, F155, F102, F020]
topics: [design-gate, concierge, surface, identity-config, wireframe]
doc_kind: discussion
created: 2026-06-09
---

# F229 Design Gate — 猫猫球前台猫（Phase 0 设计材料）

> 作者：宪宪 (Fable-5)。输入：砚砚形态调研 `docs/research/2026-06-09-f229-companion-form-research.md`（commit 4566e96b8）+ F226/F227/F155/F102 真相源 + F229 KD-1~8。
> 状态：待铲屎官过 wireframe（前端 UX 确认人 = CVO）；架构部分欢迎砚砚/烁烁拍砖。

## 0. 新领域侦查（触发器 E，前置检查记录）

| 来源 | 发现 | 对设计的约束 |
|------|------|------------|
| F226 KD-1 + 实测 | 浮动 surface 挂 `ChatContainer` 下会随 `(chat)` layout 卸载；**必须挂 AppShell/root** | ConciergeSurfaceHost 挂 root，与 FloatingPresentationSurfaceHost 平级 |
| F195 | react-rnd + portal(document.body) 浮窗技术先例 | 直接复用技术路线 |
| F155 close 记录 | guide catalog 设计上是猫触发，无用户浏览入口 | 前台猫 = guide 的用户侧 discovery surface，不重做 engine |
| F227 | teleport 已有 message 级跳转语义 | 记忆导航答案给可跳转 anchor，不自己造跳转 |
| F102/gemma 线 | MD-first / 短 handle / validator fail-closed 实测收敛 | clerk 不直接执行动作；wrapper 校验 + 用户确认 |
| 砚砚形态调研 | Clippy 根因 = 低相关×高打扰×难关闭，人格放大烦躁 | quiet default + 四级白名单（全文见 research doc） |

## 1. 架构归属一问（F191）

```markdown
Architecture cell: concierge-surface（新建）
Map delta: new cell required
Why: 常驻用户侧入口 + 值班槽 + escalation 协议是一条新架构线——hub-action-surface 是
"猫→用户"单向 surface 动作，concierge 是"用户→系统"的常驻路由岗位，现有 cell 无归属。
```

- 边界：**只新建一个 cell**，cell 内部消费现有 cell 的既有接口（memory 检索、F227 teleport、F128 cross_post/propose_thread、identity-session 的 cat profile、dispatch 的 invocation queue），**不在任何被消费 cell 内新增平行设施**。
- cell 文件随 Phase A 实现 PR 一起建（`docs/architecture/ownership/cells/concierge-surface.md`）。

## 2. 身份三层配置模型（KD-1/6/7 落地草案）

```ts
// per-deployment 配置（settings 级真相源），与 cat-config.json 解耦
interface ConciergeConfig {
  enabled: boolean                   // 默认 on，可整体关闭（红线：可彻底隐藏）
  skin: 'yarn-ball'                  // Phase A 仅内置原创毛线球；Phase E 开放自定义
  displayName: string                // 部署方起名（KD-6；本家 Phase A 落地时家庭投票）
  personaTone: string                // 一句话人设（注入值班猫 system prompt 的 persona 段）
  dutyCatProfileId: string           // 值班槽：指向一只已配置的猫（KD-7；本家默认 gemini35）
  proactivePolicy: 'ambient' | 'quiet-badge' | 'bubbles-optin'
                                     // = 调研 Tier 0 / 0-1 / 0-2；Tier 3 Phase C+ 才出现
  voiceOutput: false                 // Phase C 前恒 false（KD-8）
}
```

- **值班槽是引用不是配置**：要配 glm5.1 = 家里先配一只 glm5.1 的猫（现有 provider/adapter 框架），槽位指过去。F229 内零模型配置（调研 Reject #3 同源）。
- **人设注入点**：值班猫被前台岗位唤起时，SystemPromptBuilder 注入 concierge persona 段（displayName/personaTone/岗位职责/anchor-first 纪律），同一只猫在普通 thread 里不受影响——岗位人设跟岗位走，不跟猫走。

## 3. 对话载体决策（待讨论项 → 我的立场）

前台猫对话发生在哪？三个选项：

| 选项 | 说明 | 判断 |
|------|------|------|
| (a) 专属 concierge thread（per-user 常驻，sidebar 默认隐藏） | 展开面板 = 该 thread 的 mini view | ✅ **我的立场**：复用消息/invocation/记忆/A2A 全套现有设施（架构归一），历史可追溯可检索，分诊 cross_post 有合法源 thread |
| (b) ephemeral 无 thread 会话 | 轻，但要为它造平行的消息/调用链路 | ❌ 违背架构归一（OQ-2 铲屎官方向） |
| (c) 绑当前页面 thread | 上下文天然，但污染工作 thread + 非 thread 页面（/memory 等）无载体 | ❌ 覆盖不了全路由 |

选 (a) 的推论：球的"思考中"状态 = 该 thread 的正常 invocation 生命周期，现有可观测性全部白拿。

## 4. Surface 技术路径

- 新组件 `ConciergeSurfaceHost` 挂 **AppShell/root**（F226 KD-1 教训），独立于 FloatingPresentationSurfaceHost——**同层不同件**：语义（常驻入口 vs 演示浮窗）、生命周期（永驻 vs tear-off）、状态机（八态 vs docked/floating）都不同，强行合并 = 堆层。
- 球态/展开态状态进全局 store（不绑 `(chat)` route group）；reduced-motion 降级静态图标 + badge（调研 Visual restraint）。
- 球态 40-56px；展开态 compact drawer（不是 modal，不盖内容）；page context chip 只注入 URL/标题（OQ-6 隐私边界 Design Gate 内定：Phase A 只取路由级信息，不读页面内容）。
- 记忆检索走现有 memory API + F227 teleport；跳转/cross_post/guide 启动全部**确认卡先行**（调研 anchor-first + 红线）。

## 5. Wireframe（Phase A 四态 + 设置页）

### 态 1 — Idle 球态（任意页面右下角，默认形态）
```
┌─ Cat Café 任意页面 ──────────────────┐
│                                      │
│          （正常页面内容，零遮挡）       │
│                                      │
│                              ╭──╮    │   40-56px 毛线球
│                              │🧶·³│   │   呼吸/睡觉微动画
│                              ╰──╯    │   badge=安静红点（hover 才出文字）
└──────────────────────────────────────┘   默认无任何主动弹出文本
```

### 态 2 — 展开态（点击/热键唤起，compact drawer 不盖内容）
```
╭───────────────────────────────╮
│ 🧶 {displayName}      ⚙  ─  ✕ │
│ ┌───────────────────────────┐ │
│ │ 📍 当前页: /memory         │ │ ← page context chip（路由级）
│ └───────────────────────────┘ │
│  想找什么？我帮你接线～         │
│ ┌───────────────────────────┐ │
│ │ 之前讨论图书馆记忆的        │ │
│ │ thread 在哪来着？    🎤 ↵  │ │ ← 🎤 = F020 现成语音输入
│ └───────────────────────────┘ │
│  [有什么新功能] [带我配置] …   │ ← pull 式快捷入口，非主动推送
╰───────────────────────────────╯
```

### 态 3 — Anchor 结果态（anchor-first + 去/取分叉，CVO 2026-06-09 反馈）

> 铲屎官："有的时候是想直接过去，有的时候只是想看看曾经都说了什么。"——**"去"（teleport）和"取"（原地预览）是两种意图**，每张结果卡都给两个动作。

```
╭───────────────────────────────╮
│ 🧶 找到 3 条，最相关：          │
│ ┌───────────────────────────┐ │
│ │ 📌 图书馆记忆架构           │ │
│ │ thread · 2026-05           │ │
│ │ "多域知识联邦，试点…"       │ │ ← exact quote
│ │ [跳过去]   [原地看 ▾]      │ │ ← 去：F227 teleport
│ ├───────────────────────────┤ │    取：卡内 inline 展开
│ │ ▾ 原地看（不离开当前页）：   │ │      anchor 前后往来原文
│ │  铲屎官: 图书馆记忆要…      │ │      (get_thread_context
│ │  宪宪: 多域知识联邦…        │ │       before/after 窗口)
│ │  [展开更多] [还是跳过去]    │ │
│ └───────────────────────────┘ │
│ + 2 条其他匹配 ▾               │
│ ⓘ 不对？换个说法，或喊值班猫    │
╰───────────────────────────────╯
```

### 态 4 — 转接确认态（escalation：原话带走 + 传话/跟去分叉，CVO 2026-06-09 反馈）

> 铲屎官："1. 传话过去 2. 直接前端得跳转过去？"——转接同样分**relay（我留在原地，球帮我投递）**和 **go（我跟着过去）**。

```
╭───────────────────────────────╮
│ 🧶 这题得请值班猫 {烁烁}：      │
│ ┌───────────────────────────┐ │
│ │ 将带去的上下文：            │ │
│ │ · 你的原话（完整，非摘要）   │ │ ← KD-3 原始对话
│ │ · 相关 anchor × 2          │ │
│ └───────────────────────────┘ │
│ 你想怎么处理？                 │
│ [传话过去·我留在这]            │ ← relay: cross_post 投递，
│ [跳过去跟进]                   │   回复回来时 Tier 2 回执卡
│ [取消]                        │   （调研白名单已预埋
╰───────────────────────────────╯    "handoff returned" 事件类）
                                  ← go: teleport 到目标 thread
```

- **relay 的回执闭环**：投递后球态进入 handoff（毛线伸向目标猫 chip）；对方回复 → Tier 2 回执卡"烁烁回来了，要看吗"（这是 opt-in 气泡的第一个默认开启事件类，因为它是用户自己发起的订阅——满足白名单 hard gate #1 relevance）。

### 设置页（Settings → 前台猫）
```
├ 启用            [on]
├ 皮肤            [原创毛线球 ▾]        （Phase E 开放自定义上传）
├ 名字            [____________]        （本家：家庭投票后填入）
├ 性格            [温暖·简短 ▾]
├ 值班猫          [烁烁 gemini35 ▾]     ← 列表 = 已配置 cat profiles
└ 主动性          [安静 Tier 0-1 ▾]     （气泡 Tier 2 默认关，逐事件 opt-in）
```

## 5.5 岗位工具面与 prompt 裁剪（Duty Toolset，CVO + 吴浪 2026-06-09 同时提出）

> 铲屎官："家里的 mcp 太多了全丢给小猫感觉人家未必能调用的清楚。甚至这个 agent runtime 如果不支持 tool search tool 那更恐怖。"
> 吴浪："提示词什么也得剪裁的……他的主要职责是管理，所以得控制下他暴露出来的工具这些。"

**原则：岗位 = 身份 + 人设 + 工具面 + prompt，四件都按岗裁剪，不继承全家桶。**

Phase A 工具面（≈10 个，curated 白名单）：

| 类别 | 工具 | 服务的 Job |
|------|------|-----------|
| 记忆三入口 | `search_evidence` / `graph_resolve` / `list_recent` | 金鱼的记忆 |
| 原地看 | `get_thread_context`（bounded window） | 态 3 "取" |
| 跳转 | `teleport` | 态 3 "去" |
| 传话 | `cross_post_message` | 态 4 relay |
| 开调查 | `propose_thread`（Phase B 启用） | 分诊 |
| 引导 | `get_available_guides` / `start_guide` | 求助 |
| 功能发现 | `feat_index` | 有什么功能 |

- **明确排除**：shell_exec、文件读写、worktree/git、limb、finance、browser、audio capture 等全部工作猫工具——前台猫职责是**接线和管理**（吴浪），不操作本地（他说的"检索"裁掉的是 repo/file 检索，**memory 检索保留**——金鱼的记忆是本 feat 核心 Why，这是我们与吴浪表述的一个明确差异点）。
- **裁剪的红利**：工具面 ≤10 个 → schema 可全量静态注入，**不依赖 runtime 的 tool-search 能力**——铲屎官担心的"runtime 不支持 tool search"被裁剪直接消解（坐标变换：不是给小猫配检索器，是把面裁到不需要检索）。
- **Prompt 裁剪**：岗位 prompt = 简身份（displayName/personaTone）+ anchor-first 纪律 + 工具面说明 + escalation 协议 + 白名单事件语义，**不带 SOP/家规/L0 全文**——值班猫在前台岗位时用岗位 prompt，回普通 thread 用完整 L0（岗位 prompt 跟岗位走，§2 人设注入点的推广）。
- 实现载体：`ConciergeConfig` 增加隐式常量 `dutyToolset`（代码内白名单，Phase A 不开放配置——先固定面，等真实使用反馈再决定是否开放）。

## 6. 砚砚调研采纳决议（逐条表态）

- **Adopt 6 条全收**：root host / 单球单面板 / anchor-first / quiet default / 五配置位（voiceOutput 恒 false 算第六位）/ 权限可见边界
- **Defer 5 条全收**：系统级桌宠、语音 loop、OpenCLI 演示、多角色收集、独立 companion 记忆——与 F229 Phase 划分一致
- **Reject 4 条全收**：无 tip-of-the-day / 无未经请求的 modal tour / F229 内零模型配置 / 小模型不经 wrapper+确认不得执行——其中第 4 条已是 KD-3/KD-5
- **OQ-4 四级白名单采纳为正式设计**：Phase A 只实现 Tier 0-1；Tier 2 逐事件 opt-in；Tier 3 默认关、绑 Phase C+

## 6.5 社区视角输入（吴浪/mindfn，2026-06-09 微信，铲屎官转达 4 截图）

吴浪是 F155 guide engine 作者，他的独立思考与本设计的对照：

| 吴浪观点 | 对照结论 |
|---------|---------|
| "直接新增一个 live cat 成员，复用语音配置和基础 prompt 配置，模型可选已有配置或小模型" | ✅ 与 KD-2/KD-7 独立收敛——值班槽指向 cat profile，双方撞出同一答案，方向置信度 +1 |
| "得控制他暴露出来的工具…提示词也得剪裁" | ✅ 与铲屎官 MCP 裁剪点撞车 → 已落为 §5.5 Duty Toolset（我们之前**确实漏了显式设计**，社区视角补盲） |
| "考虑其他人的使用，live model（API）比内置小模型合适" | ✅ **补盲：部署现实主义**——不是每家有 128GB Mac 跑 27GB 模型。Phase D 定位修正：「快速档」provider-agnostic（本地 gemma **或** API flash/glm 均可作 clerk），本地小模型是 opt-in 优化不是前提 |
| "采集和根据使用情况，通过猫猫球来提醒和反馈" | 🔶 **补盲但设边界**：基于使用模式的个性化提醒（"你还没用过 schedule"）有价值，但涉及行为遥测 + 主动打扰双重边界 → 记 OQ-7，Phase B+ 再定，MVP 不做 |
| "让猫猫自己去构建那个能力引导"（guide 自生成） | 🔶 好方向但归属 F155 演进线（guide 供给侧），F229 是消费侧——记入 Related，不进本 feat scope |
| "live cat 不需要他去操作本地和检索" | ⚠️ **部分不采纳**：repo/file 检索裁掉 ✓，但 **memory 检索保留**——金鱼的记忆是 F229 核心 Why，裁掉它前台猫只剩转接价值 |

## 7. 自检

- **元审美**：本设计是坐标变换不是堆项——不造新 agent 物种/新消息链路/新模型配置，新增的只有"岗位"这一个概念（壳 + 配置 + escalation 协议），其余全是现有积木的引用。对话载体选 (a) 正是为了删掉"平行会话设施"这个潜在堆层。
- **In-context observability**：`primary_surface` = 球本体八态（idle/sleeping/listening/thinking/found/needs-confirmation/handoff/error，调研状态集）——状态发生在哪就显示在哪；`why_not_dashboard_only` = 前台猫的工作状态就是用户等待的现场，藏进日志 = Datadog 反模式；`deep_dive_surface` = concierge thread 完整历史（选项 a 白拿）；`noise_dedup_policy` = 同类事件聚合 + badge 过期（调研 hard gates #3/#4）。
- **Eval Contract（F192）**：不触发——F229 是产品 feature，不改 skill/MCP/shared-rules/SOP，不改变猫行为模式。产品侧指标（功能发现命中率/分诊准确率）属产品 KPI，Phase A 验收用 AC 承载。
- **Design in Context**：Phase A 实现前对 AppShell 现有布局（ActivityBar/右栏/浮窗 z-index token）过 checklist，wireframe 已避开右栏生态位（球独立于 workspace 格子）。

## 8. 下一步

1. **铲屎官过 wireframe**（本材料核心待确认项：四态交互 + 设置页配置位 + 对话载体选项 a）
2. wireframe OK → writing-plans 拆 Phase A 实施计划 → worktree 开工
3. Mode B 云端深审（砚砚已备好 prompt）：仅当铲屎官想在 wireframe 前再加一层外部挑战时启用，默认不走（本地调研已足够支撑 Phase A 方向）
