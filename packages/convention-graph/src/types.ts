export type Confidence = 'static' | 'heuristic';

export interface Provenance {
  extractor: string;
  extractorVersion: string;
  sourceFile?: string;
  sourceLine?: number;
  confidence?: Confidence;
}

export interface ConventionNode {
  id: string;
  domainId: string;
  kind: string;
  name: string;
  scopeKey: string;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  lang?: string;
  metadata?: Record<string, unknown>;
}

export interface ConventionEdge {
  source: string;
  target: string;
  kind: string;
  domainId: string;
  provenance: Provenance;
}

export interface ConventionGap {
  domainId: string;
  reason: string;
  filePath?: string;
}

export interface ExtractionResult {
  nodes: ConventionNode[];
  edges: ConventionEdge[];
  gaps?: ConventionGap[];
}

export interface IngestOptions {
  /**
   * Treat this extraction as the fresh full result for these domains.
   * Old rows from those domains are cleared before inserting new rows, so
   * removed or renamed conventions cannot remain live after a re-index.
   * If omitted, non-empty extraction results infer domains from their rows.
   * Empty results must pass this explicitly because there is no row to infer from.
   */
  replaceDomains?: readonly string[];
}

export interface NodeQuery {
  domainId?: string;
  kind?: string;
  name?: string;
}

export interface SourceContent {
  path: string;
  content: string;
}

export type PendingChangeReason = 'modified' | 'untracked' | 'deleted';

export interface PendingChange {
  path: string;
  reason: PendingChangeReason;
}

export interface Freshness {
  indexCommit: string | null;
  stale: boolean;
  pendingChanges: PendingChange[];
}

export interface Consumer {
  node: ConventionNode;
  edge: ConventionEdge;
}
