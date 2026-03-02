# PR 模板 + 云端 Review 触发模板

> 单一真相源。所有猫猫开 PR 和触发云端 review 都用这些模板。
> 修改本文件 = 三猫行为同步，不再有格式不一致问题。

## PR Body 模板

```
## What

{改了哪些文件、核心改动}

## Why

{为什么做这个改动、约束和目标}

## Original Requirements（必填）

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

pnpm --filter @cat-cafe/api test       # X passed, 0 failed
pnpm --filter @cat-cafe/web test       # X passed, 0 failed
pnpm -r --if-present run build         # 成功

## Open Questions

{reviewer 需要关注的点}

---

**本地 Review**: [x] {reviewer 纯文本句柄，如 gpt52} 已 review 并放行
**云端 Review**: [ ] PR 创建后在 **comment** 中触发（见下方模板）

<!-- 猫猫签名（纯文本，禁止 @）: 例如 缅因猫/砚砚 (codex) -->
```

## 云端 Review 触发 Comment 模板

PR 创建后，**立刻发一条 comment**（不是在 PR body 里写）：

```
@codex review

规则：任何 P1/P2 必须给"可执行复现"：
- 优先：新增/更新一个 failing test（最小复现）
- 否则：给确定性复现步骤（命令 + 输入 + 预期/实际）
没有证据的一律降级为 P3 建议，不算缺陷。

审查标准（详见 AGENTS.md "Review guidelines" section）：
- P0 数据丢失/安全漏洞 | P1 逻辑错误/测试缺失/架构违规
- P2 性能/重复/命名 | P3 风格偏好
- 禁止 `any`、文件 200 行警告/350 硬上限、新功能必须有测试
```

**注意**：
- `@codex review` 必须写在 PR **comment** 中，不能写在 PR body 里
- 写在 body 里会错误触发 Codex 获取代码修改权限，而非 review 权限
- **PR body（含 HTML 注释）禁止出现任何 `@句柄`（例如 `(@codex)`）**
- 铲屎官教训：2026-02-28 某 PR 在 body 里写 `@codex review`，导致 Codex 回复"需要权限"而非执行 review
- 新增反面案例：2026-03-02 PR #160 在 body 签名写 `(@codex)`，触发环境提示评论，污染 review 流程
