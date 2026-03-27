# F142 Phase B: Skill 声明式命令注册 + 统一解析 — Implementation Plan

**Feature:** F142 — `docs/features/F142-connector-slash-commands.md`
**Goal:** Skills 可在 manifest.yaml 声明 slash commands，后端启动时自动发现注册，统一解析器处理 web + connector 命令路由，core 命令不可被覆盖
**Acceptance Criteria:**
- AC-B1: manifest.yaml 支持 slashCommands 字段，后端启动时通过 capabilities 链路自动发现并注册
- AC-B2: skill 命令不能覆盖 core 命令（冲突即拒绝注册 + 启动告警日志）
- AC-B3: slashCommands 字段 zod 校验：命令名正则 + 可选 subcommands、描述 ≤200 字符、纯文本
- AC-B4: skill 命令执行统一走服务端命令网关，禁止前端直拼 skill 调用
- AC-B5: 命令发现使用启动缓存 + 文件变更增量刷新，不在每次输入时触发磁盘扫描
- AC-B6: 统一命令解析器替换现有混合解析方式，有解析器单元测试
- AC-B7: slash 执行审计事件（命令名、surface、source、耗时、成功/失败）
- AC-B8: CommandDefinition 包含 surface + source 字段，/commands 按 surface 过滤
**Architecture:** Shared command types/parser/schema in `@cat-cafe/shared` → API-side `CommandRegistry` aggregates core + skill commands at startup → ConnectorCommandLayer uses unified parser for dispatch → new `GET /api/commands?surface=` endpoint → web imports shared parser + adds surface/source fields
**Tech Stack:** TypeScript, Zod, Fastify, node:test
**前端验证:** No — 本 Phase 无可视化 UI 变更，命令速查 tab 仅追加字段

---

## Not Building

- MCP 工具注册命令（OQ-1，Phase C+）
- Web useChatCommands 全面重写（仅替换解析函数 + 加 skill 路由出口）
- 动态运行时命令注册（仅启动时注册）
- Skill 命令管理 UI
- 任何具体 skill 的 slashCommands 声明（框架 ready，等 skill 作者添加）

## Terminal Schema

所有 Task 围绕这些终态类型构建：

```typescript
// @cat-cafe/shared — types/command.ts
type CommandSurface = 'web' | 'connector' | 'both';
type CommandSource = 'core' | 'skill' | 'mcp';

interface SlashCommandDefinition {
  name: string;              // '/help'
  usage: string;             // '/config set <key> <value>'
  description: string;       // ≤200 chars, plain text
  category: string;          // 'general' | 'memory' | ...
  surface: CommandSurface;
  source: CommandSource;
  subcommands?: string[];    // ['status', 'end'] → matches '/game status'
  skillId?: string;          // owning skill (source='skill' only)
}

interface ParsedCommand {
  name: string;              // matched command name
  subcommand?: string;       // 'status' for '/game status'
  args: string;              // remaining text
  raw: string;               // original input
  definition?: SlashCommandDefinition;
}

// @cat-cafe/shared — schemas/command.schema.ts
const ManifestSlashCommandSchema = z.object({
  name: z.string().regex(/^\/[a-z][a-z0-9-]{1,30}$/),
  usage: z.string().max(200).optional(),
  description: z.string().max(200).refine(
    s => !/<[^>]+>/.test(s), 'Must be plain text'
  ),
  surface: z.enum(['web', 'connector', 'both']).default('connector'),
  subcommands: z.array(z.string().regex(/^[a-z][a-z0-9-]{0,30}$/)).optional(),
});
```

---

## Task 1: Shared command types

**Files:**
- Create: `packages/shared/src/types/command.ts`
- Modify: `packages/shared/src/types/index.ts` (add export)

**Step 1:** Write type file with `CommandSurface`, `CommandSource`, `SlashCommandDefinition`, `ParsedCommand`

**Step 2:** Export from types/index.ts

**Step 3:** Verify build: `pnpm --filter @cat-cafe/shared build`

---

## Task 2: Shared zod schema for manifest slashCommands

**Files:**
- Create: `packages/shared/src/schemas/command.schema.ts`
- Modify: `packages/shared/src/schemas/index.ts` (add export)

**Step 1:** Write zod schema: `ManifestSlashCommandSchema`, `ManifestSlashCommandsSchema` (array)

**Validation rules:**
- name: `/^\/[a-z][a-z0-9-]{1,30}$/`
- description: max 200 chars, no HTML tags (`/<[^>]+>/` reject)
- surface: default `'connector'`
- subcommands: optional array of `[a-z][a-z0-9-]{0,30}`

**Step 2:** Export from schemas/index.ts

**Step 3:** Build: `pnpm --filter @cat-cafe/shared build`

---

## Task 3: Shared unified command parser

**Files:**
- Create: `packages/shared/src/command-parser.ts`
- Modify: `packages/shared/src/index.ts` (add export)

**Step 1:** Implement `parseCommand(input, commands[])`:
- Trim input, reject non-`/` prefix
- Sort definitions: subcommand definitions first (longest match)
- For each definition: check subcommands first, then base command
- Match = exact or followed by whitespace
- Return `ParsedCommand` or `null`

**Step 2:** Export `parseCommand` + `isCommandMatch` from root index

**Step 3:** Build: `pnpm --filter @cat-cafe/shared build`

---

## Task 4: Parser + schema tests (Red → Green)

**Files:**
- Create: `packages/api/test/command-parser.test.js`

Using API's `node:test` runner (shared has no test setup).

**Tests for parser:**
- Basic command: `/help` → `{ name: '/help', args: '' }`
- Command with args: `/new hello world` → `{ name: '/new', args: 'hello world' }`
- Subcommand match: `/signals search cats` → `{ name: '/signals', subcommand: 'search', args: 'cats' }`
- Longest match priority: `/config set key val` matches `/config set` (not `/config`)
- Non-command: `hello world` → `null`
- Unknown command: `/unknown` → `null` (not in registry)
- Case sensitivity: `/HELP` → `null` (commands are lowercase)

**Tests for schema:**
- Valid: `{ name: '/debug', description: 'Debug a bug' }` → passes
- Invalid name: `{ name: 'debug' }` → fails (no leading `/`)
- Invalid name: `{ name: '/Debug' }` → fails (uppercase)
- Too-long description: 201 chars → fails
- HTML injection: `{ description: '<script>alert(1)</script>' }` → fails
- Valid subcommands: `{ subcommands: ['status', 'end'] }` → passes
- Default surface: omitted → `'connector'`

**Run:** `node --test packages/api/test/command-parser.test.js`

---

## Task 5: CommandRegistry (API)

**Files:**
- Create: `packages/api/src/infrastructure/commands/CommandRegistry.ts`

**Responsibilities:**
- Constructor takes core `SlashCommandDefinition[]`
- `registerSkillCommands(skillId, commands[], log)` — core > skill priority, conflict → warning log + reject
- `listBySurface(surface)` — returns commands matching surface or `'both'`
- `getAll()`, `has(name)`, `get(name)`
- Pure in-memory (AC-B5: startup cache, no per-request I/O)

**Conflict rules:**
- Existing core + incoming skill with same name → reject + `log.warn`
- Existing skill + incoming skill with same name → reject + `log.warn`
- core > skill > mcp (AC-B2)

---

## Task 6: CommandRegistry tests (Red → Green)

**Files:**
- Create: `packages/api/test/command-registry.test.js`

**Tests:**
- Core commands registered on construction
- `listBySurface('connector')` returns connector + both
- `listBySurface('web')` returns web + both
- Skill command registered successfully
- Skill command conflicting with core → rejected + warning logged
- Skill command conflicting with other skill → rejected + warning logged
- `has()` and `get()` work for registered commands

**Run:** `node --test packages/api/test/command-registry.test.js`

---

## Task 7: Manifest slashCommands discovery

**Files:**
- Modify: `packages/api/src/routes/capabilities.ts`
  - Extend `SkillMeta` interface: add `slashCommands?: z.infer<typeof ManifestSlashCommandsSchema>`
  - In `parseManifestSkillMeta()`: extract and validate `slashCommands` field from manifest YAML per-skill entry
  - On validation failure: log warning, skip (don't block startup)

**Minimal diff to capabilities.ts** (~15 lines):
- Import `ManifestSlashCommandsSchema` from `@cat-cafe/shared`
- In the skill metadata loop, extract `entry.slashCommands` → validate → attach to `SkillMeta`

---

## Task 8: Manifest scanning test

**Files:**
- Add to: `packages/api/test/command-registry.test.js` (or create `packages/api/test/manifest-commands.test.js`)

**Tests:**
- Mock manifest.yaml with slashCommands → discovery returns commands
- Invalid command name in manifest → validation fails, command skipped, no crash
- Missing slashCommands field → graceful (empty array)

---

## Task 9: `GET /api/commands` endpoint

**Files:**
- Create: `packages/api/src/routes/commands.ts`
- Modify: `packages/api/src/routes/index.ts` (add barrel export)
- Modify: `packages/api/src/index.ts` (wire route)

**Route:**
```
GET /api/commands?surface=web|connector
```
Returns `{ commands: SlashCommandDefinition[] }`. No surface param → returns all.

**Wiring in index.ts:**
- `commandRegistry` created from core commands + discovered skill commands
- Passed to route as `opts.registry`

---

## Task 10: Route tests

**Files:**
- Create: `packages/api/test/commands-route.test.js`

**Tests:**
- `GET /api/commands` → returns all commands
- `GET /api/commands?surface=connector` → only connector + both
- `GET /api/commands?surface=web` → only web + both
- Response includes surface and source fields

---

## Task 11: ConnectorCommandLayer integration

**Files:**
- Modify: `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts`
  - Add `commandRegistry?: CommandRegistry` to deps
  - Use `parseCommand()` for dispatch instead of raw switch
  - Recognized skill commands → audit log + return `not-command` (let message flow to cat)
  - Add audit logging: command name, surface, source, duration, success/fail (AC-B7)
- Modify: `packages/api/src/infrastructure/connectors/connector-command-helpers.ts`
  - `buildCommandsList(registry?)` — if registry provided, populate from it; else fallback to hardcoded

**Key: the switch-case stays for core command handler routing** — the parser just replaces the raw `split + startsWith` logic. Skill commands get a new branch that logs + forwards.

---

## Task 12: Web CommandDefinition migration

**Files:**
- Modify: `packages/web/src/config/command-registry.ts`
  - Import `CommandSurface`, `CommandSource` from `@cat-cafe/shared`
  - Add `surface` and `source` fields to `CommandDefinition` interface
  - Tag all existing COMMANDS entries with `surface: 'both'` (web commands also usable in concept), `source: 'core'`
  - Exception: connector-category commands → `surface: 'connector'`

---

## Task 13: Integration + regression tests

**Files:**
- Modify: `packages/api/test/connector-command-layer.test.js` (add cases)

**Tests:**
- With registry dep: `/commands` output includes skill commands (mock a skill command in registry)
- Skill command recognized → audit logged → message forwarded
- Core command conflict: skill trying to register `/where` → rejected
- Existing core commands still work (regression from Phase A tests)

---

## Task 14: Build + gate

**Run:**
```bash
pnpm --filter @cat-cafe/shared build
pnpm lint
pnpm check
pnpm --filter @cat-cafe/api test
pnpm gate
```

---

## File Impact Summary

| Action | File | Est. Lines |
|--------|------|-----------|
| Create | `packages/shared/src/types/command.ts` | ~30 |
| Create | `packages/shared/src/schemas/command.schema.ts` | ~30 |
| Create | `packages/shared/src/command-parser.ts` | ~50 |
| Create | `packages/api/src/infrastructure/commands/CommandRegistry.ts` | ~70 |
| Create | `packages/api/src/routes/commands.ts` | ~30 |
| Create | `packages/api/test/command-parser.test.js` | ~120 |
| Create | `packages/api/test/command-registry.test.js` | ~100 |
| Create | `packages/api/test/commands-route.test.js` | ~60 |
| Modify | `packages/shared/src/types/index.ts` | +5 |
| Modify | `packages/shared/src/schemas/index.ts` | +5 |
| Modify | `packages/shared/src/index.ts` | +2 |
| Modify | `packages/api/src/routes/capabilities.ts` | +15 |
| Modify | `packages/api/src/routes/index.ts` | +1 |
| Modify | `packages/api/src/index.ts` | +20 |
| Modify | `packages/api/src/infrastructure/connectors/ConnectorCommandLayer.ts` | +30 |
| Modify | `packages/api/src/infrastructure/connectors/connector-command-helpers.ts` | +10 |
| Modify | `packages/web/src/config/command-registry.ts` | +15 |
| Modify | `packages/api/test/connector-command-layer.test.js` | +40 |

**New: ~490 lines across 8 files | Modified: ~143 lines across 10 files**
All new files under 200 lines. No existing file pushed over limits.
