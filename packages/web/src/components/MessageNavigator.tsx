'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChatMessage as ChatMessageData } from '@/stores/chatStore';
import { scrollToMessage } from '@/utils/scrollToMessage';

/** Maximum dots rendered on the track — prevents clutter in long conversations */
const MAX_DOTS = 18;

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
  return new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function truncateContent(content: string, maxLen: number): string {
  return content.length <= maxLen ? content : content.slice(0, maxLen) + '…';
}

interface MessageNavigatorProps {
  messages: ChatMessageData[];
  scrollContainerRef: React.RefObject<HTMLElement | null>;
}

export function MessageNavigator({ messages, scrollContainerRef }: MessageNavigatorProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [viewport, setViewport] = useState({ top: 0, height: 1 });
  const trackRef = useRef<HTMLDivElement>(null);

  // Filter to user + assistant only
  const navItems = useMemo(
    () => messages.filter((m) => m.type === 'user' || m.type === 'assistant'),
    [messages],
  );

  // Sample at fixed intervals when too many messages
  const sampledItems = useMemo(() => {
    if (navItems.length <= MAX_DOTS) {
      return navItems.map((msg, i) => ({ msg, sourceIdx: i }));
    }
    const step = (navItems.length - 1) / (MAX_DOTS - 1);
    return Array.from({ length: MAX_DOTS }, (_, i) => {
      const idx = Math.round(i * step);
      return { msg: navItems[idx], sourceIdx: idx };
    });
  }, [navItems]);

  // Sync viewport indicator with scroll position
  const updateViewport = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) {
      setViewport({ top: 0, height: 1 });
      return;
    }
    setViewport({
      top: scrollTop / scrollHeight,
      height: clientHeight / scrollHeight,
    });
  }, [scrollContainerRef]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    updateViewport();
    el.addEventListener('scroll', updateViewport, { passive: true });
    return () => el.removeEventListener('scroll', updateViewport);
  }, [scrollContainerRef, updateViewport]);

  // Click on track background → scroll proportionally
  const handleTrackClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const track = trackRef.current;
      const container = scrollContainerRef.current;
      if (!track || !container) return;
      // Ignore clicks on dots (they handle their own onClick)
      if ((e.target as HTMLElement).tagName === 'BUTTON') return;
      const rect = track.getBoundingClientRect();
      const ratio = (e.clientY - rect.top) / rect.height;
      container.scrollTo({
        top: ratio * (container.scrollHeight - container.clientHeight),
        behavior: 'smooth',
      });
    },
    [scrollContainerRef],
  );

  if (navItems.length < 3) return null;

  return (
    <div className="absolute right-0.5 top-2 bottom-2 w-5 z-10">
      <div
        ref={trackRef}
        className="relative h-full cursor-pointer"
        onClick={handleTrackClick}
      >
        {/* Track rail */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-200 -translate-x-1/2" />

        {/* Viewport indicator (scrollbar thumb) */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-2.5 rounded-full bg-gray-300/50 transition-all duration-100 pointer-events-none"
          style={{
            top: `${viewport.top * 100}%`,
            height: `${Math.max(viewport.height * 100, 5)}%`,
          }}
        />

        {/* Sampled dots */}
        {sampledItems.map(({ msg, sourceIdx }, idx) => {
          const top = sampledItems.length <= 1
            ? 50
            : (idx / (sampledItems.length - 1)) * 100;
          const color = getDotColor(msg);

          return (
            <button
              key={`${msg.id}-${sourceIdx}`}
              className={`absolute w-2 h-2 rounded-full -translate-x-1/2 -translate-y-1/2 transition-all duration-150 hover:scale-[2] ${color}`}
              style={{ top: `${top}%`, left: '50%' }}
              onClick={() => scrollToMessage(msg.id)}
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              aria-label={`跳转到 ${getSenderName(msg)} 的消息`}
            />
          );
        })}

        {/* Tooltip */}
        {hoveredIdx !== null && sampledItems[hoveredIdx] && (
          <NavTooltip
            message={sampledItems[hoveredIdx].msg}
            topPercent={
              sampledItems.length <= 1
                ? 50
                : (hoveredIdx / (sampledItems.length - 1)) * 100
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
