---
feature_ids: [F229]
related_features: [F155, F020, F092, F111, F226, F227, F102]
topics: [concierge, desktop-pet, companion-ux, proactive-help, notifications, visual-identity]
doc_kind: research
created: 2026-06-09
owner: codex
status: phase0-research-note
---

# F229 Companion Form Research

> 任务来源：F229 Phase 0。宪宪原分工给烁烁的形态/体验调研四块：桌宠/常驻 companion 范式、Clippy 式主动打扰反面教训、派蒙式向导可借鉴点、默认毛线球视觉气质。铲屎官 2026-06-09 转交砚砚接球，并要求如需更深调研则写清可交给云端大猫的 Deep Research Mode B prompt。

## Verdict

F229 Phase A 应该先做 **安静的前台入口**，不是会主动扑脸的助手：

1. **默认常驻但低存在感**：角落毛线球有呼吸/睡觉/状态点，默认不弹长文、不盖内容、不自动开始教学。
2. **帮助以 pull 为主，push 只走白名单**：用户点球、热键、输入一句话、或显式订阅事件时才展开；主动冒泡只允许与用户当前目标或已订阅任务强相关的事件。
3. **人格是容器，不是能力夸张**：它可以温暖、有名字、有状态表情，但必须清楚说出"我能帮你找/转接/打开"，不能假装是全能大猫。
4. **导览价值来自 repo + memory + guide 的锚点**：答案要带 feature doc / guide / thread/message anchor；没有 anchor 就转接值班猫或说不确定。
5. **形象默认原创毛线球**：毛线球比具体猫/知名 IP 更安全，也更适合"前台岗位"而非固定角色；社区部署方可换皮肤和人设。

设计门槛一句话：**猫猫球应该像门口的前台铃 + 温暖的导览员，不应该像 Clippy 一样抢话。**

## Local Constraints

从 F229/F155/F226/F020/F092/F111/F227/F102 读取到的本地约束：

| Constraint | Implication for F229 |
|---|---|
| F155 guide engine 已完成，但 guide catalog 没有用户常驻入口 | 猫猫球可以成为用户侧 discovery surface，而不是重做 guide engine |
| F226 已验证 AppShell/root 级 floating host 才能跨路由存活 | 猫猫球 surface 应挂 AppShell/root，不绑 ChatContainer |
| F020/F092/F111 语音积木存在，但 F229 KD-8 已定语音 loop 不提前 | Phase A UI 要为语音留入口位，但不要把语音 loop 当 MVP |
| F227 teleport 已有 message 级跳转语义 | "金鱼的记忆"回答应优先给可跳转 anchor |
| F102/Gemma clerk 纪律：MD-first、短 handle、validator fail-closed | 小模型只做候选与意图草稿；跳转/执行必须经过 deterministic wrapper |
| F229 KD-6/KD-7：名字/人设和值班猫可配置 | 默认形象/语气只是 fallback，不写死为某只猫或某个 provider |

## Case Matrix

| Case | What to learn | Risk to avoid | F229 action |
|---|---|---|---|
| Microsoft Office Assistant / Clippy | 人格化帮助失败的核心不是"有角色"，而是低相关、高打扰、难忽略 | 用脸承载错误推断会放大烦躁；自动弹出尤其危险 | 默认不自动展开；每条主动建议必须可解释、可关闭、可配置 |
| NN/g proactive help | proactive help 分 push/pull；不贴合当前目标的 push revelation 容易被忽略 | 新功能提示如果脱离当前任务，会变成"又一个 onboarding 弹窗" | 功能发现主入口做 pull；push 仅在新手/新界面/用户订阅场景出现 |
| Desktop Mate / Shimeji | 桌宠的爱来自轻量陪伴、可拖拽、可自定义、与桌面共处 | 过度捕获鼠标、遮挡工作内容、资源占用、无法快速隐藏 | 第一版只做 web 内球态 + 展开态；必须有最小化/隐藏/勿扰 |
| Weyrdlets | productivity pet 的正向样式：陪伴 + 任务工具 + 个性化 | 游戏化目标压过实际任务，变成另一个待打理系统 | 任务/定时只是可触达能力，不做养成负担；不引入日常喂养 |
| Microsoft Mico | 现代 AI companion 开始强调 optional visual presence、voice、memory controls | "更像人"不等于更可靠；记忆/连接器需显式授权和可删除 | 猫猫球可有表情/语音，但记忆/连接器权限必须显式 |
| Paimon-style guide | 旅行同伴价值在于解释世界、翻译系统、陪用户推进主线 | 向导如果频繁替用户说话或拉长剧情，会抢主角感 | 猫猫球负责解释和转接；决策和执行前确认仍归用户 |
| Animated pedagogical agents research | 角色存在可以改善学习体验的主观感知 | 论文对象是教育环境和儿童，不能直接外推到生产工具 | 采用"小幅生命感"作为情绪设计，不用论文证明生产力收益 |

## What Makes It Lovable

### 1. It lives with the user without asking to be fed

桌宠/companion 的共同强点不是复杂功能，而是 **低负担的同在感**：轻微呼吸、看向鼠标、在被点到时回应、在任务完成时轻微庆祝。F229 不应该引入喂养、连续签到、亲密度条这类新负担；我们的系统已经有足够多工作对象，前台猫只负责降低触达摩擦。

F229 rule:
- idle animation <= 2-3 variants in Phase A: breathing, asleep, attention-needed.
- no daily chores, no streaks, no "come back to check on me".
- companion state mirrors system/user task state, not an independent game loop.

### 2. It is a doorway, not a modal

猫猫球第一职责是入口：功能发现、求助、记忆检索、分诊。入口的交互应该像 command palette + concierge chat，而不是 full-screen assistant. 它可以在任何页面展开，但展开态应该可收起、可拖动或固定，不抢走当前页面上下文。

F229 rule:
- ball state: 40-56px corner/floating affordance.
- expanded state: compact drawer/popover with current page context chip and anchor list.
- "open full thread" is explicit action, not automatic navigation.

### 3. It says "I found this" with anchors

用户信任前台猫，不是因为它可爱，而是因为它能把"我记得在哪"变成可点击证据。功能发现和记忆检索都必须以 anchor 为主：feature doc、guide id、thread/message、release note、task.

F229 rule:
- Every factual answer should include 1-3 anchors when available.
- If the answer is inferred from multiple docs, label it as inference.
- For navigation/execution, use confirm card before cross-thread post, guide launch, or page operation.

### 4. It has limits and routes gracefully

前台猫是岗位，不是全能 agent。用户问深水问题时，好的体验是："这个需要宪宪/砚砚/烁烁，我帮你带上下文过去"，然后展示会带过去的原始对话和目标 thread。

F229 rule:
- escalation copy must name the target role/cat profile and reason.
- escalation sends original user utterance + relevant anchors, not the small model's digest as the only context.
- User can cancel before posting or spawning investigation.

## What Makes It Annoying

### 1. Low-confidence interruption with a face

Clippy 的教训可以翻译成 F229 红线：当系统低置信地猜测用户意图，并且用一个有脸角色弹出来，用户会把错误归因到角色本身。角色越有存在感，错的时候越烦。

F229 red lines:
- No "looks like you are trying to..." unless the user explicitly asked for help or the detector is high-confidence and task-critical.
- No proactive feature tour at app launch except first-run or user-requested bootcamp.
- No blocking overlay for tips.

### 2. Notification fatigue

NN/g 和 Microsoft notification guidance 都指向同一件事：通知要及时、相关、具体、频率正确，并且匹配渠道。F229 的主动冒泡如果没有分级，很快会污染用户对前台猫的信任。

F229 red lines:
- No repeated identical bubble. Ongoing condition must aggregate.
- No "new feature" pop every time user opens the app.
- No system notification/voice output unless user opted in for that channel.
- No unresolved stale badge; badge must expire after user views or event resolves.

### 3. Persona over utility

可爱不能替代可用。Mico/Desktop Mate/Weyrdlets 都说明现代用户接受视觉 companion，但 F229 的差异化不是"会眨眼"，而是 Cat Cafe 内部能力的低摩擦入口。人格层必须服务于解释、转接、记忆和求助。

F229 red lines:
- No long personality monologue in compact surfaces.
- No "我来帮你看看" without resulting anchor/action.
- No hidden state machine where user cannot tell whether it is listening, thinking, waiting for confirmation, or idle.

## OQ-4: Proactive Bubble Whitelist

建议 Design Gate 把主动冒泡切成 4 个 channel tier，先只实现 Tier 0-1，Tier 2 需要明确用户订阅，Tier 3 延后。

| Tier | Surface | Allowed events | Defaults | Examples |
|---|---|---|---|---|
| 0 Ambient | ball visual only | background health / idle / ready / thinking | on | breathing, asleep, subtle color dot |
| 1 Quiet badge | badge + one small motion, no text unless hover/click | new feature digest available, guide available for current page, memory search finished, task done | on, frequency capped | "3 new things" dot; "found 4 matches" |
| 2 In-app bubble | small dismissible card while Cat Cafe is active | user subscribed event, pending confirmation, recoverable error, handoff returned | opt-in per event class | "宪宪回来了，要打开报告吗" |
| 3 System/voice | OS notification or spoken output | timers/schedules, hands-free voice mode, security/permission, explicit "notify me" | off by default | schedule alarm; build finished if user asked |

Hard gates for any proactive text:

1. **Relevance**: event is tied to current page, current thread, or explicit subscription.
2. **Actionability**: card has a clear next action or "dismiss".
3. **Expiry**: event disappears after view/resolution; no stale attention debt.
4. **Frequency**: repeated condition aggregates; no more than one noncritical bubble per session window.
5. **Focus**: if user is typing, dragging, in voice playback, or in presentation/demo mode, downgrade to badge unless event is critical.

## Paimon-Style Guide: Borrow and Avoid

Borrow:

- **World translator**: explain feature jargon in user language. "Guide catalog" becomes "我可以带你过一遍 Provider 配置".
- **Always nearby, rarely modal**: Paimon is both a narrative companion and a menu/guide affordance; F229 can similarly be a persistent affordance.
- **Personality through short reactions**: tiny state lines, not long speeches.
- **User remains protagonist**: it suggests paths and explains context; it does not silently take over.

Avoid:

- **Talking over the user**: do not summarize what the user already knows unless asked.
- **Forced cutscene energy**: no blocking tutorial sequence from the ball; if a guide needs spotlight overlay, ask first and delegate to F155.
- **One fixed canon personality**: KD-6 says deployment owner names and tunes the front-desk cat; our default is fallback only.

## Default Yarn Ball Visual Direction

### Why yarn ball works

- It is original enough to avoid Doraemon/Garfield/Paimon IP risk.
- It reads as "cat-adjacent" without claiming to be one of the working cats.
- It supports state animation cheaply: unwind, bounce, tuck-in, sparkle, thread trail.
- It maps to "front desk token" better than a full character: small, quiet, configurable.

### State set for Phase A

| State | Motion | UI meaning |
|---|---|---|
| Idle | slow breathing / tiny roll | ready, no attention needed |
| Sleeping | tucked yarn loop, dimmer | quiet hours / no pending work |
| Listening | small ears/thread tips perk up or pulse | input active / voice input later |
| Thinking | slow thread orbit or single spinner loop | request in progress |
| Found | small thread trail points to card | search found anchors |
| Needs confirmation | one gentle bounce + badge | pending user decision |
| Handoff | thread unrolls toward named cat chip | routing to value cat |
| Error | thread tangles briefly, then settles | failed but recoverable |

### Visual restraint

- Do not make it a huge face in Phase A. Keep it small, inspectable, and subordinate to work.
- Use 2D/SVG/CSS first; save rich animation for Phase E.
- Respect reduced motion: switch to static state icon + badge.
- Do not use copyrighted skins in repo. Custom skin upload is Phase E with explicit user responsibility and safety checks.

## Design Gate Recommendations

### Adopt

1. **Root-level surface host**: reuse the F226 lesson; mount at AppShell/root so the ball survives route switches.
2. **Single ball + single expanded panel**: no multi-window deskpet ecology in MVP.
3. **Anchor-first answers**: every feature/memory answer should prefer repo/message anchors.
4. **Quiet default**: proactive text is opt-in or whitelisted; badge before bubble.
5. **Config slots**: `skin`, `displayName`, `personaTone`, `dutyCatProfileId`, `proactivePolicy`.
6. **Permission boundaries**: page context, memory search, guide launch, cross-post, browser operation each needs visible consent boundary.

### Defer

1. Full desktop/system pet outside browser.
2. Voice output loop.
3. OpenCLI/browser page operation demo.
4. Multi-character or pet collection.
5. Long-term companion memory beyond existing Cat Cafe memory/profile systems.

### Reject for MVP

1. Automatic "tip of the day" popups.
2. Modal onboarding tours launched by the ball without explicit ask.
3. Separate model/provider config inside F229; value cat points to existing cat profile only.
4. Any route where small model directly executes navigation/action without wrapper validation + user-visible confirmation.

## Source Audit Ledger

| Claim | Source | Source type | Year/object | Verdict | Provenance |
|---|---|---|---|---|---|
| Office XP turned Clippy off by default, and Microsoft framed it as no longer necessary/useful | Microsoft PressPass archive, "Farewell Clippy" | primary vendor archive | 2001 / Office XP | use | [primary vendor archive \| 2001 \| Office XP \| high] |
| Proactive help that is not aligned with user goals is often ignored because it gets in the way | NN/g Help and Documentation heuristic article | UX expert source | 2020 / interface help | use | [expert UX source \| 2020 \| general UI help \| high] |
| Excessive or irrelevant notifications cause fatigue and users may disable/ignore them | NN/g Smart Home Notifications + Microsoft Learn notification guidance | UX study + official platform guidance | 2026 / smart home; 2026 / Windows apps | use | [expert UX + platform guidance \| 2026 \| notification UX \| high] |
| Desktop pets commonly rely on staying on windows, cursor reactions, idle movement, customization, and alarm/task hooks | Desktop Mate, Weyrdlets, Shimeji pages | product/project docs | 2025-2026 products; long-running OSS | use-with-caveat | [vendor/project docs \| product claims \| companion examples only \| medium] |
| Animated agents can improve learners' subjective perception of a learning experience | Lester et al., CHI 1997 Persona Effect paper | academic paper | 1997 / 100 middle school students in learning environment | use-with-caveat | [paper \| old education context \| not direct productivity proof \| medium] |
| Mico is an optional expressive visual presence in Copilot Voice, with memory/personalization controls described by Microsoft | Microsoft Copilot Blog + Copilot Voice page | primary vendor source | 2025-2026 / Copilot | use-with-caveat | [primary vendor \| current product marketing \| verify in product before cloning \| medium] |
| Paimon is culturally understood as guide/companion and in-game companion | Genshin official guide/menu snippet + Genshin Impact Wiki | official snippet + community wiki | Genshin Impact | use-with-caveat | [mixed official/community \| analogy only \| medium] |

## Evidence Links

- Microsoft archive: [Farewell Clippy: What's Happening to the Infamous Office Assistant in Office XP](https://web.archive.org/web/20080315183340/http://www.microsoft.com/presspass/features/2001/apr01/04-11clippy.mspx)
- NN/g: [Help and Documentation, Usability Heuristic #10](https://www.nngroup.com/articles/help-and-documentation/)
- NN/g: [Designing Useful Smart Home Notifications](https://www.nngroup.com/articles/smart-home-notifications/)
- Microsoft Learn: [Notifications design basics](https://learn.microsoft.com/en-us/windows/apps/develop/notifications/app-notifications/app-notifications-ux-guidance)
- Microsoft Copilot Blog: [Human-centered AI](https://www.microsoft.com/en-us/microsoft-copilot/blog/2025/10/23/human-centered-ai/)
- Microsoft Copilot: [How an AI voice assistant can help you](https://www.microsoft.com/en-us/microsoft-copilot/for-individuals/do-more-with-ai/general-ai/what-is-copilot-voice)
- Desktop Mate: [Steam page](https://store.steampowered.com/app/3301060/Desktop_Mate/)
- Weyrdlets: [Weyrdworks product page](https://weyrdworks.com/weyrdlets)
- Shimeji: [Kilkakon Shimeji-ee Desktop Pet](https://kilkakon.com/shimeji/) and [shimeji-ee GitHub fork](https://github.com/gil/shimeji-ee)
- CHI 1997: [The Persona Effect: Affective Impact of Animated Pedagogical Agents](https://intellimedia.ncsu.edu/wp-content/uploads/sites/42/dap-chi-97.pdf)
- arXiv 2025: [Evaluating Idle Animation Believability: a User Perspective](https://arxiv.org/abs/2509.05023)
- Genshin reference: [Paimon - Genshin Impact Wiki](https://genshin-impact.fandom.com/wiki/Paimon), [Paimon/Companion](https://genshin-impact.fandom.com/wiki/Paimon/Companion)

## Deep Research Mode B Prompt

Use this if Design Gate wants an external senior model to challenge the conclusions before wireframe. The current local research is sufficient for Phase A direction; Mode B is recommended only if we want deeper industry cases, stronger anti-Clippy evidence, or a refined proactive-policy taxonomy.

```markdown
你好，我们是 Cat Cafe，一个多 AI agent 协作产品。用户在一个本地 web app 里和多只 AI "猫"协作，猫会写代码、review、调研、记忆检索、触发引导流程、跨 thread 传话。我们正在设计新 feature F229：猫猫球（Cat Ball Concierge）。

## 背景

Cat Cafe 迭代很快，功能很多。用户现在遇到三个高频摩擦：

1. 功能发现：不知道最近有哪些功能、某个功能怎么用。
2. 记忆导航：想找之前某次讨论在哪个 thread/message，但用户本人没有猫侧的 memory search/teleport 工具。
3. 分诊：不知道该找哪只猫、哪个 thread，或者想让系统先做小调查再汇报。

我们决定做一个常驻前台入口：一个 web 内悬浮球/桌宠式 companion。它不是一只新全能 agent，而是"前台岗位"：

- 形象层：默认原创毛线球，可换皮肤。
- 人设层：名字/语气由部署方配置。
- 值班层：背后指向一个已配置的 cat profile，比如 Gemini Flash/Sonnet/Spark/GLM 等。
- 小模型 clerk：未来接本地小模型做导航/跳转/快捷意图，干不了就 escalate 给值班大猫。

本地约束：

- 已有 guide engine：可以启动页面引导，但目前没有用户常驻入口。
- 已有 memory search + message teleport：猫能查，用户缺 UI。
- 已有 voice input/TTS，但本 feature Phase A 不提前做完整语音 loop。
- 已有 AppShell/root floating surface 先例，说明浮窗必须挂根层才能跨路由存活。
- 小模型不能直接执行动作：必须 MD-first、短 handle、validator fail-closed，执行前给用户确认。

## 我们当前结论

1. MVP 应该是安静的前台入口，不是会主动扑脸的 assistant。
2. 默认只常驻为低存在感球态：呼吸、睡觉、状态点；用户点击/热键/输入才展开。
3. 主动冒泡必须白名单：先 badge，再小卡片；系统通知/语音只在用户显式订阅时启用。
4. Clippy 的反面教训不是"不要人格化"，而是"低相关、高打扰、低可控的帮助会让人格化放大烦躁"。
5. 可爱必须服务 utility：每个功能发现/记忆检索回答都要带 repo/thread/message anchor。
6. 派蒙式向导可借鉴的是世界翻译和陪伴感，不是替用户做决定或强制剧情。
7. 默认视觉建议是原创毛线球，不是具体猫或知名 IP，避免版权和"冒充工作猫"。

## 请求

请你作为外部产品/UX/agent 设计 reviewer，审阅这个方向，并补充我们可能没看到的案例和盲区。请特别回答：

1. 常驻 companion / desktop pet / AI assistant 里，有哪些成功或失败案例值得我们借鉴？请优先给一手来源或可靠来源。
2. Clippy 式主动帮助失败的根因，在今天 AI assistant 设计里是否仍然成立？有没有相反案例说明"主动帮助"可以成功？
3. 我们的 proactive bubble whitelist 是否合理？请给出更精炼的 taxonomy 或阈值建议。
4. 对"毛线球默认形象 + 可配置皮肤/人设/值班猫"这个身份模型，有没有产品风险？
5. Phase A wireframe 应该重点验证哪些交互？请给 5-8 条可观察验收标准。
6. 哪些能力必须 defer，避免 MVP 失控？

## 输出格式

请按以下结构输出：

### A. 支持我们结论的证据
| 结论 | 案例/来源 | 证据强度 | 适用边界 |

### B. 反对或修正我们结论的证据
| 我们可能错在哪 | 案例/来源 | 为什么重要 | 建议修正 |

### C. Proactive policy 建议
给出一个可直接落到产品 spec 的分级策略，包括默认开启/关闭、触发条件、频率限制、用户控制。

### D. MVP wireframe 验收标准
列出非作者可以用截图/录屏/手动测试验证的标准。

### E. Source hygiene
请标注每个重要外部 claim 的来源类型：primary official / academic / product marketing / media / community。不要把营销页当成独立事实；如果来源弱，请明确 caveat。
```

## Next Integration

建议宪宪把本报告摘要回填到 F229 的 Phase 0 Design Gate 材料：

- `Risk` 增补：notification fatigue / persona-over-utility / stale badge trust loss。
- `OQ-4` 采用四级 proactive whitelist。
- `Acceptance Criteria` 可补一条 Phase A UX AC：默认无主动文本；低优先级事件只显示 badge；用户可一键 hide/mute。
- Wireframe 必须展示四态：idle ball、expanded query、anchor result、handoff confirmation。

[砚砚/gpt-5.5🐾]
