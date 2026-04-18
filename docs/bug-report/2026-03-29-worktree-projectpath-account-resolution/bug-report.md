---
feature_ids: [F136]
ext_refs: [clowder-ai#223]
topics: [account-resolver, worktree, projectPath, invocation, opencode]
doc_kind: bug-report
created: 2026-03-29
---

# Bug Report: failed to resolve bound account — worktree projectPath 分裂

> 日期：2026-03-29
> 报告人：铲屎官（运行时观察到错误）
> 调查人：金渐层 (@opencode)
> 关联 Issue: #862（runtime 损坏，已修复）

## 1. 症状

### 主要症状

在「国产api测试」thread 中 `@国产喵`（opencode-china），每次调用报错：

```
[错误] failed to resolve bound account "jiuuij"
```

**重启 runtime 后 100% 复现。** 不是偶发——只要有 thread 上下文就必现。

### 附带异常

铲屎官观察到 opencode-china 出现在了**大厅**（default thread）的 participants 列表中。
铲屎官在「国产api测试」thread 发消息，但猫跑到大厅去了。

- `default` thread participants 含 `opencode-china`，`lastActiveAt = 18:31:02`
- 「国产api测试」thread 最后一条错误在 `18:25:45`
- 可能原因：金渐层在调试 session 中通过 API 测试 invocation 时未指定 threadId，
  系统 fallback 到 default thread；或 ConnectorRouter 在处理失败 invocation 时
  把消息路由到了 default thread

## 2. 期望 vs 实际行为

| | 期望 | 实际 |
|---|---|---|
| `@国产喵` 调用 | 正常发起 invocation，调用 jiuuij API | 报错 `failed to resolve bound account "jiuuij"` |
| account 查找 | 从 runtime catalog 读取 jiuuij | 从 dev catalog 读取，找不到 jiuuij |
| 消息路由 | 回复到发起 thread | opencode-china 出现在大厅 participants 中 |

## 3. 根因

**Thread 的 `projectPath` 指向 dev worktree (`cat-cafe/`)，但 account 只写在 runtime worktree (`cat-cafe-runtime/`) 的 catalog 中。**

### 调用链追踪

```
invoke-single-cat.ts L526:
  thread.projectPath = "/Users/lysander/.../cat-cafe"  (dev worktree)
  → workingDirectory = "cat-cafe/"

L538:
  workingProjectRoot = findMonorepoRoot("cat-cafe/") → "cat-cafe/"

L668:
  projectRoot = workingProjectRoot  ← 用的是 dev worktree!

L674:
  resolveForClient(projectRoot="cat-cafe/", "opencode", "jiuuij")
  → readCatalogAccounts("cat-cafe/")
  → 读取 cat-cafe/.cat-cafe/cat-catalog.json
  → accounts = [claude, codex, gemini, dare, opencode, minimax]
  → 没有 jiuuij！→ 返回 null

L675-676:
  throw "bound account jiuuij not found"

L704-705:
  catch → re-throw "failed to resolve bound account jiuuij"
```

### 关键数据对比

| 位置 | jiuuij? | 说明 |
|---|---|---|
| `cat-cafe-runtime/.cat-cafe/cat-catalog.json` | **有** | API 写入正确 |
| `cat-cafe/.cat-cafe/cat-catalog.json` | **无** | dev catalog 从未写入 |
| catRegistry（内存单例） | **有** | 错误消息含 "jiuuij" 证明 catRegistry 有 |
| `~/.cat-cafe/credentials.json` | **有** | API key 存在 |

### Thread projectPath 证据

所有从 Hub UI 创建的 thread 的 `projectPath` 都指向 dev worktree：

| Thread | projectPath |
|---|---|
| 全家福 | `/Users/lysander/.../cat-cafe` (dev) |
| 国产api测试 | `/Users/lysander/.../cat-cafe` (dev) |
| kimi2.5 | `/Users/lysander/.../cat-cafe` (dev) |
| default | `default` |

### 为什么间歇性成功

金渐层在调试 session 中通过 API 直接测试 invocation（不带 threadId），此时：

- `workingDirectory = undefined`（无 thread 上下文）
- fallback 到 `resolveActiveProjectRoot(process.cwd())`
- `process.cwd()` = `cat-cafe-runtime/` → 读到正确的 catalog → 成功

**结论：无 thread 上下文的调用成功，有 thread 上下文的调用必定失败。**

## 4. 定位过程

1. **观察**：铲屎官报 `failed to resolve bound account "jiuuij"`，重启后仍复现
2. **验证配置正确性**：
   - jiuuij 在 runtime catalog 有 (`cat-cafe-runtime/.cat-cafe/cat-catalog.json`)
   - credentials.json 有 API key
   - catRegistry 内存有 opencode-china（错误消息含 "jiuuij" 证明）
   - `GET /api/provider-profiles` 返回 jiuuij，`hasApiKey: true`
   - `GET /api/cats` 返回 opencode-china，`accountRef: "jiuuij"`
3. **完整代码追踪**：走完 `invoke-single-cat.ts` → `account-resolver.ts` → `catalog-accounts.ts` → `cat-catalog-store.ts` 调用链
4. **关键发现**：错误消息含 "jiuuij" → catRegistry 有猫 → 问题在 account 解析而非 cat 查找
5. **读 `active-project-root.ts` + `monorepo-root.ts`**：发现 `projectRoot` 由 `thread.projectPath` 决定（L526-538），而非 `process.cwd()`
6. **查 thread 数据**：所有 thread 的 `projectPath = cat-cafe/`（dev），不是 `cat-cafe-runtime/`
7. **确认**：`cat-cafe/.cat-cafe/cat-catalog.json` 的 accounts 只有 `[claude, codex, gemini, dare, opencode, minimax]`，没有 `jiuuij` → 根因锁定

## 5. 影响范围

**所有通过 runtime worktree 运行 + 在 Hub UI 创建 thread 中使用的自定义 account 都受影响。**

- 不仅是国产喵——任何通过 `POST /api/provider-profiles` 在 runtime 添加的 account，
  在有 thread 上下文的 invocation 中都会失败
- 三只内置猫（opus/codex/gemini）不受影响——它们的 account 在 dev 和 runtime catalog 都存在
- 开源用户使用 `pnpm start`（runtime worktree 模式）+ 通过 API 添加自定义 provider 都会中招

## 6. 涉及文件

| 文件 | 关键行 | 说明 |
|---|---|---|
| `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts` | L526-706 | thread.projectPath 读取 + account 解析 + 错误抛出 |
| `packages/api/src/config/account-resolver.ts` | L133-174 | `resolveForClient()` 核心解析逻辑 |
| `packages/api/src/config/catalog-accounts.ts` | L10-14 | `readCatalogAccounts()` 按 projectRoot 读 catalog |
| `packages/api/src/config/cat-catalog-store.ts` | L368-394 | `resolveCatCatalogPath()` + `readCatCatalog()` |
| `packages/api/src/utils/active-project-root.ts` | L13-39 | `resolveActiveProjectRoot()` fallback 链 |
| `packages/api/src/utils/monorepo-root.ts` | L4-11 | `findMonorepoRoot()` 向上查找 pnpm-workspace.yaml |

## 7. 修复方向建议

### A. Account 解析 fallback（推荐，最小改动）

`resolveForClient()` 在 `projectRoot` 查不到 `preferredAccountRef` 时，
如果 `projectRoot !== process.cwd()`，再用 `process.cwd()` 查一次。

原理：catRegistry 从 `process.cwd()`（runtime root）加载，account 解析应与之一致。

改动位置：`invoke-single-cat.ts` L668 附近，或 `account-resolver.ts` `resolveForClient()`。

### B. Thread 创建时用 runtime 路径

`POST /api/threads` 创建时，`projectPath` 设为 `process.cwd()` 而非前端传来的路径。
但可能影响外部项目路由逻辑。

### C. Account 双写

写 account 时同时写入 dev 和 runtime catalog。
但破坏 "runtime 独立" 的架构理念。

### D. 统一 account 真相源

让 account 解析始终用 `process.cwd()`（runtime root），thread.projectPath 只用于
shared-state preflight 等非 account 用途。catRegistry 就是这么做的——account 也应一致。

---

**建议优先方案 A 或 D，改动最小、不破坏架构、向后兼容。**
