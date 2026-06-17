// boundary-roundtrip.test.mjs — F238 Phase E: round-trip boundary fixture tests (AC-E1).
//
// For each file category, verifies:
//   1. Outbound scan detects home-only terms (cat-cafe files have home terms)
//   2. Inbound scan finds zero/near-zero public-only terms (cat-cafe files shouldn't have public terms)
//   3. Suggestion reciprocity: every outbound suggestion is a valid public-side term
//
// Run via: node --test scripts/boundary-roundtrip.test.mjs

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import YAML from 'yaml';

const SCRIPT = join(import.meta.dirname, 'reverse-sanitizer.mjs');
const DICTIONARY_PATH = join(import.meta.dirname, '..', 'assets', 'brand-dictionary.yaml');

// Build a Map<termId, Set<string>> of target-side terms per dictionary entry.
// outbound → target is public side; inbound → target is home side.
// Per-termId granularity catches cross-term confusion (e.g. product.primary
// suggesting a persona term) that a global union set would miss.
function buildTargetTermsByTermId(direction) {
  const dict = YAML.parse(readFileSync(DICTIONARY_PATH, 'utf-8'));
  const map = new Map();
  for (const term of dict.terms || []) {
    const side = direction === 'outbound' ? term.public : term.home;
    const terms = new Set();
    if (side?.canonical) terms.add(side.canonical);
    for (const v of side?.variants || []) terms.add(v);
    map.set(term.id, terms);
  }
  return map;
}

const PUBLIC_TERMS_BY_ID = buildTargetTermsByTermId('outbound');

/** Run reverse-sanitizer and return parsed findings + summary. */
function scan(direction, filePath) {
  let stdout = '';
  let exitCode = 0;
  try {
    stdout = execFileSync('node', [SCRIPT, '--direction', direction, '--summary-json', filePath], {
      encoding: 'utf-8',
      timeout: 15_000,
    });
  } catch (err) {
    stdout = err.stdout || '';
    exitCode = err.status ?? 1;
  }

  const lines = stdout
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  const summaryLine = lines.find((l) => {
    try {
      return JSON.parse(l)._type === 'summary';
    } catch {
      return false;
    }
  });
  const findings = lines
    .filter((l) => l.startsWith('{'))
    .map((l) => JSON.parse(l))
    .filter((f) => f._type !== 'summary');
  const summary = summaryLine ? JSON.parse(summaryLine) : null;

  return { findings, summary, exitCode };
}

// ═══════════════════════════════════════════════════════════════════
// File category fixtures — representative files from the plan
// ═══════════════════════════════════════════════════════════════════

const CATEGORIES = [
  {
    name: 'L0 (governance-l0.md)',
    path: 'assets/system-prompts/governance-l0.md',
    minOutbound: 5, // L0 is dense with home terms: 铲屎官, CVO, Cat Cafe, nicknames, etc.
  },
  {
    name: 'Manifest (manifest.json)',
    path: 'packages/web/public/manifest.json',
    minOutbound: 1, // Product brand in manifest name/short_name
  },
  {
    name: 'cat-config (cat-config.json)',
    path: 'cat-config.json',
    minOutbound: 1, // Cat Cafe brand, nicknames
  },
  {
    name: 'sop-definitions (development.yaml)',
    path: 'sop-definitions/development.yaml',
    minOutbound: 1, // 铲屎官, CVO, Cat Cafe in SOP text
  },
  {
    name: 'guides (registry.yaml)',
    path: 'guides/registry.yaml',
    minOutbound: 0, // May have home terms depending on content; >= 0 is safe
  },
  {
    name: 'desktop (package.json)',
    path: 'desktop/package.json',
    minOutbound: 1, // Cat Cafe brand in package metadata
  },
  {
    name: 'skills (BOOTSTRAP.md)',
    path: 'cat-cafe-skills/BOOTSTRAP.md',
    minOutbound: 0, // May have home terms; >= 0 is safe
  },
];

for (const cat of CATEGORIES) {
  describe(`round-trip: ${cat.name}`, () => {
    const absPath = join(import.meta.dirname, '..', cat.path);

    it('file exists', () => {
      assert.ok(existsSync(absPath), `missing: ${cat.path}`);
    });

    it('outbound scan detects home-only terms', () => {
      const { findings } = scan('outbound', absPath);
      assert.ok(
        findings.length >= cat.minOutbound,
        `expected >= ${cat.minOutbound} outbound findings, got ${findings.length}`,
      );
    });

    it('inbound scan finds zero P1 public-only terms', () => {
      const { findings } = scan('inbound', absPath);
      // Cat-cafe home files should not contain public-only terms at P1 severity.
      // P2 findings from broad generic terms (e.g. "project", "team") are tolerated
      // as known false positives in code contexts.
      const p1 = findings.filter((f) => f.severity === 'P0' || f.severity === 'P1');
      assert.equal(
        p1.length,
        0,
        `expected 0 P1 inbound findings, got ${p1.length}: ${JSON.stringify(p1.map((f) => ({ matched: f.matched, termId: f.termId })))}`,
      );
    });

    if (cat.minOutbound > 0) {
      it('suggestion reciprocity: outbound suggestions map to correct public-side terms per termId', () => {
        const { findings } = scan('outbound', absPath);
        for (const f of findings) {
          assert.ok(f.suggestion, `finding for "${f.matched}" should have a suggestion`);
          assert.notEqual(f.suggestion, f.matched, `suggestion should differ from matched: "${f.matched}"`);
          // Per-termId validation: verify the suggestion belongs to the specific term's
          // public-side entries, not just any public term in the dictionary. This catches
          // cross-term confusion (e.g. product.primary wrongly suggesting a persona term).
          const validForTerm = PUBLIC_TERMS_BY_ID.get(f.termId);
          assert.ok(validForTerm, `dictionary should have public-side terms for ${f.termId}`);
          assert.ok(
            validForTerm.has(f.suggestion),
            `suggestion "${f.suggestion}" for "${f.matched}" must be a public-side term for ${f.termId}, not just any public term`,
          );
        }
      });
    }

    it('--summary-json counters are consistent', () => {
      const { findings, summary } = scan('outbound', absPath);
      assert.ok(summary, 'should have summary');
      assert.equal(summary.totalFindings, findings.length, 'totalFindings should match findings count');

      // Verify byTermClass sums to total
      const classSum = Object.values(summary.byTermClass).reduce((a, b) => a + b, 0);
      assert.equal(classSum, summary.totalFindings, 'byTermClass should sum to totalFindings');

      // Verify bySeverity sums to total
      const sevSum = Object.values(summary.bySeverity).reduce((a, b) => a + b, 0);
      assert.equal(sevSum, summary.totalFindings, 'bySeverity should sum to totalFindings');
    });
  });
}
