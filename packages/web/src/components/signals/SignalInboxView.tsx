'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import type { SignalArticle, SignalArticleStatus, SignalTier } from '@cat-cafe/shared';
import {
  deleteSignalArticle,
  fetchSignalArticle,
  fetchSignalStats,
  fetchSignalsInbox,
  searchSignals,
  type SignalArticleDetail,
  type SignalArticleStats,
  updateSignalArticle,
} from '@/utils/signals-api';
import { filterSignalArticles, type SignalArticleFilters } from '@/utils/signals-view';
import { BatchActionBar } from './BatchActionBar';
import { SignalArticleDetail as SignalArticleDetailPanel } from './SignalArticleDetail';
import { SignalArticleList } from './SignalArticleList';
import { SignalNav } from './SignalNav';
import { SignalStatsCards } from './SignalStatsCards';

const initialFilters: SignalArticleFilters = {
  query: '',
  status: 'all',
  source: 'all',
  tier: 'all',
};

function uniqueSources(items: readonly SignalArticle[]): readonly string[] {
  return Array.from(new Set(items.map((item) => item.source))).sort();
}

function toSignalTier(value: string | undefined): SignalTier | undefined {
  if (!value || value === 'all') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 4) return undefined;
  return parsed as SignalTier;
}

function toSignalStatus(value: FormDataEntryValue | null): SignalArticleStatus | undefined {
  if (typeof value !== 'string') return undefined;
  switch (value) {
    case 'inbox':
    case 'read':
    case 'starred':
    case 'archived':
      return value;
    default:
      return undefined;
  }
}

export function SignalInboxView() {
  const [items, setItems] = useState<readonly SignalArticle[]>([]);
  const [showServerSearchResults, setShowServerSearchResults] = useState(false);
  const [stats, setStats] = useState<SignalArticleStats | null>(null);
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<SignalArticleDetail | null>(null);
  const [filters, setFilters] = useState<SignalArticleFilters>(initialFilters);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchSelected, setBatchSelected] = useState<Set<string>>(new Set());

  const toggleBatchSelect = useCallback((articleId: string) => {
    setBatchSelected((prev) => {
      const next = new Set(prev);
      if (next.has(articleId)) next.delete(articleId);
      else next.add(articleId);
      return next;
    });
  }, []);

  const refreshInbox = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inboxItems, statsData] = await Promise.all([fetchSignalsInbox({ limit: 80 }), fetchSignalStats()]);
      setItems(inboxItems);
      setShowServerSearchResults(false);
      setStats(statsData);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshInbox();
  }, [refreshInbox]);

  const filteredItems = useMemo(
    () => (showServerSearchResults ? items : filterSignalArticles(items, filters)),
    [showServerSearchResults, items, filters],
  );
  const sources = useMemo(() => uniqueSources(items), [items]);

  const handleSearchSubmit = useCallback(async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    const query = filters.query.trim();
    if (query.length === 0) {
      await refreshInbox();
      return;
    }
    const formData = new FormData(event.currentTarget);
    const selectedStatus = formData.get('status');
    const selectedSource = formData.get('source');
    const selectedTier = formData.get('tier');

    setLoading(true);
    try {
      const result = await searchSignals(query, {
        limit: 80,
        status: toSignalStatus(selectedStatus),
        source:
          typeof selectedSource === 'string' && selectedSource !== 'all'
            ? selectedSource
            : undefined,
        tier: typeof selectedTier === 'string' ? toSignalTier(selectedTier) : undefined,
      });
      setItems(result.items);
      setShowServerSearchResults(true);
      setSelectedArticleId(null);
      setSelectedArticle(null);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : '搜索失败');
    } finally {
      setLoading(false);
    }
  }, [filters.query, refreshInbox]);

  const handleSelectArticle = useCallback(async (article: SignalArticle) => {
    setSelectedArticleId(article.id);
    setDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchSignalArticle(article.id);
      setSelectedArticle(detail);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : '加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleStatusChange = useCallback(async (articleId: string, status: SignalArticleStatus) => {
    setError(null);
    try {
      const updated = await updateSignalArticle(articleId, { status });
      setItems((current) => current.map((item) => (item.id === articleId ? updated : item)));
      setSelectedArticle((current) => (current && current.id === articleId ? updated : current));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '更新文章失败');
    }
  }, []);

  const handleTagsChange = useCallback(async (articleId: string, tags: readonly string[]) => {
    setError(null);
    try {
      const updated = await updateSignalArticle(articleId, { tags });
      setItems((current) => current.map((item) => (item.id === articleId ? updated : item)));
      setSelectedArticle((current) => (current && current.id === articleId ? updated : current));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '更新标签失败');
    }
  }, []);

  const handleNoteChange = useCallback(async (articleId: string, note: string) => {
    setError(null);
    try {
      const updated = await updateSignalArticle(articleId, { note });
      setItems((current) => current.map((item) => (item.id === articleId ? updated : item)));
      setSelectedArticle((current) => (current && current.id === articleId ? updated : current));
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '保存备注失败');
    }
  }, []);

  const handleDelete = useCallback(async (articleId: string) => {
    setError(null);
    try {
      await deleteSignalArticle(articleId);
      setItems((current) => current.filter((item) => item.id !== articleId));
      setSelectedArticle(null);
      setSelectedArticleId(null);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : '删除失败');
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-owner-bg via-cafe-white to-cafe-white">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <header className="rounded-2xl border border-owner-light bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-cafe-black">Signal Inbox</h1>
              <p className="text-sm text-gray-500">浏览、筛选和管理 F21 信号文章</p>
            </div>
            <SignalNav active="signals" />
          </div>
        </header>

        <form onSubmit={handleSearchSubmit} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid gap-2 md:grid-cols-5">
            <input
              value={filters.query}
              onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              placeholder="搜索标题、来源、标签..."
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
            />
            <select
              value={filters.status}
              onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value as SignalArticleFilters['status'] }))}
              name="status"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">状态: 全部</option>
              <option value="inbox">inbox</option>
              <option value="read">read</option>
              <option value="starred">starred</option>
              <option value="archived">archived</option>
            </select>
            <select
              value={filters.tier}
              onChange={(event) => setFilters((current) => ({ ...current, tier: event.target.value as SignalArticleFilters['tier'] }))}
              name="tier"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">Tier: 全部</option>
              <option value="1">Tier 1</option>
              <option value="2">Tier 2</option>
              <option value="3">Tier 3</option>
              <option value="4">Tier 4</option>
            </select>
            <select
              value={filters.source}
              onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value }))}
              name="source"
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
            >
              <option value="all">来源: 全部</option>
              {sources.map((source) => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="submit" className="rounded-lg bg-owner-primary px-3 py-2 text-sm font-semibold text-white hover:bg-owner-dark">
              搜索 / 刷新
            </button>
            <button type="button" onClick={() => void refreshInbox()} className="rounded-lg border border-owner-light px-3 py-2 text-sm text-owner-dark hover:bg-owner-bg">
              仅刷新 Inbox
            </button>
          </div>
        </form>

        <SignalStatsCards stats={stats} />

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">请求失败: {error}</div>}

        <section className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="space-y-2">
            <div className="text-sm text-gray-500">{loading ? '加载中...' : `共 ${filteredItems.length} 篇`}</div>
            <BatchActionBar
              selectedIds={batchSelected}
              onClear={() => setBatchSelected(new Set())}
              onComplete={() => void refreshInbox()}
            />
            <SignalArticleList
              items={filteredItems}
              selectedArticleId={selectedArticleId}
              onSelect={handleSelectArticle}
              onStatusChange={handleStatusChange}
              selectedIds={batchSelected}
              onToggleSelect={toggleBatchSelect}
            />
          </div>
          <SignalArticleDetailPanel
            article={selectedArticle}
            isLoading={detailLoading}
            onStatusChange={handleStatusChange}
            onTagsChange={handleTagsChange}
            onNoteChange={handleNoteChange}
            onDelete={handleDelete}
          />
        </section>
      </main>
    </div>
  );
}
