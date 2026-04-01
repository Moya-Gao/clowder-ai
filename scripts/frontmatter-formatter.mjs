#!/usr/bin/env node
/**
 * F102 Phase F-3: Frontmatter Formatter
 * Scans .md files and auto-adds missing frontmatter metadata.
 *
 * Usage:
 *   node scripts/frontmatter-formatter.mjs --docs-root docs --dry-run
 *   node scripts/frontmatter-formatter.mjs --docs-root docs --apply
 */

import { existsSync, lstatSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, join, relative } from 'node:path';
import process from 'node:process';

const FRONTMATTER_RE = /^\uFEFF?---\n([\s\S]*?)\n---\n/;

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'in',
  'on',
  'at',
  'to',
  'for',
  'of',
  'with',
  'by',
  'from',
  'is',
  'it',
  'as',
  'be',
  'was',
  'are',
  'this',
  'that',
  'not',
  'do',
  'does',
  'did',
  'has',
  'have',
  'had',
  'how',
  'what',
  'when',
  'where',
  'why',
  'who',
  'which',
]);

/** @type {Record<string, string>} */
const DIR_TO_KIND = {
  features: 'feature',
  decisions: 'decision',
  plans: 'plan',
  lessons: 'lesson',
  discussions: 'discussion',
  research: 'research',
  phases: 'plan',
  reflections: 'lesson',
  methods: 'lesson',
  episodes: 'lesson',
  postmortems: 'lesson',
  guides: 'plan',
  stories: 'lesson',
};

const CONTENT_KIND_PATTERNS = [
  { pattern: /^#.*\bdecision\b/im, kind: 'decision' },
  { pattern: /^#.*\badr\b/im, kind: 'decision' },
  { pattern: /^#.*\blesson\b/im, kind: 'lesson' },
  { pattern: /^#.*\bpitfall\b/im, kind: 'lesson' },
  { pattern: /^#.*\bpostmortem\b/im, kind: 'lesson' },
  { pattern: /^#.*\bresearch\b/im, kind: 'research' },
];

/**
 * Infer doc_kind from file path and content.
 * @param {string} filePath
 * @param {string} content
 * @returns {string}
 */
export function inferDocKind(filePath, content) {
  // Path-based inference
  for (const [dir, kind] of Object.entries(DIR_TO_KIND)) {
    if (filePath.includes(`/${dir}/`) || filePath.includes(`\\${dir}\\`)) return kind;
  }

  // Content-based inference
  for (const { pattern, kind } of CONTENT_KIND_PATTERNS) {
    if (pattern.test(content)) return kind;
  }

  return 'plan';
}

/**
 * Extract topic keywords from a title string.
 * @param {string} title
 * @returns {string[]}
 */
export function extractTopicsFromTitle(title) {
  return title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .split(/\s+/)
    .map((w) => w.toLowerCase())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 5);
}

/**
 * Format a frontmatter block from key-value pairs.
 * @param {Record<string, unknown>} fields
 * @returns {string}
 */
export function formatFrontmatter(fields) {
  const lines = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (Array.isArray(value)) {
      lines.push(`${key}: [${value.join(', ')}]`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  }
  lines.push('---\n');
  return lines.join('\n');
}

/**
 * Walk directory recursively for .md files.
 * @param {string} root
 * @returns {string[]}
 */
function walkMarkdownFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !existsSync(current)) continue;
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.git') continue;
      const fullPath = join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  }
  return files.sort();
}

/**
 * Extract first # heading from content.
 * @param {string} content
 * @returns {string|null}
 */
function extractTitle(content) {
  const match = content.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

/**
 * @typedef {{ dryRun: boolean }} FormatterOptions
 * @typedef {{ updated: string[], skipped: string[], wouldUpdate: string[] }} FormatterResult
 */

/**
 * Run the frontmatter formatter.
 * @param {string} docsRoot
 * @param {FormatterOptions} options
 * @returns {FormatterResult}
 */
export function runFormatter(docsRoot, options) {
  const files = walkMarkdownFiles(docsRoot);
  const updated = [];
  const skipped = [];
  const wouldUpdate = [];
  const today = new Date().toISOString().slice(0, 10);

  for (const filePath of files) {
    const content = readFileSync(filePath, 'utf-8');
    const rel = relative(docsRoot, filePath);

    const fmMatch = content.match(FRONTMATTER_RE);
    const title = extractTitle(content);
    const anchor = `doc:${rel.replace(/\.md$/, '')}`;

    if (fmMatch) {
      // Parse existing frontmatter and fill missing fields
      const existing = fmMatch[1];
      const hasDocKind = /^doc_kind:/m.test(existing);
      const hasAnchor = /^anchor:/m.test(existing);
      const hasTopics = /^topics:/m.test(existing);
      const hasCreated = /^created:/m.test(existing);

      const missing = [];
      if (!hasDocKind) missing.push(`doc_kind: ${inferDocKind(filePath, content)}`);
      if (!hasAnchor) missing.push(`anchor: ${anchor}`);
      if (!hasTopics && title) {
        const topics = extractTopicsFromTitle(title);
        if (topics.length > 0) missing.push(`topics: [${topics.join(', ')}]`);
      }
      if (!hasCreated) missing.push(`created: ${today}`);

      if (missing.length === 0) {
        skipped.push(rel);
        continue;
      }

      if (options.dryRun) {
        wouldUpdate.push(rel);
      } else {
        const patched = `---\n${existing}\n${missing.join('\n')}\n---\n`;
        const body = content.slice(fmMatch[0].length);
        writeFileSync(filePath, patched + body);
        updated.push(rel);
      }
      continue;
    }

    // No frontmatter at all — generate full block
    const docKind = inferDocKind(filePath, content);
    const topics = title ? extractTopicsFromTitle(title) : [];

    const fields = { doc_kind: docKind, created: today, anchor };
    if (topics.length > 0) fields.topics = topics;

    if (options.dryRun) {
      wouldUpdate.push(rel);
    } else {
      const fm = formatFrontmatter(fields);
      writeFileSync(filePath, fm + '\n' + content);
      updated.push(rel);
    }
  }

  return { updated, skipped, wouldUpdate };
}

// ── CLI entry point ──

function parseArgs(argv) {
  const out = { docsRoot: 'docs', dryRun: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--docs-root') out.docsRoot = argv[++i] ?? 'docs';
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--apply') out.dryRun = false;
    else if (arg === '-h' || arg === '--help') {
      console.log('Usage: node scripts/frontmatter-formatter.mjs [--docs-root docs] [--dry-run|--apply]');
      process.exit(0);
    }
  }
  return out;
}

// Only run CLI when executed directly (not imported by tests)
const isDirectRun = process.argv[1] && process.argv[1].endsWith('frontmatter-formatter.mjs');

if (isDirectRun) {
  const args = parseArgs(process.argv.slice(2));
  const result = runFormatter(args.docsRoot, { dryRun: args.dryRun });

  if (args.dryRun) {
    console.log(`[frontmatter-formatter] DRY RUN — would update ${result.wouldUpdate.length} files`);
    for (const f of result.wouldUpdate) console.log(`  + ${f}`);
  } else {
    console.log(`[frontmatter-formatter] Updated ${result.updated.length} files`);
    for (const f of result.updated) console.log(`  + ${f}`);
  }
  console.log(`[frontmatter-formatter] Skipped ${result.skipped.length} files (already have frontmatter)`);
}
