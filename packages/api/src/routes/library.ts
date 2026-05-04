import type { FastifyPluginAsync } from 'fastify';
import { CollectionReadModel } from '../domains/memory/CollectionReadModel.js';
import type { IEvidenceStore } from '../domains/memory/interfaces.js';
import type { LibraryCatalog } from '../domains/memory/LibraryCatalog.js';

export interface LibraryRoutesOptions {
  catalog: LibraryCatalog;
  stores: Map<string, IEvidenceStore>;
}

type StoreWithDb = IEvidenceStore & { getDb?: () => import('better-sqlite3').Database };

export const libraryRoutes: FastifyPluginAsync<LibraryRoutesOptions> = async (app, opts) => {
  app.get('/api/library/catalog', async () => {
    const collections = opts.catalog.getRoutable('library');
    const items = collections.map((manifest) => {
      const store = opts.stores.get(manifest.id) as StoreWithDb | undefined;
      const db = store?.getDb?.();
      return {
        manifest,
        overview: db
          ? CollectionReadModel.computeOverview(manifest.id, manifest.displayName, manifest.sensitivity, db)
          : null,
        health: db ? CollectionReadModel.computeHealth(manifest.id, db) : null,
      };
    });
    return { collections: items };
  });

  app.get<{ Params: { collectionId: string } }>('/api/library/:collectionId', async (request, reply) => {
    const { collectionId } = request.params;
    const manifest = opts.catalog.get(collectionId);
    if (!manifest || manifest.sensitivity === 'private' || manifest.sensitivity === 'restricted') {
      reply.status(404);
      return { error: `Collection "${collectionId}" not found` };
    }
    const store = opts.stores.get(manifest.id) as StoreWithDb | undefined;
    const db = store?.getDb?.();
    return {
      manifest,
      overview: db
        ? CollectionReadModel.computeOverview(manifest.id, manifest.displayName, manifest.sensitivity, db)
        : null,
      health: db ? CollectionReadModel.computeHealth(manifest.id, db) : null,
    };
  });
};
