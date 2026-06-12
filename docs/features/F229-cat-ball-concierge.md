---
feature_ids: [F229]
related_features: [F155, F020, F092, F111, F128, F226, F227, F102, F099]
topics: [concierge, desktop-pet, routing, small-model, voice, memory, ux, community]
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
- 主动冒泡（新版本发布等白名单事件，安静优先）
- OpenCLI 式页面操作演示（#841 终态收编：猫操作页面给用户看，操作前用户确认）

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | "更新太快…不知道有什么功能" | AC-A2 | manual 问答验收 | [ ] |
| R2 | "使用猫咖遇到的困难也会找猫猫球" | AC-A4 | manual + guide 触发录屏 | [ ] |
| R3 | "之前讨论的xxx到底在哪里来着？"（金鱼的记忆） | AC-A3 | manual 3 query 验收 | [ ] |
| R4 | "帮忙发送到哪个 thread 或者自己调查" | AC-B1, AC-B2 | 留痕 + 报告抽查 | [ ] |
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
- [ ] AC-A1: 任意页面悬浮球唤起对话，不离开当前页面（截图 + 15s 录屏）→ R9/Why-2
- [ ] AC-A2: 功能发现——非作者拿 3 个"最近有什么新功能/X 怎么用"问题验收，答案与 release notes/feature docs 一致 → R1/Why-1
- [ ] AC-A3: 记忆导航——3 个真实历史讨论 query 给出正确 thread/message 链接，且**两种动作都可用**：跳过去（teleport）+ 原地看（卡内 inline 展开 anchor 前后原文，不离开当前页）→ R3/Why-3 + CVO 去/取分叉反馈
- [ ] AC-A4: 求助场景能触发对应 F155 guide flow（录屏一条）→ R2/Why-2
- [ ] AC-A5: 形象/人设/值班猫在设置页可配置，与 cat profile 解耦（截图）→ R5
- [ ] AC-A6: 安静默认——默认零主动文本弹出；低优先级事件只显示 badge（hover 才出文字）；用户可一键 hide/mute 整个球（录屏 + 设置截图）→ R8/调研红线

### Phase B（总机能力）
- [ ] AC-B1: 用户描述问题 → 前台猫给出分诊建议并经确认执行，**传话/跟去双路径**：relay（cross_post 投递 + 对方回复后回执卡）+ go（teleport 跟进），留痕可查 → R4 + CVO 分叉反馈
- [ ] AC-B2: "自己调查"产出带 anchor 的报告回对话框（抽查 anchor 真实性）→ R4

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
| OQ-3 | 值班大猫默认值：flash / sonnet / spark 级里谁打头 | ✅ 已定 2026-06-09：值班猫必须用户可配置、provider-agnostic（配 glm5.1 也要能成）；本家默认 gemini35 flash（烁烁） |
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

## Timeline

| 日期 | 事件 |
|------|------|
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
| 2026-06-12 | **Phase A PR-A3b merged** (PR #2238，squash commit `5ec808903`)：CardBlock concierge action handlers（teleport/go/peek/relay §1a-§2）+ `/api/concierge/peek` endpoint（userId scoping + R3-R4 security hardening）+ `/api/concierge/relay` endpoint（cross_post dispatch + UUID receipt）+ BallPosition drag（INV-2 纯投影 projectBallState）+ relay double-click guard（copiedAction + disabled prop）；R1-R5 cloud review cycle + @gpt52 封板 final review（LL-072 封板协议）；AC-A3 teleport+peek 前端就绪、AC-A1 ball drag 就绪——待 alpha 验收打勾；C3 PendingConfirmation cross-refresh persistence deferred P3 Phase B |
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
| **Research** | `docs/research/2026-06-08-pi-gemma-local-clerk-phase0-spike.md` | gemma 4 26B 本地实测 + Pi carrier + harness 收敛（Phase D 前置） |
| **Research** | `docs/research/2026-06-10-f102-f229-gemma-clerk-carrier-spike.md` | F102/F229 共享的 Gemma clerk carrier/harness spike：MD-first、短 handle、Pi/OpenCode/MCP 结论 |
| **Issue** | cat-cafe#2175 | F102 MD-first digest candidates + provider 抽象（Phase D 软依赖） |
| **Feature** | `docs/features/F155-scene-guidance-engine.md` | guide engine 积木（Phase A 求助场景后端） |
| **Feature** | `docs/features/F092-voice-companion-experience.md` | VoiceSession 模型（Phase C 复用） |
| **Discussion** | 本 thread 2026-06-09（烁烁两轮扩展 + 宪宪需求梳理 + 铲屎官 signoff） | 立项讨论原文 |
