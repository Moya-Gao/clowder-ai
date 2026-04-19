# Review Request: callback actor / scope helper 重构

Review-Target-ID: callback-scope-helpers
Branch: refactor/callback-scope-helpers

## What
新增 `packages/api/src/routes/callback-scope-helpers.ts`，把 callback 路由里已经重复出现的两类规则收成 helper：

- `deriveCallbackActor(record)`：统一从 verified invocation record 派生 actor
- `resolveBoundThreadScope(...)`：strict same-thread 写入 guard
- `resolveScopedThreadId(...)`：允许 cross-thread override，但要求目标 thread 归当前 user 所有

已接入：
- `callback-bootcamp-routes.ts`
- `callback-task-routes.ts`
- `callbacks.ts` 的 `post-message` cross-thread send
- `schedule.ts` 的 callback actor 派生复用

## Why
这组规则之前不是没做，而是散在各路由里 ad-hoc 重复。铲屎官刚明确点名："你下次真的写代码是绝对不会记得的，你还是现在做了吧？"

这次不是补洞，而是把已经存在且反复出现的 callback 规则收成可复用契约，防止未来再靠记忆手写。

## Original Requirements（必填）
> “如果标准是‘代码更统一、更好维护’… 你还是现在做了吧？”  
> “哪你喊你的队友来review呀？ 你这不是在main的吧？得开worktree”

- 来源：当前 thread（2026-04-18 13:18 / 13:33 用户原话）
- **请对照上面的摘录判断：这条 PR 是否真的把‘统一、可维护、别靠记忆’落成了代码，而不是只换了写法**

## Tradeoff
- **没动 `thread-context` 读权限语义**：那里还混着 `messageStore` user 过滤、play-mode 可见性、workflowSop 特殊暴露，贸然混进这刀会把“写路径重构”和“读权限改语义”绑在一起。
- **没引入新的 Bound/Scoped/Strict 行为**：这条 PR 只把现有行为显式化，不改变策略。

## Open Questions
1. 这波 helper 抽取的边界是否合适，还是还太早？
2. `thread-context` 要不要在后续单开一条 read-scope PR，还是维持现状？
3. `callback-task-routes` / `bootcamp` / `post-message` 现在统一到 helper 后，可读性是否真的提升，还是只是多了一层跳转？

## Next Action
请重点 review：
- helper 是否准确表达了当前 callback scope 规则
- 我有没有把原先路由里的行为改坏（尤其 cross-thread send / list-tasks / bootcamp strict same-thread）
- 如果你认为不值得抽，直接退回，不要客气

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/callback-scope-helpers/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规
- 这不是 feature/bug fix，而是 callback 路由重复规则的收束
- 目标是“把已存在且已验证的行为显式化”，不是引入新策略
- 当前改动明确不碰 `thread-context` 读权限语义

### 测试结果
- `pnpm --filter @cat-cafe/api run build` ✅
- `bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/callback-scope-helpers.test.js test/callback-routes.test.js test/callback-bootcamp-state.test.js test/callback-bootcamp-env-check.test.js test/integration/task-callback.test.js test/schedule-route.test.js` ✅
  - `156 passed, 0 failed`

### 相关文档
- Follow-up context: `cat-cafe#1255`（已关闭，route inventory 审计确认没有剩余安全洞）
- Recent authority fix: `cat-cafe#1253`
