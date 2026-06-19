import type { Consumer, ConventionGraphEngine, ConventionNode, Freshness, NodeQuery, SourceContent } from './engine.ts';

export interface CodeConsumersResult {
  targets: ConventionNode[];
  consumers: Consumer[];
  freshness: Freshness;
}

export interface CodeConsumersOptions {
  currentFiles?: readonly SourceContent[];
  /**
   * domain membership predicate（生产路径由调用方用相关 plugin.invalidationScope 组合）。
   * 透传给 freshness 做 domain-scoped untracked 判定——相关 domain 新文件被检测、别 domain 不误报。
   * 缺失时 freshness fail closed：无法证明 out-of-scope 的 unknown current paths 会标 stale。
   */
  inScope?: (path: string) => boolean;
}

/**
 * code_consumers 查询原语：按 domain/kind/name 找目标节点，再返回所有 incoming
 * convention edges。先做库内 API，后续再包装成 MCP/CLI 工具。
 */
export function codeConsumers(
  graph: ConventionGraphEngine,
  query: NodeQuery,
  options: CodeConsumersOptions = {},
): CodeConsumersResult {
  const targets = graph.findNodes(query);
  const consumers = targets.flatMap((target) => graph.consumers(target.id));
  const freshnessDomains = [
    ...new Set([
      ...(query.domainId ? [query.domainId] : []),
      ...targets.map((target) => target.domainId),
      ...consumers.flatMap((consumer) => [consumer.node.domainId, consumer.edge.domainId]),
    ]),
  ];
  return {
    targets,
    consumers,
    freshness: graph.freshness(options.currentFiles, freshnessDomains, options.inScope),
  };
}
