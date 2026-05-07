export function filterSuggestions(
  raw: Record<string, unknown>,
  validThreadIds: Set<string>,
  validLabelIds: Set<string>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const [tid, lids] of Object.entries(raw)) {
    if (!validThreadIds.has(tid) || !Array.isArray(lids)) continue;
    const filtered = (lids as string[]).filter((id) => validLabelIds.has(id));
    if (filtered.length > 0) map.set(tid, filtered);
  }
  return map;
}

export interface BatchApplyResult {
  failedThreadIds: string[];
}

type UpdateFn = (threadId: string, labelIds: string[]) => Promise<void>;

export async function batchApplyLabels(
  assignments: Map<string, string[]>,
  updateFn: UpdateFn,
): Promise<BatchApplyResult> {
  const entries = Array.from(assignments.entries());
  if (entries.length === 0) return { failedThreadIds: [] };

  const results = await Promise.allSettled(
    entries.map(([threadId, labelIds]) => updateFn(threadId, labelIds).then(() => threadId)),
  );

  const failedThreadIds: string[] = [];
  for (let i = 0; i < results.length; i++) {
    if (results[i].status === 'rejected') {
      failedThreadIds.push(entries[i][0]);
    }
  }

  return { failedThreadIds };
}
