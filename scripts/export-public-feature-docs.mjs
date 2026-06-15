#!/usr/bin/env node

/**
 * export-public-feature-docs.mjs — Feature docs → public export 脚本
 *
 * 从 docs/features/F*.md 生成公开版骨架，复用 audit-feature-doc-template 的解析逻辑。
 *
 * 策略（三猫共识 2026-03-12）：
 * - conformant 文档（green/yellow tier）→ 自动导出公开骨架
 * - non-conformant 文档（red tier）→ 列入人工白名单，不自动导出
 *
 * 保留：frontmatter, Status line, Why, What, AC, Dependencies, Risk, Key Decisions
 * 剔除：铲屎官原话块, Timeline 内部细节, Open Questions 决策过程,
 *       internal links (../research/, ../bug-report/, ../mailbox/, ../discussions/, ../plans/)
 *       内部句柄/私人信息
 *
 * Usage:
 *   node scripts/export-public-feature-docs.mjs --output-dir /tmp/public-features
 *   node scripts/export-public-feature-docs.mjs --dry-run
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

// ── Config ────────────────────────────────────────────────────────────────────

const SECTIONS_TO_STRIP = new Set(['timeline', 'open questions', 'links', 'internal notes']);

const PRIVATE_DIRS =
  'research|bug-report|mailbox|discussions|plans|reflections|evidence|archive|runbooks|episodes|guides|phases|methods|evolution-proposals|stories|prompts|lessons';
const INTERNAL_LINK_PATTERNS = [
  new RegExp(`\\.\\.\\/(?:${PRIVATE_DIRS})\\/`),
  new RegExp(`docs\\/(?:${PRIVATE_DIRS})\\/`),
  new RegExp(`\\.\\/(?:${PRIVATE_DIRS})\\/`), // ./archive/... relative links within docs/features
];

const SANITIZE_REPLACEMENTS = [
  [/铲屎官原话/g, 'operator experience'],
  [/铲屎官/g, 'operator'],
  [/Landy/g, 'You'],
  [/lysander/g, 'you'],
  [/suces-MacBook[^\s]*/g, 'dev-machine'],
  [/布偶猫/g, 'Ragdoll'],
  [/缅因猫/g, 'Maine Coon'],
  [/暹罗猫/g, 'Siamese'],
  [/孟加拉猫/g, 'Bengal'],
  [/宪宪/g, 'Ragdoll'],
  [/砚砚/g, 'Maine Coon'],
  [/烁烁/g, 'Siamese'],
  [/\bthread_(?=[a-z0-9_]*[0-9])[a-z0-9_]{8,}\b/g, '[thread-id]'],
  [/\$[1-9][0-9]+(?:-[1-9][0-9]+)?\b/g, 'operational cost'],
  [/\b[0-9]+\s*轮云端 review/g, 'multiple remote review rounds'],
  [/云端 review/g, 'remote review'],
  [/\bCVO\b/g, 'operator'],
  // Redis ports: no transform — open-source uses same ports (6399/6398) as internal
  [/6399 圣域/g, 'production Redis (sacred)'],
];

// ── Frontmatter / Section parsing ─────────────────────────────────────────────

function extractFrontmatter(content) {
  const match = content.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n)?/);
  if (!match) return { raw: null, rest: content, map: {} };

  const map = {};
  for (const line of match[1].split(/\r?\n/)) {
    const parsed = line.match(/^([a-z_]+):\s*(.+)?$/i);
    if (!parsed) continue;
    map[parsed[1].trim()] = (parsed[2] ?? '').trim();
  }
  const rest = content.slice(match[0].length);
  return { raw: match[0], rest, map };
}

function normalizeFeatureId(raw) {
  if (typeof raw !== 'string') return null;
  const match = raw.match(/f?(\d{1,4})/i);
  if (!match) return null;
  const parsed = Number.parseInt(match[1], 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return `F${String(parsed).padStart(3, '0')}`;
}

function parseFeatureIds(fmValue) {
  if (!fmValue) return [];
  if (!fmValue.startsWith('[') || !fmValue.endsWith(']')) {
    const normalized = normalizeFeatureId(fmValue);
    return normalized ? [normalized] : [];
  }
  return [
    ...new Set(
      fmValue
        .slice(1, -1)
        .split(',')
        .map((p) => normalizeFeatureId(p.trim()))
        .filter(Boolean),
    ),
  ];
}

/**
 * Split markdown content into sections based on ## headings.
 * Returns array of { heading, level, name, body } objects.
 * Content before the first ## is returned with heading = null.
 */
function splitSections(content) {
  const lines = content.split('\n');
  const sections = [];
  let current = { heading: null, level: 0, name: null, body: [] };

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch && headingMatch[1].length <= 2) {
      // Save previous section
      sections.push(current);
      const level = headingMatch[1].length;
      const name = headingMatch[2].trim();
      current = { heading: line, level, name, body: [] };
    } else {
      current.body.push(line);
    }
  }
  sections.push(current);
  return sections;
}

// ── Template conformance check (lightweight version of audit script) ──────────

function hasStatusLine(content) {
  const firstLines = content.split('\n').slice(0, 40).join('\n');
  return /^>\s*\*\*Status\*\*:\s*.+/m.test(firstLines);
}

function hasSection(content, name) {
  const re = new RegExp(`^##\\s+${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'mi');
  return re.test(content);
}

function checkConformance(content) {
  const checks = [
    { key: 'status_line', pass: hasStatusLine(content) },
    { key: 'section_why', pass: hasSection(content, 'Why') },
    { key: 'section_what', pass: hasSection(content, 'What') },
    { key: 'section_ac', pass: hasSection(content, 'Acceptance Criteria') },
    { key: 'section_dependencies', pass: hasSection(content, 'Dependencies') },
    { key: 'section_risk', pass: hasSection(content, 'Risk') },
  ];
  const passed = checks.filter((c) => c.pass).length;
  const score = Math.round((passed / checks.length) * 100);
  const tier = score >= 80 ? 'green' : score >= 50 ? 'yellow' : 'red';
  const missing = checks.filter((c) => !c.pass).map((c) => c.key);
  return { score, tier, passed, total: checks.length, missing };
}

// ── Line-level filtering ──────────────────────────────────────────────────────

function isInternalLink(line) {
  return INTERNAL_LINK_PATTERNS.some((p) => p.test(line));
}

function isQuotedInternalSpeech(line) {
  // Match "> **铲屎官原话**：" or "> 铲屎官原话：" style blocks
  return /^>\s*\*?\*?铲屎官(原话)?\*?\*?\s*[：:]/.test(line);
}

function sanitizeLine(line) {
  let result = line;
  for (const [pattern, replacement] of SANITIZE_REPLACEMENTS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

// ── Section-level filtering ───────────────────────────────────────────────────

function shouldKeepSection(section) {
  if (section.heading === null) return true; // Preamble (title + status line)
  if (section.level === 1) return true; // # Title

  const normalizedName = section.name
    .replace(/[（(].*?[)）]/g, '') // strip parenthetical notes
    .trim()
    .toLowerCase();

  if (SECTIONS_TO_STRIP.has(normalizedName)) return false;
  // Keep known sections + any unknown ones (conservative approach for public export)
  return true;
}

function filterSectionBody(body) {
  const filtered = [];
  let skipQuoteBlock = false;

  for (const line of body) {
    // Detect start of a quoted internal speech block
    if (isQuotedInternalSpeech(line)) {
      skipQuoteBlock = true;
      continue;
    }

    // Continue skipping multi-line quote blocks
    if (skipQuoteBlock) {
      if (line.startsWith('>')) continue;
      skipQuoteBlock = false;
    }

    // Skip internal links
    if (isInternalLink(line)) continue;

    // Skip lines referencing historical backlog archives
    if (/历史来源：旧 BACKLOG 归档条目/.test(line)) continue;
    if (/从历史 BACKLOG 归档恢复/.test(line)) continue;

    filtered.push(sanitizeLine(line));
  }

  return filtered;
}

// ── Main export logic ─────────────────────────────────────────────────────────

function exportFeatureDoc(content) {
  const { raw: frontmatterBlock, rest } = extractFrontmatter(content);
  const sections = splitSections(rest);

  const outputParts = [];

  // Rebuild frontmatter — strip internal-only fields, keep structure
  if (frontmatterBlock) {
    // Sanitize frontmatter content too
    outputParts.push(sanitizeLine(frontmatterBlock));
  }

  for (const section of sections) {
    if (!shouldKeepSection(section)) continue;

    const filteredBody = filterSectionBody(section.body);

    // Build section output
    if (section.heading) {
      outputParts.push(sanitizeLine(section.heading));
    }
    outputParts.push(filteredBody.join('\n'));
  }

  let result = outputParts.join('\n');
  // Clean up excessive blank lines (3+ → 2)
  result = result.replace(/\n{3,}/g, '\n\n');
  // Ensure trailing newline
  if (!result.endsWith('\n')) result += '\n';

  return result;
}

// ── Referenced asset extraction ───────────────────────────────────────────────

/**
 * Extract relative asset paths from exported markdown content.
 * Matches markdown links/images pointing to assets/ subdirectory.
 */
function extractAssetRefs(content) {
  const refs = new Set();
  const patterns = [
    /\[.*?\]\((assets\/[^)\s]+)\)/g, // [text](assets/...)
    /!\[.*?\]\((assets\/[^)\s]+)\)/g, // ![alt](assets/...)
    /(?:src|href)=["'](assets\/[^"']+)["']/g, // src="assets/..." in HTML
  ];
  for (const pattern of patterns) {
    for (const match of content.matchAll(pattern)) {
      refs.add(match[1]);
    }
  }
  return [...refs];
}

/**
 * Copy referenced asset files from source features dir to output dir.
 * Only copies files that actually exist (by-reference, not whole directory).
 */
function copyReferencedAssets(assetRefs, featuresDir, outputDir) {
  let copied = 0;
  for (const ref of assetRefs) {
    const srcPath = path.join(featuresDir, ref);
    const destPath = path.join(outputDir, ref);
    if (fs.existsSync(srcPath)) {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
  return copied;
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const options = {
    featuresDir: path.resolve(process.cwd(), 'docs', 'features'),
    outputDir: null,
    dryRun: false,
    minTier: 'yellow', // minimum tier to auto-export ('green', 'yellow', 'red')
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      console.log(`Usage: node scripts/export-public-feature-docs.mjs [options]

Options:
  --features-dir <path>   Feature docs directory (default: docs/features)
  --output-dir <path>     Output directory for public exports (required unless --dry-run)
  --dry-run               Show what would be exported without writing files
  --min-tier <tier>       Minimum conformance tier to auto-export (default: yellow)
  --help                  Show this help`);
      process.exit(0);
    }
    if (arg === '--features-dir') {
      options.featuresDir = path.resolve(process.cwd(), argv[++i]);
      continue;
    }
    if (arg === '--output-dir') {
      options.outputDir = path.resolve(process.cwd(), argv[++i]);
      continue;
    }
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (arg === '--min-tier') {
      options.minTier = argv[++i];
      continue;
    }
    throw new Error(`Unknown argument: ${arg}`);
  }

  if (!options.dryRun && !options.outputDir) {
    throw new Error('--output-dir is required unless --dry-run');
  }
  return options;
}

function listFeatureFiles(featuresDir) {
  return fs
    .readdirSync(featuresDir, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => e.name)
    .filter((name) => /^F\d+.*\.md$/i.test(name))
    .sort((a, b) => a.localeCompare(b))
    .map((name) => path.join(featuresDir, name));
}

const TIER_ORDER = { green: 0, yellow: 1, red: 2 };

function meetsMinTier(tier, minTier) {
  return (TIER_ORDER[tier] ?? 2) <= (TIER_ORDER[minTier] ?? 1);
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const featureFiles = listFeatureFiles(options.featuresDir);

  const results = { exported: [], skipped: [], errors: [], assetsCopied: 0 };

  for (const filePath of featureFiles) {
    const fileName = path.basename(filePath);
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const conformance = checkConformance(content);
      const { map: frontmatter } = extractFrontmatter(content);
      const featureId = parseFeatureIds(frontmatter.feature_ids)[0] ?? normalizeFeatureId(fileName) ?? 'UNKNOWN';

      if (!meetsMinTier(conformance.tier, options.minTier)) {
        results.skipped.push({
          file: fileName,
          featureId,
          tier: conformance.tier,
          score: conformance.score,
          missing: conformance.missing,
        });
        continue;
      }

      const publicContent = exportFeatureDoc(content);

      if (!options.dryRun && options.outputDir) {
        const outPath = path.join(options.outputDir, fileName);
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, publicContent, 'utf8');

        // Copy referenced assets (by-reference, not whole directory)
        const assetRefs = extractAssetRefs(publicContent);
        if (assetRefs.length > 0) {
          const copied = copyReferencedAssets(assetRefs, options.featuresDir, options.outputDir);
          results.assetsCopied += copied;
        }
      }

      results.exported.push({ file: fileName, featureId, tier: conformance.tier, score: conformance.score });
    } catch (err) {
      results.errors.push({ file: fileName, error: err.message });
    }
  }

  // Report
  console.log(`\n=== Feature Docs Public Export ===`);
  console.log(`Source: ${options.featuresDir}`);
  console.log(`Output: ${options.dryRun ? '(dry run)' : options.outputDir}`);
  console.log(`Min tier: ${options.minTier}`);
  console.log(
    `\nExported: ${results.exported.length} | Skipped: ${results.skipped.length} | Errors: ${results.errors.length} | Assets: ${results.assetsCopied}`,
  );

  if (results.exported.length > 0) {
    console.log(`\n✓ Exported (${results.exported.length}):`);
    for (const r of results.exported) {
      console.log(`  [${r.tier.toUpperCase().padEnd(6)}] ${r.featureId} ${r.file} (${r.score}%)`);
    }
  }

  if (results.skipped.length > 0) {
    console.log(`\n⚠ Skipped — below min tier (${results.skipped.length}):`);
    for (const r of results.skipped) {
      console.log(
        `  [${r.tier.toUpperCase().padEnd(6)}] ${r.featureId} ${r.file} (${r.score}%) missing: ${r.missing.join(', ')}`,
      );
    }
  }

  if (results.errors.length > 0) {
    console.log(`\n✗ Errors (${results.errors.length}):`);
    for (const r of results.errors) {
      console.log(`  ${r.file}: ${r.error}`);
    }
  }

  // Write summary JSON for downstream tooling
  if (!options.dryRun && options.outputDir) {
    const summaryPath = path.join(options.outputDir, '.export-summary.json');
    fs.writeFileSync(
      summaryPath,
      `${JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          minTier: options.minTier,
          exported: results.exported.length,
          skipped: results.skipped.length,
          errors: results.errors.length,
          skippedFiles: results.skipped.map((r) => r.file),
        },
        null,
        2,
      )}\n`,
      'utf8',
    );
  }

  // Exit code: 1 if errors, 0 otherwise
  process.exit(results.errors.length > 0 ? 1 : 0);
}

run();
