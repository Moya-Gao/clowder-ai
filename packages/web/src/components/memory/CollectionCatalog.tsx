'use client';

import React, { useEffect, useState } from 'react';

interface CollectionItem {
  manifest: {
    id: string;
    displayName: string;
    kind: string;
    sensitivity: string;
  };
  overview: {
    docCount: number;
    topKinds: Array<{ kind: string; count: number }>;
    recentAnchors: Array<{ anchor: string; title: string; updatedAt: string }>;
  } | null;
  health: {
    indexFreshness: string;
    pendingReviewCount: number;
  } | null;
}

const SENSITIVITY_BADGE: Record<string, string> = {
  public: 'bg-green-100 text-green-800',
  internal: 'bg-blue-100 text-blue-800',
  private: 'bg-amber-100 text-amber-800',
  restricted: 'bg-red-100 text-red-800',
};

export function CollectionCatalog() {
  const [collections, setCollections] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/library/catalog')
      .then((r) => r.json())
      .then((data) => setCollections(data.collections ?? []))
      .catch(() => setCollections([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="p-4 text-cafe-secondary text-sm">Loading collections...</div>;
  }

  if (collections.length === 0) {
    return <div className="p-4 text-cafe-secondary text-sm">No collections registered.</div>;
  }

  return (
    <div className="grid gap-3" data-testid="collection-catalog">
      {collections.map((c) => (
        <div
          key={c.manifest.id}
          className="rounded-lg border border-cafe bg-white p-4"
          data-testid={`collection-card-${c.manifest.id}`}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm text-cafe-primary">{c.manifest.displayName}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SENSITIVITY_BADGE[c.manifest.sensitivity] ?? ''}`}
            >
              {c.manifest.sensitivity}
            </span>
            <span className="text-[10px] text-cafe-secondary">{c.manifest.kind}</span>
          </div>
          {c.overview && (
            <div className="text-xs text-cafe-secondary">
              <span>{c.overview.docCount} docs</span>
              {c.overview.topKinds.length > 0 && (
                <span className="ml-2">
                  Top:{' '}
                  {c.overview.topKinds
                    .slice(0, 3)
                    .map((k) => `${k.kind}(${k.count})`)
                    .join(', ')}
                </span>
              )}
            </div>
          )}
          {c.health && (
            <div className="text-xs text-cafe-secondary mt-1">
              <span>Last indexed: {c.health.indexFreshness || 'never'}</span>
              {c.health.pendingReviewCount > 0 && (
                <span className="ml-2 text-amber-600">{c.health.pendingReviewCount} pending review</span>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
