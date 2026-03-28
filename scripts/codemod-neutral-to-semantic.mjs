#!/usr/bin/env node
/**
 * F056 Phase A-2.5: Codemod — Tailwind neutral colors → cafe semantic tokens
 *
 * Usage:
 *   node scripts/codemod-neutral-to-semantic.mjs          # dry-run (default)
 *   node scripts/codemod-neutral-to-semantic.mjs --apply   # apply changes
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

// ---------------------------------------------------------------------------
// Mapping: Tailwind neutral → cafe semantic token
// Longer patterns first to avoid partial matches (gray-100 before gray-10)
// ---------------------------------------------------------------------------
const MAPPING = [
  // Backgrounds
  ['bg-gray-100', 'bg-cafe-surface-elevated'],
  ['bg-gray-50', 'bg-cafe-surface-elevated'],
  ['bg-white', 'bg-cafe-surface'],
  // Text
  ['text-gray-900', 'text-cafe'],
  ['text-gray-800', 'text-cafe'],
  ['text-gray-700', 'text-cafe-secondary'],
  ['text-gray-600', 'text-cafe-secondary'],
  ['text-gray-500', 'text-cafe-secondary'],
  ['text-gray-400', 'text-cafe-muted'],
  ['text-gray-300', 'text-cafe-muted'],
  // Borders
  ['border-gray-300', 'border-cafe'],
  ['border-gray-200', 'border-cafe'],
  ['border-gray-100', 'border-cafe-subtle'],
];

// Tailwind modifier prefixes
const MODIFIERS = ['', 'hover:', 'focus:', 'active:', 'group-hover:', 'focus-within:', 'focus-visible:', 'disabled:'];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPatterns() {
  const patterns = [];
  for (const [src, target] of MAPPING) {
    for (const mod of MODIFIERS) {
      const full = `${mod}${src}`;
      const replacement = `${mod}${target}`;
      // Match the class name, optionally followed by /NN opacity suffix
      const regex = new RegExp(`(?<=[\\s"'\`])${escapeRegex(full)}(/\\d+)?(?=[\\s"'\`])`, 'g');
      patterns.push({ regex, replacement, source: full });
    }
  }
  return patterns;
}

function walkDir(dir) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry.startsWith('.') || entry === 'node_modules') continue;
    const stat = statSync(full);
    if (stat.isDirectory()) results.push(...walkDir(full));
    else if (/\.(tsx?|jsx?)$/.test(entry)) results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const apply = process.argv.includes('--apply');
const root = join(process.cwd(), 'packages/web/src');
const files = walkDir(root);
const patterns = buildPatterns();
const stats = { filesChanged: 0, totalReplacements: 0, perPattern: {} };

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let content = original;

  for (const { regex, replacement, source } of patterns) {
    const matches = content.match(regex);
    if (!matches) continue;
    content = content.replace(regex, (match, opacity) => replacement + (opacity || ''));
    stats.perPattern[source] = (stats.perPattern[source] || 0) + matches.length;
    stats.totalReplacements += matches.length;
  }

  if (content !== original) {
    stats.filesChanged++;
    if (apply) writeFileSync(file, content, 'utf8');
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
console.log(`# F056 Phase A-2.5: Neutral Codemod ${apply ? '(APPLIED)' : '(DRY RUN)'}\n`);
console.log(`Files scanned: ${files.length}`);
console.log(`Files ${apply ? 'changed' : 'would change'}: ${stats.filesChanged}`);
console.log(`Total replacements: ${stats.totalReplacements}\n`);
console.log('| Pattern | Count |');
console.log('|---------|-------|');
for (const [pattern, count] of Object.entries(stats.perPattern).sort((a, b) => b[1] - a[1])) {
  console.log(`| ${pattern} | ${count} |`);
}
if (!apply) console.log('\nDry run — no files modified. Use --apply to write changes.');
