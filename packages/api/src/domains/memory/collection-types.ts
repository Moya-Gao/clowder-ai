import type { F163Authority } from './f163-types.js';

export const COLLECTION_KINDS = ['project', 'world', 'domain', 'research', 'global'] as const;
export type CollectionKind = (typeof COLLECTION_KINDS)[number];

export type CollectionSensitivity = 'public' | 'internal' | 'private' | 'restricted';

export const COLLECTION_SENSITIVITY_ORDER: Record<CollectionSensitivity, number> = {
  restricted: 0,
  private: 1,
  internal: 2,
  public: 3,
};

export const REVIEW_STATUSES = ['unreviewed', 'partial', 'reviewed', 'stale'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export interface CollectionManifest {
  id: string;
  kind: CollectionKind;
  name: string;
  displayName: string;
  root: string;
  sensitivity: CollectionSensitivity;
  scannerLevel: 0 | 1 | 2 | 3 | 'auto';
  indexPolicy: {
    autoRebuild: boolean;
    rebuildIntervalMs?: number;
  };
  reviewPolicy: {
    authorityCeiling: F163Authority;
    requireOwnerApproval: boolean;
  };
  exclude?: string[];
  createdAt: string;
  updatedAt: string;
}

const COLLECTION_ID_RE = /^[a-z]+:[a-z][a-z0-9-]*$/;

export function validateCollectionId(id: string): void {
  if (!COLLECTION_ID_RE.test(id)) {
    throw new Error(`Invalid collection id format: "${id}" — must be <kind>:<lowercase-name>`);
  }
}

export const SEARCH_DIMENSIONS = ['project', 'global', 'all', 'library', 'collection'] as const;
export type SearchDimension = (typeof SEARCH_DIMENSIONS)[number];

export const ILibraryCatalogSymbol = Symbol.for('ILibraryCatalog');
