/**
 * Game Command Interceptor (F101)
 *
 * Parses `/game` chat commands and builds the input needed to start a game
 * via GameOrchestrator. This bridges the gap between chat messages and the
 * game lifecycle API.
 */

import type { Seat } from '@cat-cafe/shared';

/** Known game types that have engine implementations */
const KNOWN_GAME_TYPES = new Set(['werewolf']);

/** Subcommands that should NOT be treated as game-start commands */
const SUBCOMMANDS = new Set(['status', 'end']);

/** Valid human role values */
const VALID_HUMAN_ROLES = new Set(['player', 'god-view']);

export interface ParsedGameCommand {
  gameType: string;
  humanRole: 'player' | 'god-view';
  voiceMode: boolean;
}

/**
 * Parse a `/game` command from a chat message.
 * Returns null if the message is not a valid `/game` start command.
 */
export function parseGameCommand(content: string): ParsedGameCommand | null {
  const trimmed = content.trim();
  if (!trimmed.toLowerCase().startsWith('/game ') && trimmed.toLowerCase() !== '/game') return null;

  const parts = trimmed.split(/\s+/);
  // Need at least: /game <type> <role>
  if (parts.length < 3) return null;

  const gameType = parts[1]!.toLowerCase();

  // Reject subcommands like /game status, /game end
  if (SUBCOMMANDS.has(gameType)) return null;

  // Reject unknown game types
  if (!KNOWN_GAME_TYPES.has(gameType)) return null;

  const humanRole = parts[2]!.toLowerCase();
  if (!VALID_HUMAN_ROLES.has(humanRole)) return null;

  const voiceMode = parts.length >= 4 && parts[3]!.toLowerCase() === 'voice';

  return {
    gameType,
    humanRole: humanRole as 'player' | 'god-view',
    voiceMode,
  };
}

interface BuildSeatsInput {
  humanRole: 'player' | 'god-view';
  userId: string;
  catIds: readonly string[];
  playerCount: number;
}

/**
 * Build seat assignments for a game.
 *
 * - player mode: P1 = human, P2..Pn = cats
 * - god-view mode: all seats are cats (human observes)
 */
export function buildGameSeats(input: BuildSeatsInput): Seat[] {
  const { humanRole, userId, catIds, playerCount } = input;
  const seats: Seat[] = [];

  if (humanRole === 'player') {
    // P1 = human player
    seats.push({
      seatId: 'P1' as `P${number}`,
      actorType: 'human',
      actorId: userId,
      role: '',
      alive: true,
      properties: {},
    });
    // P2..Pn = AI cats (cycle if needed)
    for (let i = 1; i < playerCount; i++) {
      const catId = catIds[(i - 1) % catIds.length]!;
      seats.push({
        seatId: `P${i + 1}` as `P${number}`,
        actorType: 'cat',
        actorId: catId,
        role: '',
        alive: true,
        properties: {},
      });
    }
  } else {
    // god-view: all seats are cats
    for (let i = 0; i < playerCount; i++) {
      const catId = catIds[i % catIds.length]!;
      seats.push({
        seatId: `P${i + 1}` as `P${number}`,
        actorType: 'cat',
        actorId: catId,
        role: '',
        alive: true,
        properties: {},
      });
    }
  }

  return seats;
}
