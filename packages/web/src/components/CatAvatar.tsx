'use client';

import { useState } from 'react';
import { PawIcon } from './icons/PawIcon';

const CAT_THEME: Record<string, { ring: string; name: string; glow: string }> = {
  opus: { ring: 'ring-opus-primary', name: '布偶猫', glow: 'shadow-[0_0_10px_rgba(139,92,246,0.5)]' },
  codex: { ring: 'ring-codex-primary', name: '缅因猫', glow: 'shadow-[0_0_10px_rgba(34,197,94,0.5)]' },
  gemini: { ring: 'ring-gemini-primary', name: '暹罗猫', glow: 'shadow-[0_0_10px_rgba(59,130,246,0.5)]' },
};

type CatStatus = 'pending' | 'streaming' | 'done' | 'error';

interface CatAvatarProps {
  catId: string;
  size?: number;
  status?: CatStatus;
}

export function CatAvatar({ catId, size = 32, status }: CatAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const theme = CAT_THEME[catId];
  const isStreaming = status === 'streaming';
  const isError = status === 'error';
  const ringClass = isError ? 'ring-red-500' : (theme?.ring ?? 'ring-gray-300');
  const glowClass = isStreaming && theme ? `${theme.glow} animate-pulse` : '';

  return (
    <div
      className={`rounded-full ring-2 ${ringClass} ${glowClass} overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center transition-shadow duration-300`}
      style={{ width: size, height: size }}
    >
      {imgError ? (
        <PawIcon className="w-4 h-4 text-gray-400" />
      ) : (
        <img
          src={`/avatars/${catId}.png`}
          alt={theme?.name ?? catId}
          width={size}
          height={size}
          className="object-cover"
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
