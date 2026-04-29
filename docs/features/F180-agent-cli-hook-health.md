---
feature_ids: [F180]
related_features: [F050, F070, F113, F145, F179]
topics: [hooks, onboarding, desktop, installer, cli-config, devex]
doc_kind: spec
created: 2026-04-29
community_issue: "https://github.com/zts212653/clowder-ai/issues/614"
---

# F180: Agent CLI Hook Health and Sync

> **Status**: spec | **Owner**: 缅因猫/砚砚 | **Priority**: P1

## Why

Cat Cafe 的用户级 SessionStart/Stop hooks 已经是我们自己出征时的基础纪律：启动时提醒 `cat_cafe_search_evidence` recall，收尾时检查闭环。但这套能力现在主要靠本机 `~/.claude/settings.json` 和 `~/.codex/hooks.json` 已经手动/同步过来维持。开源用户、桌面安装包用户、升级后的老用户都可能完全没有这层 hook。

铲屎官连续确认了两点：安装流程可以补，但不能只覆盖新 clone 的源码安装；安装包和现有用户也必须能被运行时检测并一键修复。否则开源社区里的 agent 会继续看似接了 MCP，实际缺少开工 recall 和收尾纪律。

## What

### Phase A: Hook Health Contract

定义 user-level hook 的期望态和检测结果：

- Claude: `~/.claude/hooks/session-start-recall.sh`、`~/.claude/hooks/session-stop-check.sh` 存在且内容 hash 匹配；`~/.claude/settings.json` 挂载 `SessionStart` / `Stop`。
- Codex: `~/.codex/hooks.json` 存在且指向同一组 hook 脚本；`codex_hooks` feature 不作为硬依赖检测项，只作为诊断字段。
- 检测结果必须能区分 `missing` / `stale` / `configured` / `unsupported` / `error`。

### Phase B: One-Click Sync API

把 `scripts/sync-system-prompts.ts` 里的 hook target 生成逻辑抽成可复用模块，给 Hub/API 提供：

- `GET /api/agent-hooks/status`
- `POST /api/agent-hooks/sync`

写 user home 配置必须是显式用户动作触发；检测可以自动，修复不能静默。

### Phase C: Source Install and Desktop First-Run Coverage

覆盖三条入口：

- source install: `scripts/install.sh` / `scripts/setup.sh` 调用同一同步逻辑；
- Windows installer: `desktop/scripts/post-install-offline.ps1` 可以预装一次，但失败不得阻塞安装；
- macOS DMG / desktop upgrade: App first-run / Hub health check 必须兜底，因为 DMG 不会跑源码 installer。

### Phase D: In-App Health Surface

在 Hub 或 first-run/setup surface 增加 Agent CLI Hook Health：

- 新线程 / 项目切换时可轻量检测；
- 缺失或过期时显示可操作提示；
- 点击同步后重新检测并显示 green；
- 不把 user-level hook 写入外部 project bootstrap，避免混淆 F070 governance pack 的项目级职责。

## Acceptance Criteria

### Phase A（Hook Health Contract）

- [ ] AC-A1: 后端能检测 Claude user-level hook scripts 是否存在、是否与 repo 模板一致。
- [ ] AC-A2: 后端能检测 `~/.claude/settings.json` 是否挂载 SessionStart/Stop。
- [ ] AC-A3: 后端能检测 `~/.codex/hooks.json` 是否存在并引用期望脚本。
- [ ] AC-A4: 状态输出区分 missing/stale/configured/unsupported/error，并包含可展示的人类可读原因。

### Phase B（One-Click Sync API）

- [ ] AC-B1: Hook target 生成逻辑从 `scripts/sync-system-prompts.ts` 抽成可测试模块，CLI 和 API 共用。
- [ ] AC-B2: `POST /api/agent-hooks/sync` 能写入/更新 Claude hook scripts、Claude settings hooks、Codex hooks.json。
- [ ] AC-B3: 写入 user home 前有明确 API action，不在项目 bootstrap 中静默触发。
- [ ] AC-B4: 同步后立刻重新检测，返回最新 status。

### Phase C（Source Install and Desktop First-Run Coverage）

- [ ] AC-C1: source install/setup 路径会尝试安装 hook，并在失败时给出非致命 warning。
- [ ] AC-C2: Windows installer post-install 会尝试安装 hook，失败不阻塞安装。
- [ ] AC-C3: macOS DMG / desktop first-run 能通过 Hub health check 发现缺失并一键修复。
- [ ] AC-C4: 现有用户升级后打开任意 thread 或 Hub 能看到缺失/过期提示。

### Phase D（In-App Health Surface）

- [ ] AC-D1: 前端有 Agent CLI Hook Health UI，展示 Claude/Codex 分项状态。
- [ ] AC-D2: 点击同步按钮后，UI 从 warning/error 变为 configured green。
- [ ] AC-D3: 外部 project governance bootstrap 仍只处理 `CLAUDE.md` / `AGENTS.md` / skills，不写 user-level hooks。
- [ ] AC-D4: 开源同步后 `clowder-ai#614` 可以用 fixed-internal → synced → close 的链路收口。

## Dependencies

- **Evolved from**: F050（系统提示词两层一源，同步 `~/.codex/AGENTS.md` / hooks）
- **Related**: F070（Portable Governance Pack，项目级 bootstrap）
- **Related**: F113（Multi-Platform One-Click Deploy，source install/setup）
- **Related**: F145（MCP Portable Provisioning，本机 capability health + repair 模式）
- **Related**: F179（Desktop Installer Release Pipeline，安装包入口）

## Risk

| 风险 | 缓解 |
|------|------|
| 静默改写用户 `~/.claude/settings.json` / `~/.codex/hooks.json` 引发不信任 | 检测自动，修复必须由用户点击；API 返回 diff-like summary |
| Claude settings JSON 里已有用户自定义 hooks，被覆盖 | 合并写入，只管理 Cat Cafe 自己的 command entry，不删除未知 hooks |
| 安装包 post-install 权限或路径失败 | post-install 只做 best-effort；Hub first-run health check 是兜底 |
| Codex hooks 支持版本差异 | `hooks.json` 写入与 CLI feature 检测分离；unsupported 作为诊断状态而不是安装失败 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Hook Health UI 放 Hub 能力中心，还是新线程空态 ProjectSetupCard 下方？ | ⬜ Design Gate |
| OQ-2 | 同步 API 是否展示将写入的 settings patch preview？ | ⬜ Design Gate |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | 安装脚本是优化路径，Hub runtime health check 是兜底路径 | 安装包、升级用户、权限失败都可能绕过 install.sh | 2026-04-29 |
| KD-2 | User-level hook 不放进 project governance bootstrap | F070 管项目级治理，hook 是用户级 agent runtime 配置 | 2026-04-29 |
| KD-3 | 检测自动，修复显式点击 | 写用户 home 配置必须可见、可解释 | 2026-04-29 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-04-29 | 立项；开源 issue `clowder-ai#614` 创建并标记 accepted/triaged |

## Review Gate

- Phase A/B: 需要后端 + 配置安全 review，重点看 user home merge 写入和路径边界。
- Phase C/D: 需要桌面安装包路径 review + 前端 in-context observability review。

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Community Issue** | `https://github.com/zts212653/clowder-ai/issues/614` | 开源侧同步和关闭锚点 |
| **ADR** | `docs/decisions/019-user-level-hooks-architecture.md` | 用户级 SessionStart/Stop hooks 架构 |
| **Script** | `scripts/sync-system-prompts.ts` | 当前 hook target 生成逻辑 |
| **Desktop** | `desktop/scripts/post-install-offline.ps1` | Windows 安装包 post-install 入口 |
