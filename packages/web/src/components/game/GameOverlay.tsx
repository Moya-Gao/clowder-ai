'use client';

import type { GameView, SeatId } from '@cat-cafe/shared';
import { ActionDock } from './ActionDock';
import { EventFlow } from './EventFlow';
import { GameShell } from './GameShell';
import { GodInspector } from './GodInspector';
import { NightActionCard } from './NightActionCard';
import { NightStatus } from './NightStatus';
import { type PhaseEntry, PhaseTimeline } from './PhaseTimeline';
import { PlayerGrid } from './PlayerGrid';
import { TopBar } from './TopBar';

interface GameOverlayProps {
  view: GameView;
  isNight: boolean;
  selectedTarget: SeatId | null;
  godScopeFilter: string;

  // God-view mode
  isGodView?: boolean;
  godSeats?: Array<{ seatId: string; role: string; faction?: string; alive: boolean; status: string }>;
  godNightSteps?: Array<{ roleName: string; detail: string; status: 'done' | 'in_progress' | 'pending' }>;

  // Targeted action props (night + day_hunter)
  hasTargetedAction?: boolean;
  myRole?: string;
  myRoleIcon?: string;
  myActionLabel?: string;
  myActionHint?: string;
  /** For witch: alternate action (poison) */
  altActionName?: string;

  // Callbacks
  onClose: () => void;
  onSelectTarget: (seatId: SeatId) => void;
  onGodScopeChange: (scope: string) => void;
  onVote: () => void;
  onSpeak: (content: string) => void;
  onConfirmAction: () => void;
  /** For witch: confirm alternate action (poison) */
  onConfirmAltAction?: () => void;
}

function buildPhaseEntries(view: GameView): PhaseEntry[] {
  return [{ name: view.currentPhase, label: view.currentPhase, round: view.round }];
}

export function GameOverlay({
  view,
  isNight,
  selectedTarget,
  godScopeFilter,
  isGodView = false,
  godSeats = [],
  godNightSteps = [],
  hasTargetedAction = false,
  myRole,
  myRoleIcon,
  myActionLabel,
  myActionHint,
  altActionName,
  onClose,
  onSelectTarget,
  onGodScopeChange,
  onVote,
  onSpeak,
  onConfirmAction,
  onConfirmAltAction,
}: GameOverlayProps) {
  const phases = buildPhaseEntries(view);
  const timeLeftMs = view.config.timeoutMs;

  return (
    <GameShell onClose={onClose} isNight={isNight}>
      <TopBar
        phaseName={view.currentPhase}
        roundInfo={`第 ${view.round} 轮`}
        timeLeftMs={timeLeftMs}
        isNight={isNight}
      />
      <PhaseTimeline phases={phases} currentIndex={0} />
      <PlayerGrid seats={view.seats} />

      <div className="flex flex-1 min-h-0">
        {/* Main content area */}
        <div className="flex flex-col flex-1 min-h-0">
          {isNight && myRole && myActionHint && <NightStatus roleName={myRole} actionHint={myActionHint} />}

          {hasTargetedAction && myRole ? (
            <div className="flex-1 flex items-center justify-center">
              <NightActionCard
                roleName={myRole}
                roleIcon={myRoleIcon ?? '🎭'}
                actionLabel={myActionLabel ?? ''}
                hint={myActionHint ?? ''}
                targets={view.seats.filter((s) => s.alive)}
                selectedTarget={selectedTarget}
                onSelectTarget={onSelectTarget}
                onConfirm={onConfirmAction}
                altActionLabel={altActionName ? '毒杀' : undefined}
                onConfirmAlt={altActionName ? onConfirmAltAction : undefined}
              />
            </div>
          ) : (
            <>
              <EventFlow events={view.visibleEvents} />
              {!isNight && <ActionDock onVote={onVote} onSpeak={onSpeak} />}
            </>
          )}
        </div>

        {/* God Inspector (right panel) */}
        {isGodView && (
          <GodInspector
            seats={godSeats}
            nightSteps={godNightSteps}
            scopeFilter={godScopeFilter}
            onScopeChange={onGodScopeChange}
          />
        )}
      </div>
    </GameShell>
  );
}
