/**
 * GitHub Review Mail Parser
 * Parses GitHub PR review notification emails to extract PR info.
 *
 * GitHub email subject formats:
 * - "[owner/repo] PR Title (#123)" - general PR notification
 * - "Re: [owner/repo] PR Title (#123)" - reply/comment
 * - "[owner/repo] @user commented on pull request #123: Title"
 * - "[owner/repo] @user approved pull request #123: Title"
 * - "[owner/repo] @user requested changes on pull request #123: Title"
 */

export type ReviewType = 'commented' | 'approved' | 'changes_requested' | 'unknown';

export interface ParsedGithubReviewMail {
  readonly prNumber: number;
  readonly repository: string;
  readonly title: string;
  readonly reviewType: ReviewType;
  readonly reviewer: string | undefined;
}

// Match PR number — prefer "pull request #N" or trailing "(#N)", not first #token
const PR_NUMBER_PULL_REQUEST_REGEX = /pull request #(\d+)/i;
const PR_NUMBER_TRAILING_PARENS_REGEX = /\(#(\d+)\)\s*$/;
const PR_NUMBER_FALLBACK_REGEX = /#(\d+)/;

// Match repository from subject: "[owner/repo]"
const REPO_REGEX = /\[([^\]]+\/[^\]]+)\]/;

// Match review action: "@user approved/commented/requested changes on pull request"
const REVIEW_ACTION_REGEX = /@(\S+)\s+(approved|commented on|requested changes on)\s+pull request/i;

// Match PR title after "#123:"
const TITLE_AFTER_NUMBER_REGEX = /#\d+:\s*(.+)$/;

// Match PR title in parens: "PR Title (#123)"
const TITLE_IN_PARENS_REGEX = /\]\s*(.+?)\s*\(#\d+\)/;

export function parseGithubReviewSubject(subject: string): ParsedGithubReviewMail | null {
  // Extract PR number: prefer "pull request #N" > trailing "(#N)" > first "#N"
  const prPullReq = subject.match(PR_NUMBER_PULL_REQUEST_REGEX);
  const prTrailing = subject.match(PR_NUMBER_TRAILING_PARENS_REGEX);
  const prFallback = subject.match(PR_NUMBER_FALLBACK_REGEX);
  const prNumStr = prPullReq?.[1] ?? prTrailing?.[1] ?? prFallback?.[1];
  if (!prNumStr) {
    return null;
  }
  const prNumber = parseInt(prNumStr, 10);

  // Extract repository
  const repoMatch = subject.match(REPO_REGEX);
  const repository = repoMatch?.[1];
  if (!repository) {
    return null;
  }

  // Extract review type and reviewer
  let reviewType: ReviewType = 'unknown';
  let reviewer: string | undefined;

  const actionMatch = subject.match(REVIEW_ACTION_REGEX);
  if (actionMatch) {
    reviewer = actionMatch[1];
    const action = actionMatch[2]?.toLowerCase();
    if (action === 'approved') {
      reviewType = 'approved';
    } else if (action === 'commented on') {
      reviewType = 'commented';
    } else if (action === 'requested changes on') {
      reviewType = 'changes_requested';
    }
  }

  // Guard: only accept subjects that look like PR review notifications.
  // Reject issue/discussion/other GitHub traffic (Cloud Codex P1-6 + 砚砚 R3 P1-1).
  // "Re:" alone is NOT enough — issue replies also start with "Re:".
  // Accept if: explicit review action OR "pull request" keyword in subject.
  const isPullRequest = /pull request/i.test(subject);
  if (!actionMatch && !isPullRequest) {
    return null;
  }

  // Extract title
  let title = '';
  const titleAfterMatch = subject.match(TITLE_AFTER_NUMBER_REGEX);
  const titleAfter = titleAfterMatch?.[1];
  if (titleAfter) {
    title = titleAfter.trim();
  } else {
    const titleInParensMatch = subject.match(TITLE_IN_PARENS_REGEX);
    const titleInParens = titleInParensMatch?.[1];
    if (titleInParens) {
      title = titleInParens.trim();
    }
  }

  return {
    prNumber,
    repository,
    title,
    reviewType,
    reviewer,
  };
}

/**
 * Extract cat name from PR title.
 * Supports two signature formats (per CLAUDE.md 签名规范):
 * - Breed name: "[布偶猫🐾]", "[缅因猫🐾]", "[暹罗猫🐾]"
 * - Nickname:   "[宪宪/Opus-46🐾]", "[砚砚/Codex🐾]", "[烁烁🐾]", "[Spark🐾]"
 */
export type CatTag = '布偶猫' | '缅因猫' | '暹罗猫';

// Match any [...🐾] tag and capture the inner text before the paw emoji
const CAT_TAG_REGEX = /\[([^\]]+?)🐾\]/;

// Nickname prefix → breed mapping (CLAUDE.md 猫猫花名册)
const NICKNAME_TO_BREED: Record<string, CatTag> = {
  '布偶猫': '布偶猫',
  '缅因猫': '缅因猫',
  '暹罗猫': '暹罗猫',
  '宪宪': '布偶猫',
  '砚砚': '缅因猫',
  '烁烁': '暹罗猫',
  'Spark': '缅因猫',
};

export function extractCatFromTitle(title: string): CatTag | null {
  const match = title.match(CAT_TAG_REGEX);
  if (!match) return null;

  const inner = match[1]!;
  // Try direct match first (e.g. "布偶猫", "烁烁", "Spark")
  if (NICKNAME_TO_BREED[inner]) return NICKNAME_TO_BREED[inner];

  // Try nickname prefix before "/" (e.g. "宪宪/Opus-46" → "宪宪")
  const slashIdx = inner.indexOf('/');
  if (slashIdx > 0) {
    const prefix = inner.slice(0, slashIdx);
    if (NICKNAME_TO_BREED[prefix]) return NICKNAME_TO_BREED[prefix];
  }

  return null;
}

/**
 * Map cat tag to cat ID used in the system.
 */
export function catTagToCatId(tag: CatTag): string {
  switch (tag) {
    case '布偶猫':
      return 'opus';
    case '缅因猫':
      return 'codex';
    case '暹罗猫':
      return 'gemini';
  }
}

/**
 * Check if an email is from GitHub notifications.
 * Matches exact addresses or angle-bracket format (e.g. "GitHub <notifications@github.com>").
 */
const GITHUB_SENDER_REGEX = /(?:^|<)(notifications@github\.com|noreply@github\.com)(?:>|$)/i;

export function isGithubNotification(from: string): boolean {
  return GITHUB_SENDER_REGEX.test(from);
}
