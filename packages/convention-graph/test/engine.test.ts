import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ConventionGraphEngine } from '../src/engine.ts';

test('consumers 顺藤摸瓜 + provenance 可追（AC-A0/A1 引擎原语）', () => {
  const g = new ConventionGraphEngine();
  // MCP tool 节点
  g.insertNode({
    id: 'tool:cat_cafe_post_message',
    domainId: 'mcp-tool',
    kind: 'mcp_tool',
    name: 'cat_cafe_post_message',
    scopeKey: 'cat-cafe|mcp-server|ts|server-toolsets.ts|mcp_tool|mcp-tool',
  });
  // 消费方节点
  g.insertNode({
    id: 'fn:collectCallbackContentRoutingExit',
    domainId: 'mcp-tool',
    kind: 'tool_consumer',
    name: 'collectCallbackContentRoutingExit',
    scopeKey: 'cat-cafe|api|ts|route-serial.ts|function|mcp-tool',
    filePath: 'packages/api/src/domains/cats/services/agents/routing/route-serial.ts',
    startLine: 237,
  });
  // 边：消费方 consumes tool（带 provenance）
  g.insertEdge({
    source: 'fn:collectCallbackContentRoutingExit',
    target: 'tool:cat_cafe_post_message',
    kind: 'consumes',
    domainId: 'mcp-tool',
    provenance: {
      extractor: 'mcp-tool-extractor',
      extractorVersion: '0.1.0',
      sourceFile: 'route-serial.ts',
      sourceLine: 237,
      confidence: 'static',
    },
  });

  const consumers = g.consumers('tool:cat_cafe_post_message');
  assert.equal(consumers.length, 1);
  assert.equal(consumers[0]!.node.id, 'fn:collectCallbackContentRoutingExit');
  assert.equal(consumers[0]!.node.name, 'collectCallbackContentRoutingExit');
  // provenance 可追（砚砚 OQ-8：错边比漏边危险 → 每条边能解释"从哪来"）
  assert.equal(consumers[0]!.edge.provenance.extractor, 'mcp-tool-extractor');
  assert.equal(consumers[0]!.edge.provenance.sourceFile, 'route-serial.ts');
  assert.equal(consumers[0]!.edge.provenance.sourceLine, 237);
  assert.equal(consumers[0]!.edge.provenance.confidence, 'static');
  g.close();
});

test('getNode：不存在返回 null，存在返回节点', () => {
  const g = new ConventionGraphEngine();
  assert.equal(g.getNode('nope'), null);
  g.insertNode({ id: 'a', domainId: 'd', kind: 'k', name: 'n', scopeKey: 's' });
  assert.equal(g.getNode('a')?.name, 'n');
  g.close();
});

test('重复插入同一 edge 不产生重复 consumer 边', () => {
  const g = new ConventionGraphEngine();
  g.insertNode({
    id: 'consumer:a',
    domainId: 'd',
    kind: 'consumer',
    name: 'consumer',
    scopeKey: 'repo|pkg|ts|a.ts|consumer|d|consumer',
  });
  g.insertNode({
    id: 'target:a',
    domainId: 'd',
    kind: 'target',
    name: 'target',
    scopeKey: 'repo|pkg|ts|a.ts|target|d|target',
  });
  const edge = {
    source: 'consumer:a',
    target: 'target:a',
    kind: 'consumes',
    domainId: 'd',
    provenance: {
      extractor: 'test-extractor',
      extractorVersion: '0.1.0',
      sourceFile: 'a.ts',
      sourceLine: 1,
      confidence: 'static' as const,
    },
  };

  g.insertEdge(edge);
  g.insertEdge(edge);

  assert.equal(g.consumers('target:a').length, 1);
  g.close();
});

test('重复插入同一 logical edge 会刷新 provenance 而不是保留旧 source span', () => {
  const g = new ConventionGraphEngine();
  g.insertNode({
    id: 'consumer:a',
    domainId: 'd',
    kind: 'consumer',
    name: 'consumer',
    scopeKey: 'repo|pkg|ts|a.ts|consumer|d|consumer',
  });
  g.insertNode({
    id: 'target:a',
    domainId: 'd',
    kind: 'target',
    name: 'target',
    scopeKey: 'repo|pkg|ts|a.ts|target|d|target',
  });

  g.insertEdge({
    source: 'consumer:a',
    target: 'target:a',
    kind: 'consumes',
    domainId: 'd',
    provenance: {
      extractor: 'test-extractor',
      extractorVersion: '0.1.0',
      sourceFile: 'a.ts',
      sourceLine: 1,
      confidence: 'static',
    },
  });
  g.insertEdge({
    source: 'consumer:a',
    target: 'target:a',
    kind: 'consumes',
    domainId: 'd',
    provenance: {
      extractor: 'test-extractor',
      extractorVersion: '0.1.0',
      sourceFile: 'b.ts',
      sourceLine: 9,
      confidence: 'heuristic',
    },
  });

  const consumers = g.consumers('target:a');
  assert.equal(consumers.length, 1);
  assert.equal(consumers[0]!.edge.provenance.sourceFile, 'b.ts');
  assert.equal(consumers[0]!.edge.provenance.sourceLine, 9);
  assert.equal(consumers[0]!.edge.provenance.confidence, 'heuristic');
  g.close();
});

test('刷新已有 node metadata 不会级联删除既有关联边', () => {
  const g = new ConventionGraphEngine();
  g.insertNode({
    id: 'consumer:a',
    domainId: 'd',
    kind: 'consumer',
    name: 'consumer',
    scopeKey: 'repo|pkg|ts|a.ts|consumer|d|consumer',
  });
  g.insertNode({
    id: 'target:a',
    domainId: 'd',
    kind: 'target',
    name: 'target',
    scopeKey: 'repo|pkg|ts|a.ts|target|d|target',
    metadata: { version: 1 },
  });
  g.insertEdge({
    source: 'consumer:a',
    target: 'target:a',
    kind: 'consumes',
    domainId: 'd',
    provenance: {
      extractor: 'test-extractor',
      extractorVersion: '0.1.0',
      sourceFile: 'a.ts',
      sourceLine: 1,
      confidence: 'static',
    },
  });

  g.insertNode({
    id: 'target:a',
    domainId: 'd',
    kind: 'target',
    name: 'target-renamed',
    scopeKey: 'repo|pkg|ts|a.ts|target|d|target',
    metadata: { version: 2 },
  });

  assert.equal(g.getNode('target:a')?.name, 'target-renamed');
  assert.equal(g.getNode('target:a')?.metadata?.version, 2);
  assert.equal(g.consumers('target:a').length, 1);
  g.close();
});
