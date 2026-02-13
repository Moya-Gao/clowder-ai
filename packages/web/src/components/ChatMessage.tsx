'use client';

import { useState, useEffect } from 'react';
import type { ChatMessage as ChatMessageType, MessageContent, ToolEvent } from '@/stores/chatStore';
import { CatAvatar } from './CatAvatar';
import { EvidencePanel } from './EvidencePanel';
import { MarkdownContent } from './MarkdownContent';
import { MetadataBadge } from './MetadataBadge';
import { SummaryCard } from './SummaryCard';
import { API_URL } from '@/utils/api-client';

const CAT_STYLES: Record<string, {
  bg: string;
  border: string;
  name: string;
  label: string;
  radius: string;
  font?: string;
}> = {
  opus: {
    bg: 'bg-opus-bg',
    border: 'border-opus-light',
    name: '布偶猫',
    label: '布偶猫（Opus）',
    radius: 'rounded-2xl rounded-bl-sm',
  },
  codex: {
    bg: 'bg-codex-bg',
    border: 'border-codex-light',
    name: '缅因猫',
    label: '缅因猫（Codex）',
    radius: 'rounded-2xl rounded-br-sm',
    font: 'font-mono',
  },
  gemini: {
    bg: 'bg-gemini-bg',
    border: 'border-gemini-light',
    name: '暹罗猫',
    label: '暹罗猫（Gemini）',
    radius: 'rounded-2xl rounded-tr-sm',
  },
};
function renderContentBlocks(blocks: MessageContent[]) {
  return blocks.map((block, i) => {
    if (block.type === 'text') {
      return <MarkdownContent key={i} content={block.text} />;
    }
    if (block.type === 'image') {
      const src = block.url.startsWith('/uploads/')
        ? `${API_URL}${block.url}`
        : block.url;
      const isSafeUrl = src.startsWith('/') || src.startsWith('http://') || src.startsWith('https://');
      return (
        <img
          key={i}
          src={src}
          alt="attached image"
          className="max-w-sm rounded-lg mt-2 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => isSafeUrl && window.open(src, '_blank', 'noopener')}
        />
      );
    }
    return null;
  });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function CollapsedToolView({ events }: { events: ToolEvent[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (events.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % events.length);
    }, 2000); // 每 2s 滚动一次
    return () => clearInterval(interval);
  }, [events.length]);

  const current = events[currentIndex];

  return (
    <div className="px-3 pb-2 overflow-hidden h-6 relative">
      <div
        key={currentIndex}
        className="font-mono text-xs text-gray-600 truncate absolute inset-0 flex items-center animate-fade-in"
      >
        <span className="mr-1.5">{current.type === 'tool_use' ? '🔧' : '📋'}</span>
        {current.label}
      </div>
    </div>
  );
}

function ExpandedToolView({ events }: { events: ToolEvent[] }) {
  return (
    <div className="px-3 pb-2 space-y-1">
      {events.map((event) => (
        <div key={event.id} className="font-mono text-[12px] leading-5 text-gray-600">
          <div className="flex items-start gap-1.5">
            <span className="mt-0.5">{event.type === 'tool_use' ? '🔧' : '📋'}</span>
            <div className="min-w-0">
              <div className="break-all">{event.label}</div>
              {event.detail && (
                <div className="text-[11px] text-gray-500 whitespace-pre-wrap break-all">
                  {event.detail}
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function ToolEventsPanel({ events }: { events: ToolEvent[] }) {
  const [collapsed, setCollapsed] = useState(true);

  if (events.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-black/10 bg-white/65">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-3 py-2 flex items-center justify-between hover:bg-black/5 transition-colors rounded-t-xl"
      >
        <span className="text-xs text-gray-600">
          {events.length} 个工具调用
        </span>
        <span className="text-gray-400 text-xs">{collapsed ? '▼' : '▲'}</span>
      </button>

      {collapsed ? (
        <CollapsedToolView events={events} />
      ) : (
        <ExpandedToolView events={events} />
      )}
    </div>
  );
}

function renderToolEvents(events: ToolEvent[]) {
  return <ToolEventsPanel events={events} />;
}

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isSummary = message.type === 'summary';
  const cat = message.catId ? CAT_STYLES[message.catId] : null;
  const hasBlocks = message.contentBlocks && message.contentBlocks.length > 0;
  const hasTextContent = message.content.trim().length > 0;
  const hasToolEvents = Boolean(message.toolEvents && message.toolEvents.length > 0);

  if (isSummary && message.summary) {
    return (
      <div data-message-id={message.id}>
        <SummaryCard
          topic={message.summary.topic}
          conclusions={message.summary.conclusions}
          openQuestions={message.summary.openQuestions}
          createdBy={message.summary.createdBy}
          timestamp={message.timestamp}
        />
      </div>
    );
  }

  if (isSystem) {
    if (message.variant === 'evidence' && message.evidence) {
      return <EvidencePanel data={message.evidence} />;
    }

    const isInfo = message.variant === 'info';
    const isTool = message.variant === 'tool';
    const isFollowup = message.variant === 'a2a_followup';
    return (
      <div data-message-id={message.id} className={`flex justify-center ${isTool ? 'mb-1' : 'mb-3'}`}>
        <div className={`text-sm px-4 py-2 rounded-lg whitespace-pre-wrap text-left max-w-[85%] ${
          isTool
            ? 'text-gray-400 bg-gray-50/50 font-mono text-xs py-1'
            : isFollowup
            ? 'text-purple-700 bg-purple-50 border border-purple-200'
            : isInfo
            ? 'text-blue-700 bg-blue-50'
            : 'text-red-500 bg-red-50 rounded-full'
        }`}>
          {isFollowup && <span className="mr-1">🔗</span>}
          {message.content}
          {isFollowup && (
            <span className="block mt-1 text-xs text-purple-500">
              输入 @猫名 跟进 来发起 follow-up
            </span>
          )}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div data-message-id={message.id} className="flex justify-end gap-2 mb-4 items-start">
        <div className="max-w-[75%]">
          <div className="flex justify-end items-center gap-2 mb-1">
            <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
            <span className="text-xs font-semibold text-owner-dark">铲屎官</span>
          </div>
          <div className="bg-owner-light text-owner-dark rounded-2xl rounded-br-sm px-4 py-3 transition-transform hover:-translate-y-0.5">
            {hasBlocks ? (
              renderContentBlocks(message.contentBlocks!)
            ) : (
              <MarkdownContent content={message.content} />
            )}
          </div>
        </div>
        <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-2 ring-owner-light bg-owner-primary flex items-center justify-center">
          <img
            src="/avatars/owner.jpg"
            alt="铲屎官"
            width={32}
            height={32}
            className="object-cover w-full h-full"
            onError={(e) => {
              // Fallback: hide broken image, show background color
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div data-message-id={message.id} className="flex gap-2 mb-4 items-start">
      {cat && <CatAvatar catId={message.catId!} size={32} status={message.isStreaming ? 'streaming' : undefined} />}
      <div className="max-w-[75%]">
        {cat && (
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold" style={{ opacity: 0.8 }}>
              {cat.label}
            </span>
            <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
          </div>
        )}
        <div
          className={`border px-4 py-3 transition-transform hover:-translate-y-0.5 ${
            cat
              ? `${cat.bg} ${cat.border} ${cat.radius} ${cat.font ?? ''}`
              : 'bg-white border-gray-200 rounded-2xl'
          }`}
        >
          {hasToolEvents && renderToolEvents(message.toolEvents!)}
          {hasBlocks ? (
            renderContentBlocks(message.contentBlocks!)
          ) : hasTextContent ? (
            <MarkdownContent content={message.content} className={cat?.font} />
          ) : !hasToolEvents && message.isStreaming ? (
            <span className="text-xs text-gray-500">思考中...</span>
          ) : (
            null
          )}
          {message.isStreaming && (
            <span className="inline-block w-1.5 h-4 bg-current animate-pulse ml-0.5 rounded-full opacity-50" />
          )}
        </div>
        {!message.isStreaming && message.metadata && (
          <MetadataBadge metadata={message.metadata} />
        )}
      </div>
    </div>
  );
}
