import React, { useCallback, useMemo, useRef, useState } from 'react';
import type { SignalArticleStatus } from '@cat-cafe/shared';
import type { SignalArticleDetail } from '@/utils/signals-api';
import { SignalTierBadge } from './SignalTierBadge';
import { MarkdownContent } from '@/components/MarkdownContent';

interface SignalArticleDetailProps {
  readonly article: SignalArticleDetail | null;
  readonly isLoading: boolean;
  readonly onStatusChange: (articleId: string, status: SignalArticleStatus) => Promise<void>;
  readonly onTagsChange: (articleId: string, tags: readonly string[]) => Promise<void>;
}

function formatDate(input: string): string {
  const value = Date.parse(input);
  if (Number.isNaN(value)) {
    return input;
  }
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function SignalArticleDetail({ article, isLoading, onStatusChange, onTagsChange }: SignalArticleDetailProps) {
  const [pendingTag, setPendingTag] = useState('');
  const pendingTagInputRef = useRef<HTMLInputElement>(null);
  const normalizedPendingTag = pendingTag.trim();

  const discussedLink = useMemo(() => {
    if (!article) {
      return '/thread/default';
    }
    const query = new URLSearchParams({
      signal: article.id,
      source: article.source,
    });
    return `/thread/default?${query.toString()}`;
  }, [article]);

  const addPendingTag = useCallback(async () => {
    if (!article) {
      return;
    }
    const candidateTag = normalizedPendingTag.length > 0
      ? normalizedPendingTag
      : pendingTagInputRef.current?.value.trim() ?? '';
    if (candidateTag.length === 0) {
      return;
    }
    const hasExisting = article.tags.some((tag) => tag.toLowerCase() === candidateTag.toLowerCase());
    if (hasExisting) {
      setPendingTag('');
      return;
    }
    await onTagsChange(article.id, [...article.tags, candidateTag]);
    setPendingTag('');
    if (pendingTagInputRef.current) {
      pendingTagInputRef.current.value = '';
    }
  }, [article, normalizedPendingTag, onTagsChange]);

  if (isLoading) {
    return (
      <aside className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500 shadow-sm">
        正在加载文章详情...
      </aside>
    );
  }

  if (!article) {
    return (
      <aside className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
        选择一篇文章查看详情。
      </aside>
    );
  }

  return (
    <aside className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <SignalTierBadge tier={article.tier} />
        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600">{article.status}</span>
      </div>
      <h2 className="mt-2 text-lg font-semibold text-cafe-black">{article.title}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {article.source} · {formatDate(article.fetchedAt)}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <a
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-md border border-owner-light px-3 py-1.5 text-xs text-owner-dark hover:bg-owner-bg"
        >
          打开原文 ↗
        </a>
        <a
          href={discussedLink}
          className="rounded-md border border-opus-light px-3 py-1.5 text-xs text-opus-dark hover:bg-opus-bg"
        >
          在对话中讨论
        </a>
      </div>
      {article.summary && (
        <section className="mt-4 rounded-lg border border-owner-light bg-owner-bg p-3">
          <h3 className="text-xs font-semibold text-owner-dark">AI 摘要</h3>
          <p className="mt-1 whitespace-pre-wrap text-sm text-cafe-black">{article.summary}</p>
        </section>
      )}
      <section className="mt-4">
        <h3 className="text-xs font-semibold text-gray-600">正文</h3>
        <div className="mt-1 max-h-[300px] overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-cafe-black">
          <MarkdownContent content={article.content || '（无正文）'} />
        </div>
      </section>
      <section className="mt-4">
        <h3 className="text-xs font-semibold text-gray-600">标签</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {article.tags.length === 0 ? (
            <span className="text-xs text-gray-500">暂无标签</span>
          ) : (
            article.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-codex-light bg-codex-bg px-2 py-0.5 text-xs text-codex-dark"
              >
                {tag}
              </span>
            ))
          )}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            ref={pendingTagInputRef}
            value={pendingTag}
            onChange={(event) => setPendingTag(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void addPendingTag();
              }
            }}
            placeholder="添加标签"
            className="flex-1 rounded-md border border-gray-200 px-2 py-1.5 text-xs"
          />
          <button
            type="button"
            onClick={() => void addPendingTag()}
            className="rounded-md border border-codex-light px-2.5 py-1.5 text-xs text-codex-dark hover:bg-codex-bg"
          >
            添加标签
          </button>
        </div>
      </section>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onStatusChange(article.id, 'inbox')}
          className="rounded-md border border-owner-light px-3 py-1.5 text-xs text-owner-dark hover:bg-owner-bg"
        >
          设为 Inbox
        </button>
        <button
          type="button"
          onClick={() => void onStatusChange(article.id, 'read')}
          className="rounded-md border border-gray-200 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
        >
          标记已读
        </button>
        <button
          type="button"
          onClick={() => void onStatusChange(article.id, 'starred')}
          className="rounded-md border border-amber-200 px-3 py-1.5 text-xs text-amber-700 hover:bg-amber-50"
        >
          收藏
        </button>
      </div>
    </aside>
  );
}
