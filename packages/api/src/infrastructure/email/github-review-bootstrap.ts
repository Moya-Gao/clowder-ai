/**
 * GitHub Review Watcher Bootstrap
 * Starts the email watcher if configured, wires up ReviewRouter for routing.
 *
 * BACKLOG #81
 */

import type { FastifyBaseLogger } from 'fastify';
import { GithubReviewWatcher, loadWatcherConfigFromEnv } from './GithubReviewWatcher.js';
import type { ReviewRouter } from './ReviewRouter.js';

let watcher: GithubReviewWatcher | null = null;

export interface GithubReviewBootstrapOptions {
  readonly log: FastifyBaseLogger;
  readonly reviewRouter?: ReviewRouter;
}

/**
 * Start the GitHub review email watcher if env vars are configured.
 * Returns true if started, false if not configured.
 */
export async function startGithubReviewWatcher(options: GithubReviewBootstrapOptions): Promise<boolean> {
  const config = loadWatcherConfigFromEnv();

  if (!config) {
    options.log.info('[GithubReviewWatcher] Not configured (missing GITHUB_REVIEW_IMAP_USER/PASS), skipping');
    return false;
  }

  watcher = new GithubReviewWatcher(config, options.log);

  // Use acknowledged handler so watcher defers IMAP cursor advancement
  // until routing succeeds (Cloud Codex P1-3: no notification loss on failure)
  if (options.reviewRouter) {
    const router = options.reviewRouter;
    watcher.onReviewAck(async (event) => {
      const result = await router.route(event);
      options.log.info(`[GithubReviewWatcher] Route result: ${result.kind}`);
    });
  }

  watcher.on('error', (error) => {
    options.log.error(`[GithubReviewWatcher] Error: ${error.message}`);
  });

  watcher.on('connected', () => {
    options.log.info('[GithubReviewWatcher] Connected to IMAP server');
  });

  watcher.on('disconnected', () => {
    options.log.info('[GithubReviewWatcher] Disconnected from IMAP server');
  });

  try {
    await watcher.start();
    options.log.info(
      `[GithubReviewWatcher] Started (polling every ${config.pollIntervalMs / 1000}s)`,
    );
    return true;
  } catch (error) {
    options.log.error(`[GithubReviewWatcher] Failed to start: ${String(error)}`);
    watcher = null;
    return false;
  }
}

/**
 * Stop the GitHub review watcher if running.
 */
export async function stopGithubReviewWatcher(): Promise<void> {
  if (watcher) {
    await watcher.stop();
    watcher = null;
  }
}

/**
 * Check if the watcher is currently running.
 */
export function isGithubReviewWatcherRunning(): boolean {
  return watcher !== null;
}
