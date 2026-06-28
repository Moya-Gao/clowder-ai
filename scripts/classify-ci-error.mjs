/**
 * F253 Phase C — CI error classifier for repair loop (AC-C2).
 *
 * Classifies CI output into error classes and determines if auto-fix
 * is safe. Used by merge-gate skill CI repair behavior protocol.
 *
 * Error classes:
 *   format      — Biome format (deterministic, auto-fixable)
 *   lint        — Biome lint (conditional: style=auto-fix, suspicious/correctness=human)
 *   typecheck   — TypeScript type error (non-deterministic, needs human)
 *   test_failure — Test assertion failure (non-deterministic, needs human)
 *   unknown     — Unrecognized (non-deterministic, needs human)
 */

/** @typedef {{ errorClass: string, deterministic: boolean, autoFixCommand?: string[], summary: string }} CiErrorClassification */

const MAX_AUTO_FIX_ROUNDS = 2;

/**
 * Classify CI output into an error class with determinism flag.
 *
 * @param {string} ciOutput - Raw CI output (stdout+stderr combined)
 * @returns {CiErrorClassification}
 */
export function classifyCiError(ciOutput) {
  // Order matters: more specific patterns first

  // Biome format errors
  if (/format ━+/.test(ciOutput) && /Formatter would have printed/.test(ciOutput)) {
    return {
      errorClass: 'format',
      deterministic: true,
      autoFixCommand: ['pnpm', 'exec', 'biome', 'check', '--write', '.'],
      summary: 'Biome format error (auto-fixable)',
    };
  }

  // Biome lint errors — suspicious/correctness rules need human review
  if (/lint ━+/.test(ciOutput) || /lint\//.test(ciOutput)) {
    const hasUnsafe = /lint\/suspicious|lint\/correctness/.test(ciOutput);
    return {
      errorClass: 'lint',
      deterministic: !hasUnsafe,
      autoFixCommand: hasUnsafe ? undefined : ['pnpm', 'exec', 'biome', 'lint', '--write', '.'],
      summary: hasUnsafe ? 'Lint error (needs human review)' : 'Lint error (auto-fixable)',
    };
  }

  // TypeScript type errors
  if (/error TS\d+/.test(ciOutput)) {
    return {
      errorClass: 'typecheck',
      deterministic: false,
      summary: 'TypeScript type error (needs human judgment)',
    };
  }

  // Test failures
  if (/failing|FAIL|AssertionError|assert\.|ERR_ASSERTION/.test(ciOutput)) {
    return {
      errorClass: 'test_failure',
      deterministic: false,
      summary: 'Test failure (needs human fix)',
    };
  }

  return {
    errorClass: 'unknown',
    deterministic: false,
    summary: 'Unknown CI error',
  };
}

/**
 * Should the CI repair loop attempt an auto-fix?
 *
 * Rules (state machine from plan):
 *   - Non-deterministic errors → never auto-fix
 *   - Deterministic errors → auto-fix up to MAX_AUTO_FIX_ROUNDS per error class
 *   - After MAX_AUTO_FIX_ROUNDS same-class failures → escalate to cat
 *
 * @param {{ errorClass: string, deterministic: boolean }} classification
 * @param {number} sameClassRound - 0-based count of consecutive same-class failures
 * @returns {boolean}
 */
export function shouldAutoFix(classification, sameClassRound) {
  if (!classification.deterministic) return false;
  return sameClassRound < MAX_AUTO_FIX_ROUNDS;
}
