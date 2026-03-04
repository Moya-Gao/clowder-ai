---
feature_ids: [F051]
topics: [quota, dashboard, usage, scheduling, degradation, claudebar, gemini, antigravity]
doc_kind: spec
created: 2026-03-02
updated: 2026-03-04
---

# F051 — 猫粮看板（Quota Board）

> **Status**: in-progress
> **Owner**: 布偶猫 (Opus) ← v2 重写后接管
> **Reviewer**: 缅因猫 (GPT-5.2) — 愿景守护
> **Created**: 2026-03-02
> **v1 Completed**: 2026-03-03 (Phase 1-5)
> **v2 Rewrite**: 2026-03-04

## Why

铲屎官需要**一眼看到三只猫的真实额度**，服务两个目的：

1. **调度降级** — 哪只猫额度快没了？路由到谁？review 用谁？
2. **心里有数** — 不用挨个打开官方页面，扫一眼就知道全局

### 为什么 v1 需要重写

v1（Phase 1-5，缅因猫实现）的核心问题：

| 问题 | 表现 |
|------|------|
| **额度粒度错误** | "Codex 和 GPT-5.2 同一额度池只展示一张卡" — 实际上 OpenAI 有 4 个独立池 |
| **UI 是运维面板** | 探针状态、CDP 配置提示、止血模式 — 这些是给开发者看的，不是给铲屎官看的 |
| **三个表面各自为政** | Hub 看板 / SwiftBar 脚本 / Widget 页面，视觉语言不统一 |
| **过度工程** | Web Push 基建、通知能力矩阵、VAPID 配置 — 铲屎官只想看个额度 |

### 铲屎官原话（2026-03-04，v2 触发）

> "缅因猫没理解我想要什么，他的小组件也还是 PWA 的组件，而且也有点丑。ClaudeBar（macOS 菜单栏，一锅端多家）可以参考这个开源项目他的做法。我是想把猫猫们的猫粮以及通知能在我们的 Hub 以及 macOS 菜单和通知中心对上。"

> "缅因猫的额度人家是有区隔的，你不应该笼统归因。至少要知道 Codex 云端 review 额度和 Codex 本地额度还有 Spark 的额度。"

### 仍然成立的原则

- **看板值 = 官方页面值**，不二次换算、不推导冒充（v1 确立，继续保持）
- **点击获取（on-demand）**，不后台持续抓取
- **做不到就说做不到**，显示"抓取失败/待接入"

## What

### 1. 额度粒度模型（核心纠正）

**v1 的错误**：把 OpenAI 所有额度笼统归为"缅因猫一张卡"。

**v2 的真实模型**（来自 `chatgpt.com/codex/settings/usage` 官方页面截图 2026-03-04）：

#### 布偶猫 (Claude) 额度池

| Pool | 数据源 | Cat Café 映射 | 调度意义 |
|------|--------|--------------|---------|
| Session 5h | `ccusage blocks --json` | `@opus` `@sonnet` 当前窗口 | 当前能聊多少 |
| Weekly all models | `ccusage blocks --json` | 布偶猫全家 | 本周总预算 |
| Weekly per-model (Opus/Sonnet) | `ccusage blocks --json` | 各分身 | Opus 不够→降级 Sonnet |

#### 缅因猫 (OpenAI) 额度池 — 4 个独立池！

| Pool | 官方页面标签 | Cat Café 映射 | 调度意义 |
|------|-------------|--------------|---------|
| **Codex 主额度** (5h + weekly) | "5小时使用限额" + "每周使用限额" | `@codex` 本地编码 + `@gpt52` | 砚砚还能写多少代码（GPT-5.2 共享此池） |
| **Codex-Spark 额度** (5h + weekly) | "GPT-5.3-Codex-Spark 5小时/每周" | `@spark` | Spark 还能用多少 |
| **代码审查额度** | "代码审查 xx% 剩余" | 云端 Codex review | **review 能力快不够了→切 @gpt52** |
| **溢出额度** | "剩余额度: 0" | 超额降级通道 | 完全没余粮时的信号 |

> **关键洞察**：`@codex` 本地编码和云端 Codex review 消耗的是**不同的额度池**。代码审查额度见底不影响本地编码，反之亦然。这直接影响 review 调度策略。

#### 暹罗猫 (Gemini / Antigravity) 额度池

ClaudeBar 已实现 Gemini 和 Antigravity 的额度获取，数据源如下：

**Gemini (Google AI)**

| Pool | 数据源 | Cat Café 映射 | 调度意义 |
|------|--------|--------------|---------|
| Per-model quotas | `cloudcode-pa.googleapis.com/v1internal:retrieveUserQuota` | `@gemini` `@gemini25` | Gemini 各模型余量 |

- **认证**: `~/.gemini/oauth_creds.json` (Google OAuth)
- **响应格式**: JSON `buckets[]` 含 model / remainingFraction / resetTime
- **处理**: 按 model 分组，取每个 model 的最低 remainingFraction

**Antigravity (Codeium IDE)**

| Pool | 数据源 | Cat Café 映射 | 调度意义 |
|------|--------|--------------|---------|
| Per-model quotas | 本地 Language Server (Connect Protocol RPC) | IDE 内代码补全 | 当前能用什么模型 |

- **发现机制**: `pgrep` 检测 Antigravity 进程 → 提取 CSRF token + 端口 → `lsof` 确认监听端口
- **端点 (POST)**: `LanguageServerService/GetUserStatus` + `GetCommandModelConfigs`
- **认证**: `X-Codeium-Csrf-Token` header (本地进程自动提取)
- **TLS**: 先尝试 HTTPS，回退 HTTP，接受 localhost 自签名证书

### 2. Hub 猫粮看板（重做）

**设计哲学**：ClaudeBar 风格的 **glanceable list**，不是运维面板。

```
┌──────────────────────────────────────────────────┐
│ 猫粮看板                          最后刷新 14:32  │
│                                         [刷新全部] │
├──────────────────────────────────────────────────┤
│                                                    │
│ 布偶猫 Claude                                      │
│ 🟢 Session 5h    ████████░░  78%                   │
│ 🟡 Weekly All    ██████░░░░  58%   resets Fri 19:00│
│ 🟢 Weekly Opus   ████████░░  82%                   │
│                                                    │
│ 缅因猫 Codex + GPT-5.2 (共享池)                     │
│ 🟢 本地编码 5h    ██████████  100%                  │
│ 🟡 本地编码 周    ████████░░  80%   resets Sun 19:10│
│                                                    │
│ 缅因猫 Spark                                       │
│ 🟢 Spark 5h      ██████████  100%                  │
│ 🟢 Spark 周      █████████░  93%   resets Wed 17:03│
│                                                    │
│ 缅因猫 代码审查                                     │
│ 🔴 Review        █████░░░░░  44%   resets Sat 00:26│
│                                                    │
│ 暹罗猫 Gemini                                        │
│ 🟢 Gemini 2.5 Pro  █████████░  90%   resets Mon     │
│ 🟡 Gemini 2.5 Flash ██████░░░░  60%   resets Mon    │
│                                                    │
│ Antigravity IDE                                      │
│ 🟢 Codeium         ██████████  98%                   │
│                                                    │
│ 溢出额度: 0                                        │
└──────────────────────────────────────────────────┘
```

**关键设计决策**：

- **一行一 pool**，不是一卡一猫。进度条 + 百分比 + 色点，3 秒读完
- **色点语义**：🟢 >50% 健康 / 🟡 20-50% 关注 / 🔴 <20% 危险 / ⬜ 未接入
- **删除所有运维信息**：probe hint、CDP 配置、隔离浏览器警告、止血模式 → 放到开发者控制台
- **只有一个刷新按钮**，一键刷所有，不弹 confirm
- **按"猫猫 + 用途"分组**，不按"provider"分组 — 因为调度决策是"哪只猫能干活"

### 3. macOS Menu Bar — 使用 ClaudeBar

**不自建。** [ClaudeBar](https://github.com/tddworks/ClaudeBar) 已经是一个成熟的 macOS 原生菜单栏应用：

- 支持 Claude / Codex / Antigravity / Gemini 等 9 个 provider
- 原生 Swift/SwiftUI → 真正的 macOS 通知中心集成
- 色彩三档（绿/黄/红）+ 自动刷新 + 键盘快捷键
- 开源免费

**我们的策略**：
- 铲屎官直接安装 ClaudeBar 获得 macOS 菜单栏 + 原生通知
- Cat Café Hub 专注做好"调度决策台"这个 ClaudeBar 不做的事
- 不维护 SwiftBar 脚本、不维护 Web Push 基建

### 4. 通知策略（简化）

| 表面 | 方式 | 负责方 |
|------|------|--------|
| macOS 菜单栏 + 通知中心 | ClaudeBar 原生通知 | ClaudeBar |
| Hub in-app | Toast / banner（你在看 Hub 时） | Cat Café |
| 调度告警 | Hub 内额度变红时置顶提示 | Cat Café |

**砍掉**：Web Push (SW + VAPID + 订阅管理)、通知能力矩阵、设备订阅可视化。
**原因**：macOS Web Push 不可靠（需浏览器开着），ClaudeBar 原生通知完全替代。

### 5. 调度降级集成（v2 新增）

额度数据不只是"看看"，还要服务路由决策：

| 信号 | 触发 | 建议动作 |
|------|------|---------|
| Claude Opus weekly < 20% | 🔴 | 降级到 Sonnet，或推迟重活到下周 |
| Codex 代码审查 < 20% | 🔴 | Review 切到 `@gpt52`，或人工 review |
| Codex 本地编码 < 20% | 🔴 | 编码任务切到 `@spark` |
| Spark < 20% | 🔴 | 仅剩 `@gpt52` 或等重置 |
| 溢出额度 = 0 | 信息 | 没有超额安全网 |

**实现路径**：Hub 看板在额度变红时显示**调度建议**（一行文字），不做自动路由（那是调度系统的事，不是看板的事）。

## Acceptance Criteria (v2)

> v1 AC-1~22 全部已完成（2026-03-03），归档到 Timeline。以下是 v2 新增。

- [ ] AC-v2-1: Hub 猫粮看板按"猫猫 + 用途"分组，缅因猫至少显示 4 个独立池，暹罗猫显示 Gemini per-model 池 + Antigravity 池
- [ ] AC-v2-2: 每个 pool 一行：色点 + 名称 + 进度条 + 百分比 + 重置时间，3 秒可读
- [ ] AC-v2-3: 删除所有运维 UI（probe hint、CDP 配置、止血模式、通知能力矩阵）
- [ ] AC-v2-4: 删除 SwiftBar 脚本 + `/widget/quota` 页面 + QuotaSummaryWidget 组件 + Web Push 通知基建
- [ ] AC-v2-5: "刷新全部"一键触发所有 provider 数据更新，无 confirm 对话框
- [ ] AC-v2-6: 后端 `/api/quota` 返回值区分 4 个 OpenAI pool（不合并为一张卡）
- [ ] AC-v2-7: 额度 < 20% 时显示调度建议文字（如"Review 建议切到 @gpt52"）
- [ ] AC-v2-8: 官方页面值 = 看板值（v1 原则不变）
- [ ] AC-v2-9: 文档中记录"使用 ClaudeBar 作为 macOS 菜单栏方案"的决策

## 需求点 Checklist (v2)

| ID | 需求点（铲屎官原话） | AC 编号 | 状态 |
|----|---------------------|---------|------|
| R-v2-1 | "缅因猫的额度人家是有区隔的，你不应该笼统归因" | AC-v2-1, AC-v2-6 | [ ] |
| R-v2-2 | "至少要知道 codex 云端 review 额度和 codex 本地额度还有 spark 的额度" | AC-v2-1 | [ ] |
| R-v2-3 | "直接用 ClaudeBar ok" | AC-v2-4, AC-v2-9 | [ ] |
| R-v2-4 | "重写 f51 保证我们未来做愿景审计不偏航" | 本文件 | [ ] |
| R-v2-5 | "缅因猫没理解我想要什么，他的小组件也还是 PWA 的组件，而且也有点丑" | AC-v2-2, AC-v2-3 | [ ] |
| R-v2-6 | "猫粮以及通知能在 hub 以及 macos 菜单和通知中心对上" | AC-v2-4, AC-v2-9 | [ ] |

## Key Decisions

### v2 决策（2026-03-04）

| 决策 | 选择 | 否决 | 原因 |
|------|------|------|------|
| OpenAI 额度粒度 | 4 个独立池分开显示 | 合并为一张卡 | 官方页面就是分开的，且影响调度决策 |
| macOS Menu Bar | 直接用 ClaudeBar | 自建 Swift app / Tauri / SwiftBar | 不造轮子，ClaudeBar 已支持全部 provider |
| 通知方案 | ClaudeBar 原生 + Hub in-app | Web Push (SW + VAPID) | Web Push 在 macOS 上不可靠，ClaudeBar 完全替代 |
| UI 风格 | ClaudeBar 式 glanceable list | 运维面板三大卡 | 铲屎官要"好看"和"一眼看到" |
| 看板定位 | 调度决策台（额度→路由建议） | 纯展示面板 | 额度的价值在于指导调度，不是看个数字 |
| Gemini 数据源 | ClaudeBar 同源 (Google internal API + OAuth) | 自建 scraper | ClaudeBar 已验证可行，不造轮子 |
| Antigravity 数据源 | ClaudeBar 同源 (本地 Language Server RPC) | 无 | 本地进程自动发现，无需外部 API |

### v1 决策（保留参考）

| 决策 | 选择 | 否决 | 原因 |
|------|------|------|------|
| 数据源 | 官方 usage 页面抓取 | 本地文件解析 / telemetry | 铲屎官明确要求"官方页面同值" |
| Codex+GPT 展示 | ~~单卡共享额度~~ **v2 已纠正** | — | v2: 分开显示 4 个独立池 |
| Probe 语义 | `enabled`=配置开关, `status`=运行态 | 单一混合语义 | 防止 UI/后端语义漂移 |

## Dependencies

- `ccusage` CLI 可用（Claude 额度）— 或 ClaudeBar 的 OAuth 方式 (`~/.claude/.credentials.json`)
- Chrome CDP 可用 + OpenAI usage 页面已登录（Codex 额度）— 或 ClaudeBar 的 OAuth 方式
- `~/.gemini/oauth_creds.json` 存在（Gemini 额度）
- Antigravity IDE 正在运行（Antigravity 额度，本地 Language Server 自动发现）
- ClaudeBar 安装（macOS 菜单栏 + 原生通知）

## Risk

| 风险 | 影响 | 缓解 |
|------|------|------|
| 官方页面结构变更 | 抓取失败 | 显示"抓取失败"，不推导冒充 |
| ClaudeBar 停止维护 | 菜单栏功能断 | ClaudeBar 开源可 fork；或回退到 SwiftBar |
| OpenAI 额度池未来再拆分 | 模型需更新 | 后端返回动态 pool 列表，前端按列表渲染 |

## Open Questions

1. ~~`@gpt52` (GPT-5.2) 是否有独立额度池？~~ **已确认（2026-03-04）**：GPT-5.2 和 Codex 5.3 共享同一额度池
2. ~~Antigravity 额度模型和抓取方式（下一迭代）~~ **已确认（2026-03-04）**：ClaudeBar 已实现 — Gemini 走 Google internal API，Antigravity 走本地 Language Server RPC
3. 额度数据是否需要持久化做趋势分析（目前只做实时快照）
4. 调度建议是否应该从"文字提示"升级为"一键切换"（影响 AgentRouter）

## What We're Keeping from v1

- **后端 API**：`/api/quota`、`/api/quota/probes`、`/api/quota/refresh/*`（需要扩展返回粒度）
- **ccusage CLI 集成**（Claude 额度数据源）
- **浏览器 CDP 抓取**（OpenAI 额度数据源）
- **On-demand 刷新模型**
- **Probe Registry 架构**（`enabled` / `status` 语义）
- **测试覆盖**（quota-api.test.js 等）

## What We're Dropping from v1

| 组件 | 原因 |
|------|------|
| `SwiftBar 脚本` (scripts/swiftbar/) | 被 ClaudeBar 替代 |
| `QuotaSummaryWidget.tsx` | 被 ClaudeBar 替代 |
| `/widget/quota` 页面 | 被 ClaudeBar 替代 |
| `/api/quota/summary` | 被 ClaudeBar 替代（可保留但非必须） |
| Web Push 通知基建 (SW + VAPID + 订阅管理) | 被 ClaudeBar 原生通知替代 |
| 通知能力矩阵 UI | 不再需要（ClaudeBar 原生处理） |
| 探针运维 UI (probe hints, CDP 配置提示) | 移到开发者控制台，不在看板里 |

## Review Gate (v2)

- **愿景守护重点**: 额度粒度是否正确？调度映射是否对？有没有把独立池又合并了？
- **Reviewer**: 缅因猫 (GPT-5.2) — 验证额度模型与官方页面一致

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-02 | 铲屎官提出需求；PR #161/#168 偏离方向 |
| 2026-03-02 | 关闭 PR #168，正式立项 F051 |
| 2026-03-02 | PR #169 合入 main（Phase 1 完成） |
| 2026-03-03 | Phase 2-5 全部实装（Probe Registry + 通知 + UI + SwiftBar + Widget） |
| 2026-03-03 | Local R1-R4 + Cloud R1-R3 review 通过 |
| **2026-03-04** | **铲屎官不满意 v1，指出额度粒度错误 + UI 丑 + 过度工程** |
| **2026-03-04** | **v2 重写：纠正额度模型、ClaudeBar 替代自建、UI 从运维面板→glanceable list** |
| **2026-03-04** | **Owner 从缅因猫转移到布偶猫** |
| **2026-03-04** | **研究 ClaudeBar 数据源：确认 Gemini (Google internal API) + Antigravity (本地 LS RPC) 已有成熟实现** |
| **2026-03-04** | **关闭 Open Question #2 — Antigravity/Gemini 接入方式已明确** |

## Links

- 铲屎官原始截图: `uploads/1772470157427-435ac123.png`（三张官方 usage 页面）
- 铲屎官 v2 截图: `uploads/1772614108308-299fe865.png`（OpenAI 额度粒度截图）
- ClaudeBar: https://github.com/tddworks/ClaudeBar
- v1 合入 PR: #169 (`3f20fcde`)
- v1 Phase 2-5 讨论/计划: `docs/plans/2026-03-03-f051-*`
- Evolved from: F042 (提示词优化审计 → 猫粮看板需求浮现)
