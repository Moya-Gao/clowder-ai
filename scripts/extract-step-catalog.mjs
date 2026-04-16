#!/usr/bin/env node
/**
 * Extract Antigravity step type catalog from pino JSON logs.
 *
 * Usage:
 *   cat logs/api.log | node scripts/extract-step-catalog.mjs
 *   node scripts/extract-step-catalog.mjs < logs/api.log
 *
 * Reads pino JSON log lines from stdin, filters for antigravity-trace
 * "rpc raw response" entries, parses the raw trajectory JSON, and outputs
 * a catalog of all step types with their field shapes.
 *
 * Output: JSON catalog to stdout with:
 *   - stepTypes: { [type]: { statuses, fieldKeys, sampleShape, count } }
 *   - summary: total steps, unique types, unique statuses
 */
import { createInterface } from 'node:readline';

const stepCatalog = new Map();

function recordStep(step) {
  const type = step.type ?? 'UNKNOWN';
  const status = step.status ?? 'UNKNOWN';

  if (!stepCatalog.has(type)) {
    stepCatalog.set(type, {
      statuses: new Set(),
      fieldKeys: new Set(),
      sampleShape: null,
      count: 0,
    });
  }

  const entry = stepCatalog.get(type);
  entry.statuses.add(status);
  entry.count++;

  for (const key of Object.keys(step)) {
    entry.fieldKeys.add(key);
  }

  // Keep the first sample shape (with values replaced by type descriptors)
  if (!entry.sampleShape) {
    entry.sampleShape = describeShape(step);
  }
}

function describeShape(obj) {
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj === 'string') return `string(${obj.length})`;
  if (typeof obj === 'number') return 'number';
  if (typeof obj === 'boolean') return 'boolean';
  if (Array.isArray(obj)) {
    return obj.length > 0 ? [describeShape(obj[0])] : [];
  }
  const result = {};
  for (const [k, v] of Object.entries(obj)) {
    result[k] = describeShape(v);
  }
  return result;
}

const rl = createInterface({ input: process.stdin });
let linesRead = 0;
let traceEntries = 0;
let stepsExtracted = 0;

for await (const line of rl) {
  linesRead++;
  if (!line.trim()) continue;

  let entry;
  try {
    entry = JSON.parse(line);
  } catch {
    continue;
  }

  // Match rpc raw response entries from antigravity-trace module
  if (entry.module !== 'antigravity-trace') continue;
  if (entry.msg !== 'rpc raw response') continue;
  traceEntries++;

  const rawStr = entry.raw;
  if (!rawStr) continue;

  let payload;
  try {
    payload = JSON.parse(rawStr);
  } catch {
    continue;
  }

  // GetCascadeTrajectory → payload.trajectory.steps
  // GetCascadeTrajectorySteps → payload.steps (top-level)
  const steps = payload.trajectory?.steps ?? payload.steps ?? [];
  for (const step of steps) {
    recordStep(step);
    stepsExtracted++;
  }
}

// Serialize catalog
const output = {
  summary: {
    linesRead,
    traceEntries,
    stepsExtracted,
    uniqueStepTypes: stepCatalog.size,
    uniqueStatuses: new Set([...stepCatalog.values()].flatMap((e) => [...e.statuses])).size,
  },
  stepTypes: Object.fromEntries(
    [...stepCatalog.entries()].map(([type, entry]) => [
      type,
      {
        count: entry.count,
        statuses: [...entry.statuses],
        fieldKeys: [...entry.fieldKeys],
        sampleShape: entry.sampleShape,
      },
    ]),
  ),
};

console.log(JSON.stringify(output, null, 2));
