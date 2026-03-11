import type { StudyArtifact } from '@cat-cafe/shared';
import React, { useCallback, useEffect, useState } from 'react';
import { fetchPodcastScript, generatePodcast, type PodcastScript } from '@/utils/signals-api';

interface PodcastPlayerProps {
  readonly articleId: string;
  readonly podcasts: readonly StudyArtifact[];
  readonly onArtifactCreated?: () => void;
}

const SPEAKER_COLORS: Record<string, string> = {
  host: 'text-opus-dark bg-opus-bg',
  guest: 'text-emerald-700 bg-emerald-50',
  narrator: 'text-amber-700 bg-amber-50',
};

function speakerStyle(speaker: string): string {
  return SPEAKER_COLORS[speaker.toLowerCase()] ?? 'text-gray-700 bg-gray-100';
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function PodcastPlayer({ articleId, podcasts, onArtifactCreated }: PodcastPlayerProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [script, setScript] = useState<PodcastScript | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [activeSegment, setActiveSegment] = useState(-1);

  const readyPodcasts = podcasts.filter((p) => p.state === 'ready');
  const pendingPodcasts = podcasts.filter((p) => p.state === 'queued' || p.state === 'running');

  const loadScript = useCallback(
    async (artifactId: string) => {
      setLoading(true);
      setError(null);
      setScript(null);
      setActiveSegment(-1);
      try {
        const result = await fetchPodcastScript(articleId, artifactId);
        setScript(result.script);
        setSelectedId(artifactId);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load script');
      } finally {
        setLoading(false);
      }
    },
    [articleId],
  );

  const handleGenerate = useCallback(
    async (mode: 'essence' | 'deep') => {
      setGenerating(true);
      setError(null);
      try {
        await generatePodcast(articleId, mode);
        onArtifactCreated?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to generate');
      } finally {
        setGenerating(false);
      }
    },
    [articleId, onArtifactCreated],
  );

  // Reset state when articleId changes
  useEffect(() => {
    setSelectedId(null);
    setScript(null);
    setError(null);
    setActiveSegment(-1);
  }, [articleId]);

  // Auto-load first ready podcast
  useEffect(() => {
    if (!selectedId && readyPodcasts.length > 0) {
      void loadScript(readyPodcasts[0].id);
    }
  }, [selectedId, readyPodcasts, loadScript]);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-gray-500">播客脚本</h4>
        <div className="flex gap-1">
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleGenerate('essence')}
            className="rounded border border-opus-light px-2 py-0.5 text-[10px] text-opus-dark hover:bg-opus-bg disabled:opacity-50"
          >
            {generating ? '生成中...' : '精华版'}
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={() => void handleGenerate('deep')}
            className="rounded border border-gray-300 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            深度版
          </button>
        </div>
      </div>

      {pendingPodcasts.length > 0 && (
        <p className="mt-1 text-[10px] text-amber-600">{pendingPodcasts.length} 个播客正在生成中...</p>
      )}

      {readyPodcasts.length > 1 && (
        <div className="mt-1 flex gap-1">
          {readyPodcasts.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => void loadScript(p.id)}
              className={`rounded px-2 py-0.5 text-[10px] ${
                selectedId === p.id
                  ? 'bg-opus-primary text-white'
                  : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p.id.slice(0, 8)}
            </button>
          ))}
        </div>
      )}

      {error && <p className="mt-1 text-[10px] text-red-500">{error}</p>}
      {loading && <p className="mt-1 text-[10px] text-gray-400">加载中...</p>}

      {script && (
        <div className="mt-2 rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-1.5">
            <span className="text-[10px] text-gray-400">
              {script.mode === 'deep' ? '深度版' : '精华版'} · {script.segments.length} 段
            </span>
            <span className="text-[10px] text-gray-400">约 {formatDuration(script.totalDuration)}</span>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {script.segments.map((seg, i) => (
              <button
                key={`${seg.speaker}-${i}`}
                type="button"
                onClick={() => setActiveSegment(activeSegment === i ? -1 : i)}
                className={`flex w-full items-start gap-2 px-3 py-2 text-left transition-colors ${
                  activeSegment === i ? 'bg-opus-bg' : 'hover:bg-gray-50'
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${speakerStyle(seg.speaker)}`}
                >
                  {seg.speaker}
                </span>
                <span className="flex-1 text-xs text-gray-700">{seg.text}</span>
                <span className="shrink-0 text-[10px] text-gray-300">{formatDuration(seg.durationEstimate)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {!script && !loading && readyPodcasts.length === 0 && !error && (
        <p className="mt-1 text-[10px] text-gray-400">还没有播客脚本，点击上方按钮生成。</p>
      )}
    </div>
  );
}
