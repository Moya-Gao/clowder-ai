---
feature_ids: [F133]
related_features: []
topics: [github, ci-cd, connector, opensource]
doc_kind: spec
created: 2026-03-23
---

# F133: GitHub CI/CD Tracking — 已注册 PR 的 CI/CD 执行结果自动追踪

> **Status**: spec | **Owner**: 金渐层 | **Priority**: P2

## Why

铲屎官原话（2026-03-23 thread `ci/cd github tracking`）：

> "你看看我们现在 GitHub 的 Tracking，它能 Tracking CI/CD 的执行结果吗？"
> "这个 ci cd tracking 应该也和现在的 github 一样消息投递到我们的 channel 或者叫消息管道"
> "我们的 ci cd 基本只有月初有额度...clowder-ai 都得看 ci cd 过，发版本更是，这个 sop 流程也得好好思考"

核心场景：开源仓库 `clowder-ai` 有免费 GitHub Actions 额度，CI/CD 绿灯是发版的前提条件。自有仓库 `cat-cafe` 月初有额度时同理。当前 PR Tracking 系统只追踪 Review 通知（IMAP 邮件轮询），CI/CD 结果完全盲区——猫猫提交 PR 后不知道 CI 是否通过，需要手动去 GitHub 页面看。

## What

### 核心设计决策：消息管道复用

**KD-1: CI/CD 通知完全复用现有 Review 消息管道**，保持一致的投递体验。

现有 Review 路径：
```
IMAP 邮件 → GithubReviewMailParser → ReviewRouter.route()
  → PrTrackingStore 查注册 → threadId + catId
  → messageStore.append({ connector: 'github-review' })
  → socketManager.broadcastToRoom()  ← WebSocket 实时推到前端
  → ConnectorInvokeTrigger.trigger() ← 唤醒猫处理
```

CI/CD 路径——复用同一管道，只换数据源：
```
GitHub API 轮询 → CiCdCheckPoller (新)
  → 同样的 deliver 逻辑（messageStore + socket + trigger）
  → messageStore.append({ connector: 'github-ci' })
  → socketManager.broadcastToRoom()
  → ConnectorInvokeTrigger.trigger() (CI 失败时唤醒猫修)
```

复用点：
1. **ConnectorSource 协议** — 只换 `connector: 'github-ci'`，前端 ConnectorBubble 已按类型渲染不同图标
2. **投递管道** — messageStore → socket broadcast → ConnectorInvokeTrigger，完全不用新建
3. **注册入口** — 猫猫还是 `register_pr_tracking`，轮询只查已注册 PR
4. **只新增**：一个 `CiCdCheckPoller` 类

**KD-2: 数据源选择 GitHub API 轮询，而非 IMAP 邮件**

| | 邮件（Review 现状） | API 轮询（CI/CD 新方案） |
|---|---|---|
| 延迟 | 2min IMAP poll | 30s-1min API poll |
| 配置依赖 | IMAP 邮箱 + 代理 | `gh` CLI（已有） |
| 开源友好 | 差（邮箱配置复杂） | 好（`gh auth login` 即可） |
| 噪音控制 | 弱（全邮箱 GitHub 通知） | 强（只查注册 PR） |

API 方案对开源用户更友好，不需要配 IMAP 邮箱。

**KD-3: 只 track 已注册 PR，零噪音**

未注册的 PR 不轮询。猫猫通过 `register_pr_tracking` 注册 PR 时，系统开始追踪该 PR 的 CI/CD 状态。注册入口不变，复用现有 MCP tool。

### Phase A: 核心投递管道（CI/CD → Thread 消息）

1. **CiCdCheckPoller** — 新增轮询器
   - 定时扫描 PrTrackingStore 中所有活跃注册
   - 对每个注册 PR 调用 `gh api repos/{owner}/{repo}/commits/{sha}/check-suites`
   - 只关心 `completed` 状态的 `conclusion`（failure/success/cancelled）
   - 轮询间隔：可配置，默认 60s

2. **PrTrackingStore 扩展**
   - 新增字段：`headSha`（PR 最新 commit SHA）
   - 新增字段：`lastCiCheckId`（去重：同一 check run 只通知一次）
   - 新增字段：`ciTrackingEnabled`（可选开关，默认 true）

3. **消息投递**（复用现有管道）
   - `messageStore.append({ connector: 'github-ci', ... })`
   - `socketManager.broadcastToRoom()`
   - CI 失败 → `ConnectorInvokeTrigger.trigger()`（唤醒猫自动修）
   - CI 成功 → 只投递消息，不 trigger（可配置）

4. **去重机制**
   - 用 `check_suite_id` + `conclusion` 做去重键
   - 同一 suite 同一结论只通知一次
   - SHA 变化（新 push）重置去重

### Phase B: Skill 文档 + 发版 SOP 闭环

1. **更新现有 Skill 文档**
   - `merge-gate/SKILL.md`：Step 6 等待 review 后加等 CI/CD 绿灯步骤
   - `opensource-ops/SKILL.md`：Outbound PR 和 Hotfix 流程加 CI/CD 检查门禁

2. **新增参考文档**
   - `refs/cicd-tracking.md`：CI/CD 通知格式、处理策略、配置说明

3. **发版 SOP 闭环**
   - clowder-ai Outbound PR：合入前需等 CI 通过
   - Release 发版：tag 前需确认 CI/CD 全绿
   - Hotfix：cherry-pick PR 也需 CI 验证

### Phase C（待定）: Review 也迁移到 API 轮询

未来可能将 Review 通知也从 IMAP 迁移到 GitHub API 轮询，彻底摆脱 IMAP 依赖。这需要评估 GitHub API rate limit 影响，暂列为 Open Question。

## Acceptance Criteria

### Phase A（核心投递管道）
- [ ] AC-A1: 注册 PR 后，CI 失败自动投递消息到原始 thread（connector: `github-ci`）
- [ ] AC-A2: CI 失败消息自动唤醒猫（ConnectorInvokeTrigger）
- [ ] AC-A3: CI 成功投递消息但不唤醒猫（可配置）
- [ ] AC-A4: 同一 check suite 同一结论只通知一次（去重）
- [ ] AC-A5: 未注册 PR 不轮询，零噪音
- [ ] AC-A6: `gh` CLI 不可用时优雅降级（log + skip，不 crash）
- [ ] AC-A7: 前端 ConnectorBubble 正确渲染 `github-ci` 类型（可能需要新 icon）
- [ ] AC-A8: 测试覆盖：CiCdCheckPoller 单元测试（轮询、去重、投递）

### Phase B（Skill 文档 + SOP）
- [ ] AC-B1: merge-gate SKILL.md 包含等 CI 绿灯步骤
- [ ] AC-B2: opensource-ops SKILL.md 的 Outbound PR / Hotfix 流程含 CI 门禁
- [ ] AC-B3: refs/cicd-tracking.md 新增（通知格式、配置、处理策略）

## Dependencies

- **Evolved from**: 现有 GitHub Review Email Watcher 系统（#81 ReviewRouter / ConnectorInvokeTrigger / PrTrackingStore）
- **Related**: Issue #668（ReviewRouter fallback 清理，已完成）
- **Related**: Issue #669（本 Feature 升级自此 issue）
- **Blocked by**: 无

## Risk

| 风险 | 缓解 |
|------|------|
| GitHub API rate limit（公开仓 60/h，认证 5000/h） | 只轮询已注册 PR；`gh auth` 认证后 5000/h 足够 |
| `gh` CLI 未安装或未认证 | 启动时检测，优雅降级（log warning，不 block） |
| 开源用户无 GitHub Actions（私有仓无免费额度） | 只对有 CI 的仓库生效，无 CI = 无通知（符合预期） |
| Check suite 状态转换复杂（pending → in_progress → completed） | 只关心 `completed`，忽略中间状态 |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | Review 通知是否也迁移到 API 轮询（摆脱 IMAP 依赖）？ | ⬜ 未定（Phase C 待评估） |
| OQ-2 | 前端 ConnectorBubble 是否需要 `github-ci` 专属 icon？还是复用 GitHub icon + 不同颜色？ | ⬜ 未定 |
| OQ-3 | CI 成功是否默认静默（只记录不推送）？避免 "CI passed" 消息噪音 | ⬜ 未定 |
| OQ-4 | PrTracking 注册时是否需要显式指定 `ciTracking: true`？还是默认开启？ | ⬜ 未定 |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | CI/CD 通知复用现有 Review 消息管道（messageStore → socket → trigger） | 投递体验一致；不需要新建管道；ConnectorSource 协议已支持 | 2026-03-23 |
| KD-2 | 数据源用 GitHub API 轮询而非 IMAP 邮件 | 延迟更低（60s vs 2min）；开源友好（不需要配邮箱）；噪音控制更强（只查注册 PR） | 2026-03-23 |
| KD-3 | 只 track 已注册 PR | 零噪音；复用现有 register_pr_tracking 入口；未注册 PR 的 CI 结果对我们没有意义 | 2026-03-23 |
| KD-4 | CI 失败唤醒猫，CI 成功只投递消息 | 失败需要猫处理（修代码）；成功是信息性的，不需要打断 | 2026-03-23 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-03-23 | 铲屎官提出 CI/CD tracking 需求，讨论决策 |
| 2026-03-23 | Issue #669 创建，记录设计方向 |
| 2026-03-23 | Issue #668 完成（ReviewRouter fallback 清理），为 CI/CD 扫清障碍 |
| 2026-03-23 | 升级为 F133 Feature 立项 |

## Review Gate

- Phase A: 缅因猫 review（coding 落地 + test 覆盖）
- Phase B: 铲屎官确认 SOP 流程变更

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| **Issue** | [#669](https://github.com/zts212653/cat-cafe/issues/669) | 原始 issue（升级为本 Feature） |
| **Issue** | [#668](https://github.com/zts212653/cat-cafe/issues/668) | ReviewRouter fallback 清理（已完成，前置工作） |
| **Plan** | `docs/plans/2026-02-18-github-review-email-watcher.md` | 原 Review Watcher 设计方案 |
| **Code** | `packages/api/src/infrastructure/email/ReviewRouter.ts` | 现有 Review Router（复用参考） |
| **Code** | `packages/api/src/infrastructure/email/ConnectorInvokeTrigger.ts` | 现有投递触发器（复用） |
| **Code** | `packages/api/src/infrastructure/email/PrTrackingStore.ts` | PR 注册存储（需扩展） |
| **Skill** | `cat-cafe-skills/merge-gate/SKILL.md` | PR tracking 使用说明（需更新） |
| **Skill** | `cat-cafe-skills/opensource-ops/SKILL.md` | 发版 SOP（需更新） |
