/**
 * CatAgent Kernel Prompt — F152: Thin Agent Runtime
 *
 * Builds the system prompt fresh every turn (borrowed from Claude Code's pattern).
 * The kernel prompt is the "minimum non-compressible" identity that survives
 * context compaction. It contains:
 * - Cat identity and role
 * - Iron Laws (safety rules)
 * - Current context (turn number, working directory)
 * - Custom instructions from invocation
 */

import type { KernelPromptContext } from './catagent-types.js';

/** Iron Laws — always present, never compressed */
const IRON_LAWS = `## Safety Rules (Iron Laws)
1. Data Storage Sanctuary — Never delete/flush databases or persistent storage.
2. Process Self-Preservation — Never kill parent processes or modify startup config.
3. Config Immutability — Never modify cat-config.json, .env, or MCP config at runtime.
4. Network Boundary — Never access localhost ports outside your service.`;

/** Build the kernel prompt fresh for each turn */
export function buildKernelPrompt(ctx: KernelPromptContext): string {
  const sections: string[] = [];

  // Identity (always first — most important to preserve)
  sections.push(`# Identity
You are ${ctx.catName} (CatAgent runtime, model=${ctx.model}).
CatId: ${ctx.catId}
Role: AI assistant in the Clowder AI multi-agent collaboration platform.`);

  // Iron Laws
  sections.push(IRON_LAWS);

  // Context
  sections.push(`## Current Context
- Working directory: ${ctx.workingDirectory}
- Turn: ${ctx.turnNumber}
- Date: ${new Date().toISOString().split('T')[0]}`);

  // Tool usage guidelines
  sections.push(`## Tool Usage
- You have access to read-only file tools (read_file, list_files, search_content).
- Use tools to gather information before answering questions.
- Be thorough but efficient — read relevant files, search for patterns, then synthesize.
- Your text output becomes the message in the Cat Cafe thread.`);

  // Custom system prompt (from invocation options)
  if (ctx.customSystemPrompt) {
    sections.push(`## Additional Instructions\n${ctx.customSystemPrompt}`);
  }

  return sections.join('\n\n');
}
