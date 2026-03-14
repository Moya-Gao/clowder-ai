/**
 * Game Command Interceptor — TDD Red→Green
 *
 * Tests the /game command parser + seat builder bridge.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildGameSeats, parseGameCommand } from '../dist/routes/game-command-interceptor.js';

describe('parseGameCommand', () => {
  it('returns null for non-game messages', () => {
    assert.equal(parseGameCommand('hello world'), null);
    assert.equal(parseGameCommand('/help'), null);
    assert.equal(parseGameCommand('I want to play a game'), null);
  });

  it('parses /game werewolf player', () => {
    const result = parseGameCommand('/game werewolf player');
    assert.deepStrictEqual(result, {
      gameType: 'werewolf',
      humanRole: 'player',
      voiceMode: false,
    });
  });

  it('parses /game werewolf god-view', () => {
    const result = parseGameCommand('/game werewolf god-view');
    assert.deepStrictEqual(result, {
      gameType: 'werewolf',
      humanRole: 'god-view',
      voiceMode: false,
    });
  });

  it('parses /game werewolf player voice', () => {
    const result = parseGameCommand('/game werewolf player voice');
    assert.deepStrictEqual(result, {
      gameType: 'werewolf',
      humanRole: 'player',
      voiceMode: true,
    });
  });

  it('parses /game werewolf god-view voice', () => {
    const result = parseGameCommand('/game werewolf god-view voice');
    assert.deepStrictEqual(result, {
      gameType: 'werewolf',
      humanRole: 'god-view',
      voiceMode: true,
    });
  });

  it('returns null for /game without enough args', () => {
    assert.equal(parseGameCommand('/game'), null);
    assert.equal(parseGameCommand('/game werewolf'), null);
  });

  it('returns null for unknown game type', () => {
    assert.equal(parseGameCommand('/game mahjong player'), null);
  });

  it('returns null for /game status (subcommand)', () => {
    assert.equal(parseGameCommand('/game status'), null);
    assert.equal(parseGameCommand('/game end'), null);
  });

  it('is case-insensitive', () => {
    const result = parseGameCommand('/Game Werewolf God-View Voice');
    assert.deepStrictEqual(result, {
      gameType: 'werewolf',
      humanRole: 'god-view',
      voiceMode: true,
    });
  });
});

describe('buildGameSeats', () => {
  const catIds = ['opus', 'sonnet', 'codex', 'gpt52', 'gemini'];

  it('builds 7-player seats with human P1 for player mode', () => {
    const seats = buildGameSeats({
      humanRole: 'player',
      userId: 'lysander',
      catIds,
      playerCount: 7,
    });
    assert.equal(seats.length, 7);
    // P1 is human
    assert.equal(seats[0].seatId, 'P1');
    assert.equal(seats[0].actorType, 'human');
    assert.equal(seats[0].actorId, 'lysander');
    // P2-P7 are cats
    for (let i = 1; i < 7; i++) {
      assert.equal(seats[i].seatId, `P${i + 1}`);
      assert.equal(seats[i].actorType, 'cat');
    }
    // All alive, empty role
    for (const seat of seats) {
      assert.equal(seat.alive, true);
      assert.equal(seat.role, '');
    }
  });

  it('builds seats with no human seat for god-view mode', () => {
    const seats = buildGameSeats({
      humanRole: 'god-view',
      userId: 'lysander',
      catIds,
      playerCount: 7,
    });
    // God-view: human is observer, all 7 seats are cats
    assert.equal(seats.length, 7);
    for (const seat of seats) {
      assert.equal(seat.actorType, 'cat');
    }
  });

  it('cycles cats when playerCount exceeds catIds length', () => {
    const seats = buildGameSeats({
      humanRole: 'god-view',
      userId: 'lysander',
      catIds: ['opus', 'sonnet'],
      playerCount: 7,
    });
    assert.equal(seats.length, 7);
    // Should cycle through available cats
    assert.equal(seats[0].actorId, 'opus');
    assert.equal(seats[1].actorId, 'sonnet');
    assert.equal(seats[2].actorId, 'opus');
  });
});
