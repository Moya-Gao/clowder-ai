// F102: Legacy adapter — wraps IHindsightClient as IEvidenceStore

import type { HindsightMemory, IHindsightClient } from '../cats/services/orchestration/HindsightClient.js';
import type { EvidenceItem, IEvidenceStore, SearchOptions } from './interfaces.js';

export class HindsightAdapter implements IEvidenceStore {
  constructor(
    private readonly client: IHindsightClient,
    private readonly bankId: string,
  ) {}

  async search(query: string, options?: SearchOptions): Promise<EvidenceItem[]> {
    const recallOpts: { limit?: number; tags?: string[] } = {};
    if (options?.limit) recallOpts.limit = options.limit;
    if (options?.kind) recallOpts.tags = [`kind:${options.kind}`];

    const memories = await this.client.recall(this.bankId, query, recallOpts);
    return memories.map(memoryToItem);
  }

  async upsert(items: EvidenceItem[]): Promise<void> {
    const retainItems = items.map((item) => ({
      content: [item.title, item.summary].filter(Boolean).join('\n\n'),
      document_id: item.anchor,
      tags: [`kind:${item.kind}`, `status:${item.status}`],
      metadata: { sourcePath: item.sourcePath ?? '' },
    }));
    await this.client.retain(this.bankId, retainItems);
  }

  async deleteByAnchor(_anchor: string): Promise<void> {
    throw new Error('deleteByAnchor not supported by Hindsight adapter');
  }

  async getByAnchor(_anchor: string): Promise<EvidenceItem | null> {
    throw new Error('getByAnchor not supported by Hindsight adapter');
  }

  async health(): Promise<boolean> {
    return this.client.isHealthy();
  }

  async initialize(): Promise<void> {
    await this.client.ensureBank(this.bankId);
  }
}

function memoryToItem(mem: HindsightMemory): EvidenceItem {
  const title = (mem.content ?? '').split('\n')[0] ?? '';
  const summary = (mem.content ?? '').split('\n').slice(1).join('\n').trim() || undefined;
  const kind = extractTag(mem.tags, 'kind') ?? 'feature';
  const status = extractTag(mem.tags, 'status') ?? 'active';

  const item: EvidenceItem = {
    anchor: mem.document_id ?? `hindsight-${Date.now()}`,
    kind: kind as EvidenceItem['kind'],
    status: status as EvidenceItem['status'],
    title,
    updatedAt: new Date().toISOString(),
  };
  if (summary) item.summary = summary;
  return item;
}

function extractTag(tags: string[] | undefined, prefix: string): string | undefined {
  const tag = tags?.find((t) => t.startsWith(`${prefix}:`));
  return tag?.split(':')[1];
}
