import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { SignalArticle, SignalSource } from '@cat-cafe/shared';
import {
  fetchSignalSources,
  fetchSignalsInbox,
  searchSignals,
  updateSignalSource,
} from '../signals-api';

const mocks = vi.hoisted(() => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/utils/api-client', () => ({
  apiFetch: (...args: unknown[]) => mocks.apiFetch(...args),
}));

const sampleArticle: SignalArticle = {
  id: 'signal_1',
  url: 'https://example.com/post',
  title: 'Sample Post',
  source: 'anthropic-news',
  tier: 1,
  publishedAt: '2026-02-19T08:00:00.000Z',
  fetchedAt: '2026-02-19T08:01:00.000Z',
  status: 'inbox',
  tags: [],
  filePath: '/tmp/signal_1.md',
};

const sampleSource: SignalSource = {
  id: 'anthropic-news',
  name: 'Anthropic Newsroom',
  url: 'https://www.anthropic.com/news',
  tier: 1,
  category: 'official',
  enabled: true,
  fetch: { method: 'webpage' },
  schedule: { frequency: 'daily' },
};

describe('signals-api', () => {
  beforeEach(() => {
    mocks.apiFetch.mockReset();
  });

  it('fetchSignalsInbox uses default limit and returns items', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ items: [sampleArticle] }),
    });

    const items = await fetchSignalsInbox();

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/signals/inbox?limit=20');
    expect(items).toEqual([sampleArticle]);
  });

  it('searchSignals encodes query and forwards optional filters', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ total: 1, items: [sampleArticle] }),
    });

    await searchSignals('claude 5', {
      limit: 10,
      status: 'read',
      source: 'anthropic-news',
      tier: 1,
      dateFrom: '2026-02-01',
      dateTo: '2026-02-28',
    });

    expect(mocks.apiFetch).toHaveBeenCalledWith(
      '/api/signals/search?q=claude+5&limit=10&status=read&source=anthropic-news&tier=1&dateFrom=2026-02-01&dateTo=2026-02-28',
    );
  });

  it('fetchSignalSources returns source list', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ sources: [sampleSource] }),
    });

    const sources = await fetchSignalSources();

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/signals/sources');
    expect(sources).toEqual([sampleSource]);
  });

  it('updateSignalSource sends PATCH request with enabled payload', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ source: { ...sampleSource, enabled: false } }),
    });

    const updated = await updateSignalSource('anthropic-news', false);

    expect(mocks.apiFetch).toHaveBeenCalledWith('/api/signals/sources/anthropic-news', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: false }),
    });
    expect(updated.enabled).toBe(false);
  });

  it('fetchSignalsInbox throws API message when request fails', async () => {
    mocks.apiFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () => Promise.resolve({ error: 'Invalid query' }),
    });

    await expect(fetchSignalsInbox()).rejects.toThrow('Invalid query');
  });
});
