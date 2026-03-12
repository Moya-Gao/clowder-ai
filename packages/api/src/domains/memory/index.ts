// F102: Memory domain barrel export

export type { MemoryConfig, MemoryServices } from './factory.js';
// Factory
export { createMemoryServices } from './factory.js';
export { HindsightAdapter } from './HindsightAdapter.js';
export { IndexBuilder } from './IndexBuilder.js';
// Interfaces + types
export type {
  ConsistencyReport,
  Edge,
  EvidenceItem,
  EvidenceKind,
  EvidenceStatus,
  IEvidenceStore,
  IIndexBuilder,
  IKnowledgeResolver,
  IMarkerQueue,
  IMaterializationService,
  IReflectionService,
  KnowledgeResult,
  Marker,
  MarkerFilter,
  MarkerStatus,
  MaterializeResult,
  RebuildResult,
  ReflectionContext,
  SearchOptions,
} from './interfaces.js';
export {
  EVIDENCE_KINDS,
  IEvidenceStoreSymbol,
  IIndexBuilderSymbol,
  IKnowledgeResolverSymbol,
  IMarkerQueueSymbol,
  IMaterializationServiceSymbol,
  IReflectionServiceSymbol,
  MARKER_STATUSES,
} from './interfaces.js';
export { KnowledgeResolver } from './KnowledgeResolver.js';
export { MarkerQueue } from './MarkerQueue.js';
export { MaterializationService } from './MaterializationService.js';
export { createHindsightReflectBackend, ReflectionService } from './ReflectionService.js';
// Implementations
export { SqliteEvidenceStore } from './SqliteEvidenceStore.js';
