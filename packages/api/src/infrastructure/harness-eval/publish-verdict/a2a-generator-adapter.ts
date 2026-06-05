import { generateA2aLiveVerdict } from '../a2a/eval-a2a-live-verdict.js';
import { loadDomains } from '../hub/eval-hub-read-model.js';
import type { VerdictGenerator } from './publish-verdict.js';

/**
 * F192 Phase H AC-H4 (砚砚 R4 P1 + cloud R4 P1): adapter that bridges
 * VerdictGenerator's (packet, resolvedSources, deps) signature with
 * generateA2aLiveVerdict's input-bag shape (needs verdictId + raw paths +
 * harness root + EvalDomainRegistryEntry).
 *
 * Loads the EvalDomainRegistryEntry from the live registry on each call
 * (verdict generation is rare, registry parsing is cheap; no caching needed).
 */
export function createA2aGeneratorAdapter(): VerdictGenerator {
  return async (packet, resolvedSources, deps) => {
    // Load domain entry from registry inside the isolated worktree's harness root.
    // The isolated worktree was created from origin/main and includes the
    // domains/ subtree, so registry lookup is current.
    const domains = loadDomains(deps.harnessFeedbackRoot);
    const domain = domains.get(packet.domainId);
    if (!domain) {
      throw new Error(`unknown_domain: ${packet.domainId} not in registry`);
    }

    // 砚砚 R8 P1: pass submittedPacket so generator publishes CAT'S verdict
    // (not regenerated from evidence). Without this, cat's keep_observe could
    // get silently rewritten to fix if generator's strongestFinding heuristic
    // disagrees with cat's judgment.
    const artifact = generateA2aLiveVerdict({
      verdictId: packet.id,
      rawSnapshotPath: resolvedSources.snapshotPath,
      rawAttributionPath: resolvedSources.attributionPath,
      harnessFeedbackRoot: deps.harnessFeedbackRoot,
      domain,
      submittedPacket: packet,
    });

    return { verdictPath: artifact.path, bundleDir: artifact.bundleDir };
  };
}
