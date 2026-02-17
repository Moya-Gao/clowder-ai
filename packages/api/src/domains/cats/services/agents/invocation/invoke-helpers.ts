/**
 * Invocation helper functions — 从 invoke-single-cat 拆出的纯函数
 *
 * F23: 拆分以减少 invoke-single-cat.ts 行数
 */

/* ── F26: Task tool detection for real-time progress ─────── */
export const TASK_TOOL_NAMES = new Set(['TodoWrite', 'write_todos']);

export function extractTaskProgress(
  toolName: string,
  toolInput: Record<string, unknown> | undefined,
): { action: 'snapshot'; tasks: Array<{ id: string; subject: string; status: string; activeForm?: string }> } | null {
  if (!toolInput || !TASK_TOOL_NAMES.has(toolName)) return null;
  const todos = toolInput['todos'] as Array<{ content?: string; status?: string; activeForm?: string }> | undefined;
  if (!Array.isArray(todos)) return null;
  return {
    action: 'snapshot',
    tasks: todos.map((t, i) => ({
      id: `task-${i}`,
      subject: (t.content ?? '').slice(0, 120),
      status: t.status ?? 'pending',
      ...(t.activeForm ? { activeForm: t.activeForm } : {}),
    })),
  };
}

export function isMissingClaudeSessionError(message: string | undefined): boolean {
  if (!message) return false;
  return /No conversation found with session ID/i.test(message);
}

export function isTransientCliExitCode1(message: string | undefined): boolean {
  if (!message) return false;
  return /CLI 异常退出 \(code:\s*1(?:,\s*signal:\s*none)?\)/i.test(message);
}
