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
import { generateAttributionReport } from '../packages/api/dist/infrastructure/harness-eval/attribution.js';
import { generateF167Snapshot } from '../packages/api/dist/infrastructure/harness-eval/f167-eval.js';
import {
  fetchMetrics,
  fetchMetricsHistory,
  fetchTraces,
  fetchTracesStats,
} from '../packages/api/dist/infrastructure/harness-eval/telemetry-adapter.js';

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
  const [traces, traceStats, metricsText, metricsHistory] = await Promise.all([
    fetchTraces(config, { limit: 500 }),
    fetchTracesStats(config),
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

  console.log('4/4 Writing output...');
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

  const snapshotYaml = formatSnapshotYaml(snapshot);
  const attrYaml = formatAttributionYaml(report);

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

function formatSnapshotYaml(snapshot) {
  const lines = [
    '---',
    'doc_kind: harness-feedback',
    'feedback_type: eval-snapshot',
    `feature_id: ${snapshot.featureId}`,
    `generated_at: "${snapshot.generatedAt}"`,
    `generated_by: "${snapshot.generatedBy}"`,
    '---',
    '',
    `# F167 Runtime Eval Snapshot — ${dateStr}`,
    '',
    `data_source: "${snapshot.dataSource}"`,
    `overall_confidence: ${snapshot.overallConfidence}`,
    '',
    'window:',
    `  start_ms: ${snapshot.window.startMs}`,
    `  end_ms: ${snapshot.window.endMs}`,
    `  duration_hours: ${snapshot.window.durationHours.toFixed(2)}`,
    '',
    'trace_store_stats:',
    `  span_count: ${snapshot.traceStoreStats.spanCount}`,
    `  max_spans: ${snapshot.traceStoreStats.maxSpans}`,
    `  max_age_ms: ${snapshot.traceStoreStats.maxAgeMs}`,
    '',
    `summary: "${snapshot.summary}"`,
    '',
    'components:',
  ];

  for (const c of snapshot.components) {
    lines.push(`  - id: ${c.componentId}`);
    lines.push(`    name: "${c.componentName}"`);
    lines.push(`    confidence: ${c.confidence}`);
    lines.push('    activation_counts:');
    for (const [k, v] of Object.entries(c.activationCounts)) {
      lines.push(`      ${k}: ${v ?? 'null'}`);
    }
    if (Object.keys(c.activationCounts).length === 0) {
      lines.push('      {}');
    }
    lines.push('    friction_counts:');
    for (const [k, v] of Object.entries(c.frictionCounts)) {
      lines.push(`      ${k}: ${v ?? 'null'}`);
    }
    if (Object.keys(c.frictionCounts).length === 0) {
      lines.push('      {}');
    }
    if (c.telemetryGaps.length > 0) {
      lines.push('    telemetry_gaps:');
      for (const gap of c.telemetryGaps) {
        lines.push(`      - metric: ${gap.metric}`);
        lines.push(`        reason: ${gap.reason}`);
        lines.push(`        impact: "${gap.impact}"`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatAttributionYaml(report) {
  const lines = [
    '---',
    'doc_kind: harness-feedback',
    'feedback_type: attribution',
    `feature_id: ${report.featureId}`,
    `eval_snapshot_id: "${report.evalSnapshotId}"`,
    `generated_at: "${report.generatedAt}"`,
    '---',
    '',
    `# F167 Attribution Report — ${dateStr}`,
    '',
  ];

  if (report.findings.length === 0 && report.noFindingRecord) {
    lines.push('no_finding_record:');
    lines.push(`  reason: "${report.noFindingRecord.reason}"`);
    lines.push(`  evidence: "${report.noFindingRecord.evidence}"`);
    lines.push('');
    lines.push('findings: []');
  } else {
    lines.push(`finding_count: ${report.findings.length}`);
    lines.push('');
    lines.push('findings:');
    for (const f of report.findings) {
      lines.push(`  - id: ${f.id}`);
      lines.push(`    related_feature: ${f.relatedFeature}`);
      lines.push('    friction_signal:');
      lines.push(`      type: ${f.frictionSignal.type}`);
      lines.push(`      severity: ${f.frictionSignal.severity}`);
      lines.push(`      confidence: ${f.frictionSignal.confidence}`);
      lines.push('    attribution:');
      lines.push(`      primary_layer: ${f.attribution.primaryLayer}`);
      lines.push(`      pipeline_or_human: ${f.attribution.pipelineOrHuman}`);
      lines.push('      evidence:');
      for (const e of f.attribution.evidence) {
        lines.push(`        - type: ${e.type}`);
        lines.push(`          anchor: "${e.anchor}"`);
        lines.push(`          excerpt: "${e.excerpt}"`);
      }
      lines.push('    proposed_action:');
      for (const a of f.proposedAction) {
        lines.push(`      - action: ${a.action}`);
        lines.push(`        target: "${a.target}"`);
        lines.push(`        rationale: "${a.rationale}"`);
      }
      lines.push(`    status: ${f.status}`);
      lines.push('');
    }
  }

  return lines.join('\n');
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

if (digestMode) {
  generateMonthlyDigest();
} else {
  if (!cookie) {
    console.error('Error: session cookie required.\n' + '  --cookie "session=..." or EVAL_SESSION_COOKIE env var');
    process.exit(1);
  }
  const config = { baseUrl, cookie };
  main(config).catch((err) => {
    console.error('Eval failed:', err.message);
    process.exit(1);
  });
}
