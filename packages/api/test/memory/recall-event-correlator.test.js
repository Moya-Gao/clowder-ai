import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

function makeEvent(overrides) {
  return {
    invocationId: 'inv-1',
    sessionId: 'sess-1',
    threadId: 'thread-1',
    catId: 'opus',
    toolName: 'search_evidence',
    timestamp: 1000,
    turnIndex: 0,
    status: 'success',
    summary: {},
    ...overrides,
  };
}

describe('RecallEventCorrelator', () => {
  let RecallEventCorrelator;
  let Database;
  let db;

  beforeEach(async () => {
    Database = (await import('better-sqlite3')).default;
    const schema = await import('../../dist/domains/memory/schema.js');
    const mod = await import(`../../dist/domains/memory/RecallEventCorrelator.js?v=${Date.now()}`);
    RecallEventCorrelator = mod.RecallEventCorrelator;

    db = new Database(':memory:');
    db.exec('PRAGMA journal_mode = WAL');
    db.exec(schema.SCHEMA_V1);
    db.prepare('INSERT INTO schema_version (version, applied_at) VALUES (?, ?)').run(1, new Date().toISOString());
    schema.applyMigrations(db);
  });

  it('AC-A1: correlates search_evidence → Read into consumed entry', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'F200',
          mode: 'hybrid',
          scope: 'docs',
          _f200Candidates: [
            { anchor: 'F200', rank: 1, sourcePath: 'docs/features/F200-memory-recall-eval.md', docKind: 'feature' },
            {
              anchor: 'F192',
              rank: 2,
              sourcePath: 'docs/features/F192-socio-technical-harness-eval.md',
              docKind: 'feature',
            },
          ],
        },
      }),
      makeEvent({
        toolName: 'Read',
        timestamp: 2000,
        turnIndex: 3,
        summary: { file_path: '/path/cat-cafe/docs/features/F200-memory-recall-eval.md' },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);

    assert.equal(results.length, 1);
    const re = results[0];
    assert.equal(re.toolName, 'search_evidence');
    assert.equal(re.query, 'F200');
    assert.equal(re.candidates.length, 2);
    assert.equal(re.candidates[0].anchor, 'F200');
    assert.equal(re.candidates[0].targetRef.kind, 'doc');
    assert.equal(re.consumed.length, 1);
    assert.equal(re.consumed[0].anchor, 'F200');
    assert.equal(re.consumed[0].method, 'Read');
    assert.equal(re.consumed[0].rank, 1);
    assert.equal(re.abandoned, false);
  });

  it('AC-A2: excluded when BOTH distance > 20 AND wall-clock > 300s', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'test',
          _f200Candidates: [{ anchor: 'A', rank: 1, sourcePath: 'docs/a.md', docKind: 'feature' }],
        },
      }),
    ];
    // Add 25 unrelated events spanning > 300s
    for (let i = 2; i <= 26; i++) {
      events.push(makeEvent({ toolName: 'SomeOtherTool', timestamp: 1000 + i * 15_000, turnIndex: i }));
    }
    // Read at distance 26 (> 20) AND timestamp > 300s
    events.push(
      makeEvent({
        toolName: 'Read',
        timestamp: 1000 + 400_000,
        turnIndex: 27,
        summary: { file_path: '/path/docs/a.md' },
      }),
    );

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].consumed.length, 0, 'not consumed: both bounds exceeded');
    assert.equal(results[0].abandoned, true);
  });

  it('AC-A2: included when distance > 20 but wall-clock <= 300s (OR logic)', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'test',
          _f200Candidates: [{ anchor: 'A', rank: 1, sourcePath: 'docs/a.md', docKind: 'feature' }],
        },
      }),
    ];
    // 25 rapid events (distance > 20 but all within 300s)
    for (let i = 2; i <= 26; i++) {
      events.push(makeEvent({ toolName: 'SomeOtherTool', timestamp: 1000 + i * 100, turnIndex: i }));
    }
    events.push(
      makeEvent({
        toolName: 'Read',
        timestamp: 4000,
        turnIndex: 27,
        summary: { file_path: '/path/docs/a.md' },
      }),
    );

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].consumed.length, 1, 'OR: distance>20 but wall_clock<300s → included');
  });

  it('AC-A2: included when wall-clock > 300s but distance <= 20 (OR logic)', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'test',
          _f200Candidates: [{ anchor: 'A', rank: 1, sourcePath: 'docs/a.md', docKind: 'feature' }],
        },
      }),
      makeEvent({
        toolName: 'Read',
        timestamp: 1000 + 400_000,
        turnIndex: 3,
        summary: { file_path: '/path/docs/a.md' },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].consumed.length, 1, 'OR: wall_clock>300s but distance<=20 → included');
  });

  it('AC-A2: respects invocation boundary', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        invocationId: 'inv-A',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'test',
          _f200Candidates: [{ anchor: 'A', rank: 1, sourcePath: 'docs/a.md', docKind: 'feature' }],
        },
      }),
      makeEvent({
        toolName: 'Read',
        invocationId: 'inv-B', // different invocation
        timestamp: 2000,
        turnIndex: 3,
        summary: { file_path: '/path/docs/a.md' },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].consumed.length, 0, 'not consumed: different invocation');
  });

  it('AC-A3: marks reformulated on consecutive search calls', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: { query: 'first query', _f200Candidates: [] },
      }),
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 2000,
        turnIndex: 3,
        summary: { query: 'second query', _f200Candidates: [] },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].reformulated, true, 'first search is reformulated');
  });

  it('AC-A3: marks fellBackToGrep', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: { query: 'test', _f200Candidates: [] },
      }),
      makeEvent({
        toolName: 'Bash',
        timestamp: 2000,
        turnIndex: 3,
        summary: { command: 'rg "pattern" docs/' },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].fellBackToGrep, true);
  });

  it('AC-A3: marks abandoned', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: { query: 'test', _f200Candidates: [] },
      }),
      makeEvent({ toolName: 'SomeOtherTool', timestamp: 2000, turnIndex: 3 }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].abandoned, true);
  });

  it('AC-A3: marks nextGraphResolveAfterRead', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'test',
          _f200Candidates: [{ anchor: 'A', rank: 1, sourcePath: 'docs/a.md', docKind: 'feature' }],
        },
      }),
      makeEvent({
        toolName: 'Read',
        timestamp: 2000,
        turnIndex: 3,
        summary: { file_path: '/path/docs/a.md' },
      }),
      makeEvent({
        toolName: 'graph_resolve',
        timestamp: 3000,
        turnIndex: 5,
        summary: { query: 'A' },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].nextGraphResolveAfterRead, true);
  });

  it('AC-A5: records dwellProxy', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'test',
          _f200Candidates: [{ anchor: 'A', rank: 1, sourcePath: 'docs/a.md', docKind: 'feature' }],
        },
      }),
      makeEvent({
        toolName: 'Read',
        timestamp: 5000,
        turnIndex: 3,
        summary: { file_path: '/path/docs/a.md' },
      }),
      makeEvent({
        toolName: 'Edit',
        timestamp: 8000,
        turnIndex: 5,
        summary: {},
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].consumed[0].dwellProxy, 3000, 'dwellProxy = next tool timestamp - Read timestamp');
  });

  it('persistBatch writes to recall_events table', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'persist test',
          _f200Candidates: [{ anchor: 'B', rank: 1, sourcePath: 'docs/b.md', docKind: 'feature' }],
        },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    correlator.persistBatch(results);

    const row = db.prepare('SELECT * FROM recall_events WHERE cat_id = ?').get('opus');
    assert.ok(row, 'row exists');
    assert.equal(row.tool_name, 'search_evidence');
    assert.equal(row.query, 'persist test');
    assert.equal(row.abandoned, 1);

    const candidates = JSON.parse(row.candidates_json);
    assert.equal(candidates.length, 1);
    assert.equal(candidates[0].anchor, 'B');
  });

  it('multiple consumed entries from different candidates', () => {
    const events = [
      makeEvent({
        toolName: 'search_evidence',
        timestamp: 1000,
        turnIndex: 1,
        summary: {
          query: 'multi',
          _f200Candidates: [
            { anchor: 'X', rank: 1, sourcePath: 'docs/x.md', docKind: 'feature' },
            { anchor: 'Y', rank: 2, sourcePath: 'docs/y.md', docKind: 'decision' },
          ],
        },
      }),
      makeEvent({
        toolName: 'Read',
        timestamp: 2000,
        turnIndex: 3,
        summary: { file_path: '/path/docs/x.md' },
      }),
      makeEvent({
        toolName: 'Read',
        timestamp: 3000,
        turnIndex: 5,
        summary: { file_path: '/path/docs/y.md' },
      }),
    ];

    const correlator = new RecallEventCorrelator(db);
    const results = correlator.correlateWindow(events);
    assert.equal(results[0].consumed.length, 2);
    assert.equal(results[0].consumed[0].anchor, 'X');
    assert.equal(results[0].consumed[1].anchor, 'Y');
  });
});
