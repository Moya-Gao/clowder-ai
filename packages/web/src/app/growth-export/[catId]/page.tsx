'use client';

/**
 * F157 AC-A3: Growth Card Export Page
 *
 * Standalone page that renders a single CatProfileCard for Puppeteer screenshot.
 * ImageExporter navigates here, waits for data-export-ready="true", then captures.
 *
 * URL: /growth-export/:catId?export=true&userId=...
 */

import type { CatGrowthProfile } from '@cat-cafe/shared';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { CatProfileCard } from '@/components/growth/CatProfileCard';
import { apiFetch } from '@/utils/api-client';

export default function GrowthExportPage() {
  const { catId } = useParams<{ catId: string }>();
  const [profile, setProfile] = useState<CatGrowthProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!catId) return;
    apiFetch(`/api/growth/${catId}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          setError(body.error ?? `Failed to load profile (${res.status})`);
          return;
        }
        setProfile((await res.json()) as CatGrowthProfile);
      })
      .catch(() => setError('Network error'));
  }, [catId]);

  const ready = profile !== null;

  return (
    <div
      className="flex min-h-screen items-center justify-center bg-cafe-surface-elevated p-8"
      {...(ready ? { 'data-export-ready': 'true' } : {})}
    >
      {error ? (
        <div className="text-sm text-red-500">{error}</div>
      ) : profile ? (
        <div className="w-[400px]">
          <CatProfileCard profile={profile} />
        </div>
      ) : (
        <div className="text-sm text-cafe-muted">Loading...</div>
      )}
    </div>
  );
}
