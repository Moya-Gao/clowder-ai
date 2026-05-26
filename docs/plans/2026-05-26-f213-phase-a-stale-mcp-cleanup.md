# F213 Phase A Implementation Plan — Stale MCP Config Cleanup Foundation

> **Plan revised 2026-05-26 post 砚砚 + cloud round-2 review**: AC-A1 marker
> collapsed (argsSuffix removed); AC-A4 changed from "delete L257 overlay" to
> "restore L4 dummy disabled override" (砚砚 P2). See "Post-review revision"
> subsection below.

**Feature:** F213 — `docs/features/F213-stale-mcp-config-cleanup.md`
**Goal (revised)**: 建立通用 deprecated managed server registry + L5 selective
cleanup helper + L4 dummy disabled override safety net + `writeCodexMcpConfig`
落地清理 + CodexAgentService 注入 L4 override（不再删除 L257 path）
**Acceptance Criteria** (Phase A 全部，post 砚砚/cloud review revision):
- AC-A1 (revised): `deprecated-managed-servers.ts` 创建 + `DEPRECATED_MANAGED_SERVERS`
  registry 含 `cat-cafe` entry + `knownManagedMarkers` (**只 echoLegacyShim**, argsSuffix
  removed per 砚砚 P1 — fork-path false positive)
- AC-A2 (revised): `isOurOwnedDeprecatedEntry` helper 实现 + 单测覆盖 ≥10 case
  含 fork-path-preserve regression guard
- AC-A3: `writeCodexMcpConfig` 加 cleanup logic + 单测覆盖 4 case (echoLegacyShim 删 /
  第三方保留 / **fork-like 保留 (regression guard)** / 无 legacy no-op)
- AC-A4 (revised): `CodexAgentService.ts` `buildCatCafeMcpConfigArgs` 注入 **L4
  dummy disabled override** (`command="echo"` + `args=["legacy-shim"]` + `enabled=false`)
  — runtime safety net for sources L5 cleanup cannot reach (user-level /
  `$CODEX_HOME` / system config). 删除旧 `CAT_CAFE_LEGACY_STATIC_SERVER_NAME` 常量
- AC-A5: codex-agent-service.test.js 主测试 assert **L4 dummy disabled override
  injection**（command="echo" + args=[legacy-shim] + enabled=false）+ no env.*
  overlay + no command="node"

**Architecture cell:** `capabilities/orchestrator` + `agents/cli-supervisor` (跨 2 cell)
**Map delta:** update required (ADR-036 已 amend 2026-05-26)
**Map delta why:** Legacy monolithic cell 退出 active managed matrix，改为 L5 startup-cleanup 路径；ADR-036 amendment block 已写入 (commit `c2eeb6382`)
**Architecture:** 新增独立 `deprecated-managed-servers.ts` 模块作为 single source of truth 注册过期 managed entry + marker 识别规则。`mcp-config-adapters.ts:writeCodexMcpConfig` 写入前调用 cleanup helper 扫 existing config 移除自家曾 managed 但当前 deprecated 的 entry，第三方未知保留。`CodexAgentService.ts` 删除 lookup helper（5 轮 P1 链遗产），因为 startup cleanup 让 legacy server 在 codex 加载前已消失，runtime 不再需要兜底。
**Tech Stack:** TypeScript / Node `node:test` / smol-toml / biome / pnpm workspace
**前端验证:** No (纯后端 config 处理)

---

## Straight-Line Check ✅

| 检查 | 结论 |
|------|------|
| Finish line 一句话 | Phase A 结束 = `cat-cafe` legacy entry 在 codex config 写入时被自动识别 + selective remove + log；CodexAgentService 不再含 lookup helper |
| Terminal schema 定义 | `DEPRECATED_MANAGED_SERVERS: readonly DeprecatedManagedServer[]` + `isOurOwnedDeprecatedEntry(serverName: string, entry: Record<string, unknown>): boolean` + 在 writer 内调用 |
| 步骤是否都进 final system | ✅ registry / helper / writer 调用 / CodexAgentService 简化全部 final code，不是 scaffolding |
| 删步骤的代价 | Task 1 (registry) 删 → 无法识别 / Task 2 (writer 调用) 删 → cleanup 不触发 / Task 3 (CodexAgent 简化) 删 → 残留死代码 + 5 测试 fail |
| 是否纯探索/Spike | ❌ Design Gate 已通过 (CVO + 砚砚 已签字 marker matching 规则 + cleanup 设计) |

---

## Type Definitions (Terminal Schema)

写在 `packages/api/src/config/capabilities/deprecated-managed-servers.ts`：

```typescript
/**
 * A marker that identifies an MCP server entry as our own (cat-cafe-managed)
 * deprecated entry. Used by `isOurOwnedDeprecatedEntry` to safely distinguish
 * "we wrote this in the past, now stale" from "user wrote this themselves
 * with the same server name" — third-party entries must be preserved.
 */
export type ManagedEntryMarker =
  | {
      kind: 'argsSuffix';
      /** Suffix matched against entry.args[0] after `\` → `/` normalize.
       *  E.g. `'packages/mcp-server/dist/index.js'` matches a path written by
       *  our own capability orchestrator pre-F193 Phase C split.
       */
      value: string;
    }
  | {
      kind: 'echoLegacyShim';
      /** Matches the workaround we documented in PR #1894 close comment:
       *  `command="echo"` + `args=["legacy-shim"]`.
       */
      commandValue: 'echo';
      argsValue: 'legacy-shim';
    };

export interface DeprecatedManagedServer {
  /** MCP server id (e.g. `'cat-cafe'`). */
  readonly serverName: string;
  /** Why this server is deprecated (human-readable, used in log.warn). */
  readonly reason: string;
  /** Markers that prove an entry was previously written by our own
   *  managed orchestrator (safe to remove). Third-party entries with the
   *  same `serverName` but no matching marker are preserved. */
  readonly knownManagedMarkers: readonly ManagedEntryMarker[];
  /** Optional: F number that introduced the deprecation (for traceability). */
  readonly deprecatedBy?: string;
}

export const DEPRECATED_MANAGED_SERVERS: readonly DeprecatedManagedServer[] = [
  {
    serverName: 'cat-cafe',
    reason: 'F193 Phase C split-only migration: replaced by 4 split servers (cat-cafe-collab, cat-cafe-memory, cat-cafe-signals, cat-cafe-limb)',
    knownManagedMarkers: [
      { kind: 'argsSuffix', value: 'packages/mcp-server/dist/index.js' },
      { kind: 'echoLegacyShim', commandValue: 'echo', argsValue: 'legacy-shim' },
    ],
    deprecatedBy: 'F193 Phase C / F213',
  },
];

/**
 * Decide whether the given `entry` (parsed from existing `mcp_servers.<id>`
 * config) was written by our own managed orchestrator and is now safe to
 * remove. Returns false (= preserve) for any third-party / unknown shape.
 */
export function isOurOwnedDeprecatedEntry(
  serverName: string,
  entry: Record<string, unknown>,
): boolean {
  const deprecated = DEPRECATED_MANAGED_SERVERS.find((d) => d.serverName === serverName);
  if (!deprecated) return false;
  // defensive — entry must be a non-null object with args field as string array
  if (typeof entry !== 'object' || entry === null) return false;
  const command = entry.command;
  const args = entry.args;
  if (!Array.isArray(args) || args.length === 0) return false;
  const firstArg = args[0];
  if (typeof firstArg !== 'string') return false;
  for (const marker of deprecated.knownManagedMarkers) {
    if (marker.kind === 'argsSuffix') {
      const normalized = firstArg.replace(/\\/g, '/');
      if (normalized.endsWith(marker.value)) return true;
    } else if (marker.kind === 'echoLegacyShim') {
      if (command === marker.commandValue && firstArg === marker.argsValue) return true;
    }
  }
  return false;
}
```

---

## Task 1: Create `deprecated-managed-servers.ts` registry + `isOurOwnedDeprecatedEntry` helper (AC-A1, AC-A2)

**Files:**
- Create: `packages/api/src/config/capabilities/deprecated-managed-servers.ts`
- Test: `packages/api/test/deprecated-managed-servers.test.js`

### Step 1.1: Write failing test for `isOurOwnedDeprecatedEntry`

```javascript
// packages/api/test/deprecated-managed-servers.test.js
import { strict as assert } from 'node:assert';
import test from 'node:test';
import {
  DEPRECATED_MANAGED_SERVERS,
  isOurOwnedDeprecatedEntry,
} from '@cat-cafe/api/config/capabilities/deprecated-managed-servers.js';

test('DEPRECATED_MANAGED_SERVERS contains cat-cafe entry with required markers', () => {
  const catCafe = DEPRECATED_MANAGED_SERVERS.find((d) => d.serverName === 'cat-cafe');
  assert.ok(catCafe, 'cat-cafe must be registered as deprecated');
  assert.ok(catCafe.reason.includes('F193 Phase C'), 'reason must reference F193 Phase C');
  const markerKinds = catCafe.knownManagedMarkers.map((m) => m.kind);
  assert.ok(markerKinds.includes('argsSuffix'), 'must have argsSuffix marker');
  assert.ok(markerKinds.includes('echoLegacyShim'), 'must have echoLegacyShim marker');
});

test('isOurOwnedDeprecatedEntry: matches argsSuffix (managed all-in-one binary path)', () => {
  const entry = {
    command: 'node',
    args: ['/Users/foo/cat-cafe/packages/mcp-server/dist/index.js'],
    enabled: true,
  };
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', entry), true);
});

test('isOurOwnedDeprecatedEntry: matches argsSuffix with Windows backslash path', () => {
  const entry = {
    command: 'node',
    args: ['C:\\Users\\foo\\cat-cafe\\packages\\mcp-server\\dist\\index.js'],
    enabled: true,
  };
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', entry), true);
});

test('isOurOwnedDeprecatedEntry: matches echoLegacyShim workaround', () => {
  const entry = { command: 'echo', args: ['legacy-shim'], enabled: false };
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', entry), true);
});

test('isOurOwnedDeprecatedEntry: preserves third-party cat-cafe entry (unknown binary)', () => {
  const entry = {
    command: '/usr/local/bin/my-custom-cat-cafe-server',
    args: ['/opt/third-party/cat-cafe-clone.js'],
    enabled: true,
  };
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', entry), false);
});

test('isOurOwnedDeprecatedEntry: preserves entry with missing args field', () => {
  const entry = { command: 'node', enabled: true };
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', entry), false);
});

test('isOurOwnedDeprecatedEntry: preserves entry with non-array args', () => {
  const entry = { command: 'node', args: 'not-an-array', enabled: true };
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', entry), false);
});

test('isOurOwnedDeprecatedEntry: preserves entry with non-string args[0]', () => {
  const entry = { command: 'node', args: [42], enabled: true };
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', entry), false);
});

test('isOurOwnedDeprecatedEntry: returns false for unregistered serverName', () => {
  const entry = { command: 'node', args: ['/foo/bar/packages/mcp-server/dist/index.js'] };
  assert.equal(isOurOwnedDeprecatedEntry('some-other-server', entry), false);
});

test('isOurOwnedDeprecatedEntry: returns false for null entry (defensive)', () => {
  assert.equal(isOurOwnedDeprecatedEntry('cat-cafe', null), false);
});
```

### Step 1.2: Run test to verify it fails (module not found)

```bash
cd packages/api
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" \
  --test test/deprecated-managed-servers.test.js
```
**Expected:** `ERR_MODULE_NOT_FOUND` for `deprecated-managed-servers.js`

### Step 1.3: Create `deprecated-managed-servers.ts` with terminal schema (above)

Copy the type definitions + registry + helper from the "Type Definitions" section above. File path: `packages/api/src/config/capabilities/deprecated-managed-servers.ts`.

### Step 1.4: Build + run test to verify pass

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build 2>&1 | tail -3
cd packages/api
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" \
  --test test/deprecated-managed-servers.test.js
```
**Expected:** 10/10 pass

### Step 1.5: biome + commit

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api exec biome check --write \
  src/config/capabilities/deprecated-managed-servers.ts \
  test/deprecated-managed-servers.test.js
git add packages/api/src/config/capabilities/deprecated-managed-servers.ts \
  packages/api/test/deprecated-managed-servers.test.js
git commit -m "feat(F213): deprecated-managed-servers registry + isOurOwnedDeprecatedEntry helper"
```

---

## Task 2: `writeCodexMcpConfig` cleanup integration (AC-A3)

**Files:**
- Modify: `packages/api/src/config/capabilities/mcp-config-adapters.ts:284-320`
- Modify: `packages/api/test/mcp-config-adapters.test.js`

### Step 2.1: Write failing tests in mcp-config-adapters.test.js

```javascript
// Add these tests in mcp-config-adapters.test.js, in the writeCodexMcpConfig describe block

test('writeCodexMcpConfig removes our owned deprecated cat-cafe entry (argsSuffix marker)', async () => {
  const file = join(dir, 'config.toml');
  await writeFile(
    file,
    [
      '[mcp_servers.cat-cafe]',
      'command = "node"',
      `args = ["/repo/packages/mcp-server/dist/index.js"]`,
      'enabled = true',
      '',
    ].join('\n'),
    'utf-8',
  );

  await writeCodexMcpConfig(file, [
    { name: 'cat-cafe-collab', command: 'node', args: ['/repo/packages/mcp-server/dist/collab.js'], enabled: true, source: 'cat-cafe' },
  ]);

  const data = parseToml(await readFile(file, 'utf-8'));
  assert.equal(data.mcp_servers['cat-cafe'], undefined, 'legacy cat-cafe entry must be removed by F213 cleanup');
  assert.ok(data.mcp_servers['cat-cafe-collab'], 'split server entry must still be written');
});

test('writeCodexMcpConfig removes echoLegacyShim workaround entry', async () => {
  const file = join(dir, 'config.toml');
  await writeFile(
    file,
    [
      '[mcp_servers.cat-cafe]',
      'command = "echo"',
      `args = ["legacy-shim"]`,
      'enabled = false',
      '',
    ].join('\n'),
    'utf-8',
  );

  await writeCodexMcpConfig(file, []);

  const data = parseToml(await readFile(file, 'utf-8'));
  assert.equal(data.mcp_servers?.['cat-cafe'], undefined, 'echoLegacyShim workaround must be cleaned up');
});

test('writeCodexMcpConfig preserves third-party cat-cafe entry (unknown binary)', async () => {
  const file = join(dir, 'config.toml');
  await writeFile(
    file,
    [
      '[mcp_servers.cat-cafe]',
      'command = "/opt/third-party/my-cat-cafe-server"',
      `args = ["/opt/third-party/main.js"]`,
      'enabled = true',
      '',
    ].join('\n'),
    'utf-8',
  );

  await writeCodexMcpConfig(file, []);

  const data = parseToml(await readFile(file, 'utf-8'));
  assert.ok(data.mcp_servers['cat-cafe'], 'third-party cat-cafe entry must be preserved (unknown marker)');
  assert.equal(data.mcp_servers['cat-cafe'].command, '/opt/third-party/my-cat-cafe-server');
});

test('writeCodexMcpConfig is no-op when existing config has no legacy cat-cafe entry', async () => {
  const file = join(dir, 'config.toml');
  await writeFile(
    file,
    [
      '[mcp_servers.unrelated-server]',
      'command = "node"',
      `args = ["/some/path.js"]`,
      '',
    ].join('\n'),
    'utf-8',
  );

  await writeCodexMcpConfig(file, []);

  const data = parseToml(await readFile(file, 'utf-8'));
  assert.ok(data.mcp_servers['unrelated-server'], 'unrelated server must be preserved');
  assert.equal(data.mcp_servers['cat-cafe'], undefined, 'no cat-cafe entry created');
});
```

### Step 2.2: Run tests, verify 4 new tests fail

```bash
cd packages/api
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" \
  --test --test-name-pattern="writeCodexMcpConfig (removes|preserves|is no-op)" \
  test/mcp-config-adapters.test.js
```
**Expected:** all 4 tests fail (cleanup logic not yet implemented; the "removes" assertions fail because legacy entry survives)

### Step 2.3: Implement cleanup in `writeCodexMcpConfig`

In `packages/api/src/config/capabilities/mcp-config-adapters.ts`:

Add import at top:
```typescript
import { DEPRECATED_MANAGED_SERVERS, isOurOwnedDeprecatedEntry } from './deprecated-managed-servers.js';
import { createModuleLogger } from '../../infrastructure/logger.js';

const log = createModuleLogger('mcp-config-adapters');
```

Inside `writeCodexMcpConfig` between L300 and L302, add cleanup pass:

```typescript
// F213 (2026-05-26): Selectively remove user-owned but deprecated managed entries
// before writing managed split servers. Identifies our own previously-managed
// entries via knownManagedMarkers; preserves third-party entries that happen to
// share the same server id.
for (const deprecated of DEPRECATED_MANAGED_SERVERS) {
  const entry = existingMcp[deprecated.serverName];
  if (!entry) continue;
  if (isOurOwnedDeprecatedEntry(deprecated.serverName, entry)) {
    delete existingMcp[deprecated.serverName];
    log.warn(
      { serverName: deprecated.serverName, reason: deprecated.reason, deprecatedBy: deprecated.deprecatedBy },
      `F213 cleanup: removed our previously-managed but deprecated mcp_servers.${deprecated.serverName} entry`,
    );
  } else {
    log.warn(
      { serverName: deprecated.serverName },
      `F213 cleanup: reserved server id '${deprecated.serverName}' shadowed by deprecation registry but kept as user-owned (no known managed marker matched)`,
    );
  }
}
```

### Step 2.4: Run tests, verify 4 pass + existing 52 still pass

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build 2>&1 | tail -3
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" \
  --test test/mcp-config-adapters.test.js
```
**Expected:** 56/56 pass (52 existing + 4 new)

### Step 2.5: biome + commit

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api exec biome check --write \
  src/config/capabilities/mcp-config-adapters.ts \
  test/mcp-config-adapters.test.js
git add packages/api/src/config/capabilities/mcp-config-adapters.ts \
  packages/api/test/mcp-config-adapters.test.js
git commit -m "feat(F213): writeCodexMcpConfig cleanup of deprecated managed cat-cafe entries"
```

---

## Task 3: Simplify `CodexAgentService.ts` — remove lookup helper layer (AC-A4, AC-A5)

**Files:**
- Modify: `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts` (lots of deletions)
- Modify: `packages/api/test/codex-agent-service.test.js` (lots of deletions)

### Step 3.1: Modify codex-agent-service.test.js — remove 4 legacy lookup tests + restore main test to round-0 baseline

Delete in `test/codex-agent-service.test.js`:
- The 4 legacy-lookup tests (added in PR #1894 rounds 1-4):
  - "injects legacy cat-cafe env overlay when user has [mcp_servers.cat-cafe] transport in ~/.codex/config.toml"
  - "injects legacy cat-cafe env overlay when project-level <workingDirectory>/.codex/config.toml has [mcp_servers.cat-cafe] transport (HOME empty)"
  - "injects legacy cat-cafe env overlay via ancestry ascent in monorepo subdir workingDirectory (cloud P1 round-3)"
  - "injects legacy cat-cafe env overlay when $CODEX_HOME/config.toml has [mcp_servers.cat-cafe] transport (HOME + project empty)"

In the main test "injects cat-cafe MCP config from runtime root, not thread workingDirectory":
- Remove `tmpHome`, `previousHome`, `previousCodexHome` variables
- Remove `process.env.HOME = tmpHome` / `delete process.env.CODEX_HOME` and their restores
- Keep the existing 3 assertions about legacy `cat-cafe.*` not being injected (round-3 final state):
  - `!args.includes('mcp_servers.cat-cafe.command="node"')`
  - `!args.some((arg) => arg.startsWith('mcp_servers.cat-cafe.args='))`
  - `!args.some((arg) => arg.startsWith('mcp_servers.cat-cafe.env.'))`

In `withWorkspaceEnv` helper:
- Remove HOME / CODEX_HOME / tmpHome isolation (F212 round-3 additions)
- Restore to original 2-env (ALLOWED_WORKSPACE_DIRS + CAT_CAFE_WORKSPACE_ROOT) form

### Step 3.2: Run codex test, verify failures (source still has helper)

```bash
cd packages/api
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" \
  --test --test-name-pattern="injects cat-cafe MCP config from runtime root" \
  test/codex-agent-service.test.js
```

**Expected on dev machine without legacy `~/.codex/config.toml`:** PASS (helper returns false, no env injection)
**Expected on dev machine WITH legacy `~/.codex/config.toml`:** FAIL (helper finds legacy → injects env → assertion fails)

Either way, the test currently depends on developer machine state. Once Step 3.3 removes the helper, behavior becomes deterministic.

### Step 3.3: Delete helper code from CodexAgentService.ts

In `packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts`:

Delete the following blocks (added in PR #1894 rounds 1-4):
- L18 import: `readFileSync` from `'node:fs'` (keep `existsSync`)
- L19 import: `homedir` from `'node:os'` (delete entire line)
- L22 import: `parse as parseToml` from `'smol-toml'` (delete entire line)
- L194 const: `CAT_CAFE_LEGACY_STATIC_SERVER_NAME = 'cat-cafe'`
- L198-234 block: `readLegacyCatCafeTransportFromFile` function + comment
- L236-265 block: `findLegacyCatCafeTransportInAncestry` + `userHasLegacyCatCafeTransportFromUserPaths` + `userHasLegacyCatCafeTransport` + `ANCESTRY_ASCENT_MAX_DEPTH`
- L255-257 block inside `buildCatCafeMcpConfigArgs`: the `if (userHasLegacyCatCafeTransport(workingDirectory)) { pushCatCafeMcpEnvConfig(args, CAT_CAFE_LEGACY_STATIC_SERVER_NAME, ...) }` block + its comment

Replace with a single comment at L255-ish position:

```typescript
// F213 (2026-05-26): Legacy `cat-cafe` server entries are removed by L5
// startup cleanup (see deprecated-managed-servers.ts + writeCodexMcpConfig).
// Per-invocation L4 no longer needs to overlay env for legacy — only split
// servers below get full transport + env. See ADR-036 amendment 2026-05-26.
```

### Step 3.4: Build + run codex test + verify deterministic pass

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build 2>&1 | tail -3
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" \
  --test test/codex-agent-service.test.js
```
**Expected:** all tests pass deterministically regardless of dev machine HOME / CODEX_HOME state (≈ 44 tests after deleting 4 legacy tests + main test variable cleanup)

### Step 3.5: biome + commit

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api exec biome check --write \
  src/domains/cats/services/agents/providers/CodexAgentService.ts \
  test/codex-agent-service.test.js
git add packages/api/src/domains/cats/services/agents/providers/CodexAgentService.ts \
  packages/api/test/codex-agent-service.test.js
git commit -m "feat(F213): remove CodexAgentService legacy lookup helper (replaced by L5 cleanup)"
```

---

## Task 4: Full regression + verification

### Step 4.1: Run relevant test suites

```bash
cd packages/api
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 bash ./scripts/with-test-home.sh \
  node --import "$(pwd)/test/helpers/setup-cat-registry.js" \
  --test \
    test/codex-agent-service.test.js \
    test/mcp-config-adapters.test.js \
    test/invoke-single-cat.test.js \
    test/deprecated-managed-servers.test.js
```
**Expected:** all pass (≈ 44 + 56 + 87 + 10 = 197 tests)

### Step 4.2: biome + lint on all touched files

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-f213-stale-mcp-cleanup  # worktree
env -u NODE_ENV pnpm --filter @cat-cafe/api exec biome check --diagnostic-level=error \
  src/config/capabilities/deprecated-managed-servers.ts \
  src/config/capabilities/mcp-config-adapters.ts \
  src/domains/cats/services/agents/providers/CodexAgentService.ts \
  test/deprecated-managed-servers.test.js \
  test/mcp-config-adapters.test.js \
  test/codex-agent-service.test.js
env -u NODE_ENV pnpm --filter @cat-cafe/api lint 2>&1 | tail -3
```
**Expected:** 0 errors

### Step 4.3: pnpm gate (latest main rebase + full test + lint + check)

```bash
env -u NODE_ENV REDIS_URL=redis://127.0.0.1:6398 pnpm gate
```
**Expected:** ✅ GATE PASSED on rebased HEAD

---

## Task 5: PR + request review

### Step 5.1: Push branch + open PR

```bash
git push -u origin feat/f213-stale-mcp-cleanup
gh pr create --title "feat(F213): Phase A — stale MCP config cleanup at startup + CodexAgentService simplification" \
  --body "$(cat <<'EOF'
## Summary

F213 Phase A — 实施 startup cleanup mechanism foundation。详见 \`docs/features/F213-stale-mcp-config-cleanup.md\` + plan \`docs/plans/2026-05-26-f213-phase-a-stale-mcp-cleanup.md\`。

PR #1894 5 轮 P1 链坐标系 reframe（CVO 2026-05-26 magic word「坐标系」+ 第二轮 reframe "过期 mcp 启动清理"），ADR-036 已 amend，本 PR 实施 Phase A。

## Phase A AC

- [ ] AC-A1: \`deprecated-managed-servers.ts\` registry
- [ ] AC-A2: \`isOurOwnedDeprecatedEntry\` 5+ case 单测
- [ ] AC-A3: \`writeCodexMcpConfig\` cleanup 4 case 单测
- [ ] AC-A4: CodexAgentService 删 5 helper + import + L257 调用
- [ ] AC-A5: codex-agent-service.test.js 删 4 legacy lookup test + 主测试 assert 不注入

## Test plan

- [x] deprecated-managed-servers.test.js: 10/10 pass
- [x] mcp-config-adapters.test.js: 56/56 pass (52 existing + 4 new)
- [x] codex-agent-service.test.js: ≈ 44/44 pass (49 - 4 legacy - 1 round-0 helper test)
- [x] invoke-single-cat.test.js: 87/87 pass (regression guard)
- [x] biome / lint / pnpm gate: clean

## Architecture cell

- \`capabilities/orchestrator\` (writer cleanup) + \`agents/cli-supervisor\` (helper deletion)
- Map delta: ADR-036 amendment block (commit \`c2eeb6382\`)

## Phase B/C/D/E

本 PR 仅 Phase A (Codex)。Phase B 将覆盖 Gemini / Claude / Antigravity / 其他 harness writer 应用同 cleanup helper。
EOF
)" --base main --head feat/f213-stale-mcp-cleanup
```

### Step 5.2: Register PR tracking + open review

```bash
# (via MCP) cat_cafe_register_pr_tracking('zts212653/cat-cafe', PR_NUM)
gh pr comment {PR_NUM} --body '@codex review'
```

### Step 5.3: @ 砚砚 cross-family review

```
@codex
F213 Phase A 实施完毕 — PR #{PR_NUM}（{commit}）。请 review，重点：
1. isOurOwnedDeprecatedEntry marker matching 的安全性（5 个单测 case 够吗）
2. writeCodexMcpConfig cleanup ordering（在 update managed entries 前清理，确保新写入不被误删）
3. CodexAgentService 简化无残留死代码
4. invoke-single-cat retry 路径未受影响
```

---

## Open Questions

| # | 问题 | 分类 | 处理 |
|---|------|------|------|
| OQ-P-1 | log.warn 用哪个 logger? `mcp-config-adapters.ts` 当前没 logger，要新加 import | 技术 | self-decide：复用 `createModuleLogger('mcp-config-adapters')`，跟其他模块一致 |
| OQ-P-2 | Phase B 多 harness writer 是同 PR 处理还是 follow-up PR？ | 价值（CVO 已签 "全做不留 follow-up"） | 本 PR Phase A 只 Codex；Phase B 另开 PR（拆 PR 维持 review 可管理度，符合 hotfix 防 scope creep 原则）。Phase B/C/D/E 在 F213 feat 内但分 PR 实施 |
| OQ-P-3 | `mcp-config-adapters.ts` 已有的 `existingMcp` 遍历是否够覆盖？要不要先 `Object.keys(existingMcp)` 再过 cleanup？ | 技术 | self-decide：for...of `DEPRECATED_MANAGED_SERVERS` 即可（registry 是有限小集合，O(n) cleanup）|
| OQ-P-4 | Cleanup log.warn 在测试时也会触发，是否要 silence？ | 技术 | self-decide：测试 logger 已 mock，warn 不污染 stdout |

---

## Don't Skip Checklist

- [ ] DRY: cleanup logic 只在 helper 里，writer 调用 helper（不复制 marker 检查到每个 writer）
- [ ] YAGNI: 不加 dry-run mode（OQ-3 在 feat doc，Phase E follow-up if needed）
- [ ] TDD: 每个 Task 都先红测后绿测
- [ ] Frequent commits: Task 1 / 2 / 3 各一个 commit（3 commits in Phase A，squash merge 时合一个）
- [ ] No fallback layers (F177 brake): cleanup helper 不加 try-catch 兜底之类——单一职责 (return boolean)
- [ ] No follow-up tails: Phase A scope 严格遵守 ACs（Phase B/C/D/E 在 feat doc 已规划，本 PR 不留 P2 / TD）
