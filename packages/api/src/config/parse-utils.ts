export function parseEnum<T extends string>(raw: string | undefined, allowed: readonly T[], fallback: T): T {
  if (raw == null || raw.trim() === '') return fallback;
  const normalized = raw.trim().toLowerCase() as T;
  return allowed.includes(normalized) ? normalized : fallback;
}

export function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null) return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}

export function parseIntInRange(raw: string | undefined, fallback: number, min: number, max: number): number {
  if (raw == null || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const truncated = Math.trunc(parsed);
  if (truncated < min || truncated > max) return fallback;
  return truncated;
}

export function parseCsvEnumList<T extends string>(
  raw: string | undefined,
  allowed: readonly T[],
  fallback: readonly T[],
): T[] {
  const parsed = (raw ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase() as T)
    .filter((v): v is T => allowed.includes(v));

  const normalized = Array.from(new Set(parsed));
  return normalized.length > 0 ? normalized : [...fallback];
}
