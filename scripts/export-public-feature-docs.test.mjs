/**
 * export-public-feature-docs — privacy gate regression tests
 *
 * Ensures `sync: false` frontmatter (and YAML variants) prevents export.
 * Root cause: F207 PII leak — sanitizer replaced names but not financial data.
 * This test pins the privacy gate behavior so future changes don't regress.
 */
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';

const ROOT = resolve(process.cwd());
const SCRIPT = resolve(ROOT, 'scripts/export-public-feature-docs.mjs');

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeFeatureDoc(frontmatterOverrides = {}) {
  const fm = {
    feature_ids: '[F999]',
    doc_kind: 'spec',
    created: '2026-01-01',
    ...frontmatterOverrides,
  };
  const lines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
  return `---\n${lines.join('\n')}\n---\n\n# F999: Test Feature\n\n> **Status**: in-progress | **Owner**: Ragdoll | **Priority**: P3\n\n## Why\n\nTest.\n\n## What\n\nTest.\n\n## Acceptance Criteria\n\n- [ ] AC-1: passes\n\n## Dependencies\n\nNone.\n\n## Risk\n\nNone.\n`;
}

function runExport(featuresDir, outputDir) {
  const result = execSync(`node ${SCRIPT} --features-dir ${featuresDir} --output-dir ${outputDir}`, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 15000,
  });
  return result;
}

function runDryRun(featuresDir) {
  const result = execSync(`node ${SCRIPT} --features-dir ${featuresDir} --dry-run`, {
    cwd: ROOT,
    encoding: 'utf-8',
    timeout: 15000,
  });
  return result;
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('export-public-feature-docs privacy gate', () => {
  let tmpDir;
  let featDir;
  let outDir;

  before(() => {
    tmpDir = mkdtempSync(join(resolve(ROOT, '..'), 'export-privacy-test-'));
    featDir = join(tmpDir, 'features');
    outDir = join(tmpDir, 'output');
    mkdirSync(featDir, { recursive: true });
    mkdirSync(outDir, { recursive: true });
  });

  after(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('exports a normal feature doc (no sync field)', () => {
    writeFileSync(join(featDir, 'F900-normal.md'), makeFeatureDoc(), 'utf-8');
    runExport(featDir, outDir);
    assert.ok(existsSync(join(outDir, 'F900-normal.md')), 'normal doc should be exported');
  });

  it('skips sync: false (exact)', () => {
    writeFileSync(join(featDir, 'F901-private.md'), makeFeatureDoc({ sync: 'false' }), 'utf-8');
    const output = runDryRun(featDir);
    assert.ok(output.includes('PRIVATE'), 'should show PRIVATE tier');
    assert.ok(!existsSync(join(outDir, 'F901-private.md')), 'private doc should not be exported');
    // Log output must redact filename for private docs (P2: stdout captured in CI/sync logs)
    assert.ok(!output.includes('F901-private.md'), 'private filename must not appear in log output');
    assert.ok(output.includes('[redacted]'), 'private entry should show [redacted] instead of filename');
  });

  it('skips sync: false # with inline comment', () => {
    writeFileSync(join(featDir, 'F902-comment.md'), makeFeatureDoc({ sync: 'false # contains PII' }), 'utf-8');
    const output = runDryRun(featDir);
    assert.ok(output.includes('PRIVATE'), 'inline comment variant should be caught as PRIVATE');
    assert.ok(!output.includes('F902-comment.md'), 'inline comment filename must be redacted from log');
  });

  it('skips sync: False (capitalized)', () => {
    writeFileSync(join(featDir, 'F903-caps.md'), makeFeatureDoc({ sync: 'False' }), 'utf-8');
    const output = runDryRun(featDir);
    assert.ok(output.includes('PRIVATE'), 'capitalized False should be caught as PRIVATE');
    assert.ok(!output.includes('F903-caps.md'), 'capitalized variant filename must be redacted from log');
  });

  it('skips sync: NO (YAML alias)', () => {
    writeFileSync(join(featDir, 'F904-no.md'), makeFeatureDoc({ sync: 'no' }), 'utf-8');
    const output = runDryRun(featDir);
    assert.ok(output.includes('PRIVATE'), 'YAML "no" should be caught as PRIVATE');
    assert.ok(!output.includes('F904-no.md'), 'YAML no filename must be redacted from log');
  });

  it('skips sync: off (YAML alias)', () => {
    writeFileSync(join(featDir, 'F905-off.md'), makeFeatureDoc({ sync: 'off' }), 'utf-8');
    const output = runDryRun(featDir);
    assert.ok(output.includes('PRIVATE'), 'YAML "off" should be caught as PRIVATE');
    assert.ok(!output.includes('F905-off.md'), 'YAML off filename must be redacted from log');
  });

  it('skips sync: "false" (double-quoted)', () => {
    writeFileSync(join(featDir, 'F907-dquote.md'), makeFeatureDoc({ sync: '"false"' }), 'utf-8');
    const output = runDryRun(featDir);
    assert.ok(output.includes('PRIVATE'), 'double-quoted "false" should be caught as PRIVATE');
    assert.ok(!output.includes('F907-dquote.md'), 'double-quoted filename must be redacted from log');
  });

  it("skips sync: 'false' (single-quoted)", () => {
    writeFileSync(join(featDir, 'F908-squote.md'), makeFeatureDoc({ sync: "'false'" }), 'utf-8');
    const output = runDryRun(featDir);
    assert.ok(output.includes('PRIVATE'), "single-quoted 'false' should be caught as PRIVATE");
    assert.ok(!output.includes('F908-squote.md'), 'single-quoted filename must be redacted from log');
  });

  it('does NOT skip sync: true', () => {
    writeFileSync(join(featDir, 'F906-true.md'), makeFeatureDoc({ sync: 'true' }), 'utf-8');
    runExport(featDir, outDir);
    assert.ok(existsSync(join(outDir, 'F906-true.md')), 'sync:true doc should be exported');
  });

  it('does NOT skip when sync field is absent', () => {
    // F900 has no sync field — it should appear in Exported (GREEN), not PRIVATE
    const output = runDryRun(featDir);
    const lines = output.split('\n');
    const f900Private = lines.some((l) => l.includes('PRIVATE') && l.includes('F900'));
    assert.ok(!f900Private, 'no-sync doc should not appear on a PRIVATE line');
    const f900Green = lines.some((l) => l.includes('GREEN') && l.includes('F900'));
    assert.ok(f900Green, 'no-sync doc should appear on a GREEN line');
  });

  it('real F207 is skipped (integration)', () => {
    // Run against actual docs/features/ if available
    const realFeatDir = resolve(ROOT, 'docs', 'features');
    if (!existsSync(join(realFeatDir, 'F207-personal-finance-infra.md'))) {
      return; // skip if not in a full repo
    }
    const output = runDryRun(realFeatDir);
    const lines = output.split('\n');
    const f207Private = lines.some((l) => l.includes('PRIVATE') && l.includes('F207'));
    assert.ok(f207Private, 'F207 must be on a PRIVATE line');
    const f207Green = lines.some((l) => l.includes('GREEN') && l.includes('F207'));
    assert.ok(!f207Green, 'F207 must not be on a GREEN line');
  });

  it('export summary JSON does not leak private filenames', () => {
    // Ensure F901 (sync:false) is present from earlier test
    writeFileSync(join(featDir, 'F901-private.md'), makeFeatureDoc({ sync: 'false' }), 'utf-8');
    // Clean output and run real export (not dry-run)
    const summaryOutDir = join(outDir, 'summary-test');
    mkdirSync(summaryOutDir, { recursive: true });
    runExport(featDir, summaryOutDir);
    const summaryPath = join(summaryOutDir, '.export-summary.json');
    assert.ok(existsSync(summaryPath), 'export summary should exist');
    const summary = JSON.parse(readFileSync(summaryPath, 'utf-8'));
    const hasPrivate = summary.skippedFiles.some((f) => f.includes('F901'));
    assert.ok(!hasPrivate, 'export summary must not include private (sync:false) filenames');
  });
});
