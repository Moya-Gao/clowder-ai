---
feature_ids: [F078]
topics: [mention, routing, autocomplete]
doc_kind: mailbox
created: 2026-05-25
---

# Review Request: fix group mention short-circuit + autocomplete visibility

Review-Target-ID: fix-mention-union
Branch: feat/mention-union

## What

两个改动：

1. **后端路由 union**（AgentRouter.ts）：`parseAllMentions` 从 group mention 短路改为 group + individual union。以前 `@thread @gemini` 只派发 thread participants，丢掉 explicit `@gemini`。现在 union 两者并去重。
2. **前端 @ 补全面板**（chat-input-options.ts + ChatInputMenus.tsx）：@ 下拉菜单新增 `@thread`、`@all`、`@全体{breed}` group mention 选项（带 people SVG icon），让用户不用死记快捷键就能发现这些功能。

## Why

铲屎官在 `@thread @gemini` 并发 @ 时发现 gemini 没被派发。砚砚定位根因在 `parseGroupMentions` 返回非 null 时直接 `return`，跳过了 `parseMentions`。铲屎官同时提出 @ 补全面板应显示 group mention 快捷键。

## Original Requirements（必填）

> 这个确实应该把行为改一下！甚至我们的@ 比如 他会弹出到底在at谁可以选，我在想我们的比如at全体 thread这些快捷键是不是也得可见啊？告知有这些快捷键？然后你的这个行为确实应该union

- 来源：当前 thread 铲屎官 2026-05-25 18:16 消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- Breed group mentions 只在有 2+ 可用猫时显示（单猫 breed 没必要 group @）
- Group mention 高亮（mention-highlight.ts）未做——只影响输入框回显，不影响路由。可后续补

## Architecture Ownership（必填）

Architecture cell: cat-routing（AgentRouter 路由层）
Map delta: none
Why: 改的是 parseAllMentions 内部逻辑（union 替代 short-circuit），不新增 Store/Queue/Adapter/Router

请 reviewer 检查：
- diff 是否与 `Map delta` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- 若修改 `docs/architecture/ownership/cells/*.md`，是否确实改变了 owner / boundary / extension point / canonical anchor

## Open Questions

### 技术 OQ（给 reviewer）

1. **union 顺序**：当前是 `[...groupResult, ...extra]`（group 在前，explicit 在后）。`resolveTargetsAndIntent` 返回的 targetCats 顺序是否影响并发派发优先级？如果是，explicit mention 是否该排前面？
2. **routing_warnings 合并**：group mention 路径以前不返回 warnings。现在 union 后会把 individual 的 warnings 也带上——比如 `@thread @已退休猫` 会同时返回 thread participants + 退休猫的 warning。确认这是期望行为。

### 价值 OQ（给 CVO，如有）

无

## Next Action

请 review 代码正确性，特别关注 union 去重逻辑和前端 group option 生成。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/fix-mention-union/codex`
- Start Command: `pnpm review:start`
- Ports: 按 review:start 自动分配（3201/3202 起点）

## 自检证据

### Spec 合规

铲屎官直接 bug fix 指令，无 formal spec。对照原始需求两点：
- [x] union 行为：`@thread @gemini` → 3 只猫（opus + codex + gemini）✅ 测试覆盖
- [x] @ 补全可见性：`buildCatOptions` 返回 group options 在顶部 ✅ 测试覆盖

### 测试结果

```
# 后端 group mention 测试（含新增 2 个 union 测试）
agent-router.test.js F078: Group mentions — 18 passed, 0 failed

# 前端 autocomplete 测试
chat-input-options-labels.test.ts — 6 passed, 0 failed
chat-input-mention-filter.test.ts — 8 passed, 0 failed
```

### 根目录工件闸门

```
git status --short | rg root artifacts → empty ✅
git diff --name-only origin/main...HEAD | rg root artifacts → empty ✅
```

### 相关文档

- F078: Smart Routing & Group Mentions（原始 feature）
- 砚砚诊断消息（当前 thread 09:50，定位 AgentRouter.ts:690 短路 bug）

### 如果我判断错了，我最可能错在

1. `parseMentions` 可能也会匹配到 group mention 关键词（如某只猫的 mentionPattern 恰好包含 "all" 或 "thread"），导致 union 后多出预期外的猫
2. 前端 `buildBreedGroupOptions` 的 `breedId` 值和后端 `parseGroupMentions` 的 `@all-{breedId}` 不一定完全一致（如大小写 / 连字符差异）
