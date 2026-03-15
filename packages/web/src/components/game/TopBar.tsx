'use client';

interface TopBarProps {
  phaseName: string;
  roundInfo: string;
  timeLeftMs: number;
  isNight: boolean;
  onClose?: () => void;
}

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

export function TopBar({ phaseName, roundInfo, timeLeftMs, isNight, onClose }: TopBarProps) {
  const phaseIcon = isNight ? '🌙' : '☀️';

  return (
    <div
      data-testid="top-bar"
      className={`flex items-center justify-between px-6 h-12 w-full ${isNight ? 'bg-[#070B14]' : 'bg-[#0F172A]'}`}
    >
      <div className="flex items-center gap-3">
        {onClose && (
          <button
            data-testid="game-close-btn"
            onClick={onClose}
            className="text-[#64748B] hover:text-white transition-colors p-1 -ml-1 rounded"
            aria-label="退出游戏"
            title="退出游戏"
          >
            <svg className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        )}
        <span className={`text-sm font-semibold ${isNight ? 'text-[#94A3B8]' : 'text-white'}`}>
          {phaseIcon} {phaseName}
        </span>
      </div>
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
