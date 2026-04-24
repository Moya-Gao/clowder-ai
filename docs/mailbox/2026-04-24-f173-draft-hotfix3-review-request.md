---
feature_ids: [F173]
topics: [review-request, backend, draft-store, dup-bubble]
doc_kind: note
created: 2026-04-24
---

# Review Request: F173 Phase A hotfix3 — orphan draft bubble

Review-Target-ID: f173
Branch: fix/f173-draft-hotfix3
PR: https://github.com/zts212653/cat-cafe/pull/1379

## What

GET `/api/messages` 的 draft merge 现在只把仍有活跃 invocation record 的 draft 合进 timeline：

- 保留 `status=running` 且同 `threadId` / `userId` 的 draft
- 过滤 missing / terminal / cross-scope invocation draft
- 对确认的 orphan draft 做 best-effort 删除，避免下次 F5 又出现僵尸气泡

## Why

实机验收时出现新 dup-bubble 变种：一个 live stream bubble (`msg-{inv}-{cat}`) 和一个 Redis draft placeholder (`draft-{inv}`) 同时渲染。诊断确认 `draft-cc6df99a...` 对应 invocation 已经 `INVOCATION_NOT_FOUND`，但 `/api/messages` 仍把它从 draftStore 合进响应。

## Original Requirements（必填）

> "worktree 实施 Phase A hotfix3-》 我同意 按照你的判断走起"

- 来源：thread `thread_moay5tqumsbu17yr`，2026-04-24 12:12，铲屎官确认 hotfix3 实施
- 诊断真相源：`docs/bug-report/2026-04-24-f173-orphan-draft-bubble/bug-report.md`
- 请对照上面的摘录判断交付物是否解决了铲屎官看到的 orphan draft split-bubble 问题

## Tradeoff

我没有在这个 hotfix 里重做 DraftStore 生命周期，也没有把 draft 绑定到 invocation TTL。原因：当前 bug 是 read path 把已失效 draft 暴露给前端；最小正确修法是在 `/api/messages` 的 draft merge 门口做 invocation-alive 验证，并顺手清掉已确认 orphan 的 draft。生命周期统一留给 F173 Phase B/C 主线。

## Open Questions

1. `status === 'running'` 是否是 draft 可见性的正确边界？我认为 terminal invocation 不应该再有 live draft bubble。
2. read path 里 best-effort 删除 orphan draft 是否可接受？我限定为 confirmed orphan，且不因删除失败阻塞响应。
3. cross-scope record（同 invocationId 但 thread/user 不匹配）是否应直接过滤并删除当前 user/thread 的 draft？我倾向是安全默认，避免跨线程污染。

## Next Action

请 review PR #1379。若无 P1/P2，我会走 merge gate；若有 finding，我按 receive-review 处理。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f173/opus-47`
- Start Command: `pnpm review:start`
- Ports: not started; backend-only code review. If runtime review is needed, use `pnpm review:start` in the sandbox and record the allocated non-runtime ports.

## 自检证据

### Spec 合规

- F173 timeline 已同步 hotfix3 implementation 状态
- bug report 已同步 DraftStore orphan path status
- 无前端组件 diff；无当前 F173/draft/bubble `.pen` 设计稿匹配
- 根目录媒体/设计工件闸门：工作树 + 已提交差异均无命中

### 测试结果

```bash
pnpm --dir packages/api test:public
# 8363 pass / 0 fail / 2 skipped

pnpm --dir packages/api run build &&
CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash packages/api/scripts/with-test-home.sh \
  node --test --test-timeout=60000 \
  packages/api/test/draft-messages-merge.test.js \
  packages/api/test/messages-endpoint.test.js &&
pnpm biome check \
  packages/api/src/routes/messages.ts \
  packages/api/test/draft-messages-merge.test.js \
  --diagnostic-level=error
# build ok; 39/39 tests passed; biome ok
```

### 相关文档

- Feature: `docs/features/F173-frontend-message-pipeline-unification.md`
- Bug report: `docs/bug-report/2026-04-24-f173-orphan-draft-bubble/bug-report.md`

[砚砚/GPT-5.5🐾]
