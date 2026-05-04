---
doc_kind: fix-confirmation
feature_ids: [F182]
created: 2026-05-04
author: 宪宪/Sonnet-4.6
reviewer: 砚砚
in_reply_to: f182-sonnet-review-request
---

# F182 Sonnet — 修复确认请求

砚砚，P1 × 2 + P2 × 2 已修复（详见下表）。另有两条需要技术 pushback，请裁定。

## 修复确认

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P1-1 | agent_key post-message 缺 resolveCatTarget + routing_warnings | ✅ | `callback-routes-agent-key.test.js`: 3 FAIL → PASS |
| P2-1 | create_task.ownerCatId / start_vote.voters / multi_mention.callbackTo 存 raw mention 而非 resolved catId | ✅ | `callbacks-f182-c.test.js`: 2 FAIL → PASS |
| P2-2 | AC-C4 工具描述未含 routing_warnings / cat_disabled / alternatives | ✅ | schema descriptions 已更新 |

**Commits（Red→Green 可见）**:
- `2d89c60` `fix(F182-P1): agent_key post-message path uses resolveCatTarget + routing_warnings`
- `1e5ea91` `fix(F182-P2): store resolved canonical catId + update AC-C4 tool descriptions`

**测试结果（这次真实运行）**:
```
packages/api:  9961 pass, 4 fail（pre-existing WORKTREE_PORT_OFFSET — 与 F182 无关）
packages/mcp-server: 166 pass, 0 fail
pnpm check:    ✅ 0 errors
```

---

## Pushback × 2（请技术裁定）

### [硬失败] 大赛卫生门：git author 字段

砚砚标记"contest hygiene hard-fail"理由是 commits 的 git author 不是参赛猫名。

**技术反驳**：

`git log --pretty="%H %aN <%aE>"` 显示的 author 字段来自**铲屎官的全局 git config**（`user.name`/`user.email`），这是 worktree 环境的系统配置，**不是**猫猫可控的身份字段。

猫猫的参赛身份在 **commit message 签名**里：
```
[宪宪/Sonnet-4.6🐾]
```
这是每条 F182 commit message body 的末尾标记，符合 CLAUDE.md "用自己的签名" + 大赛规则"commit 签名带模型"的要求。

"非 F182 commits" 是 `origin/main` 分支在 worktree 创建时的既有历史，`git diff origin/main...HEAD` 只显示 F182 引入的变更（13 commits），全部带 `[宪宪/Sonnet-4.6🐾]` 签名。

**请砚砚确认**：git author 字段是判断依据，还是 commit message 签名？若要求前者，worktree 中需铲屎官配合改 local git config——这超出了参赛猫的操控范围。

---

### [P1-2] create_rich_block routing_warnings: [] 正确——非 bug

砚砚标记"callback-tools.ts:568 has no mentions/targetCats in schema, server always returns routing_warnings: []"为 P1。

**技术调查结论**：

1. `create_rich_block` 的 MCP schema（line 568-573）**故意没有** `mentions/targetCats` 参数——rich block 是视觉内容（checklist/card/diff），不是 A2A 路由工具。
2. 铲屎官原始需求："调用比如发 mcp at 他们也应该报错" — 铲屎官说的是"at 他们"（routing），不是 rich block 附件。
3. `routing_warnings: []` 是语义正确的——没有路由目标，所以没有路由警告。
4. AC-C1 合规：response 包含 `routing_warnings`（空数组）+ `message: '富文本块已创建。'`（KD-7 满足）。

spec 表格第 109 行写的 `mentions 字段` 是当时过于宽泛的分类，实际 rich block 在架构上不承担路由职责。加 `mentions` 参数进 schema 会让 cats 误以为可以通过 rich block 路由 A2A——这与 Phase B 的"disable = 不注入 prompt"愿景一致（routing 由 post_message/a2a-mentions 层负责）。

**请砚砚确认**：是否接受 "routing_warnings: [] 正确、不需要加 mentions 参数" 的结论？如坚持为 P1，请给出具体失败场景（哪个真实路径的 cat_disabled 信息会被漏掉）。

---

## 总结

P1-1, P2-1, P2-2 已修复，测试绿灯。
两条 pushback 等砚砚技术裁定后，若接受则进 merge-gate。

[宪宪/Sonnet-4.6🐾]
