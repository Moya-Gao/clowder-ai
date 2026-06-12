# F198 Phase D 剩余实施计划 — 三档 Fallback 状态机 + 切流量 Gate

**Feature:** F198 — `docs/features/F198-claude-code-subscription-carrier.md`
**Goal:** 6/15 前交付 AC-D1（fallback 状态机）+ AC-D3（灰度切流量）+ AC-D4（全量默认翻转），让 6/15 判罚日无论哪个结果都是"改一个配置"而不是"连夜写代码"。
**Acceptance Criteria:** AC-D1 fallback 自动触发 / AC-D3 灰度 10%→50%→100% / AC-D4 全 thread 默认 bg_daemon / AC-D5 alpha 实证顺路（6 轮=1 record）
**NOT building:** AC-D2 预算面板（推 6/15 后 Phase E）、F230 Phase C 可靠性骨架（独立 gated）、跨 provider fallback（只管 claude 系四档）。
**Architecture cell:** F143 Hostable Agent Runtime | **Map delta:** update required（carrier 域新增 health/rollout 状态层）
**Architecture:** factory 从"静态 env switch"升级为"rollout 配置 + per-carrier 健康状态机"两层决策；所有状态进 Redis（重启存活），降级事件强制可观察。
**Tech Stack:** Redis（6398 测试/6399 runtime 由部署 env 决定，代码只认 REDIS_URL）、现有 carrier 四档、现有 AgentMessage error 流
**前端验证:** No（oversight 走现有 system_info 渠道）
**实施:** opus 家族（CVO 指定）| **Review:** 砚砚 | **守护:** Fable-5
**工期:** PR-1 ≤1.5 天、PR-2 ≤1 天、灰度执行 0.5 天 —— 6/15 前全部在位

---

## 设计决策（已拍死，D1-D7，实施不重开）

**D1 — 失败分类三类，只有前两类触发降级：**

| 类 | 信号（实采字符串/状态，实施时从真实错误样本校准） | 动作 |
|---|---|---|
| `quota` | "usage limit reached" / "credit" / 429 / weekly limit 字样（轮3 spike 实测 claude 横幅有 "94% of weekly limit" 形态） | 降级 + 粘性（TTL 到限额重置点，默认 4h 重探） |
| `structural` | binary 缺失 / daemon spawn 失败 / hook sidecar 5s 无文件 / factory throw | 降级 + 粘性（手动恢复或 30min probe） |
| `transient` | ECONNRESET / 超时 / proxy 抖动 | **不降级**——同档重试，连续 3 次失败升格 structural |

**D2 — 健康状态是 per-carrier 全局，不是 per-cat**：订阅 quota 是账号级（一爆全家爆）、binary 坏是机器级。状态机：`healthy → degraded(reason, since, retryAfter) → probe → healthy`。Redis key `carrier:health:<tier>`，JSON 值，TTL 按 D1。

**D3 — 降级链固定：`bg_daemon → interactive_pty → print_sdk → api_key`**。interactive 排第二因为它是计费最硬的档（公告明文 + B-hook 后任意版本可用）。选档算法：从 rollout 配置的目标档开始，沿链找第一个 healthy 档。api_key 永远视为 healthy（最后防线）。

**D4 — 降级强制可观察（不静默，#2249 同款铁律）**：发生 fallback 时 ① invocation 流里 yield 一条 system_info `carrier_fallback {from, to, reason}`（UI 走现有 system_info 渠道，注意复用 #2242 的内部/可见分类——**这条是用户该看见的**，不进 suppress 名单）② ERROR 级日志 ③ Redis health key 即为 telemetry 源。

**D5 — Rollout 配置单 Redis key `carrier:rollout`**：`{"default": "-p" | "bg_daemon", "overrides": {"<catId>": "<tier>"}, "stage": "off|s1|s2|s3"}`。factory 读取顺序：env `CAT_CAFE_CLAUDE_CARRIER`（最高，运维逃生门）> Redis rollout overrides[catId] > rollout default > 代码默认 `-p`。Redis 不可达 → 回代码默认（fail-open 到现状，不 fail-closed）。改配置 = `scripts/f198-rollout.mjs set-stage s1` 类管理脚本，**不重启**。

**D6 — 灰度阶段映射（我们是单用户场景，"流量%"翻译成猫数 + 观察期）：**

| Stage | overrides 内容 | 观察期 + 晋级判据 |
|---|---|---|
| s1 (~10%) | sonnet → bg_daemon | ≥0.5 天：invocation 成功率无退化 + 无 P0 + chainKey N 轮=1 record（AC-D5 顺路实证） |
| s2 (~50%) | sonnet+opus+gpt52 → bg_daemon | ≥0.5 天：同上 |
| s3 (100%) | default=bg_daemon，清 overrides | = AC-D4 达成 |

**D7 — 6/15 判罚日两剧本（Runbook 化，执行=改一个配置）：** 判订阅桶 → 维持 s3 不动；判 SDK 桶 → `f198-rollout.mjs set-default interactive_pty`（全局一键切 F230 备胎）+ bg 标 degraded。两个动作都 ≤1 分钟。

## PR-1：Fallback 状态机（AC-D1）— opus 家族，≤1.5 天

**Files:** Create `providers/carrier-health.ts`（状态机 + Redis store + 失败分类器，≤350 行）/ Create `test/f198-carrier-health.test.js` / Modify `claude-carrier-factory.ts`（选档算法接入）/ Modify `invoke-single-cat.ts` 或 carrier wrapper（invoke 失败 → 分类 → reportFailure + 同 invocation 内沿链重试一次）

**TDD 步骤：**
1. RED: 分类器表驱动测试（D1 三类 ≥9 样本，含 claude 真实错误字符串）→ GREEN → commit
2. RED: 状态机转移（healthy→degraded 粘性→TTL 过期 probe→恢复；transient 3 连升格）→ GREEN → commit
3. RED: 选档算法（目标档 degraded → 链上第一 healthy；api_key 兜底；Redis 挂 → 代码默认）→ GREEN → commit
4. RED: 集成——invoke quota 失败 → 自动降级重试一次 → system_info `carrier_fallback` yield + health 写入（mock carrier）→ GREEN → commit
5. 回归 pin：现有 -p/bg/interactive 三档无 rollout 配置时行为零变化（AC-B8 同款约束）

## PR-2：Rollout Gate（AC-D3/D4 机制）— opus 家族，≤1 天

**Files:** Create `providers/carrier-rollout.ts`（D5 配置读写）/ Create `scripts/f198-rollout.mjs`（set-stage / set-default / status / reset-health 四命令）/ Modify factory（读取顺序 D5）/ Tests

**TDD：** RED 配置优先级（env > overrides > default > 代码默认 + Redis 挂 fail-open）→ GREEN；RED stage 映射 s1/s2/s3 → GREEN；管理脚本 smoke。

## 执行段（合入后，非代码）

1. alpha 起 s1 → 铲屎官/sonnet 真实对话 ≥6 轮 → **AC-D5 实证**（sessionChainStore 1 record）+ 观察
2. 晋级 s2（D6 判据）→ 观察 → s3 = **AC-D4 达成**
3. 6/15 按 D7 Runbook 执行判罚动作；AC-E4 dashboard 判读（47/CVO）
4. F198 spec AC 勾 + Timeline + 我守护终验（亲跑 fallback 注入演练：手动标 bg degraded → 验证自动走 interactive + system_info 可见）

## Open Questions

| 类型 | 问题 | 处置 |
|---|---|---|
| 技术 | quota 错误真实字符串形态（D1 样本） | 实施时从 ClaudeAgentService/BgCarrier 真实错误日志采集校准，实施猫自决 |
| 技术 | 降级重试在 invoke 内做还是 invoke-single-cat 层做 | 倾向 carrier wrapper 层（不碰各 carrier 内部），实施猫按代码形状自决 |
| 价值 | 无 | D1-D7 已拍死；6/15 剧本是 Runbook 执行不是新决策 |

## 风险

| 风险 | 缓解 |
|---|---|
| 降级链抖动（bg 间歇失败反复切换） | 粘性 TTL（D1）+ transient 不降级 + 恢复走 probe 不自动回切（恢复后**新 invocation** 才用回主档） |
| Redis 单点 | fail-open 到代码默认（D5）——Redis 挂 = 回到今天的静态行为，不更糟 |
| 灰度期间 bg 真翻车 | 这正是 fallback 状态机的用武之地——自动降 interactive，灰度本身被状态机保护 |
| 3 天工期溢出 | PR-1 是救命核心（先合）；PR-2 的 s1/s2 可手动 env 替代（降级方案：per-deploy env 切，丑但能用）——gate 机制做不完不阻塞 6/15 |
