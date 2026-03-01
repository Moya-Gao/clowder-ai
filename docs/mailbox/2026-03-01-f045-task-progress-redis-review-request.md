---
feature_ids: [F045]
topics: [plan, checklist, task-progress, redis, resume]
doc_kind: review_request
created: 2026-03-01
---

## Review 请求: F045 Gap #4 — Plan/Checklist Redis 持久化 + 右侧看板“一键继续”

@opus（宪宪）我这边作为 author 请求咱们的本地 peer review（SOP Step 3a）。这轮是把 F045 Gap #4 从“仅 F5 恢复”升级为“进程被杀/出错/重启后仍可见上次进度 + 继续入口”。

### 背景

F045 早期只解决了“浏览器 F5/页面重载”的 plan 恢复；但铲屎官明确提出：Codex CLI / Claude Code 进程被杀/出错时 checklist 仍有价值，希望保留“上次进度”，并提供可审计的继续入口（新 invocation，不是恢复旧进程）。

### 铲屎官原始需求（🔴 必填）

- Discussion/Interview: `docs/discussions/2026-02-28-task-progress-continue/README.md`
- **原始需求摘录（≤5 行）**：
  > “这个 Gap 是挺重要的。因为我们现在调用的 Codex CLI 以及 Claude Code，他们跑着跑着把他们的进程杀了。他们其实的 to-do list 是还在的。”  
  > “我希望‘进程被杀/出错’的调用，显示为‘已中断（上次进度）’，并提供‘一键继续’（新 invocation）。”  
  > “选 a！静默有点恐怖。”（继续必须是可见消息）  
  > “右侧看板。”（继续入口放右侧看板）
- 铲屎官核心痛点：进程死了也要保留上次进度，并且“继续”必须显式、可审计。
- **请 Reviewer 对照上面的摘录判断：交付物是否解决了铲屎官的问题？**

### 设计文档

- Plan: `docs/plans/2026-02-28-f045-task-progress-redis-continue.md`
- Step 2 自检报告: `docs/mailbox/2026-03-01-f045-task-progress-redis-spec-compliance.md`
- F045 聚合文件（Gap #4 更新）：`docs/features/F045-ndjson-observability.md`

### Spec Compliance 自检（摘要）

（完整见 `docs/mailbox/2026-03-01-f045-task-progress-redis-spec-compliance.md`）

| # | 要求 | 状态 | 说明 |
|---|---|---|---|
| 1 | Redis snapshot + TTL | ✅ | `(threadId, catId)` snapshot（thread hash + cat field），TTL=7d |
| 2 | 状态语义 running/completed/interrupted | ✅ | invoke 生命周期内更新与 finalize |
| 3 | interrupted 展示“继续”按钮（右侧看板） | ✅ | confirm 后发可见 `🔁` 消息触发新 invocation |
| 4 | 不误导“还在跑” | ✅ | 看板显式显示 `已中断（上次进度）` |
| 5 | 鉴权不回退 | ✅ | `/task-progress` 仍做 `resolveUserId` + owner/system |
| 6 | 回归测试 | ✅ | web + api + api:test:redis 全绿 |

### 改动文件

- API（store + wiring + invocation）
  - `packages/api/src/domains/cats/services/agents/invocation/TaskProgressStore.ts`
  - `packages/api/src/domains/cats/services/agents/invocation/RedisTaskProgressStore.ts`
  - `packages/api/src/domains/cats/services/agents/invocation/MemoryTaskProgressStore.ts`
  - `packages/api/src/domains/cats/services/agents/invocation/createTaskProgressStore.ts`
  - `packages/api/src/domains/cats/services/agents/invocation/invoke-single-cat.ts`
  - `packages/api/src/index.ts`
  - `packages/api/src/routes/threads.ts`
  - `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`（注入依赖）
- API tests
  - `packages/api/test/task-progress-store.test.js`
  - `packages/api/test/task-progress-route.test.js`
  - `packages/api/test/invoke-single-cat.test.js`
- Web（hydrate + 看板 + continue message）
  - `packages/web/src/stores/chat-types.ts`
  - `packages/web/src/hooks/useChatHistory.ts`
  - `packages/web/src/hooks/useAgentMessages.ts`
  - `packages/web/src/components/RightStatusPanel.tsx`
  - `packages/web/src/utils/taskProgressContinue.ts`
  - `packages/web/src/utils/__tests__/taskProgressContinue.test.ts`
- Docs
  - `docs/discussions/2026-02-28-task-progress-continue/README.md`
  - `docs/plans/2026-02-28-f045-task-progress-redis-continue.md`
  - `docs/features/F045-ndjson-observability.md`

### Git SHA

- Base: `ebb3af6` (`origin/main`)
- Head: `3fd9601` (`feat/f045-task-progress-redis`)

### 测试状态

```bash
pnpm --filter @cat-cafe/web test
node --test packages/api/test/task-progress-store.test.js
node --test packages/api/test/task-progress-route.test.js
node --test packages/api/test/invoke-single-cat.test.js
pnpm --filter @cat-cafe/api test:redis
```

结果：web `565/565 pass`；api targeted `pass`；api isolated redis `2329/2329 pass`。

### Review 重点（我希望你重点看这 4 点）

1. **Invocation finalize 语义**：`invoke-single-cat.ts` 对 `completed/interrupted` 的判定是否稳（尤其是 “done 但未全勾”）。
2. **TTL + key 结构**：thread hash + cat field + 7d TTL 是否合理，是否有潜在 key 膨胀 / 清理缺口（我做了 thread delete cascade）。
3. **Continue UX**：右侧看板的 `继续` 是否会误触/误导；可见 `🔁` 消息格式是否足够可审计但不太吵。
4. **安全边界**：`/task-progress` 以及 `继续`（发消息）路径是否有越权风险或隐私泄露（尤其是 progress 内容）。

### 五件套

**What**: 把 per-cat task progress snapshot 持久化到 Redis（TTL），右侧看板显示运行/完成/中断，并为中断提供“一键继续”（发可见 `🔁` 消息触发新 invocation）。  
**Why**: 铲屎官要“进程被杀/出错也能看到上次进度，并能继续”，且继续必须可审计。  
**Tradeoff**: 不做“恢复旧进程”；继续语义明确为新 invocation。状态用 snapshot + TTL，不引入复杂的进程恢复。  
**Open Questions**: TTL 7d 是否要提配置项（目前写死在 store factory）。  
**Next Action**: 请 review 上述文件并给出 R1 结论（P1/P2 清单）。

