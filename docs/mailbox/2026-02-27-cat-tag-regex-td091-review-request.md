---
feature_ids: [TD091]
debt_ids: [TD091]
topics: [email-routing, pr-tracking, mcp-callback]
doc_kind: review-request
created: 2026-02-27
---

## Review 请求: Cat Tag Regex + TD091 PR Tracking Chain Fix

### 背景

铲屎官抓到 email 通知不达猫的 bug：PR #89 云端 Codex review 通过 21 分钟后布偶猫没收到通知。
调查发现两层路由都失败：
- **Layer 2**（PR title → cat tag）：regex 只匹配品种名 `[布偶猫🐾]`，但 PR 签名用昵称 `[宪宪/Opus-46🐾]`
- **Layer 1**（PrTrackingStore registry）：没有 MCP 工具可注册，猫猫只能裸 curl

铲屎官同时转达了其他猫的痛点（TD091 debt）：`get_thread_context` 不返回 threadId，猫猫不知道自己在哪个 thread。

### 铲屎官原始需求

> "怎么云端的推送没通知你呀？嘿嘿你不是说我们的 email 通路打通了吗！？被我抓到猫尾巴了！"
> "包括其他大猫猫提到的不方便的地方，我们开一个 worktree 直接修了这个债务？"
> 痛点转述："没有 MCP 工具——只有裸 curl"、"get_thread_context 不返回 threadId"

核心痛点：email review 通知路由两层都坏了 + 猫猫缺少 MCP 工具注册 PR tracking。

### 设计文档

- Debt: `docs/BACKLOG.md` TD091
- 无独立 spec（bug fix + debt 修复，铲屎官直接指令）

### Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 昵称签名 `[宪宪/Opus-46🐾]` → 布偶猫 | ✅ | GithubReviewMailParser.ts:116-144, 7 tests |
| 2 | 所有签名格式向后兼容 | ✅ | 品种名 + 昵称 + 昵称/变体 全覆盖 |
| 3 | `get_thread_context` 返回 threadId | ✅ | callbacks.ts:399-400, 2 tests |
| 4 | 新 MCP 工具 `register_pr_tracking` | ✅ | callback-tools.ts + callbacks.ts, 4 tests |
| 5 | Server 从 invocation record 自动解析 threadId | ✅ | callbacks.ts:449 `record.threadId` |
| 6 | Auth/validation 完整 | ✅ | 401 + 400 + 503 tests |

### 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/infrastructure/email/GithubReviewMailParser.ts` | 修改 | CAT_TAG_REGEX 改为通用匹配 + NICKNAME_TO_BREED 查表 |
| `packages/api/test/github-review-mail-parser.test.js` | 修改 | +7 tests 覆盖昵称签名格式 |
| `packages/api/src/routes/callbacks.ts` | 修改 | echo threadId + 新 register-pr-tracking route |
| `packages/api/src/index.ts` | 修改 | hoist prTrackingStore, wire to callbacksRoutes |
| `packages/api/test/callback-routes.test.js` | 修改 | +6 tests (threadId echo + PR tracking CRUD) |
| `packages/mcp-server/src/tools/callback-tools.ts` | 修改 | 新 MCP 工具 schema + handler |
| `packages/mcp-server/src/tools/index.ts` | 修改 | 导出新工具 |

### Git SHA

- Base: `38a596e` (main)
- Head: `b576dbb`
- Branch: `fix/cat-tag-regex-nickname`
- Commits: `863eff1` (regex fix) + `b576dbb` (TD091)

### 测试状态

```
pnpm test: 2160 passed, 1 failed (pre-existing Redis isolation guard)
API build: ✅ clean
MCP server build: ✅ clean
```

### Review 重点

1. **GithubReviewMailParser.ts**: NICKNAME_TO_BREED 映射表是否完整？有没有漏掉的签名变体？
2. **callbacks.ts register-pr-tracking**: `catRegistry.has(catId)` 校验是否必要/合理？
3. **callbacks.ts threadId echo**: 跨线程读取时 echo 的是 `effectiveThreadId`（requested threadId），不是 invocation 原始 threadId，这样对吗？
4. **index.ts hoist**: prTrackingStore 提前创建是否影响其他初始化顺序？

### 五件套

**What**: 两个 fix — (1) cat tag regex 支持昵称签名 (2) TD091 新增 register-pr-tracking 回调 + threadId echo
**Why**: email review 通知两层路由都失败，猫猫收不到云端 review 结果
**Tradeoff**: 考虑过在 MCP tool 端让猫自己传 threadId，但选择 server 端从 invocation record 自动解析（猫不需要知道 threadId）
**Open Questions**: 无
**Next Action**: 请 review 上述文件，重点关注 review 重点中的 4 个问题
