---
feature_ids: [F042]
topics: [prompt-engineering, a2a, disambiguation]
doc_kind: review-request
created: 2026-03-01
---

## Review 请求: F042 Wave 3 — Active Participant Hint（@ 错猫修复）

### What

给 `buildInvocationContext()` 新增 `activeParticipants` 注入：每次调用时从 `ThreadStore.getParticipantsWithActivity()` 拉取线程活跃数据，注入一行 `最近活跃：@handle`，让猫猫知道当前该 @ 谁。

改动文件（3 files, +123/-6）：
1. `SystemPromptBuilder.ts` — `InvocationContext` 接口加 `activeParticipants?` 字段 + `buildInvocationContext()` 注入逻辑
2. `route-serial.ts` — best-effort 从 `threadStore` 拉活跃数据传入
3. `system-prompt-builder.test.js` — 5 个新测试

### Why

砚砚在 PR #115 协作时 @opus-45 而不是 @opus-46（实际协作对象）。根因：`InvocationContext.teammates` 只有当前调用链的猫，不含线程历史活跃数据。上下文压缩后猫猫退化到"按印象选 leader"而非"按活跃事实选"。

Fix 思路：per-invocation 注入（不是 session-level），每次 `buildInvocationContext()` 重建，压缩后不丢。

### Tradeoff

| 方案 | 优缺 | 选择 |
|------|------|------|
| Per-invocation 注入（chosen） | 压缩后不丢 / 开销 ~15 chars | **选** |
| Session-level `buildStaticIdentity` | 压缩后可能丢 / 只建一次 | 不选 |
| Thread metadata + stage 锚点 | 需要改 thread schema | 留 Wave 4 |

### Open Questions

1. `route-parallel.ts` 没加 — 并行模式下猫不做 mid-invocation @ 决策，应该不需要。砚砚看看是否认同？
2. 注入只取 top-1 非自身活跃者。是否需要列 top-3？（我认为 top-1 够了，减少 token）
3. 断链 symlinks（`.claude/skills/` 下的旧 skill symlinks）需要清理，但属于 Wave 1 后续，不在本 PR 范围。

### Next Action

请 review 以下 3 个文件的改动：
1. `SystemPromptBuilder.ts` — 注入逻辑是否正确（自排除、lastMessageAt > 0 guard、getConfig null guard）
2. `route-serial.ts` — best-effort fetch 是否安全（try/catch、不阻塞调用）
3. `system-prompt-builder.test.js` — 5 个用例是否覆盖关键边界（自排除、无数据、零活跃、size guard）

重点关注：
- `pickVariantMention()` 是否在所有 runtime 配置下返回正确句柄
- size guard 2050 是否足够（当前 worst-case with full runtime config + activity ≈ 2015）

### Git SHA

- Base: `3513cb0f` (main HEAD)
- Head: `4bb0217e`

### 测试

- `pnpm --filter @cat-cafe/api build` — clean
- `node --test test/system-prompt-builder.test.js` — 47/47 pass (42 existing + 5 new)
