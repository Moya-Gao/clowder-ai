/**
 * F252: Parse storyId from URL parameter.
 *
 * Next.js `useParams()` URL-encodes special characters in dynamic route segments,
 * so colons arrive as `%3A`. This function handles both raw and encoded forms.
 *
 * Phase A: `session:<sessionId>` → single session replay
 * Phase C: `feat:<featId>` → feature story (multi-thread swimlane)
 * Phase D: will add UUID-based persistent stories.
 */
export type ParsedStoryId = { type: 'session'; sessionId: string } | { type: 'feat'; featId: string };

export function parseStoryId(raw: string): ParsedStoryId | null {
  let storyId: string;
  try {
    storyId = decodeURIComponent(raw);
  } catch {
    // Malformed percent-encoding (e.g. "%ZZ") — treat as unrecognized format
    return null;
  }
  if (storyId.startsWith('session:')) {
    return { type: 'session', sessionId: storyId.slice('session:'.length) };
  }
  if (storyId.startsWith('feat:')) {
    const featId = storyId.slice('feat:'.length).toUpperCase();
    if (/^F\d{2,4}$/.test(featId)) {
      return { type: 'feat', featId };
    }
  }
  // Phase D: UUID-based persistent stories
  return null;
}
