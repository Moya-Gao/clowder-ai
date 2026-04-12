#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

function parseArgs(argv) {
  const args = { report: '', repo: '' };
  for (const arg of argv) {
    if (arg.startsWith('--report=')) {
      args.report = arg.slice('--report='.length);
      continue;
    }
    if (arg.startsWith('--repo=')) {
      args.repo = arg.slice('--repo='.length);
      continue;
    }
    throw new Error(`Unknown flag: ${arg}`);
  }
  if (!args.report) {
    throw new Error('--report=<path> is required');
  }
  return args;
}

function normalizeMarkdownCell(value) {
  return value.replace(/[*_`]/g, '').trim();
}

function normalizeIssueState(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function isClosedVerdict(value) {
  const normalized = normalizeMarkdownCell(value).toLowerCase();
  return normalized === 'closed' || normalized === 'auto-closed' || normalized === 'already closed';
}

export function parseClosedIssueNumbers(markdown) {
  const issueNumbers = new Set();

  for (const line of markdown.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|')) {
      continue;
    }

    const cells = trimmed
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());

    if (cells.length < 3) {
      continue;
    }

    const issueMatch = normalizeMarkdownCell(cells[0]).match(/#(\d+)/);
    if (!issueMatch || !isClosedVerdict(cells[2])) {
      continue;
    }

    issueNumbers.add(Number(issueMatch[1]));
  }

  return [...issueNumbers].sort((a, b) => a - b);
}

function readMockIssueStates() {
  const raw = process.env.RECONCILIATION_ISSUE_STATES_JSON;
  if (!raw) {
    return null;
  }
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('RECONCILIATION_ISSUE_STATES_JSON must be a JSON object');
  }
  return parsed;
}

function readLiveIssueState(issueNumber, repo) {
  try {
    const response = execFileSync('gh', ['issue', 'view', String(issueNumber), '--repo', repo, '--json', 'state'], {
      encoding: 'utf-8',
    });
    return normalizeIssueState(JSON.parse(response).state);
  } catch (error) {
    const stderr = typeof error?.stderr === 'string' ? error.stderr.trim() : '';
    throw new Error(`failed to read GitHub state for #${issueNumber} in ${repo}${stderr ? `: ${stderr}` : ''}`);
  }
}

export function verifyClosedIssues({ markdown, repo }) {
  const closedIssues = parseClosedIssueNumbers(markdown);
  if (closedIssues.length === 0) {
    return { closedIssues, openIssues: [] };
  }

  const mockStates = readMockIssueStates();
  const openIssues = [];

  for (const issueNumber of closedIssues) {
    const state =
      mockStates !== null
        ? normalizeIssueState(mockStates[issueNumber] ?? mockStates[`#${issueNumber}`])
        : readLiveIssueState(issueNumber, repo);

    if (state !== 'CLOSED') {
      openIssues.push({ issueNumber, state: state || 'UNKNOWN' });
    }
  }

  return { closedIssues, openIssues };
}

export function main(argv = process.argv.slice(2)) {
  const { report, repo } = parseArgs(argv);
  const markdown = readFileSync(report, 'utf-8');
  const { closedIssues, openIssues } = verifyClosedIssues({ markdown, repo });

  if (closedIssues.length === 0) {
    process.stdout.write('No closed issues declared in reconciliation report.\n');
    return;
  }

  if (openIssues.length > 0) {
    const rendered = openIssues.map(({ issueNumber, state }) => `#${issueNumber} (${state})`).join(', ');
    throw new Error(`reconciliation report marks issue(s) closed but GitHub still shows them open: ${rendered}`);
  }

  process.stdout.write(
    `Verified GitHub closed state for reconciliation issues: ${closedIssues.map((issue) => `#${issue}`).join(', ')}\n`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Error: ${error.message}\n`);
    process.exit(1);
  }
}
