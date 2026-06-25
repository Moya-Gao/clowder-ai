#!/usr/bin/env node
/**
 * F056 Phase A-0: Color Usage Audit Script
 *
 * Scans packages/web/src/ for hardcoded color usages and produces a heat map report.
 * Categories:
 *   - Inline hex colors (#xxx, #xxxxxx) in style props or className
 *   - Tailwind neutral utilities (bg-white, text-black, bg-gray-*, text-gray-*, border-gray-*)
 *   - Tailwind color utilities (bg-red-*, text-blue-*, etc.)
 *
 * Output: JSON report + markdown summary to stdout
 *
 * Usage: node scripts/audit-color-usage.mjs [--json]
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const WEB_SRC = join(import.meta.dirname, '..', 'packages', 'web', 'src');

// --- Patterns ---

const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,4}){1,2}\b/g;

// Tailwind neutral classes (high-confidence codemod candidates)
const NEUTRAL_CLASSES =
  /\b(?:bg-white|bg-black|text-white|text-black|bg-gray-\d{2,3}|text-gray-\d{2,3}|border-gray-\d{2,3}|divide-gray-\d{2,3}|ring-gray-\d{2,3}|bg-slate-\d{2,3}|text-slate-\d{2,3}|border-slate-\d{2,3})\b/g;

// Tailwind color classes (medium/low-confidence — need context to decide semantic mapping)
const COLOR_CLASSES =
  /\b(?:bg|text|border|ring|divide|from|to|via|outline|shadow|accent|decoration|fill|stroke)-(?:red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g;

// Allowed semantic classes (should NOT be flagged)
const SEMANTIC_ALLOW = /\b(?:bg|text|border)-(?:opus|codex|gemini|cocreator|cafe|ww)-/;

// --- Scanner ---

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments and imports
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*') || line.trimStart().startsWith('import '))
      continue;

    // Hex colors
    for (const match of line.matchAll(HEX_PATTERN)) {
      // Skip CSS variable definitions (in .css files or style objects defining tokens)
      if (line.includes('var(--') && line.includes(match[0])) continue;
      // Skip SVG path data that looks like hex
      if (line.includes(' d="') || line.includes(" d='")) continue;

      findings.push({
        type: 'hex',
        value: match[0],
        line: lineNum,
        confidence: 'medium',
        context: line.trim().slice(0, 120),
      });
    }

    // Neutral Tailwind classes
    for (const match of line.matchAll(NEUTRAL_CLASSES)) {
      findings.push({
        type: 'neutral',
        value: match[0],
        line: lineNum,
        confidence: 'high',
        context: line.trim().slice(0, 120),
      });
    }

    // Color Tailwind classes
    for (const match of line.matchAll(COLOR_CLASSES)) {
      // Skip if it's already a semantic class
      if (SEMANTIC_ALLOW.test(match[0])) continue;

      findings.push({
        type: 'color',
        value: match[0],
        line: lineNum,
        confidence: 'low',
        context: line.trim().slice(0, 120),
      });
    }
  }

  return findings;
}

function walkDir(dir, ext = '.tsx') {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry === '.next' || entry === '__tests__') continue;
      results.push(...walkDir(full, ext));
    } else if (entry.endsWith(ext) || entry.endsWith('.ts')) {
      results.push(full);
    }
  }
  return results;
}

// --- Main ---

const files = walkDir(WEB_SRC);
const report = { files: {}, summary: { total: 0, byType: {}, byConfidence: {}, topFiles: [], topValues: {} } };

for (const file of files) {
  const relPath = relative(join(WEB_SRC, '..'), file);
  const findings = scanFile(file);
  if (findings.length === 0) continue;

  report.files[relPath] = {
    count: findings.length,
    byType: {},
    findings,
  };

  for (const f of findings) {
    report.summary.total++;
    report.summary.byType[f.type] = (report.summary.byType[f.type] || 0) + 1;
    report.summary.byConfidence[f.confidence] = (report.summary.byConfidence[f.confidence] || 0) + 1;
    report.files[relPath].byType[f.type] = (report.files[relPath].byType[f.type] || 0) + 1;
    report.summary.topValues[f.value] = (report.summary.topValues[f.value] || 0) + 1;
  }
}

// Sort top files
report.summary.topFiles = Object.entries(report.files)
  .map(([path, data]) => ({ path, count: data.count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 30);

// Sort top values
const topValues = Object.entries(report.summary.topValues)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 30);

// --- Output ---

if (process.argv.includes('--json')) {
  const outPath = join(import.meta.dirname, '..', 'packages', 'web', 'color-audit-report.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`JSON report written to ${outPath}`);
  process.exit(0);
}

// Markdown summary
console.log('# F056 Phase A-0: Color Usage Audit Report\n');
console.log(`> Generated: ${new Date().toISOString()}`);
console.log(`> Scanned: ${files.length} files in \`packages/web/src/\`\n`);

console.log('## Summary\n');
console.log(`| Metric | Count |`);
console.log(`|--------|-------|`);
console.log(`| **Total hardcoded color usages** | **${report.summary.total}** |`);
console.log(`| Inline hex (#xxx) | ${report.summary.byType.hex || 0} |`);
console.log(`| Tailwind neutrals (bg-white, text-gray-*...) | ${report.summary.byType.neutral || 0} |`);
console.log(`| Tailwind colors (bg-red-*, text-blue-*...) | ${report.summary.byType.color || 0} |`);
console.log(`| Files with findings | ${Object.keys(report.files).length} / ${files.length} |`);
console.log();

console.log('## Confidence Buckets (for codemod triage)\n');
console.log(`| Confidence | Count | Strategy |`);
console.log(`|------------|-------|----------|`);
console.log(`| **High** (neutral → semantic) | ${report.summary.byConfidence.high || 0} | Auto codemod |`);
console.log(`| **Medium** (hex → needs context) | ${report.summary.byConfidence.medium || 0} | PR review |`);
console.log(`| **Low** (color → multiple mappings) | ${report.summary.byConfidence.low || 0} | Manual |`);
console.log();

console.log('## Top 30 Files (Heat Map)\n');
console.log('| # | File | Total | Hex | Neutral | Color |');
console.log('|---|------|-------|-----|---------|-------|');
for (let i = 0; i < report.summary.topFiles.length; i++) {
  const { path, count } = report.summary.topFiles[i];
  const f = report.files[path];
  console.log(
    `| ${i + 1} | \`${path}\` | **${count}** | ${f.byType.hex || 0} | ${f.byType.neutral || 0} | ${f.byType.color || 0} |`,
  );
}
console.log();

console.log('## Top 30 Color Values\n');
console.log('| # | Value | Occurrences |');
console.log('|---|-------|-------------|');
for (let i = 0; i < topValues.length; i++) {
  console.log(`| ${i + 1} | \`${topValues[i][0]}\` | ${topValues[i][1]} |`);
}
