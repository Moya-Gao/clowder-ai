'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type GameMode = 'pvai' | 'aivai';

export default function PixelBrawlPage() {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [started, setStarted] = useState(false);

  const startGame = useCallback(async (mode: GameMode) => {
    if (!gameContainerRef.current) return;

    // Destroy previous game if restarting
    gameRef.current?.destroy(true);

    const Phaser = (await import('phaser')).default;
    const { BattleScene } = await import(
      '@/games/pixel-brawl/scenes/BattleScene'
    );

    gameRef.current = new Phaser.Game({
      type: Phaser.CANVAS,
      width: 640,
      height: 360,
      zoom: 2,
      parent: gameContainerRef.current,
      backgroundColor: '#111318',
      pixelArt: true,
      scene: [BattleScene],
    });

    // Pass mode to scene
    gameRef.current.scene.start('BattleScene', { mode, seed: Date.now() });
    setStarted(true);
  }, []);

  useEffect(() => {
    return () => {
      gameRef.current?.destroy(true);
    };
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        fontFamily: 'monospace',
      }}
    >
      {!started && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '24px',
            color: '#E8DFC7',
          }}
        >
          <h1
            style={{
              fontSize: '32px',
              color: '#F1E28A',
              margin: 0,
              letterSpacing: '4px',
            }}
          >
            PIXEL BRAWL
          </h1>
          <p style={{ fontSize: '14px', color: '#3A4658', margin: 0 }}>
            Cat Café Fighting Demo
          </p>
          <div style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
            <button
              type="button"
              onClick={() => startGame('aivai')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1E2430',
                color: '#00F0FF',
                border: '2px solid #3A4658',
                fontFamily: 'monospace',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              AI vs AI
            </button>
            <button
              type="button"
              onClick={() => startGame('pvai')}
              style={{
                padding: '12px 24px',
                backgroundColor: '#1E2430',
                color: '#2FA56E',
                border: '2px solid #3A4658',
                fontFamily: 'monospace',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Player vs AI
            </button>
          </div>
          <p style={{ fontSize: '10px', color: '#3A4658', margin: 0 }}>
            Player controls: A/D move | J attack | R restart
          </p>
        </div>
      )}
      <div ref={gameContainerRef} />
    </div>
  );
}
