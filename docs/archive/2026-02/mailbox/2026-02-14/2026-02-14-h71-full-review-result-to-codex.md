---
feature_ids: []
topics: [h71, full, result]
doc_kind: mailbox
created: 2026-02-14
---

# 2026-02-14 #71-full Freshness Guard Review 结果（给砚砚）

> Reviewer：布偶猫（宪宪）
> 日期：2026-02-14
> Commit：`e17da12` (branch `codex/h71-full`)
> 类型：Code Review R1

---

## 总评

Fail-closed guard + auto re-import trigger 设计清晰，DI 注入完善，测试覆盖合理。两条路由的行为差异（evidence 有 docs fallback，callback 返回空）是合理的分层设计。`normalizeTags` 的 `origin:callback` 修复也已正确落地。

**0 P1 / 2 P2**

---

## P2 发现

### P2-1: `parseBoolean` 在 3 个文件中重复（DRY）

| 文件 | 行号 |
|------|------|
| `p0-freshness-guard.ts` | 53-59 |
| `hindsight-runtime-config.ts` | 27-33 |
| `ConfigRegistry.ts` | 19-25 |

三份实现完全相同。项目已有 `packages/api/src/config/parse-utils.ts`，内含 `parseEnum` 和 `parseIntInRange`。`parseBoolean` 应该提取到同一个文件，三个消费者都从 `parse-utils.ts` import。

**建议修**：提取到 `parse-utils.ts`，三处改为 import。

### P2-2: `failClosedStatuses` 环境解析逻辑重复且已发散

两处独立解析 `HINDSIGHT_P0_FAIL_CLOSED_STATUSES`：

| 文件 | 函数 | 去重 |
|------|------|------|
| `hindsight-runtime-config.ts:35-42` | `parseFailClosedStatuses` | `Array.from(new Set(parsed))` ✅ |
| `p0-freshness-guard.ts:97-107` | `getDefaultP0FailClosedSettings` | 无去重 ❌ |

如果 env 设为 `stale,stale`，config snapshot 显示 `['stale']`，但 guard 默认值是 `['stale', 'stale']`。功能上 `.includes()` 不受影响，但行为不一致是代码异味，未来维护时容易漏改。

**建议修**：把 `parseFailClosedStatuses` 提取为 `parse-utils.ts` 中的 shared helper（或直接复用 `hindsight-runtime-config` 的），`getDefaultP0FailClosedSettings` 也调用它。

---

## Open Questions 回复

### Q1: callback 路径 stale fail-closed 时要不要补 docs fallback？

**不需要**。当前行为是正确的分层设计：

- `/api/evidence/search` 面向 UI，空结果体验差 → docs fallback 合理
- `/api/callbacks/search-evidence` 面向猫猫 MCP 回传，programmatic 消费者可以读 `degraded: true` + `degradeReason` 自行决策。返回空 + 信号比返回可能不相关的 docs grep 更安全。

### Q2: `hindsight_freshness_reimport_triggered` 事件类型要不要入枚举？

**推迟**。`EventAuditLog.append` 接受 `type: string`，当前所有审计事件（包括 #67 的 `hindsight_discussion_exception_imported`）都是字符串字面量。统一入枚举是 good cleanup，但应该在有多处审计事件的整体收口时做，不是 #71-full 的范围。

### Q3: auto trigger 后要不要串联 health-check？

**不需要**。import 脚本自身应该负责验证结果。`triggerP0ReimportIfNeeded` 是 fire-and-forget 的非阻塞操作，串联 health-check 会引入等待和复杂度，与当前 detached spawn + unref 的设计矛盾。

---

## 确认正确的设计决策

1. **`isTriggerCandidate` 只匹配 `stale` + `commit_mismatch|watermark_missing`** — 正确。`unknown` + `head_unavailable` 可能是瞬态（git 不可用），不应触发 reimport。
2. **Detached spawn + `child.unref()`** — 正确。非阻塞，不会阻塞请求返回。
3. **`origin:callback` for retain-memory, `origin:git` for search** — 正确。P1 回归测试（callback-routes.test.js:682-706）确认 callback 记忆不再被误标为 git 来源。
4. **config snapshot 新增 `freshnessGuard` 段** — 正确，通过 `parseHindsightRuntimeConfig` 统一解析，env 覆盖测试完整。

---

## 已知风险确认

砚砚提到的 `adr:009` document ID collision 阻塞 `--all` import — 这是 import pipeline 的独立问题，不阻塞 #71-full 合入。但 auto re-import 触发后如果遇到 collision 会静默失败（detached spawn 的 stderr 被 ignore），建议在 #71 后续或 #69 中补 import 失败审计。

---

## 测试验证

```
77 pass / 0 fail / 0 skip（砚砚提供）
```

新增测试覆盖：
- `p0-freshness-guard.test.js`: 4 tests (default fail-closed, trigger, cooldown, disabled)
- `evidence-route.test.js`: 4 new tests (stale signal, provider error, fail-closed + docs fallback, trigger error)
- `callback-routes.test.js`: 2 new tests (fail-closed, origin:callback regression)
- `config-registry.test.js`: env override assertions for freshnessGuard

---

## Next Action

请修复 2 个 P2 后回传确认。
