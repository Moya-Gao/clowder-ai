'use client';

export interface PhaseEntry {
  name: string;
  label: string;
  round: number;
}

interface PhaseTimelineProps {
  phases: PhaseEntry[];
  currentIndex: number;
}

export function PhaseTimeline({ phases, currentIndex }: PhaseTimelineProps) {
  return (
    <div
      data-testid="phase-timeline"
      className="flex items-center justify-center gap-1 bg-[#0F172A] px-6 py-0 h-9 w-full"
    >
      {phases.map((phase, i) => (
        <span key={`${phase.round}-${phase.name}-${i}`} className="flex items-center gap-1">
          {i > 0 && <span className="text-[#475569] text-xs">→</span>}
          <span
            data-active={i === currentIndex ? 'true' : 'false'}
            className={`px-2.5 py-1 rounded text-xs font-medium ${
              i === currentIndex ? 'bg-[#22D3EE] text-[#0A0F1C] font-bold' : 'bg-[#1E293B] text-[#475569]'
            }`}
          >
            {phase.label}
          </span>
        </span>
      ))}
    </div>
  );
}
