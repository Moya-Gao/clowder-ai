'use client';

import type { SeatId, SeatView } from '@cat-cafe/shared';

interface PlayerGridProps {
  seats: SeatView[];
  activeSeatId?: SeatId | null;
  onSeatClick?: (seatId: SeatId) => void;
}

export function PlayerGrid({ seats, activeSeatId, onSeatClick }: PlayerGridProps) {
  return (
    <div
      data-testid="player-grid"
      className="flex items-center justify-center gap-2 bg-[#0F172A] px-6 py-2 h-20 w-full"
    >
      {seats.map((seat) => {
        const isActive = seat.seatId === activeSeatId;
        const isDead = !seat.alive;

        return (
          <button
            type="button"
            key={seat.seatId}
            data-testid={`seat-${seat.seatId}`}
            onClick={() => onSeatClick?.(seat.seatId)}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg w-14 h-16 ${
              isActive ? 'bg-[#22D3EE] text-[#0A0F1C]' : 'bg-[#1E293B] text-[#94A3B8]'
            }${isDead ? ' opacity-40' : ''}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/avatars/${seat.actorId}.png`}
              alt={seat.displayName}
              className="w-7 h-7 rounded-full object-cover"
              style={{ border: isActive ? '2px solid #0A0F1C' : '2px solid #0A0F1C' }}
            />
            <span
              className={`text-[9px] font-semibold truncate max-w-[52px] ${isActive ? 'text-[#0A0F1C] font-bold' : ''}`}
            >
              {seat.seatId} {seat.displayName}
            </span>
            <span className={`text-[8px] font-mono ${isActive ? 'text-[#0A0F1C] font-semibold' : 'text-[#475569]'}`}>
              {isDead ? '死亡' : isActive ? '发言中' : '等待'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
