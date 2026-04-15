---
doc_kind: review-request
feature_ids: [F162]
created: 2026-04-15
---

# Review Request: F162 Enterprise Action Toolkit — Phase A Infrastructure

Review-Target-ID: f162
Branch: feat/f162-enterprise-action

## What

WeChat Work 企业操作基础设施层：通过官方 CLI (`wecom-cli`) 驱动文档/表格/待办/会议创建。

核心变更（10 files, +1291 lines）：

1. **WeComCliExecutor** — CLI wrapper: execFile + MCP content wrapper unwrapping + errcode check
2. **WeComActionService** — 治理边界: createDoc / createSmartTable / createTodo / createMeeting / goldenChain + audit log
3. **callback route** — `POST /api/callbacks/wecom-action` with Zod discriminated union (5 actions)
4. **wecom-types.ts** — 全部 CLI 响应类型 + 资源句柄类型
5. **enterprise-workflow SKILL** — 指导猫猫解析意图 → 调 callback → 组合结果
6. **测试** — 7 unit (executor) + 7 unit (service) + 5 E2E (real CLI, golden chain verified)

## Why

WXG 面试 showcase（deadline 2026-04-17）。铲屎官要求"一句话 → 文档+表格+待办+会议 → 链接回贴"。
本 PR 是 Phase A 的基础设施层（AC-A1~A4），Day 2-3 做 runtime 集成和 demo 脚本。

架构遵循 ADR-029: ActionService + CliExecutor + callback route（不建 MCP server）。

## Original Requirements（必填）

> "那我们写一个企业微信 show case？"
> "meeting/table 才够打"
> "周四晚上 WXG 面试直接 show 给他们看"

- 来源：铲屎官 2026-04-14 群聊 + `docs/features/F162-enterprise-action-toolkit.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **不建 MCP server**（ADR-029 Decision 4）：wecom-cli 已有 MCP 格式输出，但 Cat Café 走 callback route 保审计链完整
- **goldenChain 串行不并行**：每个 API call 有顺序依赖（table 需 doc 先建好），且企微 API 限频
- **Smart table 5-step flow**：企微默认子表自带"文本"字段，必须 get→rename→add→records 才不留孤列

## Open Questions

1. **WeComCliExecutor timeout (30s)** — 企微 API 偶尔慢，30s 够不够？reviewer 可以关注
2. **MCP content wrapper 双模解析** — unwrapOutput 同时处理 wrapped 和 raw JSON，是否需要更严格的格式检测？
3. **callback route 没有 dry-run / idempotency** — spec 提了但 Phase A 未实现，是 P2 还是要提前？

## Next Action

请 @codex review 代码质量 + 安全性 + 架构合规（ADR-029）。
纯后端改动，无前端 UI，无需浏览器验证。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f162/codex`
- Start: `git clone --branch feat/f162-enterprise-action --single-branch . /tmp/cat-cafe-review/f162/codex && cd /tmp/cat-cafe-review/f162/codex && pnpm install`
- Unit tests: `cd packages/api && pnpm run build && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --test --test-timeout=60000 test/infrastructure/wecom-cli-executor.test.js test/infrastructure/wecom-action-service.test.js`
- E2E tests (需 wecom-cli credentials): `node --test test/infrastructure/wecom-e2e-golden-chain.test.js`
- Ports: N/A（纯后端，无需启动 web/api server）

## 自检证据

### Spec 合规

| AC | 状态 | 说明 |
|----|------|------|
| AC-A1 | ✅ | wecom-cli v0.1.5 安装配置，四命令全通 |
| AC-A2 | ✅ | createDoc/createSmartTable/createTodo/createMeeting 四方法 |
| AC-A3 | ✅ | audit log 结构化记录（service/method/params） |
| AC-A4 | ✅ | callback route 注册，Zod schema 校验 |

### 测试结果

```
pnpm test (unset REDIS_URL)  → 7901 passed, 0 failed ✅
F162 unit tests              → 14/14 passed ✅
pnpm lint                    → 0 errors ✅
pnpm check (biome)           → 0 errors ✅
pnpm -r --if-present build   → exit 0 ✅
E2E golden chain (real CLI)  → 4/4 resources created, ~17s ✅
```

### 根目录工件闸门

```
git status --short | rg media → 无 ✅
git diff --name-only origin/main...HEAD | rg media → 无 ✅
```

### 相关文档

- Feature: `docs/features/F162-enterprise-action-toolkit.md`
- ADR: `docs/decisions/029-external-tool-integration-strategy.md`
- Skill: `cat-cafe-skills/enterprise-workflow/SKILL.md`
