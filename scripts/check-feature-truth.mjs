#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRepoRoot = resolve(scriptDir, '..');
const repoRoot = process.argv[2] ? resolve(process.argv[2]) : defaultRepoRoot;

const backlogPath = join(repoRoot, 'docs', 'BACKLOG.md');
const roadmapPath = join(repoRoot, 'docs', 'ROADMAP.md');
const generatorPath = join(repoRoot, 'scripts', 'generate-feature-index.mjs');

function isDoneStatus(status) {
  // Strip markdown bold (**) AND leading decorations (emoji / ✅ / symbols / whitespace)
  // before testing — feature docs use **done**, closed, "✅ closed", "done ✅", etc.
  // (F180 used an emoji *prefix* "✅ closed" which broke the bare ^(done|closed) match.)
  const plain = String(status ?? '')
    .replace(/\*+/g, '')
    .replace(/^[^A-Za-z]+/, '');
  return /^(done|closed)\b/i.test(plain);
}

function parseBacklogFeatureIds(markdown) {
  const ids = new Set();
  const lines = markdown.split(/\r?\n/);

  for (const line of lines) {
    const match = line.match(/^\|\s*(F\d{3,4})\s*\|/);
    if (match) {
      ids.add(match[1]);
    }
  }
  return ids;
}

function loadJson(path) {
  if (!existsSync(path)) {
    throw new Error(`Missing file: ${path}`);
  }
  const raw = readFileSync(path, 'utf-8');
  return JSON.parse(raw);
}

function resolveTruthDocPath() {
  if (existsSync(backlogPath)) {
    return { path: backlogPath, label: 'BACKLOG' };
  }

  if (existsSync(roadmapPath)) {
    return { path: roadmapPath, label: 'ROADMAP' };
  }

  throw new Error(`Missing backlog/roadmap: ${backlogPath} | ${roadmapPath}`);
}

function buildFeatureStatusMap(features) {
  const map = new Map();

  for (const feature of features) {
    const id = feature?.id;
    if (typeof id !== 'string' || !/^F\d{3,4}$/.test(id)) {
      continue;
    }

    const status = String(feature?.status ?? '');
    const entry = map.get(id) ?? { hasActive: false, hasDone: false };
    if (isDoneStatus(status)) {
      entry.hasDone = true;
    } else {
      entry.hasActive = true;
    }
    map.set(id, entry);
  }

  return map;
}

// --- Feature doc internal truth: Status line vs ## Timeline -----------------
// Catches the OBVIOUS, zero-ambiguity drift only: a feature doc whose Status
// claims work hasn't started (pre-development) while its ## Timeline already
// records a merged PR. Deliberately narrow — semantic checks (AC-claimed vs
// code-done, Phase ✅ vs actual code) stay human (merge-gate Step 7.5a).
// `in-progress` is NOT flagged: ~35 real docs legitimately sit at in-progress
// with already-merged Phases (normal multi-phase state).
const PRE_DEV_STATUSES = new Set(['spec', 'design', 'idea', 'draft', 'spike', 'proposed', 'planning', 'todo']);

function parseStatusLine(content) {
  // Same Status anchor as generate-feature-index.mjs parseStatus().
  const match = content.match(/>\s*\*\*Status\*\*:\s*([^\n<>]+)/i);
  if (!match) return null;
  // First token only — Status lines carry pipe/parenthetical context
  // ("spec (Phase E planned) | Owner: ...", "done（2026-06-22）").
  const firstToken = match[1]
    .trim()
    .toLowerCase()
    .split(/[\s（()）/／,，、|]/)[0];
  return { line: match[0], firstToken };
}

function timelineHasMergedPr(content) {
  // Scope strictly to the "## Timeline" section so a merged-PR mention elsewhere
  // (e.g. a Status line "merged (#2126)") can't false-positive.
  const lines = content.split(/\r?\n/);
  const startIdx = lines.findIndex((line) => /^##\s+Timeline\s*$/.test(line));
  if (startIdx === -1) return false;
  const rest = lines.slice(startIdx + 1);
  const endRel = rest.findIndex((line) => /^##\s/.test(line));
  const sectionLines = endRel === -1 ? rest : rest.slice(0, endRel);
  // Row-level: the SAME line must carry both "merged" and a PR ref (#NNN). A
  // cross-row coincidence ("issue #123 opened" on one row, "Phase A merged" on
  // another) is NOT a merged PR (peer-review hardening, P1).
  // Negation guard (cloud-review P2): "PR #123 not merged" / "not yet merged" /
  // "to be merged" honestly track an OPEN PR — they carry "merged" + "#NNN" but
  // nothing landed, so they must NOT be read as a merged PR. Negation must be
  // adjacent to "merged" so "not a blocker, Phase A merged (#1)" stays a hit.
  const NEGATED_MERGE =
    /\b(?:not|never|to\s+be|to-be|will(?:\s+be)?|yet\s+to(?:\s+be)?|pending|awaiting)\s+(?:yet\s+|be\s+)?merged\b/i;
  return sectionLines.some((line) => /\bmerged\b/i.test(line) && /#\d+/.test(line) && !NEGATED_MERGE.test(line));
}

function checkDocStatusDrift(repoRoot, generatedFeatures, errors) {
  const featuresDir = join(repoRoot, 'docs', 'features');
  let scanned = 0;
  // Walk only the canonical features the generated index vouches for. The index
  // already excludes verification docs (generate-feature-index isVerificationDoc),
  // so a verification report with a spec Status + merged Timeline never blocks
  // merge-gate (peer-review hardening, P2). Each index entry carries `file`.
  for (const feature of generatedFeatures) {
    if (typeof feature?.file !== 'string' || typeof feature?.id !== 'string') {
      continue;
    }
    const filePath = join(featuresDir, feature.file);
    if (!existsSync(filePath)) {
      continue;
    }
    const content = readFileSync(filePath, 'utf-8');
    scanned += 1;
    const status = parseStatusLine(content);
    if (!status || !PRE_DEV_STATUSES.has(status.firstToken)) {
      continue;
    }
    // Reopen exemption (mechanical grep, not semantic judgement): a reopened
    // feature legitimately sits at "spec (next Phase)" while old Phases are merged.
    if (/reopen/i.test(status.line)) {
      continue;
    }
    if (timelineHasMergedPr(content)) {
      errors.push(
        `[doc-status-drift] ${feature.id}: Status="${status.firstToken}" (pre-development) but ## Timeline records a merged PR — doc claims work hasn't started while code is already merged. Advance Status (in-progress/done) or add a reopen marker.`,
      );
    }
  }
  return scanned;
}

function generateFreshIndex(outputPath) {
  if (!existsSync(generatorPath)) {
    throw new Error(`Missing generator script: ${generatorPath}`);
  }

  execFileSync('node', [generatorPath, '--output', outputPath], {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

function main() {
  const errors = [];
  const tempDir = mkdtempSync(join(tmpdir(), 'cc-feature-truth-'));
  const generatedIndexPath = join(tempDir, 'index.json');

  try {
    // docs/features/index.json is a derived artifact with no live consumer:
    // the runtime builds its feature index from the docs directly and the
    // opensource sync regenerates it fresh. It is no longer committed, so we
    // regenerate it into a tempdir and validate truth from that fresh copy.
    // There is nothing to diff a committed file against — which removes the
    // merge-order staleness that only ever produced gate noise.
    generateFreshIndex(generatedIndexPath);

    const truthDoc = resolveTruthDocPath();
    const backlogMarkdown = readFileSync(truthDoc.path, 'utf-8');
    const generatedIndex = loadJson(generatedIndexPath);

    const generatedFeatures = Array.isArray(generatedIndex.features) ? generatedIndex.features : [];

    const backlogIds = parseBacklogFeatureIds(backlogMarkdown);
    const statusMap = buildFeatureStatusMap(generatedFeatures);

    for (const backlogId of backlogIds) {
      const entry = statusMap.get(backlogId);
      if (!entry) {
        errors.push(`[backlog-ref] ${truthDoc.label} contains ${backlogId}, but no such feature exists in index`);
        continue;
      }
      if (!entry.hasActive && entry.hasDone) {
        errors.push(`[backlog-active] ${truthDoc.label} contains ${backlogId}, but all records are done`);
      }
    }

    for (const [featureId, entry] of statusMap.entries()) {
      if (entry.hasActive && !backlogIds.has(featureId)) {
        errors.push(`[backlog-missing] Active feature ${featureId} is missing from ${truthDoc.label}`);
      }
    }

    const featureDocsScanned = checkDocStatusDrift(repoRoot, generatedFeatures, errors);

    if (errors.length > 0) {
      console.error(`FAIL check-feature-truth: ${errors.length} issue(s) found`);
      for (const error of errors) {
        console.error(`  - ${error}`);
      }
      process.exit(1);
    }

    console.log(
      `PASS check-feature-truth: features=${generatedFeatures.length} ${truthDoc.label.toLowerCase()}_active=${backlogIds.size} feature_docs_scanned=${featureDocsScanned}`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`FAIL check-feature-truth: ${message}`);
  process.exit(1);
}
