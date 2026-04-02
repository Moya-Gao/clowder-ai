/**
 * F102 Phase J: IndexStatus logic tests (AC-J4)
 *
 * Tests parsing of /api/evidence/status response.
 */

import { describe, expect, it } from 'vitest';
import { parseIndexStatus } from '@/components/memory/IndexStatus';

describe('parseIndexStatus', () => {
  it('parses healthy response', () => {
    const raw = {
      backend: 'sqlite',
      healthy: true,
      docs_count: 42,
      edges_count: 128,
      last_rebuild_at: '2026-03-31T10:00:00Z',
    };
    const status = parseIndexStatus(raw);
    expect(status.healthy).toBe(true);
    expect(status.docsCount).toBe(42);
    expect(status.edgesCount).toBe(128);
    expect(status.lastRebuildAt).toBe('2026-03-31T10:00:00Z');
    expect(status.backend).toBe('sqlite');
  });

  it('parses unhealthy response', () => {
    const raw = { backend: 'sqlite', healthy: false, reason: 'no_db' };
    const status = parseIndexStatus(raw);
    expect(status.healthy).toBe(false);
    expect(status.reason).toBe('no_db');
    expect(status.docsCount).toBe(0);
  });

  it('handles missing fields gracefully', () => {
    const raw = { backend: 'sqlite', healthy: true };
    const status = parseIndexStatus(raw);
    expect(status.docsCount).toBe(0);
    expect(status.edgesCount).toBe(0);
    expect(status.threadsCount).toBe(0);
    expect(status.passagesCount).toBe(0);
    expect(status.lastRebuildAt).toBeNull();
    expect(status.embeddingModel).toBeNull();
  });

  it('parses threads, passages, and embedding mode (Issue 6)', () => {
    const raw = {
      backend: 'sqlite',
      healthy: true,
      docs_count: 50,
      threads_count: 12,
      passages_count: 340,
      edges_count: 80,
      last_rebuild_at: '2026-04-01T12:00:00Z',
      embedding_model: 'text-embedding-3-small',
    };
    const status = parseIndexStatus(raw);
    expect(status.threadsCount).toBe(12);
    expect(status.passagesCount).toBe(340);
    expect(status.embeddingModel).toBe('text-embedding-3-small');
  });
});
