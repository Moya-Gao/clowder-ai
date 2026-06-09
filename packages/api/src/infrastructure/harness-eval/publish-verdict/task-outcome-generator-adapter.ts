import { loadDomains } from '../hub/eval-hub-read-model.js';
import { generateTaskOutcomeLiveVerdict } from '../task-outcome/eval-task-outcome-live-verdict.js';
import { resolveTaskOutcomeSourceWindow } from '../task-outcome/task-outcome-source-resolver.js';
import type { VerdictGenerator } from './types.js';
import { isTaskOutcomeSourceRefs } from './validation.js';

export function createTaskOutcomeGeneratorAdapter(): VerdictGenerator {
  return async (packet, sourceRefs, deps) => {
    if (!isTaskOutcomeSourceRefs(sourceRefs)) {
      const kind = (sourceRefs as { kind?: string }).kind;
      throw new Error(
        `task_outcome_adapter_wrong_kind: received sourceRefs with kind='${kind ?? '(omitted)'}'; expected 'task-outcome-snapshot'`,
      );
    }

    const domains = loadDomains(deps.harnessFeedbackRoot);
    const domain = domains.get(packet.domainId);
    if (!domain) {
      throw new Error(`unknown_domain: ${packet.domainId} not in registry`);
    }

    const sourceWindow = resolveTaskOutcomeSourceWindow(sourceRefs, deps.liveHarnessFeedbackRoot, {
      ownerUserId: deps.ownerUserId,
      defaultTaskOutcomeDbPath: deps.taskOutcomeDbPath,
      defaultEventMemoryDbPath: deps.eventMemoryDbPath,
    });
    const artifact = generateTaskOutcomeLiveVerdict({
      verdictId: packet.id,
      harnessFeedbackRoot: deps.harnessFeedbackRoot,
      domain,
      sourceWindow,
      submittedPacket: packet,
    });

    return {
      verdictPath: artifact.path,
      bundleDir: artifact.bundleDir,
    };
  };
}
