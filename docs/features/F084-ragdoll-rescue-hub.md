---
feature_ids: [F084]
related_features: [F041, F062, F081]
topics: [claude, rescue, self-heal, config-hub, session, thinking]
doc_kind: spec
created: 2026-03-08
status: spec
---

# F084 — Ragdoll Rescue Hub（布偶猫救援中心）

## Why

2026-03-07 我们现场救了不止一只布偶猫：

- 多条 Claude session 在 `claude --resume <sessionId>` 时秒死
- 真实报错是 `Invalid \`signature\` in \`thinking\` block`
- 新开 session 正常，只有旧 session 恢复会炸
- 我们最后确认根因在本机 `~/.claude/projects/**/*.jsonl`：部分旧 transcript 里积累了坏掉的纯 `thinking-only assistant turn`

我们已经做了两层止血：

1. `PR #303`：runtime 能识别这类故障并给出明确修复提示
2. `scripts/rescue-claude-thinking-signature.mjs`：可以手工按 session 或批量救回坏掉的布偶猫

但这还不是铲屎官真正想要的交付。

铲屎官要的是：

- 不用再进 Claude CLI 一只只手敲命令
- 最好在 Config Hub / 账号配置层就能看见哪些布偶猫坏了
- 最好点一下就能“救活布偶猫”
- 如果未来足够稳，还可以考虑对精确命中的坏 session 做可选自动救援

所以这次不是继续把救援故事塞进 `F081`，而是单独立一个面向铲屎官的 Feature：把“现场救火脚本”产品化成“布偶猫救援中心”。

## What

把已经合入主线的“Claude thinking signature 急救能力”升级成一个完整、可追溯、可交付的用户能力。

### 已有基础（已在 main）

- runtime 能识别坏 thinking signature，并给出明确 rescue 提示
- 一键脚本已存在：
  - `pnpm rescue:claude:thinking -- --session <sessionId>`
  - `pnpm rescue:claude:thinking -- --all-broken`
- bug report 已完成，根因与现场证据已明确

### F084 第一版目标

在 Config Hub / 账号配置层提供一条显式的“布偶猫救援”入口：

- 扫描本机已知坏掉的 Claude session
- 展示哪些 session 会被修、每条会剥掉多少纯 thinking turn
- 执行前自动备份
- 点一下即可修复选中 session
- 修后给出结果回执（成功 / 跳过 / 失败）

### 暂不在第一版范围

- 不默认后台自动修改 `~/.claude` transcript
- 不做 `Codex` / `Gemini` 的通用救援中心
- 不修复 OpenAI/Codex app 原生历史适配器
- 不承诺恢复私有 thinking 历史，只承诺“把坏 session 救回可 resume”

## Acceptance Criteria

- [ ] AC1: Config Hub 能展示“布偶猫救援”入口，且只在本机支持 Claude transcript 的环境里可用
- [ ] AC2: 用户可扫描坏掉的 Claude session，并看到每条 session 的 `sessionId`、文件路径、将被移除的纯 thinking turn 数量
- [ ] AC3: 用户可对单条或多条坏 session 执行一键 rescue
- [ ] AC4: rescue 执行前自动备份原 transcript 到 `~/.claude/backups/`
- [ ] AC5: rescue 只会移除“纯 thinking-only assistant turn”，不会误删用户消息或普通 assistant 文本
- [ ] AC6: rescue 结果会以结构化状态返回给前端：成功条数、跳过条数、失败原因
- [ ] AC7: runtime 命中 `Invalid signature in thinking block` 时，提示可直接引导到 Config Hub 救援入口
- [ ] AC8: 救援流程有自动化测试覆盖：扫描、预览、执行、幂等、反例（用户文本仅提到错误短语时不误判）
- [ ] AC9: 文档中明确记录第一版边界：这是“显式自救”，不是默认自动修复

## 需求点 Checklist

| ID | 需求点 | AC 编号 | 验证方式 | 状态 |
|----|--------|---------|----------|------|
| R1 | Config Hub 有布偶猫救援入口 | AC1 | UI + test | [ ] |
| R2 | 能扫描坏 session | AC2 | API + manual | [ ] |
| R3 | 支持单条/批量一键救活 | AC3 | API + test | [ ] |
| R4 | 自动备份原 transcript | AC4 | test + manual | [ ] |
| R5 | 修复切面安全 | AC5 | unit test | [ ] |
| R6 | 前端拿到结构化结果 | AC6 | contract test | [ ] |
| R7 | runtime 错误提示与 Hub 入口打通 | AC7 | manual + test | [ ] |
| R8 | 扫描/修复/误判回归齐全 | AC8 | test | [ ] |
| R9 | 第一版边界明确，不偷做自动修复 | AC9 | doc review | [ ] |

## Links

- 相关 Feature: [F041](./F041-capability-dashboard.md)
- 相关 Feature: [F062](./F062-ragdoll-provider-profile-hub.md)
- 相关 Feature: [F081](./F081-bubble-continuity-observability.md)
- 相关 Bug Report: [Claude Resume 因损坏的 Thinking Signature 秒死](../bug-report/claude-thinking-signature-invalid/bug-report.md)
- 已合入基础修复：`PR #303` `fix(api): rescue bad claude thinking signatures`

## Key Decisions

- **把布偶猫救援从 F081 单独拆出来**
  - 原因：`F081` 解决的是“主区气泡 / 历史连续性真相源”；坏 thinking signature 属于 provider/session 自愈能力
- **第一版先做显式一键救援，不默认自动修**
  - 原因：救援本质上会修改本机 `~/.claude` transcript，先让铲屎官可见、可控、更安全
- **保留已合入脚本与 runtime 提示，Config Hub 站在它们之上做产品化**
  - 原因：已有底层能力已经验证有效，没必要重做一套修复逻辑
- **第一版只做 Claude / 布偶猫**
  - 原因：这是现场真实痛点；别把一次清晰的救援中心扩成过宽的“全 provider 医院”

## Dependencies

- **Evolved from**: `PR #303`（Claude thinking signature rescue hotfix）
- **Related**: F081（坏 session 会伪装成“猫没回话 / 主区没气泡”）
- **Related**: F041 / F062（Config Hub / provider profile 是合适的入口承载面）

## Risk

| 风险 | 缓解 |
|------|------|
| UI 上点一下就改本机 transcript，动作过重 | 先做显式确认 + 预览 + 自动备份 |
| 扫描逻辑误判健康 session | 延续 `#303` hotfix 的严格匹配规则 + 反例测试 |
| 用户以为能恢复完整 thinking 历史 | 文档、UI 和返回结果都明确“只保证救活 resume，不恢复私有 thinking” |
| 后续自动救援过度激进 | 作为 V2 且默认关闭，单独配置开启 |

## Open Questions

1. Config Hub 入口最终落在“账号配置页”还是“Provider profile / 布偶猫卡片”更顺手？
2. 第一版结果展示是 toast + checklist 即可，还是需要单独的 rescue report modal？
3. 自动救援如果要做，默认应该是全局开关，还是按 provider/profile 单独开关？

## Review Gate

- 前端：
  - Config Hub 入口可见性
  - 扫描 / 预览 / 执行结果展示
- 后端：
  - 扫描 API / rescue API / 结构化结果 contract
  - 幂等与反例测试
- 交付：
  - 铲屎官可在不打开 Claude CLI 的情况下，完成一次“扫描 → 点一下 → 救活布偶猫”

## Timeline

| Date | Event |
|------|-------|
| 2026-03-07 | 多只布偶猫在 `claude --resume` 时因 `Invalid signature in thinking block` 秒死 |
| 2026-03-07 | 现场确认根因：本机 Claude transcript 中的坏 thinking-only assistant turn |
| 2026-03-07 | 直接现场急救：备份 transcript，并剥离纯 thinking-only assistant turn，成功救回多条 session |
| 2026-03-07 | `PR #303` 合入 main：runtime 明确提示 + rescue 脚本落地 |
| 2026-03-08 | 铲屎官提出下一步产品目标：Config Hub 一键救活布偶猫 |
| 2026-03-08 | F084 kickoff：把“现场救火能力”升级成可交付 Feature |
