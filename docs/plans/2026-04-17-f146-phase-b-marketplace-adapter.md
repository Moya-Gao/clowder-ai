# F146 Phase B: Marketplace Adapter Backend Implementation Plan

**Feature:** F146 — `docs/features/F146-mcp-marketplace-control-plane.md`
**Goal:** Unified search API that queries 4 ecosystems (Claude/Codex/OpenClaw/Antigravity), returns normalized results with trust level, and maps selected items to installPlan that feeds into Phase A's install endpoint.
**Acceptance Criteria:**
- AC-B1: 支持统一搜索接口返回 Codex/Claude/OpenClaw/Antigravity 四方结果
- AC-B2: 结果带 `trustLevel`，可按 `official/verified/community` 过滤
- AC-B3: 能把 marketplace 条目映射成可执行 `installPlan`
- AC-B4: 支持统一搜索接口返回 Antigravity 结果（至少 discovery + metadata）
- AC-B5: Antigravity 结果与现有 `pencil` resolver 策略保持一致性（不互相冲突）
- AC-B6: 统一搜索结果支持 `kind=pack`，可发现并安装来自 F129 产出的 Pack
**Architecture:** Per-ecosystem adapters behind a unified `MarketplaceAdapter` interface. `AdapterRegistry` dispatches search queries to all adapters in parallel, merges + sorts results. `InstallPlanBridge` converts marketplace `InstallPlan` → Phase A `McpInstallRequest` for the existing atomic install path. Each adapter normalizes its ecosystem's schema into a common `MarketplaceSearchResult` shape — no naive field copy, adapters act as schema-family-specific templates (KD-8).
**Tech Stack:** TypeScript, Fastify (route injection), node:test
**前端验证:** No — backend only, frontend in separate Phase

**Not Building:**
- Frontend marketplace UI (separate phase)
- Unified auth握手 (KD-12: each engine's native auth)
- Unified runtime (KD-10: search unified, install tiered)
- Cross-ecosystem dependency resolution
- Antigravity auto-install (read-only + manual handoff)
- Apps/Connectors/Hook install (display only, KD-10)

---

## Terminal Schema

```typescript
// packages/shared/src/types/marketplace.ts

import type { McpInstallRequest, McpTransport } from './capability.js';

export type MarketplaceEcosystem = 'claude' | 'codex' | 'openclaw' | 'antigravity';
export type ArtifactKind = 'mcp_server' | 'skill' | 'plugin' | 'bundle' | 'pack';
export type TrustLevel = 'official' | 'verified' | 'community';
export type InstallMode = 'direct_mcp' | 'delegated_cli' | 'manual_file' | 'manual_ui';

export interface MarketplaceSearchQuery {
  query: string;
  ecosystems?: MarketplaceEcosystem[];
  trustLevels?: TrustLevel[];
  artifactKinds?: ArtifactKind[];
  limit?: number;
}

export interface MarketplaceSearchResult {
  artifactId: string;
  artifactKind: ArtifactKind;
  displayName: string;
  ecosystem: MarketplaceEcosystem;
  sourceLocator: string;
  trustLevel: TrustLevel;
  componentSummary: string;
  transport?: McpTransport;
  versionRef?: string;
  publisherIdentity?: string;
}

export interface InstallPlan {
  mode: InstallMode;
  mcpEntry?: McpInstallRequest;
  delegatedCommand?: string;
  manualSteps?: string[];
  metadata?: {
    versionRef?: string;
    publisherIdentity?: string;
    toolSnapshotHash?: string;
  };
}

export interface MarketplaceAdapter {
  readonly ecosystem: MarketplaceEcosystem;
  search(query: MarketplaceSearchQuery): Promise<MarketplaceSearchResult[]>;
  buildInstallPlan(artifactId: string): Promise<InstallPlan>;
}
```

---

## Task 1: Shared Marketplace Types

**Files:**
- Create: `packages/shared/src/types/marketplace.ts`
- Modify: `packages/shared/src/types/index.ts` (add export)
- Test: `packages/api/test/marketplace-types.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Marketplace Types', () => {
  it('exports all marketplace types', async () => {
    const mod = await import('@cat-cafe/shared');
    assert.ok(mod.MARKETPLACE_ECOSYSTEMS);
    assert.ok(mod.ARTIFACT_KINDS);
    assert.ok(mod.TRUST_LEVELS);
    assert.ok(mod.INSTALL_MODES);
    assert.deepStrictEqual(mod.MARKETPLACE_ECOSYSTEMS, ['claude', 'codex', 'openclaw', 'antigravity']);
    assert.deepStrictEqual(mod.TRUST_LEVELS, ['official', 'verified', 'community']);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/shared && pnpm build && cd ../api && pnpm build && node --test test/marketplace-types.test.js`
Expected: FAIL — module has no exported member MARKETPLACE_ECOSYSTEMS

**Step 3: Implement types**

Create `packages/shared/src/types/marketplace.ts` with the Terminal Schema above, plus runtime constants:

```typescript
export const MARKETPLACE_ECOSYSTEMS: MarketplaceEcosystem[] = ['claude', 'codex', 'openclaw', 'antigravity'];
export const ARTIFACT_KINDS: ArtifactKind[] = ['mcp_server', 'skill', 'plugin', 'bundle', 'pack'];
export const TRUST_LEVELS: TrustLevel[] = ['official', 'verified', 'community'];
export const INSTALL_MODES: InstallMode[] = ['direct_mcp', 'delegated_cli', 'manual_file', 'manual_ui'];
```

Add `export * from './marketplace.js';` to `packages/shared/src/types/index.ts`.

**Step 4: Rebuild shared + api, run test**

Run: `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build && cd packages/api && node --test test/marketplace-types.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/shared/src/types/marketplace.ts packages/shared/src/types/index.ts packages/api/test/marketplace-types.test.js
git commit -m "feat(F146-B): add shared marketplace types — adapter interface + search/install plan [布偶猫🐾]"
```

---

## Task 2: Adapter Registry

The registry holds adapters, fans out search queries, merges results, applies trust/kind filters.

**Files:**
- Create: `packages/api/src/marketplace/adapter-registry.ts`
- Test: `packages/api/test/marketplace/adapter-registry.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('AdapterRegistry', () => {
  let AdapterRegistry;

  beforeEach(async () => {
    ({ AdapterRegistry } = await import('../../dist/marketplace/adapter-registry.js'));
  });

  it('registers and retrieves adapters', () => {
    const registry = new AdapterRegistry();
    const mockAdapter = {
      ecosystem: 'claude',
      search: async () => [],
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    };
    registry.register(mockAdapter);
    assert.strictEqual(registry.get('claude'), mockAdapter);
    assert.strictEqual(registry.get('codex'), undefined);
  });

  it('searches across all registered adapters', async () => {
    const registry = new AdapterRegistry();
    registry.register({
      ecosystem: 'claude',
      search: async () => [{ artifactId: 'mcp-a', ecosystem: 'claude', trustLevel: 'official', artifactKind: 'mcp_server', displayName: 'A', sourceLocator: 'https://a', componentSummary: 'A tool' }],
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    });
    registry.register({
      ecosystem: 'codex',
      search: async () => [{ artifactId: 'mcp-b', ecosystem: 'codex', trustLevel: 'community', artifactKind: 'mcp_server', displayName: 'B', sourceLocator: 'https://b', componentSummary: 'B tool' }],
      buildInstallPlan: async () => ({ mode: 'delegated_cli' }),
    });

    const results = await registry.search({ query: 'test' });
    assert.strictEqual(results.length, 2);
  });

  it('filters by ecosystem', async () => {
    const registry = new AdapterRegistry();
    registry.register({
      ecosystem: 'claude',
      search: async () => [{ artifactId: 'a', ecosystem: 'claude', trustLevel: 'official', artifactKind: 'mcp_server', displayName: 'A', sourceLocator: '', componentSummary: '' }],
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    });
    registry.register({
      ecosystem: 'codex',
      search: async () => [{ artifactId: 'b', ecosystem: 'codex', trustLevel: 'official', artifactKind: 'mcp_server', displayName: 'B', sourceLocator: '', componentSummary: '' }],
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    });

    const results = await registry.search({ query: 'test', ecosystems: ['claude'] });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].ecosystem, 'claude');
  });

  it('filters by trustLevel', async () => {
    const registry = new AdapterRegistry();
    registry.register({
      ecosystem: 'claude',
      search: async () => [
        { artifactId: 'a', ecosystem: 'claude', trustLevel: 'official', artifactKind: 'mcp_server', displayName: 'A', sourceLocator: '', componentSummary: '' },
        { artifactId: 'b', ecosystem: 'claude', trustLevel: 'community', artifactKind: 'mcp_server', displayName: 'B', sourceLocator: '', componentSummary: '' },
      ],
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    });

    const results = await registry.search({ query: 'test', trustLevels: ['official'] });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].trustLevel, 'official');
  });

  it('filters by artifactKind', async () => {
    const registry = new AdapterRegistry();
    registry.register({
      ecosystem: 'claude',
      search: async () => [
        { artifactId: 'a', ecosystem: 'claude', trustLevel: 'official', artifactKind: 'mcp_server', displayName: 'A', sourceLocator: '', componentSummary: '' },
        { artifactId: 'b', ecosystem: 'claude', trustLevel: 'official', artifactKind: 'plugin', displayName: 'B', sourceLocator: '', componentSummary: '' },
      ],
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    });

    const results = await registry.search({ query: 'test', artifactKinds: ['mcp_server'] });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].artifactKind, 'mcp_server');
  });

  it('respects limit', async () => {
    const registry = new AdapterRegistry();
    const items = Array.from({ length: 20 }, (_, i) => ({
      artifactId: `mcp-${i}`, ecosystem: 'claude', trustLevel: 'official',
      artifactKind: 'mcp_server', displayName: `Tool ${i}`, sourceLocator: '', componentSummary: '',
    }));
    registry.register({ ecosystem: 'claude', search: async () => items, buildInstallPlan: async () => ({ mode: 'direct_mcp' }) });

    const results = await registry.search({ query: 'test', limit: 5 });
    assert.strictEqual(results.length, 5);
  });

  it('handles adapter errors gracefully', async () => {
    const registry = new AdapterRegistry();
    registry.register({
      ecosystem: 'claude',
      search: async () => { throw new Error('network error'); },
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    });
    registry.register({
      ecosystem: 'codex',
      search: async () => [{ artifactId: 'b', ecosystem: 'codex', trustLevel: 'official', artifactKind: 'mcp_server', displayName: 'B', sourceLocator: '', componentSummary: '' }],
      buildInstallPlan: async () => ({ mode: 'direct_mcp' }),
    });

    const results = await registry.search({ query: 'test' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].ecosystem, 'codex');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/marketplace/adapter-registry.test.js`
Expected: FAIL — cannot find module

**Step 3: Implement AdapterRegistry**

```typescript
// packages/api/src/marketplace/adapter-registry.ts
import type { MarketplaceAdapter, MarketplaceSearchQuery, MarketplaceSearchResult } from '@cat-cafe/shared';

export class AdapterRegistry {
  private adapters = new Map<string, MarketplaceAdapter>();

  register(adapter: MarketplaceAdapter): void {
    this.adapters.set(adapter.ecosystem, adapter);
  }

  get(ecosystem: string): MarketplaceAdapter | undefined {
    return this.adapters.get(ecosystem);
  }

  async search(query: MarketplaceSearchQuery): Promise<MarketplaceSearchResult[]> {
    const targetAdapters = query.ecosystems
      ? [...this.adapters.values()].filter(a => query.ecosystems!.includes(a.ecosystem))
      : [...this.adapters.values()];

    const settled = await Promise.allSettled(
      targetAdapters.map(a => a.search(query))
    );

    let results: MarketplaceSearchResult[] = [];
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        results.push(...result.value);
      }
    }

    if (query.trustLevels?.length) {
      results = results.filter(r => query.trustLevels!.includes(r.trustLevel));
    }
    if (query.artifactKinds?.length) {
      results = results.filter(r => query.artifactKinds!.includes(r.artifactKind));
    }
    if (query.limit && results.length > query.limit) {
      results = results.slice(0, query.limit);
    }

    return results;
  }

  async buildInstallPlan(ecosystem: string, artifactId: string) {
    const adapter = this.adapters.get(ecosystem);
    if (!adapter) throw new Error(`No adapter for ecosystem: ${ecosystem}`);
    return adapter.buildInstallPlan(artifactId);
  }
}
```

**Step 4: Rebuild and run test**

Run: `cd packages/api && pnpm build && node --test test/marketplace/adapter-registry.test.js`
Expected: PASS (all 6 tests)

**Step 5: Commit**

```bash
git add packages/api/src/marketplace/adapter-registry.ts packages/api/test/marketplace/adapter-registry.test.js
git commit -m "feat(F146-B): AdapterRegistry — fan-out search + trustLevel/kind filter [布偶猫🐾]"
```

---

## Task 3: Claude Adapter

First ecosystem adapter. Claude MCP registry uses JSON format with `mcpServers` entries.

**Files:**
- Create: `packages/api/src/marketplace/adapters/claude-adapter.ts`
- Test: `packages/api/test/marketplace/adapters/claude-adapter.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('ClaudeMarketplaceAdapter', () => {
  let ClaudeMarketplaceAdapter;

  beforeEach(async () => {
    ({ ClaudeMarketplaceAdapter } = await import('../../../dist/marketplace/adapters/claude-adapter.js'));
  });

  it('has ecosystem = claude', () => {
    const adapter = new ClaudeMarketplaceAdapter({ catalogLoader: async () => [] });
    assert.strictEqual(adapter.ecosystem, 'claude');
  });

  it('searches catalog by query keyword match', async () => {
    const catalog = [
      { id: 'filesystem', name: 'Filesystem', description: 'Read and write files', command: 'npx', args: ['-y', '@anthropic/mcp-filesystem'], trustLevel: 'official', publisher: 'anthropic' },
      { id: 'github', name: 'GitHub', description: 'GitHub API integration', command: 'npx', args: ['-y', '@anthropic/mcp-github'], trustLevel: 'official', publisher: 'anthropic' },
      { id: 'custom-tool', name: 'Custom Tool', description: 'A community tool', command: 'node', args: ['server.js'], trustLevel: 'community', publisher: 'user123' },
    ];
    const adapter = new ClaudeMarketplaceAdapter({ catalogLoader: async () => catalog });

    const results = await adapter.search({ query: 'file' });
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].artifactId, 'filesystem');
    assert.strictEqual(results[0].ecosystem, 'claude');
    assert.strictEqual(results[0].trustLevel, 'official');
    assert.strictEqual(results[0].artifactKind, 'mcp_server');
  });

  it('builds direct_mcp install plan for stdio MCP', async () => {
    const catalog = [
      { id: 'filesystem', name: 'Filesystem', description: 'Read and write files', command: 'npx', args: ['-y', '@anthropic/mcp-filesystem'], trustLevel: 'official', publisher: 'anthropic' },
    ];
    const adapter = new ClaudeMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('filesystem');
    assert.strictEqual(plan.mode, 'direct_mcp');
    assert.ok(plan.mcpEntry);
    assert.strictEqual(plan.mcpEntry.id, 'filesystem');
    assert.strictEqual(plan.mcpEntry.command, 'npx');
    assert.deepStrictEqual(plan.mcpEntry.args, ['-y', '@anthropic/mcp-filesystem']);
  });

  it('builds direct_mcp install plan for streamableHttp MCP', async () => {
    const catalog = [
      { id: 'remote-api', name: 'Remote API', description: 'Remote service', url: 'https://mcp.example.com', transport: 'streamableHttp', trustLevel: 'verified', publisher: 'example' },
    ];
    const adapter = new ClaudeMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('remote-api');
    assert.strictEqual(plan.mode, 'direct_mcp');
    assert.strictEqual(plan.mcpEntry.url, 'https://mcp.example.com');
    assert.strictEqual(plan.mcpEntry.transport, 'streamableHttp');
  });

  it('throws for unknown artifactId', async () => {
    const adapter = new ClaudeMarketplaceAdapter({ catalogLoader: async () => [] });
    await assert.rejects(() => adapter.buildInstallPlan('nonexistent'), /not found/);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `cd packages/api && pnpm build && node --test test/marketplace/adapters/claude-adapter.test.js`
Expected: FAIL

**Step 3: Implement ClaudeMarketplaceAdapter**

```typescript
// packages/api/src/marketplace/adapters/claude-adapter.ts
import type { InstallPlan, MarketplaceAdapter, MarketplaceSearchQuery, MarketplaceSearchResult } from '@cat-cafe/shared';

export interface ClaudeCatalogEntry {
  id: string;
  name: string;
  description: string;
  command?: string;
  args?: string[];
  url?: string;
  transport?: 'stdio' | 'streamableHttp';
  env?: Record<string, string>;
  headers?: Record<string, string>;
  trustLevel: 'official' | 'verified' | 'community';
  publisher: string;
  versionRef?: string;
}

export interface ClaudeAdapterOptions {
  catalogLoader: () => Promise<ClaudeCatalogEntry[]>;
}

export class ClaudeMarketplaceAdapter implements MarketplaceAdapter {
  readonly ecosystem = 'claude' as const;
  private catalogLoader: () => Promise<ClaudeCatalogEntry[]>;
  private cachedCatalog: ClaudeCatalogEntry[] | null = null;

  constructor(options: ClaudeAdapterOptions) {
    this.catalogLoader = options.catalogLoader;
  }

  private async getCatalog(): Promise<ClaudeCatalogEntry[]> {
    if (!this.cachedCatalog) {
      this.cachedCatalog = await this.catalogLoader();
    }
    return this.cachedCatalog;
  }

  async search(query: MarketplaceSearchQuery): Promise<MarketplaceSearchResult[]> {
    const catalog = await this.getCatalog();
    const q = query.query.toLowerCase();
    return catalog
      .filter(e => e.name.toLowerCase().includes(q) || e.description.toLowerCase().includes(q) || e.id.toLowerCase().includes(q))
      .map(e => this.toSearchResult(e));
  }

  async buildInstallPlan(artifactId: string): Promise<InstallPlan> {
    const catalog = await this.getCatalog();
    const entry = catalog.find(e => e.id === artifactId);
    if (!entry) throw new Error(`Claude artifact "${artifactId}" not found`);

    return {
      mode: 'direct_mcp',
      mcpEntry: {
        id: entry.id,
        command: entry.command,
        args: entry.args,
        url: entry.url,
        transport: entry.transport,
        env: entry.env,
        headers: entry.headers,
      },
      metadata: {
        versionRef: entry.versionRef,
        publisherIdentity: entry.publisher,
      },
    };
  }

  private toSearchResult(entry: ClaudeCatalogEntry): MarketplaceSearchResult {
    return {
      artifactId: entry.id,
      artifactKind: 'mcp_server',
      displayName: entry.name,
      ecosystem: 'claude',
      sourceLocator: entry.url ?? `npx:${entry.args?.[1] ?? entry.command ?? ''}`,
      trustLevel: entry.trustLevel,
      componentSummary: entry.description,
      transport: entry.transport ?? 'stdio',
      versionRef: entry.versionRef,
      publisherIdentity: entry.publisher,
    };
  }
}
```

**Step 4: Rebuild and run test**

Run: `cd packages/api && pnpm build && node --test test/marketplace/adapters/claude-adapter.test.js`
Expected: PASS

**Step 5: Commit**

```bash
git add packages/api/src/marketplace/adapters/claude-adapter.ts packages/api/test/marketplace/adapters/claude-adapter.test.js
git commit -m "feat(F146-B): Claude marketplace adapter — search + direct_mcp install plan [布偶猫🐾]"
```

---

## Task 4: Codex Adapter

Codex uses CLI + JSON-RPC dual channel. Different field names: `env_vars`, `env_http_headers`, `serverUrl`.

**Files:**
- Create: `packages/api/src/marketplace/adapters/codex-adapter.ts`
- Test: `packages/api/test/marketplace/adapters/codex-adapter.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('CodexMarketplaceAdapter', () => {
  let CodexMarketplaceAdapter;

  beforeEach(async () => {
    ({ CodexMarketplaceAdapter } = await import('../../../dist/marketplace/adapters/codex-adapter.js'));
  });

  it('has ecosystem = codex', () => {
    const adapter = new CodexMarketplaceAdapter({ catalogLoader: async () => [] });
    assert.strictEqual(adapter.ecosystem, 'codex');
  });

  it('normalizes Codex env_vars → env', async () => {
    const catalog = [{
      id: 'codex-tool', name: 'Codex Tool', description: 'A tool',
      command: 'python', args: ['-m', 'tool_server'],
      env_vars: { API_KEY: 'xxx' }, enabled_tools: ['read', 'write'],
      trustLevel: 'verified', publisher: 'openai',
    }];
    const adapter = new CodexMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('codex-tool');
    assert.strictEqual(plan.mode, 'direct_mcp');
    assert.deepStrictEqual(plan.mcpEntry.env, { API_KEY: 'xxx' });
  });

  it('maps serverUrl → url + streamableHttp transport', async () => {
    const catalog = [{
      id: 'remote-codex', name: 'Remote', description: 'Remote Codex MCP',
      serverUrl: 'https://mcp.openai.com/v1', env_http_headers: { Authorization: 'Bearer tok' },
      trustLevel: 'official', publisher: 'openai',
    }];
    const adapter = new CodexMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('remote-codex');
    assert.strictEqual(plan.mcpEntry.url, 'https://mcp.openai.com/v1');
    assert.strictEqual(plan.mcpEntry.transport, 'streamableHttp');
    assert.deepStrictEqual(plan.mcpEntry.headers, { Authorization: 'Bearer tok' });
  });

  it('generates delegated_cli install plan for plugin-type entries', async () => {
    const catalog = [{
      id: 'codex-plugin', name: 'Plugin', description: 'Native plugin',
      kind: 'plugin', cliInstallCommand: 'codex plugin install codex-plugin',
      trustLevel: 'official', publisher: 'openai',
    }];
    const adapter = new CodexMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('codex-plugin');
    assert.strictEqual(plan.mode, 'delegated_cli');
    assert.strictEqual(plan.delegatedCommand, 'codex plugin install codex-plugin');
  });
});
```

**Step 2–5:** Same pattern — fail → implement → pass → commit.

Implementation maps Codex field names to our schema:
- `env_vars` → `env`
- `env_http_headers` → `headers`
- `serverUrl` → `url` + `transport: 'streamableHttp'`
- `enabled_tools` → stored in `metadata` for Phase C tool_policy

```bash
git commit -m "feat(F146-B): Codex marketplace adapter — field normalization + dual-mode install [布偶猫🐾]"
```

---

## Task 5: OpenClaw Adapter

OpenClaw `mcp` is overloaded (server vs definition). Bundle ≠ MCP. Need extra adapter logic.

**Files:**
- Create: `packages/api/src/marketplace/adapters/openclaw-adapter.ts`
- Test: `packages/api/test/marketplace/adapters/openclaw-adapter.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('OpenClawMarketplaceAdapter', () => {
  let OpenClawMarketplaceAdapter;

  beforeEach(async () => {
    ({ OpenClawMarketplaceAdapter } = await import('../../../dist/marketplace/adapters/openclaw-adapter.js'));
  });

  it('has ecosystem = openclaw', () => {
    const adapter = new OpenClawMarketplaceAdapter({ catalogLoader: async () => [] });
    assert.strictEqual(adapter.ecosystem, 'openclaw');
  });

  it('disambiguates OpenClaw "mcp" — server vs definition', async () => {
    const catalog = [
      { id: 'oc-server', name: 'OC Server', description: 'A real MCP server', clawType: 'mcp_server', command: 'node', args: ['server.js'], trustLevel: 'verified', publisher: 'openclaw' },
      { id: 'oc-bundle', name: 'OC Bundle', description: 'A bundle wrapping Claude MCP', clawType: 'bundle', sourceBundle: 'claude:filesystem', trustLevel: 'community', publisher: 'user' },
    ];
    const adapter = new OpenClawMarketplaceAdapter({ catalogLoader: async () => catalog });

    const results = await adapter.search({ query: '' });
    const server = results.find(r => r.artifactId === 'oc-server');
    const bundle = results.find(r => r.artifactId === 'oc-bundle');
    assert.strictEqual(server.artifactKind, 'mcp_server');
    assert.strictEqual(bundle.artifactKind, 'bundle');
  });

  it('builds delegated_cli for skill installs', async () => {
    const catalog = [{
      id: 'oc-skill', name: 'OC Skill', description: 'A skill',
      clawType: 'skill', cliInstallCommand: 'claw install oc-skill',
      trustLevel: 'verified', publisher: 'openclaw',
    }];
    const adapter = new OpenClawMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('oc-skill');
    assert.strictEqual(plan.mode, 'delegated_cli');
    assert.ok(plan.delegatedCommand.includes('claw install'));
  });

  it('builds direct_mcp for MCP server entries', async () => {
    const catalog = [{
      id: 'oc-mcp', name: 'OC MCP', description: 'MCP server',
      clawType: 'mcp_server', command: 'uvx', args: ['mcp-server'],
      trustLevel: 'official', publisher: 'openclaw',
    }];
    const adapter = new OpenClawMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('oc-mcp');
    assert.strictEqual(plan.mode, 'direct_mcp');
    assert.strictEqual(plan.mcpEntry.command, 'uvx');
  });
});
```

**Step 2–5:** fail → implement → pass → commit.

```bash
git commit -m "feat(F146-B): OpenClaw marketplace adapter — bundle/mcp disambiguation + ClawHub mapping [布偶猫🐾]"
```

---

## Task 6: Antigravity Adapter (Read-Only)

Read-only discovery + manual_ui handoff. Must respect existing `pencil` resolver consistency (AC-B5).

**Files:**
- Create: `packages/api/src/marketplace/adapters/antigravity-adapter.ts`
- Test: `packages/api/test/marketplace/adapters/antigravity-adapter.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('AntigravityMarketplaceAdapter', () => {
  let AntigravityMarketplaceAdapter;

  beforeEach(async () => {
    ({ AntigravityMarketplaceAdapter } = await import('../../../dist/marketplace/adapters/antigravity-adapter.js'));
  });

  it('has ecosystem = antigravity', () => {
    const adapter = new AntigravityMarketplaceAdapter({ catalogLoader: async () => [] });
    assert.strictEqual(adapter.ecosystem, 'antigravity');
  });

  it('always returns manual_ui install plan', async () => {
    const catalog = [{
      id: 'ag-ext', name: 'AG Extension', description: 'An extension',
      trustLevel: 'official', publisher: 'antigravity',
    }];
    const adapter = new AntigravityMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('ag-ext');
    assert.strictEqual(plan.mode, 'manual_ui');
    assert.ok(plan.manualSteps);
    assert.ok(plan.manualSteps.length > 0);
  });

  it('pencil resolver entries get manual_file mode with resolver hint', async () => {
    const catalog = [{
      id: 'pencil', name: 'Pencil', description: 'Design tool MCP',
      trustLevel: 'official', publisher: 'antigravity', resolver: 'pencil',
    }];
    const adapter = new AntigravityMarketplaceAdapter({ catalogLoader: async () => catalog });

    const plan = await adapter.buildInstallPlan('pencil');
    assert.strictEqual(plan.mode, 'manual_file');
    assert.ok(plan.manualSteps.some(s => s.includes('resolver')));
  });

  it('search results include all catalog entries (read-only)', async () => {
    const catalog = [
      { id: 'ag-1', name: 'Ext 1', description: 'First', trustLevel: 'official', publisher: 'antigravity' },
      { id: 'ag-2', name: 'Ext 2', description: 'Second', trustLevel: 'verified', publisher: 'community' },
    ];
    const adapter = new AntigravityMarketplaceAdapter({ catalogLoader: async () => catalog });

    const results = await adapter.search({ query: '' });
    assert.strictEqual(results.length, 2);
    results.forEach(r => assert.strictEqual(r.ecosystem, 'antigravity'));
  });
});
```

**Step 2–5:** fail → implement → pass → commit.

```bash
git commit -m "feat(F146-B): Antigravity read-only adapter — manual_ui handoff + pencil resolver consistency [布偶猫🐾]"
```

---

## Task 7: InstallPlan Bridge

Converts `InstallPlan` (marketplace output) → `McpInstallRequest` (Phase A input) for the `direct_mcp` path. Non-`direct_mcp` modes return the plan as-is for frontend to handle.

**Files:**
- Create: `packages/api/src/marketplace/install-plan-bridge.ts`
- Test: `packages/api/test/marketplace/install-plan-bridge.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

describe('InstallPlanBridge', () => {
  let toMcpInstallRequest, validateInstallPlan;

  beforeEach(async () => {
    ({ toMcpInstallRequest, validateInstallPlan } = await import('../../dist/marketplace/install-plan-bridge.js'));
  });

  it('converts direct_mcp plan to McpInstallRequest', () => {
    const plan = {
      mode: 'direct_mcp',
      mcpEntry: { id: 'test-mcp', command: 'npx', args: ['-y', 'mcp-server'] },
      metadata: { versionRef: '1.2.3', publisherIdentity: 'anthropic' },
    };
    const req = toMcpInstallRequest(plan);
    assert.strictEqual(req.id, 'test-mcp');
    assert.strictEqual(req.command, 'npx');
    assert.deepStrictEqual(req.args, ['-y', 'mcp-server']);
  });

  it('throws for non-direct_mcp plans', () => {
    assert.throws(
      () => toMcpInstallRequest({ mode: 'delegated_cli', delegatedCommand: 'claude mcp add x' }),
      /only direct_mcp/
    );
  });

  it('validates direct_mcp plan has mcpEntry', () => {
    const errors = validateInstallPlan({ mode: 'direct_mcp' });
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('mcpEntry'));
  });

  it('validates delegated_cli plan has delegatedCommand', () => {
    const errors = validateInstallPlan({ mode: 'delegated_cli' });
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('delegatedCommand'));
  });

  it('validates manual_ui plan has manualSteps', () => {
    const errors = validateInstallPlan({ mode: 'manual_ui' });
    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('manualSteps'));
  });

  it('passes valid plans', () => {
    assert.deepStrictEqual(validateInstallPlan({ mode: 'direct_mcp', mcpEntry: { id: 'x' } }), []);
    assert.deepStrictEqual(validateInstallPlan({ mode: 'delegated_cli', delegatedCommand: 'cmd' }), []);
    assert.deepStrictEqual(validateInstallPlan({ mode: 'manual_ui', manualSteps: ['step 1'] }), []);
  });
});
```

**Step 2–5:** fail → implement → pass → commit.

```bash
git commit -m "feat(F146-B): InstallPlan bridge — marketplace plan → Phase A McpInstallRequest [布偶猫🐾]"
```

---

## Task 8: API Routes

Two new endpoints on the existing Fastify app:
- `GET /api/marketplace/search` — unified search across ecosystems
- `POST /api/marketplace/install` — bridge to Phase A install (direct_mcp only)

**Files:**
- Create: `packages/api/src/routes/marketplace.ts`
- Modify: `packages/api/src/routes/index.ts` (register new routes)
- Create: `packages/api/src/marketplace/index.ts` (registry factory with all 4 adapters)
- Test: `packages/api/test/marketplace/marketplace-routes.test.js`

**Step 1: Write the failing test**

```javascript
import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import Fastify from 'fastify';

describe('Marketplace Routes', () => {
  let fastify;

  beforeEach(async () => {
    fastify = Fastify();
    const { registerMarketplaceRoutes } = await import('../../dist/routes/marketplace.js');
    const { createAdapterRegistry } = await import('../../dist/marketplace/index.js');

    const registry = createAdapterRegistry({
      claude: { catalogLoader: async () => [
        { id: 'mcp-fs', name: 'Filesystem', description: 'File access', command: 'npx', args: ['-y', '@anthropic/mcp-filesystem'], trustLevel: 'official', publisher: 'anthropic' },
      ]},
      codex: { catalogLoader: async () => [] },
      openclaw: { catalogLoader: async () => [] },
      antigravity: { catalogLoader: async () => [] },
    });
    registerMarketplaceRoutes(fastify, { registry });
  });

  it('GET /api/marketplace/search returns results', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/marketplace/search?q=file' });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.ok(Array.isArray(body.results));
    assert.strictEqual(body.results.length, 1);
    assert.strictEqual(body.results[0].artifactId, 'mcp-fs');
    assert.strictEqual(body.results[0].ecosystem, 'claude');
  });

  it('GET /api/marketplace/search with ecosystem filter', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/marketplace/search?q=file&ecosystems=codex' });
    const body = JSON.parse(res.body);
    assert.strictEqual(body.results.length, 0);
  });

  it('GET /api/marketplace/search with trustLevel filter', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/marketplace/search?q=file&trustLevels=community' });
    const body = JSON.parse(res.body);
    assert.strictEqual(body.results.length, 0);
  });

  it('GET /api/marketplace/search requires q param', async () => {
    const res = await fastify.inject({ method: 'GET', url: '/api/marketplace/search' });
    assert.strictEqual(res.statusCode, 400);
  });

  it('POST /api/marketplace/install/plan returns install plan', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/marketplace/install/plan',
      payload: { ecosystem: 'claude', artifactId: 'mcp-fs' },
    });
    assert.strictEqual(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.strictEqual(body.plan.mode, 'direct_mcp');
    assert.ok(body.plan.mcpEntry);
  });

  it('POST /api/marketplace/install/plan returns 404 for unknown', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/api/marketplace/install/plan',
      payload: { ecosystem: 'claude', artifactId: 'nonexistent' },
    });
    assert.strictEqual(res.statusCode, 404);
  });
});
```

**Step 2–5:** fail → implement → pass → commit.

Route implementation:

```typescript
// GET /api/marketplace/search?q=...&ecosystems=...&trustLevels=...&artifactKinds=...&limit=...
// → registry.search(query) → { results: MarketplaceSearchResult[] }

// POST /api/marketplace/install/plan { ecosystem, artifactId }
// → registry.buildInstallPlan(ecosystem, artifactId) → { plan: InstallPlan }
// (Frontend uses this to preview, then calls Phase A POST /api/capabilities/mcp/install with plan.mcpEntry)
```

```bash
git commit -m "feat(F146-B): marketplace API routes — GET search + POST install/plan [布偶猫🐾]"
```

---

## Task 9: Integration Test

End-to-end: search → get install plan → verify it's compatible with Phase A install.

**Files:**
- Test: `packages/api/test/marketplace/marketplace-integration.test.js`

**Step 1: Write the integration test**

```javascript
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('Marketplace → Phase A Integration', () => {
  it('search result → install plan → McpInstallRequest round-trip', async () => {
    const { createAdapterRegistry } = await import('../../dist/marketplace/index.js');
    const { toMcpInstallRequest } = await import('../../dist/marketplace/install-plan-bridge.js');
    const { buildInstallPreview } = await import('../../dist/config/capabilities/capability-install.js');

    const registry = createAdapterRegistry({
      claude: { catalogLoader: async () => [{
        id: 'test-mcp', name: 'Test MCP', description: 'Integration test',
        command: 'npx', args: ['-y', 'test-mcp-server'], trustLevel: 'official', publisher: 'test',
      }]},
      codex: { catalogLoader: async () => [] },
      openclaw: { catalogLoader: async () => [] },
      antigravity: { catalogLoader: async () => [] },
    });

    // Step 1: Search
    const results = await registry.search({ query: 'test' });
    assert.strictEqual(results.length, 1);

    // Step 2: Get install plan
    const plan = await registry.buildInstallPlan('claude', results[0].artifactId);
    assert.strictEqual(plan.mode, 'direct_mcp');

    // Step 3: Convert to Phase A request
    const installReq = toMcpInstallRequest(plan);
    assert.strictEqual(installReq.id, 'test-mcp');

    // Step 4: Verify Phase A preview accepts it
    const preview = buildInstallPreview(installReq);
    assert.ok(preview.entry);
    assert.strictEqual(preview.entry.id, 'test-mcp');
    assert.strictEqual(preview.entry.type, 'mcp');
    assert.ok(preview.willProbe);
  });

  it('non-direct_mcp plans do not go through Phase A install', async () => {
    const { createAdapterRegistry } = await import('../../dist/marketplace/index.js');
    const { toMcpInstallRequest } = await import('../../dist/marketplace/install-plan-bridge.js');

    const registry = createAdapterRegistry({
      claude: { catalogLoader: async () => [] },
      codex: { catalogLoader: async () => [] },
      openclaw: { catalogLoader: async () => [] },
      antigravity: { catalogLoader: async () => [{
        id: 'ag-ext', name: 'AG Ext', description: 'Extension',
        trustLevel: 'official', publisher: 'antigravity',
      }]},
    });

    const plan = await registry.buildInstallPlan('antigravity', 'ag-ext');
    assert.strictEqual(plan.mode, 'manual_ui');
    assert.throws(() => toMcpInstallRequest(plan), /only direct_mcp/);
  });
});
```

**Step 2: Run and verify PASS**

Run: `cd packages/api && pnpm build && node --test test/marketplace/marketplace-integration.test.js`
Expected: PASS

**Step 3: Commit**

```bash
git add packages/api/test/marketplace/marketplace-integration.test.js
git commit -m "test(F146-B): end-to-end marketplace → Phase A install integration test [布偶猫🐾]"
```

---

## AC Coverage Matrix

| AC | Task | Verification |
|----|------|-------------|
| AC-B1: 四方统一搜索 | Task 2 (Registry) + Task 8 (Route) | Route test: search returns multi-ecosystem results |
| AC-B2: trustLevel 过滤 | Task 2 (Registry filter) | Registry test: filters by trustLevel |
| AC-B3: installPlan 映射 | Task 7 (Bridge) + Task 9 (Integration) | Integration test: plan → McpInstallRequest → preview |
| AC-B4: Antigravity 结果 | Task 6 (Antigravity adapter) | Adapter test: returns search results |
| AC-B5: pencil resolver 一致 | Task 6 (pencil test case) | Adapter test: pencil gets manual_file + resolver hint |
| AC-B6: kind=pack 支持 | Task 1 (ArtifactKind type) + all adapters | Type includes 'pack'; adapters can return pack entries |

## File Inventory

| Path | Action | ~Lines |
|------|--------|--------|
| `packages/shared/src/types/marketplace.ts` | Create | ~60 |
| `packages/shared/src/types/index.ts` | Modify (add export) | +1 |
| `packages/api/src/marketplace/adapter-registry.ts` | Create | ~60 |
| `packages/api/src/marketplace/adapters/claude-adapter.ts` | Create | ~90 |
| `packages/api/src/marketplace/adapters/codex-adapter.ts` | Create | ~100 |
| `packages/api/src/marketplace/adapters/openclaw-adapter.ts` | Create | ~100 |
| `packages/api/src/marketplace/adapters/antigravity-adapter.ts` | Create | ~70 |
| `packages/api/src/marketplace/install-plan-bridge.ts` | Create | ~50 |
| `packages/api/src/marketplace/index.ts` | Create | ~40 |
| `packages/api/src/routes/marketplace.ts` | Create | ~120 |
| `packages/api/src/routes/index.ts` | Modify (register) | +3 |
| Test files (7) | Create | ~100 each |

All production files under 200 lines. Total: ~690 lines production code + ~700 lines tests.
