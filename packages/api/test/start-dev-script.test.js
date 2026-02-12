import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('start-dev script builds MCP server and exports CAT_CAFE_MCP_SERVER_PATH', () => {
  const scriptPath = resolve(process.cwd(), '../../scripts/start-dev.sh');
  const script = readFileSync(scriptPath, 'utf8');

  assert.match(
    script,
    /\(cd packages\/mcp-server && pnpm run build\)/,
    'start-dev must build mcp-server so Claude MCP tools are available',
  );
  assert.match(
    script,
    /export CAT_CAFE_MCP_SERVER_PATH=/,
    'start-dev must export CAT_CAFE_MCP_SERVER_PATH for Claude --mcp-config',
  );
});
