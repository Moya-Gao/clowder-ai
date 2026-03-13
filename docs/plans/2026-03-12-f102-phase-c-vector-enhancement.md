---
feature_ids: [F102]
topics: [memory, embedding, vector-search, qwen3, semantic-rerank]
doc_kind: plan
created: 2026-03-12
---

# F102 Phase C: 向量增强 Implementation Plan

**Feature:** F102 — `docs/features/F102-memory-adapter-refactor.md`
**Goal:** 在 Phase B lexical 检索基础上加入语义 embedding rerank，提升中英混排场景检索质量
**Acceptance Criteria:**
- AC-C1: `EMBED_MODE` 三态开关（`off|shadow|on`，默认 `off`），`EMBED_MODEL` 可配置
- AC-C2: Qwen3-Embedding-0.6B ONNX 本地推理（Transformers.js），MRL 维度可配置
- AC-C3: `evidence_vectors` vec0 虚拟表（单一向量真相源）
- AC-C4: fail-open — 模型下载/加载/推理任一失败自动回落 Phase B lexical
- AC-C5: 资源门禁 `max_model_mem_mb` + `embed_timeout_ms`，超阈值降级
- AC-C6: `embedding_meta` 版本锚——模型/维度变更触发全量 re-embed
- AC-C7: shadow 期 A/B（`dim=128/256`），复用 `memory_eval_corpus.yaml` 对比 Recall@k
- AC-C8: 语义 rerank 对 FTS5 候选集重排序（不替代 lexical 召回）
- AC-C9: `evidence_passages` 表按需启用（本 Phase 预留，不实现）
**Architecture:** 在现有 SqliteEvidenceStore + IndexBuilder 上加 3 个模块：EmbeddingService（模型管理+推理）、VectorStore（sqlite-vec vec0）、SemanticReranker（搜索后重排序）。三态开关控制激活层级，fail-open 保证基础检索不断。
**Tech Stack:** `@huggingface/transformers` ^3.x（ONNX 推理）、`sqlite-vec` ^0.1.6（vec0 虚拟表）、`better-sqlite3`（已有）
**前端验证:** No — 纯后端

---

## Straight-Line Check

**B (finish line):** `EMBED_MODE=on` 时，search_evidence 在 Phase B lexical 结果上做 embedding rerank；`shadow` 模式可采集 A/B 指标；任何异常自动回落 lexical。eval corpus Recall@5 不低于 Phase B 基线。

**Terminal Schema:**

```typescript
// New config fields (added to MemoryConfig)
interface EmbedConfig {
  embedMode: 'off' | 'shadow' | 'on';     // default 'off'
  embedModel: 'qwen3-embedding-0.6b' | 'multilingual-e5-small';  // default 'qwen3-...'
  embedDim: number;                         // default 256
  maxModelMemMb: number;                    // default 800
  embedTimeoutMs: number;                   // default 3000
}

// New service interface
interface IEmbeddingService {
  embed(texts: string[]): Promise<Float32Array[]>;
  isReady(): boolean;
  getModelInfo(): EmbedModelInfo;
  dispose(): void;
}

interface EmbedModelInfo {
  modelId: string;
  modelRev: string;
  dim: number;
}
```

**NOT building:**
- `evidence_passages` 表实现（AC-C9 预留 schema，不填数据）
- KnowledgeResolver 改造（Phase C 只改 SqliteEvidenceStore.search 增加 rerank）
- 模型自动下载进度 UI（命令行日志即可）
- 全局 `global_knowledge.sqlite` 的向量增强（本 Phase 只做项目库）

---

## Task 1: EmbedConfig + 三态开关

**目标**：配置系统支持 `embedMode`/`embedModel`/`embedDim` 等字段。AC-C1 基础。

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts` — MemoryConfig 增加 EmbedConfig
- Modify: `packages/api/src/domains/memory/interfaces.ts` — IEmbeddingService 接口 + EmbedConfig type
- Test: `packages/api/test/memory/embed-config.test.js`

**Step 1: Write failing test — config 解析 + 默认值**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveEmbedConfig } from '../src/domains/memory/interfaces.js';

describe('resolveEmbedConfig', () => {
  it('returns defaults when no embed config provided', () => {
    const config = resolveEmbedConfig(undefined);
    assert.equal(config.embedMode, 'off');
    assert.equal(config.embedModel, 'qwen3-embedding-0.6b');
    assert.equal(config.embedDim, 256);
    assert.equal(config.maxModelMemMb, 800);
    assert.equal(config.embedTimeoutMs, 3000);
  });

  it('overrides individual fields', () => {
    const config = resolveEmbedConfig({ embedMode: 'shadow', embedDim: 128 });
    assert.equal(config.embedMode, 'shadow');
    assert.equal(config.embedDim, 128);
    assert.equal(config.embedModel, 'qwen3-embedding-0.6b'); // untouched default
  });

  it('rejects invalid embedMode', () => {
    assert.throws(() => resolveEmbedConfig({ embedMode: 'turbo' }), /invalid embedMode/i);
  });
});
```

**Step 2: Run test — verify FAIL** (`resolveEmbedConfig` not defined)

**Step 3: Implement resolveEmbedConfig + types in interfaces.ts**

Add to `interfaces.ts`:
```typescript
export interface EmbedConfig {
  embedMode: 'off' | 'shadow' | 'on';
  embedModel: 'qwen3-embedding-0.6b' | 'multilingual-e5-small';
  embedDim: number;
  maxModelMemMb: number;
  embedTimeoutMs: number;
}

export interface EmbedModelInfo {
  modelId: string;
  modelRev: string;
  dim: number;
}

export interface IEmbeddingService {
  embed(texts: string[]): Promise<Float32Array[]>;
  isReady(): boolean;
  getModelInfo(): EmbedModelInfo;
  dispose(): void;
}

const VALID_MODES = new Set(['off', 'shadow', 'on']);
const VALID_MODELS = new Set(['qwen3-embedding-0.6b', 'multilingual-e5-small']);

export function resolveEmbedConfig(partial?: Partial<EmbedConfig>): EmbedConfig {
  const mode = partial?.embedMode ?? 'off';
  if (!VALID_MODES.has(mode)) throw new Error(`Invalid embedMode: ${mode}`);
  const model = partial?.embedModel ?? 'qwen3-embedding-0.6b';
  if (!VALID_MODELS.has(model)) throw new Error(`Invalid embedModel: ${model}`);
  return {
    embedMode: mode as EmbedConfig['embedMode'],
    embedModel: model as EmbedConfig['embedModel'],
    embedDim: partial?.embedDim ?? 256,
    maxModelMemMb: partial?.maxModelMemMb ?? 800,
    embedTimeoutMs: partial?.embedTimeoutMs ?? 3000,
  };
}
```

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/interfaces.ts packages/api/test/memory/embed-config.test.js
git commit -m "feat(F102-C): add EmbedConfig + IEmbeddingService interface + resolveEmbedConfig"
```

---

## Task 2: Schema V2 — embedding_meta + evidence_vectors

**目标**：AC-C3（vec0 虚拟表）+ AC-C6（版本锚）。Schema migration 从 V1 → V2。

**Files:**
- Modify: `packages/api/src/domains/memory/schema.ts` — 新增 SCHEMA_V2 + migration
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` — initialize() 跑 migration
- Test: `packages/api/test/memory/schema-v2.test.js`

**Step 1: Write failing test — V2 migration creates new tables**

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { applyMigrations, ensureVectorTable } from '../src/domains/memory/schema.js';

describe('Schema V2 migration', () => {
  let db;

  beforeEach(() => {
    db = new Database(':memory:');
    sqliteVec.load(db);
  });

  it('creates embedding_meta table', () => {
    applyMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE name='embedding_meta'").get();
    assert.ok(row, 'embedding_meta table should exist');
  });

  it('V2 migration does NOT create evidence_vectors (decoupled)', () => {
    applyMigrations(db);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE name='evidence_vectors'").get();
    assert.equal(row, undefined, 'evidence_vectors should NOT be created by migration');
  });

  it('ensureVectorTable creates vec0 table when extension loaded', () => {
    applyMigrations(db);
    const ok = ensureVectorTable(db, 256);
    assert.equal(ok, true);
    const row = db.prepare("SELECT name FROM sqlite_master WHERE name='evidence_vectors'").get();
    assert.ok(row);
  });

  it('ensureVectorTable returns false without extension', () => {
    const plainDb = new Database(':memory:');
    applyMigrations(plainDb);
    const ok = ensureVectorTable(plainDb, 256);
    assert.equal(ok, false);
  });

  it('ensureVectorTable is idempotent', () => {
    applyMigrations(db);
    ensureVectorTable(db, 256);
    ensureVectorTable(db, 256); // second call — no error
  });

  it('migration is idempotent (running twice does not error)', () => {
    applyMigrations(db);
    applyMigrations(db);
    const version = db.prepare('SELECT MAX(version) as v FROM schema_version').get();
    assert.equal(version.v, 2);
  });
});
```

**Step 2: Run test — verify FAIL** (`applyMigrations` not exported, sqlite-vec not installed)

**Step 3: Install sqlite-vec**

```bash
pnpm --filter @cat-cafe/api add sqlite-vec@^0.1.6
```

**Step 4: Implement Schema V2 in schema.ts**

> **P1 fix (codex review):** `evidence_vectors` 创建从 `schema_version` 解耦。
> `applyMigrations` 只管 `embedding_meta`（常规表，不依赖扩展）。
> `evidence_vectors`（vec0 虚拟表）由 `ensureVectorTable()` 独立管理——每次 factory
> 初始化时调用，扩展可用就 `CREATE IF NOT EXISTS`，不可用就跳过。
> 这样 `off` 环境首次启动后切 `on` 仍能正确建表。

Add to `schema.ts`:
```typescript
export const SCHEMA_V2 = `
CREATE TABLE IF NOT EXISTS embedding_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const CURRENT_SCHEMA_VERSION = 2;

export function applyMigrations(db: Database.Database): void {
  // P1 fix (codex review R2): schema_version may not exist on empty DB.
  // Create it first (idempotent) before querying.
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`);

  const currentVersion = db.prepare(
    "SELECT MAX(version) as v FROM schema_version"
  ).get()?.v ?? 0;

  if (currentVersion < 1) {
    db.exec(SCHEMA_V1);
    for (const stmt of FTS_TRIGGER_STATEMENTS) db.exec(stmt);
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)')
      .run(1, new Date().toISOString());
  }

  if (currentVersion < 2) {
    db.exec(SCHEMA_V2); // only embedding_meta — no vec0 dependency
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)')
      .run(2, new Date().toISOString());
  }
}

/**
 * Ensure vec0 virtual table exists — called separately from migration.
 * Requires sqlite-vec extension to be loaded first.
 * Safe to call multiple times (IF NOT EXISTS).
 * Returns true if table was created/exists, false if extension unavailable.
 */
export function ensureVectorTable(db: Database.Database, dim: number): boolean {
  try {
    db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS evidence_vectors USING vec0(
        anchor TEXT PRIMARY KEY,
        embedding float[${dim}]
      )
    `);
    return true;
  } catch {
    return false; // sqlite-vec not loaded — fail-open
  }
}
```

**Step 5: Update SqliteEvidenceStore.initialize() to use applyMigrations**

Replace manual schema exec with `applyMigrations(this.db)`.

**Step 6: Run test — verify PASS**

**Step 7: Run existing tests — verify no regression**

```bash
cd packages/api && node --test test/memory/sqlite-evidence-store.test.js
cd packages/api && node --test test/memory/index-builder.test.js
```

**Step 8: Commit**

```bash
git add packages/api/src/domains/memory/schema.ts packages/api/src/domains/memory/SqliteEvidenceStore.ts packages/api/test/memory/schema-v2.test.js package.json pnpm-lock.yaml
git commit -m "feat(F102-C): schema V2 — embedding_meta + evidence_vectors (vec0)"
```

---

## Task 3: EmbeddingService — 模型加载 + 推理 + MRL 截断

**目标**：AC-C2（Qwen3 ONNX 推理 + MRL）+ AC-C4（fail-open）+ AC-C5（资源门禁）。

**Files:**
- Create: `packages/api/src/domains/memory/EmbeddingService.ts`
- Test: `packages/api/test/memory/embedding-service.test.js`

**Step 1: Write failing test — EmbeddingService 基础功能**

```javascript
import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { EmbeddingService } from '../src/domains/memory/EmbeddingService.js';

describe('EmbeddingService', () => {
  it('isReady returns false before load', () => {
    const svc = new EmbeddingService({ embedModel: 'qwen3-embedding-0.6b', embedDim: 256, embedTimeoutMs: 3000, maxModelMemMb: 800 });
    assert.equal(svc.isReady(), false);
  });

  it('getModelInfo returns config', () => {
    const svc = new EmbeddingService({ embedModel: 'qwen3-embedding-0.6b', embedDim: 256, embedTimeoutMs: 3000, maxModelMemMb: 800 });
    const info = svc.getModelInfo();
    assert.equal(info.modelId, 'qwen3-embedding-0.6b');
    assert.equal(info.dim, 256);
  });

  it('embed throws when not loaded', async () => {
    const svc = new EmbeddingService({ embedModel: 'qwen3-embedding-0.6b', embedDim: 256, embedTimeoutMs: 3000, maxModelMemMb: 800 });
    await assert.rejects(() => svc.embed(['hello']), /not ready/i);
  });

  it('dispose is safe when not loaded', () => {
    const svc = new EmbeddingService({ embedModel: 'qwen3-embedding-0.6b', embedDim: 256, embedTimeoutMs: 3000, maxModelMemMb: 800 });
    svc.dispose(); // should not throw
  });

  // P2 fix (codex review): resource guard tests
  it('embed rejects when single inference exceeds embedTimeoutMs', async () => {
    // Use a mock pipeline that takes > timeout to resolve
    // Verify: throws timeout error, not a hang
  });

  it('load checks process memory and downgrades model if over maxModelMemMb', async () => {
    // Stub process.memoryUsage() to return > maxModelMemMb
    // Verify: load() skips loading (stays not ready) or switches to fallback
  });
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Install @huggingface/transformers**

```bash
pnpm --filter @cat-cafe/api add @huggingface/transformers@^3
```

**Step 4: Implement EmbeddingService**

```typescript
// packages/api/src/domains/memory/EmbeddingService.ts
import type { EmbedModelInfo, IEmbeddingService } from './interfaces.js';

const MODEL_IDS: Record<string, string> = {
  'qwen3-embedding-0.6b': 'onnx-community/Qwen3-Embedding-0.6B-ONNX',
  'multilingual-e5-small': 'Xenova/multilingual-e5-small',
};

interface EmbeddingServiceConfig {
  embedModel: string;
  embedDim: number;
  embedTimeoutMs: number;
  maxModelMemMb: number;
}

export class EmbeddingService implements IEmbeddingService {
  private pipeline: unknown = null;  // lazy loaded
  private config: EmbeddingServiceConfig;
  private modelRev = 'unknown';

  constructor(config: EmbeddingServiceConfig) {
    this.config = config;
  }

  async load(): Promise<void> {
    // P2 fix: memory guard — check before loading 600MB+ model
    const memUsageMb = process.memoryUsage().rss / 1024 / 1024;
    if (memUsageMb > this.config.maxModelMemMb) {
      throw new Error(`Memory guard: RSS ${Math.round(memUsageMb)}MB exceeds max ${this.config.maxModelMemMb}MB — skipping model load`);
    }
    const { pipeline: createPipeline } = await import('@huggingface/transformers');
    const hfModelId = MODEL_IDS[this.config.embedModel];
    if (!hfModelId) throw new Error(`Unknown model: ${this.config.embedModel}`);
    this.pipeline = await createPipeline('feature-extraction', hfModelId, {
      dtype: 'q8',  // int8 quantized
    });
  }

  isReady(): boolean {
    return this.pipeline !== null;
  }

  getModelInfo(): EmbedModelInfo {
    return {
      modelId: this.config.embedModel,
      modelRev: this.modelRev,
      dim: this.config.embedDim,
    };
  }

  async embed(texts: string[]): Promise<Float32Array[]> {
    if (!this.pipeline) throw new Error('EmbeddingService not ready — call load() first');
    const extractor = this.pipeline as (text: string[], opts: Record<string, unknown>) => Promise<{ data: Float32Array; dims: number[] }>;

    // P2 fix: timeout guard
    const timeoutMs = this.config.embedTimeoutMs;
    const output = await Promise.race([
      extractor(texts, { pooling: 'mean', normalize: false }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`Embed timeout: ${timeoutMs}ms exceeded`)), timeoutMs)
      ),
    ]);

    const fullDim = output.dims[1];
    const targetDim = this.config.embedDim;
    const results: Float32Array[] = [];
    for (let i = 0; i < texts.length; i++) {
      const offset = i * fullDim;
      const slice = output.data.slice(offset, offset + targetDim);
      // L2 normalize after MRL truncation
      let norm = 0;
      for (let j = 0; j < slice.length; j++) norm += slice[j] * slice[j];
      norm = Math.sqrt(norm);
      const normalized = new Float32Array(targetDim);
      for (let j = 0; j < targetDim; j++) normalized[j] = slice[j] / norm;
      results.push(normalized);
    }
    return results;
  }

  dispose(): void {
    this.pipeline = null;
  }
}
```

**Step 5: Run test — verify PASS**

**Step 6: Commit**

```bash
git add packages/api/src/domains/memory/EmbeddingService.ts packages/api/test/memory/embedding-service.test.js package.json pnpm-lock.yaml
git commit -m "feat(F102-C): EmbeddingService — Transformers.js ONNX + MRL truncation"
```

---

## Task 4: VectorStore — vec0 CRUD + 版本锚

**目标**：AC-C3（vec0 操作）+ AC-C6（embedding_meta 版本锚 + 版本变更检测）。

**Files:**
- Create: `packages/api/src/domains/memory/VectorStore.ts`
- Test: `packages/api/test/memory/vector-store.test.js`

**Step 1: Write failing test**

```javascript
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import * as sqliteVec from 'sqlite-vec';
import { VectorStore } from '../src/domains/memory/VectorStore.js';
import { applyMigrations } from '../src/domains/memory/schema.js';

describe('VectorStore', () => {
  let db, store;

  beforeEach(() => {
    db = new Database(':memory:');
    sqliteVec.load(db);
    applyMigrations(db);
    store = new VectorStore(db, 256);
  });

  it('upsert + search returns nearest vector', () => {
    const vec = new Float32Array(256).fill(0.1);
    store.upsert('F042', vec);
    const results = store.search(vec, 5);
    assert.equal(results.length, 1);
    assert.equal(results[0].anchor, 'F042');
  });

  it('delete removes vector', () => {
    const vec = new Float32Array(256).fill(0.1);
    store.upsert('F042', vec);
    store.delete('F042');
    const results = store.search(vec, 5);
    assert.equal(results.length, 0);
  });

  it('initMeta stores model info', () => {
    store.initMeta({ modelId: 'qwen3-embedding-0.6b', modelRev: 'abc123', dim: 256 });
    const meta = store.getMeta();
    assert.equal(meta.modelId, 'qwen3-embedding-0.6b');
    assert.equal(meta.dim, '256');
  });

  it('checkMetaConsistency detects model change', () => {
    store.initMeta({ modelId: 'qwen3-embedding-0.6b', modelRev: 'abc', dim: 256 });
    const result = store.checkMetaConsistency({ modelId: 'multilingual-e5-small', modelRev: 'xyz', dim: 384 });
    assert.equal(result.consistent, false);
    assert.ok(result.reason.includes('model'));
  });

  it('clearAll empties vectors + meta', () => {
    const vec = new Float32Array(256).fill(0.1);
    store.upsert('F042', vec);
    store.initMeta({ modelId: 'test', modelRev: 'v1', dim: 256 });
    store.clearAll();
    const results = store.search(vec, 5);
    assert.equal(results.length, 0);
  });
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Implement VectorStore**

```typescript
// packages/api/src/domains/memory/VectorStore.ts
import type Database from 'better-sqlite3';
import type { EmbedModelInfo } from './interfaces.js';

export class VectorStore {
  constructor(private db: Database.Database, private dim: number) {}

  upsert(anchor: string, embedding: Float32Array): void {
    // vec0 uses DELETE + INSERT for upsert (no ON CONFLICT support)
    this.db.prepare('DELETE FROM evidence_vectors WHERE anchor = ?').run(anchor);
    this.db.prepare('INSERT INTO evidence_vectors (anchor, embedding) VALUES (?, ?)').run(anchor, embedding);
  }

  delete(anchor: string): void {
    this.db.prepare('DELETE FROM evidence_vectors WHERE anchor = ?').run(anchor);
  }

  search(queryVec: Float32Array, k: number): Array<{ anchor: string; distance: number }> {
    return this.db.prepare(`
      SELECT anchor, distance FROM evidence_vectors
      WHERE embedding MATCH ? AND k = ?
    `).all(queryVec, k) as Array<{ anchor: string; distance: number }>;
  }

  initMeta(info: EmbedModelInfo): void {
    const upsert = this.db.prepare('INSERT OR REPLACE INTO embedding_meta (key, value) VALUES (?, ?)');
    const tx = this.db.transaction(() => {
      upsert.run('embedding_model_id', info.modelId);
      upsert.run('embedding_model_rev', info.modelRev);
      upsert.run('embedding_dim', String(info.dim));
    });
    tx();
  }

  getMeta(): Record<string, string> {
    const rows = this.db.prepare('SELECT key, value FROM embedding_meta').all() as Array<{ key: string; value: string }>;
    return Object.fromEntries(rows.map(r => [r.key, r.value]));
  }

  checkMetaConsistency(current: EmbedModelInfo): { consistent: boolean; reason: string } {
    const meta = this.getMeta();
    if (!meta.embedding_model_id) return { consistent: true, reason: 'no prior meta' };
    if (meta.embedding_model_id !== current.modelId) return { consistent: false, reason: `model changed: ${meta.embedding_model_id} → ${current.modelId}` };
    if (meta.embedding_dim !== String(current.dim)) return { consistent: false, reason: `dim changed: ${meta.embedding_dim} → ${current.dim}` };
    return { consistent: true, reason: 'ok' };
  }

  clearAll(): void {
    this.db.exec('DELETE FROM evidence_vectors');
    this.db.exec('DELETE FROM embedding_meta');
  }

  count(): number {
    return (this.db.prepare('SELECT count(*) as c FROM evidence_vectors').get() as { c: number }).c;
  }
}
```

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/VectorStore.ts packages/api/test/memory/vector-store.test.js
git commit -m "feat(F102-C): VectorStore — vec0 CRUD + embedding_meta version anchor"
```

---

## Task 5: SemanticReranker — FTS 候选集 rerank

**目标**：AC-C8（rerank 不替代 lexical 召回）。这是连接 EmbeddingService + VectorStore 到搜索链路的胶水层。

**Files:**
- Create: `packages/api/src/domains/memory/SemanticReranker.ts`
- Test: `packages/api/test/memory/semantic-reranker.test.js`

**Step 1: Write failing test**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SemanticReranker } from '../src/domains/memory/SemanticReranker.js';

describe('SemanticReranker', () => {
  it('reranks candidates by pre-computed vector distance', () => {
    const reranker = new SemanticReranker();
    const candidates = [
      { anchor: 'F102', kind: 'feature', title: 'Memory', status: 'active', updatedAt: '' },
      { anchor: 'F042', kind: 'feature', title: 'Arch', status: 'active', updatedAt: '' },
      { anchor: 'F088', kind: 'feature', title: 'GW', status: 'active', updatedAt: '' },
    ];
    const vecResults = [
      { anchor: 'F042', distance: 0.1 },
      { anchor: 'F102', distance: 0.5 },
      { anchor: 'F088', distance: 0.9 },
    ];
    const result = reranker.rerankWithDistances(candidates, vecResults);
    // F042 is closest (distance 0.1), so should be first
    assert.equal(result[0].anchor, 'F042');
    assert.equal(result[1].anchor, 'F102');
    assert.equal(result[2].anchor, 'F088');
  });

  it('preserves candidates not in vector results (appended at end)', () => {
    const reranker = new SemanticReranker();
    const candidates = [
      { anchor: 'F999', kind: 'feature', title: 'Unknown', status: 'active', updatedAt: '' },
      { anchor: 'F042', kind: 'feature', title: 'Arch', status: 'active', updatedAt: '' },
    ];
    const vecResults = [{ anchor: 'F042', distance: 0.1 }];
    const result = reranker.rerankWithDistances(candidates, vecResults);
    assert.equal(result.length, 2);
    // F042 is in vector results so goes first; F999 appended at end
    assert.equal(result[0].anchor, 'F042');
    assert.equal(result[1].anchor, 'F999');
  });

  it('returns candidates unchanged when vecResults is empty', () => {
    const reranker = new SemanticReranker();
    const candidates = [
      { anchor: 'F102', kind: 'feature', title: 'Memory', status: 'active', updatedAt: '' },
    ];
    const result = reranker.rerankWithDistances(candidates, []);
    assert.equal(result[0].anchor, 'F102');
  });
});
```

**Step 2: Run test — verify FAIL**

**Step 3: Implement SemanticReranker**

> **P2 fix (codex review R2):** 统一为单一 API `rerankWithDistances(candidates, vecResults)`。
> Reranker 不持有 EmbeddingService/VectorStore 引用——它是纯函数式的排序工具。
> 调用方（SqliteEvidenceStore.search）负责计算 query vec + vectorStore.search，
> 把 pre-computed distances 传给 reranker。这避免了 sync/async 混用和依赖反转。

```typescript
// packages/api/src/domains/memory/SemanticReranker.ts
import type { EvidenceItem } from './interfaces.js';

export class SemanticReranker {
  /**
   * Rerank FTS candidates using pre-computed vector distances.
   * Candidates not found in vecResults are appended at the end (preserving original order).
   * Pure function — no side effects, no async, no external dependencies.
   */
  rerankWithDistances(
    candidates: EvidenceItem[],
    vecResults: Array<{ anchor: string; distance: number }>,
  ): EvidenceItem[] {
    if (candidates.length <= 1 || vecResults.length === 0) return candidates;

    const distMap = new Map(vecResults.map(v => [v.anchor, v.distance]));
    const withDist: Array<{ item: EvidenceItem; dist: number; hasVec: boolean }> = [];
    const noVec: EvidenceItem[] = [];

    for (const c of candidates) {
      const d = distMap.get(c.anchor);
      if (d !== undefined) {
        withDist.push({ item: c, dist: d, hasVec: true });
      } else {
        noVec.push(c);
      }
    }

    withDist.sort((a, b) => a.dist - b.dist);
    return [...withDist.map(w => w.item), ...noVec];
  }
}
```

Note: The old `rerank(query, candidates)` API is gone. All call sites use `rerankWithDistances`.

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/SemanticReranker.ts packages/api/test/memory/semantic-reranker.test.js
git commit -m "feat(F102-C): SemanticReranker — distance-sorted merge for FTS candidates"
```

---

## Task 6: SqliteEvidenceStore.search 集成 rerank

**目标**：在现有 search() 链路末端加 rerank 步骤。AC-C8 闭合。

**Files:**
- Modify: `packages/api/src/domains/memory/SqliteEvidenceStore.ts` — search() 增加 rerank
- Test: `packages/api/test/memory/sqlite-evidence-store.test.js` — 新增 rerank 集成测试

**Step 1: Write failing test — search with embedMode=on does rerank**

```javascript
// 在现有 describe 块内新增
describe('search with semantic rerank', () => {
  it('reranks FTS results when embedding is ready', async () => {
    // Setup: upsert 3 docs + their vectors (mock distances)
    // Search: verify order changed by vector distance
    // This test requires VectorStore + mock EmbeddingService wired in
  });

  it('falls back to lexical when embedding not ready', async () => {
    // Same query, but embedding.isReady() = false
    // Verify results are identical to pure FTS order
  });
});
```

**Step 2: Modify SqliteEvidenceStore constructor to accept optional embedding deps**

```typescript
constructor(
  dbPath: string,
  private embedConfig?: { embedding: IEmbeddingService; vectorStore: VectorStore; mode: 'off' | 'shadow' | 'on' }
)
```

**Step 3: Modify search() to call rerank at the end**

In `search()` method, after the existing FTS + dedup + sort logic:
```typescript
// Phase C: semantic rerank (only when mode=on and embedding ready)
if (this.embedConfig?.mode === 'on' && this.embedConfig.embedding.isReady()) {
  try {
    const queryVec = await this.embedConfig.embedding.embed([query]);
    const vecResults = this.embedConfig.vectorStore.search(queryVec[0], limit * 2);
    // P2 fix (codex review R2): unified API — caller passes pre-computed vec results
    const reranker = new SemanticReranker();
    results = reranker.rerankWithDistances(results, vecResults);
  } catch {
    // fail-open: rerank failed, return lexical order
  }
}
```

For `shadow` mode: run the same rerank logic but **return lexical results** (log A/B comparison to console):
```typescript
if (this.embedConfig?.mode === 'shadow' && this.embedConfig.embedding.isReady()) {
  try {
    const queryVec = await this.embedConfig.embedding.embed([query]);
    const vecResults = this.embedConfig.vectorStore.search(queryVec[0], limit * 2);
    const reranker = new SemanticReranker();
    const reranked = reranker.rerankWithDistances(results, vecResults);
    // Shadow: log comparison, return original lexical order
    console.log(`[F102-C shadow] lexical: ${results.map(r => r.anchor).join(',')} | reranked: ${reranked.map(r => r.anchor).join(',')}`);
  } catch {
    // shadow fail — silently ignore
  }
}
```

**Step 4: Run all existing + new tests — verify PASS**

```bash
cd packages/api && node --test test/memory/sqlite-evidence-store.test.js
```

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/SqliteEvidenceStore.ts packages/api/test/memory/sqlite-evidence-store.test.js
git commit -m "feat(F102-C): integrate semantic rerank into SqliteEvidenceStore.search"
```

---

## Task 7: IndexBuilder 增加 embedding 生成

**目标**：rebuild/incrementalUpdate 时为每个文档生成 embedding 并写入 vec0。AC-C6 版本锚一致性检查。

**Files:**
- Modify: `packages/api/src/domains/memory/IndexBuilder.ts` — rebuild 增加 embed 步骤
- Test: `packages/api/test/memory/index-builder.test.js` — 新增 embed 集成测试

**Step 1: Write failing test**

```javascript
describe('IndexBuilder with embedding', () => {
  it('rebuild generates vectors when embedding service ready', async () => {
    // Mock EmbeddingService + VectorStore
    // Rebuild with docs → verify vectorStore.upsert called for each doc
    // Verify embedding_meta written
  });

  it('rebuild skips vectors when embedding service not ready', async () => {
    // embedding.isReady() = false → rebuild still succeeds (lexical only)
    // vectorStore.count() = 0
  });

  it('rebuild detects model change and re-embeds all', async () => {
    // First rebuild with model A → verify meta
    // Second rebuild with model B → verify clearAll + re-embed
  });

  it('incrementalUpdate deletes stale vectors when doc removed', async () => {
    // P1 fix (codex review): doc deletion must sync to vectorStore.delete()
    // Setup: rebuild with 3 docs → delete 1 doc file → incrementalUpdate
    // Verify: vectorStore has 2 vectors (not 3)
  });

  it('incrementalUpdate embeds new/changed docs only', async () => {
    // Setup: rebuild with 2 docs → add 1 new doc → incrementalUpdate
    // Verify: vectorStore has 3 vectors, embed() called only once (for the new doc)
  });
});
```

**Step 2: Modify IndexBuilder constructor**

```typescript
constructor(
  private store: SqliteEvidenceStore,
  private docsRoot: string,
  private embedDeps?: { embedding: IEmbeddingService; vectorStore: VectorStore }
)
```

**Step 3: Add embed step to rebuild()**

After successful upsert to evidence_docs, batch embed summaries:
```typescript
if (this.embedDeps?.embedding.isReady()) {
  const { embedding, vectorStore } = this.embedDeps;
  // Version anchor check
  const consistency = vectorStore.checkMetaConsistency(embedding.getModelInfo());
  if (!consistency.consistent) {
    vectorStore.clearAll(); // re-embed all
  }
  // Batch embed summaries
  const textsToEmbed = indexedItems.map(i => `${i.title} ${i.summary ?? ''}`);
  const vectors = await embedding.embed(textsToEmbed);
  for (let i = 0; i < indexedItems.length; i++) {
    vectorStore.upsert(indexedItems[i].anchor, vectors[i]);
  }
  vectorStore.initMeta(embedding.getModelInfo());
}
```

**Step 3b: P1 fix — sync vector deletion in incrementalUpdate()**

> **codex review P1:** Doc deletion must propagate to `vectorStore.delete()`,
> otherwise stale vectors pollute rerank results.

In `incrementalUpdate()`, after deleting from `evidence_docs`:
```typescript
// When a doc is removed (file deleted or no longer in scan):
for (const removedAnchor of removedAnchors) {
  await this.store.deleteByAnchor(removedAnchor);
  // P1: sync vector deletion
  this.embedDeps?.vectorStore.delete(removedAnchor);
}

// When a doc is updated (hash changed):
for (const changedItem of changedItems) {
  await this.store.upsert([changedItem]);
  if (this.embedDeps?.embedding.isReady()) {
    const [vec] = await this.embedDeps.embedding.embed([`${changedItem.title} ${changedItem.summary ?? ''}`]);
    this.embedDeps.vectorStore.upsert(changedItem.anchor, vec);
  }
}
```

**Step 4: Run test — verify PASS**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/IndexBuilder.ts packages/api/test/memory/index-builder.test.js
git commit -m "feat(F102-C): IndexBuilder generates embeddings + version anchor check"
```

---

## Task 8: Factory 集成 + embed lifecycle

**目标**：`createMemoryServices` 根据 EmbedConfig 决定是否创建 EmbeddingService/VectorStore 并注入。

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts` — 增加 embed wiring
- Test: `packages/api/test/memory/factory.test.js` — 新增 embed factory 测试

**Step 1: Write failing test**

```javascript
describe('factory with embed config', () => {
  it('embedMode=off creates no embedding service', async () => {
    const services = await createMemoryServices({
      type: 'sqlite', sqlitePath: ':memory:',
      embed: { embedMode: 'off' },
    });
    assert.equal(services.embeddingService, undefined);
  });

  it('embedMode=shadow creates embedding service and calls load()', async () => {
    const services = await createMemoryServices({
      type: 'sqlite', sqlitePath: ':memory:',
      embed: { embedMode: 'shadow' },
    });
    assert.ok(services.embeddingService);
    // P1 fix verification: load() was called (may fail-open, but was called)
    // In unit test: mock EmbeddingService to verify load() invocation
  });

  it('embedMode=on with load() failure degrades gracefully (fail-open)', async () => {
    // Mock EmbeddingService.load() to throw
    // Verify: services still created, embeddingService exists but isReady()=false
    // Verify: search() returns pure lexical results (no crash)
  });
});
```

**Step 2: Update MemoryConfig + MemoryServices types**

```typescript
export interface MemoryConfig {
  type: 'sqlite' | 'hindsight';
  // ... existing fields
  embed?: Partial<EmbedConfig>;
}

export interface MemoryServices {
  // ... existing fields
  embeddingService?: IEmbeddingService;
  vectorStore?: VectorStore;
}
```

**Step 3: Update createSqliteServices — conditional embed wiring**

```typescript
async function createSqliteServices(config: MemoryConfig): Promise<MemoryServices> {
  const embedConfig = resolveEmbedConfig(config.embed);
  // ... existing store/indexBuilder creation

  let embeddingService: IEmbeddingService | undefined;
  let vectorStore: VectorStore | undefined;

  if (embedConfig.embedMode !== 'off') {
    embeddingService = new EmbeddingService(embedConfig);

    // P1 fix (codex review R2): explicitly call load() — without this,
    // isReady() stays false forever and embedMode=on/shadow silently degrades
    // to lexical-only. Wrapped in try-catch for AC-C4 fail-open.
    try {
      await embeddingService.load();
    } catch (err) {
      // fail-open: model download/load failed → embedding stays not ready
      // isReady() = false → search() skips rerank, IndexBuilder skips embed
      console.warn(`[F102-C] EmbeddingService.load() failed (fail-open): ${err}`);
      // Do NOT null out embeddingService — shadow mode still logs attempts
    }

    // Load sqlite-vec extension + ensure vec0 table (decoupled from migration)
    try {
      const sqliteVec = await import('sqlite-vec');
      sqliteVec.load(store.getDb());
      const ok = ensureVectorTable(store.getDb(), embedConfig.embedDim);
      if (ok) {
        vectorStore = new VectorStore(store.getDb(), embedConfig.embedDim);
      }
    } catch {
      // fail-open: sqlite-vec not available, no vector capabilities
    }
  }

  const indexBuilder = new IndexBuilder(store, docsRoot,
    embeddingService && vectorStore ? { embedding: embeddingService, vectorStore } : undefined
  );

  return { evidenceStore: store, markerQueue, reflectionService, knowledgeResolver, indexBuilder, materializationService, embeddingService, vectorStore };
}
```

**Step 4: Run test — verify PASS**

**Step 5: Run full test suite**

```bash
cd packages/api && node --test test/memory/
```

**Step 6: Commit**

```bash
git add packages/api/src/domains/memory/factory.ts packages/api/test/memory/factory.test.js
git commit -m "feat(F102-C): factory integrates EmbeddingService + VectorStore by embedMode"
```

---

## Task 9: Shadow A/B 评测脚手架

**目标**：AC-C7 — shadow 模式下采集 lexical vs rerank 的 Recall@k 指标，复用 eval corpus。

**Files:**
- Create: `packages/api/test/memory/embed-eval.test.js` — shadow A/B 评测
- Modify: `packages/api/test/memory/memory_eval_corpus.yaml` — 增加 semantic 测试用例

**Step 1: Write eval test**

```javascript
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

describe('Phase C eval: lexical vs semantic', () => {
  it('semantic rerank Recall@5 >= lexical baseline', () => {
    // This test runs only when EMBED_MODE=shadow or on
    // Skip if embedding not available
    const mode = process.env.EMBED_MODE ?? 'off';
    if (mode === 'off') {
      console.log('SKIP: EMBED_MODE=off, no semantic eval');
      return;
    }
    // Load eval corpus, run both lexical and reranked search
    // Compare Recall@5
  });
});
```

**Step 2: Add semantic-specific eval cases to corpus**

```yaml
  # --- Phase C: semantic cases (lexical might miss, embedding should catch) ---
  - id: S-01
    query: "记忆组件怎么存储"
    expected_anchors: [F102]
    note: "Chinese query for memory storage — needs semantic match"

  - id: S-02
    query: "how does the cat communication work"
    expected_anchors: [F088]
    note: "English paraphrase — FTS might miss, embedding should catch"
```

**Step 3: Commit**

```bash
git add packages/api/test/memory/embed-eval.test.js packages/api/test/memory/memory_eval_corpus.yaml
git commit -m "feat(F102-C): shadow A/B eval scaffold + semantic corpus cases"
```

---

## Task 10: Barrel export + 清理 + 全量测试

**目标**：确保所有新模块从 `index.ts` 导出，全量测试通过，`pnpm check` / `pnpm lint` 干净。

**Files:**
- Modify: `packages/api/src/domains/memory/index.ts` — 新增导出
- Run: `pnpm check && pnpm lint && node --test packages/api/test/memory/`

**Step 1: Update index.ts**

```typescript
export { EmbeddingService } from './EmbeddingService.js';
export { VectorStore } from './VectorStore.js';
export { SemanticReranker } from './SemanticReranker.js';
```

**Step 2: Run full quality checks**

```bash
pnpm check
pnpm lint
pnpm --filter @cat-cafe/api test:redis  # if applicable
cd packages/api && node --test test/memory/
```

**Step 3: Fix any lint/type issues**

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat(F102-C): barrel export + cleanup — Phase C complete"
```

---

## 测试策略（P2 fix: codex review）

> **原则**：单测全部 mock，真实模型推理放 integration profile。CI 不下载 600MB 模型。

| 层 | 测试文件 | 依赖 | CI 跑？ |
|----|----------|------|---------|
| **Unit** | embed-config.test.js | 无外部依赖 | ✅ 默认跑 |
| **Unit** | schema-v2.test.js | better-sqlite3 + sqlite-vec（本地 native） | ✅ 默认跑 |
| **Unit** | vector-store.test.js | better-sqlite3 + sqlite-vec | ✅ 默认跑 |
| **Unit** | embedding-service.test.js | **全 mock**（不下载模型） | ✅ 默认跑 |
| **Unit** | semantic-reranker.test.js | **全 mock** | ✅ 默认跑 |
| **Unit** | sqlite-evidence-store.test.js (rerank 新增) | mock EmbeddingService + 真实 sqlite-vec | ✅ 默认跑 |
| **Unit** | index-builder.test.js (embed 新增) | mock EmbeddingService + 真实 VectorStore | ✅ 默认跑 |
| **Unit** | factory.test.js | mock EmbeddingService | ✅ 默认跑 |
| **Integration** | embed-eval.test.js | 真实模型下载 + 真实 sqlite-vec | ❌ 仅 `EMBED_MODE=on` 时跑 |

**隔离方式**：
- EmbeddingService 单测用 mock pipeline（返回固定维度 Float32Array）
- 需要真实模型的测试用 `process.env.EMBED_MODE` 开关，默认 skip
- `embed-eval.test.js` 开头加 `if (mode === 'off') { skip }` guard

---

## AC Coverage Map

| AC | Task(s) | 验证方式 |
|----|---------|----------|
| AC-C1 三态开关 + 可配置模型 | T1, T8 | embed-config.test.js + factory.test.js |
| AC-C2 Qwen3 ONNX + MRL | T3 | embedding-service.test.js |
| AC-C3 evidence_vectors vec0 | T2, T4 | schema-v2.test.js + vector-store.test.js |
| AC-C4 fail-open | T3, T6, T8 | search 失败回落测试 |
| AC-C5 资源门禁 | T3, T8 | EmbeddingService timeout/memory tests + factory 降级 |
| AC-C6 版本锚 | T4, T7 | vector-store.test.js meta + IndexBuilder re-embed |
| AC-C7 shadow A/B | T9 | embed-eval.test.js |
| AC-C8 semantic rerank | T5, T6 | semantic-reranker.test.js + search 集成 |
| AC-C9 passages 预留 | T2 | schema 注释预留（不实现） |

---

## Review Gate

Phase C: **跨 family review（缅因猫优先）** — 新增 3 个模块 + 外部依赖（Transformers.js + sqlite-vec）需要安全审查。
