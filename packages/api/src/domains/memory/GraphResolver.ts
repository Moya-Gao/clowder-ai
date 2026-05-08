import type { CollectionSensitivity } from './collection-types.js';
import { COLLECTION_SENSITIVITY_ORDER } from './collection-types.js';
import type { EvidenceItem } from './interfaces.js';

export interface GraphStore {
  getByAnchor(anchor: string): Promise<EvidenceItem | null>;
  getRelated(anchor: string): Promise<
    Array<{
      anchor: string;
      relation: string;
      fromCollectionId: string | null;
      toCollectionId: string | null;
      edgeSensitivity: string | null;
      provenance: string | null;
    }>
  >;
}

export interface GraphNode {
  anchor: string;
  collectionId: string;
  sensitivity: CollectionSensitivity;
  kind: string;
  title: string;
  redacted: boolean;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: string;
  crossCollection: boolean;
  edgeSensitivity: CollectionSensitivity;
  provenance: string;
  redacted: boolean;
}

export interface GraphResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
  center?: string;
  depth: number;
  deprecationWarnings?: string[];
}

interface CatalogLike {
  list(): Array<{ id: string; sensitivity: CollectionSensitivity; kind: string }>;
  get(id: string): { id: string; sensitivity: CollectionSensitivity; kind: string } | undefined;
}

interface BuildSubgraphOptions {
  depth?: number;
  callerCollections?: string[];
}

function inferCollectionIdSync(anchor: string, catalog: CatalogLike): string | undefined {
  const manifests = catalog.list();
  for (const m of manifests) {
    if (anchor.startsWith(`${m.id}:`)) return m.id;
  }
  return undefined;
}

async function inferCollectionId(
  anchor: string,
  catalog: CatalogLike,
  stores: Map<string, GraphStore>,
): Promise<string | undefined> {
  const fast = inferCollectionIdSync(anchor, catalog);
  if (fast) return fast;
  for (const [collectionId, s] of stores) {
    const doc = await s.getByAnchor(anchor);
    if (doc) return collectionId;
  }
  return undefined;
}

function stricterSensitivity(a: CollectionSensitivity, b: CollectionSensitivity): CollectionSensitivity {
  const orderA = COLLECTION_SENSITIVITY_ORDER[a] ?? 3;
  const orderB = COLLECTION_SENSITIVITY_ORDER[b] ?? 3;
  return orderA <= orderB ? a : b;
}

export class GraphResolver {
  constructor(
    private catalog: CatalogLike,
    private stores: Map<string, GraphStore>,
  ) {}

  async buildSubgraph(anchor: string, opts?: BuildSubgraphOptions): Promise<GraphResult> {
    const depth = opts?.depth ?? 1;
    const callerCollections = new Set(opts?.callerCollections ?? []);
    const nodesMap = new Map<string, GraphNode>();
    const edgesArr: GraphEdge[] = [];
    const edgeKeySet = new Set<string>();
    const visited = new Set<string>();
    const redactedAnchorMap = new Map<string, string>();
    const unresolvedRedactionMap = new Map<string, { sensitivity: CollectionSensitivity; redacted: boolean }>();
    const lookupAliasesByCanonicalAnchor = new Map<string, Set<string>>();
    let redactedCounter = 0;
    let frontier = [anchor];
    let resolvedCenterAnchor = anchor;

    const opaqueAnchor = (realAnchor: string): string => {
      if (redactedAnchorMap.has(realAnchor)) return redactedAnchorMap.get(realAnchor)!;
      const opaque = `[redacted:${++redactedCounter}]`;
      redactedAnchorMap.set(realAnchor, opaque);
      return opaque;
    };

    const rememberLookupAlias = (canonicalAnchor: string, lookupAnchor: string): void => {
      if (canonicalAnchor === lookupAnchor) return;
      const aliases = lookupAliasesByCanonicalAnchor.get(canonicalAnchor) ?? new Set<string>();
      aliases.add(lookupAnchor);
      lookupAliasesByCanonicalAnchor.set(canonicalAnchor, aliases);
    };

    const lookupAnchorsFor = (canonicalAnchor: string): string[] => {
      const anchors = new Set([canonicalAnchor]);
      for (const alias of lookupAliasesByCanonicalAnchor.get(canonicalAnchor) ?? []) {
        anchors.add(alias);
      }
      return [...anchors];
    };

    const canUseLookupAnchorInStore = async (
      store: GraphStore,
      lookupAnchor: string,
      canonicalAnchor: string,
    ): Promise<boolean> => {
      if (lookupAnchor === canonicalAnchor) return true;
      const lookupDoc = await store.getByAnchor(lookupAnchor);
      return lookupDoc?.anchor === canonicalAnchor;
    };

    for (let d = 0; d <= depth && frontier.length > 0; d++) {
      const nextFrontier: string[] = [];

      for (const currentAnchor of frontier) {
        if (visited.has(currentAnchor)) continue;
        visited.add(currentAnchor);

        const collectionId = await inferCollectionId(currentAnchor, this.catalog, this.stores);
        if (!collectionId) {
          if (d > 0 && !nodesMap.has(currentAnchor)) {
            const unresolvedRedaction = unresolvedRedactionMap.get(currentAnchor);
            const shouldRedact = unresolvedRedaction?.redacted ?? false;
            const sensitivity = unresolvedRedaction?.sensitivity ?? 'internal';
            nodesMap.set(currentAnchor, {
              anchor: shouldRedact ? opaqueAnchor(currentAnchor) : currentAnchor,
              collectionId: '',
              sensitivity,
              kind: 'unresolved',
              title: shouldRedact ? `[redacted — ${sensitivity} unresolved]` : currentAnchor,
              redacted: shouldRedact,
            });
          }
          continue;
        }
        const manifest = this.catalog.get(collectionId);
        const sensitivity: CollectionSensitivity = manifest?.sensitivity ?? 'internal';
        const isRedacted =
          (sensitivity === 'private' || sensitivity === 'restricted') && !callerCollections.has(collectionId);
        const store = collectionId ? this.stores.get(collectionId) : undefined;
        const doc = store ? await store.getByAnchor(currentAnchor) : null;
        const canonicalAnchor = doc?.anchor ?? currentAnchor;
        rememberLookupAlias(canonicalAnchor, currentAnchor);

        if (d === 0 && currentAnchor === anchor) {
          resolvedCenterAnchor = canonicalAnchor;
        }
        if (canonicalAnchor !== currentAnchor) {
          if (visited.has(canonicalAnchor)) continue;
          visited.add(canonicalAnchor);
        }

        const nodeAnchor = isRedacted ? opaqueAnchor(canonicalAnchor) : canonicalAnchor;

        if (!nodesMap.has(canonicalAnchor)) {
          let kind = manifest?.kind ?? 'unknown';
          let title = canonicalAnchor;

          if (doc) {
            kind = doc.kind;
            title = doc.title;
          }

          nodesMap.set(canonicalAnchor, {
            anchor: nodeAnchor,
            collectionId: isRedacted ? '' : collectionId,
            sensitivity,
            kind: isRedacted ? 'redacted' : kind,
            title: isRedacted ? `[redacted — ${sensitivity} collection]` : title,
            redacted: isRedacted,
          });
        }

        if (d >= depth) continue;

        for (const [, s] of this.stores) {
          for (const lookupAnchor of lookupAnchorsFor(canonicalAnchor)) {
            if (!(await canUseLookupAnchorInStore(s, lookupAnchor, canonicalAnchor))) continue;
            const related = await s.getRelated(lookupAnchor);
            for (const rel of related) {
              const relCollectionId = await inferCollectionId(rel.anchor, this.catalog, this.stores);
              const relStore = relCollectionId ? this.stores.get(relCollectionId) : undefined;
              const relDoc = relStore ? await relStore.getByAnchor(rel.anchor) : null;
              const relCanonicalAnchor = relDoc?.anchor ?? rel.anchor;
              rememberLookupAlias(relCanonicalAnchor, rel.anchor);
              const isCross = collectionId !== relCollectionId;
              const relManifest = relCollectionId ? this.catalog.get(relCollectionId) : undefined;
              const relSensitivity: CollectionSensitivity = relManifest?.sensitivity ?? 'internal';

              const edgeSensitivity =
                (rel.edgeSensitivity as CollectionSensitivity) ?? stricterSensitivity(sensitivity, relSensitivity);
              const relIsRedacted =
                (relSensitivity === 'private' || relSensitivity === 'restricted') &&
                !callerCollections.has(relCollectionId ?? '');
              const edgeRedacted =
                (edgeSensitivity === 'private' || edgeSensitivity === 'restricted') &&
                (!callerCollections.has(collectionId ?? '') || !callerCollections.has(relCollectionId ?? ''));
              const unresolvedRelRedacted = !relCollectionId && edgeRedacted;
              if (unresolvedRelRedacted) {
                unresolvedRedactionMap.set(relCanonicalAnchor, { sensitivity: edgeSensitivity, redacted: true });
              }
              const unresolvedRelRedaction = unresolvedRedactionMap.get(relCanonicalAnchor);
              const relOutputRedacted =
                relIsRedacted || unresolvedRelRedacted || (unresolvedRelRedaction?.redacted ?? false);

              const edgeKey = `${canonicalAnchor}→${relCanonicalAnchor}:${rel.relation}`;
              const reverseKey = `${relCanonicalAnchor}→${canonicalAnchor}:${rel.relation}`;
              if (!edgeKeySet.has(edgeKey) && !edgeKeySet.has(reverseKey)) {
                edgeKeySet.add(edgeKey);
                edgesArr.push({
                  from: isRedacted ? opaqueAnchor(canonicalAnchor) : canonicalAnchor,
                  to: relOutputRedacted ? opaqueAnchor(relCanonicalAnchor) : relCanonicalAnchor,
                  relation: rel.relation,
                  crossCollection: isCross,
                  edgeSensitivity,
                  provenance: rel.provenance ?? 'manual',
                  redacted: edgeRedacted || (unresolvedRelRedaction?.redacted ?? false),
                });
              }

              if (!visited.has(relCanonicalAnchor)) {
                nextFrontier.push(relCanonicalAnchor);
              }
            }
          }
        }
      }

      frontier = nextFrontier;
    }

    const finalNodes = Array.from(nodesMap.entries()).map(([realAnchor, node]) => {
      const unresolvedRedaction = unresolvedRedactionMap.get(realAnchor);
      if (!unresolvedRedaction?.redacted) return node;
      return {
        ...node,
        anchor: opaqueAnchor(realAnchor),
        sensitivity: unresolvedRedaction.sensitivity,
        title: `[redacted — ${unresolvedRedaction.sensitivity} unresolved]`,
        redacted: true,
      };
    });
    const centerRedaction = unresolvedRedactionMap.get(resolvedCenterAnchor);
    const center = nodesMap.has(resolvedCenterAnchor)
      ? centerRedaction?.redacted
        ? opaqueAnchor(resolvedCenterAnchor)
        : nodesMap.get(resolvedCenterAnchor)?.anchor
      : undefined;

    const finalEdges = edgesArr.map((edge) => {
      const fromUnresolvedRedacted = unresolvedRedactionMap.get(edge.from)?.redacted ?? false;
      const toUnresolvedRedacted = unresolvedRedactionMap.get(edge.to)?.redacted ?? false;
      if (!fromUnresolvedRedacted && !toUnresolvedRedacted) return edge;
      return {
        ...edge,
        from: fromUnresolvedRedacted ? opaqueAnchor(edge.from) : edge.from,
        to: toUnresolvedRedacted ? opaqueAnchor(edge.to) : edge.to,
        redacted: true,
      };
    });

    return {
      nodes: finalNodes,
      edges: finalEdges,
      center,
      depth,
    };
  }
}
