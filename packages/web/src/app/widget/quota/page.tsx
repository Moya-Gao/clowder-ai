import type { Metadata } from 'next';
import { QuotaSummaryWidget } from '@/components/QuotaSummaryWidget';

export const metadata: Metadata = {
  title: 'Cat Cafe · Quota Widget',
  description: 'F051 Phase 5 quota summary widget',
};

export default function QuotaWidgetPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-slate-100 px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <QuotaSummaryWidget />
      </div>
    </main>
  );
}
