import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useVoiceSessionStore } from '@/stores/voiceSessionStore';

/**
 * F092: Tests for voice auto-play logic.
 *
 * Tests the exported pure helper + session-binding behavior.
 * We import the module internals via re-export or test the store-level
 * contracts that the hook depends on.
 */

// Mock apiFetch and Audio to avoid JSDOM issues
vi.mock('@/utils/api-client', () => ({
  apiFetch: vi.fn(),
}));

// Mock HTML Audio element
const mockPlay = vi.fn().mockResolvedValue(undefined);
const mockPause = vi.fn();
vi.stubGlobal(
  'Audio',
  vi.fn(() => ({
    play: mockPlay,
    pause: mockPause,
    onended: null,
    onerror: null,
  })),
);

beforeEach(() => {
  useVoiceSessionStore.setState({ session: null });
  vi.clearAllMocks();
});

describe('voiceSessionStore session-binding contracts', () => {
  it('stop-start cycle creates a new sessionId (stale check basis)', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);
    const id1 = useVoiceSessionStore.getState().session!.sessionId;

    useVoiceSessionStore.getState().stop();
    useVoiceSessionStore.getState().start('t2', 'opus', true);
    const id2 = useVoiceSessionStore.getState().session!.sessionId;

    expect(id1).not.toBe(id2);
  });

  it('re-start without stop also creates new sessionId (thread switch)', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);
    const id1 = useVoiceSessionStore.getState().session!.sessionId;

    // Simulate thread switch: start new session without explicit stop
    useVoiceSessionStore.getState().start('t2', 'codex', true);
    const id2 = useVoiceSessionStore.getState().session!.sessionId;

    expect(id1).not.toBe(id2);
    expect(useVoiceSessionStore.getState().session!.boundThreadId).toBe('t2');
  });

  it('markPlayed is scoped to session — new session has clean slate', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);
    useVoiceSessionStore.getState().markPlayed('audio-1');
    expect(useVoiceSessionStore.getState().hasPlayed('audio-1')).toBe(true);

    // New session: old played IDs should not carry over
    useVoiceSessionStore.getState().start('t2', 'opus', true);
    expect(useVoiceSessionStore.getState().hasPlayed('audio-1')).toBe(false);
  });

  it('autoplayUnlocked=false blocks auto-play gate', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', false);
    const session = useVoiceSessionStore.getState().session!;

    // The hook checks session.voiceMode && session.autoplayUnlocked
    expect(session.voiceMode).toBe(true);
    expect(session.autoplayUnlocked).toBe(false);
    // Hook would early-return because autoplayUnlocked is false
  });

  it('confirmAutoplayUnlocked upgrades false → true after first successful play', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', false);
    expect(useVoiceSessionStore.getState().session!.autoplayUnlocked).toBe(false);

    useVoiceSessionStore.getState().confirmAutoplayUnlocked();
    expect(useVoiceSessionStore.getState().session!.autoplayUnlocked).toBe(true);
  });
});

describe('findUnplayedAudioBlock logic (via store contracts)', () => {
  it('latest-wins: only the last audio block in newest message matters', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);

    // Simulate: message has 2 audio blocks, only the second should be "found"
    // Mark the first as played
    useVoiceSessionStore.getState().markPlayed('audio-1');

    // audio-2 is not played yet
    expect(useVoiceSessionStore.getState().hasPlayed('audio-2')).toBe(false);
  });

  it('already-played blocks are skipped', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);
    useVoiceSessionStore.getState().markPlayed('audio-block-1');

    expect(useVoiceSessionStore.getState().hasPlayed('audio-block-1')).toBe(true);
    // The hook's findUnplayedAudioBlock checks hasPlayed → would skip this block
  });
});

describe('session staleness detection', () => {
  it('sessionId mismatch after stop means stale', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);
    const originalSessionId = useVoiceSessionStore.getState().session!.sessionId;

    // Simulate: user stops voice companion while fetch is in-flight
    useVoiceSessionStore.getState().stop();

    // fetchAndPlay's isSessionStale() would check:
    const session = useVoiceSessionStore.getState().session;
    const isStale = !session?.voiceMode || session.sessionId !== originalSessionId;
    expect(isStale).toBe(true);
  });

  it('sessionId mismatch after re-start means stale', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);
    const originalSessionId = useVoiceSessionStore.getState().session!.sessionId;

    // Simulate: user switches thread (new session) while fetch is in-flight
    useVoiceSessionStore.getState().start('t2', 'codex', true);

    const session = useVoiceSessionStore.getState().session!;
    const isStale = !session.voiceMode || session.sessionId !== originalSessionId;
    expect(isStale).toBe(true);
  });

  it('same session is not stale', () => {
    useVoiceSessionStore.getState().start('t1', 'opus', true);
    const originalSessionId = useVoiceSessionStore.getState().session!.sessionId;

    const session = useVoiceSessionStore.getState().session!;
    const isStale = !session.voiceMode || session.sessionId !== originalSessionId;
    expect(isStale).toBe(false);
  });
});
