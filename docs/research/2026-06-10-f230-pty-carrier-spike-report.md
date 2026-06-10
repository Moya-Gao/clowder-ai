---
feature_ids: [F230]
related_features: [F198]
topics: [claude-code, carrier, pty, interactive, spike, go-no-go, runway]
doc_kind: research
created: 2026-06-10
---

# F230 Phase A Spike Report — PTY Interactive Carrier Go/No-Go

> **Verdict: GO** ✅ | Owner: 宪宪 Fable-5 | 实验日: 2026-06-10（Day 1 一次完成，原计划 1-2 天）
> 环境: claude 2.1.170 / Claude Max 订阅 / tmux PTY / worktree `cat-cafe-f230-pty-spike`（base `e5f710af2`）
> 原始 fixture: [`docs/features/assets/F230/phase-a-spike-day1-fixtures-2026-06-10.md`](../features/assets/F230/phase-a-spike-day1-fixtures-2026-06-10.md)

## 1. 四实验结论（全 PASS）

| # | 实验 | 结论 | 关键证据 |
|---|------|------|---------|
| E1 | PTY 基础 cycle + 身份 capsule | ✅ | TTY `ttys008` / argv `claude` 零 flag / Claude Max auth / 干净 env 下 **`entrypoint: cli` ×8** |
| E2 | 长 prompt 注入 | ✅ | 50K 档 62,350 bytes、200K 档 **204,596 bytes 均一字不差**进 transcript + needle 精确命中（tmux `load-buffer` + `paste-buffer -p` bracketed paste，prompt 不走 argv 无 ARG_MAX） |
| E3 | 旁路读 transcript（输出面） | ✅ | 三次 needle 断言全部从 `~/.claude/projects/<slug>/<sid>.jsonl` 取证，屏幕零参与；事件类型全套实采（assistant/user/text/attachment/skill_listing/hook_success/ai-title 等），信息密度 ≥ bg |
| E4 | **resume 命门** | ✅ | `/exit` 后 `claude --resume <id>`：**原地续写零 fork**——无新 jsonl 文件、文件内 30 个 sessionId 字段全同值、秒答上轮 token（记忆连续） |

**E4 的结构性意义**：bg carrier 最痛的"每轮 fork 失忆"（F198 Bug #3 → chainKey 会员卡整套工程 + codex 3 轮 race）在 interactive **结构性不存在**。bg fork 根因 = resume 撞 live worker（`already in use` → 强制 `--fork-session`）；interactive 退出后进程死亡，resume 是冷恢复不撞。**F230 Phase C sessionChain 走 cliSessionId 直连分支，无需 chainKey。**

## 2. Interactive 身份 capsule（AC-A0，砚砚 Design Gate P1#2）

| 字段 | 实采值 |
|------|--------|
| argv | `claude`（无 `-p` 无 `--bg`）；resume 轮 `claude --resume 78077385-…` |
| TTY | `ttys008`（`ps -o tty` 实采，真 PTY） |
| version | 2.1.170 (Claude Code) |
| auth | Claude Max 订阅（启动横幅 "Opus 4.8 (1M context) · Claude Max"） |
| entrypoint | **`cli` ×8**（干净 env，pid 98588 实采 `CLAUDE_CODE_ENTRYPOINT` ABSENT） |
| 未误走 print/SDK | TUI 全程交互态 + transcript 含 interactive 专属事件（ai-title / file-history-snapshot / skill_listing） |

**污染对照组（capsule 第一跑就立功）**：首轮实验从猫 session（本身 SDK 起的 claude）spawn tmux → claude 继承 `CLAUDE_CODE_ENTRYPOINT=sdk-cli` → transcript 采出 `sdk-cli` ×8 假阳性。`unset CLAUDE_CODE_ENTRYPOINT CLAUDECODE` 后复跑 → `cli` ×8。**没有 AC-A0 这个 capsule，今晚就把"interactive 也标 sdk-cli"当结论了。** 同时锁定 production 要点 → §5 P1。

## 3. Runway 三档估算（AC-A5①，砚砚 Design Gate P1#1）

**牌价**（claude-api skill 核对，cached 2026-05-26，非记忆数字）：Opus 4.x **$5/M input、$25/M output**；cache read 0.1×（$0.5/M）、cache write 1.25×。

**结构性 cache-miss 机理**：agent loop **内部** calls 间隔秒级 < 5min TTL → cache 命中良好；**跨 invocation** 间隔通常 > 5min → 每次 invocation 的首 call 全价重写 100k+ token context。铲屎官实测（API key 实跑）："cached 好像有点问题，$200 基本一天就没了，可能五个小时"——与牌价核算量级吻合：

| 量级锚 | 计算 | 单 job 成本 |
|--------|------|-----------|
| 短问答 job（F198 alpha smoke 实测 109,562 in / 342 out） | 109.5k×$5/M + 0.3k×$25/M | ≈ **$0.56** |
| 长 review/coding job（10-20 LLM calls，context 100k→150k，loop 内 cache 命中、首 call 全价 + 增量） | 估 | ≈ **$3-15** |

| 档位（**Opus baseline**，$5/$25） | 场景 | $200 runway |
|------|------|------------|
| 高压 | saga 日：40+ invocations 含多个长 job | ≈ **4-6 小时**（吻合铲屎官"可能五个小时"） |
| 中位 | 常规日：20-30 invocations 混合 | ≈ **1 天**（吻合"基本一天"） |
| 保守 | 轻量日：10 短 invocations | ≈ 2-4 天 |

**Fable-5 sensitivity（砚砚 re-review P2-1）**：上表按实验机 Opus 4.x 牌价；**Fable-5 牌价 $10/M in、$50/M out = 2× Opus** → 同 workload 成本翻倍、**runway 减半**（高压 ≈ 2-3h / 中位 ≈ 半天）。布偶猫家族混跑 Opus 系 + Fable-5 时按 mix 内插，Fable 占比越高越接近减半档。**方向不变且更强**：runway 进一步压缩 ⇒ KD-6 skeleton 提前的论证更硬。

**结论**：runway = 小时级～低天级（Fable-5 重载时取下沿），**与铲屎官实测互相印证**。原 spec "7 天缓冲"假设证伪成立，KD-6 的前提坐实。

## 4. Skeleton 工期对照（AC-A5②）

B-min skeleton（AC-B1+B3+B4+B5：carrier service + factory 注册 + MCP/permission parity + cancel + 真实 smoke）：
- 输出面 100% 复用（TranscriptTailer / BgTranscriptEventConsumer / transformClaudeEvent / buildClaudeEnvOverrides）
- 输入面机制本报告已验证（spawn PTY + 两段式注入 + bracketed paste）
- 估 **sonnet 1.5-2 天写码 + 砚砚 review 0.5 天 + 修 0.5 天 ≈ 2-3 天**

**runway（4h-1d）< 工期（2-3d）⇒ KD-6 提前实施 skeleton 成立**——判罚日才动手 = 断粮 2-3 天 + api_key 同价全价烧钱。Phase A go 后立即进 writing-plans → sonnet 开工，6/15 前达"可切换"。

## 5. Phase B 实施输入清单（给 writing-plans / sonnet 照单）

| # | 要点 | 级别 |
|---|------|------|
| P1 | **spawn 前必须 delete `CLAUDE_CODE_ENTRYPOINT` + `CLAUDECODE`**（E1 污染实证；`buildClaudeEnvOverrides` 已有该逻辑，复用勿重写） | 计费正确性 |
| P2 | **两段式注入**：写文本 → ≥2s → 单发 Enter（连发被 TUI 渲染循环吞 Enter，E1 实测） | 正确性 |
| P3 | 长 prompt 走 **bracketed paste**（tmux `load-buffer`+`paste-buffer -p` 或 node-pty 等价实现），200KB 验证无截断；paste 后等待 ∝ 长度（50K→6s / 200K→12s 实测值起步） | 正确性 |
| P4 | session id 捕获：fs.watch `~/.claude/projects/<cwd-slug>/` 新 `.jsonl`（文件名 = sessionId；resume 不产新文件可作 resume 成功信号）。**时机修正（E5 probe）**：jsonl 在**首 prompt 提交后**才创建，spawn→ready 阶段不建文件——watch 起点 = prompt 注入后，不是 spawn 后 | 机制（已实测） |
| P5 | 每 invocation 产出身份 capsule 字段入 telemetry（argv/TTY/entrypoint 抽检）——防 silent 计费漂移 | 防御 |
| P6 | cancel 语义未测（OQ-8：SIGINT vs ESC 注入 vs tmux kill）→ AC-B5 首个 RED test 先探 | 待验 |
| P7 | transcript mid-stream 写盘粒度未测（OQ-5）：终态写盘及时已证；streaming 粒度沿 bg 的 per-message 假设，AC-B2 parity test 实采修正 | 待验 |

## 5b. E5 补测：session id 捕获时延（AC-A3 完整化，砚砚 re-review P2-2）

| 测量 | 结果 |
|------|------|
| spawn→ready（无 prompt）期间 jsonl 是否创建 | **否**——5 样本 45s 全无文件（现场确认无 trust dialog、claude 完全 ready）。E1 时 prompt 后才查，漏了这个时机 |
| **prompt 提交 → 首事件落盘**（捕获时延的正确定义） | n=5 fresh sessions：`[0.12, 0.11, 0.11, 0.11, 0.12]`s → **p50 = 0.11s / max(p95 代理) = 0.12s** |
| carrier 含义 | 注入 prompt 后开始 watch，~110ms 拿到 sessionId；冷启动等待（spawn→ready ≈ 10-15s）与 id 捕获解耦 |

环境：/tmp 隔离 cwd（空目录、无 CLAUDE.md/MCP）、干净 env、claude 2.1.170。样本量 n=5，p95 以 max 代理（样本少，如实标注）。

## 6. Dev support 问询登记（AC-A5③）

状态：**pending**（随 F198 AC-E4 邮件捎带，owner 47/CVO）。建议问询两点：① `claude --bg`（Agent View daemon）的 SDK credit 桶归属；② **程序化驱动交互式 claude（PTY 自动化）的 TOS 边界**——书面回复 = 证据，口头/截图 = 辅助。

## 7. 预注册：我最可能错在哪

1. **entrypoint=cli ≠ 计费保证**——客户端字段是间接信号（F198 KD-9 同款局限），服务端判罚 6/15 才 conclusive。E1 只证明 interactive 与 bg 同标签且与 -p 异标签，不证明订阅桶归属。
2. 长 prompt 等待时间是 2 样本实测，**未测背压**（连续多轮大 paste / 并发 session 同机），生产需自适应等待（如 watch transcript user 事件落盘代替固定 sleep——比 sleep 更确定）。
3. resume 零 fork 在**进程已死**前提下成立；若 Phase C 走常驻形态（进程不死），resume 语义不适用但也不需要——常驻天然连续。两形态都不依赖 fork 处理，结论稳，但 crash-restart 路径（进程意外死 → resume）的 fork 行为没单独测（理论同 E4 冷恢复，建议 AC-C3 补）。
4. Runway 长 job 成本（$3-15）是结构估算非实测分布，AC-D2(F198) 预算面板上线后用真实 telemetry 替换。

## 8. AC 回填

- F230: AC-A0 ✅ / AC-A1 ✅ / AC-A2 ✅ / AC-A3 ✅（机制+时延起步值；确定性 watch 留 P4 实施）/ AC-A4 ✅ / AC-A5 ✅（本报告）
- F198: AC-D6 ✅（本报告 = go 图纸；fast-track 路径变更为"skeleton 已提前在位，判罚日只剩 env flip"）
