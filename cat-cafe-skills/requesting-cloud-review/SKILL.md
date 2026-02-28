---
name: requesting-cloud-review
description: Use when creating a PR after local review passes, when merging to main and pushing to remote, or when ready to trigger cloud Codex review. Triggers on "开 PR", "create PR", "gh pr create", "云端 review", "cloud review", "@codex review".
---

> **SOP 位置**: 本 skill 是 `docs/SOP.md` Step 5 的执行细节。
> **上一步**: `merge-approval-gate` (Step 4) | **下一步**: 合入 + 清理 (Step 6，流程完成)

# Requesting Cloud Review (PR + Cloud Codex)

**Core principle:** 本地缅因猫放行后，开 PR 触发云端 Codex 做第二层守护。云端猫是"陌生审查员"，不会因为熟悉而放水。

**Announce at start:** "I'm using the requesting-cloud-review skill to create a PR with cloud review."

## When to Use

- 本地缅因猫 review 已放行（merge-approval-gate 通过）
- 代码**尚未合入 main**（在 feature branch 上开 PR，合入在 Step 6）
- 需要 push feature branch 并开 PR 触发云端守护

## Pre-flight Check

```
BEFORE 开 PR:

1. VERIFY: merge-approval-gate 通过了吗？
   - 缅因猫明确放行？ → YES → 继续
   - 没有放行？ → STOP，先完成本地 review

2. BUILD: workspace build 通过吗？
   - pnpm -r --if-present run build → 无报错 → 继续
   - 有报错 → STOP，先修

3. TEST: 测试全通过吗？
   - pnpm test → 全绿 → 继续
   - 有红 → STOP，先修
```

## Step 1: Push Feature Branch

```bash
# Push feature branch 到 origin（PR 需要远程分支有 diff）
git push origin {branch}

# 如果 GitHub 提示冲突，先在 feature branch 上 rebase 解决：
# git fetch origin && git rebase origin/main → 解决冲突 → git push origin {branch} --force-with-lease
```

> 🔴 **禁止手动 squash**：不要用 `git rebase -i --autosquash` 压缩提交。squash 由 Step 6 的 `gh pr merge --squash` 自动处理。

## Step 2: Create PR

使用项目 PR 模板（`.github/pull_request_template.md`），填写五件套：

```bash
gh pr create --title "{简短标题}" --body "$(cat <<'EOF'
## What

{改了哪些文件、核心改动}

## Why

{为什么做这个改动、约束和目标}

## Original Requirements（🔴 必填）

- Discussion/Interview: `docs/discussions/{date}-{topic}/README.md`
- **原始需求摘录（≤5 行，直接粘贴铲屎官原话）**：
  > {例："我要能看到三只猫分别挂了哪些 Skill，按猫分类，一目了然"}
- 铲屎官核心痛点：{用铲屎官自己的话概括}
- **请 Reviewer 对照上面的摘录判断：交付物是否解决了铲屎官的问题？**

## Plan / ADR

- Plan: `docs/plans/YYYY-MM-DD-xxx.md`
- ADR: `docs/decisions/NNN-xxx.md`（如有）
- BACKLOG: F__ / #__

## Tradeoff

{放弃了什么方案，为什么}

## Test Evidence

```
pnpm --filter @cat-cafe/api test       # X passed, 0 failed
pnpm --filter @cat-cafe/web test       # X passed, 0 failed
pnpm -r --if-present run build         # 成功
```

## Open Questions

{reviewer 需要关注的点}

---

**本地 Review**: [x] 缅因猫 (砚砚) 已 review 并放行
**云端 Review**: [ ] PR 创建后在 **comment** 中触发云端 Codex 守护（⚠️ 不要在 PR body 里写 @codex！）

<!-- 猫猫签名: [布偶猫🐾] / [缅因猫🐾] / [暹罗猫🐾] -->
EOF
)"
```

## Step 2.5: Register PR for Email Review Watcher

PR 创建后，**立刻**注册到 Email Watcher，让 review 邮件自动路由到当前 thread。

### 方式 A：MCP 工具（推荐）

直接调用 `cat_cafe_register_pr_tracking` MCP 工具：

```
cat_cafe_register_pr_tracking({
  repoFullName: "zts212653/cat-cafe",
  prNumber: {PR_NUMBER},
  catId: "{your_cat_id}"   // opus / codex / gemini
})
```

- **不需要传 threadId** — server 从你的 invocation record 自动解析
- **不需要知道 API URL/端口** — MCP callback 自动路由

### 方式 B：裸 curl（fallback，仅当 MCP callback token 过期/不可用时）

```bash
PR_NUMBER=$(gh pr view --json number -q '.number')

# threadId 可从 cat_cafe_get_thread_context 的返回值获取
curl -s "${CAT_CAFE_API_URL:-http://localhost:3002}/api/callbacks/register-pr-tracking" \
  -H "Content-Type: application/json" \
  -d "{
    \"invocationId\": \"${CAT_CAFE_INVOCATION_ID}\",
    \"callbackToken\": \"${CAT_CAFE_CALLBACK_TOKEN}\",
    \"repoFullName\": \"zts212653/cat-cafe\",
    \"prNumber\": ${PR_NUMBER},
    \"catId\": \"{your_cat_id}\"
  }"
```

**为什么必须注册**：同时可能有多个同种猫在提 PR（例如 10 个布偶猫实例），仅靠 PR title 里的 `[布偶猫🐾]` 无法区分是哪个实例的哪个 thread。Layer 1 注册才能精确路由。

**注册失败怎么办**：不阻塞 PR 流程。注册失败时 Layer 2（PR title 猫名标签）和 Layer 3（Triage）仍然兜底。

## Step 3: Trigger Cloud Review

PR 创建后，**立刻**在 PR 上发一条 comment 触发云端 Codex：

```bash
gh pr comment {PR_NUMBER} --body "$(cat <<'EOF'
@codex review

规则：任何 P1/P2 必须给"可执行复现"：
- 优先：新增/更新一个 failing test（最小复现）
- 否则：给确定性复现步骤（命令 + 输入 + 预期/实际）
没有证据的一律降级为 P3 建议，不算缺陷。

审查标准（详见 AGENTS.md "Review guidelines" section）：

**严重度**：P0 数据丢失/安全漏洞 | P1 逻辑错误/测试缺失/架构违规 | P2 性能/重复/命名 | P3 风格偏好

**代码质量红线**：
- 禁止 `any` 类型
- 文件 200 行警告 / 350 行硬上限
- 新功能必须有测试
- 删代码要彻底

**安全审查**：
- 用户输入/CLI 参数/callback 必须验证
- API 端点必须有身份校验
- Redis 测试不碰 6399（生产端口）
- 禁止日志输出 token/密码

**架构守护**：
- 依赖方向 routes → services → stores
- DI 用 Fastify plugin opts
- InvocationRecord 状态转移走 CAS
- 消息写入后不可原地修改

**PR checklist**：
- [ ] 交付物解决了 PR body 里的"铲屎官核心痛点"（愿景对照）
- [ ] 改动与 plan/ADR 一致
- [ ] 新代码有测试
- [ ] 文件未超 200 行（超了有理由）
- [ ] build 通过
- [ ] Redis 改动在隔离环境测试
- [ ] 无安全隐患
- [ ] 删除代码无残留
EOF
)"
```

## Step 4: 等待云端 Review 通过（⚠️ 阻塞！）

**必须等云端 Codex review 通过后才能进入 SOP Step 6 合入。**

云端 Codex 会在 PR 上留 comment。处理方式：

| 结果 | 动作 |
|------|------|
| 0 P1/P2 | 通过 → 进入 SOP Step 6 合入 |
| 有 P1/P2（附复现证据） | 在 feature branch 上修复 → push → 等待 re-review |
| 有 P1/P2（无复现证据） | 降级为 P3，留 comment 说明 → 视为通过 |
| 误报 | 留 comment 解释 → 视为通过 |

## Common Mistakes

| 错误 | 问题 | 正确做法 |
|------|------|----------|
| **PR body 没附原始需求文档** | **云端 reviewer 无法验证愿景** | **必须填 Original Requirements 段** |
| 本地 review 没过就开 PR | 云端 review 不替代本地 review | 先走 merge-approval-gate |
| 忘记注册 PR 到 Email Watcher | 同种猫多实例时 review 邮件无法精确路由 | Step 2.5 注册 PR tracking |
| 忘记发 `@codex review` comment | PR 开了但没触发云端 review | Step 3 是必要步骤 |
| **不等云端 review 就合入 main** | **云端守护形同虚设** | **必须等通过才能 Step 6** |
| 云端发现 P1 就慌 | 云端猫可能误报 | 检查是否有复现证据，无证据则降级 |
| 把所有 P3 都修了 | 云端猫的 P3 是建议，不是命令 | 只修有道理的，驳回没道理的 |

## Related Skills (Workflow Chain)

- `merge-approval-gate` — **前置 skill**，Gate 通过后链到本 skill
- `cat-cafe-requesting-review` — 本地 review 请求
- `cat-cafe-receiving-review` — 处理 review 反馈
- `finishing-a-development-branch` — 开发分支收尾选项

> **Workflow**: `cat-cafe-requesting-review` → review cycles → `merge-approval-gate` → **`requesting-cloud-review`** (本 skill, SOP Step 5) → 合入 + 清理 (SOP Step 6)
