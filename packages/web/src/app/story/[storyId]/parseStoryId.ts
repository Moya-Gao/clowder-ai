/**
 * F252: Parse storyId from URL parameter.
 *
 * Next.js `useParams()` URL-encodes special characters in dynamic route segments,
 * so colons arrive as `%3A`. This function handles both raw and encoded forms.
 *
 * Phase A: only `session:<sessionId>` format.
 * Phase D: will add UUID-based persistent stories.
 */
export function parseStoryId(raw: string): { type: 'session'; sessionId: string } | null {
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
  // Phase D: UUID-based persistent stories
  return null;
}
