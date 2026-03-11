'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useChatStore, type ChatMessage as ChatMessageType, type MessageContent, type ToolEvent } from '@/stores/chatStore';
import { CatAvatar } from './CatAvatar';
import { ConnectorBubble } from './ConnectorBubble';
import { EvidencePanel } from './EvidencePanel';
import { MarkdownContent } from './MarkdownContent';
import { MetadataBadge } from './MetadataBadge';
import { RichBlocks } from './rich/RichBlocks';
import { SummaryCard } from './SummaryCard';
import { useTts, type TtsState } from '@/hooks/useTts';
import type { CatData } from '@/hooks/useCatData';
import { hexToRgba } from '@/lib/color-utils';
import { API_URL } from '@/utils/api-client';
import { Lightbox } from './Lightbox';

/** Breed-level aesthetics — only changes when a new BREED is added */
const BREED_STYLES: Record<string, { radius: string; font?: string }> = {
  ragdoll: { radius: 'rounded-2xl rounded-bl-sm' },
  'maine-coon': { radius: 'rounded-2xl rounded-br-sm', font: 'font-mono' },
  siamese: { radius: 'rounded-2xl rounded-tr-sm' },
  'dragon-li': { radius: 'rounded-lg rounded-tl-sm', font: 'font-mono' },
};
const DEFAULT_BREED_STYLE = { radius: 'rounded-2xl' };

function ContentBlocks({ blocks }: { blocks: MessageContent[] }) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'text') {
          return <MarkdownContent key={i} content={block.text} />;
        }
        if (block.type === 'image') {
          const src = block.url.startsWith('/uploads/')
            ? `${API_URL}${block.url}`
            : block.url;
          return (
            // biome-ignore lint/performance/noImgElement: uploaded images cannot use next/image
            <img
              key={i}
              src={src}
              alt="attached image"
              className="max-w-full sm:max-w-sm rounded-lg mt-2 border border-gray-200 cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => setLightboxSrc(src)}
            />
          );
        }
        return null;
      })}
      {lightboxSrc && (
        <Lightbox url={lightboxSrc} alt="attached image" onClose={() => setLightboxSrc(null)} />
      )}
    </>
  );
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
  const hasMounted = useRef(false);

  // Cloud P2: local UI toggles can change scrollHeight without scroll/resize events.
  // Emit after DOM commit so scroll-dependent UI (e.g. "↓ 到最新") can recompute.
  useLayoutEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('catcafe:chat-layout-changed'));
    }
  }, [collapsed]);

  if (events.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-black/10 bg-white/65">
      <button
        onClick={() => setCollapsed((v) => !v)}
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

/** Collapsible wrapper for stream-origin messages (cat's inner thinking/CLI output) */
function ThinkingContent({ content, className, label = '💭 心里话', defaultExpanded = false, expandInExport = true }: { content: string; className?: string; label?: string; defaultExpanded?: boolean; expandInExport?: boolean }) {
  const isExport = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('export') === 'true';
  const shouldExpand = (isExport && expandInExport) || defaultExpanded;
  const [expanded, setExpanded] = useState(shouldExpand);
  const hasMounted = useRef(false);
  // Sync with global UI preference: when defaultExpanded changes, update all blocks
  useEffect(() => {
    setExpanded((isExport && expandInExport) || defaultExpanded);
  }, [isExport, expandInExport, defaultExpanded]);
  // Notify scroll-dependent UI (e.g. "↓ 到最新") after the DOM has updated.
  useLayoutEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('catcafe:chat-layout-changed'));
    }
  }, [expanded]);
  const previewLength = 60;
  const preview = content.length > previewLength
    ? `${content.slice(0, previewLength)}…`
    : content;

  return (
    <div>
      <button
        onClick={() => {
          setExpanded((v) => !v);
        }}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors mb-1"
      >
        <span className="text-[10px]" style={{ transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)', display: 'inline-block', transition: 'transform 0.15s' }}>▶</span>
        <span>{label}</span>
        {!expanded && <span className="text-gray-400 truncate max-w-[200px]">{preview}</span>}
      </button>
      {expanded && (
        <div className="border-l-2 border-gray-300 pl-3 opacity-80">
          <MarkdownContent content={content} className={className} />
        </div>
      )}
    </div>
  );
}

/** F34: Tiny TTS play button for cat messages */
function TtsPlayButton({ messageId, text, catId, ttsState, activeMessageId, onSynthesize }: {
  messageId: string; text: string; catId: string;
  ttsState: TtsState; activeMessageId: string | null;
  onSynthesize: (messageId: string, text: string, catId?: string) => void;
}) {
  const isActive = activeMessageId === messageId;
  const isLoading = isActive && ttsState === 'loading';
  const isPlaying = isActive && ttsState === 'playing';

  return (
    <button
      onClick={() => onSynthesize(messageId, text, catId)}
      disabled={isLoading}
      className="opacity-0 group-hover:opacity-100 transition-opacity ml-1 p-0.5 rounded hover:bg-black/5 text-gray-400 hover:text-gray-600"
      title={isPlaying ? '停止' : '播放语音'}
    >
      {isLoading ? (
        <svg width="12" height="12" viewBox="0 0 12 12" className="animate-spin">
          <circle cx="6" cy="6" r="5" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="20 10" />
        </svg>
      ) : isPlaying ? (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <rect x="2" y="1" width="3" height="10" rx="0.5" />
          <rect x="7" y="1" width="3" height="10" rx="0.5" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
          <path d="M2.5 1L10.5 6L2.5 11V1Z" />
        </svg>
      )}
    </button>
  );
}

interface ChatMessageProps {
  message: ChatMessageType;
  getCatById: (id: string) => CatData | undefined;
}

export function ChatMessage({ message, getCatById }: ChatMessageProps) {
  const router = useRouter();
  const { state: ttsState, synthesize: ttsSynthesize, activeMessageId } = useTts();
  const threads = useChatStore((s) => s.threads);
  const uiThinkingExpandedByDefault = useChatStore((s) => s.uiThinkingExpandedByDefault);
  const isUser = message.type === 'user' && !message.catId;
  const isSystem = message.type === 'system';
  const isSummary = message.type === 'summary';
  const isConnector = message.type === 'connector';

  // Dynamic cat data lookup — works for any catId in cat-config.json
  const catData = message.catId ? getCatById(message.catId) : undefined;
  const catStyle = catData ? (() => {
    const breed = BREED_STYLES[catData.breedId ?? ''] ?? DEFAULT_BREED_STYLE;
    const idLabel = catData.id.charAt(0).toUpperCase() + catData.id.slice(1);
    const label = catData.variantLabel
      ? `${catData.displayName}（${catData.variantLabel}）`
      : `${catData.displayName}（${idLabel}）`;
    return {
      label,
      radius: breed.radius,
      font: breed.font,
      bgColor: catData.color.secondary,
      borderColor: hexToRgba(catData.color.primary, 0.3),
    };
  })() : null;
  const hasBlocks = message.contentBlocks && message.contentBlocks.length > 0;
  const hasTextContent = message.content.trim().length > 0;
  const hasToolEvents = Boolean(message.toolEvents && message.toolEvents.length > 0);
  const isWhisper = message.visibility === 'whisper';
  const isRevealed = isWhisper && !!message.revealedAt;

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

    // F045: variant='thinking' is deprecated — thinking is now embedded in assistant bubbles.
    // Legacy standalone thinking messages fall through to normal system rendering.

    const isLegacyError = !message.variant && message.content.trim().startsWith('Error:');
    const isError = message.variant === 'error' || isLegacyError;
    const isTool = message.variant === 'tool';
    const isFollowup = message.variant === 'a2a_followup';
    const toneClass = isTool
      ? 'text-gray-400 bg-gray-50/50 font-mono text-xs py-1'
      : isFollowup
      ? 'text-purple-700 bg-purple-50 border border-purple-200'
      : isError
      ? 'text-red-500 bg-red-50 rounded-full'
      : 'text-blue-700 bg-blue-50';
    return (
      <div data-message-id={message.id} className={`flex justify-center ${isTool ? 'mb-1' : 'mb-3'}`}>
        <div className={`text-sm px-4 py-2 rounded-lg whitespace-pre-wrap text-left max-w-[85%] ${toneClass}`}>
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

  if (isConnector && message.source) {
    return <ConnectorBubble message={message} />;
  }

  if (isUser) {
    return (
      <div data-message-id={message.id} className="flex justify-end gap-2 mb-4 items-start">
        <div className="max-w-[75%]">
          <div className="flex justify-end items-center gap-2 mb-1">
            {isWhisper && (
              <span className={`text-xs px-1.5 py-0.5 rounded ${isRevealed ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-600'}`}>
                {isRevealed ? '已揭秘' : `悄悄话 → ${message.whisperTo?.join(', ') ?? ''}`}
              </span>
            )}
            <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
            <span className="text-xs font-semibold text-owner-dark">铲屎官</span>
          </div>
          <div className={`rounded-2xl rounded-br-sm px-4 py-3 transition-transform hover:-translate-y-0.5 ${
            isWhisper && !isRevealed
              ? 'bg-amber-50 text-amber-900 border border-dashed border-amber-300'
              : 'bg-owner-light text-owner-dark'
          }`}>
            {hasBlocks ? (
              <ContentBlocks blocks={message.contentBlocks!} />
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
    <div data-message-id={message.id} className="group flex gap-2 mb-4 items-start">
      {catData && <CatAvatar catId={message.catId!} size={32} status={message.isStreaming ? 'streaming' : undefined} />}
      <div className="max-w-[85%] md:max-w-[75%] min-w-0">
        {catStyle && (
          <div className="mb-1 flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold" style={{ opacity: 0.8 }}>
                {catStyle.label}
              </span>
              <span className="text-xs text-gray-400">{formatTime(message.timestamp)}</span>
              {isWhisper && (
                <span className={`text-xs px-1.5 py-0.5 rounded ${isRevealed ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-600'}`}>
                  {isRevealed ? '已揭秘' : '悄悄话'}
                </span>
              )}
              {hasTextContent && !message.isStreaming && (
                <TtsPlayButton
                  messageId={message.id}
                  text={message.content}
                  catId={message.catId!}
                  ttsState={ttsState}
                  activeMessageId={activeMessageId}
                  onSynthesize={ttsSynthesize}
                />
              )}
            </div>
            {message.extra?.crossPost && (() => {
              const sourceId = message.extra.crossPost!.sourceThreadId;
              const sourceName = threads.find((t) => t.id === sourceId)?.title ?? '未命名对话';
              const shortId = sourceId.replace(/^thread_/, '').slice(0, 8);
              const senderLabel = catStyle?.label;
              return (
                <a
                  href={`/thread/${sourceId}`}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); router.push(`/thread/${sourceId}`); }}
                  className="inline-flex items-center gap-1.5 border px-3 py-1 rounded-full bg-[#FDF6ED] border-[#E8DCCF] text-[#8D6E63] hover:bg-[#F5EDE0] transition-colors cursor-pointer w-fit max-w-full"
                  title={sourceId}
                  aria-label={`跳转到来源 thread ${sourceId}`}
                >
                  <span className="text-[10px] font-semibold" aria-hidden>📮</span>
                  <span className="min-w-0 truncate">
                    {senderLabel && <span className="font-medium">{senderLabel} · </span>}{shortId} · {sourceName}
                  </span>
                </a>
              );
            })()}
          </div>
        )}
        <div
          className={`border px-4 py-3 transition-transform hover:-translate-y-0.5 overflow-hidden ${
            catStyle
              ? `${catStyle.radius} ${catStyle.font ?? ''}`
              : 'bg-white border-gray-200 rounded-2xl'
          }`}
          style={catStyle ? {
            backgroundColor: catStyle.bgColor,
            borderColor: catStyle.borderColor,
          } : undefined}
        >
          {hasToolEvents && renderToolEvents(message.toolEvents!)}
          {message.thinking && (
            <ThinkingContent content={message.thinking} className={catStyle?.font} label="🧠 Thinking" defaultExpanded={uiThinkingExpandedByDefault} expandInExport={false} />
          )}
          {message.origin === 'stream' && hasTextContent && !message.isStreaming ? (
            <ThinkingContent content={message.content} className={catStyle?.font} defaultExpanded={uiThinkingExpandedByDefault} />
          ) : hasBlocks ? (
            <ContentBlocks blocks={message.contentBlocks!} />
          ) : hasTextContent ? (
            <MarkdownContent content={message.content} className={catStyle?.font} />
          ) : !hasToolEvents && message.isStreaming ? (
            <span className="text-xs text-gray-500">思考中...</span>
          ) : (
            null
          )}
          {message.extra?.rich?.blocks && message.extra.rich.blocks.length > 0 && (
            <RichBlocks blocks={message.extra.rich.blocks} catId={message.catId} messageId={message.id} />
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
