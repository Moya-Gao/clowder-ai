import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { SignalPaths } from '../config/signal-paths.js';

export interface InboxRecord {
  readonly id: string;
  readonly title: string;
  readonly url: string;
  readonly source: string;
  readonly tier: number;
  readonly fetchedAt: string;
  readonly filePath: string;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value !== 'string') continue;
    const normalized = value.trim();
    if (normalized.length > 0) {
      return normalized;
    }
  }
  return undefined;
}

function normalizeDateString(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized) {
    return undefined;
  }
  return normalized;
}

async function readSingleInboxFile(filePath: string): Promise<readonly InboxRecord[]> {
  try {
    const raw = await readFile(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const records: InboxRecord[] = [];
    for (const item of parsed) {
      const record = asRecord(item);
      if (!record) continue;

      const id = pickString(record, ['id']);
      const title = pickString(record, ['title']);
      const url = pickString(record, ['url']);
      const source = pickString(record, ['source']);
      const fetchedAt = pickString(record, ['fetchedAt']);
      const filePathValue = pickString(record, ['filePath']);
      const tierValue = record['tier'];

      if (!id || !title || !url || !source || !fetchedAt || !filePathValue || typeof tierValue !== 'number') {
        continue;
      }

      records.push({
        id,
        title,
        url,
        source,
        tier: tierValue,
        fetchedAt,
        filePath: filePathValue,
      });
    }

    return records;
  } catch {
    return [];
  }
}

export async function readInboxRecords(paths: SignalPaths, date: string | undefined): Promise<readonly InboxRecord[]> {
  const explicitDate = normalizeDateString(date);
  if (explicitDate) {
    return readSingleInboxFile(join(paths.inboxDir, `${explicitDate}.json`));
  }

  let inboxFiles: readonly string[] = [];
  try {
    inboxFiles = (await readdir(paths.inboxDir))
      .filter((file) => file.endsWith('.json'))
      .sort()
      .reverse();
  } catch {
    inboxFiles = [];
  }

  const allRecords: InboxRecord[] = [];
  for (const inboxFile of inboxFiles) {
    const records = await readSingleInboxFile(join(paths.inboxDir, inboxFile));
    allRecords.push(...records);
  }

  return allRecords;
}
