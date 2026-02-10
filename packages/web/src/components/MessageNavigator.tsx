'use client';

import React, { useMemo, useState } from 'react';
import type { ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { scrollToMessage } from '@/utils/scrollToMessage';

const DOT_COLORS: Record<string, string> = {
  opus: 'bg-opus-primary',
  codex: 'bg-codex-primary',
  gemini: 'bg-gemini-primary',
};

const SENDER_NAMES: Record<string, string> = {
  opus: '布偶猫',
  codex: '缅因猫',
  gemini: '暹罗猫',
};

function getDotColor(msg: ChatMessageData): string {
  if (msg.type === 'user') return 'bg-owner-primary';
  if (msg.catId && DOT_COLORS[msg.catId]) return DOT_COLORS[msg.catId];
  return 'bg-gray-400';
}

function getSenderName(msg: ChatMessageData): string {
  if (msg.type === 'user') return '铲屎官';
  if (msg.catId && SENDER_NAMES[msg.catId]) return SENDER_NAMES[msg.catId];
  return '系统';
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function truncateContent(content: string, maxLen: number): string {
  if (content.length <= maxLen) return content;
  return content.slice(0, maxLen) + '…';
}

interface MessageNavigatorProps {
  messages: ChatMessageData[];
}

export function MessageNavigator({ messages }: MessageNavigatorProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // Only show user + assistant messages as dots
  const navItems = useMemo(
    () => messages
      .map((msg, originalIdx) => ({ msg, originalIdx }))
      .filter(({ msg }) => msg.type === 'user' || msg.type === 'assistant'),
    [messages],
  );

  if (navItems.length < 2) return null;

  return (
    <div className="absolute right-1 top-2 bottom-2 w-4 z-10">
      <div className="relative h-full">
        {navItems.map(({ msg }, idx) => {
          const top = navItems.length <= 1 ? 50 : (idx / (navItems.length - 1)) * 100;
          const color = getDotColor(msg);

          return (
            <button
              key={msg.id}
              className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-150 hover:scale-[2] ${color}`}
              style={{ top: `${top}%`, left: '50%' }}
              onClick={() => scrollToMessage(msg.id)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              aria-label={`跳转到 ${getSenderName(msg)} 的消息`}
            />
          );
        })}

        {hoveredIdx !== null && navItems[hoveredIdx] && (
          <NavTooltip
            message={navItems[hoveredIdx].msg}
            topPercent={
              navItems.length <= 1
                ? 50
                : (hoveredIdx / (navItems.length - 1)) * 100
            }
          />
        )}
      </div>
    </div>
  );
}

function NavTooltip({ message, topPercent }: { message: ChatMessageData; topPercent: number }) {
  return (
    <div
      className="absolute right-full mr-2 -translate-y-1/2 bg-gray-900/90 text-white text-xs rounded-lg px-2.5 py-1.5 max-w-[200px] pointer-events-none whitespace-nowrap z-50"
      style={{ top: `${topPercent}%` }}
    >
      <div className="font-medium">
        {getSenderName(message)} · {formatTime(message.timestamp)}
      </div>
      <div className="text-gray-300 truncate mt-0.5">
        {truncateContent(message.content, 40)}
      </div>
    </div>
  );
}
