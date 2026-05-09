import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

describe('GraphQueryResolver', () => {
  async function loadResolver() {
    const { GraphQueryResolver } = await import('../../dist/domains/memory/GraphQueryResolver.js');
    return GraphQueryResolver;
  }

  function item(anchor, overrides = {}) {
    return {
      anchor,
      kind: 'feature',
      status: 'active',
      title: anchor,
      updatedAt: '2026-05-09',
      ...overrides,
    };
  }

  function catalog(manifests) {
    return {
      list: () => manifests,
      get: (id) => manifests.find((m) => m.id === id),
    };
  }

  function createStore(items, options = {}) {
    const byAnchor = new Map(items.map((evidence) => [evidence.anchor.toLowerCase(), evidence]));
    const relatedByAnchor = new Map(
      Object.entries(options.related ?? {}).map(([anchor, related]) => [anchor.toLowerCase(), related]),
    );
    const searchResults = options.searchResults ?? items;
    return {
      searchCalls: [],
      async getByAnchor(anchor) {
        return byAnchor.get(anchor.toLowerCase()) ?? null;
      },
      async search(query, searchOptions = {}) {
        this.searchCalls.push({ query, searchOptions });
        if (options.passthroughSearch) return searchResults.slice(0, searchOptions.limit ?? searchResults.length);
        const lower = query.toLowerCase();
        const matches = searchResults.filter((evidence) => {
          const fields = [
            evidence.anchor,
            evidence.title,
            evidence.sourcePath,
            evidence.summary,
            ...(evidence.keywords ?? []),
          ];
          return fields.some((field) => field?.toLowerCase().includes(lower));
        });
        return matches.slice(0, searchOptions.limit ?? matches.length);
      },
      async getRelated(anchor) {
        return relatedByAnchor.get(anchor.toLowerCase()) ?? [];
      },
    };
  }

  it('opens an exact anchor as a graph result', async () => {
    const GraphQueryResolver = await loadResolver();
    const store = createStore(
      [item('F186', { title: 'Library Memory Architecture' }), item('F102', { title: 'Memory Adapter' })],
      {
        related: {
          F186: [
            {
              anchor: 'F102',
              relation: 'related_to',
              fromCollectionId: 'project:cat-cafe',
              toCollectionId: 'project:cat-cafe',
              edgeSensitivity: 'internal',
              provenance: 'frontmatter',
            },
          ],
        },
      },
    );
    const resolver = new GraphQueryResolver(
      catalog([{ id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' }]),
      new Map([['project:cat-cafe', store]]),
    );

    const result = await resolver.resolve('F186', { depth: 1, callerCollections: ['project:cat-cafe'] });

    assert.equal(result.status, 'graph');
    assert.equal(result.queryKind, 'exact');
    assert.equal(result.resolvedAnchor, 'F186');
    assert.equal(result.graph.center, 'F186');
    assert.equal(result.graph.nodes.length, 2);
    assert.equal(result.graph.edges.length, 1);
  });

  it('canonicalizes exact anchors case-insensitively before rendering graph', async () => {
    const GraphQueryResolver = await loadResolver();
    const store = createStore([item('F186', { title: 'Library Memory Architecture' })]);
    const resolver = new GraphQueryResolver(
      catalog([{ id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' }]),
      new Map([['project:cat-cafe', store]]),
    );

    const result = await resolver.resolve('f186', { callerCollections: ['project:cat-cafe'] });

    assert.equal(result.status, 'graph');
    assert.equal(result.resolvedAnchor, 'F186');
    assert.equal(result.graph.center, 'F186');
    assert.ok(result.graph.nodes.some((node) => node.anchor === 'F186'));
    assert.ok(!result.graph.nodes.some((node) => node.anchor === 'f186'));
  });

  it('resolves exact queries using visible matches only', async () => {
    const GraphQueryResolver = await loadResolver();
    const publicStore = createStore([item('F186', { title: 'Visible Library Architecture' })]);
    const privateStore = createStore([item('F186', { title: 'Hidden Library Architecture' })]);
    const resolver = new GraphQueryResolver(
      catalog([
        { id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' },
        { id: 'private:lab', sensitivity: 'private', kind: 'domain' },
      ]),
      new Map([
        ['project:cat-cafe', publicStore],
        ['private:lab', privateStore],
      ]),
    );

    const result = await resolver.resolve('F186', { callerCollections: ['project:cat-cafe'] });

    assert.equal(result.status, 'graph');
    assert.equal(result.graph.nodes[0].collectionId, 'project:cat-cafe');
    assert.equal(result.graph.nodes[0].title, 'Visible Library Architecture');
    assert.ok(!JSON.stringify(result).includes('Hidden Library Architecture'));
  });

  it('returns capped explainable candidates for natural queries', async () => {
    const GraphQueryResolver = await loadResolver();
    const evidence = Array.from({ length: 10 }, (_, index) =>
      item(`F2${index.toString().padStart(2, '0')}`, {
        title: `Harness design ${index}`,
        kind: 'discussion',
        sourcePath: `docs/discussions/harness-${index}.md`,
        summary: `Discussion about harness candidate ${index}`,
      }),
    );
    const store = createStore(evidence, {
      related: {
        F200: [
          {
            anchor: 'F186',
            relation: 'related_to',
            fromCollectionId: 'project:cat-cafe',
            toCollectionId: 'project:cat-cafe',
            edgeSensitivity: 'internal',
            provenance: 'content',
          },
        ],
      },
    });
    const resolver = new GraphQueryResolver(
      catalog([{ id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' }]),
      new Map([['project:cat-cafe', store]]),
    );

    const result = await resolver.resolve('harness', { callerCollections: ['project:cat-cafe'] });

    assert.equal(result.status, 'candidates');
    assert.equal(result.queryKind, 'search');
    assert.equal(result.candidates.length, 8);
    assert.deepEqual(result.candidates[0], {
      anchor: 'F200',
      title: 'Harness design 0',
      kind: 'discussion',
      collectionId: 'project:cat-cafe',
      source: 'docs/discussions/harness-0.md',
      matchReason: 'title',
      snippet: 'Harness design 0',
      edgeCount: 1,
    });
  });

  it('counts only visible edges in candidate metadata', async () => {
    const GraphQueryResolver = await loadResolver();
    const store = createStore(
      [
        item('F200', {
          title: 'Harness design',
          kind: 'discussion',
          summary: 'Discussion about harness candidate',
        }),
      ],
      {
        related: {
          F200: [
            {
              anchor: 'F186',
              relation: 'related_to',
              fromCollectionId: 'project:cat-cafe',
              toCollectionId: 'project:cat-cafe',
              edgeSensitivity: 'internal',
              provenance: 'content',
            },
            {
              anchor: 'secret:harness',
              relation: 'related_to',
              fromCollectionId: 'project:cat-cafe',
              toCollectionId: 'private:landy',
              edgeSensitivity: 'private',
              provenance: 'content',
            },
          ],
        },
      },
    );
    const resolver = new GraphQueryResolver(
      catalog([
        { id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' },
        { id: 'private:landy', sensitivity: 'private', kind: 'domain' },
      ]),
      new Map([['project:cat-cafe', store]]),
    );

    const result = await resolver.resolve('harness', { callerCollections: ['project:cat-cafe'] });

    assert.equal(result.status, 'candidates');
    assert.equal(result.candidates[0].edgeCount, 1);
  });

  it('returns a no-match state with examples when search finds nothing', async () => {
    const GraphQueryResolver = await loadResolver();
    const store = createStore([]);
    const resolver = new GraphQueryResolver(
      catalog([{ id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' }]),
      new Map([['project:cat-cafe', store]]),
    );

    const result = await resolver.resolve('landy favorite salary cat', {
      callerCollections: ['project:cat-cafe'],
    });

    assert.equal(result.status, 'no_match');
    assert.equal(result.queryKind, 'search');
    assert.match(result.message, /No knowledge nodes matched/);
    assert.ok(result.examples.includes('F186'));
  });

  it('returns no-match when search returns low-relevance results without an explainable field match', async () => {
    const GraphQueryResolver = await loadResolver();
    const store = createStore(
      [
        item('F061', {
          title: 'Prompt bridge design',
          sourcePath: 'docs/features/F061-prompt-bridge.md',
          summary: 'Architecture notes for prompt routing and workspace context.',
        }),
      ],
      { passthroughSearch: true },
    );
    const resolver = new GraphQueryResolver(
      catalog([{ id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' }]),
      new Map([['project:cat-cafe', store]]),
    );

    const result = await resolver.resolve('zzzz-no-such-anchor-987654321', {
      callerCollections: ['project:cat-cafe'],
    });

    assert.equal(result.status, 'no_match');
  });

  it('distinguishes an exact node with no edges from a missing query', async () => {
    const GraphQueryResolver = await loadResolver();
    const store = createStore([item('F999', { title: 'Lonely Feature' })]);
    const resolver = new GraphQueryResolver(
      catalog([{ id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' }]),
      new Map([['project:cat-cafe', store]]),
    );

    const result = await resolver.resolve('F999', { callerCollections: ['project:cat-cafe'] });

    assert.equal(result.status, 'graph');
    assert.equal(result.note, 'no_edges');
    assert.equal(result.graph.nodes.length, 1);
    assert.equal(result.graph.edges.length, 0);
  });

  it('omits private candidates unless caller has collection visibility', async () => {
    const GraphQueryResolver = await loadResolver();
    const publicStore = createStore([item('F200', { title: 'Harness public note' })]);
    const privateStore = createStore([item('secret:harness', { title: 'Harness private payroll note' })]);
    const manifests = [
      { id: 'project:cat-cafe', sensitivity: 'internal', kind: 'project' },
      { id: 'private:landy', sensitivity: 'private', kind: 'domain' },
    ];
    const stores = new Map([
      ['project:cat-cafe', publicStore],
      ['private:landy', privateStore],
    ]);
    const resolver = new GraphQueryResolver(catalog(manifests), stores);

    const hidden = await resolver.resolve('harness', { callerCollections: ['project:cat-cafe'] });
    assert.equal(hidden.status, 'candidates');
    assert.deepEqual(
      hidden.candidates.map((candidate) => candidate.collectionId),
      ['project:cat-cafe'],
    );
    assert.ok(!JSON.stringify(hidden).includes('payroll'));

    const visible = await resolver.resolve('harness', {
      callerCollections: ['project:cat-cafe', 'private:landy'],
    });
    assert.equal(visible.status, 'candidates');
    assert.deepEqual(
      visible.candidates.map((candidate) => candidate.collectionId),
      ['project:cat-cafe', 'private:landy'],
    );
  });
});
