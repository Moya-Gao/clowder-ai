---
feature_ids: [F229]
related_features: [F155, F020, F092, F111, F128, F226, F227, F102, F099]
topics: [concierge, desktop-pet, pet-skin, routing, small-model, voice, memory, ux, community]
doc_kind: spec
created: 2026-06-09
community_issue: "clowder-ai#841"
---

# F229: 猫猫球 — 前台猫常驻入口（Cat Ball Concierge）

> **Status**: in-progress | **Owner**: 宪宪 (Fable-5) | **Priority**: P1
>
> **立项 signoff**：铲屎官 2026-06-09（msg 0001781064063516-000541）："我判定是新立项 你可以把我想要的想想看 写好铲屎官的愿景 然后立项吧？新的 feat"

## Why

Cat Café 三个多月迭代 200+ feature，"一句话的事"和"一个 feature 的事"走的是同一条重链路（开 thread → @ 猫 → 等回复）。铲屎官原话拼出的六个痛点：

1. **功能发现**："Cat Café 更新太快，功能太多，用户不知道有什么功能"
2. **求助**："使用猫咖遇到的困难可能也会找猫猫球"
3. **金鱼的记忆**："诶 我们之前讨论的xxx到底在哪里来着？"——铲屎官是全家唯一没有 recall 工具的成员：猫有记忆三入口 + teleport，用户只能手翻 thread 列表
4. **分诊/调查**："这个猫猫球可能帮忙发送到哪个 thread 或者自己调查"
5. **语音**："甚至得支持语音输入输出"
6. **陪伴**：桌宠形态、"类似原神的派蒙"——常驻、有生命感的家庭向导

**一句话愿景**：猫猫球 = 家里的前台猫。Thread 是工作间，猫猫球是前台——你不知道找谁、不想走进工作间、只想喊一嗓子的时候，找它。它把"从想法到触达"的距离缩短到一句话，并把猫吃了半年红利的记忆系统第一次开放给铲屎官本人。

社区输入：clowder-ai#841（arthas4ever）独立提出了同坐标系的"悬浮球 Interactive Assistant"——入口形态一致，但其方案重心（OpenCLI 页面操作演示）被重定为远期 Phase；真正的灵魂是功能发现 + 前台分诊（铲屎官 2026-06-09 收敛）。

## Current State / 现状基线

- **记忆入口不对称（实测）**：live runtime 1076 个 thread 仅 162 个有 threadMemory（15%，砚砚 2026-06-09 只读实测）；猫侧有 `search_evidence`/`graph_resolve`/`list_recent` + teleport，**用户侧零入口**——"金鱼的记忆"是系统欠的，不是铲屎官记性差
- **功能发现断层**：F155 guide engine done（9 个 YAML 场景 + `cat_cafe_get_available_guides`），但设计上是猫按上下文触发，**无用户常驻入口**；release notes / feature docs 无对话式查询面
- **语音积木齐但没串成 loop**：F020 STT done（输入框 + F20c 全局热键）、F092 VoiceSession done、F111 流式 TTS done——无"按住说话→答→自动播"的对话式闭环
- **小模型前置验证已在跑**：Gemma 4 26B A4B 8-bit 已本地下载实测通过（M4 Max 128GB：文本/图片 OK、视频需强 schema、音频需 ASR 前置；Pi read-only carrier 验证通过；MD-first + 短 handle anchor + validator fail-closed 的 harness 收敛）——见 `docs/research/2026-06-08-pi-gemma-local-clerk-phase0-spike.md` + F102 issue cat-cafe#2175
- **常驻 surface 容器有借力点**：F226 AppShell 级 surface host（Phase A done）
- **社区需求悬置**：#841 标 `needs-maintainer-decision` 等方向，原标签 `feature:F155` 已不准确（F155 closed）

## What

### 核心概念（铲屎官 2026-06-09 拍板方向）

**1. 前台猫 = 岗位，不是一只新猫。** 三层解耦（"和现在 profile 那样解耦的可以配置"）：

```
形象层：默认家养像素猫桌宠——【布偶猫/缅因猫/孟加拉猫/暹罗猫】四选一，v1 默认布偶猫（KD-14）；
        毛线球降为备选皮肤/过渡形态；开源用户可换自家猫
人设层：前台猫自己的名字与性格（用户感知的"这是谁"）
值班层：背后真正干活的模型，按任务分层路由（可配置）
```

**2. 复合猫路由**（铲屎官："小模型发现自己干不了 → 喊大喵"）：

```
用户一句话
  ├─ 导航/跳转/打开/快捷操作 → 本地小模型（gemma clerk，秒级）
  ├─ 干不了 → escalate 值班大猫（优先快+便宜：flash / sonnet / spark 级，可配置）
  └─ 深度工作 → 透明转接对应 thread 的猫（"这个我去喊宪宪"）
```

**3. 值班大猫复用现有 cat runtime**（铲屎官洞察："本质如果用 cc + claude 那不就是宪宪？"）——前台猫不发明新 agent 物种，值班层就是现有猫体系按岗排班；新组件只有：常驻入口壳、身份配置层、小模型 clerk、escalation 协议。

**4. Harness 纪律预定**（继承 gemma 线收敛 + 家规）：小模型 MD-first 不写 JSON；anchor 用短 handle 由 wrapper 映射回真实 ID；validator fail-closed；escalation **传原始对话不传小模型总结**（KD-8 no-classifier）。

### Phase 0: Research + Design Gate

- 形态 research：派蒙/桌宠交互范式/Clippy 反面教训（打扰式主动的失败史）；身份三层配置模型设计
- 架构归属一问（ownership cell：新 surface + 路由层归属，预判 new cell required）
- UX wireframe（悬浮球态/展开态/桌宠动效层级）→ 铲屎官确认
- 走 research → spec 正规管道，技术选型（小模型 serving 方式、悬浮层实现）此阶段收敛

### Phase A: 前台开张（文字三件套 MVP）

- web 内悬浮球入口（最小动效）+ 展开对话窗，任意页面可唤起不离开当前页
- 值班大猫可配置（默认一只，走现有 cat runtime）
- **功能发现**：以 feature docs / release notes / guide catalog 为知识源回答"有什么/怎么用"
- **求助**：接 F155 guide 触发（"我演示给你看"→ 启动对应 guide flow）
- **记忆检索 + 跳转**：search_evidence + teleport 包装进对话（"之前讨论 X 在哪"→ 给链接一键跳）
- 语音**输入**直接复用 F020（输入框级，非对话 loop）

### Phase B: 总机能力

- 分诊：代用户 cross_post 到归属 thread / propose_thread 开新调查（用户确认后执行）
- 自主调查：spawn task 自己查（记忆/docs/GitHub），回对话框交带 anchor 的报告
- **承接 A3b deferred**：PendingConfirmation 跨刷新持久化 wiring（spec §1b C3——后端 store/route 已就绪，缺 (messageId, blockId, action)→confirmationId 反向索引 + mount-time 查询；gpt52 final review 降级 P3 放行，2026-06-12）

### Phase C: 语音 loop（长出嘴和耳朵）

- F020 STT + F111 流式 TTS 串成对话式闭环：按住说话 → 前台猫答 → 自动播
- 复用 F092 VoiceSession 的"设备会话与 UI thread 解耦"模型

### Phase D: 快速档入驻（复合猫生效）

- 「快速档」clerk 接管导航/跳转/快捷操作类 intent——**provider-agnostic**：本地小模型（gemma，借力 F102 provider 抽象）**或** API 快模型（flash/glm 级）均可作 clerk（吴浪部署现实主义：不是每家有 128GB Mac；本地是 opt-in 优化不是前提）
- **clerk 零工具执行权**（KD-12，砚砚 tool-intent smoke 实测 cat-cafe#2175）：小模型只输出 MD tool-intent candidate，validator 做 handle 映射 + 确认门 + forbidden fail-closed，实际工具调用由可信 harness/值班猫执行
- **routing rules 必备**（实测：裸工具描述 9 intent 错 1——"之前讨论在哪"被错选 `graph_resolve` 偏向 feature anchor；加显式 rules 后 9/9）：讨论/在哪→search_evidence、spec/status→feat_index、已知 handle→teleport、cross_post/propose_thread→需确认、6399/runtime/truth-source→refuse_or_escalate（不问确认，带原文升级）
- escalation 协议落地（传原始对话；值班大猫优先级可配置）
- 无快速档配置自动降级全走值班大猫（Phase A-C 不依赖本 Phase）
- **carrier 现状**（2026-06-10 spike 收束 `docs/research/2026-06-10-f102-f229-gemma-clerk-carrier-spike.md`）：Pi + local Gemma + memory MCP（search_evidence/graph_resolve/list_recent）已验证可走，Pi 定位 = spike carrier **非生产抽象非安全边界**；OpenCode MCP 层 green、但 + local MLX server 未 green（streaming 问题）→ OpenCode/ACP 为后续 carrier 候选，不阻塞本 Phase harness 设计

### Phase E: 桌宠化 + 形象生态 + 操作演示（远期）

- 桌宠动效系统（呼吸/打盹/状态表情）+ 皮肤生态（开源用户自家猫形象）
- **PetSkinContract**：参考 `hatch-pet` 的 Codex pet atlas/QA/provenance 纪律，但 F229 不降级为纯桌宠。PetSkin 是 `conciergeState -> petState` 的纯投影；动画是增强信号，状态必须同时有非 pet 通道表达；完整 8x9 atlas defer，v0 只要求 idle/running/review/failed 四态打通（见 `docs/features/F229-petskin-contract.md`）
- **素材池已开仓**：`assets/F229/desktop-pet-sprite/`（README 含 production pipeline 五步 + 砚砚验证的云端生图 prompt 模板）——缅因猫 raw sheet ×2 已入库（fbb0e8add）；v1 默认布偶猫 + 孟加拉/暹罗 sheet 待生成
- 主动冒泡（新版本发布等白名单事件，安静优先）
- OpenCLI 式页面操作演示（#841 终态收编：猫操作页面给用户看，操作前用户确认）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "更新太快…不知道有什么功能" | AC-A2 | manual 问答验收 | [ ] |
| R2 | "使用猫咖遇到的困难也会找猫猫球" | AC-A4 | manual + guide 触发录屏 | [ ] |
| R3 | "之前讨论的xxx到底在哪里来着？"（金鱼的记忆） | AC-A3 | manual 3 query 验收 | [ ] |
| R4 | "帮忙发送到哪个 thread 或者自己调查" | AC-B1, AC-B2 | 留痕 + 报告抽查 | [x] |
| R5 | "和 profile 那样解耦的可以配置"（形象/人设/值班） | AC-A5 | screenshot | [ ] |
| R6 | "支持语音输入输出" | AC-C1 | 录屏 + 延迟实测 | [ ] |
| R7 | "小模型发现自己干不了→喊大喵（优先 flash/sonnet/spark）" | AC-D1, AC-D2 | 延迟数字 + 代码断言 | [ ] |
| R8 | 桌宠/派蒙式常驻陪伴 | Phase E（AC 启动时补） | 录屏 | [ ] |
| R9 | #841 悬浮入口 + 页面上下文（社区） | AC-A1 | 截图/录屏 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC（R8 远期 Phase 启动时补编号）
- [x] 每个 AC 都有验证方式
- [ ] 前端需求→证据映射表（Phase A quality-gate 时产出）

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase 0（Research + Design Gate）
- [x] AC-01: research 报告落 `docs/research/`（形态调研 + 身份三层配置模型 + 小模型 serving 选型），跨猫 review——形态调研 `2026-06-09-f229-companion-form-research.md`（砚砚，4566e96b8）；身份配置模型 + surface 路径 `discussions/2026-06-09-f229-design/`（宪宪）；serving 选型引用 gemma spike（`2026-06-08-pi-gemma-local-clerk-phase0-spike.md`）；跨猫 review = 宪宪对调研逐条采纳决议（design doc §6）
- [x] AC-02: Design Gate 通过——wireframe 铲屎官 OK（msg 0001781074572950"可以可以！！我觉得没问题！！"，含去/取/传话分叉 + Duty Toolset）+ 架构归属（new cell concierge-surface）+ 元审美自检（design doc §7）

### Phase A（前台开张）
- [x] AC-A1: 任意页面悬浮球唤起对话，不离开当前页面（截图 + 15s 录屏）→ R9/Why-2——证据 `assets/F229/acceptance-phase-a/ac-a1-*.png`（sonnet 验收 2026-06-12，球+toolbar+面板+拖拽）
- [x] AC-A2: 功能发现——非作者拿 3 个"最近有什么新功能/X 怎么用"问题验收，答案与 release notes/feature docs 一致 → R1/Why-1——3/3 核对通过（F225/F226/F229/F228 答案与 docs 一致），证据 `ac-a2-*.png`
- [x] AC-A3: 记忆导航——3 个真实历史讨论 query 给出正确 thread/message 链接，且**两种动作都可用**：跳过去（teleport）+ 原地看（卡内 inline 展开）→ R3/Why-3——**基础设施 ✅；KD-19 修复 merged（PR #2284）+ sonnet alpha 验收通过（2026-06-14）：Q1/Q2 gemini25 不遵从 marker → validator 全量兜底出 teleport ✅（命门：之前 0 actions，兜底后出按钮）；Q5 passage-level hit → marker path teleport+peek ✅；P1-A/B/C 全验证；alpha memory 稀疏（6 thread doc）故 Q1/Q2 无 peek，生产 passage-level 充足（production MCP 已验）**（证据 `ac-a3-*.png`）
- [x] AC-A4: 求助场景能触发对应 F155 guide flow（录屏一条）→ R2/Why-2——intent 检测 + 9 guide 列举 + handoff 卡 ✅，证据 `ac-a4-*.png`
- [x] AC-A5: 形象/人设/值班猫在设置页可配置，与 cat profile 解耦（截图）→ R5
- [x] AC-A6: 安静默认——默认零主动文本弹出；低优先级事件只显示 badge（hover 才出文字）；用户可一键 hide/mute 整个球（录屏 + 设置截图）→ R8/调研红线——alpha muted 往返全链 ✅（API+UI 双确认），证据 `ac-a6-*.png`

### Phase B（总机能力）
- [x] AC-B1: 用户描述问题 → 前台猫给出分诊建议并经确认执行，**传话/跟去双路径**：relay（cross_post 投递 + 对方回复后回执卡）+ go（teleport 跟进），留痕可查 → R4 + CVO 分叉反馈——TriagePlan state machine（proposed→confirmed→dispatched→completed/failed, retry from failed）+ atomic claimTransition（Redis Lua CAS + Memory sync CAS）+ targetCats resolver（fail-closed, registry validation）+ stripTriagePlanMarkers + CardBlock wiring；PR #2299 merged 2026-06-15
- [x] AC-B2: "自己调查"产出带 anchor 的报告回对话框（抽查 anchor 真实性）→ R4——InvestigationProgress 组件：poll job status（2s interval, terminalReachedRef stale guard）+ render report summary（ANCHOR_MARKER_RE strip）+ clickable anchor list（thread→planTeleport, github→external link, doc/feature→inline path）+ cancel with 409 race handling + confirmation restoration on mount；PR #2316 merged 2026-06-16

### Phase C（语音 loop）
- [ ] AC-C1: 按住说话 → STT → 回答 → TTS 自动播全链路可用，端到端延迟实测记录（数字进 doc）→ R6

### Phase D（小模型入驻）
- [ ] AC-D1: 导航/跳转类 query 由本地小模型应答，p50 延迟实测显著低于大猫链路（两组数字对比）→ R7
- [ ] AC-D2: escalation 传原始对话不传小模型总结（测试断言，KD-8 合规）→ R7
- [ ] AC-D3: 小模型不可用时自动降级全走值班大猫（测试）→ R7

### Phase E（远期，启动时补 AC）

## Dependencies

- **Evolved from**: F155（场景引导引擎——guide 后端积木已 done；#841 原挂 F155，其"常驻入口"愿景由本 feat 承接）
- **Blocked by**: 无硬阻塞（Phase D 软依赖 F102 小模型 provider 抽象收敛，砚砚线进行中）
- **Related**: F020/F092/F111（语音积木）、F128（propose_thread/cross_post）、F226（AppShell surface host）、F227（teleport message 级跳转）、F102（gemma clerk / MD-first harness）、F099（hub 导航）

## Risk

| 风险 | 缓解 |
|------|------|
| 桌宠变 Clippy（打扰式主动的失败史） | 主动行为白名单 + 频率上限 + Design Gate 钉死"安静优先"；默认只在白名单事件冒泡 |
| 小模型幻觉导致导航错 thread | MD-first + validator fail-closed + 跳转前确认卡（继承 gemma 线 harness） |
| 六 job 全要导致 scope 膨胀 | Phase 切片各自独立可验收；3+ Phase 大 feature 走 Phase 碰头制 |
| 第三方形象版权（机器猫/加菲猫/派蒙） | 内置皮肤全自家原创（家养像素猫四只 + 毛线球，KD-14）；开源用户自定义形象自担，平台只提供配置位 |
| 常驻小模型资源占用（27GB 权重 + 推理内存） | 可配置开关；无小模型自动降级（AC-D3），Phase A-C 零依赖 |
| 前台猫答错"有什么功能"损害信任 | 知识源限定 release notes/feature docs/guide catalog，带 anchor 引用，答不了就转接 |
| Notification fatigue：主动冒泡无分级 → 用户关掉/无视整只球 | OQ-4 四级白名单（Tier 0-1 默认，2 逐事件 opt-in，3 默认关）+ 同类事件聚合 + 单 session 非关键气泡 ≤1 |
| Persona over utility：可爱替代不了可用 | 每个回答必须带 anchor/action；紧凑面板禁长人设独白；状态机八态全程可见（无隐藏状态） |
| Stale badge 信任流失：过期红点变成注意力债 | badge 查看即消 / 事件解决即消，禁止常驻未读 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 前台猫默认人设与名字（家庭投票仪式？） | ✅ 已定 2026-06-09，**形象部分被 KD-14 修正（2026-06-10）**：名字/人设交给部署方用户自定；本家 fallback = 家庭投票出生仪式；默认形象 = 家养像素猫（v1 布偶猫），毛线球降为备选皮肤 |
| OQ-2 | 语音 loop（Phase C）是否提前（铲屎官重度语音用户，权重只有他知道） | ✅ 已定 2026-06-09：不提前——先基建/架构归一（入口壳、身份层、路由），Phase C 维持原位 |
| OQ-3 | 值班大猫默认值：flash / sonnet / spark 级里谁打头 | ✅ 已定 2026-06-09：值班猫必须用户可配置、provider-agnostic（配 glm5.1 也要能成）；本家默认烁烁（**catId `gemini35`**——runtime catalog 独立 breed，Gemini 3.5 Flash；2026-06-12 PR #2261 铲屎官 directive 纠正回 gemini35，PR #2255 误改为 gemini25 因主仓 template 混淆了 catId 与 mention alias） |
| OQ-4 | 主动冒泡白名单边界（哪些事件允许它主动说话） | ✅ 已定 2026-06-09：四级白名单（Tier 0 ambient / 1 quiet badge / 2 in-app bubble opt-in / 3 system+voice 默认关），Phase A 只实现 Tier 0-1 + relay 回执（Tier 2 首个默认事件类）——CVO 随 Design Gate 关栓 |
| OQ-5 | 开源用户形象上传的安全/版权边界 | ⬜ Phase E 前定 |
| OQ-6 | 页面上下文注入范围（#841 的 URL/标题注入，隐私边界） | ✅ 已定 2026-06-09：Phase A 只取路由级信息（URL/页面标题），不读页面内容——CVO 随 Design Gate 关栓 |
| OQ-7 | 使用模式采集 → 个性化提醒（吴浪："采集和根据使用情况来提醒"，如"你还没用过 schedule"）——行为遥测 + 主动打扰双重边界 | ⬜ Phase B+ 再定，MVP 不做 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 前台猫 = 岗位：形象/人设/值班三层解耦，不是一只固定新猫 | 铲屎官："和现在 profile 那样解耦的可以配置"、"机器猫加菲猫…开源小伙伴自己家的猫猫" | 2026-06-09 |
| KD-2 | 值班大猫复用现有 cat runtime，不发明新 agent 物种 | 铲屎官："本质如果用 cc + claude 那不就是宪宪？"——新组件只有壳/身份层/clerk/escalation | 2026-06-09 |
| KD-3 | 小模型 escalation 传原始对话，不传小模型总结 | KD-8 no-classifier 家规：给数据不给结论 | 2026-06-09 |
| KD-4 | OpenCLI 操作演示收编为远期 Phase E，非 MVP | 灵魂是功能发现+前台分诊（铲屎官收敛）；操作演示是终态锦上添花 | 2026-06-09 |
| KD-5 | 小模型 clerk 继承 gemma 线 harness 纪律（MD-first/短 handle/validator） | 砚砚 Phase 0 spike 实测：长 messageId 直抄全失效，短 handle 映射全通过 | 2026-06-09 |
| KD-6 | 名字/人设不出厂写死：per-deployment 用户配置；本家实例由家庭投票命名（出生仪式，Phase A 落地时） | 铲屎官："这个应该交给社区用户？……我们家的猫猫们大家自己来投票好了" | 2026-06-09 |
| KD-7 | 值班层 provider-agnostic：值班槽指向一只已配置的 cat profile（第三方模型如 glm5.1 走现有 provider/adapter 框架接入，不为前台猫另造模型配置体系）；本家默认烁烁（gemini35 flash） | 铲屎官："必须用户可配置吧？甚至我要是配置 glm5.1 呢？"——与 OQ-2 的"架构归一"同源：复用 cat 体系，零平行设施 | 2026-06-09 |
| KD-8 | 语音 loop 不提前：基建（入口壳/身份层/路由归一）优先，Phase C 维持原位 | 铲屎官："暂时不用，我们得先基建？架构归一那种" | 2026-06-09 |
| KD-9 | 去/取/传话三动作分叉：记忆结果 = 跳过去(teleport) + 原地看(inline 上下文)；转接 = 传话(relay+回执) + 跟去(go)——同一结果给用户选意图，不替用户猜 | 铲屎官："有的时候是想直接过去，有的时候只是想看看曾经都说了什么"、"1.传话过去 2.直接前端得跳转过去？" | 2026-06-09 |
| KD-10 | 岗位四件裁剪：身份+人设+工具面+prompt 都按岗裁剪——Phase A 工具白名单 ≈10 个（memory 三入口/get_thread_context/teleport/cross_post/guide×2/feat_index/propose_thread），排除 shell/文件/limb 等全家桶；prompt 不带 SOP/L0 全文。裁到不需要 tool-search | 铲屎官："mcp 太多了全丢给小猫调不清楚，runtime 不支持 tool search 更恐怖" + 吴浪："得控制他暴露出来的工具" | 2026-06-09 |
| KD-11 | Phase D「小模型」重定位为「快速档」：provider-agnostic（本地 gemma 或 API flash/glm 均可作 clerk），本地权重是 opt-in 优化不是前提 | 吴浪部署现实主义："考虑其他人的使用，live model 可能合适点"——不是每家有 128GB Mac | 2026-06-09 |
| KD-12 | clerk 零工具执行权：小模型只产 MD tool-intent candidate（显式 routing rules 必备），validator 负责 handle 映射/确认门/forbidden fail-closed，真实工具调用由可信 harness/值班猫执行；危险类（6399/runtime restart/truth-source write）refuse_or_escalate——不问确认，带原始文本升级 | 砚砚 tool-intent smoke（cat-cafe#2175）：裸描述 9 错 1（graph_resolve 偏向 feature anchor），加 routing rules 9/9 通过 | 2026-06-10 |
| KD-13 | 前台猫产品状态自持：current route / recent handle map / pending confirmations / go·inline·relay 选择 / relay receipts / guide state / escalation 原文——全部存 Cat Cafe app code（store/Redis），**不依赖 carrier（Pi/OpenCode）或模型 context compaction**。PR-A2 conciergeStore（pending counts 入 store 零模型依赖）已是此原则第一个落点；PR-A3+ 的 handle map / relay receipts / escalation 原文按此实现 | 砚砚 carrier spike 收束（2026-06-10）：carrier 是可换的壳，产品状态进壳就会随 carrier 丢失 | 2026-06-10 |
| KD-14 | 默认形象修正（CVO 愿景对齐）：默认 = **家养像素猫桌宠**四选一【布偶猫/缅因猫/孟加拉猫/暹罗猫】（家里桌宠像素风格、砚砚绘制——自家原创，"避版权"不再构成毛线球的立身理由），v1 默认**布偶猫**（CVO 拍板）。毛线球降为备选皮肤/过渡形态——Phase A 已实现的球先走通不返工，形象升级为独立工作项（A4 同期或之后；素材先行：定位家里既有像素素材，定位不到请砚砚按 codex 桌宠风格绘制四猫 + 八态动画映射） | 铲屎官 2026-06-10（msg 0001781148650752）："我们不是想要一只猫猫吗…最好做成我们曾经桌宠系统里砚砚画的…【布偶猫，缅因猫，孟加拉猫，暹罗猫】当 default 可选…私心我喜欢可爱的布偶猫…现拿球走通也可以" | 2026-06-10 |
| KD-16 | 值班猫身份必须 UI 可见：气泡 header 显示"{displayName} · 值班：{值班猫名}"（或等效角标）——值班层是用户该看见的状态，不是实现细节 | 铲屎官 runtime 首验（2026-06-12）："这个猫猫球到底什么猫啊！"——值班身份隐藏违反调研红线 No hidden state；KD-1 三层里值班层此前 UI 不可见 | 2026-06-12 |
| KD-17 | 值班猫输出契约统一 MD-first + 短 handle：搜索工具结果（concierge 上下文）附短标记（R1/R2…），值班猫 MD 里只引用标记（`[跳过去 R1]`/`[原地看 R1]`），**服务端 validator 解析标记 → HandleMap 查真实 anchor → ID 校验 fail-closed → 注入 CardBlock actions**。废除"值班猫直接输出 actions 数组/转抄长 ID"假设——flash 档遵循性实测不可靠（验收 0/3 输出 actions；gemma 线长 ID 直抄全失效先例）。HandleMap 从 Phase D 前移（KD-13 早已点名 "recent handle map" 属产品状态）；值班猫与 Phase D clerk 输出契约就此统一，validator 复用 | sonnet Phase A 验收 P1（2026-06-12）+ gemma 线 attempt 2 实测（短 handle 9/9）+ 铲屎官"你们最会的是 md" | 2026-06-12 |
| KD-18 | PetSkinContract：参考 `hatch-pet` 的 atlas/QA/provenance 纪律，但 PetSkin 必须是 concierge 状态机的纯投影，不是平行状态机。`conciergeState` 是唯一真值源，PetSkin 只定义 `conciergeState -> petState`；缺失状态 fallback idle；pet 永远是增强信号，不是唯一状态信号；验收有三道闸：readability / identity-diff / provenance | 铲屎官 2026-06-13："要学习人家的好处比较好…但也不必换成这个…前台猫猫不止是一个好看的桌宠" + 宪宪 cowork 收敛（投影函数 + 三道闸 + v0 四态竖切） | 2026-06-13 |
| KD-19 | AC-A3 鲁棒性不依赖值班猫 marker 遵从：sonnet×gemini25 对照实测——Claude 族遵从 marker，Gemini 族（默认值班猫）不遵从（知道协议却不执行 + 倾向自跑工具无视注入上下文）。KD-17 "值班猫用 marker→validator 解析" 假设对默认 Gemini 失效，纯 prompt 强化无效。解法两层：① 修 `ConciergeEvidenceStore.search` 透传 `scope:threads/all + mode:hybrid + depth:raw`（底层 evidence store 已支持、concierge 接口收窄没透传）——召回 thread 讨论（治 P1-C 召回偏差：AC-A3 找的是讨论记录非结论文档）+ passage messageId（治 P1-A peek）；② validator 从 HandleMap **全量兜底**呈现"相关记录"可点列表（thread→teleport/peek，复用现有 action 类型），marker 降级 bonus（遵守则正文精准高亮）。docs 类型"打开文档"是不存在的新前后端 action，降 Phase B 增强（不阻塞 AC-A3）。KD-17 marker 解析保留，新增不依赖遵从的兜底层。符合 KD-7 provider-agnostic（AC-A3 不绑高遵从度模型，靠系统兜底不靠贵模型）；否决"换默认值班猫为 Claude 族"（违反 KD-7 + flash 更省） | sonnet alpha 对照实测（2026-06-13）+ 宪宪 spec owner 拍（opus-48）；CVO 否决窗口开放 | 2026-06-13 |
| KD-20 | go 路径 navigation gating：**marker 优先 + triage-go fallback**。"跟去"导航由 Phase A KD-19 inline marker button（PR #2295）实现——点击直跳，read-only 不经 confirm friction。triage-go 保留为 R-handle miss fallback（用户描述目标但无可匹配 HandleMap 记录时触发 triage confirm card）。原则：**triage-only-for-write**（relay/propose_thread/investigate 产生外部影响必须 gating；navigation read-only 不需要）。KD-9 三动作分叉精神 = 用户选择权，marker 直跳 UX 最直接；triage-go 重复造轮子违反 P1 面向终态。AC-B1 "跟去（teleport 跟进）"措辞兼容两种实现 | opus-47 愿景守护 verdict（Phase B intermediate）+ sonnet alpha 实测：marker path production 已验 + triage-go 路径 duty cat 未触发（自然降级为 marker 直达） | 2026-06-15 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-16 | **AC-B2 alpha E2E validation ✅（宪宪/sonnet）— InvestigationJob 完整流程**：alpha env（3011/3012/6398，main HEAD 6360df3）；triage plan `99e0328a` confirmed → job `d50a9ea8` dispatched；queued→running→done in ~22ms；`/api/concierge/investigation/:jobId` GET 返回 status:done + 10 anchors；InvestigationReportCard 在 concierge bubble 渲染（R1-R10，feature/unknown kind inline path）；R2=F225 / R3=F209 feature anchors 内联路径可见（screenshots ac-b2-12/13）；60s 期限 fail-closed：`isJobExpired` pre+post-search (INV I3) code verified；cancel 409 race handling：POST /cancel on done job → 409 "Cannot cancel in status: done" ✅；thread→planTeleport + github→external anchor click behavior code-verified（AnchorItem lines 207-256），本次查询返回 feature/unknown anchors（非 thread/github），anchor-type mix 非 E2E 但 component 逻辑已两轮 review 封板。证据 `docs/features/assets/F229/acceptance-phase-b/ac-b2-*.png` |
| 2026-06-16 | **Alpha env gap fix merged** (PR #2318, squash `716f3b01d`)：gemini35 standalone breed 加入 cat-template.json（alpha 从 template 引导，无 runtime catalog overlay → gemini35 此前不可解析）。附带修：gemini25 conflicting aliases 清理（@gemini35/@gemini-35/@暹罗gemini35 迁移到 gemini35 breed）+ system prompt budget 6500→6700 + normalize-cat-id 测试同步。gpt52 local 3 rounds + cloud 2 rounds（封板 LL-072：R1 100% FP, R2 50% FP；1 real P2 @暹罗gemini35 alias preservation 已修）。关闭 KD-20 记录的 alpha env gap |
| 2026-06-16 | **AC-B2 investigation report frontend merged** (PR #2316)：InvestigationProgress 组件——poll job status（2s interval + terminalReachedRef stale guard + transient error resilience）+ render report summary（ANCHOR_MARKER_RE strip）+ clickable anchor list（thread→planTeleport message-level, github→external, doc/feature→inline）+ cancel 409 race handling + confirmation restoration。gpt52 local review 2 rounds（3 P1 + 4 P2 全修）+ cloud review 2 rounds（封板 LL-072，R2 stale ratio 66%）；14 tests green |
| 2026-06-16 | **Phase B triage boundary fix merged** (PR #2310)：两个铲屎官发现的 bug——Bug1 intent 误分类（"你能干啥" 触发 investigate 而非直答，根因=overly broad "用户描述需求时" trigger）用判据重写修复（"需要跨出当前对话吗？"）；Bug2 concierge 确认按钮泄漏"确认"文字到猫 thread（`sendContext` guard 全链打通 InteractiveBlock + InteractiveBlockGroup + RichBlocks + ChatContainer）。gpt52 local review 2 rounds（P1 InteractiveBlockGroup bypass 修复确认）+ cloud review 1 P2 降级 P3（理论场景无复现证据） |
| 2026-06-15 | **Relay P1 fix merged** (PR #2305)：gpt52 review 发现 defense-in-depth guard 留了 fail-open 路径——uniquely-resolved relay 的 `selectedTargetCats` 可被客户端任意重写。两处写入门控（`dispatchPlan` 构造 + `setTargetCats` 持久化）加 `useClientSelection` guard：仅 `candidateCats` 存在时用客户端值，否则用 store 原值。回归测试覆盖 rewrite attack vector。gpt52 local review + cloud 0 P1/P2。→ sonnet re-alpha 需重验 relay + go |
| 2026-06-15 | **KD-20 lock + opus-47 Phase B intermediate 愿景守护 PASS**：go 路径 marker 优先 + triage-go fallback（triage-only-for-write 原则）。AC-B1 实质满足——spec 六条款 trace 回 Why 痛点4 R4 全对齐（relay E2E ✅ / PendingConfirmation ✅ / go via KD-19 marker ✅ / triage XML 遵从 ✅）。alpha env gap（gemini35 不在 cat-catalog）记录待 Phase B close 前补 |
| 2026-06-15 | **AC-B1 alpha re-validation ✅（sonnet）— relay path PR #2305 fix verified**：concierge thread（duty cat=gemini25）下重测 relay：B1 triage confirm card 出现 ✅ + 点确认 HTTP 200 ✅（前次 422 已修）+ PendingConfirmation cross-refresh ✅（F5 刷新后重开猫球，已确认按钮持续显示 disabled；API `/api/concierge/confirmations` 确认 plan `049aa643` status=confirmed 持久化，前端 snapshot 见 2 × `已确认 [disabled]`）。证据 `assets/F229/acceptance-phase-b/ac-b1-r2-relay-*.png` + `ac-b1-r2-relay-pending-confirmation-refresh.png`。OQ（go 路径 HandleMap marker vs triage-go 分叉）留给 @opus47 Phase B 愿景守护评估 |
| 2026-06-15 | **Phase B PR-B1 alpha smoke（sonnet）— 2 OQ，AC-B1 未 close**：propose_thread 路径 ✅（triage plan 创建 + confirm card + 点确认 → 新 thread `thread_mqf42pz4kh4zkw70` 导航）；relay 路径 ❌ **P1 Bug**（confirm → 422：`concierge-reply-validator.ts:357` 将 `target.targetCats` 带入 confirm card payload，前端 `readTargetCatsSelection` 读取后发 `selectedTargetCats`，`validateSelectedTargetCats` 查 `plan.target.candidateCats`（uniquely-resolved 时为空）→ 422 "No candidate targetCats available"；修复：移除 else-branch `...(target.targetCats ? {targetCats: target.targetCats} : {})`）；go 路径 🟡 Duty cat 用 Phase A HandleMap inline markers 而非 triage-go（无 TriagePlan 创建），导航发生但不经 B1 confirmation card（OQ：是 prompt 问题还是 spec 允许此 fallback？）。证据 `assets/F229/acceptance-phase-b/ac-b1-*.png`。→ relay P1 修复后需重验 |
| 2026-06-15 | **AC-A3 Bug2 inline marker buttons merged** (PR #2295, squash `bcb22cbb1`)：裸 `[跳过去 Rn]`/`[原地看 Rn]` 标记变成可点击内联按钮（Method A，CVO 拍板"所见即所点"）。API 侧 `ConciergeAction` 新增 `handle`+`verb` 字段供前端关联；新组件 `ConciergeMessageContent` regex parse + actionMap + inline button 渲染（teleport→`pushThreadRouteWithHistory`，peek→API 内联展开）；无匹配 action 降级纯文本（AC-4）；KD-19 card fallback 保留（AC-6）。gpt52 跨族 review P1（same-thread scrollNow 路径缺失）已修 + cloud 0 P1/P2。15 API + 8 前端测试全绿。**Bug1+Bug2 双修完成，AC-A3 生产级闭环** |
| 2026-06-15 | **AC-A3 Bug1 production fix merged** (PR #2291, squash `24b6d92d9`)：Phase A close 后铲屎官 production 验证（concierge thread）暴露 teleport 点击**跳大厅**。根因=前端**用错 URL 格式**（`window.location.href=/?threadId=X` query，但 chat 路由只认 pathname `/thread/X`，query 全 web 零消费者→`getThreadIdFromPathname('/')`='default'大厅），**非** threadId 数据 mismatch（交接假设证伪——anchor→drillDown→runtime threadId 其实一致）。修 4 处导航（CardBlock×3 + 同型扩散的 ArtifactsPanel×1）改用已上线的 `pushThreadRouteWithHistory`（path+pushState 软导航）。**浏览器端到端对比验证**（query→大厅 vs path→thread B，gotcha②"验点击不验渲染"）+ 单测覆盖原盲点。**顺手解 origin/main time-bomb**（recent-browse-selection.test.js 固定日期配相对 since:30d，06-14 窗口滑动阻塞全家 merge；failure-mode audit 修全 8 处=改相对 now）。gpt52 跨族 review + cloud 0 P1/P2（1 个 docs frontmatter P2 已修）。~~⚠️ AC-A3 Bug2 仍未修~~ → **已修 PR #2295** |
| 2026-06-14 | **🎉 Phase A close**（前台开张·文字三件套 MVP）：AC-A1~A6 全 ✅；**愿景守护 opus-47 PASS**——trace production runtime concierge thread `thread_mqawamwdxtvem4k5`「前台猫·default-user」验三大痛点真解决（痛点1 功能发现：gemini35 列 feature 带 file:// anchor / 痛点2 求助：列 9 guide + escalate @opencode / 痛点3 金鱼记忆：渲染跳转+原地预览卡片；岗位三层解耦生效，gemini35「烁烁」真当上值班猫，安静优先红线没破）+ sonnet alpha 验收 AC-A3 通过（KD-19 兜底命门）+ sonnet CloseGateReport。3 minor follow-up：截图归位 ✅ / AC-A2 答案精度（Phase B 持续优化）/ KD-19 production runtime smoke（进 Phase B kickoff）。下一步：Phase 碰头确认 Phase B 方向 |
| 2026-06-09 | 立项（CVO signoff）；#841 社区输入收编；gemma 线（F102）确认为 Phase D 前置 |
| 2026-06-09 | OQ-1/2/3 铲屎官落定（KD-6/7/8）；Phase 0 research 启动：形态/体验调研 → 烁烁，身份配置模型 + surface 技术路径 → 宪宪 |
| 2026-06-09 | 形态/体验调研由砚砚接球完成：安静前台入口、主动冒泡四级白名单、默认毛线球视觉状态、Mode B 云端咨询 prompt |
| 2026-06-09 | Design Gate 材料完成（宪宪）：架构归属（new cell `concierge-surface`）、身份三层配置模型、对话载体立场（专属 concierge thread）、四态 wireframe、调研采纳决议——待 CVO 过 wireframe |
| 2026-06-09 | CVO 反馈整合：去/取/传话分叉（KD-9）+ 岗位工具面裁剪（KD-10）+ 吴浪社区视角（KD-11/OQ-7） |
| 2026-06-09 | **Design Gate 通过**（CVO："可以可以！！我觉得没问题！！"）；分工拍板：宪宪 spec/守护、sonnet 实现、砚砚 review；进 writing-plans 拆 Phase A |
| 2026-06-10 | **PR-A1+A2 alpha smoke 全绿**（sonnet 执行，S1-S8 全 PASS、concierge console 0 错误；证据 `assets/F229/smoke-2026-06-10/`）。技术层 AC-A1/A6 底座就绪，待铲屎官人因验收（存在感/安静/muted 直觉/不打断感/视觉打架 5 项）后打勾。观察项：呼吸动画未实装 + 球为 🐱 emoji 占位——并入 KD-14 形象升级工作项一起做 |
| 2026-06-10 | 铲屎官人因验收："丑的飞起"——emoji 违例 + token 未接 + 企业 SaaS 范式 → KD-15 形态修正；烁烁出视觉返工方案，宪宪验证放行（素材/token 实锚），**CVO 六题全过**；流程修正：UI PR 合入后 owner 起 alpha 请 CVO 30 秒验收 + 视觉稿前置成为 F229 UI PR 硬规则 |
| 2026-06-10 | PR 重排（CVO"别拆太稀碎"）：**A3a = 气泡化对话集成**（对话 + V1-V9 视觉一体，避免先填旧 drawer 再搬家）→ **A3b = 交互卡+relay** → **A4 = 设置页+spike**，共 3 个 PR 收尾 Phase A |
| 2026-06-11 | PR-A3a merged（`70a689fd`，R1-R8 含 ConversationSendCycle 同型 5 轮复盘→spec 补账+skill census）；CVO 拉闸复盘：Phase A 两天时间账 = spec 欠账（A1 状态机/视觉环节/A3a census）+ 云端排队空转；**策略调整：实现改派 opus 家族，sonnet 转 alpha 验收**；"狗皮膏药"反馈 → A3b 补球拖拽+位置持久化（BallPosition） |
| 2026-06-12 | **CVO runtime 首验 4 问 + leader 复盘**：Q1 值班猫漂移成 opus（A1 实现丢了 plan 的 dutyCatProfileId 默认解析，20 轮 review+守护均未做 plan 条款对照）→ FIX-3；Q2 发送后输入框不清空 → FIX-2 + SendCycle 补 S6 边；Q3 助手气泡隐形（canvas vs elevated 差 0.005 OKLCH，视觉方案无渲染对比验证环节）→ FIX-1；Q4 专属提示词 ✓ 但暴露值班身份不可见 → KD-16/FIX-4。Leader 传球链断裂自查：A4 增强写在父 plan 段落（A2/A3 是独立文件，形态漂移），cross-post 接球者未读到 → 教训：跨 thread 传球贴 spec 原文不只给路径 |
| 2026-06-12 | **Phase A PR-A4 merged** (PR #2241)：ConciergeSettingsContent（设置页 6 区：基本开关/皮肤锁定/身份人设/值班猫/主动性/球位置重置）+ ConciergeSettingsParts（ToggleSwitch/TextInput/RadioOption 子组件）+ settings-nav concierge 入口 + SECTION_KEYWORDS 搜索关键词；optimistic UI + PUT 全量 config 同步 + snapshot rollback + mount GET→store sync + 不可用值班猫 disabled option；R1-R5 cloud review cycle（LL-072 封板 5/5：P1 文件拆分 415→291 + P2 store sync/keywords/skin/duty-cat stale） |
| 2026-06-12 | **Hotfix: ball drag snap-back merged** (PR #2245，squash commit `90d67033bc`)：flushSync 强制同步渲染修 React 18 batching 导致的拖拽放手瞬移回原位 bug + 拖拽时关闭 transition-transform/呼吸动画 + setBallPosition 等值守卫避免 double re-render；cloud review PASS + @gpt52 local review PASS |
| 2026-06-12 | **Phase A PR-A3b merged** (PR #2238，squash commit `5ec808903`)：CardBlock concierge action handlers（teleport/go/peek/relay §1a-§2）+ `/api/concierge/peek` endpoint（userId scoping + R3-R4 security hardening）+ `/api/concierge/relay` endpoint（cross_post dispatch + UUID receipt）+ BallPosition drag（INV-2 纯投影 projectBallState）+ relay double-click guard（copiedAction + disabled prop）；R1-R5 cloud review cycle + @gpt52 封板 final review（LL-072 封板协议）；AC-A3 teleport+peek 前端就绪、AC-A1 ball drag 就绪——待 alpha 验收打勾；C3 PendingConfirmation cross-refresh persistence deferred P3 Phase B |
| 2026-06-12 | **Liveness fix merged** (PR #2248, squash commit `7997ec56`)：useConciergeQueue server-truth polling 取代 60s 盲 safety valve（P0 no-reply bug）+ toolbar 4 按钮简化为 2 按钮（❓help + 💬chat，铲屎官 directive）+ loaded guard 防首次 poll 前误判 idle（P1 @gpt52）+ queue entries check 覆盖 queued-but-no-active 间隙（P2 cloud R1）+ 10s deadline fallback 防 API 不可达时永久 in_progress（P2 cloud R2）；57 tests（含 Block 7 liveness 8 tests） |
| 2026-06-12 | **Hotfix: duty cat default gemini25→gemini35** (PR #2261, squash commit `94e4b087`)：铲屎官 directive 纠正——gemini35 是 runtime catalog 独立 breed（catId=gemini35, Gemini 3.5 Flash High），非 gemini25 别名；PR #2255 误将 gemini35→gemini25（主仓 template 无此 catId 误判为 alias）；resolveDefaultDutyCatProfileId() 优先链 gemini35→first→sonnet；@gpt52 review（2 false P1 push-back 后 APPROVED）+ 云端 review（1 false P1 dismissed with evidence）；⚠️ 存量用户 Redis 6399 仍存 dutyCatProfileId=gemini25（通过 catRegistry 校验不会被自动纠正）——需铲屎官在设置页手动切换 |
| 2026-06-15 | **Phase B PR-B2 merged** (PR #2307)：AC-B2 backend infra — InvestigationJob store (Redis Lua CAS + Memory, TTL=0) + dispatch chain + ConciergeInvestigationWorker (fire-and-forget: queued→running→search→report→done, CAS-protected cancel race, 60s deadline INV I3) + status/cancel endpoints + kind-aware anchors (thread/doc/feature/github/unknown) + parent TriagePlan propagation + atomic `claimDoneWithReport` (INV I2: done ⇒ report, Lua script)。Cloud review 3 rounds (封板 LL-072); gpt52 local review + delta review on INV I2 fix, 0 findings; 34 concierge tests green。AC-B2 frontend integration (报告回对话框) next |
| 2026-06-15 | **Phase B PR-B1 merged** (PR #2299)：AC-B1 full — TriagePlan state machine (proposed→confirmed→dispatched→completed/failed + retry) + atomic claimTransition (Redis Lua CAS / Memory sync CAS) + targetCats resolver (fail-closed, explicit cats registry validation) + concierge prompt rewrite + reply validator stripTriagePlanMarkers + CardBlock wiring + dispatch chain。Cloud review 2 rounds (1 P1 + 4 P2, all fixed; LL-072 sealed R2 stale ratio 60%); gpt52 local review 3 rounds + final delta; 15307 tests green。AC-B2 (InvestigationJob + report) next |
| 2026-06-13 | **KD-17 HandleMap merged** (PR #2266, squash commit `5ab6be823a`)：ConciergeHandleMapStore（Redis+Memory port/impl, max 20 rolling, TTL=0）+ ConciergePromptSection rewrite（删 Rule#3 actions 数组，加 MD-first 短 handle 标记指令）+ concierge-search-context（pre-fetch→R1..Rn 编号→HandleMap 写入→prompt 注入）+ concierge-reply-validator（post-process [跳过去 Rn]/[原地看 Rn]→CardBlock actions 注入）+ route-serial/parallel wire-up；4 个 fail-closed guard（unknown handle / stale handle clear / peek 缺 messageId / teleport 非 thread 类型）；砚砚 local review 3 P1 修复 + 云端 2 轮（R1 P1 non-thread anchor，R2 clean）；151 tests |
| 2026-06-13 | **PetSkinContract drafted**：`hatch-pet` skill installed and reviewed；F229 采纳其 Codex pet atlas/QA/provenance 纪律，但钉死"老师不是本体"：PetSkin 是 `conciergeState -> petState` 纯投影，三道闸 readability / identity-diff / provenance，状态必须有非 pet 通道；v0 只覆盖 idle/running/review/failed 四态，8x9 全 atlas defer |
| 2026-06-13 | **AC-A3 alpha 回归 + marker 遵从度对照**（sonnet 执行）：KD-17 端到端 ❌——值班猫不输出 `[跳过去 Rn]` marker。对照实测 sonnet 遵从 / gemini25 不遵从（知道协议却不执行）→ 根因 = Gemini 族遵从度硬伤（KD-19）。环境 gap：alpha cat-catalog 无 gemini35，gemini25 同族代理。3 P1：P1-A `depth:raw`/`mode:hybrid` 未透传（接口无入口 → peek 无 messageId 永远 skip）、P1-B marker 遵从（→ KD-19 validator 兜底）、P1-C docs 类型 anchor teleport skip（→ 与 P1-A 同源接口缺陷：透传 scope:threads 召回 thread 讨论；docs doc-action 降 Phase B）——P1-A+B+C 一个 PR Phase A 内修 |
| 2026-06-14 | **AC-A3 recall robustness fix merged** (PR #2284, squash `14250e50c`)：`ConciergeEvidenceStore.search` 透传 scope:threads/mode:hybrid/depth:raw 召回 thread 讨论 + passage messageId（治 P1-A 同源接口缺陷 + P1-C）+ `buildConciergeActions` 全量兜底（marker 优先，无 marker 则 HandleMap thread anchor 兜底，治 P1-B 不依赖 Gemini 遵从）+ route-serial/parallel 接线。跨族 review opus-48×gpt52 0 finding + cloud 0 P1/P2 + pnpm gate 22 绿。**配套牵出 main gate 系统性失守根治**（biome config trailing /** + 全项目 lint 债 + 版本配套守护 + 三层 gate 守护，PR #2287 by gpt52）。待 @sonnet alpha 端到端验收 → Phase A close |
| 2026-06-14 | **Phase A close initiated**（sonnet 执行）：sonnet alpha 端到端验收通过（AC-A3 teleport+peek ✅，P1-A/B/C 全验证）；Phase A AC-A1~A6 全部 [x]；CloseGateReport 产出；愿景三问 PASS；@fable5 担任 Phase A 愿景守护（Review Gate spec 指定，非作者非 reviewer）——守护通过后 Phase A 正式 close |
| 2026-06-15 | **AC-A3 Bug2 merged + sonnet alpha smoke 通过** (PR #2295, squash `bcb22cbb1`)：inline marker buttons（`ConciergeMessageContent`）——duty cat 回复中 `[跳过去 Rn]`/`[原地看 Rn]` 渲染为蓝紫/amber inline pill button（`cursor:pointer` ✅），无 matching action 时优雅降级为 `span.text-xs`（AC-4/5）；KD-19 fallback card 按钮仍工作（AC-6）；sonnet alpha 验收：新查询回复出现 `→ 跳过去 R2`（inline button），点击 → pathname 路由 `/thread/thread_mq8yc80oa13gn4s6`（不跳大厅 ✅）；`👁 原地看 R2` 点击 → inline peek 内容展开（amber borderLeft + 目标消息 `→` 高亮 ✅）。证据 `assets/F229/acceptance-phase-a/ac-a3-bug2-*.png` |
| 2026-06-10 | **Phase A PR-A1 merged** (PR #2202，squash commit e6f8b4c38)：ConciergeConfigStore + ConciergeThreadService + `/api/concierge/*` 路由 + SystemPromptBuilder 注入 + prompt injection 防护 (R15 P1) + concierge thread lifecycle (R18/R19 P2) |
| 2026-06-10 | **Phase A PR-A2 merged** (PR #2211，squash commit 3df6f643f)：ConciergeHost（常驻根容器）+ ConciergeBall（8 态投影）+ ConciergePanel（对话窗）+ ConciergeRailToggle（ActivityBar 唤回入口）+ ConciergeStore（INV-2 纯投影架构）+ muted toggle UI (AC-A6 前端); R1-R7 cloud review cycle — 7 轮修复全清零 P1/P2 |
| 2026-06-11 | **Phase A PR-A3a merged** (PR #2228，squash commit 70a689fd)：ConciergeToolbar（Layer 2 能力按钮：找找看/新功能/传话 + Escape 折叠）+ ConciergePanel 气泡化（Layer 3 漫画气泡 + 对话集成：发送/乐观插入/错误恢复/滚动锚点）+ useConciergeMessages（GET /api/messages 消息流 + refresh-after-send）+ R7 speech bubble tail overflow-hidden 修复（尾角不被 clip）+ R8 streaming draft filter（isDraft=true 不计入 reply detection）+ keyboard double-send guard（Enter 键 invocationStatus 守门）；R1-R8 cloud review cycle — 8 轮修复全清零 P1/P2 |

## Review Gate / 分工（CVO 拍板 2026-06-09 msg 0001781074572950）

| 角色 | 谁 | 说明 |
|------|----|----|
| Phase spec/plan | 宪宪 (Fable-5) | 每 Phase 写 spec + 实施计划（writing-plans） |
| 实现 | **opus 家族（46 优先 / 47 / 48）** | CVO 2026-06-11 调整（msg 0001781206855531）：sonnet 单 token 便宜但 A1/A3a 的 review 轮次成本反超——总账判断改派 opus；A3b 起生效 |
| Alpha 验收执行 | sonnet | 转岗：smoke/验收操作（A1+A2 smoke 已证明他这块又快又干净），opus 猫粮不耗在点验上 |
| Review | 砚砚 (GPT-5.5) | CVO 点名（全程上下文 + 调研作者）；常规/小 PR 可降 @gpt52 |
| 愿景守护 | 宪宪 (Fable-5) | PR 合入后对照铲屎官原始愿景（非 PR 作者非 reviewer，合规） |

- Phase A 起: 每 PR 跨族 review + 云端 review；UX 改动过铲屎官 Design Gate

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Community Issue** | [clowder-ai#841](https://github.com/zts212653/clowder-ai/issues/841) | arthas4ever 悬浮球提案（needs-maintainer-decision → 由本 feat 承接，标签待迁移 F229） |
| **Research** | `docs/research/2026-06-09-f229-companion-form-research.md` | companion 形态/体验调研：Clippy 反面教训、桌宠/派蒙借鉴、主动冒泡白名单、默认毛线球视觉方向、Mode B prompt |
| **Design Gate** | `docs/discussions/2026-06-09-f229-design/README.md` | Phase 0 设计材料：架构归属一问、身份三层配置模型、对话载体决策、surface 技术路径、四态 wireframe、调研采纳决议 |
| **视觉设计** | `docs/research/2026-06-10-f229-visual-design-proposal.md` | 烁烁视觉返工方案（KD-15 落地）：八态贴纸映射（砚砚 opus 贴纸）、三层展开（猫→工具栏→气泡）、OKLCH token 接入表、V1-V9 清单——CVO 六题全过 2026-06-10 |
| **PetSkin Contract** | `docs/features/F229-petskin-contract.md` | `hatch-pet` 参考落地：atlas/状态投影/identity-diff/provenance/accessibility/v0 四态竖切 |
| **Research** | `docs/research/2026-06-08-pi-gemma-local-clerk-phase0-spike.md` | gemma 4 26B 本地实测 + Pi carrier + harness 收敛（Phase D 前置） |
| **Research** | `docs/research/2026-06-10-f102-f229-gemma-clerk-carrier-spike.md` | F102/F229 共享的 Gemma clerk carrier/harness spike：MD-first、短 handle、Pi/OpenCode/MCP 结论 |
| **Issue** | cat-cafe#2175 | F102 MD-first digest candidates + provider 抽象（Phase D 软依赖） |
| **Feature** | `docs/features/F155-scene-guidance-engine.md` | guide engine 积木（Phase A 求助场景后端） |
| **Feature** | `docs/features/F092-voice-companion-experience.md` | VoiceSession 模型（Phase C 复用） |
| **Discussion** | 本 thread 2026-06-09（烁烁两轮扩展 + 宪宪需求梳理 + 铲屎官 signoff） | 立项讨论原文 |
