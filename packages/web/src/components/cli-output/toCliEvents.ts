import type { CliEvent, ToolEvent } from '@/stores/chat-types';

/** Strip "catId → " prefix from tool_use labels → clean tool name.
 *  e.g. "opus → Read" → "Read", "opus → Bash" → "Bash" */
function cleanToolLabel(label: string): string {
  const arrowIdx = label.indexOf(' → ');
  return arrowIdx >= 0 ? label.slice(arrowIdx + 3) : label;
}

/** Extract primary argument from JSON tool input detail for inline display.
 *  e.g. '{"file_path":"src/index.ts"}' → "src/index.ts" */
function extractPrimaryArg(detail?: string): string | undefined {
  if (!detail) return undefined;
  try {
    const obj = JSON.parse(detail) as Record<string, unknown>;
    // Common tool arg names in preference order
    for (const key of ['file_path', 'command', 'pattern', 'url', 'query', 'prompt', 'content']) {
      const val = obj[key];
      if (typeof val === 'string' && val.length > 0) {
        return val.length > 60 ? `${val.slice(0, 57)}...` : val;
      }
    }
    // Fallback: first short string value
    for (const val of Object.values(obj)) {
      if (typeof val === 'string' && val.length > 0 && val.length <= 80) {
        return val.length > 60 ? `${val.slice(0, 57)}...` : val;
      }
    }
  } catch { /* not valid JSON, ignore */ }
  return undefined;
}

/** F097: Adapt existing ToolEvent[] + stream content → CliEvent[] unified timeline.
 *  Phase A: N tool events + 1 text block. Phase B: backend pushes CliEvent[] directly. */
export function toCliEvents(toolEvents: ToolEvent[] | undefined, streamContent: string | undefined): CliEvent[] {
  const events: CliEvent[] = [];

  if (toolEvents) {
    for (const te of toolEvents) {
      if (te.type === 'tool_use') {
        const toolName = cleanToolLabel(te.label);
        const primaryArg = extractPrimaryArg(te.detail);
        events.push({
          id: te.id,
          kind: te.type,
          timestamp: te.timestamp,
          label: primaryArg ? `${toolName} ${primaryArg}` : toolName,
          detail: te.detail,
        });
      } else {
        // tool_result: strip "catId ← result" label, keep detail
        events.push({
          id: te.id,
          kind: te.type,
          timestamp: te.timestamp,
          label: te.label,
          detail: te.detail,
        });
      }
    }
  }

  if (streamContent?.trim()) {
    events.push({
      id: 'stdout-text',
      kind: 'text',
      timestamp: events.length > 0 ? events[events.length - 1].timestamp + 1 : Date.now(),
      content: streamContent,
    });
  }

  return events;
}
