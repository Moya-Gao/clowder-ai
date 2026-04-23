# Review Request: F172 Phase B-E — Generated Image Publication (Codex + Antigravity hookup)

Review-Target-ID: f172
Branch: feat/f172-phase-b-codex-image-hookup

## What

F172 Phases B-E: hook both Codex and Antigravity image generation output into the Phase A shared publication contract (`publishGeneratedImage`). After invocation, generated images auto-publish to `/uploads/` with `media_gallery` rich blocks + provenance archive.

Core changes:
- **Phase B**: `codex-image-scanner.ts` scans `~/.codex/generated_images/<sessionId>/` post-invocation, publishes via Phase A, yields rich blocks in `CodexAgentService`
- **Phase C**: `antigravity-image-publisher.ts` extracts image paths from `toolResult.output` + `runCommand.stdout`, publishes in `AntigravityAgentService`
- **Phase D**: Skill docs (`image-generation`, `rich-messaging`, `refs/rich-blocks.md`) updated from manual `cp` to shared publication contract
- **Phase E**: Provenance (provider/toolName/prompt/originalPath/publishedPath) embedded in `system_info` content for archive. Rich block persistence via existing `route-serial.ts` pipeline.

## Why

Codex's built-in `image_gen` writes to `~/.codex/generated_images/` with NO NDJSON event — images were silently orphaned. Antigravity's image output similarly had no publication path. Both now auto-publish through the same contract, giving both cats first-class image artifacts.

## Original Requirements

> "生成的图片我记得位置是在 user 下面的 .codex 并没有归档的"
> "基础设置帮你生成的图片自动放过来"
> "包括孟加拉他的图片生成我估计也得对接到你这套基础设施"
> "这样你们生成完成之后 两只猫都能够直接呈现给我"

- 来源：F172 spec `docs/features/F172-generated-image-publication.md` Requirements Checklist (R1-R8)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **Codex scanner**: filesystem scan (post-invocation) vs. event-driven. Chose scan because `image_gen` emits NO events.
- **Antigravity path extraction**: regex-based absolute path extraction from tool result text vs. structured detection. Chose regex because Antigravity's `TrajectoryStep.toolResult.output` is plain text (no structured content blocks like Codex's MCP results).
- **Provenance storage**: embedded in `system_info` content alongside rich block vs. separate persistence layer. Chose embedding — route-serial already persists rich blocks in `extra.rich.blocks[]`; provenance rides alongside in the raw stream.

## Open Questions

1. **Antigravity path detection robustness**: The regex extracts absolute paths ending in image extensions. Could there be false positives (e.g., paths mentioned in discussion that aren't generated images)?
2. **Phase C OQ-2 resolution**: I resolved OQ-2 by scanning `toolResult.output` + `runCommand.stdout`. Is this the right layer, or should detection happen in the executor/bridge?
3. **Provenance persistence depth**: Currently provenance is in the `system_info` content but NOT separately indexed. Is this sufficient for archive/replay needs?

## Next Action

Review code quality, contract correctness, and whether the implementation satisfies the original requirements. Focus areas per spec's Review Gate:
- Phase B/C: Do both provider integrations truly follow the same shared contract?
- Phase D: Do skill docs match the runtime contract?
- Phase E: Rich block persistence / connector outbound regression

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f172/codex`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202` (review isolation)

## Self-Check Evidence

### Spec Compliance

All ACs checked (A1-A5, B1-B2, C1-C2, D1-D2, E1-E5). All requirements R1-R8 marked complete. Both Open Questions resolved. Full evidence in spec.

### Test Results

```
# Phase B: codex-image-scanner
node --test test/codex-image-scanner.test.js     # 6 passed, 0 failed

# Phase B: codex-agent-service (including F172 integration test)
node --test test/codex-agent-service.test.js      # 42 passed, 0 failed

# Phase C: antigravity-image-publisher
node --test test/antigravity-image-publisher.test.js  # 10 passed, 0 failed

# Phase A regression
node --test test/generated-image-publication.test.js  # 7 passed, 0 failed
node --test test/image-storage.test.js               # 8 passed, 0 failed

# Total: 65 passed, 0 failed
# Build: pnpm build — success
# Lint: pnpm check — success
```

### Related Documents

- Feature: `docs/features/F172-generated-image-publication.md`
- Phase A evidence: same spec, Phase A section
