'use client';

import type { IntentCard, SourceTag, TriageBucket } from '@cat-cafe/shared';

interface GovernanceHealthProps {
  cards: IntentCard[];
}

const BUCKET_ORDER: TriageBucket[] = ['build_now', 'clarify_first', 'validate_first', 'challenge', 'later'];
const BUCKET_LABELS: Record<TriageBucket, string> = {
  build_now: 'Build Now',
  clarify_first: 'Clarify First',
  validate_first: 'Validate First',
  challenge: 'Challenge',
  later: 'Later',
};
const BUCKET_COLORS: Record<TriageBucket, string> = {
  build_now: 'bg-green-400',
  clarify_first: 'bg-yellow-400',
  validate_first: 'bg-orange-400',
  challenge: 'bg-red-400',
  later: 'bg-gray-300',
};

const SOURCE_TAGS: SourceTag[] = ['Q', 'O', 'D', 'R', 'A'];
const SOURCE_COLORS: Record<SourceTag, string> = {
  Q: 'bg-blue-400', O: 'bg-green-400', D: 'bg-purple-400', R: 'bg-teal-400', A: 'bg-red-400',
};

export function GovernanceHealth({ cards }: GovernanceHealthProps) {
  const total = cards.length;
  const triaged = cards.filter((c) => c.triage).length;
  const bucketCounts = BUCKET_ORDER.map((b) => ({
    bucket: b,
    count: cards.filter((c) => c.triage?.bucket === b).length,
  }));
  const sourceCounts = SOURCE_TAGS.map((t) => ({
    tag: t,
    count: cards.filter((c) => c.sourceTag === t).length,
  }));
  const riskCounts: Record<string, number> = {};
  for (const card of cards) {
    for (const signal of card.riskSignals) {
      riskCounts[signal] = (riskCounts[signal] ?? 0) + 1;
    }
  }
  const topRisks = Object.entries(riskCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Cards" value={`${triaged}/${total}`} sub="triaged" />
        <StatCard label="Build Now" value={String(bucketCounts[0]?.count ?? 0)} sub="ready" />
        <StatCard
          label="Unresolved"
          value={String(
            (bucketCounts.find((b) => b.bucket === 'clarify_first')?.count ?? 0) +
            (bucketCounts.find((b) => b.bucket === 'validate_first')?.count ?? 0),
          )}
          sub="需要确认"
        />
      </div>

      {/* Bucket distribution */}
      <div className="rounded-lg border border-[#E7DAC7] bg-[#FFFDF8] p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase text-[#9A866F]">Triage Distribution</div>
        {total === 0 ? (
          <div className="text-xs text-[#B8A88F]">尚无数据</div>
        ) : (
          <>
            <div className="mb-2 flex h-4 overflow-hidden rounded-full">
              {bucketCounts.filter((b) => b.count > 0).map((b) => (
                <div
                  key={b.bucket}
                  className={`${BUCKET_COLORS[b.bucket]}`}
                  style={{ width: `${(b.count / total) * 100}%` }}
                  title={`${BUCKET_LABELS[b.bucket]}: ${b.count}`}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-3 text-[10px] text-[#6B5D4F]">
              {bucketCounts.filter((b) => b.count > 0).map((b) => (
                <span key={b.bucket} className="flex items-center gap-1">
                  <span className={`inline-block h-2 w-2 rounded-full ${BUCKET_COLORS[b.bucket]}`} />
                  {BUCKET_LABELS[b.bucket]}: {b.count}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Source distribution */}
      <div className="rounded-lg border border-[#E7DAC7] bg-[#FFFDF8] p-3">
        <div className="mb-2 text-[10px] font-semibold uppercase text-[#9A866F]">Source Tag Distribution</div>
        <div className="flex gap-2">
          {sourceCounts.filter((s) => s.count > 0).map((s) => (
            <div key={s.tag} className="flex items-center gap-1 text-xs text-[#6B5D4F]">
              <span className={`inline-block h-2 w-2 rounded-full ${SOURCE_COLORS[s.tag]}`} />
              {s.tag}: {s.count}
            </div>
          ))}
          {sourceCounts.every((s) => s.count === 0) && (
            <div className="text-xs text-[#B8A88F]">尚无数据</div>
          )}
        </div>
      </div>

      {/* Top risks */}
      {topRisks.length > 0 && (
        <div className="rounded-lg border border-[#E7DAC7] bg-[#FFFDF8] p-3">
          <div className="mb-2 text-[10px] font-semibold uppercase text-[#9A866F]">Top Risk Signals</div>
          <div className="space-y-1">
            {topRisks.map(([signal, count]) => (
              <div key={signal} className="flex items-center justify-between text-xs">
                <span className="text-[#6B5D4F]">{signal.replace(/_/g, ' ')}</span>
                <span className="font-medium text-red-600">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-[#E7DAC7] bg-[#FFFDF8] p-3 text-center">
      <div className="text-lg font-bold text-[#2B2118]">{value}</div>
      <div className="text-[10px] font-medium text-[#9A866F]">{label}</div>
      <div className="text-[10px] text-[#B8A88F]">{sub}</div>
    </div>
  );
}
