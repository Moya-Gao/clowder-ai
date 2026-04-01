'use client';

import React, { useCallback, useState } from 'react';
import { apiFetch } from '@/utils/api-client';

export interface EvidenceSearchParams {
  q: string;
  mode?: 'lexical' | 'semantic' | 'hybrid';
  scope?: 'docs' | 'memory' | 'threads' | 'sessions' | 'all';
  depth?: 'summary' | 'raw';
  limit?: number;
}

interface SearchResultItem {
  title: string;
  anchor: string;
  snippet: string;
  confidence: string;
  sourceType: string;
  passages?: Array<{ text: string; score?: number }>;
}

interface SearchResponse {
  results: SearchResultItem[];
  degraded: boolean;
  degradeReason?: string;
}

export const DEPTH_OPTIONS = [
  { value: 'summary', label: 'Summary' },
  { value: 'raw', label: 'Raw (passages)' },
] as const;

/**
 * Pure: build search URL from params.
 */
export function buildSearchUrl(params: EvidenceSearchParams): string {
  const sp = new URLSearchParams();
  sp.set('q', params.q);
  if (params.mode) sp.set('mode', params.mode);
  if (params.scope) sp.set('scope', params.scope);
  if (params.depth) sp.set('depth', params.depth);
  if (params.limit) sp.set('limit', String(params.limit));
  return `/api/evidence/search?${sp.toString()}`;
}

/**
 * Pure: parse API response into display items.
 */
export function parseSearchResults(response: SearchResponse): SearchResultItem[] {
  if (response.degraded) return [];
  return response.results;
}

export function EvidenceSearch() {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<EvidenceSearchParams['mode']>('hybrid');
  const [scope, setScope] = useState<EvidenceSearchParams['scope']>(undefined);
  const [depth, setDepth] = useState<EvidenceSearchParams['depth']>(undefined);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setError(null);
    try {
      const url = buildSearchUrl({ q: query.trim(), mode, scope, depth });
      const res = await apiFetch(url);
      const data = (await res.json()) as SearchResponse;
      setResults(parseSearchResults(data));
    } catch {
      setError('Search failed');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [query, mode, scope, depth]);

  return (
    <div data-testid="evidence-search" className="space-y-4">
      {/* Search bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="搜索项目知识..."
          className="flex-1 rounded-lg border border-cafe bg-white px-3 py-2 text-sm text-cafe-black placeholder:text-cafe-secondary focus:border-cocreator-primary focus:outline-none"
          data-testid="evidence-search-input"
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={isSearching || !query.trim()}
          className="rounded-lg bg-cocreator-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-cocreator-dark disabled:opacity-40"
          data-testid="evidence-search-button"
        >
          {isSearching ? '...' : '搜索'}
        </button>
      </div>

      {/* Mode / Scope selectors */}
      <div className="flex gap-3 text-xs">
        <label className="flex items-center gap-1 text-cafe-secondary">
          Mode:
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as EvidenceSearchParams['mode'])}
            className="rounded border border-cafe bg-white px-1.5 py-0.5 text-xs"
          >
            <option value="hybrid">Hybrid</option>
            <option value="lexical">Lexical</option>
            <option value="semantic">Semantic</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-cafe-secondary">
          Scope:
          <select
            value={scope ?? 'all'}
            onChange={(e) =>
              setScope(e.target.value === 'all' ? undefined : (e.target.value as EvidenceSearchParams['scope']))
            }
            className="rounded border border-cafe bg-white px-1.5 py-0.5 text-xs"
          >
            <option value="all">All</option>
            <option value="docs">Docs</option>
            <option value="memory">Memory</option>
            <option value="threads">Threads</option>
            <option value="sessions">Sessions</option>
          </select>
        </label>
        <label className="flex items-center gap-1 text-cafe-secondary">
          Depth:
          <select
            value={depth ?? 'summary'}
            onChange={(e) =>
              setDepth(e.target.value === 'summary' ? undefined : (e.target.value as EvidenceSearchParams['depth']))
            }
            className="rounded border border-cafe bg-white px-1.5 py-0.5 text-xs"
          >
            {DEPTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Error */}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Results */}
      <div className="space-y-2">
        {results.map((item) => (
          <div key={item.anchor} className="rounded-lg border border-cafe bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="rounded bg-cocreator-light px-1.5 py-0.5 text-[10px] font-semibold text-cocreator-dark">
                {item.sourceType}
              </span>
              <h3 className="text-sm font-medium text-cafe-black">{item.title}</h3>
            </div>
            <p className="mt-1 text-xs text-cafe-secondary">{item.snippet}</p>
            {item.passages && item.passages.length > 0 && (
              <div className="mt-2 space-y-1 border-l-2 border-cocreator-light pl-2">
                {item.passages.map((p, i) => (
                  <p key={`${item.anchor}-p${i}`} className="text-xs text-cafe-secondary italic">
                    {p.text}
                    {p.score != null && (
                      <span className="ml-1 text-[10px] text-cafe-secondary/60">({p.score.toFixed(2)})</span>
                    )}
                  </p>
                ))}
              </div>
            )}
          </div>
        ))}
        {results.length === 0 && !isSearching && !error && query && (
          <p className="text-sm text-cafe-secondary">无结果</p>
        )}
      </div>
    </div>
  );
}
