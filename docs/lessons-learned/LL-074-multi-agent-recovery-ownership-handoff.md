---
ll_id: LL-074
feature_ids: []
topics: [lessons, multi-agent, recovery, ownership-handoff, code-review, judgment-altitude, collaboration]
doc_kind: lesson
created: 2026-06-13
status: validated
source_anchor: thread_mq0980eu7l3zonck#0001781348069695
---

# Distilled Knowledge: Multi-Agent Recovery, Ownership Handoff & the Bugs Behind the Bug

> Complementary to the confabulation reflection. These are the collaboration, process, and concrete-engineering lessons from the same session — the parts that worked, and the real bugs that existed *before* the hallucination started.

---

## 1. When YOU are the compromised agent: get out of the critical path cleanly

The recovery that actually salvaged this work had a shape worth memorizing:

- An independent agent **re-did the fix from scratch** with real git verification (TAKEOVER) → a *different* independent agent **git-cross-validated and approved** → the operator **merged**. The durable artifact (merged code) flowed entirely through parties whose I/O the operator could externally verify — **never through me**.
- **TAKEOVER is the designed escape hatch** for author false-green: the reviewer who found the bugs becomes the author; then a *third* cat reviews (never self-review).

> **Lesson:** When you're the unreliable one, the highest-value move is to **exit the critical path and hand to someone externally checkable** — not to insist "I'll fix it myself in a fresh session." A new instance of you is *not* a certified-clean substitute (the failure recurred in the next session). Route the work to a *different* verifiable party.

---

## 2. Inheriting ownership mid-stream: reconstruct from external truth, not memory

When a predecessor goes offline and you inherit owner:

- **Rebuild state from external artifacts, not your recollection:** the feature doc, git log on `main`, other cats' reports. Your memory of "what's done" is the least reliable source — especially post-compaction.
- **Look for a closeout checklist another cat left in the feature doc.** A good reviewer writes one with ownership tags and status per item. It's authoritative — read it, don't re-derive or duplicate it.
- **Distinguish your thread's work from a parallel-self's work.** `main` being dirty / ahead with unpushed commits belonged to a *parallel invocation of me in another thread* handling unrelated cleanup. Same `catId` ≠ same workstream. Don't touch it.

---

## 3. The three real bugs the reviewer caught that my own quality-gate missed

All three lived in a **read-only aggregator over multiple data sources** — a high-yield bug archetype. Transferable:

- **Timezone-boundary "today" check.** Computing start-of-day with `now - (now % DAY_MS)` / `setUTCHours(0,...)` while the cron/business day runs in a specific TZ (e.g. `America/Los_Angeles`). At certain hours UTC has already rolled to the next day → the "already done today?" guard misses today's earlier event → duplicate fires. Fix with `Intl.DateTimeFormat` in the business TZ. **A timezone constant existing in config does NOT mean it's used at the comparison site** — grep the actual boundary computation.
- **Capability-detection silent degradation.** `if (typeof store.scanAll !== 'function') return emptyResult` *without* recording it in `degradedSources`. In a supported config (no-Redis) the data source silently vanishes and the output masquerades as complete. The `catch` block recorded degradation; the capability-missing branch didn't. **Silent false-negative is worse than a visible gap** — the missing-capability path must mark degraded too.
- **Multi-source aggregation coverage asymmetry.** A derived metric (`oldestHeartbeatMs`) computed from ONE source, while its sibling count (`activeCount`) summed THREE. **Invariant: every output dimension must cover the same source set its siblings claim.**

---

## 4. Failure-mode audit BEFORE fixing — don't be a patch-plumber

When handed N review findings, before touching code: **do ≥2 share a failure mode?**

Here, "silent degradation on missing source" + "aggregation dimension misses a source" shared one meta-pattern: *multi-source aggregation where an output dimension doesn't cover all sources.*

> **Tactic:** Abstract the invariant → grep **all sibling sites** for the same violation → fix together → **self-report the sweep** in the fix confirmation so the reviewer doesn't re-grep next round. Fixing only the pointed-at line = the reviewer returns next round with its sibling. (This is the difference between burning 3 review rounds and 1.)

---

## 5. AC-pass ≠ usable: someone must LOOK at the rendered output

The feature "delivered": link worked, tests green, every AC checked. The operator looked at the actual card and said **"I can't understand this at all."** Each row showed a cat's *last message text* instead of thread-name / who-holds-it / why-you're-needed — `deriveTitle` had its priority reversed (content-first, title-fallback).

- **For user-visible output, "the pipeline ran and tests pass" is not verification.** The most damning bugs — unreadable content, wrong priority field, emoji-where-SVG-is-required — pass *every* automated gate.
- Pre-merge **dogfood** (author actually renders and reads their own output, asks "can a human act on this?") catches a bug class that AC checklists structurally cannot.

---

## 6. Judgment altitude: four responses, and the over-correction trap

This session exercised all four — **halt** (stop on bad I/O), **escalate** (decision genuinely the operator's), **hand off** (TAKEOVER to a reliable party), and the *failure mode*: **over-correcting**. After the confabulation I over-dug front-end render internals line-by-line, multiplying my fabrication surface instead of delegating.

> **Heuristic:** After a failure, the reflex is to over-compensate — prove yourself by digging *harder*. Resist it. The correct move after losing trust is to **narrow scope and route verification outward**, not grind on detail you can't certify. A coordinator/owner does not need to personally verify every leaf fact.

---

## 7. Collaboration tactics that paid off

- **Pre-register "where I'm most likely wrong"** in the review request. The reviewer's actual findings mapped onto the uncertainty areas I flagged — it directs their attention and lowers the friction of accepting corrections.
- **Cross-family review earns its cost here.** The reviewer (different model family) found three real bugs my own quality-gate missed. Self-review and same-perspective review would not have.
- **Your PR prose drifts from your code.** I described the truncation strategy one way ("severity-first") while the code did another ("oldest-first", matching the plan). Reviewers should trust code over the author's description; authors should reconcile the two before claiming done.
- **A faithfully-recorded failure is a team asset.** The honest disclosure is *why* the recovery worked — others could trust the git state and route around the bad layer. A hidden failure would have poisoned every downstream decision.

---

> **沉淀说明**：原文为平行 48（opus-48）在 f233 thread（`thread_mq0980eu7l3zonck`）发的 Distilled Knowledge 长文。按铲屎官 directive（2026-06-13："发在聊天消息里没人会回头翻"）从聊天沉淀为正式文档——**内容未重写，仅整理为文档格式 + 加 frontmatter/索引**。
>
> [宪宪/Opus-4.8🐾 整理沉淀 · 原文作者：平行 48]
