/**
 * F140 Phase E.1 Task 2 — Setup-noise filter (context-aware, factory-based).
 *
 * Migrated from `GithubReviewMailParser.inferReviewActionFromEmailSource` Rule 3
 * (lines 101-104): strip ignorable Codex setup guidance emails. Polling side
 * needs the same suppression to prevent bot "To use Codex here, create an
 * environment..." conversation comments from getting routed as if they were
 * real review feedback.
 *
 * Scope narrowing (砚砚 GPT-5.4 P1-1):
 *   - conversation only (inline comments belong to a review submission)
 *   - bot authors only (humans may legitimately quote the setup sentence —
 *     see github-review-mail-body-classifier.test.js:72 key negative case)
 *   - setup-only: setup sentence + NO `codex review` content (a real review
 *     that happens to include the setup footer must not be suppressed)
 *
 * Trigger-template noise (裸 `@codex review` / 触发模板) is NOT handled here —
 * those are self-authored by cats/铲屎官 and are covered by Rule A
 * (`shouldSkipComment` self-authored skip).
 */

export interface SetupNoiseContext {
  readonly author: string;
  readonly body: string;
  readonly commentType: 'inline' | 'conversation';
}

const SETUP_GUIDANCE_SENTENCE = /to use codex here,/i;
const SETUP_GUIDANCE_ANCHOR = /environment for this repo\b/i;
const CODEX_REVIEW_CONTENT = /\bcodex review\b/i;

export function createSetupNoiseFilter(botLogins: readonly string[]): (c: SetupNoiseContext) => boolean {
  const bots = new Set(botLogins);
  return (c: SetupNoiseContext): boolean => {
    if (!c.body) return false;
    if (c.commentType !== 'conversation') return false;
    if (!bots.has(c.author)) return false;

    const hasSetupSentence = SETUP_GUIDANCE_SENTENCE.test(c.body) && SETUP_GUIDANCE_ANCHOR.test(c.body);
    if (!hasSetupSentence) return false;

    const hasCodexReviewContent = CODEX_REVIEW_CONTENT.test(c.body);
    return !hasCodexReviewContent;
  };
}
