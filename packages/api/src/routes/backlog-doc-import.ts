import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { BacklogDependencies, BacklogPriority, CreateBacklogItemInput } from '@cat-cafe/shared';
import { readdir } from 'node:fs/promises';

export interface BacklogFeatureRow {
  id: string;
  name: string;
  status: string;
  owner: string;
  link?: string;
}

function findMonorepoRoot(start = process.cwd()): string {
  let current = resolve(start);
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return start;
    current = parent;
  }
}

function parseTableCells(line: string): string[] {
  const normalized = line.trim();
  if (!normalized.startsWith('|')) return [];
  const body = normalized.endsWith('|')
    ? normalized.slice(1, -1)
    : normalized.slice(1);
  return body.split('|').map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function extractLink(linkCell: string): string | undefined {
  const match = linkCell.match(/\[[^\]]+\]\(([^)]+)\)/);
  return match?.[1]?.trim() || undefined;
}

export function parseActiveFeaturesFromBacklog(markdown: string): BacklogFeatureRow[] {
  const lines = markdown.split(/\r?\n/);
  const headerIndex = lines.findIndex((line) => /^\|\s*ID\s*\|\s*名称\s*\|\s*Status\s*\|\s*Owner\s*\|\s*Link\s*\|?\s*$/i.test(line.trim()));
  if (headerIndex < 0) return [];

  const rows: BacklogFeatureRow[] = [];
  const seen = new Set<string>();
  for (let index = headerIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim() ?? '';
    if (line.length === 0) continue;
    if (!line.startsWith('|')) break;

    const cells = parseTableCells(line);
    if (cells.length < 5 || isSeparatorRow(cells)) continue;

    const id = cells[0]?.trim().toUpperCase() ?? '';
    if (!/^F\d{3}$/.test(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);

    const link = extractLink(cells[4] ?? '');
    rows.push({
      id,
      name: cells[1]?.trim() ?? '',
      status: cells[2]?.trim() ?? 'idea',
      owner: cells[3]?.trim() ?? '三猫',
      ...(link ? { link } : {}),
    });
  }

  return rows;
}

function normalizeStatus(status: string): string {
  return status.trim().toLowerCase().replace(/\s+/g, '-');
}

function statusToPriority(status: string): BacklogPriority {
  switch (normalizeStatus(status)) {
    case 'in-progress':
    case 'review':
      return 'p1';
    case 'spec':
      return 'p2';
    default:
      return 'p3';
  }
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

export function buildBacklogInputFromFeature(row: BacklogFeatureRow, userId: string, dependencies?: BacklogDependencies): CreateBacklogItemInput {
  const title = truncate(`[${row.id}] ${row.name}`, 200);
  const summarySegments = [
    '来源 docs/BACKLOG.md',
    `状态：${row.status}`,
    `Owner：${row.owner}`,
    row.link ? `Link：${row.link}` : null,
  ].filter(Boolean);
  const summary = truncate(summarySegments.join(' | '), 2000);
  const statusTag = normalizeStatus(row.status) || 'idea';

  return {
    userId,
    title,
    summary,
    priority: statusToPriority(row.status),
    tags: [
      'source:docs-backlog',
      `feature:${row.id.toLowerCase()}`,
      `status:${statusTag}`,
    ],
    createdBy: 'user',
    ...(dependencies && Object.keys(dependencies).length > 0 ? { dependencies } : {}),
  };
}

export function getFeatureTagId(tags: readonly string[]): string | null {
  for (const tag of tags) {
    if (tag.startsWith('feature:')) return tag.slice('feature:'.length).toLowerCase();
  }
  return null;
}



export function parseFeatureDocStatus(markdown: string): string | null {
  const match = markdown.match(/>\s*\*\*Status\*\*:\s*(\w[\w\s-]*)/i);
  return match?.[1]?.trim().toLowerCase() ?? null;
}

function extractFeatureIds(text: string): string[] {
  return [...text.matchAll(/F\d{3}/gi)].map((m) => m[0].toLowerCase());
}

export function parseFeatureDocDependencies(markdown: string): BacklogDependencies {
  const evolvedFrom: string[] = [];
  const blockedBy: string[] = [];
  const related: string[] = [];

  // 1. Extract from frontmatter related_features
  const fmMatch = markdown.match(/^---\s*\n([\s\S]*?)\n---/);
  if (fmMatch) {
    const relatedMatch = fmMatch[1]?.match(/related_features:\s*\[([^\]]*)\]/);
    if (relatedMatch) {
      related.push(...(relatedMatch[1] ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
    }
  }

  // 2. Extract from Dependencies section body
  for (const line of markdown.split(/\r?\n/)) {
    if (/\*\*Evolved from\*\*/i.test(line)) {
      evolvedFrom.push(...extractFeatureIds(line));
    }
    if (/\*\*Blocked by\*\*/i.test(line)) {
      blockedBy.push(...extractFeatureIds(line));
    }
  }

  // Deduplicate; remove related entries that are specialized
  const specialized = new Set([...evolvedFrom, ...blockedBy]);
  const dedupRelated = [...new Set(related)].filter((id) => !specialized.has(id));
  const dedupEvolved = [...new Set(evolvedFrom)];
  const dedupBlocked = [...new Set(blockedBy)];

  return {
    ...(dedupEvolved.length > 0 ? { evolvedFrom: dedupEvolved } : {}),
    ...(dedupBlocked.length > 0 ? { blockedBy: dedupBlocked } : {}),
    ...(dedupRelated.length > 0 ? { related: dedupRelated } : {}),
  };
}

export async function readFeatureDocStatuses(featuresDir?: string): Promise<Map<string, string>> {
  const dir = featuresDir ?? join(findMonorepoRoot(), 'docs', 'features');
  const result = new Map<string, string>();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return result;
  }
  for (const entry of entries) {
    const match = entry.match(/^(F\d{3})/i);
    if (!match) continue;
    const featureId = match[1]!.toLowerCase();
    try {
      const fileContent = await readFile(join(dir, entry), 'utf-8');
      const status = parseFeatureDocStatus(fileContent);
      if (status) result.set(featureId, status);
    } catch {
      // skip unreadable files
    }
  }
  return result;
}

export async function readFeatureDocDependencies(featuresDir?: string): Promise<Map<string, BacklogDependencies>> {
  const dir = featuresDir ?? join(findMonorepoRoot(), 'docs', 'features');
  const result = new Map<string, BacklogDependencies>();
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return result;
  }
  for (const entry of entries) {
    const match = entry.match(/^(F\d{3})/i);
    if (!match) continue;
    const featureId = match[1]!.toLowerCase();
    try {
      const fileContent = await readFile(join(dir, entry), 'utf-8');
      const deps = parseFeatureDocDependencies(fileContent);
      if (Object.keys(deps).length > 0) result.set(featureId, deps);
    } catch {
      // skip
    }
  }
  return result;
}

export async function readActiveFeaturesFromBacklog(backlogDocPath?: string): Promise<BacklogFeatureRow[]> {
  const resolvedPath = backlogDocPath ?? join(findMonorepoRoot(), 'docs', 'BACKLOG.md');
  const markdown = await readFile(resolvedPath, 'utf-8');
  return parseActiveFeaturesFromBacklog(markdown);
}
