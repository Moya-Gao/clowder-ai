---
doc_type: review_request
feature_id: F211
status: review_requested
created: 2026-05-24
---

# Review Request: F211 Phase A1 Runtime Metadata

Review-Target-ID: f211
Branch: feat/f211-phase-a1-runtime-metadata
Implementation Head: `6a356f644` (`docs(F211): sync Phase A1 implementation anchors`)

## What

Implemented F211 Phase A1 only: the runtime-session metadata foundation for Antigravity session transparency.

- Added a runtime-session metadata schema and normalizers under `packages/api/src/domains/cats/services/runtime-session/`.
- Added in-memory and Redis sidecar stores with indexes by `sessionId`, `(runtime, runtimeSessionId)`, and lifecycle state.
- Added a read-only Antigravity legacy JSON import adapter for `data/antigravity-sessions.json`.
- Added an Antigravity Bridge / AgentService DI seam for the runtime store, without any production metadata writes.
- Updated F211 and identity-session architecture anchors.

Explicitly not included in A1:

- live cascade rotation
- `ephemeralSession: false`
- drain / reaper behavior
- transcript materialization
- removal of live JSON writes from the Bridge

Those stay in A2 by design.

## Why

F211 makes Antigravity runtime work visible to Cat Cafe's existing session memory system. A1 is the storage and import foundation so A2 can connect live cascade rotation without inventing a second session truth source.

## Original Requirements

> "我们的这个 antigravity 真的需要接入 session chain也好或者什么也好，就是他的 session 得是透明的？"
> "那你估计得把 201关闭 然后剩下的记录到 211 不过这个和209啥关系？209不是检索的吗？"

- 来源：2026-05-24 CVO thread; captured in `docs/features/F211-cross-runtime-session-transparency.md`
- 请对照上面的摘录判断 A1 是否正确建立 "F211 产生可见 session 证据；F209 只消费/检索证据" 的底座，而不是把检索问题和 runtime session truth 混在一起。

## Tradeoff

- Chose a sidecar runtime-session store instead of extending `SessionRecord.status`; this keeps canonical Session Chain lifecycle clean while F211 proves the runtime metadata model.
- Kept legacy JSON as read-only import input only. A1 does not dual-write JSON and sidecar metadata.
- Legacy import skips rows that cannot resolve a real host `SessionRecord` by `cliSessionId = cascadeId`; it never creates placeholder `legacy:*` sessions.
- Redis multi-index updates use Lua `EVAL` for the upsert path that changes runtime identity or lifecycle state; single-field updates do not imitate atomicity they do not need.
- A1 adds DI seams but no production observation hook. The first live production write belongs to A2.

## Architecture Ownership

Architecture cell: `identity-session` + `memory`
Map delta: update required
Why: Runtime session identity is upstream of memory retrieval: F211 records which external runtime session maps to which Cat Cafe session, while memory later consumes transcript/digest evidence from that session.

Please check:

- diff matches `Map delta: update required`
- runtime metadata remains a sidecar and does not pollute `SessionRecord.status`
- no new active-session truth source competes with SessionChainStore's `(catId, threadId)` active index
- Antigravity DI seam does not become a hidden production write path

## Open Questions

### 技术 OQ

1. Is the Redis keyPrefix handling inside Lua safe enough? Dynamic old index keys are built with the configured prefix because ioredis keyPrefix is not available inside script-created keys.
2. Is `model: unknown` acceptable for legacy JSON imports until A2 has trajectory/session_init identity evidence?
3. Is `getRuntimeSessionStoreForDiagnostics()` acceptable as an A1 test seam, given production still never writes runtime metadata from Bridge?

### 价值 OQ

无。CVO already decided F201 stays closed and F211 owns cross-runtime session transparency.

## Next Action

Please review Phase A1 implementation only. If approved, I will move to PR / merge-gate for A1, then start Phase A2 spec and TDD separately.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f211/{reviewer-handle}`
- Start Command: `pnpm review:start`
- Suggested ports: `web=auto`, `api=auto` via review sandbox; do not use 3001/3002/3011/3012/4111.

## 自检证据

### Spec 合规

- Phase A1 plan: `docs/plans/2026-05-24-f211-phase-a1-runtime-metadata.md`
- Feature: `docs/features/F211-cross-runtime-session-transparency.md`
- A1 does not claim AC-A1/A2/A3/A4/A8/A10.
- AC-A12 remains unclaimed because live Bridge JSON write removal is A2.

### 测试结果

```bash
pnpm --filter @cat-cafe/api run build
# pass

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/runtime-session-metadata.test.js \
  packages/api/test/runtime-session-store.test.js \
  packages/api/test/runtime-session-store-factory.test.js \
  packages/api/test/antigravity-runtime-session-import.test.js \
  packages/api/test/antigravity-bridge-session.test.js \
  packages/api/test/antigravity-cascade-health.test.js
# tests 35, pass 35, fail 0

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 REDIS_URL=redis://localhost:6398/15 CAT_CAFE_REDIS_TEST_ISOLATED=1 \
  bash packages/api/scripts/with-test-home.sh node --test packages/api/test/redis-runtime-session-store.test.js
# tests 3, pass 3, fail 0

CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh node --test \
  packages/api/test/antigravity-agent-service.test.js \
  packages/api/test/antigravity-agent-service-executors.test.js \
  packages/api/test/antigravity-registration.test.js \
  packages/api/test/antigravity-trace.test.js
# tests 29, pass 29, fail 0

pnpm check:features
# pass

pnpm check:architecture-ownership
# exit 0; existing repo warnings only, F211 diff OK

git diff --check
# pass
```

### 根目录工件闸门

```bash
git status --short | rg '^[ MADRCU?!]{2} [^/]+\.(png|jpg|jpeg|gif|webp|svg|pdf|mp4|mov|webm|fig|pen)$' || true
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpg|jpeg|gif|webp|svg|pdf|mp4|mov|webm|fig|pen)$' || true
# both empty
```

### Reviewer Focus

- `@opus47`: architecture boundary, A1/A2 split fidelity, sidecar store vs `SessionRecord.status`, Redis atomicity/keyPrefix, hidden production write risk.
- `@antig-opus`: Antigravity surface reality, legacy JSON import semantics, Bridge/AgentService behavior unchanged, no false claim of Session Chain visibility before A2.
