import { createHash } from 'node:crypto';
import type { ConventionNode, ExtractionResult } from './types.ts';

export function hashContent(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

export function inferDomains(r: ExtractionResult): string[] {
  return [
    ...new Set([
      ...r.nodes.map((n) => n.domainId),
      ...r.edges.map((e) => e.domainId),
      ...(r.gaps ?? []).map((g) => g.domainId),
    ]),
  ];
}

export function rowToNode(r: Record<string, unknown>): ConventionNode {
  return {
    id: r.id as string,
    domainId: r.domain_id as string,
    kind: r.kind as string,
    name: r.name as string,
    scopeKey: r.scope_key as string,
    filePath: (r.file_path as string | null) ?? undefined,
    startLine: (r.start_line as number | null) ?? undefined,
    endLine: (r.end_line as number | null) ?? undefined,
    lang: (r.lang as string | null) ?? undefined,
    metadata: r.metadata ? (JSON.parse(r.metadata as string) as Record<string, unknown>) : undefined,
  };
}

export function parseFileDomainIds(rawDomainIds: string | null): string[] | null {
  if (!rawDomainIds) return null;
  try {
    const parsed = JSON.parse(rawDomainIds);
    if (!Array.isArray(parsed)) return null;
    return [
      ...new Set(parsed.filter((domainId): domainId is string => typeof domainId === 'string' && domainId.length > 0)),
    ];
  } catch {
    return null;
  }
}

export function fileRowBelongsToAnyDomain(rawDomainIds: string | null, domainIds: readonly string[]): boolean {
  if (domainIds.length === 0) return true;
  const parsed = parseFileDomainIds(rawDomainIds);
  if (!parsed) return true;
  return parsed.some((domainId) => domainIds.includes(domainId));
}

export function mergeFileDomainIds(rawDomainIds: string | null, domainIds: readonly string[]): string[] {
  const parsed = parseFileDomainIds(rawDomainIds) ?? [];
  return [...new Set([...parsed, ...domainIds.filter(Boolean)])];
}

export function removeFileDomainIds(rawDomainIds: string | null, domainIds: readonly string[]): string[] | null {
  if (domainIds.length === 0) return [];
  const parsed = parseFileDomainIds(rawDomainIds);
  if (!parsed) return null;
  return parsed.filter((domainId) => !domainIds.includes(domainId));
}
