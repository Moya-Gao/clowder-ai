# F32-b Phase 4: 布偶猫军团 — Multi-Variant Support

> **版本**: v2 (R21 review fix)
> **修订**: 修复执行顺序（4d 前置于 4c）、修正 breedId 前提、补 DeliveryCursorStore

## Context

Phase 3 made the frontend fully API-driven from `cat-config.json`. Now we need to support **multiple variants per breed** — e.g., opus-4.5, opus-4.6, and Sonnet all under the 布偶猫 family.

**The good news**: Backend session isolation, AgentRegistry, and routing already support multi-variant with zero code changes. Each variant with a unique `catId` in `cat-config.json` automatically gets isolated sessions, separate AgentService instances, and independent CLI processes. `CatConfig.breedId` 已存在且已被 `toAllCatConfigs()` 注入（`cat.ts:45`, `cat-config-loader.ts:167`）。

**The bad news**: The frontend has one critical blocker (`ChatMessage.tsx` hardcoded `CAT_STYLES`) and several disambiguation issues that prevent variants from being usable. 全量审计发现 4 个 P1 + 8 个 P2 硬编码位点必须修复。

**铲屎官's priorities**: Parallel comparison mode (compare 4.5 vs 4.6 responses side-by-side), adding Sonnet/4.5 as new variants, avatar assets coming later from art discussion.

---

## Phased Implementation

### Phase 4a: ChatMessage Dynamicization (Critical Blocker)

**Problem**: `ChatMessage.tsx` has a hardcoded `CAT_STYLES` map with only 3 entries (`opus`, `codex`, `gemini`). Any new catId (e.g. `opus-45`) renders as an unstyled blob — no avatar, no cat name, no background color.

**Files to modify**:
- `packages/web/src/components/ChatMessage.tsx` — replace `CAT_STYLES` lookup with `useCatData().getCatById()`
- `packages/web/src/hooks/useCatData.ts` — add `getCatById()` helper, extend `CatData` with `variantLabel?: string`, `isDefaultVariant: boolean`, `breedId: string`
- `packages/api/src/routes/cats.ts` — add `variantLabel`, `isDefaultVariant`, `breedId` to response
- `packages/api/src/config/cat-config-loader.ts` — compute `variantLabel` and `isDefaultVariant` in `toAllCatConfigs()`

**Key changes**:
```typescript
// ChatMessage.tsx: Replace static CAT_STYLES with dynamic lookup
const { getCatById } = useCatData();
const cat = message.catId ? getCatById(message.catId) : null;
// Derive bg, border, name, label, radius from cat.color.primary/secondary + cat.displayName
// Fallback: generic gray styling for unknown catId (defensive)
```

**Design note**: The per-cat `radius` (border-radius) and `font` styles in current `CAT_STYLES` are breed-level aesthetics. Map these via `breedId` → style mapping (small static map that only grows when a new breed is added, not when a new variant is added). `breedId` 已在 `CatConfig` 上可用（`cat.ts:45`），前端只需从 API 透传。

**Tests**: Existing `ChatMessage` tests + new test verifying unknown catId renders gracefully.

---

### Phase 4b: Variant Disambiguation

**Problem**: If two variants share `displayName` (e.g. both "布偶猫"), they look identical in mention menus, whisper targets, and status panels.

**Files to modify**:
- `packages/shared/src/types/cat-breed.ts` — add optional `variantLabel` to `CatVariant` schema
- `packages/api/src/config/cat-config-loader.ts` — propagate `variantLabel` to `CatConfig`, compute `isDefaultVariant`
- `packages/web/src/components/chat-input-options.ts` — show `variantLabel` in mention menu label
- `packages/web/src/components/ChatInput.tsx` — show `variantLabel` on whisper target chips
- `packages/web/src/components/ParallelStatusBar.tsx` — show `variantLabel` in status chips when multiple variants active
- `packages/web/src/components/RightStatusPanel.tsx` — same
- `packages/web/src/components/MobileStatusSheet.tsx` — same
- `packages/web/src/components/ThreadSidebar/CatSelector.tsx` — fix group header to use breed name (not `cats[0].displayName`)

**Key changes**:
```typescript
// chat-input-options.ts buildCatOptions:
label: cat.variantLabel
  ? `@${cat.displayName} (${cat.variantLabel})`
  : `@${cat.displayName}`,

// CatSelector group header: use breed-level name
// Currently: getCatById(cats[0].id)?.displayName → variant displayName
// Fix: derive breedDisplayName from the breed's name in config
```

**Config example** (`cat-config.json`):
```json
{
  "id": "opus-45",
  "catId": "opus-45",
  "variantLabel": "4.5",
  "displayName": "布偶猫",
  "mentionPatterns": ["@opus45", "@布偶4.5", "@宪宪4.5"],
  "provider": "anthropic",
  "defaultModel": "claude-opus-4-5-20250929"
}
```

Frontend shows: `@布偶猫 (4.5)` in mention menu, `布偶猫(4.5)` in whisper chips.

**Tests**: Unit tests for `buildCatOptions` with multi-variant data; integration test for variant label rendering.

---

### Phase 4d: Hardcoded Cat Reference Cleanup + Backend Fixes

> **⚠️ 必须在 Phase 4c 之前完成！** 否则新 variant 会立即踩雷。

**全量审计结果**：对整个代码库做了硬编码猫猫引用扫描，发现以下问题。

#### P1 — 必须在添加新 variant 之前修复

| 文件 | 问题 | 修复方案 |
|------|------|---------|
| `McpPromptInjector.ts:22` | `catId !== 'opus'` 硬编码，新 variant 如 `opus-45` 也会被当作非 Claude 猫注入 HTTP 指令 | 改为按 `catConfig.mcpSupport === true` 判断（config 已有此字段） |
| `TaskExtractor.ts:90,142` | catId allowlist `['opus','codex','gemini']`，新 catId 无法触发 task 提取 | 改为从 `catRegistry.getAllCatIds()` 动态获取 |
| `useChatCommands.ts:804,809-811,856-857` | 硬编码 regex `/opus\|codex\|gemini/`，新 catId 不被识别为合法 @mention | 改为从 `useCatData()` 动态构建 mention pattern |
| `useAuthorization.ts:6-8` | `CAT_LABELS` 硬编码映射 `{opus:'布偶猫',...}`，新 catId 无 label | 改为从 `useCatData().getCatById()` 获取 |
| `SystemPromptBuilder.ts:95` | `WORKFLOW_TRIGGERS` 按 catId 硬编码，新 variant 无 trigger | 改为按 `breedId` 查找（`CatConfig.breedId` 已存在），fallback: `WORKFLOW_TRIGGERS[catId] ?? WORKFLOW_TRIGGERS[breedId]` |

#### P2 — 应在 Phase 4 解决（不紧急但影响扩展性）

| 文件 | 问题 |
|------|------|
| `DeliveryCursorStore.ts:14-18` | `ALL_CATS` 硬编码 `['opus','codex','gemini']`，新 catId 的 cursor 不会被清理 |
| `cat-voices.ts:17-28` | 语音映射硬编码 3 个 catId |
| `cat-budgets.ts:18-22` | 预算硬编码 3 个 catId |
| `seal-thresholds.ts:18-37` | Seal 阈值硬编码 3 个 catId |
| `SocketManager.ts:19,96` | Socket 类型/处理只认 3 个 catId |
| `tts.ts:64` | TTS 路由只认 3 个 catId |
| `ClaudeAgentService.ts:83` | Claude agent 特殊逻辑绑定 catId |
| `RedisDraftStore.ts:151` | Draft key 使用硬编码 catId 列表 |

#### 其他后端修复

**Problem**: Non-default variant `personality` falls back to `''` instead of breed personality.

**Fix**: In `toAllCatConfigs()`, change `variant.personality ?? ''` to `variant.personality ?? breed.personality ?? ''` (where `breed.personality` would be a new breed-level field, or reuse the default variant's personality).

**Files**:
- `packages/api/src/domains/cats/services/agents/invocation/McpPromptInjector.ts`
- `packages/api/src/domains/cats/services/context/TaskExtractor.ts`
- `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts`
- `packages/api/src/domains/cats/services/stores/ports/DeliveryCursorStore.ts`
- `packages/web/src/hooks/useChatCommands.ts`
- `packages/web/src/hooks/useAuthorization.ts`
- `packages/api/src/config/cat-config-loader.ts`
- `packages/api/test/system-prompt-builder.test.js` — size guard test (must still pass!)
- Plus P2 files listed above

---

### Phase 4c: Schema Extension + First New Variant

> **前置条件**: Phase 4d 完成（硬编码已清理），新 variant 可以安全上线。

**Problem**: `avatar` and `color` are breed-level only — all variants of the same breed share identical visual identity. We need per-variant color (at minimum) so users can distinguish them visually.

**Files to modify**:
- `packages/shared/src/types/cat-breed.ts` — add optional `avatar`, `color` to `CatVariant`
- `packages/api/src/config/cat-config-loader.ts` — variant `avatar`/`color` override breed-level
- `cat-config.json` — add Sonnet variant to ragdoll breed (and optionally opus-4.5)

**Schema extension**:
```typescript
// CatVariant additions
interface CatVariant {
  // ... existing fields
  variantLabel?: string;       // "4.5", "Sonnet", etc.
  avatar?: string;             // override breed avatar
  color?: { primary: string; secondary: string }; // override breed colors
}
```

**`toAllCatConfigs()` change**:
```typescript
avatar: variant.avatar ?? breed.avatar,    // was: always breed.avatar
color: variant.color ?? breed.color,       // was: always breed.color
```

**First new variant in `cat-config.json`**:
```json
{
  "id": "opus-sonnet",
  "catId": "sonnet",
  "variantLabel": "Sonnet",
  "displayName": "布偶猫",
  "mentionPatterns": ["@sonnet", "@布偶sonnet"],
  "provider": "anthropic",
  "defaultModel": "claude-sonnet-4-6",
  "mcpSupport": true,
  "color": { "primary": "#B39DDB", "secondary": "#EDE7F6" },
  "cli": { "command": "claude", "outputFormat": "stream-json", "defaultArgs": ["--output-format", "stream-json", "--model", "claude-sonnet-4-6"] },
  "personality": "快速灵活，适合日常对话和轻量任务",
  "strengths": ["chat", "quick-tasks"],
  "contextBudget": { "maxPromptTokens": 150000, "maxContextTokens": 100000, "maxMessages": 200, "maxContentLengthPerMsg": 10000 }
}
```

**Tests**: Config loader tests with multi-variant breed; API endpoint test returning multiple variants.

---

### Phase 4e: Parallel Comparison Mode (New Feature)

**What**: Send the same prompt to 2+ cats simultaneously, show responses side-by-side for comparison.

**This is a larger feature that deserves its own design document.** Key considerations:
- Backend `route-parallel.ts` already supports multi-cat parallel invocation
- Frontend needs a new "comparison view" layout (split pane or card grid)
- UI to trigger comparison: button or `/compare @布偶4.5 @布偶4.6 <prompt>`
- Message display: group responses by prompt, show them adjacent
- Store model: messages tagged with same `invocationGroupId` for grouping

**Defer detailed design to a separate plan after 4a-4d are complete.**

---

## Execution Order (v2 — R21 fix)

```
Phase 4a (ChatMessage)      ← MUST be first, unblocks everything
   ↓
Phase 4b (Disambiguation)   ← makes multi-variant usable in UI
   ↓
Phase 4d (Hardcoded cleanup) ← 必须在 4c 前！清理硬编码让新 variant 安全
   ↓
Phase 4c (Schema + Variant)  ← adds Sonnet, makes it real
   ↓
Phase 4e (Comparison Mode)   ← separate design doc, last
```

> **R21 修正**：原方案 4c 在 4d 前，会导致新 variant 立即踩雷（McpPromptInjector、TaskExtractor 等拒绝未知 catId）。现在 4d 前置，确保硬编码清理完成后才添加新 variant。

---

## Worktree Plan (v2)

### Worktree 1: `cat-cafe-f32b-phase4-dynamic-messages` (Phase 4a + 4b)
- ChatMessage dynamicization
- Variant disambiguation in all components
- ~10 files modified, ~200 lines changed

### Worktree 2: `cat-cafe-f32b-phase4-hardcode-cleanup` (Phase 4d + 4c)
- **先 4d**：修复所有 P1/P2 硬编码引用
- **后 4c**：Schema extension + 第一个新 variant (Sonnet)
- ~15 files modified, ~300 lines changed

### Worktree 3: `cat-cafe-f32b-phase4-comparison` (Phase 4e)
- Separate design doc + implementation
- Estimated: needs its own plan

---

## Open Questions (v2)

~~OQ1 已关闭~~：`CatConfig.breedId` 已存在（`cat.ts:45`, `cat-config-loader.ts:167`, 有测试覆盖 `cat-config-loader.test.js:386`）。`SystemPromptBuilder` 可直接使用 `config.breedId` 查 `WORKFLOW_TRIGGERS`。

**OQ2**: P2 硬编码处理时机 — `cat-voices.ts`、`cat-budgets.ts`、`seal-thresholds.ts` 等 P2 问题，是在 Phase 4d 一起清还是推到后续？（它们不阻塞新 variant 基本可用，但如果有猫用到 voice/seal 功能会出问题。）
→ **倾向**：4d 一起清。既然动了就动彻底，避免 Sonnet 上线后再补。

**OQ3**: Sonnet variant 的 `mcpSupport: true` — Sonnet 跑 `claude` CLI，理论上支持 MCP。但 Sonnet context 比 Opus 小，MCP tool 描述可能占过多预算。是否应该默认关闭？

**OQ4**: `useChatCommands` 动态化范围 — 现在 hardcoded regex 判断 @mention，Phase 3 的 `buildCatOptions` 已有动态数据。但 `useChatCommands` 在 React hook 内部，要注入动态 cat 列表需要改调用签名。这个重构量可能不小——合理的边界在哪？

---

## Verification

1. `pnpm --filter @cat-cafe/web test` — frontend tests
2. `pnpm --filter @cat-cafe/api test` — backend tests (including config loader)
3. `pnpm --filter @cat-cafe/web build` — build check
4. `node --test packages/api/test/system-prompt-builder.test.js` — size guard
5. Manual: add Sonnet to `cat-config.json` → restart API → verify:
   - CatSelector shows Sonnet under 布偶猫家族
   - @sonnet triggers mention in ChatInput
   - Sonnet messages render with correct avatar/color in ChatMessage
   - Sonnet gets its own session (separate from opus)
   - Whisper to Sonnet works
6. Manual: parallel comparison (Phase 4e) — invoke same prompt to 2 cats, see side-by-side
