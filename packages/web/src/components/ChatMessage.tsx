'use client';

import type { ChatMessage as ChatMessageType, MessageContent } from '@/stores/chatStore';
import { CatAvatar } from './CatAvatar';
import { EvidencePanel } from './EvidencePanel';
import { MarkdownContent } from './MarkdownContent';
import { MetadataBadge } from './MetadataBadge';
import { SummaryCard } from './SummaryCard';
import { OwnerIcon } from './icons/OwnerIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

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

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.type === 'user';
  const isSystem = message.type === 'system';
  const isSummary = message.type === 'summary';
  const cat = message.catId ? CAT_STYLES[message.catId] : null;
  const hasBlocks = message.contentBlocks && message.contentBlocks.length > 0;

  if (isSummary && message.summary) {
    return (
      <SummaryCard
        topic={message.summary.topic}
        conclusions={message.summary.conclusions}
        openQuestions={message.summary.openQuestions}
        createdBy={message.summary.createdBy}
        timestamp={message.timestamp}
      />
    );
  }

  if (isSystem) {
    if (message.variant === 'evidence' && message.evidence) {
      return <EvidencePanel data={message.evidence} />;
    }

    const isInfo = message.variant === 'info';
    const isTool = message.variant === 'tool';
    return (
      <div className={`flex justify-center ${isTool ? 'mb-1' : 'mb-3'}`}>
        <div className={`text-sm px-4 py-2 rounded-lg whitespace-pre-wrap text-left max-w-[85%] ${
          isTool
            ? 'text-gray-400 bg-gray-50/50 font-mono text-xs py-1'
            : isInfo
            ? 'text-blue-700 bg-blue-50'
            : 'text-red-500 bg-red-50 rounded-full'
        }`}>
          {message.content}
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end gap-2 mb-4 items-start">
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
        <div className="w-8 h-8 rounded-full bg-owner-primary flex items-center justify-center flex-shrink-0 ring-2 ring-owner-light">
          <OwnerIcon className="w-4 h-4 text-white" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2 mb-4 items-start">
      {cat && <CatAvatar catId={message.catId!} size={32} />}
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
          {hasBlocks ? (
            renderContentBlocks(message.contentBlocks!)
          ) : (
            <MarkdownContent content={message.content} className={cat?.font} />
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
