'use client';

import type { GameEvent } from '@cat-cafe/shared';
import { useEffect, useRef } from 'react';

interface EventFlowProps {
  events: GameEvent[];
}

const SYSTEM_EVENT_TYPES = new Set(['phase_change', 'death', 'vote_result', 'game_start', 'game_end', 'announce']);

export function EventFlow({ events }: EventFlowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, []);

  return (
    <div
      data-testid="event-flow"
      ref={scrollRef}
      className="flex-1 overflow-y-auto bg-[#0A0F1C] px-6 py-4 flex flex-col gap-3"
    >
      {events.map((event) => {
        const isSystem = SYSTEM_EVENT_TYPES.has(event.type);
        if (isSystem) {
          return (
            <div key={event.eventId} data-testid="system-event" className="flex items-center gap-2 w-full">
              <span className="text-[#F59E0B] text-sm">🔔</span>
              <span className="text-[#94A3B8] text-sm">{String(event.payload.message ?? event.type)}</span>
            </div>
          );
        }

        // Chat bubble (speech events)
        const sender = String(event.payload.senderName ?? event.payload.seatId ?? '');
        const content = String(event.payload.content ?? event.payload.message ?? '');

        return (
          <div
            key={event.eventId}
            data-testid="chat-bubble"
            className="bg-[#1E293B] rounded-lg px-3.5 py-2.5 w-full flex flex-col gap-1"
          >
            <span className="text-[#22D3EE] text-xs font-semibold">{sender}</span>
            <span className="text-[#E2E8F0] text-sm">{content}</span>
          </div>
        );
      })}
    </div>
  );
}
