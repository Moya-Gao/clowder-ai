import { z } from 'zod';

const evalDomainFixtureSchema = z.object({
  id: z.string().min(1),
  featureId: z.string().regex(/^F\d{3}$/, 'featureId must match F followed by 3 digits'),
  path: z.string().min(1),
  skill: z.string().min(1).optional(),
  signal: z.string().min(1).optional(),
});

const evalDomainRegistryEntrySchema = z.object({
  domainId: z.enum([
    'eval:a2a',
    'eval:memory',
    'eval:sop',
    'eval:capability-wakeup',
    'eval:task-outcome',
    'eval:friction',
  ]),
  displayName: z.string().min(1),
  systemThreadId: z.string().min(1, 'systemThreadId is required'),
  evalCat: z.object({
    catId: z.string().min(1),
    handle: z.string().min(1),
    model: z.string().min(1),
  }),
  frequency: z.enum(['daily', 'weekly']),
  sourceAdapter: z.enum([
    'f167-runtime-eval',
    'f200-f188-memory-eval',
    'sop-trace-eval',
    'capability-wakeup-eval',
    'task-outcome-eval',
    'f245-friction-rollup',
  ]),
  threadPolicy: z.object({
    role: z.literal('working-home'),
    stateSot: z.literal('registry'),
    allowedContent: z.array(z.enum(['longitudinal-analysis', 'verdict-discussion', 'handoff-drafts'])).min(1),
  }),
  legacyScheduledTaskIds: z.array(z.string().min(1)),
  handoffTargetResolver: z.object({
    featureId: z.string().regex(/^F\d{3}$/, 'featureId must match F followed by 3 digits'),
    ownerCatId: z.string().min(1),
    threadLookup: z.literal('feature-thread'),
  }),
  sla: z.object({
    acknowledgeHours: z.number().int().positive('acknowledgeHours must be positive'),
    reevalWithinHours: z.number().int().positive('reevalWithinHours must be positive'),
  }),
  fixtures: z.array(evalDomainFixtureSchema).default([]),
  /**
   * Sunset flag. When `false`, `loadRegisteredDomains` skips this domain
   * from scheduled eval cron pickup (no invocation message lands in the
   * domain thread). Default `true`.
   *
   * Use this to silently retire a domain's auto-schedule without deleting
   * the registry entry — preserves SLA / handoffTargetResolver / threadPolicy
   * config for future re-enable (just remove the field or set `true`).
   *
   * Set to `false` when:
   * - The domain's verdict generator isn't wired (cron fires would produce
   *   empty invocations with no verdict — silent-broken).
   * - The domain is being intentionally paused while rules / wiring are reworked.
   *
   * Set on 2026-06-06 for `eval:sop` (silent-fire root cause: missing
   * sourceAdapter trace producer + missing publish_verdict generator wiring
   * — F192 doc §323 "需先加 file-writer 层 ~100-150 行"). Re-enable when
   * those gaps are closed.
   */
  enabled: z.boolean().default(true),
});

export type EvalDomainRegistryEntry = z.infer<typeof evalDomainRegistryEntrySchema>;

/**
 * Single source of truth for the set of registered eval domain ids.
 * Derived from the registry schema enum — consumers (scheduler opts, manual
 * trigger casts, wired-publish sets) should reference THIS type instead of
 * hand-writing the union, so adding a domain (e.g. F245 `eval:friction`) only
 * edits the enum, not every downstream site.
 */
export type EvalDomainId = EvalDomainRegistryEntry['domainId'];

export function parseEvalDomainRegistryEntry(input: unknown): EvalDomainRegistryEntry {
  return evalDomainRegistryEntrySchema.parse(input);
}

export function parseEvalDomainRegistryFile(input: unknown): EvalDomainRegistryEntry {
  return parseEvalDomainRegistryEntry(input);
}
