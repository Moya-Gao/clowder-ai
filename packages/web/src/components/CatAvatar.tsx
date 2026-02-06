'use client';

import { useState } from 'react';
import { PawIcon } from './icons/PawIcon';

const CAT_THEME: Record<string, { ring: string; name: string }> = {
  opus: { ring: 'ring-opus-primary', name: '布偶猫' },
  codex: { ring: 'ring-codex-primary', name: '缅因猫' },
  gemini: { ring: 'ring-gemini-primary', name: '暹罗猫' },
};

interface CatAvatarProps {
  catId: string;
  size?: number;
}

export function CatAvatar({ catId, size = 32 }: CatAvatarProps) {
  const [imgError, setImgError] = useState(false);
  const theme = CAT_THEME[catId];
  const ringClass = theme?.ring ?? 'ring-gray-300';

  return (
    <div
      className={`rounded-full ring-2 ${ringClass} overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center`}
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
