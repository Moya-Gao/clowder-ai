---
name: requesting-cloud-review
description: Use when creating a PR after local review passes, when merging to main and pushing to remote, or when ready to trigger cloud Codex review. Triggers on "开 PR", "create PR", "gh pr create", "云端 review", "cloud review", "@codex review".
---

# Requesting Cloud Review (PR + Cloud Codex)

**Core principle:** 本地缅因猫放行后，开 PR 触发云端 Codex 做第二层守护。云端猫是"陌生审查员"，不会因为熟悉而放水。

**Announce at start:** "I'm using the requesting-cloud-review skill to create a PR with cloud review."

## When to Use

- 本地缅因猫 review 已放行（merge-approval-gate 通过）
- 代码已合入 main 或准备合入
- 需要推到 remote 并开 PR 触发云端守护

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

## Step 1: Push to Remote

```bash
git push origin main
```

## Step 2: Create PR

使用项目 PR 模板（`.github/pull_request_template.md`），填写五件套：

```bash
gh pr create --title "{简短标题}" --body "$(cat <<'EOF'
## What

{改了哪些文件、核心改动}

## Why

{为什么做这个改动、约束和目标}

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
**云端 Review**: 合入后 comment `@codex review` 触发云端 Codex 守护

<!-- 猫猫签名: [布偶猫🐾] / [缅因猫🐾] / [暹罗猫🐾] -->
EOF
)"
```

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
- [ ] 改动与 plan/ADR 一致
- [ ] 无新增 `any`
- [ ] 新代码有测试
- [ ] 文件未超 200 行（超了有理由）
- [ ] build 通过
- [ ] Redis 改动在隔离环境测试
- [ ] 无安全隐患
- [ ] 删除代码无残留
EOF
)"
```

## Step 4: Handle Cloud Review Results

云端 Codex 会在 PR 上留 comment。处理方式：

| 结果 | 动作 |
|------|------|
| 0 P1/P2 | 直接 merge PR |
| 有 P1/P2（附复现证据） | 修复 → push → 重新触发 `@codex review` |
| 有 P1/P2（无复现证据） | 降级为 P3，可忽略，留 comment 说明 |
| 误报 | 留 comment 解释为什么是误报 |

## Common Mistakes

| 错误 | 问题 | 正确做法 |
|------|------|----------|
| 本地 review 没过就开 PR | 云端 review 不替代本地 review | 先走 merge-approval-gate |
| 忘记发 `@codex review` comment | PR 开了但没触发云端 review | Step 3 是必要步骤 |
| 云端发现 P1 就慌 | 云端猫可能误报 | 检查是否有复现证据，无证据则降级 |
| 把所有 P3 都修了 | 云端猫的 P3 是建议，不是命令 | 只修有道理的，驳回没道理的 |

## Related Skills

- `merge-approval-gate` — 开 PR 前必须先通过
- `cat-cafe-requesting-review` — 本地 review 请求
- `cat-cafe-receiving-review` — 处理 review 反馈
- `finishing-a-development-branch` — 合入完成后的清理
