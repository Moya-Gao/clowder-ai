---
feature_ids: [F210]
related_features: [F053, F061, F089, F118, F149, F161, F179, F197, F198, F201]
topics: [antigravity, gemini, cli, migration, provider]
doc_kind: spec
created: 2026-05-22
---

# F210: Gemini CLI to Antigravity CLI Migration

> **Status**: in-progress | **Owner**: 缅因猫（砚砚） | **Priority**: P1

Architecture cell: `transport`
Map delta: none
Why: F210 replaces the headless Google agent carrier behind the existing Siamese invocation path; it does not introduce a new message transport boundary.

## Why

Google announced on 2026-05-19 that Antigravity CLI is the new terminal experience for Google Antigravity, and that consumer Gemini CLI / Gemini Code Assist IDE requests stop being served on 2026-06-18 for Google AI Pro, Ultra, and Gemini Code Assist for individuals users. Enterprise/Google Cloud access is explicitly different: Gemini CLI remains accessible for Standard/Enterprise licenses and via paid Gemini / Gemini Enterprise Agent Platform API keys.

Before F210, Cat Cafe's non-ACP Siamese path used `GeminiAgentService` with `GEMINI_ADAPTER=gemini-cli`, spawning the local `gemini` binary with `-p ... -o stream-json -y`. Phase F migrates that non-ACP default carrier to `GEMINI_ADAPTER=antigravity-cli` / `agy --print` while preserving `gemini-cli` as an explicit fallback for enterprise/API-key cases. Current runtime catalog entries with an `acp` section still bypass `GeminiAgentService` and instantiate `GeminiAcpAdapter` / `gemini --acp`; AGY cannot replace that path until it exposes a supported ACP server mode. This is not an Antigravity Desktop reliability bug: F201 closed the Desktop/MCP callback reliability contract; F210 is the headless Google CLI carrier migration.

## Current Fact Baseline

| Fact | Evidence | Consequence |
|------|----------|-------------|
| Antigravity CLI is available now and shares Antigravity 2.0's agent harness | Google Developers Blog, 2026-05-19 | Treat it as the intended successor carrier, not a speculative alternative |
| Gemini CLI consumer requests stop on 2026-06-18, but enterprise/API key access remains | Google Developers Blog, 2026-05-19 | Keep `gemini-cli` as an explicit fallback/enterprise adapter until the contract is settled |
| Antigravity CLI install is a native binary bootstrapper, not an npm package | `https://antigravity.google/cli/install.sh`, fetched 2026-05-22 | Existing npm packaging/offline install scripts need a different path |
| The installed binary name is `agy` | Official installer script sets `BINARY_PATH="$TARGET_DIR/agy"` | Do not write migration code assuming `antigravity` or `@google/antigravity-cli` |
| `antigravity` and `agy` are different binary surfaces | Current Desktop adapter spawns `antigravity chat --mode agent`; official CLI installer writes `agy` | Treat `antigravity` as Desktop app CLI entry and `agy` as the standalone Antigravity CLI carrier |
| Phase A started with Gemini CLI `0.38.2` and no global `agy`; Phase G installed global `agy 1.0.1` and local Gemini CLI is now `0.42.0` | Phase A recon; `docs/features/assets/F210/phase-g-acp-probe-2026-05-23.md` | The default runtime can now find `agy`, but model/profile routing still needs a deterministic selector contract |
| Existing Cat Cafe `antigravity` adapter is Desktop/MCP callback, not Antigravity CLI | `GeminiAgentService.invokeAntigravity()` spawns `antigravity chat --mode agent` detached and requires `callbackEnv` | Add a distinct `antigravity-cli` adapter; avoid reusing the ambiguous old name |
| Antigravity reasoning models include Gemini 3.1 Pro (high/low), Gemini 3 Flash, Claude Sonnet 4.6 (thinking), Claude Opus 4.6 (thinking), and GPT-OSS-120b | `https://antigravity.google/docs/models`, fetched 2026-05-23 | Multi-model targets are real product surfaces, but Cat Cafe still needs a deterministic model-selection contract before exposing per-cat AGY profiles |
| Antigravity CLI exposes `/model` as an interactive persistent configuration command | `https://antigravity.google/docs/cli-features`, fetched 2026-05-23 | A sticky default model is not the same as a per-invocation `--model` flag; do not claim per-cat isolation until settings behavior is verified |
| Antigravity pricing currently lists Gemini 3.5 Flash access | `https://antigravity.google/pricing`, fetched 2026-05-23 | Treat `gemini-3.5-flash` as a desired profile pending exact selector/settings id verification |
| AGY starts a local language-server control plane during CLI runs | Local `agy 1.0.1` logs show random localhost HTTPS/gRPC and HTTP ports; `docs/features/assets/F210/phase-g-interactive-api-probe-2026-05-23.md` | An F198-like AGY carrier should investigate the structured local API before falling back to PTY/tmux screen scraping |
| AGY's local HTTP/Connect API exposes read-only model/conversation/MCP state | `GetConversationMetadata`, `GetCascadeModelConfigData`, `GetAvailableModels`, and `GetMcpServerStates` responded over the logged HTTP port | Candidate model ids and MCP state are discoverable, but send/stream/model-select semantics are not proven enough for runtime routing |
| Runtime catalog ACP takes precedence over `GeminiAgentService` adapter selection | `packages/api/src/index.ts` calls `getAcpConfig(id)` first and instantiates `GeminiAcpAdapter` when present | The Phase F default switch affects non-ACP Google routes; it does not automatically move existing ACP cats from `gemini --acp` to `agy` |
| Gemini CLI exposes ACP (`gemini --acp`), but AGY CLI `1.0.1` does not expose a supported/documented ACP server mode | `gemini --help`; `agy --help`; `agy help acp`; `docs/features/assets/F210/phase-g-acp-probe-2026-05-23.md` | If AGY later ships ACP, prefer that route; until then do not swap `agy` into `GeminiAcpAdapter` or claim `/model` is programmatically controllable |

## Scope

### In Scope

- Add a first-class `antigravity-cli` headless adapter for Siamese.
- Preserve `gemini-cli` as an opt-in fallback for Enterprise/API-key cases while consumer default migrates.
- Rename or alias the current Desktop adapter clearly enough that `antigravity` no longer means two different products.
- Verify Antigravity CLI headless protocol before parser changes: NDJSON compatibility, ACP compatibility, or a new parser.
- Update installer/build scripts for native `agy` distribution on macOS/Linux/Windows.
- Update docs and env descriptions so users understand the consumer deadline and enterprise exception.

### Out of Scope

- Reopening F201 Desktop reliability unless this migration discovers a shared bridge bug.
- Migrating Bengal Desktop workflows. F210 is the Siamese headless carrier.
- Deleting all Gemini CLI support before the enterprise/API-key path is proven unnecessary.
- Assuming model or cat identity from product name alone. Cat identity remains Cat Cafe `catId` + configured carrier/model profile.

## What

### Phase A: Official CLI Recon

Install/probe Antigravity CLI in an isolated path, without changing runtime/global defaults until the contract is known.

- Confirm official install path for macOS, Linux, and Windows.
- Capture `agy --help` / auth / headless invocation flags.
- Verify whether `agy` supports non-interactive prompt mode, subprocess-friendly output mode, session resume, model selection, working-directory/include-directory controls, and MCP config migration.
- Verify `agy` auth model: OAuth device flow vs API key vs inherited Desktop credentials, including whether headless non-interactive startup is possible.
- Verify MCP config loading and conflict controls: default Antigravity MCP directories, `--no-mcp`, `--mcp-config`, or equivalent.
- Verify sandbox/permission model and whether an auto-approve flag equivalent to Gemini CLI `-y` exists.
- Produce raw event fixtures for at least text-only, tool use, error, and interrupted sessions.

### Phase B: Adapter Contract

Add a typed adapter contract that separates all three meanings:

| Adapter | Meaning | Expected surface |
|---------|---------|------------------|
| `gemini-cli` | Legacy Gemini CLI | `gemini -p ... -o stream-json -y` |
| `antigravity-cli` | New headless Antigravity CLI | `agy ...` after Phase A verifies flags |
| `antigravity-desktop` | Existing Desktop/MCP callback path | Detached Desktop app + callbackEnv |

Implementation must keep backward compatibility for existing `GEMINI_ADAPTER=antigravity` while warning or aliasing it to the Desktop name.

### Phase C: Parser / Session Migration

Based on Phase A fixtures:

- Reuse `gemini-event-parser.ts` only if Antigravity CLI emits compatible NDJSON.
- Otherwise add `antigravity-cli-event-parser.ts` or ACP mapping without forcing Gemini event shapes onto a different protocol.
- Preserve session metadata, token usage, liveness warnings, image path hints, and cancellation semantics where the new CLI supports equivalents.
- Define fallback behavior for unsupported `--resume` or model override.

### Phase D: Install / Packaging

Replace npm-package assumptions with native-binary installation:

- `scripts/install.sh` / `scripts/install.ps1`
- `desktop/scripts/build-mac.sh`
- `desktop/scripts/build-desktop.ps1`
- `desktop/scripts/post-install-offline.ps1`
- `packages/api/src/utils/cli-resolve.ts`
- `packages/api/src/utils/cli-spawn-win.ts`

Offline packaging must explicitly decide whether to vendor the native `agy` binary, call the official bootstrapper, or skip with a clear post-install instruction.

### Phase E: Tests / E2E

- Unit tests for adapter selection, missing CLI hint, argument construction, event parsing, and legacy alias behavior.
- Integration tests for wiring cases that currently hard-code `adapter: 'gemini-cli'`.
- E2E smoke: Cat Cafe invokes Siamese through `antigravity-cli` and gets a normal final reply.
- Regression smoke: `gemini-cli` fallback still works when explicitly selected.

### Phase F: Docs / Truth Sync

- README variants and `docs/env-reference.md`.
- `docs/architecture/cli-integration.md`.
- F053/F061/F149/F161/F197/F201 cross-links where they currently describe Gemini CLI or Antigravity Desktop semantics.
- Any public install instructions that still point consumer users to `@google/gemini-cli` as the default path.

### Phase G: AGY Multi-Model Profiles

Add deterministic Cat Cafe profiles for Antigravity CLI only after the model-selection surface is verified.

- Minimum target profile set: Claude Opus 4.6 (thinking), Gemini 3.1 Pro, and Gemini 3.5 Flash.
- Prefer an ACP-based integration if AGY adds a supported ACP server mode, because Gemini ACP already gives Cat Cafe a programmatic session/model/tool lifecycle.
- Verify whether `~/.gemini/antigravity-cli/settings.json`, `/model`, statusline metadata, or another supported surface exposes stable model ids.
- Probe AGY's local language-server API before adopting an interactive PTY bridge: message send, update stream, cancellation, model selection, and MCP/tool event visibility must be proven from structured APIs first.
- Verify Cat Cafe can run AGY with auto-approval (`--dangerously-skip-permissions`, the AGY equivalent of yolo) for unattended agent turns. Human approval prompts are not a viable runtime boundary for Cat Cafe cats executing scripts.
- Verify per-cat profile sandboxing: each logical AGY cat must have isolated HOME / AGY config state, model setting, trusted worktree, MCP config, and permission posture before Cat Cafe exposes multiple AGY profiles.
- Prove profile isolation before adding user-facing cats: one Cat Cafe invocation must not silently inherit another profile's sticky AGY default.
- Keep PTY/tmux wrapping as an F089/F198-style rescue/oversight fallback only if the structured API is insufficient; ANSI terminal output is not a primary event protocol.
- If AGY remains sticky/global without a per-invocation override, expose a preflight/onboarding warning instead of pretending per-cat model routing is deterministic.

## 需求点 Checklist

| ID | 需求点（铲屎官原话/转述） | AC 编号 | 验证方式 | 状态 |
|----|---------------------------|---------|----------|------|
| R1 | “Gemini CLI 要落日了，直接换 Antigravity CLI？” | AC-A1, AC-E1 | official source + E2E smoke | [x] |
| R2 | “改成符合现在事实的版本” | AC-A1, AC-F1 | source-linked spec + review | [x] |
| R3 | “孟加拉猫可以 review 你的版本” | AC-F2 | cross-cat review note | [x] |
| R4 | 现有 `antigravity` adapter 名称会和新 CLI 混淆 | AC-B1, AC-B2 | adapter unit tests | [x] |
| R5 | 不要把企业例外/旧 fallback 写没 | AC-E2, AC-E4 | fallback tests + docs | [x] |
| R6 | “antigravity-cli 至少要接入 Opus / Gemini 3.1 Pro / 3.5 Flash” | AC-G1, AC-G2, AC-G3 | official model docs + local AGY settings/probe + E2E smoke per profile | [ ] |
| R7 | “AGY 也得开 yolo；隔离不同猫要验证 HOME/AGY config sandbox，并给 worktree 权限” | AC-G4, AC-G5 | profile-sandbox smoke with `--dangerously-skip-permissions`, isolated settings/MCP/trusted workspace, and worktree access probe | [ ] |
| R8 | “像 F198 拯救布偶猫那样接入 AGY 互动式 CLI？” | AC-G6 | local language-server API probe + PTY fallback smoke + carrier decision packet | [ ] |

### 覆盖检查

- [x] 每个需求点都能映射到至少一个 AC
- [x] 每个 AC 都有验证方式
- [x] 前端需求已准备需求→证据映射表（若适用；本 feature 无前端 UI）

## Acceptance Criteria

### Phase A（Official CLI Recon）

- [x] AC-A1: Spec/recon note cites Google official transition timeline and enterprise exception.
- [x] AC-A2: Recon records exact `agy` install, headless command, subprocess-friendly output mode if any, resume, model, and cwd/include-dir behavior.
- [ ] AC-A3: Raw Antigravity CLI fixtures exist for success text, tool use, result/error, and interrupted run.
- [x] AC-A4: Recon records `agy` auth model, headless non-interactive auth feasibility, and whether it shares credentials with Antigravity Desktop.
- [ ] AC-A5: Recon records `agy` MCP config loading behavior and whether it supports `--no-mcp` / `--mcp-config` or equivalent conflict controls.
- [x] AC-A6: Recon records `agy` sandbox/permission model and whether it has an auto-approve flag equivalent to Gemini CLI `-y`.

Phase A recon source: `docs/features/assets/F210/phase-a-recon-2026-05-22.md`.

AC-A3 remains open only for the remaining provider-error and manual in-flight interruption fixtures. The follow-up headless spike captured successful text, tool-use, resume, timeout, auth-required/OAuth, keyring auth + missing-model, unsupported flags, and auth interruption fixtures. `agy --print` can now complete on this machine after silent keyring auth fetches an account-side selected model override, but AGY CLI 1.0.1 still exposes no top-level `--model` flag.

AC-A5 remains open because successful `agy --print` now shows runtime MCP schema materialization under `~/.gemini/antigravity-cli/mcp`, but config precedence, settings-level disable/override controls, and Cat Cafe callbackEnv compatibility are not fully verified. Launch-time `--no-mcp` / `--mcp-config` flags remain absent in 1.0.1.

### Phase B（Adapter Contract）

- [x] AC-B1: `GeminiAdapter` supports `antigravity-cli` distinctly from Desktop callback.
- [x] AC-B2: Existing `GEMINI_ADAPTER=antigravity` behavior is preserved via alias or migration warning, not silently repointed to `agy`.
- [x] AC-B3: Missing CLI error for `antigravity-cli` names the official install route and `agy` binary.

Phase B adapter prototype source: `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts`.

The prototype intentionally maps `antigravity-cli` to the standalone `agy` binary while keeping legacy `antigravity` on the Desktop/MCP callback path. `agy --print` stdout is treated as plain final text via the shared CLI spawn layer's `plainText` mode so tmux `spawnCliOverride` / observability remains available. As of the 2026-05-31 AGY 1.0.3 refresh, fresh AGY turns must not pass a made-up `--conversation` id: AGY ignores unknown IDs and creates its own UUID. Cat Cafe now passes an internal `--log-file`, extracts the AGY-created conversation UUID from print-mode logs, emits that real id in `session_init`, and uses `--conversation <real-id>` only on subsequent resumes. Stdout timeout and missing-model strings are classified as first-class errors because AGY can emit those on stdout and still exit 0.

### Phase C（Parser / Session Migration）

- [x] AC-C1: Parser tests cover actual Antigravity CLI event fixtures; no unverified Gemini fixture reuse.
- [x] AC-C2: Session metadata and final `done` semantics match existing Cat Cafe `AgentMessage` invariants.
- [x] AC-C3: Unsupported resume/model/image features have explicit degradation behavior and tests.

Phase C parser/session source: `packages/api/src/domains/cats/services/agents/providers/antigravity-cli-event-parser.ts`, with fixture-backed tests in `packages/api/test/antigravity-cli-event-parser.test.js` and service boundary tests in `packages/api/test/gemini-agent-service.test.js`.

`agy --conversation <id>` is the supported stable session path for an already-created AGY conversation UUID. Because F210 resume fixtures showed print-mode stdout can replay previous assistant text plus the new answer, resumed AGY text is emitted with `textMode: replace` rather than treated as a streaming delta. AGY 1.0.3 also proved that an unknown `--conversation` id is not a create-or-resume handle: AGY prints `conversation "<id>" not found`, ignores the flag, and creates a different UUID. The adapter therefore records the log-observed UUID on fresh turns, and classifies resumed conversation-not-found warnings as `missing_session` so Cat Cafe's session self-heal can drop the stale id. AGY per-call model override remains unsupported: adapter metadata marks the model unverified/account-selected, and a requested Cat Cafe model override produces `system_info` diagnostics instead of silently pretending `--model` was applied. Image inputs degrade to local path hints plus `--add-dir` access; no native image flag is invented.

### Phase D（Install / Packaging）

- [x] AC-D1: macOS/Linux installer scripts install or instruct `agy` via official bootstrapper, not `@google/gemini-cli`.
- [x] AC-D2: Windows installer/build scripts have a verified native `agy` path or explicit unsupported message.
- [x] AC-D3: Offline desktop packaging handles native binary distribution intentionally.

Phase D install/packaging source: `scripts/install.sh`, `scripts/install.ps1`, `scripts/windows-command-helpers.ps1`, `desktop/scripts/build-mac.sh`, `desktop/scripts/build-desktop.ps1`, `desktop/scripts/post-install-offline.ps1`, `desktop/installer/cat-cafe.iss`, and `desktop/scripts/generate-desktop-config.ps1`.

Cat Cafe installers now provision `agy` through Google's native bootstrapper (`https://antigravity.google/cli/install.sh` / `.cmd`) and resolve the Windows native binary at `%LOCALAPPDATA%\agy\bin\agy.exe`. Desktop offline packages intentionally ship `agy-install-instructions.txt` instead of pretending the old `@google/gemini-cli` npm package is a vendorable Antigravity CLI replacement.

### Phase E（Tests / E2E）

- [x] AC-E1: `GEMINI_ADAPTER=antigravity-cli` can invoke Siamese end-to-end from Cat Cafe.
- [x] AC-E2: `GEMINI_ADAPTER=gemini-cli` remains explicitly testable as fallback.
- [x] AC-E3: Existing wiring tests no longer assume `gemini-cli` is the only headless Google carrier.
- [x] AC-E4: Default adapter changes only after AC-E1 is green.

Phase E E2E source: `docs/features/assets/F210/phase-e-e2e-smoke-2026-05-23.md`.

The live smoke routed the non-ACP `GeminiAgentService({ catId: "gemini" })` path with `GEMINI_ADAPTER=antigravity-cli`, process-local `PATH=/tmp/cat-cafe-f210-agy-bin:$PATH`, `agy 1.0.1`, and real HOME keyring auth. It returned a normal final reply containing `CAT_CAFE_AGY_E2E_OK` in about 14.3s, with `session_init` metadata `modelVerified: false` and no leaked fresh-conversation warning after the parser regression fix.

AC-E4 is closed in Phase F for the non-ACP `GeminiAgentService` path: after AC-E1 live smoke passed, the service default adapter changed to `antigravity-cli`. Catalog ACP routes remain `GeminiAcpAdapter` unless their `acp` section is removed or AGY gains a compatible ACP mode. `GEMINI_ADAPTER=gemini-cli` remains an explicit fallback and is still covered by wiring/service tests.

### Phase F（Docs / Truth Sync）

- [x] AC-F1: README/env/architecture docs explain consumer deadline, enterprise exception, and Antigravity CLI default.
- [x] AC-F2: Review request to `@antig-opus` includes the fact corrections from this spec.
- [x] AC-F3: `docs/features/index.json` and `docs/BACKLOG.md` are in sync with F210.

Phase F source: `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts`, `packages/api/src/config/env-registry.ts`, README variants, `docs/env-reference.md`, `docs/architecture/cli-integration.md`, and `docs/mailbox/2026-05-23-f210-phase-f-review-request-to-antig-opus.md`.

The non-ACP `GeminiAgentService` default route is now `antigravity-cli` when neither constructor options nor `GEMINI_ADAPTER` override it. The runtime catalog still checks `acp` first, so existing Siamese ACP entries remain on `gemini --acp`. The explicit fallback remains `GEMINI_ADAPTER=gemini-cli`, preserving enterprise/API-key access and the old NDJSON parser path. The legacy `GEMINI_ADAPTER=antigravity` value still means Desktop/MCP callback and is not silently repointed to `agy`.

### Phase G（AGY Multi-Model Profiles）

- [ ] AC-G1: Spec/recon records official Antigravity reasoning model availability and the exact AGY model-selection storage surface.
- [ ] AC-G2: Cat Cafe can select or verify at least Claude Opus 4.6 (thinking), Gemini 3.1 Pro, and Gemini 3.5 Flash without cross-cat sticky-state bleed.
- [ ] AC-G3: Runtime preflight reports a clear actionable warning when AGY is missing, no default model is selected, or requested profile selection cannot be verified.
- [ ] AC-G4: Cat Cafe AGY invocations run with an explicit auto-approval policy (`--dangerously-skip-permissions`) only inside an isolated AGY profile sandbox; no unattended runtime path may depend on interactive permission prompts.
- [ ] AC-G5: Profile-sandbox smoke proves each AGY profile can access its assigned worktree and MCP config while keeping `~/.gemini/antigravity-cli/settings.json` / `trustedWorkspaces` / permissions isolated from other profiles.
- [ ] AC-G6: Interactive-carrier spike proves the preferred structured control plane, or explicitly rejects it and documents the PTY/tmux fallback boundaries before any user-facing AGY interactive bridge ships.

Phase G starts from the current constraint: `GeminiAgentService.invokeAntigravityCLI()` intentionally reports `model: account-selected (antigravity-cli)` and emits `antigravity_cli_model_override_unsupported` when a Cat Cafe model override is requested. This is correct until a stable model id/config contract is proven. The immediate runtime update after PR #1863 only switches the non-ACP Google service default to AGY; it does not move catalog ACP cats off `gemini --acp`, and it does not mean Opus/Gemini profile routing is deterministic.

Phase G ACP probe source: `docs/features/assets/F210/phase-g-acp-probe-2026-05-23.md`. Current result: `agy 1.0.1` is globally installed and `agy --print` works, but AGY does not expose a supported/documented ACP server mode. Gemini CLI `0.42.0` still exposes `--acp`, `--model`, and `stream-json`; AGY exposes interactive `/model` plus persistent `~/.gemini/antigravity-cli/settings.json` model selection instead. Do not route AGY through `GeminiAcpAdapter` unless a future AGY release adds a compatible ACP surface.

Phase G interactive/API probe source: `docs/features/assets/F210/phase-g-interactive-api-probe-2026-05-23.md`. Current result: AGY interactive mode can be driven from a PTY, but the stronger F198-like lead is AGY's local language-server HTTP/Connect API. Read-only endpoints expose conversation metadata, model catalog/config, and MCP server state. Message send/update-stream/model-selection semantics remain unproven, so this is a spike lead rather than a runtime carrier yet.

Phase G must treat approval policy and model isolation as the same design surface: `--dangerously-skip-permissions` is required for unattended Cat Cafe operation, but it is only acceptable after the invocation is confined to a per-cat AGY profile sandbox with explicit worktree/MCP access. A shared global HOME with a shared `settings.json` would couple model choice, workspace trust, and permission posture across cats, so it is not a valid multi-profile architecture.

## Dependencies

- **Evolved from**: F053（Gemini session resume behavior must be revalidated under `agy`）
- **Related**: F061（Antigravity Desktop is a different surface; naming must not collide）
- **Related**: F118（CLI liveness/watchdog behavior must carry over）
- **Related**: F149 / F161（If Antigravity CLI exposes ACP instead of NDJSON, reuse ACP runtime policy rather than inventing a fourth carrier model）
- **Related**: F179（Desktop installer/offline packaging implications）
- **Related**: F197（Tool result surfacing contracts if the new CLI uses ACP-like tool events）
- **Related**: F201（Desktop reliability remains separate; shared lessons apply to recovery/liveness only）

## Risk

| 风险 | 缓解 |
|------|------|
| `agy` supports only plain final-text stdout, not a subprocess event stream | Prototype with a dedicated plain-text parser; keep resume/tool/timeout fixtures as parser tests and pivot to MCP/ACP only if tool/result fidelity proves insufficient |
| Antigravity CLI does not expose NDJSON stream-json | Phase A fixture first; choose new parser or ACP mapping before code migration |
| `agy --print` can authenticate but fail before execution when no account-side default model is selected | Implement a preflight/onboarding error before default switch; do not assume Cat Cafe can choose model from env until a setting or CLI flag is verified |
| Native `agy` install cannot be vendored cleanly for offline desktop builds | Keep installer decision explicit in Phase D; do not fake npm package availability |
| Consumer deadline overgeneralized into “Gemini CLI is dead for everyone” | Preserve enterprise/API-key fallback and document exact scope |
| Adapter name collision causes Desktop callback path to break | Add `antigravity-cli` as new name and alias old Desktop behavior deliberately |
| Default switch before E2E green breaks Siamese | AC-E4 blocks default flip until live smoke passes |
| `agy --conversation` stdout may include prior assistant output | Treat resume parsing as separate from new-conversation parsing; do not assume stdout is response delta-only |
| `agy --print-timeout` can emit timeout on stdout and exit 0 | Classify timeout/error text or logs explicitly; exit code alone is not a success signal |
| `agy --print` may load user/global MCP servers that compete with Cat Cafe-injected MCP servers | Phase B must choose an MCP isolation policy before enabling tool use: disable/override if AGY exposes a supported control, or run with a documented compatibility matrix for shared servers |
| AGY model selection is sticky/global rather than per invocation | Phase G must verify settings isolation or fail closed with preflight diagnostics; never expose Opus/Gemini AGY cats that silently inherit another profile's selected model |
| Treating AGY `/model` as equivalent to Gemini ACP `unstable_setSessionModel` would create false per-cat isolation | Phase G ACP probe confirms AGY 1.0.1 has no supported ACP server mode; only use ACP semantics after AGY exposes a compatible server surface |
| AGY interactive permission prompts block unattended Cat Cafe turns and train users to approve unread scripts | Phase G requires `--dangerously-skip-permissions` for AGY runtime paths, paired with profile sandboxing and explicit worktree/MCP scoping |
| Isolating HOME/AGY config may accidentally remove trusted workspace or MCP access | Profile-sandbox smoke must prove `trustedWorkspaces`, MCP config, and assigned worktree access are present for each cat profile before enabling it |
| AGY local language-server API is undocumented and may change | Treat it as a spike candidate, not a production contract, until message send/stream/cancel/model-select semantics are fixture-backed and version-guarded |
| PTY/tmux interactive wrapping loses structured events | Use PTY for observation/manual takeover only unless no structured carrier exists; ANSI screen parsing must not silently replace AgentMessage/tool event semantics |

## Open Questions

| # | 问题 | 状态 |
|---|------|------|
| OQ-1 | What exact headless command and subprocess-friendly output mode, if any, does `agy` support? | Answered for prototype — `--print` / `--prompt`; stdout is plain final text for new successful runs; no JSON/NDJSON flag; timeout prints stdout error and exits 0 |
| OQ-2 | Does `agy` support session resume with stable IDs? | Answered for implementation — use `--conversation <AGY-created UUID>`; fresh turns must first capture the real UUID from AGY logs because arbitrary IDs are ignored, and resumed stdout may replay previous assistant text so Cat Cafe emits it as `textMode: replace` rather than assuming delta-only output |
| OQ-3 | Does `agy` support model override, and how does that map to Cat Cafe cat identity? | Partial — no top-level `--model`; official CLI docs expose interactive `/model` persistent selection; deterministic per-cat model selection/settings isolation still unverified |
| OQ-4 | What is the correct Windows install / binary path? | Answered — source and desktop installers resolve `%LOCALAPPDATA%\agy\bin\agy.exe`, matching Phase D packaging verification |
| OQ-5 | Should the old `antigravity` adapter be renamed in env values or kept as legacy alias only? | Answered — legacy `antigravity` remains the Desktop/MCP callback adapter; `antigravity-cli` is the new headless `agy` adapter name (KD-3) |
| OQ-6 | What exact AGY selector ids map to Opus, Gemini 3.1 Pro, and Gemini 3.5 Flash? | Open — official docs name the product models, but Cat Cafe needs exact config/statusline ids before wiring profiles |
| OQ-7 | Can AGY reuse Cat Cafe's existing Gemini ACP adapter? | Answered no for AGY `1.0.1` — no supported/documented `agy --acp` or ACP subcommand exists; keep plain-text adapter until AGY exposes ACP or an equivalent programmatic lifecycle |
| OQ-8 | Can Cat Cafe isolate AGY profiles by HOME / `~/.gemini/antigravity-cli` config while preserving auth, model selection, trusted worktree, and MCP access? | Open — required for Opus/Gemini multi-profile routing; must be proven before user-facing cats |
| OQ-9 | What is the minimum safe AGY permission posture for unattended runtime calls? | Open policy detail — CVO direction is yolo/auto-approve for usability, implemented as `--dangerously-skip-permissions` only inside a scoped profile sandbox |
| OQ-10 | Can AGY's local language-server API send user messages, stream updates, cancel turns, and set/verify selected models? | Open — read-only endpoints work, but write/stream request schemas and lifecycle semantics are not proven |
| OQ-11 | If the structured local API is insufficient, what is the smallest acceptable PTY/tmux bridge? | Open — initial PTY smoke works; acceptable fallback must define ANSI parsing limits, attach/read-only takeover, and resume handling |

## Key Decisions

| # | 决策 | 理由 | 日期 |
|---|------|------|------|
| KD-1 | F210 is a new feature, not a F201 bug reopen | F201 covered Desktop reliability; F210 is a headless carrier deadline and packaging migration | 2026-05-22 |
| KD-2 | Do not assert full Gemini CLI shutdown | Google's official post keeps enterprise/API-key access separate from consumer shutdown | 2026-05-22 |
| KD-3 | New adapter name is `antigravity-cli` | Existing `antigravity` means Desktop/MCP callback in current code | 2026-05-22 |
| KD-4 | Keep `gemini-cli` fallback until enterprise path is settled | Enterprise users may still rely on Gemini CLI; deleting it would remove a valid route | 2026-05-22 |
| KD-5 | F209 is occupied by Evidence Recall Optimization; this migration uses F210 | Feature IDs are shared truth and must be assigned from current main, not from a worktree snapshot | 2026-05-22 |
| KD-6 | `agy` subprocess output support is a blocking Phase A question | Antigravity Desktop harness differs materially from Gemini CLI stream-json; implementation strategy depends on this answer | 2026-05-22 |
| KD-7 | Phase B prototype may start only with explicit model preflight/onboarding and timeout classification | `agy --print` can now succeed, but model selection is account-side rather than CLI/env controlled, and timeouts can exit 0 | 2026-05-22 |
| KD-8 | Runtime may update after Phase F, but AGY multi-model profiles remain Phase G | PR #1863 safely switches the default carrier; Opus/Gemini 3.1 Pro/Gemini 3.5 Flash require model-selection verification before user-facing routing | 2026-05-23 |
| KD-9 | Prefer AGY ACP only if AGY ships a compatible server mode | Gemini CLI ACP has the lifecycle Cat Cafe wants, but AGY 1.0.1 does not expose that surface; swapping `command: "agy"` into the ACP pool would be a false integration | 2026-05-23 |
| KD-10 | ACP catalog precedence is a separate routing layer from `GEMINI_ADAPTER` | `index.ts` instantiates `GeminiAcpAdapter` before falling back to `GeminiAgentService`; adapter defaults do not affect existing ACP cats | 2026-05-23 |
| KD-11 | AGY yolo is required but must be sandbox-scoped | Interactive approval prompts are unusable for Cat Cafe agent turns; auto-approval is acceptable only when HOME/config, worktree, MCP, and model profile isolation are proven | 2026-05-23 |
| KD-12 | For an F198-like AGY carrier, structured local API beats PTY | AGY exposes a localhost HTTP/Connect language-server API with conversation/model/MCP read paths; PTY works but is an ANSI UI fallback, not a durable event protocol | 2026-05-23 |

## Timeline

| 日期 | 事件 |
|------|------|
| 2026-05-22 | 铲屎官要求砚砚立项并校正孟加拉猫草稿事实 |
| 2026-05-22 | 纠偏：F209 已被 Evidence Recall Optimization 占用；迁移 spec 重新落到 main 的 F210 |
| 2026-05-22 | Phase A recon partial：`agy 1.0.1` installed/probed; auth/MCP/sandbox/install facts frozen; success fixture blocked by missing default model |
| 2026-05-22 | Phase A recon partial merged via PR #1841; AC-A1/A2/A4/A6 closed, AC-A3/A5 remain blocked by missing default model and unverified MCP runtime loading |
| 2026-05-22 | Follow-up headless spike：`agy --print` success/tool/resume/timeout fixtures captured; OQ-1 answered for prototype, OQ-3 downgraded to deterministic model-selection preflight |
| 2026-05-22 | Phase B adapter prototype：`GEMINI_ADAPTER=antigravity-cli` spawns `agy --print`; direct service smoke returned `CAT_CAFE_AGY_ADAPTER_OK`; full Cat Cafe E2E/default switch still blocked by AC-E1/AC-E4 |
| 2026-05-23 | Phase C parser/session merged via PR #1857：dedicated AGY plain-text parser added; F210 fixtures cover success/resume/timeout/missing-model; resume/model/image degradation behavior tested |
| 2026-05-23 | Phase D install/packaging merged via PR #1858：source installers use official `agy` native bootstrapper; Windows resolver covers `%LOCALAPPDATA%\agy\bin\agy.exe`; desktop offline packages ship explicit AGY install instructions instead of vendoring Gemini CLI npm tarball |
| 2026-05-23 | Phase E E2E smoke merged via PR #1861：`GEMINI_ADAPTER=antigravity-cli` routes Siamese through Cat Cafe and returns `CAT_CAFE_AGY_E2E_OK`; wiring tests keep explicit `gemini-cli` fallback; default stayed unchanged at that point until the Phase F default-switch review |
| 2026-05-23 | Phase F docs/default switch merged via PR #1863：non-ACP `GeminiAgentService` default adapter is now `antigravity-cli`; README/env/architecture docs synced; explicit `gemini-cli` fallback and legacy Desktop `antigravity` adapter preserved |
| 2026-05-23 | CVO scope add: Phase G will verify AGY multi-model profiles for Opus, Gemini 3.1 Pro, and Gemini 3.5 Flash before exposing deterministic Cat Cafe routing |
| 2026-05-23 | Phase G ACP probe：global `agy 1.0.1` installed and `agy --print` smoke passed; Gemini CLI exposes `--acp`, but AGY does not expose supported/documented ACP, so Phase G cannot close deterministic Opus/Gemini profile routing through ACP |
| 2026-05-23 | Runtime correction：alpha start on `8cdc573bd` confirmed Gemini ACP pool still initializes from catalog `acp` config; the AGY default does not replace existing `gemini --acp` cats |
| 2026-05-23 | CVO scope add: AGY Cat Cafe runtime must use yolo/auto-approval and must validate HOME/AGY config profile sandboxing with worktree/MCP permissions before multi-cat exposure |
| 2026-05-23 | Phase G interactive/API probe：PTY `--prompt-interactive` smoke returned `AGY_PTY_PROBE_OK`; AGY local HTTP/Connect API exposed conversation metadata, model catalog/config, and MCP server states; send/stream/model-select remains open |
| 2026-05-31 | AGY 1.0.3 resume refresh merged via PR #1992：`--conversation` resumes real AGY UUIDs, but unknown IDs are ignored and replaced by AGY-created UUIDs. Cat Cafe adapter now records the real UUID from `--log-file` output on fresh turns and reserves `--conversation` for stored real IDs. |
| 2026-05-27 | Target: Phase A recon complete（install/auth/headless/output/MCP/sandbox facts frozen） |
| 2026-06-07 | Target: Phase B/C adapter + parser/session strategy implemented |
| 2026-06-14 | Target: Phase D/E install packaging + E2E smoke green |
| 2026-06-16 | Target: Phase F docs + default switch, with 2-day buffer before 2026-06-18 consumer deadline |

## Review Gate

- Kickoff review: `@antig-opus` reviews this spec for Antigravity product facts and missing recon points.
- Implementation review: cross-family reviewer required before PR merge. Same individual cannot review their own code.

## Links

| 类型 | 路径 | 说明 |
|------|------|------|
| Official | https://developers.googleblog.com/an-important-update-transitioning-gemini-cli-to-antigravity-cli/ | Google transition announcement and timeline |
| Official | https://antigravity.google/cli/install.sh | Official Antigravity CLI installer; fetched 2026-05-22 |
| Official | https://antigravity.google/docs/models | Antigravity reasoning model list; fetched 2026-05-23 |
| Official | https://antigravity.google/docs/cli-features | AGY CLI `/model`, settings, MCP, sandbox, and statusline docs; fetched 2026-05-23 |
| Official | https://antigravity.google/pricing | Antigravity plan model-access list including Gemini 3.5 Flash; fetched 2026-05-23 |
| Recon | `docs/features/assets/F210/phase-a-recon-2026-05-22.md` | Phase A `agy 1.0.1` facts and fixture index |
| Recon | `docs/features/assets/F210/phase-g-acp-probe-2026-05-23.md` | Phase G global install, ACP absence, and AGY print smoke evidence |
| Recon | `docs/features/assets/F210/phase-g-interactive-api-probe-2026-05-23.md` | Phase G F198-like interactive carrier probe, local language-server API evidence, and PTY fallback boundary |
| Fixture | `docs/features/assets/F210/agy-help.txt` / `agy-unsupported-flags.txt` / `agy-print-auth-required.txt` / `agy-real-home-no-default-model.txt` | Raw CLI evidence, sanitized |
| Code | `packages/api/src/domains/cats/services/agents/providers/GeminiAgentService.ts` | Current Gemini CLI and Desktop adapter split |
| Code | `packages/api/src/utils/cli-resolve.ts` | CLI install hints |
| Code | `packages/api/src/utils/cli-spawn-win.ts` | Windows CLI shim assumptions |
| Code | `scripts/install.sh` / `scripts/install.ps1` | User install scripts |
| Code | `desktop/scripts/build-mac.sh` / `desktop/scripts/build-desktop.ps1` / `desktop/scripts/post-install-offline.ps1` | Desktop packaging scripts |
