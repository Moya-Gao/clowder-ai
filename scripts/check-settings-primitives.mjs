#!/usr/bin/env node
/**
 * F206 Phase B — Settings primitive enforcement.
 *
 * Scans settings page-layer files for restricted Tailwind atomic classes
 * (bg-* / text-* / border-* / rounded-* / px-* / py-*) inside className
 * attributes. These classes must only exist inside primitives/ components.
 *
 * Files not yet migrated are listed in EXEMPT_FILES and skipped.
 * As each page is migrated, remove it from the list so enforcement kicks in.
 *
 * Runs as part of `pnpm check` to enforce at CI time.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SETTINGS_DIR = 'packages/web/src/components/settings';
const PRIMITIVES_DIR = join(SETTINGS_DIR, 'primitives');

// Files not yet migrated to primitives — remove from this set as they're converted.
const EXEMPT_FILES = new Set([
  'capability-settings-ui.tsx',
  'InstallPreviewModal.tsx',
  'PushDiagnosticsSection.tsx',
  'SettingsNav.tsx',
  'SettingsPageHeader.tsx',
  'SettingsPlaceholder.tsx',
  'SettingsShell.tsx',
  'SkillConflictBanner.tsx',
  'SkillPreviewModal.tsx',
  // F228 broader intake (clowder-ai#917) — community code pre-dates primitives system.
  // Track migration in: https://github.com/zts212653/cat-cafe/issues/2350
  'AllProjectsSyncBanner.tsx',
  'MountRulesPanel.tsx',
  'SkillIssueDetailDialog.tsx',
  'SkillsDriftBanner.tsx',
  'SkillsSubComponents.tsx',
  'skill-issue-view.tsx',
]);

// className="..." content is scanned for these patterns.
// Restricted: bg-X, text-X, border-X, rounded-X, px-X, py-X
// where X starts with a letter, digit, or [
const RESTRICTED_RE = /\b(bg-|text-|border-|rounded-|px-|py-)[a-zA-Z0-9[(]/g;

function collectTsx(dir) {
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === PRIMITIVES_DIR) continue;
      results.push(...collectTsx(full));
    } else if (entry.name.endsWith('.tsx')) {
      if (EXEMPT_FILES.has(entry.name)) continue;
      results.push(full);
    }
  }
  return results;
}

function extractClassNameStrings(source) {
  const hits = [];
  // Match className="..." (static strings only; dynamic {expr} are skipped)
  const re = /className="([^"]*)"/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const lineNum = source.slice(0, m.index).split('\n').length;
    hits.push({ line: lineNum, classes: m[1] });
  }
  return hits;
}

let violations = 0;
const files = collectTsx(SETTINGS_DIR);

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  const classNames = extractClassNameStrings(source);
  for (const { line, classes } of classNames) {
    let match;
    RESTRICTED_RE.lastIndex = 0;
    while ((match = RESTRICTED_RE.exec(classes)) !== null) {
      const cls = classes.slice(match.index).split(/\s/)[0];
      if (cls.startsWith('settingsResource')) continue;
      console.error(`  ${relative('.', file)}:${line}  restricted class "${cls}" in className`);
      violations++;
    }
  }
}

if (violations > 0) {
  console.error(
    `\nFAIL check-settings-primitives: ${violations} restricted Tailwind class(es) in page-layer settings files.`,
  );
  console.error('Move these classes into a primitives/ component or use inline style={{}}.');
  process.exit(1);
} else {
  console.log(
    `PASS check-settings-primitives: ${files.length} settings files, 0 restricted classes (${EXEMPT_FILES.size} files exempt)`,
  );
}
