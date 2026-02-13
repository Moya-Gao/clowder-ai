import type { RetainItem, RetainOptions } from '../HindsightClient.js';
import {
  P0_LESSONS_PATH,
  P0_PROJECT_TAG,
  buildP0Anchor,
  buildP0DocumentId,
  deriveP0Kind,
  deriveP0Status,
  isP0AllowedSourcePath,
  normalizeSourcePath,
  validateP0Tags,
} from './p0-contract.js';
import { parseLessonsEntries, splitByLevel2Headings } from './p0-markdown-parser.js';

export interface BuildImportItemsInput {
  sourcePath: string;
  sourceCommit: string;
  content: string;
  author: string;
}

function buildGovernanceTags(params: {
  kind: string;
  status: string;
  author: string;
  sourcePath: string;
  sourceCommit: string;
  anchor: string;
}): string[] {
  const tags = [
    P0_PROJECT_TAG,
    `kind:${params.kind}`,
    `status:${params.status}`,
    `author:${params.author}`,
    'origin:git',
    `sourcePath:${params.sourcePath}`,
    `sourceCommit:${params.sourceCommit}`,
    `anchor:${params.anchor}`,
  ];
  validateP0Tags(tags);
  return tags;
}

function buildMetadata(params: {
  kind: string;
  status: string;
  author: string;
  sourcePath: string;
  sourceCommit: string;
  anchor: string;
  heading: string;
  sourceAnchors?: string[];
  related?: string[];
}): Record<string, string> {
  return {
    kind: params.kind,
    status: params.status,
    author: params.author,
    sourcePath: params.sourcePath,
    sourceCommit: params.sourceCommit,
    anchor: params.anchor,
    heading: params.heading,
    sourceAnchors: JSON.stringify(params.sourceAnchors ?? []),
    related: JSON.stringify(params.related ?? []),
  };
}

function buildLessonsItems(params: {
  documentId: string;
  sourcePath: string;
  sourceCommit: string;
  content: string;
  author: string;
}): RetainItem[] {
  const entries = parseLessonsEntries(params.content);
  return entries.map((entry) => {
    const kind = deriveP0Kind(params.sourcePath);
    const status = entry.status;
    const heading = `${entry.id}: ${entry.title}`;
    const anchor = buildP0Anchor(params.sourcePath, heading, entry.id);
    return {
      document_id: params.documentId,
      content: `### ${entry.body}`,
      tags: buildGovernanceTags({
        kind,
        status,
        author: params.author,
        sourcePath: params.sourcePath,
        sourceCommit: params.sourceCommit,
        anchor,
      }),
      metadata: buildMetadata({
        kind,
        status,
        author: params.author,
        sourcePath: params.sourcePath,
        sourceCommit: params.sourceCommit,
        anchor,
        heading,
        sourceAnchors: entry.sourceAnchors,
        related: entry.related,
      }),
    };
  });
}

export function buildP0DocumentTags(tags: string[] | undefined): string[] {
  const base = (tags ?? []).filter((tag) => !tag.startsWith('anchor:'));
  return Array.from(new Set(base));
}

export function buildP0RetainOptions(tags: string[] | undefined): RetainOptions {
  return {
    async: true,
    document_tags: buildP0DocumentTags(tags),
  };
}

export function buildImportItemsFromMarkdown(input: BuildImportItemsInput): RetainItem[] {
  const sourcePath = normalizeSourcePath(input.sourcePath);
  if (!isP0AllowedSourcePath(sourcePath)) {
    throw new Error(`source path is not in P0 allowlist: ${sourcePath}`);
  }

  const sourceCommit = input.sourceCommit.trim();
  if (!sourceCommit) throw new Error('sourceCommit is required');

  const documentId = buildP0DocumentId(sourcePath);
  const author = input.author.trim() || 'codex';

  if (sourcePath === P0_LESSONS_PATH) {
    return buildLessonsItems({
      documentId,
      sourcePath,
      sourceCommit,
      content: input.content,
      author,
    });
  }

  const kind = deriveP0Kind(sourcePath);
  const status = deriveP0Status(sourcePath);
  return splitByLevel2Headings(input.content).map((section) => {
    const anchor = buildP0Anchor(sourcePath, section.heading);
    return {
      document_id: documentId,
      content: section.content,
      tags: buildGovernanceTags({ kind, status, author, sourcePath, sourceCommit, anchor }),
      metadata: buildMetadata({ kind, status, author, sourcePath, sourceCommit, anchor, heading: section.heading }),
    };
  });
}

export { collectP0ImportSources, readGitHeadCommit } from './p0-source-discovery.js';
