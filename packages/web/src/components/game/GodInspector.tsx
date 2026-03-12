'use client';

interface SeatMatrixRow {
  seatId: string;
  role: string;
  faction?: string;
  alive: boolean;
  status: string;
}

interface NightStep {
  roleName: string;
  detail: string;
  status: 'done' | 'in_progress' | 'pending';
}

interface GodInspectorProps {
  seats: SeatMatrixRow[];
  nightSteps: NightStep[];
  scopeFilter: string;
  onScopeChange: (scope: string) => void;
}

const ROLE_COLORS: Record<string, string> = {
  wolf: '#EF4444',
  seer: '#A78BFA',
  witch: '#F472B6',
  guard: '#22D3EE',
  hunter: '#F97316',
};

const STATUS_ICONS: Record<string, { icon: string; color: string }> = {
  done: { icon: '✓', color: '#22D3EE' },
  in_progress: { icon: '◐', color: '#F59E0B' },
  pending: { icon: '○', color: '#475569' },
};

const SCOPE_TABS = [
  { key: 'all', label: 'All', color: null },
  { key: 'wolves', label: 'Wolves', color: '#EF4444' },
  { key: 'seer', label: 'Seer', color: '#A78BFA' },
  { key: 'witch', label: 'Witch', color: '#F472B6' },
];

function getRoleColor(faction?: string): string {
  if (!faction) return '#94A3B8';
  return ROLE_COLORS[faction] ?? '#94A3B8';
}

export function GodInspector({ seats, nightSteps, scopeFilter, onScopeChange }: GodInspectorProps) {
  return (
    <div
      data-testid="god-inspector"
      className="flex flex-col gap-3.5 bg-[#0F172A] border-l border-[#1E293B] p-4 h-full w-[360px] overflow-y-auto"
    >
      {/* Section 1: Seat Matrix */}
      <span className="text-[#64748B] text-[10px] font-bold font-mono tracking-widest">SEAT MATRIX</span>
      <div data-testid="seat-matrix" className="flex flex-col gap-1">
        {seats.map((seat) => {
          const roleColor = getRoleColor(seat.faction);
          const isWolf = seat.faction === 'wolf';
          return (
            <div
              key={seat.seatId}
              data-testid={`matrix-${seat.seatId}`}
              className={`flex items-center justify-between rounded px-2 py-1 h-7 ${
                isWolf ? 'bg-[#2D1619]' : 'bg-[#1E293B]'
              }${!seat.alive ? ' opacity-40' : ''}`}
            >
              <span className="text-[10px] font-mono font-semibold" style={{ color: roleColor }}>
                {seat.seatId}
              </span>
              <span className="text-[10px] font-medium" style={{ color: roleColor }}>
                {seat.role}
                {!seat.alive ? ' 💀' : ''}
              </span>
              <span
                className={`text-[9px] font-mono font-medium ${
                  seat.status.includes('已行动')
                    ? 'text-[#22D3EE]'
                    : seat.status.includes('行动中')
                      ? 'text-[#F59E0B]'
                      : seat.status.includes('被刀')
                        ? 'text-[#EF4444]'
                        : 'text-[#475569]'
                }`}
              >
                {seat.status}
              </span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#1E293B] w-full" />

      {/* Section 2: Night Timeline */}
      <span className="text-[#64748B] text-[10px] font-bold font-mono tracking-widest">NIGHT TIMELINE</span>
      <div data-testid="night-timeline" className="flex flex-col gap-1.5">
        {nightSteps.map((step) => {
          const si = STATUS_ICONS[step.status] ?? { icon: '○', color: '#475569' };
          return (
            <div key={`${step.roleName}-${step.status}`} className="flex items-center gap-2 w-full">
              <span className="text-[10px] font-mono font-bold" style={{ color: si.color }}>
                {si.icon}
              </span>
              <span className="text-[11px] font-medium" style={{ color: getRoleColor(step.roleName.toLowerCase()) }}>
                {step.roleName}
              </span>
              <span className="text-[10px] font-mono text-[#475569]">{step.detail}</span>
            </div>
          );
        })}
      </div>

      {/* Divider */}
      <div className="h-px bg-[#1E293B] w-full" />

      {/* Section 3: Scope Filter */}
      <span className="text-[#64748B] text-[10px] font-bold font-mono tracking-widest">SCOPE FILTER</span>
      <div data-testid="scope-tabs" className="flex gap-1">
        {SCOPE_TABS.map((tab) => {
          const isActive = scopeFilter === tab.key;
          return (
            <button
              type="button"
              key={tab.key}
              data-testid={`scope-${tab.key}`}
              onClick={() => onScopeChange(tab.key)}
              className={`text-[10px] font-mono rounded-md px-3 py-1.5 ${
                isActive ? 'bg-[#22D3EE] text-[#0A0F1C] font-bold' : 'bg-[#1E293B]'
              }`}
              style={!isActive && tab.color ? { color: tab.color } : undefined}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
