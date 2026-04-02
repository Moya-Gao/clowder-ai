// F102 Batch 3 — parseTextResults: anchor + snippet extraction
import { describe, expect, it } from 'vitest';
import { parseTextResults } from '../useRecallEvents';

const SAMPLE_OUTPUT = `Found 2 result(s):

[high] F102 Memory Adapter Refactor
  anchor: doc:features/F102-memory-adapter-refactor
  type: feature
  > F102: 记忆组件 Adapter 化重构 — IEvidenceStore + 本地索引

[mid] LL-045: Runtime worktree 污染
  anchor: LL-045
  type: lesson
  > 2026-03-29 runtime worktree 被多个布偶猫 session 反复弄脏
`;

describe('parseTextResults', () => {
  it('extracts title, confidence, sourceType, anchor, snippet from standard output', () => {
    const results = parseTextResults(SAMPLE_OUTPUT);
    expect(results).toHaveLength(2);

    expect(results[0]).toMatchObject({
      title: 'F102 Memory Adapter Refactor',
      confidence: 'high',
      sourceType: 'feature',
      anchor: 'doc:features/F102-memory-adapter-refactor',
      snippet: 'F102: 记忆组件 Adapter 化重构 — IEvidenceStore + 本地索引',
    });

    expect(results[1]).toMatchObject({
      title: 'LL-045: Runtime worktree 污染',
      confidence: 'mid',
      sourceType: 'lesson',
      anchor: 'LL-045',
      snippet: '2026-03-29 runtime worktree 被多个布偶猫 session 反复弄脏',
    });
  });

  it('handles results with no anchor/snippet lines gracefully', () => {
    const text = `Found 1 result(s):

[low] Some Title
  type: discussion
`;
    const results = parseTextResults(text);
    expect(results).toHaveLength(1);
    expect(results[0]!.title).toBe('Some Title');
    expect(results[0]!.anchor).toBeUndefined();
    expect(results[0]!.snippet).toBeUndefined();
  });

  it('returns empty array for empty input', () => {
    expect(parseTextResults('')).toEqual([]);
  });

  it('skips [DEGRADED] banner — not a real result', () => {
    const text = `[DEGRADED] Evidence store error — results may be incomplete

Found 2 result(s):

[high] F102 Memory Adapter
  anchor: doc:features/F102
  type: feature
  > description

[mid] Some Lesson
  anchor: LL-001
  type: lesson
`;
    const results = parseTextResults(text);
    expect(results).toHaveLength(2);
    expect(results[0]!.confidence).toBe('high');
    expect(results[1]!.confidence).toBe('mid');
    // DEGRADED banner must not appear as a result
    expect(results.every((r) => r.confidence !== 'DEGRADED')).toBe(true);
  });
});
