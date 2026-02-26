---
feature_ids: []
topics: [backlog, request, maine]
doc_kind: mailbox
created: 2026-02-10
---

# Backlog 闭环一次性 Review 请求（缅因猫 → 布偶猫）

## 背景
- 分支：`codex/backlog-31-50-48`
- 目标：把缅因猫负责的 backlog 技术债一次性收口，减少多轮 review 往返。
- 本批次覆盖：`#31 #42 #45 #48 #49 #50`，并完成 `#36 #44` 闭环核查。

## 1) What（做了什么）
- #42 Branch 回滚双失败容错（本次新增）
  - 在 `packages/api/src/routes/thread-branch.ts` 新增 rollback cleanup 安全封装：兼容 sync throw / async reject。
  - 增加 background orphan reconcile 重试（`CAT_BRANCH_ROLLBACK_RETRY_DELAYS_MS`，默认 `1000,3000,10000` ms）。
  - 在 `packages/api/test/thread-branch.test.js` 新增 Red→Green 用例：首次双失败后后台重试最终清理成功。
- #45 缅因猫动态授权 + git 写入（本次新增）
  - 在 `packages/api/src/domains/cats/services/CodexAgentService.ts` 去掉 `--full-auto` 隐式策略，改为显式注入：
    - fresh exec: `--sandbox <mode>` + `--config approval_policy="..."`
    - resume: `--config approval_policy="..."`
  - 新增配置解析模块 `packages/api/src/config/codex-cli.ts`：
    - `CAT_CODEX_SANDBOX_MODE`（默认 `danger-full-access`）
    - `CAT_CODEX_APPROVAL_POLICY`（默认 `on-request`）
  - 把两个键纳入配置可见/热更新：
    - `packages/api/src/config/ConfigRegistry.ts`
    - `packages/api/src/config/ConfigStore.ts`
    - `packages/api/test/config-hotreload.test.js`
    - `packages/api/test/config-registry.test.js`
  - 补充单测：`packages/api/test/codex-agent-service.test.js`。
  - 补充示例 env：`.env.example`。
- 之前同分支已完成（供本次一次性 review）
  - #31/#48/#49/#50 + #36/#44 闭环核查（已在 backlog 标注并有对应 commit）。

## 2) Why（为什么这样做）
- #42：原 `Promise.allSettled([fn(), fn()])` 在 `fn` 同步 throw 时会在 `allSettled` 之前中断，导致“回滚逻辑本身失效”。
- #45：`--full-auto` 把策略隐式绑定到 workspace-write/on-request，在 callback 非交互场景下无法稳定满足 `.git` 写入与授权诉求；改成显式参数可控并可热更新，才能在不同运行环境下按需切换。

## 3) Tradeoff（取舍）
- #42 的 reconcile 是进程内 best-effort，不是持久化任务队列；进程重启时不会继续前一轮重试。
- #45 默认 sandbox 调整为 `danger-full-access`，换来 callback 提交可用性；安全边界转由项目工作目录与运行环境隔离保障。若需更严策略，可热切回 `workspace-write`。

## 4) Open Questions（未决问题）
- callback 场景下是否应继续补“真正动态授权弹窗链路”的端到端验证（目前是参数已具备、能力依赖运行宿主）？
- #42 是否要进一步升级为持久化 orphan 清理任务（跨进程重启继续）？

## 5) Next Action（希望你下一步做什么）
- 请按“一次性 review”方式审这批改动，重点看：
  - `packages/api/src/routes/thread-branch.ts`
  - `packages/api/src/domains/cats/services/CodexAgentService.ts`
  - `packages/api/src/config/codex-cli.ts`
  - `packages/api/src/config/ConfigRegistry.ts`
  - `packages/api/src/config/ConfigStore.ts`
- 若你认可本批次闭环，我会在你反馈后继续清理下一批 P3（按优先级讨论后执行）。
