# Review Request: F199 D-3b MCP Settings UI Parity

Review-Target-ID: f199
Branch: feat/f199-d3b-mcp-settings-ui

## What

Ports the MCP settings UI parity slice on top of the D-3a hardened backend:

- Replaces `/settings?s=mcp` from the old `HubCapabilityTab` wrapper with source-style MCP cards and controls.
- Adds restricted MCP-only `useCapabilityState`; no Skills write actions are exposed.
- Adds `capability-settings-ui`, `McpConfigModal`, form helpers, and modal section/panel split.
- Extends capability board payload with sanitized `mcpServer` details for MCP cards and edit forms.
- Adds read-only managed modal, external edit modal, add preview/install flow, fail-closed owner error rendering, and mobile SettingsShell fix.
- Adds visual proof, interaction recording, and User Visibility Disclosure under `docs/discussions/2026-05-13-f199-d3b-mcp-settings-ui-proof/`.

## Why

F199 D-3b is the UI parity half of D-3. D-3a already secured MCP write routes with owner-gate, redacted placeholder rejection, omitted secret preservation, and audit redaction. This slice restores the user-visible MCP settings workflow without reopening Skills writes or service lifecycle install controls.

## Original Requirements（必填）

> "图1是开源的 图2是我们的 这里能证明 你们只是调整了样式 其实很多东西都丢了？"
> "走 Phase D 用 -> 完整 backfill 7 个组件"

- 来源：`docs/features/F199-console-parity-backfill.md`
- **请对照上面的摘录判断交付物是否解决了铲屎官指出的 settings parity gap**

## Tradeoff

- Ported: MCP card list, per-cat toggles, project selector, managed read-only modal, external edit modal, add preview/install flow.
- Deliberately not ported: `InstallPreviewModal` and service lifecycle install/start/stop controls.
- Deliberately not wired: Skills toggle/uninstall/write actions from source `useCapabilityState`.
- Home behavior preserved: external MCP delete remains soft-delete and does not append `hard=true`.

## Architecture Ownership（必填）

Architecture cell: action-plane
Map delta: none
Why: This changes an existing Console settings capability-management surface and reuses the D-3a capability write routes; it does not add a new action owner, Store, Queue, Router, Adapter, Dispatcher, Binding, or capability orchestration cell.

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致
- 是否新建了并行 `Store` / `Queue` / `Router` / `Adapter` / `Dispatcher` / `Binding`
- MCP-only hook boundary 是否干净，没有把 Skills 写面带进 D-3b

## Open Questions

### 技术 OQ（给 reviewer）

- `mcpServer` board payload 的 sanitized detail 是否是 D-3b UI 所需的最小扩展，且没有把 raw secret 暴露到 response？
- `McpConfigModal` edit flow 对 `••••••` 的 omit-preserve 行为是否完整覆盖 env/header，不会把 mask 写回后端？
- fail-closed 403 文案是否足够清楚，尤其是本地 `DEFAULT_OWNER_USER_ID` 未配置时的用户行动路径？
- SettingsShell 移动端修复是否合理作为 D-3b proof 暴露出的局部响应式修复？
- Fallback layer self-check 是否接受：当前触发来自 optional MCP UI state，而不是错误坐标系堆补丁。

### 价值 OQ（给 CVO，如有）

无。D-3b 边界来自已批准的 F199 D-3 design memo：`InstallPreviewModal` 与 Skills writes 均不进入 F199。

## Next Action

请 Opus 4.7 review D-3b。重点看安全边界、source-style parity、proof matrix、移动端响应式修复，以及是否接受 fallback self-check。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f199/opus-47`
- Start Command: `pnpm review:start`（或在本 branch 运行 focused tests + production preview proof）
- Proof Ports: `home web=5132`, `api=3132`（worktree `start:direct` production preview，已停止）

## 自检证据

### Spec 合规

| Check | Status | Evidence |
|---|---|---|
| F199 D-3b scope | ✅ | MCP UI parity ported; `InstallPreviewModal` and Skills writes not ported |
| Secret response boundary | ✅ | `mcpServer` board payload sanitized via D-3a response sanitizer |
| Redacted edit preservation | ✅ | Web test asserts `••••••` is omitted from external edit payload |
| Owner fail-closed UX | ✅ | Web test + `owner-fail-closed.png`; screenshot uses intercepted 403 because local owner is configured |
| Visual proof matrix | ✅ | `docs/discussions/2026-05-13-f199-d3b-mcp-settings-ui-proof/assets/` |
| Interaction proof | ✅ | `assets/mcp-settings-flow.webm` |
| Mobile proof | ✅ | `assets/mobile-mcp-card-list.png` after SettingsShell responsive fix |
| File size guard | ✅ | New component files: 293 / 281 / 200 / 183 / 146 / 115 / 99 lines |
| Fallback self-check | ✅ | Triggered and documented in proof README; exits 0 |
| Architecture ownership | ✅ | `check:architecture-ownership` exits 0; no diff architecture noun mismatch |
| Root artifact guard | ✅ | root media/design artifact checks returned no output |

### 测试结果

```bash
node packages/web/scripts/run-with-node-env-test.mjs pnpm --filter @cat-cafe/web exec vitest run src/components/__tests__/mcp-manage-content.test.ts
# Test Files 1 passed; Tests 6 passed

pnpm --filter @cat-cafe/web test
# Test Files 405 passed; Tests 3055 passed

pnpm --filter @cat-cafe/web build
# exit 0

pnpm --filter @cat-cafe/api build
# exit 0

(cd packages/api && CAT_CAFE_DISABLE_SHARED_STATE_PREFLIGHT=1 bash ./scripts/with-test-home.sh node --import ./test/helpers/setup-cat-registry.js --test --test-timeout=60000 test/capabilities-route.test.js test/config/capabilities/capabilities-mcp-write-route.test.js)
# tests 48 pass, 0 fail

pnpm check
# exit 0

git diff --check origin/main...HEAD
# exit 0

node scripts/check-hotfix-pattern.mjs
# hotfix=false

node scripts/check-fallback-layers.mjs
# exit 0, self-check triggered and documented
```

### 相关文档

- Feature: `docs/features/F199-console-parity-backfill.md`
- Design memo: `docs/discussions/2026-05-13-f199-d3-capability-settings-design/README.md`
- D-3a proof: `docs/discussions/2026-05-13-f199-d3a-capability-write-hardening-proof/README.md`
- D-3b proof: `docs/discussions/2026-05-13-f199-d3b-mcp-settings-ui-proof/README.md`
