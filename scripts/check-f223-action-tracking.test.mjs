import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const inventory = readFileSync(
  new URL('../docs/features/assets/F223/capability-surface-inventory.md', import.meta.url),
  'utf8',
);
const ACTION_STATES = new Set(['fix', 'build', 'keep_observe', 'delete_sunset']);

function sectionBetween(markdown, startHeading, endHeading) {
  const start = markdown.indexOf(startHeading);
  assert.notEqual(start, -1, `Missing section: ${startHeading}`);
  const end = markdown.indexOf(endHeading, start + startHeading.length);
  assert.notEqual(end, -1, `Missing section after ${startHeading}: ${endHeading}`);
  return markdown.slice(start, end);
}

function parseTableRows(section) {
  return section
    .split('\n')
    .filter((line) => line.startsWith('| '))
    .filter((line) => !/^\|[-\s|]+\|$/.test(line))
    .filter((line) => !line.includes('---'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    )
    .filter((cells) => cells.length > 1);
}

function registryCapabilities() {
  const main = sectionBetween(inventory, '## Inventory', '## Underused MCP Capability Addendum');
  const addendum = sectionBetween(inventory, '## Underused MCP Capability Addendum', '## Phase D Action Tracking');

  const mainCapabilities = parseTableRows(main)
    .filter((cells) => /^\d+$/.test(cells[0]))
    .map((cells) => cells[1]);
  const addendumCapabilities = parseTableRows(addendum)
    .filter((cells) => cells[0].startsWith('`cat_cafe_'))
    .map((cells) => cells[0]);

  return [...mainCapabilities, ...addendumCapabilities];
}

function actionTrackingRows() {
  const tracking = sectionBetween(inventory, '## Phase D Action Tracking', '## ADR-029 Compatibility');
  const rows = parseTableRows(tracking).filter((cells) => cells[0] !== 'Capability');
  return new Map(rows.map((cells) => [cells[0], { state: cells[1], route: cells[2], next: cells[3] }]));
}

test('F223 Phase D registry action tracking covers every inventory entry', () => {
  const capabilities = registryCapabilities();
  const tracking = actionTrackingRows();

  assert.ok(capabilities.length >= 20, 'expected F223 inventory capabilities to be parsed');

  for (const capability of capabilities) {
    const row = tracking.get(capability);
    assert.ok(row, `Missing Phase D action tracking row for ${capability}`);
    assert.ok(ACTION_STATES.has(row.state), `${capability} has invalid action state ${JSON.stringify(row.state)}`);
    assert.notEqual(row.route, '', `${capability} has empty tracking route`);
    assert.notEqual(row.next, '', `${capability} has empty next action`);
  }
});
