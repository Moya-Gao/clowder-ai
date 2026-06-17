#!/usr/bin/env node

/**
 * F192 Phase C: F167 A2A Harness Runtime Eval Runner
 *
 * Usage:
 *   node scripts/run-f167-eval.mjs --base-url http://localhost:3102 --cookie "session=..."
 *   EVAL_BASE_URL=... EVAL_SESSION_COOKIE=... node scripts/run-f167-eval.mjs
 *
 * Output:
 *   docs/harness-feedback/snapshots/YYYY-MM-DD-F167-eval.yaml
 *   docs/harness-feedback/attributions/YYYY-MM-DD-F167-attribution.yaml
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  computeActionRate,
  findingFingerprint,
  generateAttributionReport,
} from '../packages/api/dist/infrastructure/harness-eval/attribution.js';
import { generateF167Snapshot } from '../packages/api/dist/infrastructure/harness-eval/f167-eval.js';
import {
  fetchMetrics,
  fetchMetricsHistory,
  fetchTraces,
  fetchTracesStats,
} from '../packages/api/dist/infrastructure/harness-eval/telemetry-adapter.js';
import { formatAttributionYaml, formatSnapshotYaml } from './lib/format-eval-yaml.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const { values } = parseArgs({
  options: {
    'base-url': { type: 'string' },
    cookie: { type: 'string' },
    'dry-run': { type: 'boolean', default: false },
    store: { type: 'boolean', default: false },
    digest: { type: 'boolean', default: false },
  },
});

const baseUrl = values['base-url'] || process.env.EVAL_BASE_URL || 'http://localhost:3102';
const cookie = values.cookie || process.env.EVAL_SESSION_COOKIE || '';
const dryRun = values['dry-run'] ?? false;
const storeMode = values.store ?? false;
const digestMode = values.digest ?? false;

const dateStr = new Date().toISOString().slice(0, 10);

async function parseMetricsText(text) {
  const metrics = {};
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || line.trim() === '') continue;
    const spaceIdx = line.lastIndexOf(' ');
    if (spaceIdx === -1) continue;
    const key = line.slice(0, spaceIdx);
    const val = Number.parseFloat(line.slice(spaceIdx + 1));
    if (!Number.isNaN(val)) metrics[key] = val;
  }
  return metrics;
}

async function main(config) {
  console.log(`F192 Eval Runner — ${dateStr}`);
  console.log(`  baseUrl: ${baseUrl}`);
  console.log(`  dryRun: ${dryRun}`);
  console.log('');

  console.log('1/4 Fetching telemetry data...');
  // F192 verdict 2026-06-17-eval-a2a-c1-sample-window-build: per-fire sample
  // evidence needs the full window, not the first 500. Fetch stats first so
  // limit derives from `traceStats.maxSpans` (no second magic number) and
  // opt in to the route's `expandLimit=true` cap raise. Default UI traffic
  // is unchanged.
  const traceStats = await fetchTracesStats(config);
  const [traces, metricsText, metricsHistory] = await Promise.all([
    fetchTraces(config, { limit: traceStats.maxSpans, expandLimit: true }),
    fetchMetrics(config),
    fetchMetricsHistory(config),
  ]);

  const metrics = await parseMetricsText(metricsText);
  console.log(
    `     traces: ${traces.count} spans | ` +
      `store: ${traceStats.spanCount}/${traceStats.maxSpans} | ` +
      `metrics keys: ${Object.keys(metrics).length} | ` +
      `history snapshots: ${metricsHistory.count}`,
  );

  console.log('2/4 Generating F167 eval snapshot...');
  const snapshot = generateF167Snapshot({
    traces,
    metrics,
    metricsHistory,
    traceStats,
  });
  console.log(
    `     components: ${snapshot.components.length} | ` +
      `confidence: ${snapshot.overallConfidence} | ` +
      `gaps: ${snapshot.components.reduce((s, c) => s + c.telemetryGaps.length, 0)}`,
  );

  console.log('3/4 Generating attribution report...');
  const report = generateAttributionReport({
    featureId: 'F167',
    snapshot,
  });
  console.log(`     findings: ${report.findings.length} | ` + `no-finding: ${report.noFindingRecord ? 'yes' : 'no'}`);

  console.log('4/5 Computing action-rate against prior findings...');
  const actionRate = computeActionRateFromPrior(report, join(ROOT, 'docs/harness-feedback/attributions'));
  if (actionRate) {
    report.actionRate = actionRate;
    console.log(
      `     action-rate: ${actionRate.actedOn}/${actionRate.total} = ${(actionRate.rate * 100).toFixed(0)}% | ` +
        `sunset: ${actionRate.sunsetCandidate}`,
    );
  } else {
    console.log('     action-rate: no prior attribution found (first run)');
  }

  console.log('5/5 Writing output...');
  const snapshotDir = join(ROOT, 'docs/harness-feedback/snapshots');
  const attrDir = join(ROOT, 'docs/harness-feedback/attributions');
  mkdirSync(snapshotDir, { recursive: true });
  mkdirSync(attrDir, { recursive: true });

  const snapshotPath = join(snapshotDir, `${dateStr}-F167-eval.yaml`);
  const attrPath = join(attrDir, `${dateStr}-F167-attribution.yaml`);

  if (storeMode && existsSync(snapshotPath) && existsSync(attrPath)) {
    console.log(`     DEDUP: ${snapshotPath} + attribution already exist, skipping write.`);
    console.log('\nDone (idempotent store — no overwrite).');
    return;
  }

  const snapshotYaml = formatSnapshotYaml(snapshot, dateStr);
  const attrYaml = formatAttributionYaml(report, dateStr, findingFingerprint);

  if (dryRun) {
    console.log('\n--- SNAPSHOT (dry-run) ---');
    console.log(snapshotYaml.slice(0, 500) + '...');
    console.log('\n--- ATTRIBUTION (dry-run) ---');
    console.log(attrYaml.slice(0, 500) + '...');
  } else {
    writeFileSync(snapshotPath, snapshotYaml, 'utf-8');
    writeFileSync(attrPath, attrYaml, 'utf-8');
    console.log(`     snapshot: ${snapshotPath}`);
    console.log(`     attribution: ${attrPath}`);
  }

  console.log('\nDone.');
}

function computeActionRateFromPrior(report, attrDir) {
  if (!existsSync(attrDir)) return null;
  const files = readdirSync(attrDir)
    .filter((f) => f.endsWith('-F167-attribution.yaml') && f < `${dateStr}-`)
    .sort();
  if (files.length === 0) return null;

  const priorPath = join(attrDir, files[files.length - 1]);
  const priorContent = readFileSync(priorPath, 'utf-8');
  const priorFindings = parsePriorFindings(priorContent);
  if (priorFindings.length === 0) return null;

  const currentFindings = report.findings.map((f) => ({
    fingerprint: findingFingerprint(f),
  }));
  console.log(`     prior: ${priorPath} (${priorFindings.length} findings)`);
  return computeActionRate(currentFindings, priorFindings);
}

function parsePriorFindings(yamlContent) {
  const findings = [];
  const findingBlocks = yamlContent.split(/^ {2}- id:/m).slice(1);
  for (const block of findingBlocks) {
    const statusMatch = block.match(/^\s+status:\s*(\S+)/m);
    const fpMatch = block.match(/^\s+fingerprint:\s*"?([^"\n]+)"?/m);
    if (fpMatch) {
      findings.push({
        status: statusMatch?.[1] ?? 'open',
        fingerprint: fpMatch[1],
      });
    }
  }
  return findings;
}

function generateMonthlyDigest() {
  const snapshotDir = join(ROOT, 'docs/harness-feedback/snapshots');
  const digestDir = join(ROOT, 'docs/harness-feedback/digests');
  mkdirSync(snapshotDir, { recursive: true });
  mkdirSync(digestDir, { recursive: true });

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const files = readdirSync(snapshotDir)
    .filter((f) => f.startsWith(month) && f.endsWith('-F167-eval.yaml'))
    .sort();

  if (files.length === 0) {
    console.log(`No snapshots found for ${month}.`);
    return;
  }

  const summaries = files.map((f) => {
    const content = readFileSync(join(snapshotDir, f), 'utf-8');
    const confMatch = content.match(/overall_confidence:\s*(\S+)/);
    const gapMatch = content.match(/telemetry_gaps:/g);
    return {
      date: f.slice(0, 10),
      confidence: confMatch?.[1] ?? 'unknown',
      gapSections: gapMatch?.length ?? 0,
    };
  });

  const digestPath = join(digestDir, `${month}-F167-digest.yaml`);
  const lines = [
    '---',
    'doc_kind: harness-feedback',
    'feedback_type: monthly-digest',
    'feature_id: F167',
    `month: "${month}"`,
    `generated_at: "${now.toISOString()}"`,
    `snapshot_count: ${files.length}`,
    '---',
    '',
    `# F167 Monthly Digest — ${month}`,
    '',
    'snapshots:',
  ];
  for (const s of summaries) {
    lines.push(`  - date: "${s.date}"`);
    lines.push(`    confidence: ${s.confidence}`);
    lines.push(`    gap_sections: ${s.gapSections}`);
  }
  lines.push('');

  writeFileSync(digestPath, lines.join('\n'), 'utf-8');
  console.log(`Monthly digest written: ${digestPath}`);
}

async function bootstrapSession(url) {
  const res = await fetch(`${url}/api/session`);
  const setCookie = res.headers.get('set-cookie') ?? '';
  const match = setCookie.match(/cat_cafe_session=([^;]+)/);
  if (!match) throw new Error('Failed to bootstrap session from /api/session');
  return `cat_cafe_session=${match[1]}`;
}

if (digestMode) {
  generateMonthlyDigest();
} else {
  (async () => {
    let sessionCookie = cookie;
    if (!sessionCookie) {
      const host = new URL(baseUrl).hostname;
      const isLocalhost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
      if (isLocalhost) {
        console.log('No cookie provided — bootstrapping session from /api/session...');
        sessionCookie = await bootstrapSession(baseUrl);
      } else {
        console.error(
          'Error: session cookie required for non-localhost targets.\n' +
            '  --cookie "cat_cafe_session=..." or EVAL_SESSION_COOKIE env var',
        );
        process.exit(1);
      }
    }
    const config = { baseUrl, cookie: sessionCookie };
    await main(config);
  })().catch((err) => {
    console.error('Eval failed:', err.message);
    process.exit(1);
  });
}
