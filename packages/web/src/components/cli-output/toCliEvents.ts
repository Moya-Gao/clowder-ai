import type { CliEvent, ToolEvent } from '@/stores/chat-types';

/** F097: Adapt existing ToolEvent[] + stream content → CliEvent[] unified timeline.
 *  Phase A: N tool events + 1 text block. Phase B: backend pushes CliEvent[] directly. */
export function toCliEvents(toolEvents: ToolEvent[] | undefined, streamContent: string | undefined): CliEvent[] {
  const events: CliEvent[] = [];

  if (toolEvents) {
    for (const te of toolEvents) {
      events.push({
        id: te.id,
        kind: te.type,
        timestamp: te.timestamp,
        label: te.label,
        detail: te.detail,
      });
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
