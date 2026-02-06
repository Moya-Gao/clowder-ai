/**
 * CLI Exit Error Formatting
 * 三只猫共享的 CLI 退出错误格式化工具
 */

/**
 * Format a CLI exit event into a human-readable error string.
 * @param cliName Display name of the CLI (e.g. "Claude CLI", "Codex CLI")
 * @param event Exit details from spawnCli
 */
export function formatCliExitError(
  cliName: string,
  event: { exitCode: number | null; signal: string | null; stderr: string }
): string {
  const status = event.exitCode !== null ? `code ${event.exitCode}` : 'no exit code';
  const signalText = event.signal ? `, signal ${event.signal}` : '';
  const stderr = event.stderr.trim();
  return stderr.length > 0
    ? `${cliName} exited (${status}${signalText}): ${stderr}`
    : `${cliName} exited (${status}${signalText})`;
}
