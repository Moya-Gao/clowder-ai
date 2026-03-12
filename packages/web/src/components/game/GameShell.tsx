'use client';

import { type ReactNode } from 'react';

interface GameShellProps {
  children?: ReactNode;
  onClose: () => void;
  isNight?: boolean;
}

export function GameShell({ children, isNight = false }: GameShellProps) {
  return (
    <div
      data-testid="game-shell"
      className={`fixed inset-0 z-50 flex flex-col bg-[#0A0F1C] text-white${isNight ? ' brightness-90 saturate-75' : ''}`}
    >
      {children}
    </div>
  );
}
