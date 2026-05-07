import { describe, expect, it, vi } from 'vitest';
import { batchApplyLabels, filterSuggestions } from '../batch-apply-labels';

describe('batchApplyLabels', () => {
  it('applies all assignments and returns no failures on success', async () => {
    const updateFn = vi.fn().mockResolvedValue(undefined);
    const assignments = new Map([
      ['t1', ['label-a']],
      ['t2', ['label-b', 'label-c']],
    ]);

    const result = await batchApplyLabels(assignments, updateFn);

    expect(result.failedThreadIds).toEqual([]);
    expect(updateFn).toHaveBeenCalledTimes(2);
    expect(updateFn).toHaveBeenCalledWith('t1', ['label-a']);
    expect(updateFn).toHaveBeenCalledWith('t2', ['label-b', 'label-c']);
  });

  it('returns failed thread IDs when some updates reject', async () => {
    const updateFn = vi.fn().mockImplementation((threadId: string) => {
      if (threadId === 't2') return Promise.reject(new Error('network error'));
      return Promise.resolve(undefined);
    });
    const assignments = new Map([
      ['t1', ['label-a']],
      ['t2', ['label-b']],
      ['t3', ['label-c']],
    ]);

    const result = await batchApplyLabels(assignments, updateFn);

    expect(result.failedThreadIds).toEqual(['t2']);
  });

  it('does not throw when all updates fail', async () => {
    const updateFn = vi.fn().mockRejectedValue(new Error('server down'));
    const assignments = new Map([
      ['t1', ['label-a']],
      ['t2', ['label-b']],
    ]);

    const result = await batchApplyLabels(assignments, updateFn);

    expect(result.failedThreadIds).toEqual(['t1', 't2']);
  });

  it('returns empty failures for empty assignments', async () => {
    const updateFn = vi.fn();
    const result = await batchApplyLabels(new Map(), updateFn);

    expect(result.failedThreadIds).toEqual([]);
    expect(updateFn).not.toHaveBeenCalled();
  });
});

describe('filterSuggestions', () => {
  const validThreads = new Set(['t-visible-1', 't-visible-2']);
  const validLabels = new Set(['lb-a', 'lb-b', 'lb-c']);

  it('keeps only visible threads with valid labels', () => {
    const raw = {
      't-visible-1': ['lb-a', 'lb-b'],
      't-visible-2': ['lb-c'],
      't-hidden': ['lb-a'],
    };
    const result = filterSuggestions(raw, validThreads, validLabels);

    expect(result.size).toBe(2);
    expect(result.get('t-visible-1')).toEqual(['lb-a', 'lb-b']);
    expect(result.get('t-visible-2')).toEqual(['lb-c']);
    expect(result.has('t-hidden')).toBe(false);
  });

  it('strips invalid labelIds from visible threads', () => {
    const raw = {
      't-visible-1': ['lb-a', 'lb-INVALID', 'lb-b'],
    };
    const result = filterSuggestions(raw, validThreads, validLabels);

    expect(result.get('t-visible-1')).toEqual(['lb-a', 'lb-b']);
  });

  it('drops thread entirely if all labels are invalid', () => {
    const raw = {
      't-visible-1': ['lb-FAKE'],
      't-visible-2': ['lb-a'],
    };
    const result = filterSuggestions(raw, validThreads, validLabels);

    expect(result.size).toBe(1);
    expect(result.has('t-visible-1')).toBe(false);
    expect(result.get('t-visible-2')).toEqual(['lb-a']);
  });

  it('handles non-array values gracefully', () => {
    const raw = {
      't-visible-1': 'not-an-array',
      't-visible-2': ['lb-a'],
    };
    const result = filterSuggestions(raw, validThreads, validLabels);

    expect(result.size).toBe(1);
    expect(result.has('t-visible-1')).toBe(false);
  });
});
