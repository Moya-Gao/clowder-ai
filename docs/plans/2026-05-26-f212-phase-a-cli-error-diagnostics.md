# F212 Phase A Implementation Plan — Backend cliDiagnostics + Sanitizer + Classifier

**Feature:** F212 — `docs/features/F212-cli-error-diagnostics.md`
**Goal:** Replace cli-spawn 的字符串 `__cliError.message` with structured `cliDiagnostics` payload (reasonCode whitelist + sanitized publicSummary/publicHint/safeExcerpt + debugRef), 把 raw stderr 屏蔽红线守住 + 给前端一个能渲染 reason 的诊断通道。
**Acceptance Criteria:** AC-A1..A9（全部 9 条，逐条覆盖 in Task 1-8）
**Architecture cell:** `agents/cli-supervisor`（cli-spawn 错误通道）
**Map delta:** none — 在 cell 内扩展 payload + 新增 sanitizer/pattern util，不改 ownership map（spec L51 已声明）
**Map delta why:** cliDiagnostics 是现有 `__cliError` event 上加结构化字段，util 文件落在 `packages/api/src/utils/` 既有目录；6 个 provider consumer 仅透传字段，无新 cell。
**Architecture:** cli-spawn 在 emit `__cliError`（exit ≠ 0）/`__cliTimeout` 时附加 `cliDiagnostics` 字段；providers 把 cliDiagnostics 透传到 error event metadata（Phase B 前端再渲染）。Sanitizer + Classifier 拆为独立 util（OQ-1 accept），regex 集中在 `cli-error-patterns.ts` 一份共享池，stderr classifier + stream-error classifier 双 entry-point（OQ-4 accept）。
**Tech Stack:** TypeScript (Node ≥ 20)，Node native test runner（`node --test`），无新增 runtime 依赖
**前端验证:** 不涉及（Phase B 的事）。Phase A 100% backend，reviewer 只需读代码 + 跑测试。

---

## Straight-Line Check

**B (finish line)**: cli-spawn / tmux-agent-spawner emit 的错误事件携带 `cliDiagnostics` 结构化字段；9 类 reasonCode 白名单 + sanitizer + safeExcerpt 抽取规则全部落地；stream error events（NDJSON 的 `error` event）也走同 classifier；`LOG_CLI_STDERR` env gate 默认关闭；测试覆盖 fuzz sanitizer + 9 类 classifier + panic stack 单测 + 旧红线回归。

**What we're NOT building**: 前端折叠面板（Phase B）/ icon 色板（Phase B）/ i18n 多语言文案表（Phase B/C，本 Phase 只 ship 中文 publicSummary+publicHint）/ alpha smoke 验证（Phase C）。

**Terminal Schema**（每步增量都向这个 schema 靠拢，不写 throwaway）：

```ts
// packages/api/src/utils/cli-diagnostics.ts （new file, exported from utils/index.ts）

export type CliErrorReasonCode =
  | 'invalid_thinking_signature'
  | 'missing_rollout'
  | 'model_not_found'
  | 'auth_failed'
  | 'quota_exceeded'
  | 'network_error'
  | 'invalid_config'
  | 'spawn_failed'
  | 'context_window_exceeded';

export interface CliDiagnostics {
  reasonCode?: CliErrorReasonCode;       // undefined = unknown stderr / unknown stream error
  publicSummary: string;                 // 总是有值（"未识别的 CLI 错误" fallback）
  publicHint: string;                    // 后端生成的人话提示
  safeExcerpt?: string;                  // 仅当 reasonCode !== undefined 时填（AC-A5）
  debugRef: {
    command: string;
    exitCode: number | null;
    signal: string | null;
    invocationId?: string;
  };
}

// 现有 __cliError event 加附加字段（不 breaking change）
export interface CliErrorEvent {
  __cliError: true;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  message: string;                       // 兼容字段：humanized summary（reasonCode || "CLI 异常退出"）
  command: string;
  reasonCode?: CliErrorReasonCode;       // 保留：旧 KD（providers 已读）
  cliDiagnostics: CliDiagnostics;        // 新增：F212 真相源
}
```

**Three Questions per Step**：每个 Task 末尾自检。

---

## Files

### Create

| 路径 | 用途 |
|------|------|
| `packages/api/src/utils/cli-error-patterns.ts` | Sanitizer regex + classifier regex shared pool（OQ-1 accept） |
| `packages/api/src/utils/sanitize-cli-stderr.ts` | Sanitizer util（先 sanitize 再截断，AC-A3） |
| `packages/api/src/utils/cli-diagnostics.ts` | Type + classifier + buildCliDiagnostics() + reasonCode→summary/hint map |
| `packages/api/test/cli-error-patterns.test.js` | Classifier 9 类 fixture + 共享 regex 单测 |
| `packages/api/test/sanitize-cli-stderr.test.js` | Fuzz sanitizer（ANSI/NFKC/path/JWT/PEM/URL/cookie/5 token/high-entropy/截尾不绕过） |
| `packages/api/test/cli-diagnostics.test.js` | buildCliDiagnostics() 单测（safeExcerpt 规则、panic stack headline、unknown fallback） |

### Modify

| 路径 | 改什么 |
|------|--------|
| `packages/api/src/utils/cli-spawn.ts` | L26 type 改为 import；L28-36 classifier 改为 import；L518-533 + L535-559 emit cliDiagnostics；L520-522 + L538-541 stderr log 走 `LOG_CLI_STDERR` env gate + sanitizer |
| `packages/api/src/domains/terminal/tmux-agent-spawner.ts` | L351 emit `__cliError` 也带 cliDiagnostics |
| `packages/api/src/utils/index.ts` | 加 export：`cli-diagnostics.js` / `sanitize-cli-stderr.js` / `cli-error-patterns.js` 选择性导出 |
| `packages/api/test/cli-spawn.test.js` | 现有 `__cliError` 断言不破；新增 cliDiagnostics 字段断言 |
| `packages/api/test/tmux-agent-spawner.test.js` | 同上（tmux 路径） |

**6 个 provider consumer 不在 Phase A 改**——cliDiagnostics 是附加字段，旧 consumer `isCliError(event)` 行为不变，他们消费 `event.message` 也仍有值。Phase B 前端折叠面板才需要 provider 把 cliDiagnostics 透传到 metadata。

---

## Tasks

### Task 1 (AC-A2 + AC-A3): Sanitizer util + fuzz tests — 先 sanitize 再截断

**Files**：
- Create: `packages/api/src/utils/cli-error-patterns.ts`（仅 sanitizer regex 段，分两部分用）
- Create: `packages/api/src/utils/sanitize-cli-stderr.ts`
- Test: `packages/api/test/sanitize-cli-stderr.test.js`

**Step 1.1: Red — write failing fuzz tests**

```js
// packages/api/test/sanitize-cli-stderr.test.js
import test from 'node:test';
import assert from 'node:assert';
import { sanitizeCliStderr } from '../dist/utils/sanitize-cli-stderr.js';

test('strips ANSI escape sequences', () => {
  const input = '\x1b[31mError\x1b[0m: thing';
  assert.strictEqual(sanitizeCliStderr(input), 'Error: thing');
});

test('strips OSC sequences (terminal title)', () => {
  const input = '\x1b]0;title\x07hello';
  assert.strictEqual(sanitizeCliStderr(input), 'hello');
});

test('NFKC normalizes fullwidth homoglyph tokens', () => {
  // U+FF53 ｓ fullwidth s — without NFKC could bypass sk- regex
  const input = 'ｓk-ABCDEFGHIJ12345abcdefgh';
  const out = sanitizeCliStderr(input);
  assert.ok(out.includes('[TOKEN_REDACTED]'));
});

test('redacts HOME path to ~/', () => {
  const home = process.env.HOME || '/Users/test';
  const input = `Error: ENOENT ${home}/foo/bar`;
  const out = sanitizeCliStderr(input);
  assert.ok(out.includes('~/foo/bar'));
  assert.ok(!out.includes(home));
});

test('redacts Windows C:\\Users\\... path', () => {
  const input = 'Error at C:\\Users\\maxzhong1997\\Desktop\\foo.exe';
  const out = sanitizeCliStderr(input);
  assert.ok(out.includes('~\\') || out.includes('~/'));
  assert.ok(!out.includes('maxzhong1997'));
});

test('redacts JWT three-segment tokens', () => {
  const input = 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NSJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  assert.ok(sanitizeCliStderr(input).includes('[JWT_REDACTED]'));
});

test('redacts PEM private key block', () => {
  const input = '-----BEGIN RSA PRIVATE KEY-----\nMIIEpAIBAAKCAQEA...\n-----END RSA PRIVATE KEY-----';
  const out = sanitizeCliStderr(input);
  assert.ok(out.includes('[PEM_REDACTED]'));
  assert.ok(!out.includes('MIIEpAIBAAK'));
});

test('redacts URL query string entirely', () => {
  const input = 'GET https://api.example.com/v1/foo?api_key=sk-abc123def456ghijk lmnop&user=bob HTTP/1.1';
  const out = sanitizeCliStderr(input);
  assert.ok(out.includes('[QUERY_REDACTED]'));
  assert.ok(!out.includes('sk-abc123'));
});

test('redacts cookie header values', () => {
  const input = 'set-cookie: session=abc123def456ghi789xyz; Path=/';
  const out = sanitizeCliStderr(input);
  assert.ok(out.includes('[COOKIE_REDACTED]'));
});

test('redacts OpenAI sk- token', () => {
  const input = 'invalid api key sk-AbCdEfGh1234567890IjKlMnOp';
  assert.ok(sanitizeCliStderr(input).includes('[TOKEN_REDACTED]'));
});

test('redacts GitHub ghp_ / github_pat_ tokens', () => {
  const ghp = 'ghp_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  const pat = 'github_pat_' + 'A'.repeat(82);
  const out1 = sanitizeCliStderr(`error: ${ghp}`);
  const out2 = sanitizeCliStderr(`error: ${pat}`);
  assert.ok(out1.includes('[TOKEN_REDACTED]'));
  assert.ok(out2.includes('[TOKEN_REDACTED]'));
});

test('redacts npm token', () => {
  const tok = 'npm_' + 'A'.repeat(36);
  assert.ok(sanitizeCliStderr(`auth ${tok}`).includes('[TOKEN_REDACTED]'));
});

test('redacts Gemini/Google AIza key', () => {
  const tok = 'AIza' + 'A'.repeat(35);
  assert.ok(sanitizeCliStderr(`api key ${tok}`).includes('[TOKEN_REDACTED]'));
});

test('redacts generic Bearer token', () => {
  const input = 'Authorization: Bearer abc.def.ghi/jkl=';
  assert.ok(sanitizeCliStderr(input).includes('[TOKEN_REDACTED]'));
});

test('redacts generic token key=value pattern', () => {
  const input = '{"api_key": "secret-abc123def456ghijklmnop"}';
  const out = sanitizeCliStderr(input);
  assert.ok(out.includes('[TOKEN_REDACTED]'));
});

test('redacts high-entropy base64 secret (≥32 chars)', () => {
  const secret = 'aB3xZ9pQ7nM2vL5kR8tY4wU6jH1fG0sD'; // 32 chars high entropy
  const out = sanitizeCliStderr(`secret=${secret}`);
  assert.ok(out.includes('[REDACTED]') || out.includes('[TOKEN_REDACTED]'));
});

test('AC-A3 critical: sanitize-then-truncate cannot bypass token via mid-truncation', () => {
  // 关键：旧 bug — truncate(.slice(-500)) 切到 token 中间 → 黑名单只看到尾部碎片
  // 必须先 sanitize 整段，再 truncate
  const tok = 'sk-' + 'X'.repeat(40); // 43 chars
  const prefix = 'A'.repeat(2000); // 2KB padding 让 token 落到中段
  const input = `${prefix}${tok}${'B'.repeat(500)}`;
  const out = sanitizeCliStderr(input);
  // sanitizer 输出**完整 sanitized 后**返回，不在内部 truncate（truncate 由 caller 控）
  // 验证：完整字符串不含原 token
  assert.ok(!out.includes(tok), `output should not contain raw token, got: ${out.slice(0, 200)}...`);
  assert.ok(out.includes('[TOKEN_REDACTED]'));
});
```

**Step 1.2: Run tests — verify all FAIL**

```bash
cd /Users/lysander/projects/relay-station/cat-cafe-F212-cli-error-diagnostics
env -u NODE_ENV pnpm --filter @cat-cafe/api build && node --test packages/api/test/sanitize-cli-stderr.test.js
```

Expected: 全部 FAIL（module not found）

**Step 1.3: Green — implement `cli-error-patterns.ts` + `sanitize-cli-stderr.ts`**

```ts
// packages/api/src/utils/cli-error-patterns.ts
// Shared regex pool (OQ-1 accept: independent util, regex source aligned with F153 TelemetryRedactor Class A)

export const SANITIZER_PATTERNS = {
  ansi: /\x1b\[[0-?]*[ -/]*[@-~]/g,
  osc: /\x1b\][^\x07]*\x07/g,
  jwt: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  pem: /-----BEGIN [A-Z ]+(?:PRIVATE KEY|CERTIFICATE)-----[\s\S]*?-----END [A-Z ]+(?:PRIVATE KEY|CERTIFICATE)-----/g,
  urlQuery: /(\?)([^\s'"<>)]+)/g,
  cookieValue: /(set-cookie|cookie):\s*[^;\n\r]+/gi,
  // Provider tokens
  openaiAnthropic: /sk-[A-Za-z0-9_-]{20,}/g,
  githubClassic: /gh[pousr]_[A-Za-z0-9]{36,}/g,
  githubPat: /github_pat_[A-Za-z0-9_]{82,}/g,
  npm: /npm_[A-Za-z0-9]{36,}/g,
  googleAIza: /AIza[0-9A-Za-z_-]{35}/g,
  bearer: /Bearer\s+[A-Za-z0-9_.\-+/=]+/g,
  genericTokenKV: /(token|api[_-]?key|secret|password)["':=\s]+([^\s,}"]{8,})/gi,
  highEntropy: /[A-Za-z0-9+/=_-]{32,}/g, // last-resort: only applied if it passes entropy check
};

// Path patterns (built dynamically because they depend on env)
export function getPathPatterns() {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const escaped = home.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return {
    homeUnix: new RegExp(escaped + '(/|$)', 'g'),
    homeWin: /C:\\Users\\[^\\]+/g,
    tmp: /\/tmp\/[^\s'"]+/g,
  };
}

// Classifier patterns (9 reasonCode, AC-A4) — exported separately for cli-diagnostics.ts
export const CLASSIFIER_PATTERNS: Array<{ code: import('./cli-diagnostics.js').CliErrorReasonCode; regex: RegExp }> = [
  { code: 'invalid_thinking_signature', regex: /Invalid [`'"]?signature[`'"]? in [`'"]?thinking[`'"]? block/i },
  { code: 'missing_rollout', regex: /no rollout found/i },
  { code: 'model_not_found', regex: /(model.*not found|Unknown model|supported API model names|model.*not supported)/i },
  { code: 'auth_failed', regex: /(401|Unauthorized|invalid api key|authentication failed)/i },
  { code: 'quota_exceeded', regex: /(429|quota|rate limit|too many requests)/i },
  { code: 'network_error', regex: /(ETIMEDOUT|ECONNREFUSED|ENOTFOUND|ECONNRESET|socket hang up|fetch failed|connect ECONN)/i },
  { code: 'invalid_config', regex: /(Error loading config\.toml|invalid transport|Failed to parse config|config.*invalid)/i },
  { code: 'spawn_failed', regex: /(ENOENT.*spawn|EACCES.*spawn|spawn.*ENOENT)/i },
  { code: 'context_window_exceeded', regex: /(context length|maximum context|context_length_exceeded|tokens exceed)/i },
];
```

```ts
// packages/api/src/utils/sanitize-cli-stderr.ts
import { SANITIZER_PATTERNS, getPathPatterns } from './cli-error-patterns.js';

/**
 * Sanitize raw stderr/output before any user-facing exposure.
 *
 * KD-2 (F212): 先 sanitize 再截断 — caller responsibility to truncate AFTER calling this.
 * AC-A2 covered patterns: ANSI/OSC, NFKC homograph, HOME/Windows/tmp paths, JWT, PEM, URL query,
 * cookie, 5 provider tokens (OpenAI/Anthropic/GitHub/npm/Google), Bearer, generic key=value, high-entropy.
 */
export function sanitizeCliStderr(input: string): string {
  if (!input) return '';

  // 1. NFKC normalize (defeat fullwidth/homograph bypass)
  let out = input.normalize('NFKC');

  // 2. Control sequences
  out = out.replace(SANITIZER_PATTERNS.ansi, '');
  out = out.replace(SANITIZER_PATTERNS.osc, '');

  // 3. Structured blobs first (JWT/PEM before token regex picks pieces)
  out = out.replace(SANITIZER_PATTERNS.jwt, '[JWT_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.pem, '[PEM_REDACTED]');

  // 4. URL query / cookie
  out = out.replace(SANITIZER_PATTERNS.urlQuery, '$1[QUERY_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.cookieValue, (m) =>
    m.replace(/:\s*[^;\n\r]+/, ': [COOKIE_REDACTED]'),
  );

  // 5. Provider tokens (specific before generic)
  out = out.replace(SANITIZER_PATTERNS.openaiAnthropic, '[TOKEN_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.githubPat, '[TOKEN_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.githubClassic, '[TOKEN_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.npm, '[TOKEN_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.googleAIza, '[TOKEN_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.bearer, 'Bearer [TOKEN_REDACTED]');
  out = out.replace(SANITIZER_PATTERNS.genericTokenKV, '$1: [TOKEN_REDACTED]');

  // 6. High-entropy fallback (only for tokens that survived all above and look secret-y)
  out = out.replace(SANITIZER_PATTERNS.highEntropy, (m) => {
    // entropy check: rough Shannon estimate — if char variety is high, redact
    const uniqueChars = new Set(m).size;
    if (m.length >= 32 && uniqueChars >= 16) return '[REDACTED]';
    return m;
  });

  // 7. Paths (last — token redactions might contain paths)
  const paths = getPathPatterns();
  if (paths.homeUnix.source !== '(/|$)') {
    out = out.replace(paths.homeUnix, '~$1');
  }
  out = out.replace(paths.homeWin, '~');
  out = out.replace(paths.tmp, '/tmp/[REDACTED]');

  return out;
}
```

**Step 1.4: Run tests — verify all PASS**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build && node --test packages/api/test/sanitize-cli-stderr.test.js
```

Expected: 全部 PASS（17 个测试）

**Step 1.5: Commit**

```bash
git add packages/api/src/utils/{cli-error-patterns,sanitize-cli-stderr}.ts packages/api/test/sanitize-cli-stderr.test.js
git commit -m "feat(F212): sanitize-cli-stderr util + fuzz tests (AC-A2/A3)"
```

**Three-Question self-check**：
- 步骤产物保留？✓ sanitizer 是 terminal schema 必备组件
- 测试证据？✓ 17 fuzz tests
- 删除代价？无 sanitizer = AC-A2/A3/A9 全部死路

---

### Task 2 (AC-A4): Classifier 扩到 9 类

**Files**:
- Modify: `packages/api/src/utils/cli-error-patterns.ts`（已在 Task 1 写 `CLASSIFIER_PATTERNS`，本 Task 测试 + 接入 cli-diagnostics.ts）
- Create: `packages/api/src/utils/cli-diagnostics.ts`（部分 — 仅 classifier function）
- Test: `packages/api/test/cli-error-patterns.test.js`

**Step 2.1: Red — classifier fixture tests**

```js
// packages/api/test/cli-error-patterns.test.js
import test from 'node:test';
import assert from 'node:assert';
import { classifyCliError } from '../dist/utils/cli-diagnostics.js';

const fixtures = [
  // Existing (must regress)
  ['Invalid `signature` in `thinking` block: foo', 'invalid_thinking_signature'],
  ['Error: no rollout found for cli session abc', 'missing_rollout'],
  // New 7
  ['The supported API model names are deepseek-v4-pro or deepseek-v4-flash', 'model_not_found'],
  ['Unknown model: foo-bar-v9', 'model_not_found'],
  ['401 Unauthorized', 'auth_failed'],
  ['invalid api key sk-xxx', 'auth_failed'],
  ['429 Too Many Requests', 'quota_exceeded'],
  ['rate limit exceeded for org foo', 'quota_exceeded'],
  ['fetch failed: connect ECONNREFUSED 127.0.0.1:9879', 'network_error'],
  ['Error: ETIMEDOUT', 'network_error'],
  ['Error loading config.toml: invalid transport', 'invalid_config'],
  ['Failed to parse config at line 3', 'invalid_config'],
  ['spawn ENOENT', 'spawn_failed'],
  ['context length exceeded: 200000 tokens', 'context_window_exceeded'],
  ['maximum context: 128000', 'context_window_exceeded'],
  // Unknown
  ['some random panic at line 42', undefined],
];

for (const [input, expected] of fixtures) {
  test(`classifies "${input.slice(0, 40)}" → ${expected ?? 'undefined'}`, () => {
    assert.strictEqual(classifyCliError(input), expected);
  });
}

test('classifies stream-style error message (issue 777 reproducer)', () => {
  // OpenCode CLI returned error event payload
  const input = 'APIError: The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you passed deepseek-v-4.';
  assert.strictEqual(classifyCliError(input), 'model_not_found');
});
```

**Step 2.2: Red — verify FAIL**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build && node --test packages/api/test/cli-error-patterns.test.js
```

Expected: FAIL（classifyCliError not defined）

**Step 2.3: Green — implement classifier in `cli-diagnostics.ts` (partial)**

```ts
// packages/api/src/utils/cli-diagnostics.ts (partial — Task 2 部分)
import { CLASSIFIER_PATTERNS } from './cli-error-patterns.js';

export type CliErrorReasonCode =
  | 'invalid_thinking_signature'
  | 'missing_rollout'
  | 'model_not_found'
  | 'auth_failed'
  | 'quota_exceeded'
  | 'network_error'
  | 'invalid_config'
  | 'spawn_failed'
  | 'context_window_exceeded';

/**
 * F212 AC-A4 + AC-A8: classify stderr OR stream error text into 9 known reasonCodes.
 * Returns undefined for unknown — callers must handle gracefully.
 */
export function classifyCliError(text: string): CliErrorReasonCode | undefined {
  if (!text) return undefined;
  for (const { code, regex } of CLASSIFIER_PATTERNS) {
    if (regex.test(text)) return code;
  }
  return undefined;
}
```

**Step 2.4: Run tests — PASS**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build && node --test packages/api/test/cli-error-patterns.test.js
```

Expected: 全部 PASS（17 fixtures + 1 stream-style）

**Step 2.5: Commit**

```bash
git add packages/api/src/utils/cli-error-patterns.ts packages/api/src/utils/cli-diagnostics.ts packages/api/test/cli-error-patterns.test.js
git commit -m "feat(F212): classifyCliError 9-reasonCode whitelist (AC-A4/A8)"
```

**Three-Question**：
- 保留？✓ classifier 是 terminal schema 核心
- 测试？✓ 18 fixtures
- 删除？删 = AC-A4/A8 死

---

### Task 3 (AC-A1 + AC-A5 + AC-A6): `buildCliDiagnostics()` — payload builder + panic stack headline + safeExcerpt 规则

**Files**:
- Modify: `packages/api/src/utils/cli-diagnostics.ts`（加 `CliDiagnostics` interface + `buildCliDiagnostics` + reasonCode 文案表）
- Test: `packages/api/test/cli-diagnostics.test.js`

**Step 3.1: Red — builder test cases**

```js
// packages/api/test/cli-diagnostics.test.js
import test from 'node:test';
import assert from 'node:assert';
import { buildCliDiagnostics } from '../dist/utils/cli-diagnostics.js';

const baseRef = { command: 'codex', exitCode: 1, signal: null, invocationId: 'inv-1' };

test('AC-A5: unknown stderr → no safeExcerpt, publicSummary fallback', () => {
  const d = buildCliDiagnostics({ rawText: 'some weird panic line', debugRef: baseRef });
  assert.strictEqual(d.reasonCode, undefined);
  assert.strictEqual(d.safeExcerpt, undefined);
  assert.match(d.publicSummary, /未识别/);
  assert.ok(d.publicHint.length > 0);
});

test('AC-A1 + AC-A5: known reasonCode → safeExcerpt filled', () => {
  const d = buildCliDiagnostics({
    rawText: 'APIError: The supported API model names are deepseek-v4-pro or deepseek-v4-flash, but you passed deepseek-v-4.',
    debugRef: baseRef,
  });
  assert.strictEqual(d.reasonCode, 'model_not_found');
  assert.ok(d.safeExcerpt && d.safeExcerpt.includes('deepseek-v4-pro'));
  assert.match(d.publicSummary, /模型/);
  assert.match(d.publicHint, /模型/);
});

test('AC-A6: panic stack — only keep headline, hide frames', () => {
  const rawText = [
    'thread "main" panicked at src/foo.rs:42:9:',
    'assertion failed: x == y',
    '   0: rust_begin_unwind',
    '             at /rustc/abc/library/std/src/panicking.rs:600:5',
    '   1: core::panicking::panic_fmt',
    '             at /rustc/abc/library/core/src/panicking.rs:64:14',
    '   2: cli::main::h12345abc',
    '             at /home/user/.cargo/registry/src/foo-1.0.0/src/main.rs:42:9',
  ].join('\n');
  const d = buildCliDiagnostics({ rawText, debugRef: baseRef });
  // panic is unknown reasonCode → no safeExcerpt at all
  // BUT publicSummary should still surface the panic headline
  assert.match(d.publicSummary, /panic/i);
  if (d.safeExcerpt) {
    // If we DO surface, frames must be stripped
    assert.ok(!d.safeExcerpt.includes('rust_begin_unwind'));
    assert.ok(!d.safeExcerpt.includes('/rustc/'));
    assert.ok(!d.safeExcerpt.includes('cli::main'));
    assert.ok(!d.safeExcerpt.includes('/home/user/.cargo'));
  }
});

test('safeExcerpt is sanitized (token redacted)', () => {
  const rawText = '401 Unauthorized: invalid api key sk-AbCdEfGh1234567890IjKlMnOpQrStUv';
  const d = buildCliDiagnostics({ rawText, debugRef: baseRef });
  assert.strictEqual(d.reasonCode, 'auth_failed');
  assert.ok(d.safeExcerpt);
  assert.ok(!d.safeExcerpt.includes('AbCdEfGh1234567890'));
  assert.ok(d.safeExcerpt.includes('[TOKEN_REDACTED]') || !d.safeExcerpt.includes('sk-'));
});

test('safeExcerpt line cap 5-8 lines, hard cap 1500 chars (OQ-3 行优先 + 1500 chars 保底)', () => {
  const longLines = Array.from({ length: 50 }, (_, i) => `line ${i}: fetch failed: connect ECONNREFUSED`).join('\n');
  const d = buildCliDiagnostics({ rawText: longLines, debugRef: baseRef });
  assert.strictEqual(d.reasonCode, 'network_error');
  assert.ok(d.safeExcerpt);
  const lineCount = d.safeExcerpt.split('\n').length;
  assert.ok(lineCount <= 8, `expected ≤8 lines, got ${lineCount}`);
  assert.ok(d.safeExcerpt.length <= 1500, `expected ≤1500 chars, got ${d.safeExcerpt.length}`);
});

test('debugRef present with exitCode/signal/command', () => {
  const d = buildCliDiagnostics({ rawText: 'spawn ENOENT', debugRef: baseRef });
  assert.strictEqual(d.debugRef.command, 'codex');
  assert.strictEqual(d.debugRef.exitCode, 1);
  assert.strictEqual(d.debugRef.signal, null);
  assert.strictEqual(d.debugRef.invocationId, 'inv-1');
});
```

**Step 3.2: Red — verify FAIL**

```bash
node --test packages/api/test/cli-diagnostics.test.js
# Expected: FAIL (buildCliDiagnostics not exported)
```

**Step 3.3: Green — implement `buildCliDiagnostics`**

```ts
// packages/api/src/utils/cli-diagnostics.ts (full)
import { classifyCliError } from './cli-diagnostics.js'; // re-export from this file
import { CLASSIFIER_PATTERNS } from './cli-error-patterns.js';
import { sanitizeCliStderr } from './sanitize-cli-stderr.js';

export type CliErrorReasonCode =
  /* ... 9 codes as above ... */;

export interface CliDiagnostics {
  reasonCode?: CliErrorReasonCode;
  publicSummary: string;
  publicHint: string;
  safeExcerpt?: string;
  debugRef: {
    command: string;
    exitCode: number | null;
    signal: NodeJS.Signals | string | null;
    invocationId?: string;
  };
}

export function classifyCliError(text: string): CliErrorReasonCode | undefined {
  if (!text) return undefined;
  for (const { code, regex } of CLASSIFIER_PATTERNS) {
    if (regex.test(text)) return code;
  }
  return undefined;
}

const REASON_TEXT: Record<CliErrorReasonCode, { summary: string; hint: string }> = {
  invalid_thinking_signature: {
    summary: 'Thinking 签名校验失败',
    hint: '换一只猫或刷新对话再试。',
  },
  missing_rollout: {
    summary: 'CLI session 找不到',
    hint: '对话上下文已被外部清理，发条新消息重建 session。',
  },
  model_not_found: {
    summary: '模型名不被支持',
    hint: '检查 CLI 配置里的模型名拼写，或参考 provider 官方支持的模型列表。',
  },
  auth_failed: {
    summary: 'API 认证失败',
    hint: '检查 .env / Console 里 provider 的 API key 是否正确。',
  },
  quota_exceeded: {
    summary: 'API 配额超限',
    hint: '当前 API key 已达限额，等几分钟再试或检查 quota 仪表盘。',
  },
  network_error: {
    summary: '网络连接失败',
    hint: '检查代理 / VPN / 防火墙；DeepSeek/OpenAI 等 provider 偶发也可能短暂不可用。',
  },
  invalid_config: {
    summary: 'CLI 配置文件无效',
    hint: '检查 config.toml / settings.json 是否被外部工具改坏（语法错误 / 字段名变更）。',
  },
  spawn_failed: {
    summary: 'CLI 进程无法启动',
    hint: '检查 CLI 是否已安装（`which codex` / `which claude` 等），或权限是否正确。',
  },
  context_window_exceeded: {
    summary: '对话上下文超长',
    hint: '开新 thread，或先清理 thread 历史再试。',
  },
};

const UNKNOWN_TEXT = {
  summary: '未识别的 CLI 错误',
  hint: '详细信息见后端日志（设 LOG_CLI_STDERR=1 启用 stderr 日志）。',
};

const MAX_LINES = 8;
const MAX_CHARS = 1500;

/**
 * Extract a sanitized excerpt from rawText: ≤8 lines AND ≤1500 chars (OQ-3 行优先 + 1500 保底).
 * KD-2: sanitize FIRST, truncate AFTER.
 * AC-A6: panic stack — only headline (first matching line), frames stripped.
 */
function extractSafeExcerpt(rawText: string, reasonCode: CliErrorReasonCode): string {
  const sanitized = sanitizeCliStderr(rawText);
  const lines = sanitized.split('\n').map((l) => l.trim()).filter((l) => l.length > 0);
  // Find the classifier-matching line + N surrounding context (5-8 lines window)
  const pattern = CLASSIFIER_PATTERNS.find((p) => p.code === reasonCode)?.regex;
  if (!pattern) return lines.slice(0, MAX_LINES).join('\n').slice(0, MAX_CHARS);
  const hitIdx = lines.findIndex((l) => pattern.test(l));
  if (hitIdx < 0) return lines.slice(0, MAX_LINES).join('\n').slice(0, MAX_CHARS);

  // AC-A6: 排除 stack frame 行（rust frame / cargo / node module / `at /` / `at /rustc`）
  const frameRegex = /^\s*\d+:\s|^\s*at\s+\/|^\s*at\s+.+\.cargo|^\s*at\s+.+node_modules|^\s+at\s+\//;
  const keep: string[] = [];
  let charBudget = MAX_CHARS;
  // headline first
  const headline = lines[hitIdx]!;
  keep.push(headline);
  charBudget -= headline.length + 1;
  // 3 lines before + 4 lines after (≤8 total), skipping frame lines
  const candidates: string[] = [];
  for (let i = Math.max(0, hitIdx - 3); i < hitIdx; i++) candidates.push(lines[i]!);
  for (let i = hitIdx + 1; i < Math.min(lines.length, hitIdx + 5); i++) candidates.push(lines[i]!);
  for (const line of candidates) {
    if (keep.length >= MAX_LINES) break;
    if (frameRegex.test(line)) continue; // AC-A6: skip stack frames
    if (charBudget < line.length) break;
    keep.push(line);
    charBudget -= line.length + 1;
  }
  return keep.join('\n').slice(0, MAX_CHARS);
}

export function buildCliDiagnostics(args: {
  rawText: string;
  debugRef: CliDiagnostics['debugRef'];
}): CliDiagnostics {
  const reasonCode = classifyCliError(args.rawText);
  const textBlock = reasonCode ? REASON_TEXT[reasonCode] : UNKNOWN_TEXT;
  // AC-A6 enhanced: if rawText contains panic, surface in summary
  const panicMatch = /thread\s+["'][^"']+["']\s+panicked at[^\n]+/i.exec(args.rawText);
  const summary = panicMatch
    ? `CLI panic: ${sanitizeCliStderr(panicMatch[0]).slice(0, 200)}`
    : textBlock.summary;

  const diagnostics: CliDiagnostics = {
    publicSummary: summary,
    publicHint: textBlock.hint,
    debugRef: args.debugRef,
  };
  if (reasonCode) {
    diagnostics.reasonCode = reasonCode;
    diagnostics.safeExcerpt = extractSafeExcerpt(args.rawText, reasonCode);
  }
  return diagnostics;
}
```

**Step 3.4: Run tests — PASS**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build && node --test packages/api/test/cli-diagnostics.test.js
# Expected: PASS (6 tests)
```

**Step 3.5: Commit**

```bash
git add packages/api/src/utils/cli-diagnostics.ts packages/api/test/cli-diagnostics.test.js
git commit -m "feat(F212): buildCliDiagnostics + panic headline + safeExcerpt rules (AC-A1/A5/A6)"
```

---

### Task 4 (AC-A7): `LOG_CLI_STDERR` env gate

**Files**:
- Modify: `packages/api/src/utils/cli-spawn.ts:520-522, 538-541`
- Test: `packages/api/test/cli-spawn.test.js`（追加 gate 单测）

**Step 4.1: Red — write gate behavior tests**

```js
// packages/api/test/cli-spawn.test.js (追加在文件末尾)
import test from 'node:test';
import assert from 'node:assert';

test('AC-A7: stderr NOT logged when LOG_CLI_STDERR unset (default)', async () => {
  // Mock spawn with non-zero exit + stderr content; capture log calls
  delete process.env.LOG_CLI_STDERR;
  const logs: any[] = [];
  const mockLog = { error: (...args: any[]) => logs.push(args), warn: () => {}, info: () => {}, debug: () => {} };
  // ... invoke spawnCli with mock spawn, capture stderr trace
  // assert that no log.error call contains 'CLI stderr (debug only)'
  assert.ok(!logs.some((l) => JSON.stringify(l).includes('CLI stderr (debug only)')));
});

test('AC-A7: stderr logged (sanitized) when LOG_CLI_STDERR=1', async () => {
  process.env.LOG_CLI_STDERR = '1';
  const logs: any[] = [];
  const mockLog = { error: (...args: any[]) => logs.push(args), warn: () => {}, info: () => {}, debug: () => {} };
  // ... invoke spawnCli with stderr containing sk-token
  const stderrLog = logs.find((l) => JSON.stringify(l).includes('CLI stderr'));
  assert.ok(stderrLog);
  // OQ-2 accept: log content also goes through sanitizer
  assert.ok(!JSON.stringify(stderrLog).includes('sk-AbC'), 'sanitizer should redact tokens in logs');
  delete process.env.LOG_CLI_STDERR;
});
```

注：cli-spawn 现有测试已用 mock spawn 模式，本 Task 复用现有 helper。如 helper 无法精确捕获 log，回落到单元测 helper function：把 log 逻辑提取到 `maybeLogCliStderr(stderr, command, logger)`（pure function）单测。

**Step 4.2: Red — verify FAIL**

```bash
node --test packages/api/test/cli-spawn.test.js
```

**Step 4.3: Green — implement gate**

```ts
// packages/api/src/utils/cli-spawn.ts (L520-522 替换)
if (stderrBuffer.trim() && process.env.LOG_CLI_STDERR === '1') {
  const sanitized = sanitizeCliStderr(stderrBuffer).slice(-1000);
  log.error({ command: options.command, stderr: sanitized }, 'CLI stderr (LOG_CLI_STDERR=1)');
}
// (L538-541 同样处理 timeout 路径)
```

`import { sanitizeCliStderr } from './sanitize-cli-stderr.js';` 加到 file 顶部 imports。

**Step 4.4: Run tests — PASS**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build && node --test packages/api/test/cli-spawn.test.js
```

**Step 4.5: Commit**

```bash
git add packages/api/src/utils/cli-spawn.ts packages/api/test/cli-spawn.test.js
git commit -m "feat(F212): LOG_CLI_STDERR env gate + sanitizer on log content (AC-A7 / OQ-2)"
```

---

### Task 5 (AC-A1 emit + AC-A8 stream error + AC-A9 红线): cli-spawn + tmux emit `cliDiagnostics`

**Files**:
- Modify: `packages/api/src/utils/cli-spawn.ts:518-559` (主 + timeout 路径)
- Modify: `packages/api/src/domains/terminal/tmux-agent-spawner.ts:351`
- Modify: `packages/api/src/utils/index.ts` (export cli-diagnostics types)
- Test: `packages/api/test/cli-spawn.test.js`（加 cliDiagnostics 字段断言）
- Test: `packages/api/test/tmux-agent-spawner.test.js`（同上）

**Step 5.1: Red — cli-spawn emit cliDiagnostics 测试**

```js
test('AC-A1: __cliError event includes cliDiagnostics with reasonCode for known stderr', async () => {
  // mock spawn child exits with code 1 + stderr 'spawn ENOENT'
  const events = await collectEvents(/* spawnCli with mock */);
  const errorEvent = events.find((e) => e.__cliError === true);
  assert.ok(errorEvent);
  assert.ok(errorEvent.cliDiagnostics);
  assert.strictEqual(errorEvent.cliDiagnostics.reasonCode, 'spawn_failed');
  assert.ok(errorEvent.cliDiagnostics.safeExcerpt);
  assert.ok(errorEvent.cliDiagnostics.debugRef.command);
});

test('AC-A1: __cliError for unknown stderr has cliDiagnostics with no reasonCode', async () => {
  // mock spawn with weird stderr
  const errorEvent = /* ... */;
  assert.strictEqual(errorEvent.cliDiagnostics.reasonCode, undefined);
  assert.strictEqual(errorEvent.cliDiagnostics.safeExcerpt, undefined);
  assert.match(errorEvent.cliDiagnostics.publicSummary, /未识别/);
});

test('AC-A9 红线: __cliError.message does NOT contain raw stderr', async () => {
  const stderr = 'super secret panic at thread main x=42';
  // mock spawn with stderr above
  const errorEvent = /* ... */;
  assert.ok(!errorEvent.message.includes('super secret'));
  // message 是 humanized summary, 不含 raw text
});

test('AC-A8: stream error event (NDJSON {type:"error"}) also gets cliDiagnostics', async () => {
  // mock spawn emit NDJSON line: {type:"error",data:{message:"401 Unauthorized"}}
  // verify that spawnCli yields a __cliError or augmented event with cliDiagnostics.reasonCode='auth_failed'
});
```

**Step 5.2: Red — FAIL**

**Step 5.3: Green — implement**

```ts
// cli-spawn.ts L518-559 (sketch — see actual diff)
import { buildCliDiagnostics } from './cli-diagnostics.js';
import { sanitizeCliStderr } from './sanitize-cli-stderr.js';

// L518 abnormal exit branch
if (!semanticDone && !killed && !isWindowsLibuvCrash && (exitCode !== 0 || exitSignal !== null)) {
  // Build cliDiagnostics from stderr buffer (or stream errors collected — see Step 5.4)
  const rawText = streamErrorTexts.length > 0 ? streamErrorTexts.join('\n') + '\n' + stderrBuffer : stderrBuffer;
  const cliDiagnostics = buildCliDiagnostics({
    rawText,
    debugRef: {
      command: options.command,
      exitCode,
      signal: exitSignal,
      invocationId: options.invocationId,
    },
  });
  // AC-A7 + OQ-2: gate + sanitize log
  if (stderrBuffer.trim() && process.env.LOG_CLI_STDERR === '1') {
    const sanitized = sanitizeCliStderr(stderrBuffer).slice(-1000);
    log.error({ command: options.command, stderr: sanitized, reasonCode: cliDiagnostics.reasonCode }, 'CLI stderr (LOG_CLI_STDERR=1)');
  }
  yield {
    __cliError: true,
    exitCode,
    signal: exitSignal,
    message: cliDiagnostics.publicSummary, // humanized only — no raw stderr (AC-A9 红线)
    command: options.command,
    ...(cliDiagnostics.reasonCode ? { reasonCode: cliDiagnostics.reasonCode } : {}),
    cliDiagnostics,
  };
}

// L535 timeout branch — same builder
```

**Step 5.4: AC-A8 stream error collection**

需要 cli-spawn 在 NDJSON parse 时收集 `event.type === 'error'` 的 `event.data?.message`：

```ts
// 已有 NDJSON parser 主循环（实际位置见 cli-spawn.ts，read 后定位）
// 在 parse event 后:
const streamErrorTexts: string[] = [];
// ...
if (parsed && typeof parsed === 'object' && 'type' in parsed && (parsed as { type: string }).type === 'error') {
  const data = (parsed as { data?: { message?: string } }).data;
  if (data?.message) streamErrorTexts.push(data.message);
}
```

在 abnormal exit / timeout 时把 streamErrorTexts 喂给 buildCliDiagnostics。

**Step 5.5: tmux-agent-spawner 同步**

```ts
// tmux-agent-spawner.ts L351
import { buildCliDiagnostics } from '../../utils/cli-diagnostics.js';
// ... when emitting __cliError:
yield {
  __cliError: true,
  // ... existing fields ...
  cliDiagnostics: buildCliDiagnostics({
    rawText: stderrBuffer ?? '',
    debugRef: { command: opts.command, exitCode, signal, invocationId: opts.invocationId },
  }),
};
```

**Step 5.6: Run tests — PASS**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api build && node --test packages/api/test/cli-spawn.test.js packages/api/test/tmux-agent-spawner.test.js
```

**Step 5.7: Commit**

```bash
git add packages/api/src/utils/cli-spawn.ts packages/api/src/domains/terminal/tmux-agent-spawner.ts packages/api/src/utils/index.ts packages/api/test/cli-spawn.test.js packages/api/test/tmux-agent-spawner.test.js
git commit -m "feat(F212): cli-spawn + tmux emit cliDiagnostics + stream error coverage (AC-A1/A8/A9)"
```

---

### Task 6: 整体回归 + gate

**Step 6.1: 跑全 api 测试 + redis 隔离测试**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api test 2>&1 | tail -30
env -u NODE_ENV pnpm --filter @cat-cafe/api test:redis 2>&1 | tail -10  # 只跑 redis 子集
```

Expected: 全绿 OR 列出新 fail（debug 到绿）

**Step 6.2: tsc --noEmit + biome**

```bash
env -u NODE_ENV pnpm --filter @cat-cafe/api lint
env -u NODE_ENV pnpm biome check packages/api/src/utils/cli-{spawn,diagnostics,error-patterns}.ts packages/api/src/utils/sanitize-cli-stderr.ts
```

注：用 `pnpm biome`（project toolchain 2.4.1）而非 `npx biome`（教训 `feedback_verify_with_repo_toolchain`）。

**Step 6.3: quality-gate skill checklist**

按 quality-gate 跑：
- 全部 9 个 Phase A AC ✓
- 测试覆盖 ✓
- 回归红线（raw stderr 不进 message）单测 ✓
- LSP 诊断干净 ✓

**Step 6.4: Commit gate result + Phase A close marker**

```bash
git commit -m "test(F212): Phase A regression all green + lint clean" --allow-empty
```

---

### Task 7: 发 review request → 砚砚

按 `request-review` skill：
- Reviewer: @codex 砚砚（spec Review Gate 指定）
- 五件套：自评 / 测试证据 / OQ 状态 / 红线检查 / known limitations
- 留下"如果判断错了我最可能错在哪"清单（`feedback_pre_register_retraction_conditions`）

---

## Open Questions

**技术 OQ**（实现期自决）：
- `streamErrorTexts` 的精确接入点：cli-spawn 的 NDJSON parse loop 在哪条线，需要 Read cli-spawn.ts 完整文件再定位（Task 5.4 实施时做）
- 行优先 + 1500 chars 切片在多语言（中文字符 byte vs char）下的对齐：Node 字符串 length 用 UTF-16 code units，安全用 `.length` 即可，1500 chars 实际约 750 中文字 + 1500 英文字 = 远超用户阅读量

**价值 OQ**（CVO 判断）：无。Phase A 全是 backend mechanical 实施，spec OQ-1..5 已固化。

---

## Risk Mitigation

| 风险 | 缓解 |
|------|------|
| 改 cli-spawn 影响 6 个 provider | 附加字段不 breaking；providers 在 Phase B 才需要消费 cliDiagnostics |
| sanitizer fuzz miss 某类 token | 17 fuzz tests + spec OQ-1 列了 11 类来源；F153 align；高熵兜底 |
| panic stack frame regex 漏 | 显式单测 rust + node + python 三种 frame 模式 |
| classifier 误判（A→B 类别） | reasonCode 仅决定文案 + safeExcerpt window，错分不破红线 |

---

## Timeline (Plan-only Estimate)

- Task 1: 60-90 min（sanitizer 是最复杂的，17 fuzz 测 + impl）
- Task 2: 20-30 min（classifier 直接的）
- Task 3: 60-90 min（builder + panic 处理 + safeExcerpt 切片）
- Task 4: 30 min（env gate）
- Task 5: 60-90 min（cli-spawn 落地 + tmux + stream error collection）
- Task 6-7: 30-45 min（gate + review request）

总 ~5-6 hours，单天可完成 Phase A。

[宪宪/Opus-4.7🐾]
