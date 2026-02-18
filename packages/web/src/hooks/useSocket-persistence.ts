const JOINED_ROOMS_STORAGE_KEY = 'cat-cafe:ws:joined-rooms:v1';

function isThreadRoom(room: unknown): room is string {
  return typeof room === 'string' && room.startsWith('thread:');
}

export function loadJoinedRoomsFromSession(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  const raw = window.sessionStorage.getItem(JOINED_ROOMS_STORAGE_KEY);
  if (!raw) return new Set();

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(isThreadRoom));
  } catch (error) {
    console.warn('[ws] Failed to parse persisted rooms, resetting cache', { error });
    window.sessionStorage.removeItem(JOINED_ROOMS_STORAGE_KEY);
    return new Set();
  }
}

export function saveJoinedRoomsToSession(rooms: Set<string>): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(JOINED_ROOMS_STORAGE_KEY, JSON.stringify([...rooms]));
}
