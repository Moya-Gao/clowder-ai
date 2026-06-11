/**
 * F230 Phase B: PtyDriver helper unit tests
 *
 * Tests for exported helper functions that are pure/testable without real tmux.
 *
 * TDD Steps:
 *   Step 7b: isBypassConfirmationScreen — unit tests for bypass menu detection
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isBypassConfirmationScreen } from '../dist/domains/cats/services/agents/providers/pty/PtyDriver.js';

// ─── Step 7b: isBypassConfirmationScreen ─────────────────────────────────────
// P1-A fix: PtyDriver.start() detects the --permission-mode bypassPermissions
// confirmation TUI screen and sends Enter to accept. This helper is exported
// for unit testing (pure function — no tmux side effects).

describe('PtyDriver — Step 7b: isBypassConfirmationScreen', () => {
  it('returns true when pane shows bypassPermissions confirmation menu', () => {
    // Real Claude Code 2.1.170 pane content (砚砚 probe 2026-06-10):
    // cursor starts on "1. No, exit"; PtyDriver.start() sends Down+Enter to accept.
    const paneContent = '? Allow Claude to use bypassPermissions mode?\n  ❯ 1. No, exit\n    2. Yes, I accept';
    assert.equal(isBypassConfirmationScreen(paneContent), true, 'detects bypass menu with full text');
  });

  it('returns true when bypassPermissions keyword appears anywhere in pane', () => {
    assert.equal(isBypassConfirmationScreen('bypassPermissions'), true, 'standalone keyword');
    assert.equal(isBypassConfirmationScreen('─ bypassPermissions ─'), true, 'keyword in header');
    assert.equal(
      isBypassConfirmationScreen('You have selected bypassPermissions\n  1. No, exit\n  2. Yes, I accept'),
      true,
      'numbered list variant',
    );
  });

  it('returns false for regular Claude prompt pane (no bypass keyword)', () => {
    assert.equal(isBypassConfirmationScreen('❯ Ready\n\nType your message...'), false, 'normal prompt');
    assert.equal(isBypassConfirmationScreen(''), false, 'empty pane');
    assert.equal(isBypassConfirmationScreen('Claude Code 1.0.0\n\n❯'), false, 'startup screen');
  });

  it('returns false for pane content that mentions accept/exit but not bypassPermissions', () => {
    // Guard: must specifically check for bypassPermissions, not generic yes/no patterns
    assert.equal(
      isBypassConfirmationScreen('Do you want to exit?\n  ❯ No\n  Yes'),
      false,
      'generic exit prompt without bypass keyword',
    );
  });
});
