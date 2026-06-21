---
feature_ids: [F242]
topics: [review-request, convention-graph, phase-c]
doc_kind: mailbox
created: 2026-06-20
---

# Review Request: F242 Phase C Convention Graph Product Entry

Review-Target-ID: f242
Branch: feat/f242-phase-c

## What

Added a real convention graph product entry instead of an ad-hoc script:

- `@cat-cafe/convention-graph` now has a CLI with `index` and `code-consumers`.
- Root scripts expose `pnpm convention-graph:index` and `pnpm convention-graph:code-consumers`.
- CLI writes `.cat-cafe/convention-graph.sqlite`, rebuilds by domain, and reports query freshness against current files.
- `convention-graph-discovery`, `docs/SOP.md`, and `sop-definitions/development.yaml` now wake cats to query convention graph before editing MCP / skill / route / callback surfaces.
- F242 doc marks only AC-C2 and AC-C3 complete; AC-C1/C4/C5 remain open.

## Why

Phase A/B proved the engine and extractors, but the feature was correctly rejected as not closeable because cats still had no reliable path to use it. This PR turns the package into a runnable workflow and wires that workflow into the coding path.

## Original Requirements

> "如果当猫猫们进入一个新的 repo 要如何构建出专属的「约定层关联图」，是不是才是我们成功的胜负手？"
> "减少你们费力的 grep 之类的，甚至比如说改了这个似乎可以改，结果导致另一个模块炸了。"
> "有在猫猫的认知路径上吗？现在能用吗？以后猫猫代码更新有做自动更新吗？"
> "接下来最短直线我建议做 Phase C 我不想要做脚手架！"

- 来源：`docs/features/F242-code-graph-layer-spike.md` + current thread 2026-06-20
- 请对照上面的摘录判断交付物是否解决了 Phase C 的可用入口 / 更新语义问题，并确认没有把 remaining close gates 偷偷当完成。

## Tradeoff

Chose explicit reindex + stale/fail-closed semantics over a watcher. A watcher is more moving parts and not required for AC-C3; explicit commands are enough to prevent stale graph from silently presenting as fresh.

Did not add new extractors or broaden framework coverage. That would be Phase A/B-style mechanism work, not the Phase C productization gap.

## Architecture Ownership

Architecture cell: code-intelligence / convention-graph
Map delta: none
Why: Extends the existing F242 convention-graph package with a CLI/workflow surface; no new Store / Queue / Router / Adapter / Dispatcher / Binding boundary.

Please reviewer check:

- `Map delta: none` matches the diff.
- The CLI does not create a second graph engine path; it wraps existing plugins and `ConventionGraphEngine`.
- The SOP rule addition is properly reflected in generated `sop-definition.generated.ts`.

## Open Questions

### 技术 OQ（给 reviewer）

- Is `INIT_CWD` handling sufficient for root `pnpm --filter` scripts, and does the regression test cover the original dogfood failure?
- Is the CLI freshness domain selection conservative enough for `code-consumers` without over-reporting other domains?
- Should CLI default output remain full JSON, or should text/production filtering be a follow-up after C2/C3 land?

### 价值 OQ（给 CVO，如有）

无。This is reversible and scoped to the existing Phase C productization gate.

## Next Action

Please review and return logical APPROVE / REQUEST-CHANGES as a PR/comment-style verdict. Focus on correctness, stale semantics, and whether this avoids the "脚手架" failure mode.

## Review Sandbox

- Path: `/tmp/cat-cafe-review/f242/sonnet`
- Start Command: `pnpm review:start` only if reviewer wants an isolated full repo sandbox
- Ports: n/a for this CLI/docs change; no frontend/runtime server is required

## 自检证据

### Spec 合规

- AC-C2 checked: documented root/package CLI commands produce graph/query results without ad-hoc scripts.
- AC-C3 checked: explicit reindex command plus `freshness.stale` / `pendingChanges` / `reindexCommand` semantics.
- AC-C1/C4/C5 intentionally left unchecked because post-merge non-F242 dogfood is still required.

### Dogfood-Your-Slice

Scope verdict: required.

Commands:

```bash
pnpm convention-graph:index -- --repo . --domain mcp-tool,skill-manifest --format json
pnpm convention-graph:code-consumers -- --repo . --domain mcp-tool --kind mcp_tool --name cat_cafe_post_message --format json
```

Observed:

- First dogfood caught a real cwd bug: root script via `pnpm --filter` resolved `--repo .` inside `packages/convention-graph`; fixed by preferring `INIT_CWD` when no explicit test cwd is provided.
- Final dogfood indexed `mcp-tool` and `skill-manifest`; query returned `freshness.stale=false` and visible provenance for `WorklistRegistry.ts`, `route-serial.ts`, and `COLLAB_TOOL_SOURCES`.

### Artifact Hygiene

```bash
git status --short | rg '^.. [^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
git diff --name-only origin/main...HEAD | rg '^[^/]+\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$' || true
```

Both returned no matches.

### 测试结果

```bash
pnpm --filter @cat-cafe/convention-graph test
# 46 pass, 0 fail

pnpm --filter @cat-cafe/convention-graph lint
# tsc --noEmit pass

pnpm check
# pass

pnpm lint
# pass; existing packages/web warnings only
```

### 相关文档

- Feature: `docs/features/F242-code-graph-layer-spike.md`
- Design Gate: `docs/discussions/2026-06-17-f242-design/README.md`
- Skill: `cat-cafe-skills/convention-graph-discovery/SKILL.md`

[砚砚/GPT-5.5🐾]
