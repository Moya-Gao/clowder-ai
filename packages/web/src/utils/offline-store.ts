import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { ChatMessage, Thread } from '../stores/chat-types';

const DB_NAME = 'cat-cafe-offline';
const DB_VERSION = 1;
const MAX_SNAPSHOT_MESSAGES = 50;

interface CatCafeOfflineDB extends DBSchema {
  threads: {
    key: string;
    value: { id: string; threads: Thread[]; updatedAt: number };
  };
  'thread-messages': {
    key: string;
    value: {
      threadId: string;
      messages: ChatMessage[];
      hasMore: boolean;
      updatedAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CatCafeOfflineDB>> | null = null;

function getDB(): Promise<IDBPDatabase<CatCafeOfflineDB>> {
  if (!dbPromise) {
    dbPromise = openDB<CatCafeOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('threads')) {
          db.createObjectStore('threads', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('thread-messages')) {
          db.createObjectStore('thread-messages', { keyPath: 'threadId' });
        }
      },
    });
  }
  return dbPromise;
}

export async function saveThreads(threads: Thread[]): Promise<void> {
  const db = await getDB();
  await db.put('threads', {
    id: 'thread-list',
    threads,
    updatedAt: Date.now(),
  });
}

export async function loadThreads(): Promise<Thread[] | null> {
  const db = await getDB();
  const record = await db.get('threads', 'thread-list');
  return record?.threads ?? null;
}

export async function saveThreadMessages(threadId: string, messages: ChatMessage[], hasMore: boolean): Promise<void> {
  const db = await getDB();
  const trimmed = messages.slice(-MAX_SNAPSHOT_MESSAGES);
  await db.put('thread-messages', {
    threadId,
    messages: trimmed,
    hasMore,
    updatedAt: Date.now(),
  });
}

export async function loadThreadMessages(
  threadId: string,
): Promise<{ messages: ChatMessage[]; hasMore: boolean; updatedAt: number } | null> {
  const db = await getDB();
  const record = await db.get('thread-messages', threadId);
  return record ?? null;
}

export async function clearAll(): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(['threads', 'thread-messages'], 'readwrite');
  tx.objectStore('threads').clear();
  tx.objectStore('thread-messages').clear();
  await tx.done;
}

/** Reset the cached DB connection. Test-only. */
export function _resetDBForTest(): void {
  dbPromise = null;
}
