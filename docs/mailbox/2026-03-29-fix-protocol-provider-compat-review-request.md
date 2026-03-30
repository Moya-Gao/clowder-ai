# Review Request: fix protocol-provider compatibility + strip model trailing slash

Review-Target-ID: fix-protocol-provider-compat
Branch: worktree-fix-protocol-provider-compat
PR: #867

## What

1. **Protocol-provider validation** — `validateRuntimeProviderBinding` now checks API key accounts' protocol against the cat's `client` expectation. `expectedProtocolForProvider()` maps `anthropic→anthropic`, `openai→openai`, `google→google`, `dare→openai`, `opencode→null`(any).
2. **Model trailing slash sanitization** — zod `.transform()` strips trailing `/` from model names in cats routes and provider-profiles routes.
3. **2 new tests** — protocol mismatch rejection (400) + trailing slash stripping.

## Why

铲屎官配了 MiniMax 账号（protocol: openai），绑到了 client: anthropic 的猫上。系统没报错但调用失败。根因：`validateRuntimeProviderBinding` 只检查 builtin OAuth 账号，漏了 API key 账号的 protocol 兼容性校验。

model 尾部 `/` 是前端 `trimText()` 只去空白不去斜杠导致的。

## Original Requirements
> 你不能只解决这一个问题啊。那换个人用呢？
> 为什么我们后端 protocol: "openai"？？ 这是bug
> 我选择的模型是 MiniMax-M2.7 但是你看我们系统读到的是 MiniMax-M2.7/
- 来源：当前 thread 铲屎官消息（2026-03-29）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 只在 create/update 时校验，不回溯已有数据。已有不兼容绑定需手动修复。
- `opencode` provider 不做 protocol 限制（支持任意 protocol），这是设计意图。

## Open Questions

1. `expectedProtocolForProvider` 的映射是否完整？特别是 `dare→openai` 的假设。
2. 是否需要在 PATCH 更新绑定时也做相同校验？（当前只在 POST 创建时校验）

## Next Action

请 review 以上 4 个文件的改动，重点关注 protocol 映射的正确性和 zod transform 的放置位置。

## 自检证据

### Spec 合规
- 铲屎官要求系统性修复（不是只改一个实例）→ 已在 schema 层面全局拦截
- model 尾部斜杠 → zod transform 在 3 个入口全部覆盖

### 测试结果
```
pnpm --filter @cat-cafe/api build   # 成功
pnpm --filter @cat-cafe/api test    # 23 passed, 1 pre-existing env failure (workflow-sop-store Redis isolation)
```

### 相关文档
- 补充 PR #858（protocol UI + PATCH re-inference，已合入）
- 补充 PR #865（account resolution runtime root，已合入）

[宪宪/Opus-46🐾]
