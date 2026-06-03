// F210 Phase H2b: AgyTrajectoryExtractor — 从 step_payload proto 取本轮 final answer text。
// 砚砚拍 (2026-06-02)：手写 minimal wire-format parser，解顶层 field 20 → field 1 (final)，
// field 8 fallback，排除 field 3 (thinking)。bounds + 未知 field skip + 解析失败 fail-open。
// proto 逆向证据：B spike §7.4 + protoc --decode_raw 实测 fresh turn 33d040c7 (apple→pomme)。

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const { parseAgyStepFinalText, extractAgyFinalTextFromSteps, readAgyTrajectorySteps } = await import(
  '../dist/domains/cats/services/agents/providers/agy-trajectory-extractor.js'
);
const { classifyAntigravityCliPlainText } = await import(
  '../dist/domains/cats/services/agents/providers/antigravity-cli-event-parser.js'
);

const __dirname = dirname(fileURLToPath(import.meta.url));
const POMME_FIXTURE = readFileSync(join(__dirname, 'fixtures/agy-step15-pomme.bin'));

test('parseAgyStepFinalText extracts final answer from field 20.1', () => {
  assert.equal(parseAgyStepFinalText(POMME_FIXTURE), 'pomme');
});

test('parseAgyStepFinalText does NOT return thinking (field 20.3)', () => {
  const got = parseAgyStepFinalText(POMME_FIXTURE);
  assert.ok(got && !got.includes('Translating'), 'must not leak thinking text into final answer');
});

test('parseAgyStepFinalText fail-open: garbage bytes → null', () => {
  assert.equal(parseAgyStepFinalText(Buffer.from([0xff, 0xff, 0xff, 0x7f])), null);
});

test('parseAgyStepFinalText fail-open: empty buffer → null', () => {
  assert.equal(parseAgyStepFinalText(Buffer.alloc(0)), null);
});

test('parseAgyStepFinalText fail-open: message without field 20 → null', () => {
  // 构造一个只有 field 1 (varint 15)、无 field 20 的合法 proto message。
  // tag = (1<<3)|0 = 0x08, value = 15 → [0x08, 0x0f]
  assert.equal(parseAgyStepFinalText(Buffer.from([0x08, 0x0f])), null);
});

// extractor 层：从多个 step_type 15 payload 取本轮 final answer（最后一个有 final text 的）。
test('extractAgyFinalTextFromSteps returns last step with non-empty final text', () => {
  const steps = [
    { stepType: 15, payload: Buffer.from([0x08, 0x0f]) }, // no final → skip
    { stepType: 15, payload: POMME_FIXTURE }, // pomme
  ];
  assert.equal(extractAgyFinalTextFromSteps(steps), 'pomme');
});

test('extractAgyFinalTextFromSteps fail-open: no step yields final → null', () => {
  const steps = [{ stepType: 15, payload: Buffer.from([0x08, 0x0f]) }];
  assert.equal(extractAgyFinalTextFromSteps(steps), null);
});

test('extractAgyFinalTextFromSteps fail-open: empty steps → null', () => {
  assert.equal(extractAgyFinalTextFromSteps([]), null);
});

// db read helper：读 step_type + payload，fail-open。
const STEPS_SCHEMA = `CREATE TABLE steps (
  idx integer, step_type integer NOT NULL DEFAULT 0, status integer NOT NULL DEFAULT 0,
  step_payload blob, PRIMARY KEY(idx));`;

test('readAgyTrajectorySteps reads step_type + payload by idx', () => {
  const dir = mkdtempSync(join(tmpdir(), 'agy-ext-'));
  const dbPath = join(dir, 'conv.db');
  const db = new Database(dbPath);
  db.exec(STEPS_SCHEMA);
  db.prepare('INSERT INTO steps (idx, step_type, step_payload) VALUES (?, ?, ?)').run(0, 14, null);
  db.prepare('INSERT INTO steps (idx, step_type, step_payload) VALUES (?, ?, ?)').run(1, 15, POMME_FIXTURE);
  db.close();
  const steps = readAgyTrajectorySteps(dbPath);
  assert.equal(steps.length, 1, 'null payload filtered out');
  assert.equal(steps[0].stepType, 15);
  assert.equal(extractAgyFinalTextFromSteps(steps), 'pomme', 'end-to-end db→extractor');
  rmSync(dir, { recursive: true, force: true });
});

test('readAgyTrajectorySteps fail-open: missing db → []', () => {
  assert.deepEqual(readAgyTrajectorySteps('/nonexistent/conv.db'), []);
});

// classifyAntigravityCliPlainText resumed 替换（H2b 根治重放）：
test('classify: resumed + resumedFinalText → 替换 stdout 重放', () => {
  const r = classifyAntigravityCliPlainText({
    stdout: '[1]\n[1,2]\n[1,2,3]', // 累加重放
    resumed: true,
    resumedFinalText: '[1,2,3] only',
  });
  assert.equal(r.kind, 'text');
  assert.equal(r.content, '[1,2,3] only', 'trajectory final 替换累加重放');
  assert.equal(r.textMode, 'replace');
});

test('classify: resumed + no final (null) → fail-open 保留 stdout', () => {
  const r = classifyAntigravityCliPlainText({
    stdout: '[1]\n[1,2]',
    resumed: true,
    resumedFinalText: null,
  });
  assert.equal(r.content, '[1]\n[1,2]', 'extractor 失败保留原 stdout');
});

test('classify: fresh turn 忽略 resumedFinalText（不替换）', () => {
  const r = classifyAntigravityCliPlainText({
    stdout: 'fresh answer',
    resumed: false,
    resumedFinalText: 'should be ignored',
  });
  assert.equal(r.content, 'fresh answer');
});

// 云端 codex P2: resumed turn stdout 为空但 trajectory 提取到有效 final → 用 final，不当 empty 丢弃。
test('classify: resumed + EMPTY stdout + valid final → 用 final (云端 P2)', () => {
  const r = classifyAntigravityCliPlainText({
    stdout: '   ', // 空白 stdout（agy resume 可能不输出）
    resumed: true,
    resumedFinalText: 'recovered trajectory final',
  });
  assert.equal(r.kind, 'text', 'empty stdout 不能丢弃有效 trajectory final');
  assert.equal(r.content, 'recovered trajectory final');
  assert.equal(r.textMode, 'replace');
});

test('classify: resumed + empty stdout + NO final → empty', () => {
  const r = classifyAntigravityCliPlainText({ stdout: '', resumed: true, resumedFinalText: null });
  assert.equal(r.kind, 'empty', '无 final 时空 stdout 仍 empty');
});

test('classify: fresh turn + empty stdout → empty (不被 resumedFinalText 影响)', () => {
  const r = classifyAntigravityCliPlainText({
    stdout: '',
    resumed: false,
    resumedFinalText: 'should be ignored',
  });
  assert.equal(r.kind, 'empty');
});
