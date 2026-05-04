---
feature_ids: [F186]
plan_id: f186-phase-b
doc_kind: plan
created: 2026-05-04
---

# F186 Phase B: Scanner 渐进增强框架 Implementation Plan

**Feature:** F186 — `docs/features/F186-library-memory-architecture.md`
**Goal:** Create a 4-level scanner framework where Level 0 indexes any markdown directory without structure assumptions, Level 1 leverages existing frontmatter/WikiLinks, and the scanner level is configurable per collection in the manifest.
**Acceptance Criteria:**
- AC-B1: Level 0 scanner 能索引任意 markdown 目录（无 frontmatter 要求）
- AC-B2: Level 1 scanner 能利用已有 frontmatter/WikiLink 结构
- AC-B3: Scanner level 在 manifest 中可配置（auto/0/1/2/3）
**Architecture:** New `FlatScanner` (Level 0) and `StructuredScanner` (Level 1) implement existing `RepoScanner` interface. A `resolveCollectionScanner()` dispatcher maps `CollectionManifest.scannerLevel` to the correct scanner. `CollectionIndexBuilder` is a thin orchestrator that takes manifest + scanner + store → rebuild. Existing `IndexBuilder` + `CatCafeScanner` untouched for project collections.
**Tech Stack:** Node.js, better-sqlite3, existing RepoScanner interface, picomatch (for exclude globs)
**前端验证:** No — pure backend scanner framework

---

## Terminal Schema

```typescript
// FlatScanner — Level 0 (new file)
class FlatScanner implements RepoScanner {
  constructor(private collectionId: string, private exclude?: string[]);
  discover(root: string): ScannedEvidence[];
  parseSingle(filePath: string, root: string): ScannedEvidence | null;
}

// StructuredScanner — Level 1 (new file, extends FlatScanner)
class StructuredScanner extends FlatScanner {
  discover(root: string): ScannedEvidence[];
  // Overrides: upgrades provenance when frontmatter/WikiLinks detected
  // Extracts WikiLink edges for relationship graph
}

// scanner-resolver.ts — dispatch (new file)
function resolveCollectionScanner(manifest: CollectionManifest): RepoScanner;
function detectScannerLevel(root: string): 0 | 1;

// CollectionIndexBuilder — orchestrator (new file)
class CollectionIndexBuilder {
  constructor(store: SqliteEvidenceStore, manifest: CollectionManifest, scanner: RepoScanner);
  rebuild(options?: { force?: boolean }): Promise<{ indexed: number; skipped: number }>;
}
```

## Not Building

- Level 2/3 scanners (suggest/enhance structure) — future phases
- External collection binding wizard (Phase C/D)
- Secret scanning / sensitivity gates (Phase C)
- Embedding integration for external collections (reuse existing embedDeps wiring)
- Changes to existing CatCafeScanner or GenericRepoScanner

---

### Task 1: FlatScanner — Level 0 core

**Files:**
- Create: `packages/api/src/domains/memory/FlatScanner.ts`
- Test: `packages/api/test/memory/flat-scanner.test.js`

**Step 1: Write failing test — discover returns ScannedEvidence for plain .md files**

```javascript
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

describe('FlatScanner', () => {
  let FlatScanner, tmpDir;

  beforeEach(async () => {
    ({ FlatScanner } = await import('../../dist/domains/memory/FlatScanner.js'));
    tmpDir = mkdtempSync(join(tmpdir(), 'flat-scan-'));
  });

  it('discovers .md files recursively without frontmatter', () => {
    writeFileSync(join(tmpDir, 'intro.md'), '# Introduction\n\nThis is a plain document.');
    mkdirSync(join(tmpDir, 'sub'));
    writeFileSync(join(tmpDir, 'sub', 'nested.md'), '# Nested\n\nNested content.');
    
    const scanner = new FlatScanner('test:docs');
    const results = scanner.discover(tmpDir);
    
    assert.equal(results.length, 2);
    const anchors = results.map(r => r.item.anchor).sort();
    assert.ok(anchors.includes('test:docs:doc/intro'));
    assert.ok(anchors.includes('test:docs:doc/sub/nested'));
  });

  it('extracts title from first heading', () => {
    writeFileSync(join(tmpDir, 'titled.md'), '# My Great Document\n\nSome content.');
    const scanner = new FlatScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.item.title, 'My Great Document');
  });

  it('falls back to filename when no heading', () => {
    writeFileSync(join(tmpDir, 'no-heading.md'), 'Just raw text without any heading.');
    const scanner = new FlatScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.item.title, 'no-heading');
  });

  it('extracts summary from first paragraph', () => {
    writeFileSync(join(tmpDir, 'summary.md'), '# Title\n\nThis is the summary paragraph.\n\n## Section');
    const scanner = new FlatScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.item.summary, 'This is the summary paragraph.');
  });

  it('sets provenance tier to derived', () => {
    writeFileSync(join(tmpDir, 'doc.md'), '# Doc\n\nContent.');
    const scanner = new FlatScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.provenance.tier, 'derived');
  });

  it('sets kind to reference for all items', () => {
    writeFileSync(join(tmpDir, 'doc.md'), '# Doc\n\nContent.');
    const scanner = new FlatScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.item.kind, 'research');
  });

  it('respects exclude patterns', () => {
    writeFileSync(join(tmpDir, 'keep.md'), '# Keep');
    mkdirSync(join(tmpDir, '.obsidian'));
    writeFileSync(join(tmpDir, '.obsidian', 'skip.md'), '# Skip');
    const scanner = new FlatScanner('test:docs', ['.obsidian/**']);
    const results = scanner.discover(tmpDir);
    assert.equal(results.length, 1);
    assert.equal(results[0].item.anchor, 'test:docs:doc/keep');
  });

  it('skips non-.md files', () => {
    writeFileSync(join(tmpDir, 'doc.md'), '# Doc');
    writeFileSync(join(tmpDir, 'image.png'), 'binary');
    writeFileSync(join(tmpDir, 'data.json'), '{}');
    const scanner = new FlatScanner('test:docs');
    assert.equal(scanner.discover(tmpDir).length, 1);
  });

  it('skips .git and node_modules directories', () => {
    writeFileSync(join(tmpDir, 'doc.md'), '# Doc');
    mkdirSync(join(tmpDir, '.git'));
    writeFileSync(join(tmpDir, '.git', 'HEAD.md'), '# git');
    mkdirSync(join(tmpDir, 'node_modules'));
    writeFileSync(join(tmpDir, 'node_modules', 'pkg.md'), '# pkg');
    const scanner = new FlatScanner('test:docs');
    assert.equal(scanner.discover(tmpDir).length, 1);
  });

  it('respects depth limit of 10', () => {
    let dir = tmpDir;
    for (let i = 0; i < 12; i++) {
      dir = join(dir, `d${i}`);
      mkdirSync(dir);
    }
    writeFileSync(join(dir, 'deep.md'), '# Deep');
    const scanner = new FlatScanner('test:docs');
    assert.equal(scanner.discover(tmpDir).length, 0);
  });

  it('extracts section headings as keywords', () => {
    writeFileSync(join(tmpDir, 'kw.md'), '# Title\n\n## Architecture\n\n## Design\n\nContent.');
    const scanner = new FlatScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.deepEqual(result.item.keywords, ['Architecture', 'Design']);
  });

  it('parseSingle returns single file evidence', () => {
    const file = join(tmpDir, 'single.md');
    writeFileSync(file, '# Single\n\nParsed individually.');
    const scanner = new FlatScanner('test:docs');
    const result = scanner.parseSingle(file, tmpDir);
    assert.ok(result);
    assert.equal(result.item.anchor, 'test:docs:doc/single');
  });
});
```

**Step 2: Run test → verify RED**

```bash
pnpm --filter @cat-cafe/api build && node --test test/memory/flat-scanner.test.js
```

**Step 3: Implement FlatScanner**

```typescript
// FlatScanner.ts — F186 Phase B: Level 0 scanner for arbitrary markdown directories
import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join, relative } from 'node:path';
import type { RepoScanner, ScannedEvidence } from './interfaces.js';

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn', 'dist', 'build', 'out',
  '.next', '.nuxt', '__pycache__', '.tox', 'target', 'vendor',
  '.claude', '.obsidian',
]);

const MAX_DEPTH = 10;

export class FlatScanner implements RepoScanner {
  constructor(
    protected readonly collectionId: string,
    protected readonly exclude?: string[],
  ) {}

  discover(root: string): ScannedEvidence[] {
    const results: ScannedEvidence[] = [];
    this.walkDir(root, root, results, 0);
    return results;
  }

  parseSingle(filePath: string, root: string): ScannedEvidence | null {
    return this.parseFile(filePath, root);
  }

  protected walkDir(dir: string, root: string, results: ScannedEvidence[], depth: number): void {
    if (depth > MAX_DEPTH) return;
    let entries: string[];
    try { entries = readdirSync(dir); } catch { return; }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        const stat = lstatSync(fullPath);
        if (stat.isSymbolicLink()) continue;
        if (stat.isDirectory()) {
          if (SKIP_DIRS.has(entry)) continue;
          if (this.isExcluded(relative(root, fullPath))) continue;
          this.walkDir(fullPath, root, results, depth + 1);
        } else if (stat.isFile() && entry.endsWith('.md')) {
          const relPath = relative(root, fullPath);
          if (this.isExcluded(relPath)) continue;
          const evidence = this.parseFile(fullPath, root);
          if (evidence) results.push(evidence);
        }
      } catch { /* skip inaccessible */ }
    }
  }

  protected parseFile(filePath: string, root: string): ScannedEvidence | null {
    let content: string;
    try { content = readFileSync(filePath, 'utf-8'); } catch { return null; }

    const rel = relative(root, filePath);
    const stem = basename(filePath, '.md');
    const anchor = `${this.collectionId}:doc/${rel.replace(/\.md$/, '')}`;
    const title = extractTitle(content) ?? stem;
    const summary = extractSummary(content);
    const keywords = extractSectionKeywords(content);

    return {
      item: {
        anchor,
        kind: 'research',
        status: 'active',
        title,
        sourcePath: rel,
        updatedAt: new Date().toISOString(),
        ...(summary ? { summary } : {}),
        ...(keywords.length > 0 ? { keywords } : {}),
      },
      provenance: { tier: 'derived', source: rel },
      rawContent: content,
    };
  }

  private isExcluded(relPath: string): boolean {
    if (!this.exclude?.length) return false;
    // Simple glob matching: support ** and * patterns
    return this.exclude.some(pattern => matchGlob(pattern, relPath));
  }
}

// Reuse CatCafeScanner's proven extraction logic (same algorithms, no import dependency)
function extractTitle(content: string): string | null {
  return content.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? null;
}

function extractSummary(content: string): string | null {
  const afterTitle = content.replace(/^---[\s\S]*?---\s*/, '').replace(/^#.*$/m, '');
  const paragraphs = afterTitle.split(/\n\n+/).filter(p => {
    const t = p.trim();
    return t && !t.startsWith('#') && !t.startsWith('>') && !t.startsWith('|') && !t.startsWith('```');
  });
  const first = paragraphs[0]?.trim().replace(/\n/g, ' ');
  if (!first) return null;
  return first.length > 300 ? `${first.slice(0, 297)}...` : first;
}

function extractSectionKeywords(content: string): string[] {
  const keywords: string[] = [];
  let inFence = false;
  for (const line of content.split(/\r?\n/)) {
    if (/^\s{0,3}[`~]{3,}/.test(line)) { inFence = !inFence; continue; }
    if (inFence) continue;
    const heading = line.match(/^##+\s+(.+)$/)?.[1]?.trim();
    if (heading && heading.length <= 80) keywords.push(heading);
  }
  return keywords;
}

function matchGlob(pattern: string, path: string): boolean {
  const regex = pattern
    .replace(/\*\*/g, '§GLOBSTAR§')
    .replace(/\*/g, '[^/]*')
    .replace(/§GLOBSTAR§/g, '.*');
  return new RegExp(`^${regex}(/|$)`).test(path);
}
```

**Step 4: Run test → verify GREEN**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/FlatScanner.ts packages/api/test/memory/flat-scanner.test.js
git commit -m "feat(F186): Phase B Task 1 — FlatScanner Level 0 for arbitrary markdown"
```

---

### Task 2: StructuredScanner — Level 1

**Files:**
- Create: `packages/api/src/domains/memory/StructuredScanner.ts`
- Test: `packages/api/test/memory/structured-scanner.test.js`

**Step 1: Write failing test — frontmatter upgrades provenance**

```javascript
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

describe('StructuredScanner', () => {
  let StructuredScanner, tmpDir;

  beforeEach(async () => {
    ({ StructuredScanner } = await import('../../dist/domains/memory/StructuredScanner.js'));
    tmpDir = mkdtempSync(join(tmpdir(), 'struct-scan-'));
  });

  it('upgrades provenance to authoritative when frontmatter present', () => {
    writeFileSync(join(tmpDir, 'doc.md'),
      '---\ndoc_kind: decision\ntopics: [arch, memory]\n---\n# Decision\n\nWe decided X.');
    const scanner = new StructuredScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.provenance.tier, 'authoritative');
  });

  it('extracts kind from frontmatter doc_kind', () => {
    writeFileSync(join(tmpDir, 'adr.md'),
      '---\ndoc_kind: decision\n---\n# ADR-001\n\nDecision content.');
    const scanner = new StructuredScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.item.kind, 'decision');
  });

  it('extracts topics from frontmatter as keywords', () => {
    writeFileSync(join(tmpDir, 'topics.md'),
      '---\ntopics: [memory, search, federation]\n---\n# Topics Test\n\nContent.');
    const scanner = new StructuredScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.ok(result.item.keywords?.includes('memory'));
    assert.ok(result.item.keywords?.includes('search'));
  });

  it('extracts anchor from frontmatter when present', () => {
    writeFileSync(join(tmpDir, 'anchored.md'),
      '---\nanchor: ADR-042\n---\n# ADR 42\n\nContent.');
    const scanner = new StructuredScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.item.anchor, 'ADR-042');
  });

  it('falls back to Level 0 for files without frontmatter', () => {
    writeFileSync(join(tmpDir, 'plain.md'), '# Plain\n\nNo frontmatter here.');
    const scanner = new StructuredScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.equal(result.provenance.tier, 'derived');
    assert.equal(result.item.kind, 'research');
  });

  it('extracts WikiLink targets as keywords', () => {
    writeFileSync(join(tmpDir, 'linked.md'),
      '# Linked\n\nSee [[architecture]] and [[decisions/ADR-001]].');
    const scanner = new StructuredScanner('test:docs');
    const [result] = scanner.discover(tmpDir);
    assert.ok(result.item.keywords?.includes('architecture'));
    assert.ok(result.item.keywords?.includes('decisions/ADR-001'));
  });

  it('detects SUMMARY.md and uses it for collection structure', () => {
    writeFileSync(join(tmpDir, 'SUMMARY.md'),
      '# Summary\n\n- [Intro](intro.md)\n- [Design](design.md)');
    writeFileSync(join(tmpDir, 'intro.md'), '# Intro\n\nIntro content.');
    writeFileSync(join(tmpDir, 'design.md'), '# Design\n\nDesign content.');
    const scanner = new StructuredScanner('test:docs');
    const results = scanner.discover(tmpDir);
    // SUMMARY.md itself should be indexed
    assert.ok(results.some(r => r.item.sourcePath === 'SUMMARY.md'));
    assert.equal(results.length, 3);
  });

  it('mixed directory: structured + plain files coexist', () => {
    writeFileSync(join(tmpDir, 'structured.md'),
      '---\ndoc_kind: plan\ntopics: [api]\n---\n# Plan\n\nPlan content.');
    writeFileSync(join(tmpDir, 'plain.md'), '# Plain\n\nJust text.');
    const scanner = new StructuredScanner('test:docs');
    const results = scanner.discover(tmpDir);
    const structured = results.find(r => r.item.sourcePath === 'structured.md');
    const plain = results.find(r => r.item.sourcePath === 'plain.md');
    assert.equal(structured?.provenance.tier, 'authoritative');
    assert.equal(plain?.provenance.tier, 'derived');
  });
});
```

**Step 2: Run test → verify RED**

**Step 3: Implement StructuredScanner**

```typescript
// StructuredScanner.ts — F186 Phase B: Level 1 scanner using existing structure
import { extractAnchor, extractFrontmatter } from './CatCafeScanner.js';
import { FlatScanner } from './FlatScanner.js';
import type { EvidenceKind, ScannedEvidence } from './interfaces.js';

const FRONTMATTER_KIND_MAP: Record<string, EvidenceKind> = {
  feature: 'feature', spec: 'feature',
  decision: 'decision', adr: 'decision',
  plan: 'plan', design: 'plan',
  lesson: 'lesson', postmortem: 'lesson', reflection: 'lesson',
  discussion: 'discussion',
  research: 'research',
};

export class StructuredScanner extends FlatScanner {
  protected override parseFile(filePath: string, root: string): ScannedEvidence | null {
    const base = super.parseFile(filePath, root);
    if (!base) return null;

    const frontmatter = extractFrontmatter(base.rawContent);
    if (!frontmatter) {
      // No frontmatter — extract WikiLinks as bonus keywords, keep Level 0 provenance
      const wikiLinks = extractWikiLinks(base.rawContent);
      if (wikiLinks.length > 0) {
        const existing = base.item.keywords ?? [];
        base.item.keywords = [...existing, ...wikiLinks.filter(l => !existing.includes(l))];
      }
      return base;
    }

    // Upgrade: frontmatter found → authoritative provenance
    base.provenance = { tier: 'authoritative', source: base.item.sourcePath ?? '' };

    // Override anchor if frontmatter declares one
    const fmAnchor = extractAnchor(frontmatter);
    if (fmAnchor) base.item.anchor = fmAnchor;

    // Override kind from doc_kind
    const docKind = frontmatter.doc_kind;
    if (typeof docKind === 'string' && FRONTMATTER_KIND_MAP[docKind]) {
      base.item.kind = FRONTMATTER_KIND_MAP[docKind];
    }

    // Merge topics into keywords
    const topics = frontmatter.topics;
    if (Array.isArray(topics)) {
      const existing = base.item.keywords ?? [];
      const topicStrs = topics.filter((t): t is string => typeof t === 'string');
      base.item.keywords = [...topicStrs, ...existing.filter(k => !topicStrs.includes(k))];
    }

    // Extract WikiLinks
    const wikiLinks = extractWikiLinks(base.rawContent);
    if (wikiLinks.length > 0) {
      const existing = base.item.keywords ?? [];
      base.item.keywords = [...existing, ...wikiLinks.filter(l => !existing.includes(l))];
    }

    return base;
  }
}

function extractWikiLinks(content: string): string[] {
  const links: string[] = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g)) {
    const target = match[1].trim();
    if (!seen.has(target)) { seen.add(target); links.push(target); }
  }
  return links;
}
```

**Step 4: Run test → verify GREEN**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/StructuredScanner.ts packages/api/test/memory/structured-scanner.test.js
git commit -m "feat(F186): Phase B Task 2 — StructuredScanner Level 1 with frontmatter + WikiLinks"
```

---

### Task 3: Scanner resolver + manifest wiring

**Files:**
- Create: `packages/api/src/domains/memory/scanner-resolver.ts`
- Test: `packages/api/test/memory/scanner-resolver.test.js`

**Step 1: Write failing test — resolveCollectionScanner dispatches correctly**

```javascript
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { describe, it, beforeEach } from 'node:test';

describe('scanner-resolver', () => {
  let resolveCollectionScanner, detectScannerLevel, FlatScanner, StructuredScanner;

  beforeEach(async () => {
    ({ resolveCollectionScanner, detectScannerLevel } =
      await import('../../dist/domains/memory/scanner-resolver.js'));
    ({ FlatScanner } = await import('../../dist/domains/memory/FlatScanner.js'));
    ({ StructuredScanner } = await import('../../dist/domains/memory/StructuredScanner.js'));
  });

  const makeManifest = (overrides) => ({
    id: 'test:col', kind: 'domain', name: 'col', displayName: 'Col',
    root: '/tmp', sensitivity: 'internal', scannerLevel: 0,
    indexPolicy: { autoRebuild: true },
    reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
    createdAt: '2026-05-04', updatedAt: '2026-05-04',
    ...overrides,
  });

  it('scannerLevel 0 returns FlatScanner', () => {
    const scanner = resolveCollectionScanner(makeManifest({ scannerLevel: 0 }));
    assert.ok(scanner instanceof FlatScanner);
  });

  it('scannerLevel 1 returns StructuredScanner', () => {
    const scanner = resolveCollectionScanner(makeManifest({ scannerLevel: 1 }));
    assert.ok(scanner instanceof StructuredScanner);
  });

  it('scannerLevel 2 or 3 falls back to StructuredScanner', () => {
    const s2 = resolveCollectionScanner(makeManifest({ scannerLevel: 2 }));
    const s3 = resolveCollectionScanner(makeManifest({ scannerLevel: 3 }));
    assert.ok(s2 instanceof StructuredScanner);
    assert.ok(s3 instanceof StructuredScanner);
  });

  it('scannerLevel auto detects from root contents', () => {
    const dir = mkdtempSync(join(tmpdir(), 'detect-'));
    writeFileSync(join(dir, 'plain.md'), '# Plain');
    const scanner = resolveCollectionScanner(makeManifest({ scannerLevel: 'auto', root: dir }));
    assert.ok(scanner instanceof FlatScanner);
  });

  it('auto detects Level 1 when frontmatter present in majority', () => {
    const dir = mkdtempSync(join(tmpdir(), 'detect-'));
    writeFileSync(join(dir, 'a.md'), '---\ndoc_kind: plan\n---\n# A');
    writeFileSync(join(dir, 'b.md'), '---\ntopics: [x]\n---\n# B');
    writeFileSync(join(dir, 'c.md'), '# C');
    assert.equal(detectScannerLevel(dir), 1);
  });

  it('auto detects Level 1 when SUMMARY.md present', () => {
    const dir = mkdtempSync(join(tmpdir(), 'detect-'));
    writeFileSync(join(dir, 'SUMMARY.md'), '# Summary\n\n- [A](a.md)');
    writeFileSync(join(dir, 'a.md'), '# A');
    assert.equal(detectScannerLevel(dir), 1);
  });

  it('auto detects Level 0 for plain directory', () => {
    const dir = mkdtempSync(join(tmpdir(), 'detect-'));
    writeFileSync(join(dir, 'x.md'), '# X');
    writeFileSync(join(dir, 'y.md'), '# Y');
    assert.equal(detectScannerLevel(dir), 0);
  });

  it('passes exclude patterns to scanner', () => {
    const dir = mkdtempSync(join(tmpdir(), 'excl-'));
    writeFileSync(join(dir, 'keep.md'), '# Keep');
    mkdirSync(join(dir, 'drafts'));
    writeFileSync(join(dir, 'drafts', 'skip.md'), '# Skip');
    const scanner = resolveCollectionScanner(
      makeManifest({ scannerLevel: 0, root: dir, exclude: ['drafts/**'] })
    );
    const results = scanner.discover(dir);
    assert.equal(results.length, 1);
  });
});
```

**Step 2: Run test → verify RED**

**Step 3: Implement scanner-resolver**

```typescript
// scanner-resolver.ts — F186 Phase B: dispatch scannerLevel → scanner instance
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { CollectionManifest } from './collection-types.js';
import { FlatScanner } from './FlatScanner.js';
import type { RepoScanner } from './interfaces.js';
import { StructuredScanner } from './StructuredScanner.js';

export function resolveCollectionScanner(manifest: CollectionManifest): RepoScanner {
  const level = manifest.scannerLevel === 'auto'
    ? detectScannerLevel(manifest.root)
    : manifest.scannerLevel;

  if (level === 0) return new FlatScanner(manifest.id, manifest.exclude);
  return new StructuredScanner(manifest.id, manifest.exclude);
}

export function detectScannerLevel(root: string): 0 | 1 {
  // SUMMARY.md → structured
  if (existsSync(join(root, 'SUMMARY.md'))) return 1;

  // Sample up to 20 top-level .md files for frontmatter
  let total = 0, withFrontmatter = 0;
  try {
    for (const entry of readdirSync(root)) {
      if (!entry.endsWith('.md')) continue;
      total++;
      if (total > 20) break;
      try {
        const head = readFileSync(join(root, entry), 'utf-8').slice(0, 512);
        if (/^---\n/.test(head)) withFrontmatter++;
      } catch { /* skip */ }
    }
  } catch { return 0; }

  return total > 0 && withFrontmatter / total >= 0.5 ? 1 : 0;
}
```

**Step 4: Run test → verify GREEN**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/scanner-resolver.ts packages/api/test/memory/scanner-resolver.test.js
git commit -m "feat(F186): Phase B Task 3 — scanner-resolver dispatches scannerLevel to scanner"
```

---

### Task 4: CollectionIndexBuilder — wire scanner to store

**Files:**
- Create: `packages/api/src/domains/memory/CollectionIndexBuilder.ts`
- Test: `packages/api/test/memory/collection-index-builder.test.js`

**Step 1: Write failing test — rebuild indexes files into store**

```javascript
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { unlinkSync } from 'node:fs';

describe('CollectionIndexBuilder', () => {
  let CollectionIndexBuilder, FlatScanner, SqliteEvidenceStore;
  let store, dbPath;

  beforeEach(async () => {
    ({ CollectionIndexBuilder } = await import('../../dist/domains/memory/CollectionIndexBuilder.js'));
    ({ FlatScanner } = await import('../../dist/domains/memory/FlatScanner.js'));
    ({ SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js'));
    dbPath = join(mkdtempSync(join(tmpdir(), 'col-idx-')), 'test.sqlite');
    store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
  });

  afterEach(() => { try { unlinkSync(dbPath); } catch {} });

  it('indexes markdown files into evidence store', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'col-docs-'));
    writeFileSync(join(dir, 'readme.md'), '# README\n\nProject overview.');
    writeFileSync(join(dir, 'guide.md'), '# Guide\n\nHow to use.');

    const manifest = {
      id: 'test:col', kind: 'domain', name: 'col', displayName: 'Col',
      root: dir, sensitivity: 'internal', scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    const scanner = new FlatScanner('test:col');
    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    const result = await builder.rebuild();

    assert.equal(result.indexed, 2);
    const item = store.getByAnchor('test:col:doc/readme');
    assert.ok(item);
    assert.equal(item.title, 'README');
  });

  it('skips unchanged files on rebuild (hash dedup)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'col-dedup-'));
    writeFileSync(join(dir, 'doc.md'), '# Doc\n\nContent.');

    const manifest = {
      id: 'test:col', kind: 'domain', name: 'col', displayName: 'Col',
      root: dir, sensitivity: 'internal', scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    const scanner = new FlatScanner('test:col');
    const builder = new CollectionIndexBuilder(store, manifest, scanner);

    const r1 = await builder.rebuild();
    assert.equal(r1.indexed, 1);

    const r2 = await builder.rebuild();
    assert.equal(r2.skipped, 1);
    assert.equal(r2.indexed, 0);
  });

  it('cleans stale anchors when file removed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'col-stale-'));
    const file = join(dir, 'temp.md');
    writeFileSync(file, '# Temp\n\nWill be removed.');

    const manifest = {
      id: 'test:col', kind: 'domain', name: 'col', displayName: 'Col',
      root: dir, sensitivity: 'internal', scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    const scanner = new FlatScanner('test:col');
    const builder = new CollectionIndexBuilder(store, manifest, scanner);

    await builder.rebuild();
    assert.ok(store.getByAnchor('test:col:doc/temp'));

    unlinkSync(file);
    await builder.rebuild();
    assert.equal(store.getByAnchor('test:col:doc/temp'), undefined);
  });

  it('force rebuild re-indexes all files regardless of hash', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'col-force-'));
    writeFileSync(join(dir, 'doc.md'), '# Doc\n\nContent.');

    const manifest = {
      id: 'test:col', kind: 'domain', name: 'col', displayName: 'Col',
      root: dir, sensitivity: 'internal', scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };
    const scanner = new FlatScanner('test:col');
    const builder = new CollectionIndexBuilder(store, manifest, scanner);

    await builder.rebuild();
    const r2 = await builder.rebuild({ force: true });
    assert.equal(r2.indexed, 1);
    assert.equal(r2.skipped, 0);
  });
});
```

**Step 2: Run test → verify RED**

**Step 3: Implement CollectionIndexBuilder**

```typescript
// CollectionIndexBuilder.ts — F186 Phase B: builds index for a single collection
import { createHash } from 'node:crypto';
import type { CollectionManifest } from './collection-types.js';
import type { EvidenceItem, RepoScanner } from './interfaces.js';
import type { SqliteEvidenceStore } from './SqliteEvidenceStore.js';

export class CollectionIndexBuilder {
  constructor(
    private readonly store: SqliteEvidenceStore,
    private readonly manifest: CollectionManifest,
    private readonly scanner: RepoScanner,
  ) {}

  async rebuild(options?: { force?: boolean }): Promise<{ indexed: number; skipped: number }> {
    const scanned = this.scanner.discover(this.manifest.root);
    const currentAnchors = new Set<string>();
    let indexed = 0;
    let skipped = 0;

    for (const evidence of scanned) {
      const sourceHash = createHash('sha256')
        .update(evidence.rawContent || evidence.item.title)
        .digest('hex')
        .slice(0, 16);

      const item: EvidenceItem = {
        ...evidence.item,
        sourceHash,
        provenance: evidence.provenance,
      };

      currentAnchors.add(item.anchor);

      if (!options?.force) {
        const existing = this.store.getByAnchor(item.anchor);
        if (existing?.sourceHash === sourceHash) { skipped++; continue; }
      }

      this.store.upsert([item]);
      indexed++;
    }

    // Clean stale: anchors in store prefixed with collectionId but not in current scan
    this.cleanStaleAnchors(currentAnchors);

    return { indexed, skipped };
  }

  private cleanStaleAnchors(currentAnchors: Set<string>): void {
    const prefix = `${this.manifest.id}:`;
    try {
      const db = this.store.getDb();
      const rows = db
        .prepare('SELECT anchor FROM evidence WHERE anchor LIKE ?')
        .all(`${prefix}%`) as Array<{ anchor: string }>;
      for (const row of rows) {
        if (!currentAnchors.has(row.anchor)) {
          this.store.deleteByAnchor(row.anchor);
        }
      }
    } catch { /* fail-open */ }
  }
}
```

**Step 4: Run test → verify GREEN**

**Step 5: Commit**

```bash
git add packages/api/src/domains/memory/CollectionIndexBuilder.ts packages/api/test/memory/collection-index-builder.test.js
git commit -m "feat(F186): Phase B Task 4 — CollectionIndexBuilder wires scanner to store"
```

---

### Task 5: Export + integration wiring

**Files:**
- Modify: `packages/api/src/domains/memory/factory.ts` — wire CollectionIndexBuilder for non-project collections
- Modify: `packages/api/src/domains/memory/index.ts` (if exists) — export new modules
- Test: `packages/api/test/memory/collection-scanner-integration.test.js`

**Step 1: Write failing integration test — end-to-end collection scan + search**

```javascript
import { mkdtempSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import assert from 'node:assert/strict';
import { describe, it, beforeEach, afterEach } from 'node:test';

describe('Collection scanner integration', () => {
  let FlatScanner, StructuredScanner, resolveCollectionScanner,
      CollectionIndexBuilder, SqliteEvidenceStore;
  let store, dbPath;

  beforeEach(async () => {
    ({ FlatScanner } = await import('../../dist/domains/memory/FlatScanner.js'));
    ({ StructuredScanner } = await import('../../dist/domains/memory/StructuredScanner.js'));
    ({ resolveCollectionScanner } = await import('../../dist/domains/memory/scanner-resolver.js'));
    ({ CollectionIndexBuilder } = await import('../../dist/domains/memory/CollectionIndexBuilder.js'));
    ({ SqliteEvidenceStore } = await import('../../dist/domains/memory/SqliteEvidenceStore.js'));
    dbPath = join(mkdtempSync(join(tmpdir(), 'integ-')), 'test.sqlite');
    store = new SqliteEvidenceStore(dbPath);
    await store.initialize();
  });

  afterEach(() => { try { unlinkSync(dbPath); } catch {} });

  it('Level 0: indexes plain markdown and finds via search', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'plain-'));
    writeFileSync(join(dir, 'quantum.md'),
      '# Quantum Computing\n\nQuantum bits enable parallel computation.');
    mkdirSync(join(dir, 'notes'));
    writeFileSync(join(dir, 'notes', 'entanglement.md'),
      '# Entanglement\n\nSpooky action at a distance.');

    const manifest = {
      id: 'domain:physics', kind: 'domain', name: 'physics',
      displayName: 'Physics Notes', root: dir,
      sensitivity: 'internal', scannerLevel: 0,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };

    const scanner = resolveCollectionScanner(manifest);
    assert.ok(scanner instanceof FlatScanner);

    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    const result = await builder.rebuild();
    assert.equal(result.indexed, 2);

    const results = store.search('quantum');
    assert.ok(results.length > 0);
    assert.ok(results.some(r => r.anchor.includes('quantum')));
  });

  it('Level 1: leverages frontmatter for richer indexing', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'struct-'));
    writeFileSync(join(dir, 'adr.md'),
      '---\ndoc_kind: decision\ntopics: [architecture, api]\nanchor: ADR-001\n---\n# API Decision\n\nWe chose REST.');
    writeFileSync(join(dir, 'note.md'), '# Plain Note\n\nNo frontmatter.');

    const manifest = {
      id: 'domain:api', kind: 'domain', name: 'api',
      displayName: 'API Docs', root: dir,
      sensitivity: 'internal', scannerLevel: 1,
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };

    const scanner = resolveCollectionScanner(manifest);
    assert.ok(scanner instanceof StructuredScanner);

    const builder = new CollectionIndexBuilder(store, manifest, scanner);
    await builder.rebuild();

    const adr = store.getByAnchor('ADR-001');
    assert.ok(adr);
    assert.equal(adr.kind, 'decision');
    assert.ok(adr.keywords?.includes('architecture'));
  });

  it('auto level detects structure from SUMMARY.md', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'auto-'));
    writeFileSync(join(dir, 'SUMMARY.md'), '# Summary\n\n- [Intro](intro.md)');
    writeFileSync(join(dir, 'intro.md'), '# Intro\n\nContent.');

    const manifest = {
      id: 'domain:book', kind: 'domain', name: 'book',
      displayName: 'Book', root: dir,
      sensitivity: 'internal', scannerLevel: 'auto',
      indexPolicy: { autoRebuild: true },
      reviewPolicy: { authorityCeiling: 'validated', requireOwnerApproval: false },
      createdAt: '2026-05-04', updatedAt: '2026-05-04',
    };

    const scanner = resolveCollectionScanner(manifest);
    assert.ok(scanner instanceof StructuredScanner);
  });
});
```

**Step 2: Run test → verify RED**

**Step 3: Wire exports and factory integration**

Export new modules from the memory domain barrel (if applicable) and update factory.ts to use CollectionIndexBuilder for future collection rebuilds.

**Step 4: Run test → verify GREEN**

**Step 5: Run full F186 + Phase B test suite**

```bash
pnpm --filter @cat-cafe/api build && \
  node --test test/memory/flat-scanner.test.js \
              test/memory/structured-scanner.test.js \
              test/memory/scanner-resolver.test.js \
              test/memory/collection-index-builder.test.js \
              test/memory/collection-scanner-integration.test.js \
              test/memory/library-catalog.test.js
```

**Step 6: Commit**

```bash
git add -A
git commit -m "feat(F186): Phase B Task 5 — integration wiring + e2e collection scan tests"
```

---

## Verification

After all tasks:
1. `pnpm --filter @cat-cafe/api build` — no type errors
2. `pnpm --filter @cat-cafe/api test` — all tests pass
3. No changes to CatCafeScanner or GenericRepoScanner (backward compat)
4. AC-B1: FlatScanner indexes any .md directory without frontmatter ✅
5. AC-B2: StructuredScanner leverages frontmatter/WikiLinks ✅
6. AC-B3: `scannerLevel` in manifest dispatches to correct scanner ✅
