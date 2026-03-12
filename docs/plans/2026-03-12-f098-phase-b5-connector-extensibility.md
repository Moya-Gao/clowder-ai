# F098 Phase B.5 — Connector 可扩展设计 Implementation Plan

**Feature:** F098 — `docs/features/F098-callback-message-ux.md`
**Goal:** Connector theme 从 if-else 硬编码 → 注册表驱动，新平台零前端改动
**Acceptance Criteria:**
- AC-B5-1: `getConnectorTheme()` 从 `ConnectorDefinition` 注册表读取
- AC-B5-2: shared `ConnectorDefinition` 扩展 `tailwindTheme` 字段
- AC-B5-3: 未注册 connector fallback to default theme
- AC-B5-4: 新增平台只需在 `CONNECTOR_DEFINITIONS` 加一条
**Architecture:** shared types 扩展 → frontend 消费
**Tech Stack:** TypeScript (shared + web)

---

### Task 1: Extend shared ConnectorDefinition

**Files:** `packages/shared/src/types/connector.ts`

- Add `tailwindTheme` optional field to `ConnectorDefinition`
- Define `ConnectorTailwindTheme` interface: `{ avatar, label, labelLink, bubble }`
- Populate existing entries with Tailwind class strings
- Add `multi-mention-result` to registry (currently only in frontend if-else)
- `pnpm --filter @cat-cafe/shared build` after change

### Task 2: Refactor getConnectorTheme → registry-driven

**Files:** `packages/web/src/components/ConnectorBubble.tsx`

- Import `getConnectorDefinition` from shared
- Replace if-else chain with: lookup definition → use `tailwindTheme` → fallback to default
- Default theme stays as-is (for unknown/unregistered connectors)

### Task 3: Update tests

**Files:** `packages/web/src/components/__tests__/connector-bubble-theme.test.ts`

- Verify existing 6 tests still pass (behavior unchanged)
- Add test: unknown connector gets default theme
- Add test: `getConnectorDefinition` returns theme for registered connectors

### Task 4: Biome + type check
