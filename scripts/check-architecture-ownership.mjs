#!/usr/bin/env node

/**
 * F191 Phase C — Architecture ownership mechanical checks.
 *
 * Warning-only by default. This script checks mechanical invariants:
 * - ownership cell code_anchors still exist
 * - Architecture cell declarations point at known cells
 * - git diff adds architecture nouns without an Architecture cell declaration
 * - in-progress feature specs missing Architecture cell declaration
 *
 * It does not decide whether an architecture choice is correct.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(SCRIPT_DIR, '..');
const DEFAULT_CELLS_DIR = join(REPO_ROOT, 'docs', 'architecture', 'ownership', 'cells');
const DEFAULT_SCAN_DIRS = [join(REPO_ROOT, 'docs', 'features'), join(REPO_ROOT, 'docs', 'plans')];
const ARCHITECTURE_NOUN_PATTERN = /\b[A-Za-z][A-Za-z0-9]*(Store|Queue|Router|Adapter|Dispatcher|Binding)\b/;
const ARCHITECTURE_CELL_PATTERN = /^\s*Architecture cell:\s*(.+?)\s*$/gim;
const REQUIRED_CELL_FIELDS = ['cell_id', 'code_anchors'];

function warning(kind, message, details = []) {
  return { kind, message, details };
}

export function stripFencedCode(markdown) {
  return markdown.replace(/```[\s\S]*?```/g, '');
}

export function parseCellMarkdown(markdown, fileName = 'cell.md') {
  if (!markdown.startsWith('---\n')) {
    throw new Error(`${fileName} is missing YAML frontmatter`);
  }

  const end = markdown.indexOf('\n---\n', 4);
  if (end === -1) {
    throw new Error(`${fileName} has unterminated YAML frontmatter`);
  }

  const rawFrontmatter = markdown.slice(4, end);
  const meta = YAML.parse(rawFrontmatter) ?? {};

  for (const key of REQUIRED_CELL_FIELDS) {
    if (!(key in meta)) {
      throw new Error(`${fileName} is missing frontmatter field: ${key}`);
    }
  }

  return meta;
}

export function loadOwnershipCells(cellsDir = DEFAULT_CELLS_DIR) {
  return readdirSync(cellsDir)
    .filter((file) => file.endsWith('.md'))
    .sort()
    .map((file) => {
      const filePath = join(cellsDir, file);
      const markdown = readFileSync(filePath, 'utf8');
      return { file, path: filePath, meta: parseCellMarkdown(markdown, file) };
    });
}

function displayPath(filePath, baseDir = REPO_ROOT) {
  const relativePath = relative(baseDir, filePath);
  if (!relativePath.startsWith('..')) return relativePath;
  return basename(filePath);
}

function resolveAnchor(rootDir, anchor) {
  return isAbsolute(anchor) ? anchor : join(rootDir, anchor);
}

export function checkCodeAnchors(cells, rootDir = REPO_ROOT) {
  const warnings = [];

  for (const cell of cells) {
    const cellId = String(cell.meta.cell_id);
    const anchors = Array.isArray(cell.meta.code_anchors) ? cell.meta.code_anchors : [];

    for (const anchor of anchors) {
      if (typeof anchor !== 'string' || anchor.trim() === '') continue;
      if (!existsSync(resolveAnchor(rootDir, anchor))) {
        warnings.push(warning('stale-code-anchor', `${cellId} references missing code_anchor: ${anchor}`));
      }
    }
  }

  return warnings;
}

function normalizeDeclaredCellValues(rawValue) {
  const value = rawValue
    .replace(/\s+#.*$/, '')
    .replace(/`/g, '')
    .trim();

  if (!value || value.includes('{') || value.includes('[')) return [];

  return value
    .split(/\s*(?:,|、|\/|&|\+|\band\b)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !['none', 'n/a', 'na'].includes(part.toLowerCase()));
}

function collectMarkdownFiles(rootDir) {
  if (!existsSync(rootDir)) return [];
  const files = [];

  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const entryPath = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectMarkdownFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(entryPath);
    }
  }

  return files;
}

export function checkArchitectureCellDeclarations(files, knownCellIds, baseDir = REPO_ROOT) {
  const warnings = [];

  for (const filePath of files) {
    const markdown = stripFencedCode(readFileSync(filePath, 'utf8'));
    for (const match of markdown.matchAll(ARCHITECTURE_CELL_PATTERN)) {
      for (const cellId of normalizeDeclaredCellValues(match[1])) {
        if (!knownCellIds.has(cellId)) {
          warnings.push(
            warning(
              'unknown-architecture-cell',
              `${displayPath(filePath, baseDir)} declares unknown Architecture cell: ${cellId}`,
            ),
          );
        }
      }
    }
  }

  return warnings;
}

function runGit(args, rootDir = REPO_ROOT) {
  try {
    return execFileSync('git', args, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 10_000,
    });
  } catch {
    return '';
  }
}

export function getDiffText({ base = null, rootDir = REPO_ROOT } = {}) {
  if (base) {
    return runGit(['diff', '--unified=0', `${base}...HEAD`], rootDir);
  }

  const staged = runGit(['diff', '--cached', '--unified=0'], rootDir);
  const unstaged = runGit(['diff', '--unified=0'], rootDir);
  const workingTreeDiff = [staged, unstaged].filter(Boolean).join('\n');
  if (workingTreeDiff.trim()) return workingTreeDiff;

  return runGit(['diff', '--unified=0', 'origin/main...HEAD'], rootDir);
}

function isRelevantDiffPath(filePath) {
  if (!filePath) return true;
  if (filePath.startsWith('docs/discussions/') || filePath.startsWith('assets/')) return false;
  if (/\.test\.(ts|tsx|js|jsx|mjs|cjs)$/.test(filePath)) return false;
  return true;
}

function addedDiffLines(diffText) {
  const added = [];
  let currentFile = null;

  for (const line of diffText.split('\n')) {
    const fileMatch = line.match(/^\+\+\+ b\/(.+)$/);
    if (fileMatch) {
      currentFile = fileMatch[1];
      continue;
    }

    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    if (!isRelevantDiffPath(currentFile)) continue;
    added.push({ file: currentFile, text: line.slice(1) });
  }

  return added;
}

const FEATURE_STATUS_PATTERN = /\*\*Status\*\*:\s*([\w-]+)/i;
const HAS_CELL_DECLARATION = /^\s*Architecture cell:\s*\S+/im;

export function checkInProgressFeaturesMissingCell(featuresDir, baseDir = REPO_ROOT) {
  if (!existsSync(featuresDir)) return [];
  const warnings = [];

  const files = readdirSync(featuresDir)
    .filter((f) => /^F\d+.*\.md$/.test(f))
    .sort();

  for (const file of files) {
    const filePath = join(featuresDir, file);
    const markdown = readFileSync(filePath, 'utf8');
    const stripped = stripFencedCode(markdown);

    const statusMatch = stripped.match(FEATURE_STATUS_PATTERN);
    if (!statusMatch || statusMatch[1].toLowerCase() !== 'in-progress') continue;

    if (!HAS_CELL_DECLARATION.test(stripped)) {
      warnings.push(
        warning(
          'in-progress-missing-architecture-cell',
          `${displayPath(filePath, baseDir)} is in-progress but missing Architecture cell declaration`,
        ),
      );
    }
  }

  return warnings;
}

export function checkDiffArchitectureNouns(diffText) {
  const addedLines = addedDiffLines(diffText);
  if (addedLines.length === 0) return [];

  const hasArchitectureDeclaration = addedLines.some(({ text }) => /^\s*Architecture cell:\s*\S+/i.test(text));
  if (hasArchitectureDeclaration) return [];

  const nounLines = addedLines
    .filter(({ text }) => ARCHITECTURE_NOUN_PATTERN.test(text))
    .map(({ file, text }) => `${file ?? '<unknown>'}: ${text.trim()}`)
    .slice(0, 10);

  if (nounLines.length === 0) return [];

  return [
    warning(
      'missing-architecture-cell-declaration',
      'diff adds architecture nouns without Architecture cell declaration',
      nounLines,
    ),
  ];
}

function parseArgs(argv) {
  const args = { base: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') {
      args.base = argv[index + 1] ?? null;
      index += 1;
    }
  }
  return args;
}

function printWarnings(title, warnings) {
  if (warnings.length === 0) {
    console.log(`OK ${title}`);
    return;
  }

  console.log(`WARN ${title}: ${warnings.length}`);
  for (const item of warnings) {
    console.log(`  - [${item.kind}] ${item.message}`);
    for (const detail of item.details ?? []) {
      console.log(`    ${detail.slice(0, 140)}`);
    }
  }
}

export function runChecks({
  base = null,
  rootDir = REPO_ROOT,
  cellsDir = DEFAULT_CELLS_DIR,
  scanDirs = DEFAULT_SCAN_DIRS,
} = {}) {
  const cells = loadOwnershipCells(cellsDir);
  const knownCellIds = new Set(cells.map((cell) => String(cell.meta.cell_id)));
  const docs = scanDirs.flatMap((dir) => collectMarkdownFiles(dir));
  const diffText = getDiffText({ base, rootDir });
  const featuresDir = join(rootDir, 'docs', 'features');

  return {
    knownCellIds,
    codeAnchorWarnings: checkCodeAnchors(cells, rootDir),
    declarationWarnings: checkArchitectureCellDeclarations(docs, knownCellIds, rootDir),
    diffWarnings: checkDiffArchitectureNouns(diffText),
    missingCellWarnings: checkInProgressFeaturesMissingCell(featuresDir, rootDir),
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const result = runChecks({ base: args.base });

  console.log('Architecture ownership check (F191 Phase C, warning-only)');
  console.log(`Known cells: ${[...result.knownCellIds].sort().join(', ')}`);
  console.log('Semantic architecture judgment remains in Design Gate / review.');
  console.log('');

  printWarnings('code anchors', result.codeAnchorWarnings);
  printWarnings('Architecture cell declarations', result.declarationWarnings);
  printWarnings('diff architecture nouns', result.diffWarnings);
  printWarnings('in-progress features missing Architecture cell', result.missingCellWarnings);

  const warningCount =
    result.codeAnchorWarnings.length +
    result.declarationWarnings.length +
    result.diffWarnings.length +
    result.missingCellWarnings.length;

  console.log('');
  console.log(`Done: ${warningCount} warning(s). This script exits 0 by design.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`FAIL check-architecture-ownership: ${message}`);
    process.exit(1);
  }
}
