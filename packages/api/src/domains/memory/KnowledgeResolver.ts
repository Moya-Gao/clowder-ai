// F102: IKnowledgeResolver — federated search across project + global indices
// Phase A: project-only; Phase B adds global_knowledge.sqlite (read-only)

import type { IEvidenceStore, IKnowledgeResolver, KnowledgeResult, SearchOptions } from './interfaces.js';

export class KnowledgeResolver implements IKnowledgeResolver {
  constructor(
    private readonly projectStore: IEvidenceStore,
    // Phase B: private readonly globalStore?: IEvidenceStore (read-only)
  ) {}

  async resolve(query: string, options?: SearchOptions): Promise<KnowledgeResult> {
    const results = await this.projectStore.search(query, options);

    // Phase B: fan-out to globalStore, RRF rank fusion
    return {
      results,
      sources: results.length > 0 ? ['project'] : [],
      query,
    };
  }
}
