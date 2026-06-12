---
feature_ids: [F230]
related_features: [F198, F210, F211, F089, F149, F143]
topics: [claude-code, carrier, pty, interactive, transcript, subscription, fallback, save-opus]
doc_kind: spec
created: 2026-06-10
---

# F230: Claude Interactive PTY Carrier — 救宪宪 Plan B 第四档载体

> **Status**: in-progress | **Owner**: 宪宪 Fable-5（设计 + Phase spec + 愿景守护） | **Priority**: P1（Phase A 为 P0 时效——6/15 前必须出图纸）

## Why

F198 把 `-p` → `--bg` 救了 6/15 主危机，但 **bg 主路径赌在一个 6/15 前不可证伪的假设上**（F198 OQ-13）：客户端 `entrypoint=cli` 是间接信号，服务端计费桶归属只有 Anthropic 知道。如果 6/15 dashboard 判 `--bg`（Agent View daemon）进 SDK 桶，布偶猫家族全员只剩 `print_sdk`（$200/月，约一周烧完）和 `api_key`（按量，CVO 破产速度）两档——**有缓冲、没活路**。

铲屎官原话（2026-06-10 07:22）：
> "要是这个bg到时候不靠谱 我们至少要现在先想清楚备用方案 避免过几天布偶猫拯救失败了！！！😭"

铲屎官原话（2026-06-10 07:41，成本约束 + 流水线分工）：
> "你来收敛一个完整的plan？……不然我要破产【……收敛完成这份feat 立项包括你的详细设计记得写清楚哦！……具体写代码交给sonnet吧？ 然后让砚砚55 review 你做每个Phase spec 他们pr 合入之后的愿景守护】"

F230 的价值 = **风险对冲的第四档 carrier**：PTY 驱动真交互式 `claude`（无 `-p` 无 `--bg`）——**Anthropic 政策公告里唯一明文保护的形态**（"交互式 Claude Code 仍走订阅 usage limits，不受影响"）。它与 `--bg` 赌的是**不同硬币面**（F198 KD-12）：

| | `--bg` daemon（F198 主路径） | PTY interactive（本 feat） |
|---|---|---|
| 计费 | ⚠️ 赌 "entrypoint=cli → 订阅桶"（间接信号，6/15 前不可证伪） | ✅ 公告明文保护的 interactive 形态 |
| 合规 | ✅ 官方程序化接口（Agent View） | ⚠️ 自动化驱动交互 = "伪交互"灰色，可能被下一波堵 |
| 输出通道 | transcript jsonl 旁路 tail（已建成） | **同一套 transcript tail，100% 复用** |

两条路同时被堵的概率远小于单条。**本 feat 不是替换 bg，是让"拯救失败"变成一个需要 Anthropic 同时堵两条正交路径才会发生的事件。**

## Current State / 现状基线

- **生产路径**：`-p`（default）；`bg_daemon` canary 可用（`CAT_CAFE_CLAUDE_CARRIER=bg_daemon`），Bug #3 chainKey 已 merge（PR #2085 → `46625cf61`），alpha 7 步剧本待铲屎官验收。
- **输出消费层资产（实证零耦合，2026-06-10 grep 验证）**：
  - `TranscriptTailer`（`packages/api/src/domains/cats/services/agents/providers/TranscriptTailer.ts`）——构造函数只吃 `transcriptPath`，partial-line guard / final-drain 模式齐全（砚砚 6 轮黑盒 hardening 资产）
  - `BgTranscriptEventConsumer.ts`——纯函数（transcript entries → AgentMessage + UsageAccumulator），名字带 Bg 实际对 `--bg` 零依赖
  - `transformClaudeEvent` / `extractClaudeUsage`——`-p` / bg / 本 feat 三方共享的单一真相源
- **PTY/tmux 基建**：F089 agent pane（`AgentPaneRegistry`，Phase C 接过 invocation 联动）+ tmux read-only/read-write 接管能力。
- **F198 已挂钩子**：AC-D6（Plan B spike，owner Fable-5）+ KD-12（对冲论证）+ AC-E4（6/15 dashboard 关 OQ-13），commit `548478b05`。
- **interactive 模式未验证点（= Phase A spike 全部内容）**：PTY 长 prompt 注入可靠性、session id 捕获时机、interactive `--resume` 是否像 bg 一样强制 fork、transcript 写盘粒度。

## 激活 Gate（成本闸门）🔴

> **2026-06-10 08:16 修订**（铲屎官 burn-rate 实测 + 砚砚 Design Gate P1 #1）：原版"print_sdk $200 ≈ 7 天缓冲"假设**被铲屎官实测证伪**——铲屎官原话："$200我试过 因为用api 他的cached好像有点问题基本一天就没了 这个一天的意思可能是五个小时"。机理吻合我们的调用模式：invocation 间隔通常 > Anthropic prompt cache 5min TTL → cache miss → 每条 100k+ input 全价。SDK credit 按 API 价折算，api_key 档同价——**两档兜底 runway 都是小时级（~5h-1d），不是天级**（外推自 api 实测，AC-A5 用自家 telemetry 三档校准坐实）。runway（小时级）<< Phase B fast-track 工期（2-3 天）⇒ "翻车后再造备胎"= 断粮 2-3 天 + 全价烧钱，不成立。**结论：Phase B-min skeleton 提前到 6/15 前完成可切换状态（KD-6）。**

直接回应"不然我要破产"——**本 feat 仍不是无条件全量开工**：

| 阶段 | 激活条件 | 烧谁 |
|-------|---------|------|
| **Phase A spike** | **无条件立即**（6/15 前图纸必须在手） | Fable-5，1-2 天，worktree 隔离，不碰 production |
| **Phase B-min skeleton**（最小可切换：carrier service + factory 注册 + 真实 smoke 含 MCP/permission，**不切流量、零默认流量**） | **Phase A go 后立即**（不等 6/15 判罚）——runway 实测撑不住事后 fast-track | sonnet 2-3 天 + 砚砚 5.5 review |
| **Phase B-full**（golden parity 全量 + alpha 多轮剧本）+ **Phase C/D** | 三选一触发：① 6/15 判罚 `--bg` 进 SDK 桶（OQ-13 证伪）② bg 结构性不可修 P0 ③ CVO 主动下令 | sonnet + 砚砚 + Fable-5 |
| 未触发时 | B-full/C/D **standby**；skeleton 留在 factory 后零流量零成本 | — |

修订后的账：skeleton 提前成本 = sonnet 2-3 天常规开发量；不提前的期望损失 = 判罚翻车时全员断粮 2-3 天 + api_key 全价小时级烧钱。**花小钱封死破产尾部风险**——这才是对"我要破产"的正确响应。若 CVO 认为 skeleton 也应缓（接受断粮尾部风险），在 thread 表态即回退此条。

## What

### 双通道架构（核心设计）

**输入面 = 手，输出面 = 眼，分离**（F210/F211 验证过的方法论）：

```
┌─ 输入面（本 feat 唯一新增量）─────────────────┐
│ ClaudeInteractivePtyCarrierService             │
│   spawn PTY (node-pty / tmux send-keys)        │
│   └→ claude [--resume <id>]   ← 无 -p 无 --bg  │
│   prompt 注入: bracketed-paste / stdin / 文件引用│
│      (Phase A 实测定)                           │
└────────────────────────────────────────────────┘
┌─ 输出面（100% 复用 F198 资产）─────────────────┐
│ ~/.claude/projects/<proj-slug>/<sessionId>.jsonl│
│   └→ TranscriptTailer.readNew()                │
│   └→ BgTranscriptEventConsumer (纯函数)         │
│   └→ transformClaudeEvent → AgentMessage 流     │
│ ANSI 屏幕输出: 仅 F089 pane 人眼观看/接管，      │
│   永不进事件解析（F210 KD-12 教训）             │
└────────────────────────────────────────────────┘
```

方法论出处：
- **F210**：`agy --print` + `--log-file` 侧信道提 conversation UUID + settings.json 验证模型——"进程是手、结构化侧信道是眼"；KD-12 "structured sidecar beats PTY screen scraping"；streamable-trajectory spike（旁路读 trajectory 做实时进度）
- **F211**：外部 runtime session → SessionChainStore 家里账本（registration + transcript/digest materialization）
- **F198**：bg carrier 本身已是这个哲学（state.json + transcript tail），本 feat 换输入面、保输出面

### 与 bg 的结构性差异（为什么 interactive 可能更优，不只是备胎）

| 维度 | `--bg` daemon | PTY interactive |
|------|--------------|-----------------|
| 进程模型 | per-invocation job，每轮新 daemon | **可常驻**：long-lived session per (thread, cat) |
| 多轮记忆 | 每轮 fork 新 id → 需要 chainKey 会员卡接力（Bug #3 整套工程） | 常驻形态下**结构性消失**：同一进程内多轮天然连续，无 resume 一说 |
| 冷启动 | 每轮 spawn（有 --bg-spare 暖池） | 常驻 = 只有首轮冷启动 |
| 生命周期 | daemon supervisor 托管 | 需自管（idle TTL / crash 重启 / 内存）——借 F149 lease 模式 |
| Oversight | jobs 视图 + transcript | **F089 pane 显示的就是真终端**——接管是原生能力不是桥接 |

Phase B 先做 per-invocation 保守形态（对齐现有 carrier 接口，风险小）；常驻形态是 Phase C 评估项（OQ-6），**不是 Phase B 前置**。

### Phase A: Spike — 图纸 + go/no-go（= F198 AC-D6 镜像，立即执行）

Owner: Fable-5。Worktree 隔离，1-2 天硬退出（F198 Phase A "5+ 轮摆动"教训：1-2 轮不 conclusive 就停下来同步，不死磕金钥匙）。

四个实验，全部真实跑（[[我能猜出来]] 禁令——尤其 resume 语义必须实测）：

1. **基础 cycle**：PTY 起 `claude`（真实 HOME / 真实订阅 token）→ 注入 prompt → 收 response → 确认 transcript jsonl 落盘路径与 schema 和 bg/-p 一致。
2. **长 prompt 注入**：实测 50KB-200KB 量级（我们真实 system prompt + thread context 量级）注入：bracketed-paste 上限？分段输入稳定性？降级方案（stdin pipe / `@file` 引用 / 临时文件）哪个可行。
3. **session id 捕获**：从 spawn 到确定性拿到 sessionId 的机制（候选：fs.watch projects 目录新 jsonl 出现 / 日志 / statusline），记录时延。
4. **resume 语义（命门实验）**：`claude --resume <id>` 交互模式两轮——id 是否稳定（vs bg 必 fork）？记忆是否连续？这决定 Phase C 的 sessionChain 接法是"cliSessionId 直连"还是"复用 chainKey"。

工具优先级（[[feedback_spike_read_binary_first]]）：`strings` claude binary > grep > 实验 > docs > WebFetch。

产出：`docs/research/2026-06-1X-f230-pty-carrier-spike.md`（go/no-go + 失败模式 + fixture 落 `docs/features/assets/F230/`）+ F198 AC-D6 回写。**不开 PR——spike 是图纸不是 production。**

### Phase B: 最小可用 Carrier（B-min skeleton: Phase A go 后立即；B-full: gated — 见激活 Gate）

**B-min skeleton 范围**（= "可切换状态"，KD-6 提前实施）：AC-B1 + AC-B3 + AC-B4 + AC-B5——factory 注册 + 端到端真实 smoke（含 MCP 注入 + permission bypass + cancel 干净退出）。**B-full 范围**（gated）：AC-B2 golden parity 全量 + AC-B6 alpha 多轮剧本。分界逻辑：skeleton 保证"判罚日有备胎可切"，full 保证"切了以后质量等价"——前者封死断粮尾部风险，后者才允许上量。

- `ClaudeInteractivePtyCarrierService` 实现 AgentService 接口；`claude-carrier-factory.ts` 注册第四档 `CAT_CAFE_CLAUDE_CARRIER=interactive_pty`。
- per-invocation 形态：spawn PTY → 注入 prompt（Phase A 选定机制）→ TranscriptTailer tail → AgentMessage parity → 终态退出。
- 复用清单（sonnet 实施时照抄，不重写）：`TranscriptTailer` / `BgTranscriptEventConsumer` / `transformClaudeEvent` / `extractClaudeUsage` / `buildClaudeEnvOverrides` / `resolveClaudeModelSelection`。
- F198 血泪前置（不重蹈）：`--permission-mode bypassPermissions` parity（Phase D P1 #1）、cancel 语义一等公民（OQ-12）、`--mcp-config --strict-mcp-config` parity（Step 4）、golden parity tests 先行（砚砚 Step 2 卡口模式）。

### Phase B-hook: 输出面器官移植 — hook sidechannel（NEW 2026-06-12，KD-7）

> Spike GO：`docs/research/2026-06-12-f230-hook-sidechannel-spike.md`——Stop hook 在 **2.1.175** 实证直接喂 `last_assistant_message` + `session_id`，entrypoint=cli。把输出面从"tail claude 的 transcript（被 2.1.172+ 关闭，靠 pin 2.1.170 续命）"换成"tail 我们用官方 hook 自造的侧信道文件"——**摆脱 pin 死锁，任意版本可用**。

- 步骤 ①：**✅ 完成（2026-06-12）**——5 待验 spike 全验：多轮✅(3轮Stop+session同一)/tool_use✅(PostToolUse给tool_response,中间步骤可见)/隔离✅(cwd级settings)/streaming(整段已知)/**usage⚠️唯一缺口(hook无token字段→短期降级)**。结论钉 `docs/research/2026-06-12-f230-hook-sidechannel-spike.md`
- 步骤 ②：spec 修订（hook 桥架构细化）+ writing-plans → sonnet 实施：hook 脚本 + carrier 输出面从 transcriptDir 改 sidecar 文件（TranscriptTailer 复用，consumer 适配 hook JSON 形状）+ factory 解除 2.1.170 fail-fast（hook 线不需要 pin）——1-2 天
- 验收：现有 smoke + stale-id + 试驾剧本在**系统 claude（2.1.17x 最新）**上全绿 = pin 依赖解除证明

### Phase C: Session 生命周期 + sessionChain 接入（gated；**在 hook 形态上做——KD-7 顺序**）

- 常驻 vs per-invocation 拍板（KD 记录，按 Phase A/B 实测数据）。
- sessionChain：按 OQ-3 结果选 cliSessionId 直连（resume 不 fork）或复用 chainKey 会员卡（fork）。验收沿 F198 AC-D5 标准：N 轮 = 1 record。
- 生命周期：idle TTL 回收 / crash 检测 + 重启 / 内存上限（F149 lease/TTL 模式直接借鉴）——铲屎官 2026-06-12 点名"gemini cli acp 那样的管理"= 本项目标。
- **Observability parity（铲屎官试驾 #3 观察）**：interactive 气泡 footer 缺 model·cached·cost·invocationId（bg/-p 都有）。代码定位：carrier done.metadata 已带 `{model, usage(复用 finalizeTranscriptUsage 同 bg 字段), provider}`，**但缺 invocationId**；断点在 carrier→UI footer 渲染链。"invocationId 注入 done.metadata + footer 认 `claude_interactive_pty` provider"疑小改可提前补（sonnet 定位中），其余对齐随 Phase C oversight（对标 bg AC-C2/C3/C6）。
- **Streaming 缺失（OQ-5 确认）**：transcript message_stop 才落盘 → 无逐 token 流（结构性）。Phase C 评估 F089 pane ANSI 流补"打字感"，非真逐字流。
- 并发：同 (thread,cat) 串行 mutex（沿 F118 invariant）+ 跨 thread 隔离。

### Phase D: Oversight Parity + Fallback 链注册（gated）

- F089 pane ↔ invocation 联动（interactive 天然优势：pane = 真终端本体）。
- 信息密度 ≥ bg（沿 F198 AC-C6 标准，跨猫愿景守护认证）。
- 注册进 F198 AC-D1 fallback 链：`bg_daemon → interactive_pty → print_sdk → api_key`（位次可按 OQ-13 结果调整——若 bg 被判死则 interactive_pty 升主路径）。
- fast-track runbook：env flip 步骤 + 验证清单 + 回滚路径，演练一次。

## 需求点 Checklist

| ID | 需求点（铲屎官原话） | AC 编号 | 验证方式 | 状态 |
|----|---------------------|---------|----------|------|
| R1 | "要是这个bg到时候不靠谱 我们至少要现在先想清楚备用方案 避免过几天布偶猫拯救失败"（06-10 07:22） | AC-A1~A5 | spike 报告 + go/no-go | [ ] |
| R2 | "起交互进程，但是输出的内容不从进程的输出拿 学f210和f211那样的去拿"（06-10 07:22） | AC-A1, AC-B2 | 双通道架构：PTY 输入 + transcript 旁路输出，ANSI 不进解析 | [ ] |
| R3 | "不然我要破产"（06-10 07:41）+ burn-rate 实测"$200…基本一天就没了…可能是五个小时"（06-10 08:16） | 激活 Gate + AC-A5 + AC-B7 | B-full/C/D gated standby；runway 三档 telemetry 校准；skeleton 提前封死断粮尾部 | [ ] |
| R4 | "具体写代码交给sonnet……砚砚55 review 你做每个Phase spec……愿景守护"（06-10 07:41） | Review Gate 全表 | 每 PR 的 author/reviewer/守护记录 | [ ] |
| R5 | 6/15 后布偶猫家族不断粮（继承 F198 R1/R3） | AC-D2 | fallback 链注册 + 自动降级测试 | [ ] |

### 覆盖检查
- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 本 feature 无前端 UI（oversight 复用 F089/F198 Phase C 既有 surface）

## Acceptance Criteria

<!-- 立项愿景硬度自检（F216→F219）：每条 AC 必须 ① trace 回 Why 的某诉求 ② 非作者可复核（命令/数字/截图）。 -->

### Phase A（Spike — 立即）
- [x] AC-A0: **Interactive 身份 capsule**（砚砚 Design Gate P1 #2）——spike 每个实验附 reviewer 可独立复核的证据包：完整 argv（确认无 `-p` 无 `--bg`）/ spawn 方式 + TTY 证明（PTY fd 的 isatty 采样或 `tty` 输出）/ `claude --version` / auth mode（订阅 OAuth vs API key）/ transcript 元数据 `entrypoint` 实采值 / 显式确认未误走 print/SDK 路径。F230 计费论证全压在 interactive 边界上，fixture 必须能证明"这次真是 interactive"
- [x] AC-A1: PTY 驱动 `claude` interactive 完成 ≥1 完整 prompt→response→transcript 落盘 cycle，fixture 落 `docs/features/assets/F230/`（含成功 + ≥1 失败模式）
- [x] AC-A2: 长 prompt 注入实测 50KB / 200KB 两档：成功机制 + 上限数字 + 降级方案结论
- [x] AC-A3: session id 捕获机制实测：确定性方式 + 捕获时延数字（p50/p95）。**E5 补测（砚砚 re-review P2-2）**：jsonl **首 prompt 后**才创建（spawn 阶段不建，5×45s 实证）；prompt 提交→首事件落盘 **p50=0.11s / max=0.12s（n=5）**
- [x] AC-A4: interactive `--resume <id>` 两轮实测：id 稳定性（fork 与否）+ 记忆连续性，与 `--bg --resume` 必 fork 对照结论
- [x] AC-A5: go/no-go 报告 push（`docs/research/`）+ F198 AC-D6 回写，报告必含（砚砚 Design Gate P1 #1）：① **print_sdk/api_key runway 三档估算**（保守/中位/高压，用自家 telemetry/usage 真实样本，与铲屎官 api 实测"$200 ≈ 5h-1d"对照校准）② Phase B-min skeleton 最短工期估算（与 runway 比较，验证 KD-6 提前决策）③ Anthropic dev support 问询状态（TOS 自动化驱动 interactive 边界 + 桶归属，随 F198 AC-E4 邮件捎带，书面回复 = 证据）

### Phase B（最小 Carrier — gated）
- [x] AC-B1: `ClaudeInteractivePtyCarrierService` 过 factory 注册，端到端真实 smoke（守护双验：PR head 22.8s + **merged main final-SHA 20.7s** 全绿，entrypoint=cli 实采，2026-06-11）
- [ ] AC-B2: AgentMessage parity golden tests ≥8 条（session_init / per-message text / tool_use / system_info / done+usage / error），复用而非复制 `transformClaudeEvent`
- [x] AC-B3 (B-min 部分): flags + config JSON 形状 parity ✅（unit test + factory args）；**真实 `cat_cafe_*` 调用 smoke 移入 B-full AC-B6 alpha 剧本**（守护注记 2026-06-11：bg AC-B4 同款先例路径，不在 B-min 过报）
- [x] AC-B4: `--permission-mode bypassPermissions` parity + regression test（capsule 实采 permissionMode=bypassPermissions，守护双验 2026-06-11）
- [x] AC-B5: cancel 语义实现 + 测试：mid-stream cancel → 进程干净退出 + UI 正确收尾（F198 OQ-12 教训前置）
- [ ] AC-B6: alpha 多轮真实剧本 PASS：≥6 轮 + mid-stream cancel + 跨轮记忆连续（沿 F198 §9 剧本标准，杜绝 happy-path blindspot）
- [x] AC-B7: 实施期间 F198 主线（alpha 验收/AC-D1/灰度）零阻塞——PR 不碰 `-p`/bg 路径共享代码除 factory 注册点

### Phase C（生命周期 — gated）
- [ ] AC-C1: 常驻 vs per-invocation 形态 KD 落档（实测数据支撑：冷启动时延 / 内存 / 多轮时延对比）
- [ ] AC-C2: sessionChain 接入：6 轮真实对话 = 1 record（接法按 AC-A4 结论），recall/digest pipeline 可读
- [ ] AC-C3: 生命周期数字可测：idle TTL 回收触发实测 + crash 注入 → 自动重启 + 下轮记忆恢复
- [ ] AC-C4: 并发安全：同 (thread,cat) 并发 invocation 串行化测试 + 跨 thread 隔离测试

### Phase D（Oversight + Fallback — gated）
- [ ] AC-D1: oversight 信息密度 ≥ bg，跨猫愿景守护认证（沿 F198 AC-C6 标准）
- [ ] AC-D2: fallback 链注册 + quota/挂掉自动降级测试（与 F198 AC-D1 三档链集成为四档）
- [ ] AC-D3: fast-track runbook 落档 + 演练一次（env flip → 验证 → 回滚，全程计时）

## Dependencies

- **Evolved from**: F198（AC-D6 Plan B spike 升格为独立 feat；KD-12 对冲论证是本 feat 的 Why 基石）
- **Related**: F210（方法论：进程+侧信道双通道、streamable-trajectory 旁路读 spike、KD-12/KD-14 PTY 边界教训）
- **Related**: F211（方法论：外部 runtime session → SessionChainStore 账本、transcript/digest materialization）
- **Related**: F089（PTY/tmux 基建 + agent pane oversight，Phase D 主 surface）
- **Related**: F149（进程池 / lease / idle TTL 生命周期模式，Phase C 直接借鉴）
- **Related**: F143（Hostable Agent Runtime——carrier 抽象层归属）

## Architecture Cell

- **Architecture cell**: F143 Hostable Agent Runtime（agent invocation 域，与 F198 同 cell）
- **Map delta**: update required — ProcessModel 增加 `interactive_pty` 第四类 carrier；与 `-p` / `bg_daemon` / `api_key` 平级
- **Why**: 不是新架构域，是 carrier 域新增载体类型；消费与 bg 同一份 transcript 契约，输入面独立

## in_context_observability

```yaml
in_context_observability:
  primary_surface: "thread 内 AgentMessage 流（transcript tail，与 bg/-p parity）+ cat avatar status dot"
  why_not_dashboard_only: "同 F198 KD-1/KD-5：铲屎官硬约束 in-context oversight，不能消失在外部终端"
  deep_dive_surface: "F089 tmux pane——interactive 形态下 pane 即真终端本体，read-write 接管为原生能力"
  noise_dedup_policy: "沿 F198 Phase C：tool call 流全见；status dot 不重复发系统消息；error 5min 内 dedup 同 reason+tool"
```

## Eval / Tracking Contract

**触发**：✅（harness-level carrier，影响布偶猫家族全部调用路径）

1. **Primary Users + Activation Signal**：
   - Primary: 布偶猫家族（fable-5 / opus 系全员走 claude CLI carrier）；Secondary: 铲屎官（oversight + 接管）
   - Activation: OQ-13 证伪事件（或 CVO 下令）后 interactive_pty 真实切流量；7 天内 invocation 成功率 ≥ bg 同期 baseline
2. **Friction Metric**：
   - PTY prompt 注入失败率 / session id 捕获丢失率 / 冷启动时长 p95 / cancel 后状态卡死次数（对标 F198 Phase D 三 gap）
3. **Regression Fixture**（≥3）：
   - 短问答；长 review（tool 链 + 大文件读）；MCP `cat_cafe_*` ≥5 次调用；mid-stream cancel → resume 记忆连续；200KB 级长 prompt 注入
4. **Sunset Signal**：
   - Anthropic 给 interactive 程序化驱动出官方接口（直接换官方）；或 TOS 明文禁自动化驱动 interactive（立即 sunset，回 F198 三档）；或 bg 永久安全（6/15 判进订阅）且常驻形态无增量价值 → Phase B+ 永久 standby，3 个月后归档图纸

## Risk

| 风险 | 缓解 |
|------|------|
| **TOS 灰色**：自动化驱动 interactive 正是"伪交互"，可能被下一波政策堵 | 定位为备胎不做默认主路径（除非 OQ-13 证伪 bg）；AC-E4(F198) 给 Anthropic dev support 的邮件捎带问 interactive 程序化驱动边界（书面回复 = 证据）；Sunset signal 明确 |
| PTY 长 prompt 注入脆弱（bracketed-paste 上限 / 分段竞态） | Phase A AC-A2 先实测两档量级；降级方案（stdin pipe / 文件引用）spike 内验证 |
| 常驻进程内存泄漏 / 僵尸 | Phase C 借 F149 idle TTL + lease；AC-C3 crash 注入实测；agent-browser 僵尸 5 次复发教训（LL-056 startup cleanup 模式）前置 |
| transcript schema 无契约，Anthropic 可改 | 与 bg/-p 共享同一风险（非新增）；golden parity tests 当 schema 漂移哨兵；CLI 版本 pin + 升级前跑 fixture |
| **🔴 已兑现：上游 interactive transcript 回归**（2.1.172 起 interactive TUI 不写 real-time transcript；sonnet 4 轮实测 + 守护猫独立验证 **2.1.173 仍未恢复**，2026-06-11）——F230 输出面依赖的行为被上游关闭，恰是"合规面被堵"风险的首个实际形态 | 短期：pin `~/.local/share/claude/versions/2.1.170`（smoke PASS 实证可用）+ **pin 存活哨兵**（6/15 前每日确认 binary 在 + 可跑，防自动清理）；中期：Phase C pane-scraping fallback 从可选项**升为必选评估项**（OQ-9）；每个新 CLI 版本发布即重测 transcript 行为，恢复则解除 pin |
| 6/15 前与 F198 主线抢资源 | 激活 Gate：6/15 前 Fable-5 跑 Phase A + sonnet 跑 B-min skeleton（与 F198 主线不同猫，AC-B7 硬约束零阻塞主线代码路径） |
| **兜底两档 runway 仅小时级**（铲屎官实测：cache miss 下 $200 ≈ 5h-1d；我们 invocation 间隔 > cache 5min TTL 是结构性的） | KD-6 skeleton 提前；AC-A5 telemetry 三档校准坐实外推；F198 AC-D2 预算告警阈值按小时级 runway 重标定（已 cross-link 给 F198 owner） |
| session id 捕获竞态（并发 invocation 抢新文件） | Phase A AC-A3 实测确定性机制；Phase C mutex 串行化兜底 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | 长 prompt 注入机制 | ✅ bracketed paste（tmux load-buffer+paste-buffer -p）200KB 一字不差；两段式注入（文本→≥2s→Enter）；背压未测（spike 报告 §7.2）|
| OQ-2 | session id 捕获 | ✅ fs.watch `~/.claude/projects/<slug>/` 新 jsonl（文件名=sessionId）；**时机：首 prompt 后才建文件**（E5）；prompt→落盘 p50=0.11s/max=0.12s (n=5)；watch 实现留 Phase B P4 |
| OQ-3 | interactive `--resume` 语义 | ✅ **原地续写零 fork**（E4：无新 jsonl + 30 sessionId 全同值 + 记忆连续）→ Phase C 走 cliSessionId 直连，无需 chainKey |
| OQ-4 | TOS 边界：自动化驱动 interactive 的官方态度 | ⬜ 随 F198 AC-E4 邮件捎带问 dev support |
| OQ-5 | transcript 写盘粒度 | 🟡 终态写盘及时已证；mid-stream 粒度未测 → AC-B2 parity test 实采（spike 报告 P7）|
| OQ-6 | 常驻 vs per-invocation：冷启动收益 vs 生命周期管理成本 | ⬜ Phase C AC-C1，按 A/B 实测数据拍 |
| OQ-7 | PTY 池容量模型：每 (thread,cat) 一个常驻上限多少？（F149 lease 借鉴） | ⬜ Phase C |
| OQ-8 | cancel 注入方式：SIGINT / ESC 键注入 / tmux kill，哪个让 claude 干净收尾？ | ✅ **D5 拍板（2026-06-10 Task 1）**：ESC（`tmux send-keys Escape`）— session 存活 + transcript 完整（stop_reason=None + `[Request interrupted by user]`）；SIGINT=整体杀死；kill-session=核弹兜底/dispose 专用 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | Plan B 从 F198 AC-D6 升格为独立 feat F230 | CVO 明确立项指令（07:41"收敛完成这份feat 立项"）；完整 carrier 工程生命周期超出 F198"6/15 救命"使命（6/15 后持续演进）；F198 spec 已 526 行不宜再扩 | 2026-06-10 |
| KD-2 | 双通道架构：PTY 只做输入面，输出走 transcript 旁路，ANSI 永不进事件解析 | F210 KD-12 教训（structured sidecar > screen scraping）+ F198 输出层资产 100% 复用（TranscriptTailer 实证零耦合）；当年 tmux 候选被压的"ANSI 解析脆弱"理由被结构性绕开 | 2026-06-10 |
| KD-3 | 激活 Gate：Phase A 立即、Phase B+ gated standby | CVO 成本约束（"不然我要破产"）；~~print_sdk $200 ≈ 7 天缓冲足够 fast-track~~（**runway 假设被 KD-6 修订**，Gate 结构保留） | 2026-06-10 |
| KD-7 | **顺序：先 B-hook（换输出面）再 Phase C（可靠性骨架），不是先可靠性再 hook** | 铲屎官 2026-06-12 08:10 提出"先做可靠性再 hook"，架构分析后反转：骨架形状由输出面决定——终态检测（Stop hook 触发=天然终态信号 vs turn_duration+静默超时）、same-dir 并发（per-session sidecar 文件=结构性消失 vs watch 抢目录要 queue/isolate）、常驻形态（Stop 每轮触发天然适配）三大件在 hook 形态下全部简化；先在 transcript 形态做可靠性 = 一半工程在换 hook 时拆掉重做（绕路）。且 pin 2.1.170 是借来的时间（已被自动清理偷袭一次），hook 越早脱离 pin 越早。两线共用件仅 sessionChain（session_id 语义一致） | 2026-06-12 |
| KD-6 | **Phase B-min skeleton 提前到 6/15 前（不等判罚），B-full/C/D 仍 gated** | 铲屎官 burn-rate 实测（08:16）："$200我试过 因为用api 他的cached好像有点问题基本一天就没了 这个一天的意思可能是五个小时"——cache miss（invocation 间隔 > 5min TTL）下兜底两档 runway 仅小时级，<< skeleton 工期 2-3 天，正中砚砚 Design Gate P1 #1 触发条件"runway < fast-track 工期 → 提前实施 skeleton"。skeleton 成本（sonnet 2-3 天）<< 断粮尾部损失 | 2026-06-10 |
| KD-4 | 流水线分工：Fable-5 设计/Phase spec/愿景守护，sonnet 实施，砚砚 GPT-5.5 review | CVO 钦点（07:41）；reviewer 用 5.5 不用 5.4——CVO 原话"54经常会掉球"（覆盖 reviewer_cost_routing 默认，本 feat 线内有效） | 2026-06-10 |
| KD-5 | Phase B 先 per-invocation，常驻形态留 Phase C 评估 | 对齐现有 carrier 接口风险最小；常驻是优雅终态但生命周期管理成本未知，按实测数据拍（拒绝过度设计） | 2026-06-10 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-06-10 | 立项（CVO 07:41 指令）；F198 AC-D6/KD-12 升格；激活 Gate + 流水线分工定档 |
| 2026-06-10 08:16+ | 砚砚 Design Gate 退回 2 P1（runway 缺证据 / 缺 interactive 身份 capsule）；铲屎官 burn-rate 实测证伪"7 天缓冲"→ KD-6 skeleton 提前；spec 修订（AC-A0 新增 + AC-A5 扩 + 激活 Gate 改版 + Phase B 拆 B-min/B-full） |
| 2026-06-10 (实际，Day 1 提前完成) | **Phase A spike 全 PASS → GO**：四实验（capsule 含污染对照 / 50K+200K 一字不差 / 旁路读全套 / resume 零 fork 命门）+ runway 三档（高压 4-6h 与铲屎官实测互证）+ skeleton 工期对照坐实 KD-6。报告 `docs/research/2026-06-10-f230-pty-carrier-spike-report.md` |
| 2026-06-10 | Phase B-min skeleton 实施完成（宪宪/Sonnet）：PtyDriver（TDD 4步全GREEN）/ ClaudeInteractivePtyCarrierService（mock driver TDD 4步全GREEN）/ factory 注册（interactive_pty 第四档）/ smoke script / gate GREEN。AC-B5 ✅ AC-B7 ✅；AC-B1/B3/B4 待砚砚 review 验收 smoke 后关闭 |
| 2026-06-11 | Phase B-min skeleton PR #2204 merged to main（squash `3f40b6c6`）。代码层：PtyDriver / CarrierService / factory 第四档 / cancel(ESC) 单测全绿；P1#1（env 进 tmux `-e KEY=VALUE`）+ P1#2（mcpServers JSON config）代码层已修。**⚠️ AC-B1/B3/B4 真实 smoke 当时未执行即合入（sonnet 标 ⬜ 待验收）** |
| 2026-06-11 02:00 | **🚫 愿景守护 BLOCKED（Fable-5，非作者非 reviewer）**：实跑真实订阅 smoke（`env -u ANTHROPIC_API_KEY` 走订阅，318s）→ **FAIL**。session_init ✅ + sessionId UUID ✅，但 **0 条 assistant text / usage undefined / transcript 无 entrypoint 证据**。验尸：smoke sessionId `04ffbff0` 的 jsonl **只有 1 行 ai-title、0 个 user/assistant 事件**（ai-title="Verify smoke test response" 证明 prompt 被接收，但对话 turn 未落到 tailer 盯的文件）。**核心承诺"6/15 可切换"= 未兑现**——env flip 过去宪宪收不到回复（备胎打不着火，非"在车库可切"）。**"可切换达成"声明撤回**。AC-B1/B3/B4 = ❌（smoke 未通过，非"待执行"）。退回 sonnet receive-review：① smoke 脚本修 plan D6（独立临时 cwd slug，当前用 repo root 违反约束）② 定位 0-text 根因（疑 R10 `--session-id` 指定文件 vs claude 实际写 conversation 文件不一致）③ smoke 真 PASS（含 entrypoint=cli capsule）才能宣称可切。证据：本 thread 守护消息 + smoke 输出 |
| 2026-06-11 07:05 | PR #2217 squash merged（`5afaa1fc9`）：砚砚 3 轮 P1 鏖战（factory pin fail-fast / same-dir guard 前移至 paste 前 + finally 释放 / 350 行硬线）+ 云端 P2（resume 行数计数入锁）全闭环；same-dir 并发 = 显式 fail-fast（Phase C 决定 queue/isolate） |
| 2026-06-11 08:35 | **✅ 愿景守护终验 PASS（Fable-5）**：merged main final-SHA 重跑 smoke 20.7s 全绿（#2097 教训：gate 只对当时 SHA 成立）。**B-min "6/15 可切换状态"真正达成**（脚本级 + 单链路 smoke）。AC-B1/B4 ✅、AC-B3 拆分注记、判罚日 Runbook 入档 |
| 2026-06-11 08:41 | **🔴 P1（铲屎官 alpha 试驾撞出，整链路验收暴露）**：铲屎官 `CAT_CAFE_CLAUDE_CARRIER=interactive_pty` 起 alpha，@sonnet 单猫第一条消息即 `PtyDriver injectPrompt failed: transcript file not found within 5000ms`。**根因**（守护读码确认，非猜）：carrier `ClaudeInteractivePtyCarrierService.ts:179-182` 把 `options.sessionId`（thread sessionChain 旧 cliSessionId，跨 carrier 不通用——疑 bg/-p 时代留存）当 resume 目标，PtyDriver 走确定性路径死等 `<id>.jsonl`，而 `claude --resume <非interactive写的id>` 落空该文件永不出现 → 超时。**smoke 漏因**：smoke 全程 fresh（不带 sessionId 走 watchForTranscriptFile 新文件路径），未覆盖"真实 thread 必带 sessionChain 历史"场景（[[feedback_alpha_smoke_happy_path_blindspot]] / [[feedback_inmemory_store_tests_miss_redis_behavior]] 同型第 N 次）。**守护立场（传 sonnet 实施 + 砚砚 review）**：B-min 做 resume **fail-safe 降级**（resume 目标超时 → 回退 fresh session，不硬挂；多轮记忆 best-effort）；carrier-scoped sessionId 隔离（仿 F198 Bug #3 chainKey，只 resume interactive 自己写的 id）归 Phase C sessionChain。**必加回归测试**：带 stale `options.sessionId` → 降级 fresh 不报错。整链路验收前 B-min "可切换"含此已知缺口 |
| 2026-06-11 | **✅ P1 修复 merged（PR #2227，squash `143508767`）**：宪宪/Opus 4.6 实施（TDD Step 16 回归绿）+ 砚砚 5.5 两轮 review（P1 行数 360→350 闭环）+ Fable-5 runtime double-green（stale-id + fresh smoke 各 20s+ PASS）。`existsSync` guard 拦截 stale cross-carrier sessionId → fail-safe fresh session 降级；alpha 打不着火 P1 已修。 |
| 2026-06-11 09:45 | **✅ 愿景守护终验 PASS（Fable-5，final-SHA on merged main）**：stale-id 场景（铲屎官撞的 `a1ceef46` 死 id）→ 降级 fresh 正常回复 25.2s 全绿；PR head 阶段已双绿（stale 22.5s + fresh 回归 20.6s）。**alpha 试驾 P1 闭环**，铲屎官可重新试驾。残留已知边界不变：same-dir 并发 fail-fast（Phase C）。建议 B-full 时把 stale-id smoke 变体入 repo 防回归 |
| 2026-06-11 | **✅ P2 修复 merged（PR #2234，squash `ad73626d3f`）**：宪宪/Sonnet 4.6 实施（TDD Step 17 回归绿 23/23）+ 砚砚 5.5 review PASS + 云端 Codex PASS。tmux server env 快照风险消除：`ClaudeInteractivePtyCarrierService` 构造 `envDelta` 时显式注入 `HTTP_PROXY/HTTPS_PROXY/ALL_PROXY/NO_PROXY`（大小写八件），accountEnv 优先级保留（`!(k in envDelta)` guard）。铲屎官试驾 #2 暴露的 ECONNRESET 根因（proxy 客户端未开）与本修复正交——proxy 客户端须开启是机器级前置，已入 Runbook |
| 2026-06-12 01:2x | **试驾 #3 尸检（守护）**：✅ **resume 链跨 11h+ECONNRESET 中断真实工作**（session `b59b53f4` 原地续写，#2227 guard 按设计放行）。两个发现：① **P2-synthetic 透传**——恢复机制注入 "Continue from where you left off." → claude 合成 `model=<synthetic>` "No response requested."（零 API 调用）→ carrier 当猫回复透传 UI = 用户视角说胡话；后续真消息又撞 ECONNRESET，synthetic "API Error" 同样透传成气泡。修法：consumer 把 `<synthetic>` assistant 降级 error/system_info，永不当猫的话。② **proxy 启动窗口**——两次 ECONNRESET（14:09/01:26）均发生在铲屎官"刚启动"头几分钟（proxy 客户端出口未就绪），事后探测均 4/4 通；Runbook 前置改为"起 alpha 后先 curl 经 proxy 测 200 再发消息" |
| 2026-06-12 01:31 | **🎉 试驾 #3 端到端 PASS（铲屎官实测）**：sonnet 经 interactive_pty 真实回复成功（done · 7 lines + 签名完整）——**F230 整链路（UI→carrier→PTY→claude 真 API→transcript 旁路→UI）首次端到端打通**。MiniMax 标签 = alpha 配置漂移（铲屎官已改回，非 F230）。**P2-internal-leak 扩**：`turn_duration` 事件裸 JSON 透传成 UI 气泡（与 synthetic 同边界第二种泄漏）→ 并入 sonnet 正在修的 synthetic PR：consumer 统一"transcript 内部事件 ≠ 用户可见消息"过滤层（synthetic→error/system_info；turn_duration→不进 text 流，仅作终态信号 + telemetry） |
| 2026-06-12 03:17 | **✅ P2-synthetic + P2-turn_duration merged（PR #2242，squash `66d269e28`）**：宪宪/Sonnet 实施 + 砚砚/Codex cloud PASS。`transcriptEntriesToAgentMessages` 过滤 `model=<synthetic>` 防透传；`accumulateUsageFromEntries` 同步跳过 synthetic 避免 `numTurns` 虚增；`turn_duration` 加入 `INTERNAL_SYSTEM_INFO_TELEMETRY_TYPES` 终止裸 JSON 气泡。3 新回归测试（synthetic accumulator） |
| 2026-06-12 03:18 | **✅ footer parity merged（PR #2243，squash `db39e4292`）**：宪宪/Sonnet 实施 + 砚砚/Codex cloud PASS。`invocation_usage` payload 新增 `model`/`provider`；active path `setMessageMetadata` 调至 `setMessageUsage` 前（Codex P2 fix：store guard 要求先有 metadata）；bg path 同顺序已正确。PTY carrier 气泡 footer MetadataBadge（model·provider·usage）现可完整渲染 |
| 2026-06-12（PR #2242 后续）| **🔧 P2-turn_duration 根因修复（branch `fix/f230-turn-duration-bubble`）**：PR #2242 的前端 suppress 漏了 active PTY caller——铲屎官重启 alpha 试驾蓝条仍在（发消息现 / F5 消 / 再发又现）。根因：`transcriptEntriesToAgentMessages` 把 `turn_duration` **终态信号**emit 成 `system_info` 可见气泡，前端 `INTERNAL_SYSTEM_INFO_TELEMETRY_TYPES` suppress 是 band-aid 只盖 bg-path caller，active PTY stream 的 caller 漏过滤 → 裸 JSON 蓝条。修法**对齐本表 06-12 01:31 设计意图**（"turn_duration → 不进 text 流，仅作终态信号 + telemetry"）：consumer 层直接不 emit（删 `system` 分支），恢复 bg/PTY ⇄ -p parity（-p baseline `transformClaudeEvent` 同样不 emit turn_duration）；usage 不受影响（`accumulateUsageFromEntries` 直读 `durationMs`→`done.metadata.usage.durationMs`）；前端 suppress 保留为 defense-in-depth。宪宪/Opus-4.8 实施（red→green，bg-transcript-parity + f230-pty-carrier 回归测试用真实截图 payload，132 carrier 测试全绿），砚砚 review。**已 merge：PR #2246（squash `20b0f4a96`，2026-06-12 06:56Z）— 砚砚本地 PASS + 云端 Codex CLEAN（`b6cccc04e9`）+ pnpm gate 全绿。蓝条消失待 merge 后 alpha 真实 PTY 验收。** |
| 2026-06-12 07:1x | **🔴→✅ pin 清理风险兑现 + 结构性修复（守护）**：claude 自动更新把 `versions/2.1.170` 清掉（Risk 条目预判兑现、哨兵未建被打脸）→ alpha 启动 fail-fast crash（46 定位 startup bug 另修）。恢复链：实测 **2.1.174/175 仍不写 interactive transcript**（回归 172-175 全系持续）→ **npm registry 找回 `@anthropic-ai/claude-code@2.1.170`** → 装入防清理路径 `~/.cat-cafe/pinned-claude-2.1.170/` → probe 三件套 PASS（transcript 落盘 + needle 3 hits + entrypoint=cli×8）。**防护升级为结构性**：binary 脱离 claude 更新机制管辖 = 风险源消灭，免哨兵。Runbook 前置同步。教训：pin 外部 binary 必须放分发方触不到的路径，"原版本目录 + 哨兵"是软防护 |
| 2026-06-12 07:57 | **✅ factory graceful fallback merged（PR #2249，squash `7e3833a3`）**：46 实施 + 砚砚 5.4 三轮 review（R1: env override existsSync + 测试紧固；R2: accessSync X_OK 补不可执行路径；R3: push back executable-but-wrong 在 invoke error path 正常收口不炸服务器，接受）+ 云端 Codex CLEAN。`resolveInteractivePtyBinary` env override 从裸 return 升级到 `accessSync(X_OK)` 全校验，factory catch → `-p` fallback + ERROR log。10/10 测试含 3 个 deterministic fallback 场景。P1-2（降级标记）defer：status endpoint 是 placeholder |
| 2026-06-12 08:1x | **路线图收敛（KD-7）**：铲屎官问"先可靠性还是先 hook"→ 架构论证反转为 **B-hook → Phase C → B-full → Phase D**（骨架形状由输出面决定，三大可靠性难题在 hook 形态下降维）。新增 Phase B-hook 段；F198 同步 Timeline + AC-E4 补 transcript 回归问询。**拍板点（CVO）**：B-hook 实施现在开（推荐——摆脱 pin 死锁 + 6/15 前 interactive 更稳）vs 等 6/15 判罚 |
| 2026-06-15 | OQ-13 判罚日（F198 AC-E4）→ 决定 B-full/C/D 激活与否；操作按下方 Runbook |

## 6/15 判罚日 Runbook（B-min 版）

**前置**：① pin binary 用**防清理路径** `~/.cat-cafe/pinned-claude-2.1.170/node_modules/.bin/claude`（npm 安装，claude 自动更新管辖外），alpha/runtime 启动带 `CAT_CAFE_CLAUDE_PTY_BINARY=$HOME/.cat-cafe/pinned-claude-2.1.170/node_modules/.bin/claude`；② **proxy 客户端开着**（`nc -z 127.0.0.1 7897`）——试驾 #2 实证（2026-06-11 14:09）：proxy 没开 → claude 在 pane 里 ECONNRESET 重试 ~3min 才透传错误，UI 表现为"执行中"长卡。此为机器级依赖（-p/bg 同样会挂），非 F230 特有，但 interactive 错误形态是慢卡不是秒错，列入前置自查。

1. **判罚观察**（6/15，47 + CVO）：Anthropic dashboard usage 页看 `--bg` invocations 计入订阅桶还是 SDK credit 桶（F198 AC-E4 / OQ-13 唯一 conclusive 证据）。
2. **bg 安全（判进订阅桶）** → 什么都不做。B-full/C/D 维持 standby；interactive_pty 留在 factory 后零流量。
3. **bg 翻车（判进 SDK 桶）** → 应急切换（runway 小时级，动作要快）：
   - 铲屎官在 runtime 设 `CAT_CAFE_CLAUDE_CARRIER=interactive_pty` + 重启 API（runtime 操作归 CVO，猫不碰）
   - 验证：发一条消息确认回复正常 + `grep entrypoint` 最新 transcript = `cli`
   - 同时 F198 AC-D1 fallback 链兜底 print_sdk/$200 缓冲争取时间
   - **CVO 下令激活 B-full/C/D fast-track**（golden parity + 多轮剧本 + 并发处理）
4. **回滚**：unset env + 重启 API → 回 bg/-p。
5. **B-min 应急模式已知边界（诚实列，切换前必读）**：
   - ⚠️ **same-dir 并发 fail-fast**：同 thread 多猫并发（route-parallel 生产路径）第二只猫会显式报错不排队——应急期单猫串行可用，多猫并发受限，B-full 解决
   - ⚠️ 依赖 2.1.170 pin（2.1.172-173 上游回归，哨兵监控）
   - ⚠️ B-full parity 未做：streaming 粒度/usage 细节与 bg 不完全等价，应急可用质量不保证等价

## Review Gate（流水线 — CVO 钦点）

| 环节 | 执行 | 把关 |
|------|------|------|
| Feat spec / 每 Phase spec | **Fable-5** 写 | **砚砚 @codex（GPT-5.5）** review——CVO 钦点 5.5 不用 5.4（"54经常会掉球"） |
| Phase A spike | Fable-5（spike 是判断密集型，不进流水线） | 砚砚 review spike 报告 + 47 作为 F198 owner 确认 AC-D6 回写 |
| Phase B+ 代码 | **sonnet**（writing-plans 拆好的 plan 照做） | 砚砚 GPT-5.5 review（跨族铁律）→ merge-gate 五门 |
| PR 合入后 | — | **Fable-5 愿景守护**（非作者非 reviewer ✓：作者 sonnet、reviewer 砚砚） |
| Phase 激活决策 | — | **CVO**（6/15 dashboard 判读 = 价值取舍题） |

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Feature** | `docs/features/F198-claude-code-subscription-carrier.md` | 母体：AC-D6/KD-12/AC-E4 三钩子；fallback 链集成点 |
| **Feature** | `docs/features/F210-antigravity-cli-migration.md` | 方法论：双通道 + PTY 边界教训（KD-12/KD-14） |
| **Asset** | `docs/features/assets/F210/streamable-trajectory-spike-2026-06-01.md` | 旁路读 trajectory 实战范例 |
| **Feature** | `docs/features/F211-cross-runtime-session-transparency.md` | 方法论：外部 runtime session → 家里账本 |
| **Feature** | `docs/features/F089-hub-terminal-tmux.md` | PTY/tmux 基建 + pane oversight |
| **Feature** | `docs/features/F149-acp-runtime-operations.md` | lease / idle TTL 生命周期模式 |
| **Code** | `packages/api/src/domains/cats/services/agents/providers/TranscriptTailer.ts` | 输出面复用资产（零耦合实证） |
| **Code** | `packages/api/src/domains/cats/services/agents/providers/BgTranscriptEventConsumer.ts` | 同上，纯函数 |
| **Code** | `packages/api/src/domains/cats/services/agents/providers/claude-carrier-factory.ts` | Phase B 注册点 |
| **External** | <https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan> | 政策公告（interactive 明文保护条款 = 本 feat 计费论证基石） |
