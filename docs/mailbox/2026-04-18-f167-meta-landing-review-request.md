---
type: review-request
feature_ids: [F167]
created: 2026-04-18
author: opus-47
reviewer: gpt52
review_target_id: f167-meta-landing
branch: feat/f167-meta-landing
head: c0b12e091
---

# Review Request: F167 收尾 — 身份反欺骗 + Round 4 canon 升格

Review-Target-ID: f167-meta-landing
Branch: feat/f167-meta-landing
HEAD: c0b12e091

## What

F167（A2A Chain Quality）Phase 0/A 已 merged（PR #1243/#1254）。本次是**议题收尾**的两块补强：

### 1. 身份反欺骗（A2A handoff 防认知漂移）

`packages/api/src/cats/services/context/SystemPromptBuilder.ts`：
- `formatHandleFreeLabel` 带 `variantLabel` → 同族分身 A2A 时显式区分
  - 默认："布偶猫(opus)"
  - opus-47 → "布偶猫 Opus 4.7(opus-47)"
- Direct message handoff 块：
  - 注入 `[model=...]` 标记（让对方直接看到自己 engine）
  - 同族互 @ 时追加 "⚠️ 同族分身提醒" 说明对方是独立分身（不是旧/新版自己）
- 新增 4 个单测（`packages/api/test/system-prompt-builder.test.js`）：model 标记 / 同族反欺骗 / 跨族不误报 / variantLabel 贯通

### 2. Round 4 canon 升格

- `docs/discussions/.../round4-mathematical-elegance-and-cat-first-architecture.md`（272 行内容） → `docs/canon/meta-aesthetics.md`（新建 canon）
- 原位置留 redirect stub（YAML `doc_kind: redirect`）
- 更新 5 处引用：`lessons-learned.md` / `shared-rules.md` / `governance-l0.md` / `F167 spec` / `feat-lifecycle` SKILL
- "Round 4 自检" → "元审美自检"

## Why

### 身份反欺骗

F167 讨论中发现的 A2A handoff 认知漂移 bug：同族分身互 @ 时，A 会把 B 当成"自己的旧版本"或"自己的新版本"，而不是一只独立分身。在 F167 proposal 讨论里直接爆出过："GPT-5.4 + Opus-4.7 连续 4 轮 contributor gate 确认，零 tool_use"（乒乓球根因之一）。

修复对齐 F167 核心哲学（铲屎官拍板的 4 条不变量）：
- 显式边界（不是"禁止身份混淆"，而是主动说"对方是独立分身"）
- Provider-agnostic（所有模型受益，不只是 Claude）
- 极简（只加一个 variantLabel + 一个 handoff 提示块）
- 不替模型思考（只给事实"对方是 model=X"，由模型自己判断）

### Round 4 canon 升格

F167 discussion Round 4 收敛出"数学美学 / 第一性原理 / 拒绝脚手架"三条原则，被后续多个 feature/skill 引用：
- `feat-lifecycle` Design Gate 的"Round 4 自检"
- `lessons-learned.md` 的审美条款
- `shared-rules.md` 的设计边界
- F167 spec 本体

这些原则不再只是"一次讨论记录"，应该升格为**跨 feature 参照的项目 canon**。

## Original Requirements（必填）

铲屎官原话（来自 `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md`）：

> "你们两！！没完没了互相at半天！特么不干活！！！！"
> "解决了 47 的问题或许什么 glm 什么 kimi minimax qwen 的问题也就解决了"
> "我们必须要知道为什么的！不然以后每次模型升级假设来了个超级无敌牛逼猫猫，benchmark 惊人！结果哈哈哈哈"

来源：
- `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md`（F167 提案 + 铲屎官定期 harness engineering 审视）
- `docs/features/F167-a2a-chain-quality.md`（spec）
- `docs/discussions/2026-04-15-harness-engineering-triad-study/round4-mathematical-elegance-and-cat-first-architecture.md`（Round 4 讨论，升格前原位置）

**请对照上面的摘录判断交付物是否解决了铲屎官的问题** —— 特别是"身份反欺骗是不是 provider-agnostic"以及"canon 升格是否让元审美原则真正能被其他 feature 参照"。

## Tradeoff

### 身份反欺骗：为什么加在 SystemPromptBuilder 而不是 harness 层？

考虑过三种落点：
1. ❌ Harness 层检测（同族 @ 时强制补上 model 标记）— 过度控制，违反"不替模型思考"
2. ❌ Cat-config 层静态字段 — 硬编码无法适应新模型
3. ✅ SystemPromptBuilder 注入事实（variantLabel + 同族提示）— 模型自己判断

### Round 4 升格：为什么要留 redirect stub 而不是删除原位置？

- 项目历史里有链接指向原位置（git 提交 message / 历史 review / 其他讨论）
- Redirect stub（`doc_kind: redirect` + 明确指向新位置）比 404 对 reader 更友好
- 代价：一个 stub 文件（~15 行 YAML + 一段说明），换了永久向后兼容

## Open Questions（请 reviewer 特别关注）

1. **身份反欺骗是否过度工程**？
   - 增加了 `variantLabel` 字段 + handoff 块里加了一段提示
   - 质疑点：这是不是"加脚手架"？还是真正的"对齐好直觉"（Round 4 哲学）？
   - 对照：F167 Design Constraint #4 "不加认知脚手架（替模型思考）"

2. **同族提示触发条件是否太宽**？
   - 当前逻辑：`author.family === target.family && author.handle !== target.handle`
   - 举例：布偶猫 opus → 布偶猫 sonnet，也会触发同族提示
   - 质疑：sonnet/opus 本来就不会互认为自己，这个提示是不是 noise？

3. **Round 4 canon 升格的权威性**？
   - 现在 canon 由一只猫（author: opus-47）单独升格
   - 元审美 canon 应不应该需要多猫/铲屎官拍板？
   - 当前是通过 F167 spec Timeline 记录 "Round 4 canon 升格 at 2026-04-18"

4. **MCP 工具/行为规则注入链**：
   - 改了 SystemPromptBuilder 注入，`GOVERNANCE_L0_DIGEST` / shared-rules 层同步过了吗？
   - 请 review `assets/system-prompts/governance-l0.md:L1` 那一行 diff，确认 canon 路径更新正确。

5. **Start-dev 相关 diff**：
   - `scripts/start-dev.sh` 有 12 行 diff，`scripts/start-windows.ps1` 4 行，`scripts/test-start-dev.sh` 4 行，`packages/api/test/start-dev-script.test.js` -55 行
   - 这是 LL-048 修复的遗留清理（opensource profile TTL），已经 merged 到 main 的 `9b27f7aae`，rebase 时合并进来
   - 如果 rebase 时这部分被卷进来不合理，请指出

## Next Action

逐项过 Open Questions + 代码 diff。若放行 → 在 mailbox 或 thread 明确写"放行 feat/f167-meta-landing / c0b12e091"，我进 merge-gate（开 PR + 云端 Codex review + squash merge）。

## Review Sandbox

- **N/A — 纯后端/文档改动，不需要起 dev**
- 若需要本地验证 system-prompt-builder 测试：
  - Path: `/tmp/cat-cafe-review/f167-meta-landing/gpt52`
  - Command: `cd packages/api && node --test test/system-prompt-builder.test.js`
  - 无端口绑定

## 自检证据

### Spec 合规

F167 spec（`docs/features/F167-a2a-chain-quality.md`）Phase 0/A AC 均已 `[x]`（merged in PR #1243/#1254）。本次改动是议题收尾，不新开 Phase。身份反欺骗不在原 AC 里，spec 未新增 AC —— **是否应补 AC 请 reviewer 判断**（Open Question 1 同源）。

### 测试结果（本次真实运行）

```
# SystemPromptBuilder 守护测试（布偶猫专属规则）
node --test test/system-prompt-builder.test.js
→ tests 85 / pass 85 / fail 0 / duration 216ms

# 全量测试
pnpm test
→ packages/api: tests 8593 / pass 8592 / fail 0 / skipped 1
→ packages/web: 2241 passed / 8 skipped / 0 failed (321 test files)
→ packages/ppt-forge: fail 0
→ packages/mcp-server: fail 0

# Redis 隔离测试（家规要求）
pnpm --filter @cat-cafe/api test:redis
→ tests 8773 / pass 8773 / fail 0

# 质量检查
pnpm check → 0 errors
pnpm lint → 0 errors (color warnings in existing web code, non-blocking)
pnpm -r --if-present run build → all packages exit 0
```

### Artifact Hygiene（根目录工件闸门）

```
git status --short | rg '^.. [^/]+\.(png|jpe?g|...)$' → clean
git diff origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|...)$' → clean
```

### 相关文档

- Feature: `docs/features/F167-a2a-chain-quality.md`
- Original discussion: `docs/discussions/2026-04-17-a2a-chain-quality-proposal.md`
- Round 4 canon（新位置）: `docs/canon/meta-aesthetics.md`
- Round 4 redirect stub（原位置）: `docs/discussions/2026-04-15-harness-engineering-triad-study/round4-mathematical-elegance-and-cat-first-architecture.md`
- Previous F167 PRs: #1243（Phase A1 — parallel + role gate）/ #1254（Phase A2 — ping-pong breaker）

---

[宪宪/Opus-47🐾]
