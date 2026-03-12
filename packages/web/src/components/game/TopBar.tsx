'use client';

interface TopBarProps {
  phaseName: string;
  roundInfo: string;
  timeLeftMs: number;
  isNight: boolean;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function TopBar({ phaseName, roundInfo, timeLeftMs, isNight }: TopBarProps) {
  const phaseIcon = isNight ? '🌙' : '☀️';

  return (
    <div
      data-testid="top-bar"
      className={`flex items-center justify-between px-6 h-12 w-full ${isNight ? 'bg-[#070B14]' : 'bg-[#0F172A]'}`}
    >
      <span className={`text-sm font-semibold ${isNight ? 'text-[#94A3B8]' : 'text-white'}`}>
        {phaseIcon} {phaseName}
      </span>
      <span
        data-testid="countdown"
        className="bg-[#1E293B] text-[#22D3EE] px-3 py-0 h-7 flex items-center rounded-md text-xs font-mono font-semibold"
      >
        {formatTime(timeLeftMs)}
      </span>
      <span className="text-[#64748B] text-xs font-medium">{roundInfo}</span>
    </div>
  );
}
