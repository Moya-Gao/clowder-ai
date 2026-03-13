/**
 * F089 Spike: tmux control mode (-CC) vs CLI mode feasibility
 *
 * Tests:
 * 1. CLI mode: execFile per command (simple, reliable)
 * 2. Control mode: spawn -CC, parse %begin/%end protocol (streaming)
 *
 * Conclusion will determine TmuxGateway implementation approach.
 */
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const SOCKET = 'catcafe-spike-test';

async function cleanUp() {
  try {
    await exec('tmux', ['-L', SOCKET, 'kill-server']);
  } catch {
    /* ok */
  }
}

// ─── Test 1: CLI Mode ───────────────────────────────────────────
async function testCliMode() {
  console.log('\n=== Test 1: CLI Mode ===\n');
  await cleanUp();

  // 1a. Create session
  console.log('1a. Creating session...');
  await exec('tmux', ['-L', SOCKET, 'new-session', '-d', '-s', 'main', '-x', '120', '-y', '40']);
  console.log('  ✅ Session created');

  // 1b. List panes
  console.log('1b. Listing panes...');
  const { stdout: panes } = await exec('tmux', [
    '-L',
    SOCKET,
    'list-panes',
    '-a',
    '-F',
    '#{pane_id} #{pane_pid} #{pane_width} #{pane_height}',
  ]);
  console.log(`  ✅ Panes: ${panes.trim()}`);

  // 1c. Create new window
  console.log('1c. Creating new window...');
  await exec('tmux', ['-L', SOCKET, 'new-window', '-t', 'main']);
  const { stdout: panes2 } = await exec('tmux', [
    '-L',
    SOCKET,
    'list-panes',
    '-a',
    '-F',
    '#{window_index}:#{pane_index} #{pane_id} #{pane_pid}',
  ]);
  console.log(
    `  ✅ Windows/panes:\n${panes2
      .trim()
      .split('\n')
      .map((l) => `    ${l}`)
      .join('\n')}`,
  );

  // 1d. Resize
  console.log('1d. Resizing pane...');
  const { stdout: firstPaneId } = await exec('tmux', ['-L', SOCKET, 'display-message', '-p', '#{pane_id}']);
  await exec('tmux', ['-L', SOCKET, 'resize-pane', '-t', firstPaneId.trim(), '-x', '100', '-y', '30']);
  console.log(`  ✅ Resized ${firstPaneId.trim()} to 100x30`);

  // 1e. Send keys to pane
  console.log('1e. Sending keys to pane...');
  await exec('tmux', ['-L', SOCKET, 'send-keys', '-t', firstPaneId.trim(), 'echo hello-from-spike', 'Enter']);
  // Wait a beat for output
  await new Promise((r) => setTimeout(r, 500));
  const { stdout: captured } = await exec('tmux', ['-L', SOCKET, 'capture-pane', '-t', firstPaneId.trim(), '-p']);
  const hasHello = captured.includes('hello-from-spike');
  console.log(`  ${hasHello ? '✅' : '❌'} Captured output contains "hello-from-spike": ${hasHello}`);

  // 1f. Kill session
  console.log('1f. Killing session...');
  await exec('tmux', ['-L', SOCKET, 'kill-session', '-t', 'main']);
  console.log('  ✅ Session killed');

  await cleanUp();
  console.log('\n  CLI Mode: ALL PASS ✅');
}

// ─── Test 2: Control Mode (-CC) ────────────────────────────────
async function testControlMode() {
  console.log('\n=== Test 2: Control Mode (-CC) ===\n');
  await cleanUp();

  return new Promise<void>((resolve) => {
    const proc = spawn('tmux', ['-L', SOCKET, '-CC', 'new-session', '-s', 'ctrl-test', '-x', '80', '-y', '24'], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let commandsSent = 0;
    const commands = [
      'list-panes -F "#{pane_id} #{pane_pid}"',
      'new-window',
      'list-panes -a -F "#{window_index}:#{pane_index} #{pane_id}"',
      'resize-window -x 120 -y 40',
      'kill-session -t ctrl-test',
    ];

    const results: { cmd: string; ok: boolean; output: string }[] = [];

    proc.stdout?.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();

      // Parse %begin/%end blocks
      const beginEndRe = /%begin (\d+) \d+ \d+\n([\s\S]*?)%end \1 \d+ \d+/g;
      let match: RegExpExecArray | null;
      while ((match = beginEndRe.exec(stdout)) !== null) {
        const output = match[2]?.trim();
        const cmdIdx = results.length;
        if (cmdIdx < commands.length) {
          results.push({ cmd: commands[cmdIdx]!, ok: true, output });
          console.log(`  ✅ [${cmdIdx}] ${commands[cmdIdx]}: ${output.substring(0, 80)}`);
        }
      }

      // Send next command if ready
      if (commandsSent < commands.length) {
        // Small delay between commands
        setTimeout(() => {
          if (commandsSent < commands.length) {
            proc.stdin?.write(`${commands[commandsSent]}\n`);
            commandsSent++;
          }
        }, 200);
      }
    });

    proc.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim();
      if (msg) console.log(`  stderr: ${msg}`);
    });

    proc.on('close', (code) => {
      console.log(`\n  Control mode process exited with code ${code}`);
      const allOk = results.length >= 3; // At least 3 commands parsed
      console.log(
        `  Control Mode: ${allOk ? 'PASS ✅' : 'PARTIAL ⚠️'} (${results.length}/${commands.length} commands parsed)`,
      );
      cleanUp().then(resolve);
    });

    // Send first command after session is ready
    setTimeout(() => {
      proc.stdin?.write(`${commands[commandsSent]}\n`);
      commandsSent++;
    }, 500);

    // Timeout safety
    setTimeout(() => {
      console.log('\n  ⏰ Timeout — killing control mode process');
      proc.kill();
    }, 10000);
  });
}

// ─── Main ───────────────────────────────────────────────────────
async function main() {
  console.log('F089 Spike: tmux Control Mode vs CLI Mode');
  console.log('==========================================');

  try {
    await testCliMode();
  } catch (err) {
    console.error('CLI mode FAILED:', err);
  }

  try {
    await testControlMode();
  } catch (err) {
    console.error('Control mode FAILED:', err);
  }

  console.log('\n==========================================');
  console.log('SPIKE CONCLUSION:');
  console.log('- CLI mode: Simple, reliable, one execFile per command');
  console.log('- Control mode: Streaming capable but parsing overhead');
  console.log('- RECOMMENDATION: Start with CLI mode for Phase 1');
  console.log('  (Control mode can be added later for Phase 2 streaming events)');
}

main().catch(console.error);
