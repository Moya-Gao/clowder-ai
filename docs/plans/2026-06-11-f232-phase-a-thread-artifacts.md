# F232 Phase A — Thread Artifacts Panel 实施计划

**Feature:** F232 — `docs/features/F232-thread-artifacts-panel.md`
**Goal:** 点开 thread 即可浏览/筛选/搜索/跳转它产生的所有产物（图/文件/代码PR/语音），通过 `GET /api/threads/:threadId/artifacts` 聚合 API + 右侧抽屉面板。
**Acceptance Criteria（从 feat doc 逐条抄录，本 plan 全覆盖）:**
- AC-A1: `GET /api/threads/:threadId/artifacts` 返回该 thread 全部产物，按时间倒序，每项含 `type / name / catId / createdAt / sourceMessageId`。有 test 覆盖。
- AC-A2: 产物可按类型筛选（图/文件/代码·PR/语音/全部），各类计数与列表一致。
- AC-A3: thread 内产物名搜索（子串匹配），命中实时过滤。
- AC-A4: 每个产物可「跳回原消息」（sourceMessageId 锚点跳转）。
- AC-A5: 前端右侧抽屉面板，视觉对齐低保真设计稿（assets/F232/），图标用 inline SVG（禁 emoji），≤3 张实现截图 + 需求→截图映射表。
- AC-A6: 聚合查询有 Redis-backed 测试覆盖（in-memory 测不到索引/分页差异，LL feedback_inmemory）。

**Architecture cell:** hub-action-surface
**Map delta:** update required
**Map delta why:** F232 扩展 hub-action-surface，新增 thread 级产物聚合 endpoint（`GET /api/threads/:threadId/artifacts`）+ 右侧抽屉面板，把 thread 产出的 rich blocks/文件/PR surface 给用户——新扩展点 + 新 endpoint canonical anchor，需在 `cells/hub-action-surface.md` 的 canonical_features 加 F232 + scope 补 thread artifacts。
**Architecture:** 无状态聚合查询——route handler 套现有 `task-progress` 鉴权骨架（401/404/403），调独立纯函数聚合器从三源（messages 的 rich blocks + taskStore PR + threadMemory ledger 的 file）提取 → 复用 `artifact-tracking.ts` 的 `mergeLedger`/`classifyPath` 去重排序 → map 到共享 `ThreadArtifactDTO`。前端右侧抽屉复用现有 `rightPanelMode` 机制 + rich 渲染组件 + `scrollToMessage`。
**Tech Stack:** Fastify (api) / TypeScript / Redis stores / React + Tailwind (web) / node:test
**前端验证:** Yes — reviewer 必须用 Playwright/browser-preview 实测面板 + 跳转。

---

## Straight-Line Check (A→B, No Detour)

**终点 B（一句话）**：用户点开任意 thread 的「产物」抽屉，看到该 thread 全部产物的聚合清单，能筛选/搜索/跳回原消息。

**终态 schema（steps 围绕它建，非脚手架）** — 定义在 `packages/shared/src/types/thread-artifact.ts`：

```ts
export type ThreadArtifactType = 'image' | 'file' | 'code' | 'pr' | 'audio';

export interface ThreadArtifactDTO {
  type: ThreadArtifactType;
  name: string;            // 显示名（fileName / caption / filePath / PR 标题）
  catId: string | null;    // 哪只猫产生的
  createdAt: number;       // 产生/更新时间（排序键）
  sourceMessageId: string | null; // 跳回原消息锚点（AC-A4）
  url?: string;            // 图/文件/语音的资源 URL；PR 用外链；diff 无
  ref?: string;            // PR ref（org/repo#123）/ 文件路径，用于去重
}

export interface ThreadArtifactsResponse {
  threadId: string;
  artifacts: ThreadArtifactDTO[]; // 时间倒序
}
```

**NOT building（Phase A 不做）**：
- ❌ Redis 反向索引 `artifacts:thread:{id}`（OQ-2，引入需同步状态；Phase A 遍历 messages + ledger 够用，"无同步即无失同步"）
- ❌ 全局跨 thread 产物中心（Phase B）
- ❌ 产物预览/编辑（只列 + 跳转，预览复用既有 rich 渲染）
- ❌ `html_widget` / `interactive` / `card` block 收录（OQ-3，Phase A 只收 file/media_gallery/diff/audio）

**每步三问**：每个 Task 的产物都留在终态系统（extend-only）；每步可测（单测/路由测/Redis 测/截图）；删任一步都缺一块 AC 覆盖。

---

## Stateful Object Census（F229 Gate — 普查先行）

**普查结论：Phase A 无新增有生命周期的持久状态对象，不触发重型三件套。**

| 候选对象 | 是 lifecycle 状态机吗？ | 处置 |
|---------|----------------------|------|
| 产物聚合结果 | ❌ 纯投影（pure projection of messages+tasks+ledger，零新存储） | 无同步即无失同步，无需状态机 |
| 聚合 API | ❌ 无状态查询（读 → 聚合 → 返回，不写） | — |
| 前端面板 filter/search/list | ❌ ephemeral view state（不跨 session 持久） | 普通 React state |
| `threadMemory.recentArtifacts` ledger | ✅ 有 lifecycle —— 但 **owner 是 F148/SessionSealer，本 feat 只读不写** | 不碰其写路径，纯消费 |
| ~~反向索引 `artifacts:thread:{id}`~~ | 若引入则是需同步状态 | **Phase A 明确不引入**（见 NOT building） |

→ 产物列表是三源的纯投影，符合 skill「派生值用纯投影、禁止独立存储」。唯一 lifecycle 对象（ledger）的 owner 不是本 feat，只读消费。

---

## 数据源决策（技术 OQ 自决 — 可逆，回滚成本低，不升级 CVO）

| 产物类 | 来源 | 接口 |
|--------|------|------|
| 图/文件/diff/语音 | thread 消息的 rich blocks | `messageStore.getByThread(threadId, limit?, userId?)` → `msg.extra?.rich?.blocks` |
| PR | task store | `taskStore.listByThread(threadId)` filter `kind==='pr_tracking'` |
| 代码文件 | **threadMemory ledger（路线 B，MVP）** | `threadStore.getThreadMemory(threadId)` → `recentArtifacts` filter `type==='file'` |

**KD-A1（自决）**：filesTouched 走**路线 B（已聚合 ledger）**而非路线 A（枚举 sessions 遍历 digest 文件系统）。理由：已聚合、快、Redis 测简单、符合 F232 KD-3「复用 ledger 不新建采集」。代价：file 子集受 F148 cap=5 影响。**可逆**——OQ-2 thread 规模实测后若 file 覆盖不足，再升级路线 A（纯增量，不返工）。

---

## Task 1: 共享 DTO 类型

**Files:**
- Create: `packages/shared/src/types/thread-artifact.ts`（上方终态 schema）
- Modify: `packages/shared/src/types/index.ts`（export 新类型）

**Step 1:** 写 `thread-artifact.ts`（终态 schema 全文）。
**Step 2:** `pnpm --filter @cat-cafe/shared build`，预期编译通过。
**Step 3:** Commit `feat(F232): add ThreadArtifactDTO shared type`。

---

## Task 2: 聚合器纯函数（红→绿，核心）

**Files:**
- Create: `packages/api/src/domains/cats/services/agents/routing/thread-artifacts-aggregator.ts`
- Test: `packages/api/test/f232-thread-artifacts-aggregator.test.js`（模板 `f148-artifact-tracking.test.js`，node:test + `await import('../dist/...')`）
- Reuse from `./artifact-tracking.ts`: `mergeLedger`, `classifyPath`, `labelFromPath`（**不改其签名**，F148 route-helpers 在用）

**终态接口：**
```ts
interface AggregatorInput {
  messages: Array<{ id; catId; timestamp; extra?: { rich?: { blocks?: RichBlock[] } } }>;
  prTasks: Array<{ subjectKey; title; ownerCatId; status; updatedAt; sourceMessageId? }>;
  fileLedger: Array<{ ref; label; updatedAt; updatedBy }>; // threadMemory.recentArtifacts filter type=file
}
export function aggregateThreadArtifacts(input: AggregatorInput): ThreadArtifactDTO[]; // 时间倒序，去重
```

**Step 1（失败测）：** 测 5 个行为 — ① media_gallery block → N 个 image artifact（每 item 一条，name=caption??alt，url，sourceMessageId=msg.id）② file block → file artifact（name=fileName）③ diff block → code artifact（name=filePath，无 url）④ audio block → audio artifact ⑤ PR task → pr artifact（ref 从 subjectKey 去 `pr:` 前缀）。再测：三源 merge 后按 createdAt 倒序 + 同 ref 去重（mergeLedger）+ 空输入返回 []。
**Step 2:** `pnpm --filter @cat-cafe/api build && node --test packages/api/test/f232-thread-artifacts-aggregator.test.js` → 预期 FAIL（函数未定义）。
**Step 3（最小实现）：** rich block mapper（switch kind: media_gallery/file/diff/audio）+ PR mapper + file ledger mapper → 统一中间结构 → `mergeLedger` 去重 → `.sort((a,b)=>b.createdAt-a.createdAt)` → DTO。
**Step 4:** 重跑测试 → 预期 PASS。
**Step 5:** Commit `feat(F232): thread artifacts aggregator (pure fn) + unit tests`。

---

## Task 3: Route handler + in-memory 路由测

**Files:**
- Modify: `packages/api/src/routes/threads.ts`（加 GET handler，套 `task-progress` 鉴权骨架 :676-697）
- Modify: `packages/api/src/index.ts:2319`（若需 `threadStore.getThreadMemory` 已在 options，确认 messageStore/taskStore/threadStore 已传 — 是）
- Test: `packages/api/test/f232-thread-artifacts-endpoint.test.js`（模板 `threads-endpoint.test.js`，Fastify + app.inject）

**handler 骨架：**
```ts
app.get<{ Params: { threadId: string } }>('/api/threads/:threadId/artifacts', async (request, reply) => {
  const userId = resolveUserId(request, {});
  if (!userId) { reply.status(401); return { error: 'Identity required' }; }
  const { threadId } = request.params;
  const thread = await threadStore.get(threadId);
  if (!thread) { reply.status(404); return { error: 'Thread not found' }; }
  if (thread.createdBy !== userId && thread.createdBy !== 'system') { reply.status(403); return { error: 'Access denied' }; }
  const messages = await messageStore.getByThread(threadId, undefined, userId);
  const prTasks = (await taskStore.listByThread(threadId)).filter(t => t.kind === 'pr_tracking');
  const mem = await threadStore.getThreadMemory(threadId);
  const fileLedger = (mem?.recentArtifacts ?? []).filter(a => a.type === 'file');
  const artifacts = aggregateThreadArtifacts({ messages, prTasks, fileLedger });
  return { threadId, artifacts } satisfies ThreadArtifactsResponse;
});
```

**Step 1（失败测）：** app.inject GET `/api/threads/T1/artifacts` — 断 401（无 identity）/ 404（thread 不存在）/ 403（非 owner）/ 200（owner，artifacts 含注入的 rich block + PR，倒序）。
**Step 2:** build + `node --test .../f232-thread-artifacts-endpoint.test.js` → FAIL。
**Step 3:** 加 handler。
**Step 4:** 重跑 → PASS。
**Step 5:** Commit `feat(F232): GET /api/threads/:threadId/artifacts endpoint`。

---

## Task 4: Redis-backed 测试（AC-A6 硬门）

**Files:**
- Test: `packages/api/test/f232-thread-artifacts-redis.test.js`（模板 `redis-thread-store.test.js` + `helpers/redis-test-helpers.js`）

**为什么必须**（LL feedback_inmemory）：`RedisMessageStore.getByThread` 用 `msg:thread:{threadId}` Sorted Set + zrange + limit 分页；in-memory store 遍历全部天然 dense，掩盖索引/分页/排序差异。

**Step 1（失败测）：** `skip: redisIsolationSkipReason(process.env.REDIS_URL)`。before: createRedisClient + RedisMessageStore/RedisTaskStore/RedisThreadStore，写入 N 条带 rich block 的消息（跨分页边界）+ PR task + threadMemory。调聚合 → 断言**全部**带产物的消息都被遍历到（不漏分页尾部）、倒序正确。after: `cleanupPrefixedRedisKeys(redis, ['thread:*','threads:*','msg:*','task:*'])`。
**Step 2:** `pnpm --filter @cat-cafe/api test:redis`（自起隔离 Redis 6398，**禁碰 6399 圣域**）→ FAIL/绿循环。
**Step 3:** Commit `test(F232): redis-backed thread artifacts aggregation`。

---

## Task 5: 前端数据 hook

**Files:**
- Create: `packages/web/src/hooks/useThreadArtifacts.ts`（模板 `useGovernanceStatus.ts`：AbortController + apiFetch + {data,loading,refetch}）
- API: `apiFetch('/api/threads/${threadId}/artifacts')`（`utils/api-client.ts`，自带 credentials + 401 重试）

**Step 1:** 写 hook，返回 `{ artifacts: ThreadArtifactDTO[], loading, error, refetch }`。
**Step 2:** typecheck `pnpm --filter @cat-cafe/web check`。
**Step 3:** Commit `feat(F232): useThreadArtifacts hook`。

---

## Task 6: ArtifactsPanel 组件 + 挂载 + 跳转

**Files:**
- Create: `packages/web/src/components/ArtifactsPanel.tsx`（模板 `RightStatusPanel.tsx` 的 `<aside>` 结构）
- Modify: `packages/web/src/components/ChatContainer.tsx`（加 `rightPanelMode === 'artifacts'` 分支 + header 触发按钮）
- Reuse: `MediaGalleryBlock`/`FileBlock`/`DiffBlock`/`AudioBlock`（props `{block}`）；`scrollToMessage(sourceMessageId)`（`utils/scrollToMessage.ts`，零新代码）
- Icons: inline SVG（**禁 emoji**，KD-2；复用低保真 mockup 的 path：image/file/code/mic/search/arrow）

**面板内容（对齐 assets/F232/ 设计稿）：** 头部统计 + 搜索框（AC-A3 子串过滤）+ 类型筛选 chips（AC-A2）+ 时间倒序列表，每项 [类型图标] name + meta（cat·时间）+ 「跳回」按钮 `onClick={() => scrollToMessage(a.sourceMessageId)}`（AC-A4）。

**Step 1:** 写 ArtifactsPanel（筛选/搜索/列表/跳转）。
**Step 2:** ChatContainer 加 artifacts 分支 + header 按钮（inline SVG）。
**Step 3:** typecheck + `pnpm --filter @cat-cafe/web build`。
**Step 4:** browser-preview 渲染验证（AC-A5：≤3 截图 + 需求→截图映射）。
**Step 5:** Commit `feat(F232): ArtifactsPanel + right-drawer mount + jump-to-message`。

---

## Task 7: Architecture cell 更新（Map delta: update required）

**Files:**
- Modify: `docs/architecture/ownership/cells/hub-action-surface.md`（canonical_features 加 F232；scope 段补 "thread artifacts aggregation endpoint + panel"；canonical anchors 加 `packages/api/src/routes/threads.ts` 的 artifacts endpoint + `ArtifactsPanel.tsx`）
- Note: `thread-navigation` cell 文档加 cross-cell anchor 注明（artifacts endpoint 物理落在 threads.ts 但语义归 hub-action-surface）

**Step 1:** 更新 cell 文档。
**Step 2:** Commit `docs(F232): update hub-action-surface ownership cell`。

---

## Task 8: 质量门禁 + 自检

**Step 1:** `pnpm gate`（merge 硬门禁；worktree 注意 NODE_ENV，脚本内部自处理）。
**Step 2:** quality-gate skill 自检（愿景对照 assets/F232 设计稿 + spec AC 逐条）。
**Step 3:** 截图自检（feedback_self_check_before_deliver）— browser-preview 渲染面板，亲自看图标/筛选/搜索/跳转。

---

## Open Questions

| # | 问题 | 类型 | 状态 |
|---|------|------|------|
| OQ-A1 | filesTouched 走 ledger（B）还是 digest 遍历（A） | 技术（可逆） | ✅ 自决路线 B（MVP），见数据源决策 KD-A1 |
| OQ-A2 | thread 规模大时 ledger file 子集（cap5）是否够 | 技术 | ⬜ 规模实测后定；不够则升级路线 A（纯增量） |
| OQ-A3 | 收录是否扩到 html_widget/interactive | 技术 | ⬜ Phase A 只收 file/media/diff/audio + PR + file |

无价值 OQ → 不升级 CVO。

---

## 下一步

plan commit → `worktree`（隔离环境，Redis 6398）→ `tdd`（Task 1 起红绿循环）。
