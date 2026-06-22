import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, describe, it } from 'node:test';

const { assembleIncrementalContext } = await import('../dist/domains/cats/services/agents/routing/route-helpers.js');
const { DeliveryCursorStore } = await import('../dist/domains/cats/services/stores/ports/DeliveryCursorStore.js');
const { MessageStore } = await import('../dist/domains/cats/services/stores/ports/MessageStore.js');
const { SessionChainStore } = await import('../dist/domains/cats/services/stores/ports/SessionChainStore.js');
const { TranscriptWriter } = await import('../dist/domains/cats/services/session/TranscriptWriter.js');

const tempDirs = [];

after(() => {
  for (const dir of tempDirs) {
    rmSync(dir, { recursive: true, force: true });
  }
});

function createThreadStore(threadMemory = null) {
  return {
    get: async () => ({ id: 'thread-1', title: 'Artifacts Thread', userId: 'user-1', createdAt: Date.now() }),
    create: async () => ({}),
    list: async () => [],
    listByProject: async () => [],
    addParticipants: async () => {},
    getParticipants: async () => [],
    getParticipantsWithActivity: async () => [],
    updateParticipantActivity: async () => {},
    updateLastActive: async () => {},
    getThreadMemory: async () => threadMemory,
    updateThreadMemory: async () => {},
  };
}

function createDeps(overrides = {}) {
  return {
    services: {},
    invocationDeps: {
      threadStore: overrides.threadStore ?? null,
      ...(overrides.sessionChainStore ? { sessionChainStore: overrides.sessionChainStore } : {}),
      ...(overrides.transcriptWriter ? { transcriptWriter: overrides.transcriptWriter } : {}),
    },
    messageStore: overrides.messageStore ?? new MessageStore(),
    deliveryCursorStore: overrides.deliveryCursorStore ?? new DeliveryCursorStore(),
  };
}

function appendToolUse(transcriptWriter, session, toolName, path) {
  transcriptWriter.appendEvent(
    {
      sessionId: session.id,
      threadId: session.threadId,
      catId: session.catId,
      cliSessionId: session.cliSessionId,
      seq: session.seq,
    },
    {
      type: 'tool_use',
      toolName,
      toolInput: { path },
    },
  );
}

describe('F232 live recent artifacts in incremental context', () => {
  it('falls back to the active session transcript buffer when recentFilesTouched is omitted', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'f232-live-artifacts-'));
    tempDirs.push(dataDir);
    const transcriptWriter = new TranscriptWriter({ dataDir });
    const sessionChainStore = new SessionChainStore();
    const session = sessionChainStore.create({
      cliSessionId: 'cli-session-1',
      threadId: 'thread-1',
      catId: 'opus',
      userId: 'user-1',
    });

    appendToolUse(
      transcriptWriter,
      session,
      'Edit',
      'packages/api/src/domains/cats/services/agents/routing/route-helpers.ts',
    );
    appendToolUse(transcriptWriter, session, 'Read', 'README.md');

    const result = await assembleIncrementalContext(
      createDeps({
        transcriptWriter,
        sessionChainStore,
        threadStore: createThreadStore(),
      }),
      'user-1',
      'thread-1',
      'opus',
    );

    assert.ok(result.navigationHeader?.includes('route-helpers.ts'), 'live edited file should appear in navigation');
    assert.ok(result.contextText.includes('route-helpers.ts'), 'context text should include the live artifact');
    assert.ok(!result.navigationHeader?.includes('README.md'), 'read-only files must stay excluded');
  });

  it('prefers explicit recentFilesTouched over live transcript fallback', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'f232-live-artifacts-override-'));
    tempDirs.push(dataDir);
    const transcriptWriter = new TranscriptWriter({ dataDir });
    const sessionChainStore = new SessionChainStore();
    const session = sessionChainStore.create({
      cliSessionId: 'cli-session-2',
      threadId: 'thread-1',
      catId: 'opus',
      userId: 'user-1',
    });

    appendToolUse(transcriptWriter, session, 'Edit', 'src/live-buffer.ts');

    const result = await assembleIncrementalContext(
      createDeps({
        transcriptWriter,
        sessionChainStore,
        threadStore: createThreadStore(),
      }),
      'user-1',
      'thread-1',
      'opus',
      undefined,
      undefined,
      {
        recentFilesTouched: [{ path: 'src/explicit-override.ts', ops: ['edit'] }],
      },
    );

    assert.ok(result.navigationHeader?.includes('explicit-override.ts'));
    assert.ok(!result.navigationHeader?.includes('live-buffer.ts'));
  });

  it('does not leak another user active session files on a shared thread', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'f232-live-artifacts-scope-'));
    tempDirs.push(dataDir);
    const transcriptWriter = new TranscriptWriter({ dataDir });
    const sessionChainStore = new SessionChainStore();
    const session = sessionChainStore.create({
      cliSessionId: 'cli-session-3',
      threadId: 'thread-1',
      catId: 'opus',
      userId: 'bob',
    });

    appendToolUse(transcriptWriter, session, 'Edit', 'src/bob-only.ts');

    const result = await assembleIncrementalContext(
      createDeps({
        transcriptWriter,
        sessionChainStore,
        threadStore: createThreadStore(),
      }),
      'alice',
      'thread-1',
      'opus',
    );

    assert.ok(!result.navigationHeader?.includes('bob-only.ts'));
    assert.ok(!result.contextText.includes('bob-only.ts'));
  });

  it('preserves unknown-tool file paths in the live transcript buffer', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'f232-live-artifacts-unknown-op-'));
    tempDirs.push(dataDir);
    const transcriptWriter = new TranscriptWriter({ dataDir });
    const sessionChainStore = new SessionChainStore();
    const session = sessionChainStore.create({
      cliSessionId: 'cli-session-4',
      threadId: 'thread-1',
      catId: 'opus',
      userId: 'user-1',
    });

    appendToolUse(transcriptWriter, session, 'CustomEditTool', 'src/custom-op.ts');

    assert.deepEqual(transcriptWriter.getFilesTouched(session.id), [{ path: 'src/custom-op.ts', ops: [] }]);
  });

  it('falls back to the caller-owned active session when another user owns the global active index', async () => {
    const dataDir = mkdtempSync(join(tmpdir(), 'f232-live-artifacts-active-fallback-'));
    tempDirs.push(dataDir);
    const transcriptWriter = new TranscriptWriter({ dataDir });
    const sessionChainStore = new SessionChainStore();

    const aliceSession = sessionChainStore.create({
      cliSessionId: 'cli-session-alice',
      threadId: 'thread-1',
      catId: 'opus',
      userId: 'alice',
    });
    appendToolUse(transcriptWriter, aliceSession, 'Edit', 'src/alice-live.ts');

    const bobSession = sessionChainStore.create({
      cliSessionId: 'cli-session-bob',
      threadId: 'thread-1',
      catId: 'opus',
      userId: 'bob',
    });
    appendToolUse(transcriptWriter, bobSession, 'Edit', 'src/bob-live.ts');

    const result = await assembleIncrementalContext(
      createDeps({
        transcriptWriter,
        sessionChainStore,
        threadStore: createThreadStore(),
      }),
      'alice',
      'thread-1',
      'opus',
    );

    assert.ok(result.navigationHeader?.includes('alice-live.ts'));
    assert.ok(!result.navigationHeader?.includes('bob-live.ts'));
  });
});
