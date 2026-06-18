'use client';

import {
  buildConciergeDraftPrompt,
  type CapabilityTip,
  type CapabilityTipAudience,
  type CapabilityTipContext,
  type CapabilityTipSurface,
  selectCapabilityTip,
  validateCapabilityTipInventory,
} from '@cat-cafe/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import rawTips from '@/lib/capability-tips.seed.json';
import { recordCapabilityTipEvent } from '@/lib/capabilityTipEvents';
import { useConciergeStore } from '@/stores/conciergeStore';

const parsedInventory = validateCapabilityTipInventory(rawTips);
if (!parsedInventory.success) {
  throw new Error(`Invalid F244 capability tips inventory:\n${parsedInventory.errors.join('\n')}`);
}

const CAPABILITY_TIPS: readonly CapabilityTip[] = parsedInventory.tips ?? [];
const DEFAULT_FIRST_DELAY_MS = 6000;
const DEFAULT_ROTATE_MS = 12000;

function canRenderInTipStrip(tip: CapabilityTip): boolean {
  return tip.action?.type === 'open_concierge_draft';
}

const CAPABILITY_TIP_STRIP_TIPS: readonly CapabilityTip[] = CAPABILITY_TIPS.filter(canRenderInTipStrip);

interface CapabilityTipStripProps {
  surface: CapabilityTipSurface;
  contexts: CapabilityTipContext[];
  audience?: CapabilityTipAudience;
  enabled?: boolean;
  firstDelayMs?: number;
  rotateMs?: number;
}

export function CapabilityTipStrip({
  surface,
  contexts,
  audience,
  enabled = true,
  firstDelayMs = DEFAULT_FIRST_DELAY_MS,
  rotateMs = DEFAULT_ROTATE_MS,
}: CapabilityTipStripProps) {
  const [visible, setVisible] = useState(false);
  const [rotationKey, setRotationKey] = useState(0);
  const exposedKeyRef = useRef<string | null>(null);
  const setSurfaceState = useConciergeStore((s) => s.setSurfaceState);

  useEffect(() => {
    setVisible(false);
    setRotationKey(0);
    exposedKeyRef.current = null;
    if (!enabled || contexts.length === 0) return;

    const showTimer = setTimeout(() => setVisible(true), Math.max(0, firstDelayMs));
    const rotationTimer = setInterval(
      () => {
        setRotationKey((value) => value + 1);
      },
      Math.max(DEFAULT_ROTATE_MS, rotateMs),
    );

    return () => {
      clearTimeout(showTimer);
      clearInterval(rotationTimer);
    };
  }, [enabled, contexts, firstDelayMs, rotateMs]);

  const tip = useMemo(
    () => selectCapabilityTip(CAPABILITY_TIP_STRIP_TIPS, { contexts, audience, rotationKey }),
    [audience, contexts, rotationKey],
  );
  const matchedContext = useMemo(
    () => (tip ? contexts.find((context) => tip.contexts.includes(context)) : undefined),
    [contexts, tip],
  );

  useEffect(() => {
    if (!visible || !tip || !matchedContext) return;
    const exposureKey = `${surface}:${tip.id}:${rotationKey}`;
    if (exposedKeyRef.current === exposureKey) return;
    exposedKeyRef.current = exposureKey;
    recordCapabilityTipEvent({
      event: 'capability_tip_exposed',
      tipId: tip.id,
      context: matchedContext,
      surface,
      outcome: 'shown',
      timestamp: Date.now(),
    });
  }, [matchedContext, rotationKey, surface, tip, visible]);

  if (!enabled || !visible || !tip || !matchedContext) return null;

  const openDraft = () => {
    setSurfaceState('bubble', buildConciergeDraftPrompt(tip));
    recordCapabilityTipEvent({
      event: 'capability_tip_action',
      tipId: tip.id,
      context: matchedContext,
      surface,
      actionType: 'open_concierge_draft',
      outcome: 'opened',
      timestamp: Date.now(),
    });
  };

  return (
    <div
      data-testid="capability-tip-strip"
      data-tip-id={tip.id}
      className="mx-4 mb-1.5 flex min-h-8 items-center gap-2 rounded-md border border-cafe bg-cafe-surface-elevated px-2.5 py-1.5 text-xs text-cafe-muted"
    >
      <span className="shrink-0 font-medium text-cafe-secondary">Tip</span>
      <span className="min-w-0 flex-1 truncate">{tip.body}</span>
      <button
        type="button"
        data-testid="capability-tip-learn-more"
        onClick={openDraft}
        title="了解更多：打开猫猫球并预填输入框，不会自动发送"
        className="shrink-0 rounded-md border border-cafe px-2 py-1 text-xs font-medium text-cafe-secondary transition-colors hover:border-cafe-accent hover:text-cafe-accent"
      >
        了解更多
      </button>
    </div>
  );
}
