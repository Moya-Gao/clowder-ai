#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DOC_KIND_MAP = new Map([
  ['plans', 'plan'],
  ['discussions', 'discussion'],
  ['research', 'research'],
  ['bug-report', 'bug-report'],
  ['mailbox', 'mailbox'],
  ['decisions', 'decision'],
  ['features', 'note'],
]);

const DEFAULT_TODAY = '2026-02-26';

const FEATURE_FILENAME_MAP = new Map([
  ['F010', 'F010-mobile-cat.md'],
  ['F014', 'F014-svg-cat-animation.md'],
  ['F015', 'F015-backlog-management.md'],
  ['F021', 'F021-signal-study-mode.md'],
  ['F032', 'F032-agent-plugin-architecture.md'],
  ['F033', 'F033-session-strategy-configurability.md'],
  ['F036', 'F036-logo-stroke-animation.md'],
  ['F037', 'F037-agent-swarm.md'],
  ['F038', 'F038-skills-discovery.md'],
  ['F039', 'F039-message-queue-delivery.md'],
  ['F040', 'F40-backlog-reorganization.md'],
]);

const STOPWORDS = new Set([
  'docs',
  'doc',
  'archive',
  'plans',
  'plan',
  'discussions',
  'discussion',
  'research',
  'mailbox',
  'bug',
  'report',
  'features',
  'feature',
  'decision',
  'decisions',
  'readme',
  'md',
  'the',
  'and',
  'for',
  'with',
  'from',
  'phase',
  'round',
  'review',
]);

const HELP = `Usage: node scripts/f40-backlog-metadata.mjs [--apply --yes]

Default mode is dry-run.

Flags:
  --apply      write files
  --yes        required with --apply
  --docs-root  docs root directory (default: docs)
  --today      date to write in generated docs (default: 2026-02-26)
`;

function parseArgs(argv) {
  const out = {
    apply: false,
    yes: false,
    docsRoot: path.resolve(process.cwd(), 'docs'),
    today: DEFAULT_TODAY,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply') out.apply = true;
    else if (arg === '--yes') out.yes = true;
    else if (arg === '--docs-root') out.docsRoot = path.resolve(process.cwd(), argv[++i] ?? '');
    else if (arg === '--today') out.today = argv[++i] ?? DEFAULT_TODAY;
    else if (arg === '-h' || arg === '--help') {
      console.log(HELP);
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${arg}`);
    }
  }

  if (out.apply && !out.yes) throw new Error('Refusing to write without --yes');
  return out;
}

function walkMarkdownFiles(root) {
  const files = [];
  const stack = [root];
  while (stack.length > 0) {
    const current = stack.pop();
    if (!current || !fs.existsSync(current)) continue;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(fullPath);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(fullPath);
    }
  }
  return files.sort();
}

function normalizeFeatureId(raw) {
  const match = raw.match(/f(\d{1,3})/i);
  if (!match) return null;
  const num = Number(match[1]);
  if (!Number.isInteger(num) || num <= 0) return null;
  return `F${String(num).padStart(3, '0')}`;
}

function normalizeDebtId(raw) {
  const tdMatch = raw.match(/td(\d{1,3})/i);
  if (tdMatch) return `TD${String(Number(tdMatch[1])).padStart(3, '0')}`;
  const numMatch = raw.match(/\d{1,3}/);
  if (!numMatch) return raw;
  return `TD${String(Number(numMatch[0])).padStart(3, '0')}`;
}

function inferDocKind(relativePath) {
  const normalized = relativePath.replaceAll('\\', '/');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length === 0) return 'note';

  let bucket = parts[0];
  if (bucket === 'archive') {
    bucket = parts[2] ?? 'note';
  }
  return DOC_KIND_MAP.get(bucket) ?? 'note';
}

function inferFeatureIds(relativePath, content) {
  const matches = new Set();
  const heading = firstHeading(content);
  const sample = heading.startsWith('F') ? `${relativePath}\n${heading}` : relativePath;
  const regex = /(?:^|[^A-Za-z0-9])f(\d{1,3})(?:\+\+|[a-z])?(?=$|[^A-Za-z0-9])/gi;
  for (const match of sample.matchAll(regex)) {
    const id = normalizeFeatureId(`F${match[1]}`);
    if (id) matches.add(id);
  }
  return [...matches].sort();
}

function inferCreatedDate(relativePath, today) {
  const match = relativePath.match(/(20\d{2})-(\d{2})-(\d{2})/);
  if (match) return `${match[1]}-${match[2]}-${match[3]}`;
  return today;
}

function inferTopics(relativePath, featureIds) {
  const normalized = relativePath.replaceAll('\\', '/').toLowerCase();
  const tokens = normalized
    .replace(/\.md$/i, '')
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .filter((token) => !STOPWORDS.has(token))
    .filter((token) => !/^\d+$/.test(token))
    .filter((token) => !/^f\d{1,3}[a-z]*$/.test(token));

  const unique = [...new Set(tokens)].slice(0, 3);
  if (unique.length > 0) return unique;
  if (featureIds.length > 0) return [featureIds[0].toLowerCase()];
  return ['general'];
}

function hasFrontmatter(content) {
  return /^\uFEFF?---\n[\s\S]*?\n---\n/.test(content);
}

function parseFrontmatter(content) {
  const match = content.match(/^\uFEFF?---\n([\s\S]*?)\n---\n/);
  if (!match) return null;
  const lines = match[1].split('\n');
  const parsed = {};
  for (const line of lines) {
    const kv = line.match(/^([a-z_]+):\s*(.+)$/);
    if (!kv) continue;
    const key = kv[1];
    const value = kv[2].trim();
    if (value.startsWith('[') && value.endsWith(']')) {
      const items = value
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      parsed[key] = items;
    } else {
      parsed[key] = value;
    }
  }
  return parsed;
}

function addFrontmatterIfMissing(content, metadata) {
  if (hasFrontmatter(content)) return content;
  return applyContractFrontmatter(content, metadata);
}

function applyContractFrontmatter(content, metadata) {
  const body = content.replace(/^\uFEFF?---\n[\s\S]*?\n---\n?/, '');
  const normalizedBody = body.startsWith('\n') ? body.slice(1) : body;
  const frontmatter = [
    '---',
    `feature_ids: [${metadata.featureIds.join(', ')}]`,
    `topics: [${metadata.topics.join(', ')}]`,
    `doc_kind: ${metadata.docKind}`,
    `created: ${metadata.created}`,
    '---',
    '',
    '',
  ].join('\n');
  return `${frontmatter}${normalizedBody}`;
}

function stripMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*`_~]/g, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function inferBacklogStatus(raw) {
  const normalized = raw.toLowerCase();
  if (normalized.includes('[~]') || normalized.includes('in-progress')) return 'in-progress';
  if (normalized.includes('review') || normalized.includes('lgtm')) return 'review';
  if (normalized.includes('[ ]') || normalized.includes('todo')) return 'idea';
  if (/p\d/.test(normalized)) return 'in-progress';
  return 'spec';
}

function parseFeatureTableRows(sectionText) {
  const rows = [];
  for (const line of sectionText.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    if (line.includes('|---')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 3) continue;
    if (cells[0] === '#' || cells[0].toLowerCase() === 'id') continue;
    rows.push(cells);
  }
  return rows;
}

function extractActiveFeatures(backlogText) {
  const start = backlogText.indexOf('## Feature Requests');
  if (start < 0) return [];
  const after = backlogText.slice(start);
  const nextHeaderIndex = after.indexOf('\n## ', 10);
  const section = nextHeaderIndex > 0 ? after.slice(0, nextHeaderIndex) : after;

  const out = [];
  for (const cells of parseFeatureTableRows(section)) {
    const rawId = stripMarkdown(cells[0] ?? '');
    const name = stripMarkdown(cells[1] ?? '');
    const priorityCell = cells[2] ?? '';
    const isDone = /\[x\]/i.test(priorityCell) || rawId.includes('~~') || priorityCell.includes('~~');
    const id = normalizeFeatureId(rawId);
    if (isDone || !id || !name) continue;
    out.push({
      id,
      name,
      status: inferBacklogStatus(priorityCell),
      owner: '三猫',
    });
  }
  return dedupeFeatures(out);
}

function extractRoadmapFeatures(backlogText) {
  const rows = [];
  for (const line of backlogText.split('\n')) {
    if (!line.trim().startsWith('|')) continue;
    if (line.includes('|---')) continue;
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    if (cells.length < 5) continue;
    if (cells[0].toLowerCase() === 'id') continue;
    const id = normalizeFeatureId(cells[0]);
    if (!id) continue;
    rows.push({
      id,
      name: stripMarkdown(cells[1] ?? ''),
      status: stripMarkdown(cells[2] ?? '') || 'in-progress',
      owner: stripMarkdown(cells[3] ?? '') || '三猫',
    });
  }
  return dedupeFeatures(rows);
}

function dedupeFeatures(items) {
  const byId = new Map();
  for (const item of items) {
    if (!byId.has(item.id)) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function convertDebtTableIds(content) {
  const withTableIds = content.replace(/^\|(\s*)(\d{1,3}|td\d{1,3})(\s*)\|/gim, (_full, pre, raw, post) => {
    return `|${pre}${normalizeDebtId(raw)}${post}|`;
  });
  return withTableIds.replace(/\| # \|/g, '| ID |');
}

function splitDebtSection(backlogText, today) {
  const splitIndex = backlogText.indexOf('## Feature Requests');
  if (splitIndex < 0) {
    throw new Error('Cannot find "## Feature Requests" section in docs/BACKLOG.md');
  }

  const debtOnly = backlogText.slice(0, splitIndex).trimEnd();
  const lines = debtOnly.split('\n');
  if (lines.length > 0 && lines[0].startsWith('# ')) {
    lines[0] = '# Cat Cafe 技术债务';
  }
  if (lines.length > 1 && lines[1].startsWith('> 维护者：')) {
    lines[1] = `> 维护者：三猫 | 最后更新：${today} (F40 拆分)`;
  } else {
    lines.splice(1, 0, `> 维护者：三猫 | 最后更新：${today} (F40 拆分)`);
  }
  lines.splice(2, 0, '> 来源：由原 `docs/BACKLOG.md` 债务段拆分。');

  return convertDebtTableIds(`${lines.join('\n').trimEnd()}\n`);
}

function featureFileName(item) {
  const mapped = FEATURE_FILENAME_MAP.get(item.id);
  if (mapped) return mapped;
  const slug = stripMarkdown(item.name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const safeSlug = slug || 'feature';
  return `${item.id}-${safeSlug}.md`;
}

function ensureFeatureDocs(docsRoot, features, today, apply) {
  const created = [];
  const featureDir = path.join(docsRoot, 'features');
  if (!fs.existsSync(featureDir) && apply) fs.mkdirSync(featureDir, { recursive: true });

  for (const item of features) {
    const filename = featureFileName(item);
    const fullPath = path.join(featureDir, filename);
    if (fs.existsSync(fullPath)) continue;

    const stub = [
      `# ${item.id}: ${item.name}`,
      '',
      `> **Status**: ${item.status}`,
      `> **Owner**: ${item.owner}`,
      `> **Created**: ${today}`,
      '',
      '## Why',
      '- 待补充（F40 自动迁移生成）。',
      '',
      '## What',
      '- 待补充（请补完整体目标、范围与验收标准）。',
      '',
      '## Links',
      '- 待补充。',
      '',
      '## Key Decisions',
      '- 待补充。',
      '',
      '## Dependencies',
      '- **Evolved from**: 待补充',
      '',
      '## Timeline',
      `- ${today}: 由 F40 迁移脚本自动初始化`,
      '',
    ].join('\n');

    if (apply) fs.writeFileSync(fullPath, stub, 'utf8');
    created.push(fullPath);
  }

  return created;
}

function buildFeatureRoadmap(features, today) {
  const rows = features
    .map((item) => {
      const filename = featureFileName(item);
      return `| ${item.id} | ${item.name} | ${item.status} | ${item.owner} | [${item.id}](features/${filename}) |`;
    })
    .join('\n');

  return [
    '# Cat Cafe Feature Roadmap',
    '',
    `> 维护者：三猫 | 最后更新：${today}`,
    '>',
    '> **规则**：只放活跃 Feature（idea/spec/in-progress/review），done 后移除。',
    '> 详细信息见 `docs/features/Fxxx-*.md`。',
    '',
    '| ID | 名称 | Status | Owner | Link |',
    '|----|------|--------|-------|------|',
    rows,
    '',
  ].join('\n');
}

function firstHeading(content) {
  const body = content.replace(/^\uFEFF?---\n[\s\S]*?\n---\n/, '');
  const heading = body.match(/^#\s+(.+)$/m);
  return heading ? heading[1].trim() : '';
}

function buildFeatureIndex(records, generatedAt = new Date().toISOString()) {
  const features = {};
  const unassigned = [];

  for (const record of records) {
    if (record.featureIds.length === 0) {
      unassigned.push(record);
      continue;
    }
    for (const featureId of record.featureIds) {
      const list = features[featureId] ?? [];
      list.push(record);
      features[featureId] = list;
    }
  }

  for (const list of Object.values(features)) {
    list.sort((a, b) => a.path.localeCompare(b.path));
  }
  unassigned.sort((a, b) => a.path.localeCompare(b.path));

  const sortedFeatures = Object.keys(features)
    .sort()
    .reduce((acc, key) => {
      acc[key] = features[key];
      return acc;
    }, {});

  return {
    generatedAt,
    totalDocs: records.length,
    withFeatureIds: records.filter((record) => record.featureIds.length > 0).length,
    unassignedCount: unassigned.length,
    features: sortedFeatures,
    unassigned,
  };
}

function writeIfChanged(filePath, content, apply) {
  const current = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : null;
  const changed = current !== content;
  if (changed && apply) fs.writeFileSync(filePath, content, 'utf8');
  return changed;
}

function migrate(options) {
  const docsRoot = options.docsRoot;
  const backlogPath = path.join(docsRoot, 'BACKLOG.md');
  const techDebtPath = path.join(docsRoot, 'TECH-DEBT.md');
  const featureIndexPath = path.join(docsRoot, 'features', 'index.json');

  const originalBacklog = fs.readFileSync(backlogPath, 'utf8');
  const hasLegacyFeatureSection = originalBacklog.includes('## Feature Requests');
  const activeFeatures = hasLegacyFeatureSection
    ? extractActiveFeatures(originalBacklog)
    : extractRoadmapFeatures(originalBacklog);
  if (!activeFeatures.some((item) => item.id === 'F040')) {
    activeFeatures.push({
      id: 'F040',
      name: 'BACKLOG 整理与 Feature 聚合体系',
      status: 'in-progress',
      owner: '布偶猫',
    });
  }
  const normalizedFeatures = dedupeFeatures(activeFeatures);

  const createdFeatureDocs = ensureFeatureDocs(docsRoot, normalizedFeatures, options.today, options.apply);
  const debtContent = hasLegacyFeatureSection
    ? splitDebtSection(originalBacklog, options.today)
    : fs.existsSync(techDebtPath)
      ? fs.readFileSync(techDebtPath, 'utf8')
      : '';
  const roadmapContent = buildFeatureRoadmap(normalizedFeatures, options.today);

  const backlogChanged = writeIfChanged(backlogPath, roadmapContent, options.apply);
  const techDebtChanged = debtContent ? writeIfChanged(techDebtPath, debtContent, options.apply) : false;

  const markdownFiles = walkMarkdownFiles(docsRoot);
  let frontmatterUpdated = 0;
  let frontmatterUnchanged = 0;
  const records = [];

  for (const filePath of markdownFiles) {
    const relative = path.relative(docsRoot, filePath).replaceAll(path.sep, '/');
    const original = fs.readFileSync(filePath, 'utf8');
    const inferredFeatureIds = inferFeatureIds(relative, original);
    const metadata = {
      featureIds: inferredFeatureIds,
      topics: inferTopics(relative, inferredFeatureIds),
      docKind: inferDocKind(relative),
      created: inferCreatedDate(relative, options.today),
    };
    const withFrontmatter = applyContractFrontmatter(original, metadata);
    if (withFrontmatter !== original) frontmatterUpdated += 1;
    else frontmatterUnchanged += 1;
    if (withFrontmatter !== original && options.apply) fs.writeFileSync(filePath, withFrontmatter, 'utf8');

    const parsed = parseFrontmatter(withFrontmatter);
    const record = {
      path: `docs/${relative}`,
      title: firstHeading(withFrontmatter),
      docKind: String(parsed?.doc_kind ?? metadata.docKind),
      featureIds: Array.isArray(parsed?.feature_ids)
        ? parsed.feature_ids
            .map((item) => normalizeFeatureId(String(item)))
            .filter(Boolean)
            .sort()
        : metadata.featureIds,
      topics: Array.isArray(parsed?.topics) ? parsed.topics.map((item) => String(item)) : metadata.topics,
      created: String(parsed?.created ?? metadata.created),
    };
    records.push(record);
  }

  const index = buildFeatureIndex(records, `${options.today}T00:00:00.000Z`);
  const indexContent = `${JSON.stringify(index, null, 2)}\n`;
  const indexChanged = writeIfChanged(featureIndexPath, indexContent, options.apply);

  return {
    markdownFiles: markdownFiles.length,
    activeFeatures: normalizedFeatures.length,
    createdFeatureDocs: createdFeatureDocs.length,
    frontmatterUpdated,
    frontmatterUnchanged,
    backlogChanged,
    techDebtChanged,
    indexChanged,
    featureIndexPath,
  };
}

function printSummary(summary, apply) {
  console.log(`[f40-metadata] mode=${apply ? 'apply' : 'dry-run'}`);
  console.log(`[f40-metadata] markdown_files=${summary.markdownFiles}`);
  console.log(`[f40-metadata] active_features=${summary.activeFeatures}`);
  console.log(`[f40-metadata] feature_docs_created=${summary.createdFeatureDocs}`);
  console.log(`[f40-metadata] frontmatter_updated=${summary.frontmatterUpdated}`);
  console.log(`[f40-metadata] frontmatter_unchanged=${summary.frontmatterUnchanged}`);
  console.log(`[f40-metadata] backlog_changed=${summary.backlogChanged}`);
  console.log(`[f40-metadata] tech_debt_changed=${summary.techDebtChanged}`);
  console.log(`[f40-metadata] index_changed=${summary.indexChanged}`);
  console.log(`[f40-metadata] index_path=${summary.featureIndexPath}`);
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  const result = migrate(args);
  printSummary(result, args.apply);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    runCli();
  } catch (error) {
    console.error(`[f40-metadata] failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}

export {
  applyContractFrontmatter,
  addFrontmatterIfMissing,
  buildFeatureIndex,
  convertDebtTableIds,
  extractActiveFeatures,
  inferDocKind,
  inferFeatureIds,
  migrate,
  normalizeFeatureId,
};
