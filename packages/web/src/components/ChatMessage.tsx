'use client';

import type { ChatMessage as ChatMessageType, MessageContent } from '@/stores/chatStore';
import { CatAvatar } from './CatAvatar';
import { MetadataBadge } from './MetadataBadge';
import { OwnerIcon } from './icons/OwnerIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

const CAT_STYLES: Record<string, {
  bg: string;
  border: string;
  name: string;
  label: string;
  radius: string;
  font?: string;
  mentionColor: string;
}> = {
  opus: {
    bg: 'bg-opus-bg',
    border: 'border-opus-light',
    name: '布偶猫',
    label: '布偶猫（Opus）',
    radius: 'rounded-2xl rounded-bl-sm',
    mentionColor: 'text-opus-primary',
  },
  codex: {
    bg: 'bg-codex-bg',
    border: 'border-codex-light',
    name: '缅因猫',
    label: '缅因猫（Codex）',
    radius: 'rounded-2xl rounded-br-sm',
    font: 'font-mono',
    mentionColor: 'text-codex-primary',
  },
  gemini: {
    bg: 'bg-gemini-bg',
    border: 'border-gemini-light',
    name: '暹罗猫',
    label: '暹罗猫（Gemini）',
    radius: 'rounded-2xl rounded-tr-sm',
    mentionColor: 'text-gemini-primary',
  },
};

/** All @mention patterns to highlight */
const MENTION_RE = /@(布偶猫?|缅因猫?|暹罗猫?|opus|codex|gemini)/gi;

const MENTION_TO_CAT: Record<string, string> = {
  '布偶': 'opus', '布偶猫': 'opus', 'opus': 'opus',
  '缅因': 'codex', '缅因猫': 'codex', 'codex': 'codex',
  '暹罗': 'gemini', '暹罗猫': 'gemini', 'gemini': 'gemini',
};

/** Render message content with @mention highlighting */
function renderContent(text: string) {
  const parts: (string | JSX.Element)[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  MENTION_RE.lastIndex = 0;
  while ((match = MENTION_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const catKey = MENTION_TO_CAT[match[1].toLowerCase()] ?? 'opus';
    const style = CAT_STYLES[catKey];
    parts.push(
      <span key={match.index} className={`font-semibold ${style?.mentionColor ?? 'text-owner-primary'}`}>
        {match[0]}
      </span>
    );
    lastIndex = MENTION_RE.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

/** Render rich contentBlocks (text + images) */
function renderContentBlocks(blocks: MessageContent[]) {
  return blocks.map((block, i) => {
    if (block.type === 'text') {
      return (
        <div key={i} className="whitespace-pre-wrap text-sm">
          {renderContent(block.text)}
        </div>
      );
    }
    if (block.type === 'image') {
      const src = block.url.startsWith('/uploads/')
        ? `${API_URL}${block.url}`
        : block.url;
      // Only allow safe schemes for window.open (prevent javascript: XSS)
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
  const cat = message.catId ? CAT_STYLES[message.catId] : null;
  const hasBlocks = message.contentBlocks && message.contentBlocks.length > 0;

  if (isSystem) {
    return (
      <div className="flex justify-center mb-3">
        <div className="text-sm text-red-500 bg-red-50 px-4 py-2 rounded-full">
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
              <div className="whitespace-pre-wrap text-sm">{renderContent(message.content)}</div>
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
            <div className={`whitespace-pre-wrap text-sm ${cat?.font ?? ''}`}>
              {renderContent(message.content)}
            </div>
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
