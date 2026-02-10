export function parseEnum<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  if (raw == null || raw.trim() === '') return fallback;
  const normalized = raw.trim().toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function parseIntInRange(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const truncated = Math.trunc(parsed);
  if (truncated < min || truncated > max) return fallback;
  return truncated;
}
