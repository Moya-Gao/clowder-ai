import * as Phaser from 'phaser';
import { GameState } from '../game-state';
import { AiController, type AiAction } from '../ai-controller';
import { createRng } from '../rng';
import {
  PALETTE,
  TEAM_COLORS,
  GROUND_Y,
  ATTACK_COOLDOWN_MS,
  HURT_DURATION_MS,
} from '../types';
import type { FighterId } from '../types';

const MOVE_SPEED = 160;
const FIGHTER_W = 48;
const FIGHTER_H = 64;

export class BattleScene extends Phaser.Scene {
  private gs!: GameState;
  private ai1!: AiController;
  private ai2!: AiController;
  private p1Sprite!: Phaser.GameObjects.Rectangle;
  private p2Sprite!: Phaser.GameObjects.Rectangle;
  private p1Label!: Phaser.GameObjects.Text;
  private p2Label!: Phaser.GameObjects.Text;
  private p1HpBar!: Phaser.GameObjects.Rectangle;
  private p2HpBar!: Phaser.GameObjects.Rectangle;
  private fightText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private mode: 'pvai' | 'aivai' = 'aivai';
  private seed = 0;
  private matchTimer = 99;
  private timerEvent!: Phaser.Time.TimerEvent;
  private battleStarted = false;
  private matchEnded = false;

  constructor() {
    super({ key: 'BattleScene' });
  }

  init(data: { mode?: 'pvai' | 'aivai'; seed?: number }) {
    this.mode = data.mode ?? 'aivai';
    this.seed = data.seed ?? Date.now();
    this.gs = new GameState('opus46', 'codex');
    this.ai1 = new AiController('opus46', createRng(this.seed));
    this.ai2 = new AiController('codex', createRng(this.seed + 1));
    this.matchTimer = 99;
    this.battleStarted = false;
    this.matchEnded = false;
  }

  preload() {
    this.load.image('bg', '/images/f090/background-cityscape.jpg');
  }

  create() {
    // Background
    const bg = this.add.image(320, 180, 'bg').setDisplaySize(640, 360);
    bg.setAlpha(0.25);

    // Ground line
    this.add.rectangle(320, GROUND_Y + FIGHTER_H / 2 + 4, 580, 2, 0x3a4658);

    // Fighter rectangles
    const p1Color = parseInt(TEAM_COLORS.opus46.slice(1), 16);
    const p2Color = parseInt(TEAM_COLORS.codex.slice(1), 16);
    const slateColor = parseInt(PALETTE.slate.slice(1), 16);

    this.p1Sprite = this.add
      .rectangle(this.gs.p1.x, GROUND_Y, FIGHTER_W, FIGHTER_H)
      .setStrokeStyle(2, p1Color)
      .setFillStyle(slateColor);

    this.p2Sprite = this.add
      .rectangle(this.gs.p2.x, GROUND_Y, FIGHTER_W, FIGHTER_H)
      .setStrokeStyle(2, p2Color)
      .setFillStyle(slateColor);

    // Name labels under fighters
    this.p1Label = this.add.text(this.gs.p1.x, GROUND_Y + 40, this.gs.p1.name, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: TEAM_COLORS.opus46,
    }).setOrigin(0.5, 0);

    this.p2Label = this.add.text(this.gs.p2.x, GROUND_Y + 40, this.gs.p2.name, {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: TEAM_COLORS.codex,
    }).setOrigin(0.5, 0);

    // --- HUD ---
    const steelColor = parseInt(PALETTE.steel.slice(1), 16);

    // P1 HP bar (top-left)
    this.add
      .rectangle(24, 16, 204, 16, slateColor)
      .setStrokeStyle(2, steelColor)
      .setOrigin(0, 0);
    this.p1HpBar = this.add
      .rectangle(26, 18, 200, 12, p1Color)
      .setOrigin(0, 0);
    this.add.text(24, 4, this.gs.p1.name, {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: PALETTE.bone,
    });

    // P2 HP bar (top-right)
    this.add
      .rectangle(412, 16, 204, 16, slateColor)
      .setStrokeStyle(2, steelColor)
      .setOrigin(0, 0);
    this.p2HpBar = this.add
      .rectangle(414, 18, 200, 12, p2Color)
      .setOrigin(0, 0);
    this.add
      .text(616, 4, this.gs.p2.name, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: PALETTE.bone,
      })
      .setOrigin(1, 0);

    // Timer
    this.timerText = this.add
      .text(320, 8, '99', {
        fontFamily: 'monospace',
        fontSize: '16px',
        color: PALETTE.flash,
      })
      .setOrigin(0.5, 0);

    // "ROUND 1" text
    this.add
      .text(320, 120, 'ROUND 1', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: PALETTE.bone,
      })
      .setOrigin(0.5);

    // "FIGHT!" flash
    this.fightText = this.add
      .text(320, 150, 'FIGHT!', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: PALETTE.flash,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Controls hint (bottom)
    if (this.mode === 'pvai') {
      const hint = this.add
        .text(320, 340, 'A/D Move  |  J Attack', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: PALETTE.steel,
        })
        .setOrigin(0.5);
      this.time.delayedCall(5000, () => {
        this.tweens.add({ targets: hint, alpha: 0, duration: 1000 });
      });
    } else {
      this.add
        .text(320, 340, 'AI vs AI  —  watching', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: PALETTE.steel,
        })
        .setOrigin(0.5);
    }

    // Delay fight start (show FIGHT! for 1.5s)
    this.time.delayedCall(1500, () => {
      this.fightText.setVisible(false);
      this.battleStarted = true;

      // Timer countdown
      this.timerEvent = this.time.addEvent({
        delay: 1000,
        callback: () => {
          this.matchTimer = Math.max(0, this.matchTimer - 1);
          this.timerText.setText(String(this.matchTimer));
        },
        loop: true,
      });
    });

    // Keyboard input
    if (this.input.keyboard) {
      this.keys = {
        left: this.input.keyboard.addKey('A'),
        right: this.input.keyboard.addKey('D'),
        attack: this.input.keyboard.addKey('J'),
      };
    }
  }

  update(_time: number, delta: number) {
    if (!this.battleStarted || this.matchEnded) return;

    // Timer expired → end immediately, no combat this frame
    if (this.matchTimer <= 0) {
      this.endMatch();
      return;
    }

    // Reduce cooldowns
    this.gs.p1.attackCooldownMs = Math.max(0, this.gs.p1.attackCooldownMs - delta);
    this.gs.p2.attackCooldownMs = Math.max(0, this.gs.p2.attackCooldownMs - delta);

    // P1 input (player or AI)
    const p1Action: AiAction =
      this.mode === 'pvai' ? this.getPlayerAction() : this.ai1.decide(this.gs);
    this.applyAction('opus46', p1Action, delta);

    // P2 always AI
    const p2Action = this.ai2.decide(this.gs);
    this.applyAction('codex', p2Action, delta);

    // Hit detection
    this.processHit('opus46');
    this.processHit('codex');

    // Update visuals
    this.p1Sprite.setPosition(this.gs.p1.x, GROUND_Y);
    this.p2Sprite.setPosition(this.gs.p2.x, GROUND_Y);
    this.p1Label.setPosition(this.gs.p1.x, GROUND_Y + 40);
    this.p2Label.setPosition(this.gs.p2.x, GROUND_Y + 40);

    // HP bars
    this.p1HpBar.setSize(200 * (this.gs.p1.hp / this.gs.p1.maxHp), 12);
    this.p2HpBar.setSize(200 * (this.gs.p2.hp / this.gs.p2.maxHp), 12);

    // Check game over
    if (this.gs.isOver()) {
      this.endMatch();
    }
  }

  private endMatch() {
    this.matchEnded = true;
    if (this.timerEvent) this.timerEvent.remove();
    const winnerId = this.gs.winner();
    const winnerName = winnerId
      ? this.gs.getFighter(winnerId).name
      : 'DRAW';
    const label = winnerId ? `${winnerName} WINS!` : 'TIME UP!';

    this.add
      .text(320, 160, label, {
        fontFamily: 'monospace',
        fontSize: '20px',
        color: PALETTE.flash,
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Restart hint
    this.add
      .text(320, 200, 'Press R to restart', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: PALETTE.steel,
      })
      .setOrigin(0.5);

    if (this.input.keyboard) {
      this.input.keyboard.once('keydown-R', () => {
        this.scene.restart({ mode: this.mode, seed: this.seed });
      });
    }
  }

  private getPlayerAction(): AiAction {
    if (!this.keys) return 'idle';
    if (this.keys.attack.isDown && this.gs.p1.attackCooldownMs <= 0) return 'attack';
    if (this.keys.left.isDown) return 'move_left';
    if (this.keys.right.isDown) return 'move_right';
    return 'idle';
  }

  private applyAction(id: FighterId, action: AiAction, dt: number) {
    const fighter = this.gs.getFighter(id);
    const opp = this.gs.getOpponent(id);

    // Auto-face opponent
    fighter.facing = opp.x > fighter.x ? 'right' : 'left';

    switch (action) {
      case 'move_left':
        fighter.x = Math.max(24, fighter.x - MOVE_SPEED * (dt / 1000));
        fighter.state = 'run';
        break;
      case 'move_right':
        fighter.x = Math.min(616, fighter.x + MOVE_SPEED * (dt / 1000));
        fighter.state = 'run';
        break;
      case 'attack':
        if (fighter.attackCooldownMs <= 0) {
          fighter.state = 'attack';
          fighter.attackCooldownMs = ATTACK_COOLDOWN_MS;
          this.gs.resetSwing(id);
        }
        break;
      default:
        if (fighter.attackCooldownMs <= 0) fighter.state = 'idle';
    }
  }

  private processHit(attackerId: FighterId) {
    const hit = this.gs.checkHit(attackerId);
    if (!hit) return;

    this.gs.applyDamage(hit.defenderId, hit.damage);
    this.gs.consumeHit(attackerId);

    // Visual feedback — flash defender red
    const dangerColor = parseInt(PALETTE.danger.slice(1), 16);
    const slateColor = parseInt(PALETTE.slate.slice(1), 16);
    const defSprite =
      hit.defenderId === this.gs.p1.id ? this.p1Sprite : this.p2Sprite;
    defSprite.setFillStyle(dangerColor);
    this.time.delayedCall(HURT_DURATION_MS, () => {
      defSprite.setFillStyle(slateColor);
    });

    // Knockback
    const defender = this.gs.getFighter(hit.defenderId);
    const attacker = this.gs.getFighter(attackerId);
    const dir = defender.x > attacker.x ? 1 : -1;
    defender.x = Phaser.Math.Clamp(defender.x + dir * 20, 24, 616);

    // Reset attacker state
    attacker.state = 'idle';
  }
}
