// F102: Memory service factory — creates the right implementations based on config

import type { IHindsightClient } from '../cats/services/orchestration/HindsightClient.js';
import { HindsightAdapter } from './HindsightAdapter.js';
import { IndexBuilder } from './IndexBuilder.js';
import type {
  IEvidenceStore,
  IIndexBuilder,
  IKnowledgeResolver,
  IMarkerQueue,
  IMaterializationService,
  IReflectionService,
} from './interfaces.js';
import { KnowledgeResolver } from './KnowledgeResolver.js';
import { MarkerQueue } from './MarkerQueue.js';
import { MaterializationService } from './MaterializationService.js';
import { createHindsightReflectBackend, ReflectionService } from './ReflectionService.js';
import { SqliteEvidenceStore } from './SqliteEvidenceStore.js';

export interface MemoryServices {
  evidenceStore: IEvidenceStore;
  markerQueue: IMarkerQueue;
  reflectionService: IReflectionService;
  knowledgeResolver: IKnowledgeResolver;
  indexBuilder?: IIndexBuilder;
  materializationService?: IMaterializationService;
}

export interface MemoryConfig {
  type: 'sqlite' | 'hindsight';
  /** For sqlite: path to evidence.sqlite file */
  sqlitePath?: string;
  /** For sqlite: root docs/ directory for IndexBuilder */
  docsRoot?: string;
  /** For sqlite: markers directory (docs/markers/) */
  markersDir?: string;
  /** For hindsight: the IHindsightClient instance */
  hindsightClient?: IHindsightClient;
  /** For hindsight: bank ID */
  hindsightBank?: string;
}

export async function createMemoryServices(config: MemoryConfig): Promise<MemoryServices> {
  if (config.type === 'sqlite') {
    return createSqliteServices(config);
  }
  return createHindsightServices(config);
}

async function createSqliteServices(config: MemoryConfig): Promise<MemoryServices> {
  const sqlitePath = config.sqlitePath ?? 'evidence.sqlite';
  const docsRoot = config.docsRoot ?? 'docs';
  const markersDir = config.markersDir ?? 'docs/markers';

  const store = new SqliteEvidenceStore(sqlitePath);
  await store.initialize();

  const indexBuilder = new IndexBuilder(store, docsRoot);
  const markerQueue = new MarkerQueue(markersDir);
  const materializationService = new MaterializationService(markerQueue, docsRoot);
  const reflectionService = new ReflectionService(async () => '');
  const knowledgeResolver = new KnowledgeResolver({ projectStore: store });

  return {
    evidenceStore: store,
    markerQueue,
    reflectionService,
    knowledgeResolver,
    indexBuilder,
    materializationService,
  };
}

async function createHindsightServices(config: MemoryConfig): Promise<MemoryServices> {
  const client = config.hindsightClient;
  const bankId = config.hindsightBank ?? 'cat-cafe-shared';
  if (!client) throw new Error('hindsightClient required for type=hindsight');

  const adapter = new HindsightAdapter(client, bankId);
  await adapter.initialize();

  const markersDir = config.markersDir ?? 'docs/markers';
  const markerQueue = new MarkerQueue(markersDir);
  const reflectionService = new ReflectionService(createHindsightReflectBackend(client, bankId));
  const knowledgeResolver = new KnowledgeResolver({ projectStore: adapter });

  return {
    evidenceStore: adapter,
    markerQueue,
    reflectionService,
    knowledgeResolver,
  };
}
