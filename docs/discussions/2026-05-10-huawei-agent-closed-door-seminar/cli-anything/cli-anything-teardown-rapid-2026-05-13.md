---
title: "CLI-Anything rapid teardown: making software agent-native"
date: 2026-05-13
doc_kind: teardown
status: draft
speaker_context: "港大黄超 afternoon session: CLI-Anything / nanobot ecosystem"
source_repo: "https://github.com/HKUDS/CLI-Anything"
local_clone: "/Users/lysander/projects/ref/CLI-Anything"
source_commit: "d7297622642f2589a143b4e4a1ce85ad21da42ec"
method: "open-source-teardown skill: README/PPT claim -> source paths -> issue signals -> Cat Cafe comparison"
author: "砚砚/GPT-5.5"
---

# CLI-Anything rapid teardown

## 0. TL;DR

CLI-Anything 不是纯 star bait。它仓库里有真实工程：

- 52 个 `agent-harness` 目录；
- 57 条 `registry.json` CLI 记录，16 条 `public_registry.json` 公开记录；
- Claude Code plugin / OpenCode commands / Codex skill / Qoder plugin 多入口；
- `HARNESS.md` 把“GUI 软件 -> agent 可用 CLI”的建模流程写成了 SOP；
- GIMP 等 harness 有 Click CLI、REPL、JSON output、session state、undo/redo、真实 backend 调用和测试计划。

但它的真实边界也很清楚：

> CLI-Anything 解决的是 **tool substrate / capability adapter**：把 GUI 或复杂软件包装成 agent 可调用、可脚本化、可 JSON 解析的 CLI。
>
> 它不是 agent runtime，也不是协作治理层。它不负责“什么时候该调用工具、谁来 review、调用错了怎么沉淀、不可逆操作谁负责”。

所以它和 Cat Cafe 的关系不是直接替代，而是互补：

> **CLI-Anything 让猫能摸到工具；Cat Cafe 决定猫什么时候摸、摸完谁验、错了怎么回滚、经验怎么沉淀。**

## 1. Source Snapshot

| Item | Value |
|---|---|
| Repo | `HKUDS/CLI-Anything` |
| Local clone | `/Users/lysander/projects/ref/CLI-Anything` |
| Commit inspected | `d7297622642f2589a143b4e4a1ce85ad21da42ec` |
| GitHub stars observed | ~34.3k |
| Latest release observed | `v0.3.0` |
| License | Apache-2.0 |
| Primary claim | “让所有软件都能被 Agent 驱动” / “Making ALL Software Agent-Native” |

Key source files inspected:

- `README_CN.md`
- `cli-anything-plugin/HARNESS.md`
- `cli-anything-plugin/README.md`
- `codex-skill/SKILL.md`
- `cli-hub/README.md`
- `registry.json`
- `public_registry.json`
- `gimp/agent-harness/...`
- selected issue / PR signals from GitHub

## 2. Claim Ledger

| Claim | Evidence | Verdict | Caveat |
|---|---|---|---|
| “任意软件接入 Agent 框架” | `README_CN.md` has `/cli-anything ./gimp`; repo has 52 harness dirs across image/video/audio/office/dev tools | **Partly real** | “All software” is marketing upper bound. Their own README says quality depends on source code access, strong base models, and iterative refine. Binary/proprietary targets remain hard. |
| “CLI is the agent-native interface” | `README_CN.md` argues CLI is structured/composable/self-describing/JSON/deterministic | **Strong thesis** | Correct for tool substrate, but CLI alone does not provide governance, review, or safety policy. |
| “One command builds full CLI” | Claude plugin, OpenCode commands, Codex skill, Qoder plugin; `HARNESS.md` has 7-phase methodology | **Real workflow scaffold** | The scaffold is only as good as backend mapping and test validation. Complex apps still require source reading, backend adapter work, and `/refine`. |
| “Ecosystem already exists” | `cli-hub`, registry, public registry, per-app harnesses, PR template | **Real ecosystem** | Breadth is ahead of maturity. Some harnesses have real issues: packaging failures, lifecycle bugs, app-specific crashes. |
| “Production-ready / tested” | GIMP harness has core modules, backend wrapper, tests, TEST.md; README claims 1,741 passing tests across demos | **Some harnesses credible** | Maturity is uneven. Open issues show app-specific breakage and integration pain. |
| “Agent-native” | Stateful REPL + one-shot CLI + JSON + undo/redo + session state | **True at tool-interface layer** | Not true at full agent-system layer unless paired with runtime memory, audit, review, policy, and eval. |

## 3. Architecture Map

```text
CLI-Anything
├── Builder surfaces
│   ├── cli-anything-plugin/        # Claude Code plugin commands + HARNESS.md
│   ├── codex-skill/                # Codex skill wrapper
│   ├── opencode-commands/          # OpenCode slash commands
│   └── qoder-plugin/               # Qoder integration
│
├── Methodology source
│   └── cli-anything-plugin/HARNESS.md
│       ├── Phase 1: codebase/backend analysis
│       ├── Phase 2: CLI architecture design
│       ├── Phase 3: implementation
│       ├── Phase 4: TEST.md planning before tests
│       ├── Phase 5: unit/e2e/backend/subprocess tests
│       ├── Phase 6.5: SKILL.md generation
│       └── Phase 7: packaging
│
├── Harness zoo
│   ├── gimp/agent-harness/
│   ├── blender/agent-harness/
│   ├── inkscape/agent-harness/
│   ├── libreoffice/agent-harness/
│   ├── shotcut/agent-harness/
│   ├── obs-studio/agent-harness/
│   └── ... 52 observed agent-harness dirs
│
├── Distribution / discovery
│   ├── registry.json               # 57 CLI records observed
│   ├── public_registry.json        # 16 public records observed
│   ├── cli-hub/                    # package manager + preview viewer
│   └── skills/                     # per-harness skill files
│
└── Typical generated harness
    ├── setup.py
    ├── <APP>.md
    ├── cli_anything/<app>/<app>_cli.py
    ├── cli_anything/<app>/core/
    ├── cli_anything/<app>/utils/<app>_backend.py
    ├── cli_anything/<app>/utils/repl_skin.py
    ├── cli_anything/<app>/skills/SKILL.md
    └── cli_anything/<app>/tests/
```

Runtime shape:

```text
Agent
  -> discovers skill / CLI help
  -> calls cli-anything-<software> --json ...
  -> harness updates session/project state
  -> backend adapter invokes real app / real engine
  -> output verified by tests / artifacts
```

The best part of the design is that it does not pretend GUI automation is enough. The methodology asks the agent to find the actual backend engine and data model, then wrap that layer.

## 4. What Is Real

### 4.1 The HARNESS methodology is concrete

`cli-anything-plugin/HARNESS.md` is not a marketing README. It tells the agent to:

- identify backend engine;
- map GUI actions to API calls;
- identify the data model;
- find existing CLI tools;
- catalog command/undo systems;
- choose REPL, one-shot CLI, or both;
- design session state and JSON output;
- write `TEST.md` before test implementation;
- run real backend E2E tests, not only mocks;
- verify output artifacts by magic bytes / file format / pixel/audio checks where relevant.

This is close to our own “skills are workflow super-set” framing: a skill can call deterministic workflows, but still preserve runtime adaptation.

### 4.2 GIMP harness shows an actual implementation path

The GIMP harness has:

- `gimp/agent-harness/cli_anything/gimp/gimp_cli.py`
- `core/session.py`
- `utils/gimp_backend.py`
- `tests/test_core.py`
- `tests/test_full_e2e.py`
- `tests/TEST.md`
- generated `skills/SKILL.md`

The backend wrapper invokes real GIMP batch mode, not just toy JSON mutation. The session layer includes undo/redo, modified state, session save, and file locking. That is a meaningful tool substrate.

### 4.3 The ecosystem is not just one demo

The repo contains harnesses for graphics, office, video/audio, dev tools, databases, browser-like tools, and more. `cli-hub` is a package manager with:

- `cli-hub list/search/info/install/update/uninstall`;
- machine-readable `--json`;
- preview inspection/open/watch commands;
- a live web catalog (`clianything.cc`).

This explains the PPT claim that there is “生态” around the project.

## 5. Risk / Weak Signals

### 5.1 High stars, low issue count is still a warning

Observed metadata:

- `CLI-Anything`: ~34k stars, dozens not thousands of issues.
- HKUDS has many 10k+ star repos.

This does not prove fake usage. It does mean we should not equate stars with production adoption. The stronger signal is the issue content:

- #278: n8n runtime TypeError in REPL.
- #234: VideoCaptioner package missing module after wheel install.
- #213: Kdenlive cannot open through generated workflow.
- #182: Inkscape one-shot commands did not persist without save semantics.
- #185: signed receipts / agent command audit was treated as out-of-scope for CLI-Anything itself.

That pattern says: real users are trying it, but per-app lifecycle and packaging are hard.

### 5.2 Breadth creates maintenance debt

52 harness directories and 57 registry records are impressive, but every GUI application has its own:

- backend quirks;
- project file format;
- save/export lifecycle;
- installation and PATH problems;
- GUI-vs-engine behavior gap;
- platform-specific failure modes.

The more apps CLI-Anything covers, the more it needs a strict contribution and regression discipline. Their PR template is a good sign, but this is still a large maintenance surface.

### 5.3 Governance is explicitly outside the boundary

Issue #185 is important. The maintainers effectively draw the boundary:

> CLI-Anything provides CLI harnesses for GUI software; command signing and audit trails belong in the agent runtime layer.

I agree with that boundary if they pitch as tool substrate. I would object only if “agent-native” is read as full agent governance.

In Cat Cafe terms:

```text
CLI-Anything: "Can the agent operate this software?"
Cat Cafe:     "Should the agent operate it now, who validates it, and what happens after?"
```

## 6. Algorithm / Mechanism Peeling

| Layer | What it really is | Algorithmic depth | Notes |
|---|---|---:|---|
| GUI -> CLI conversion | Agent-guided source/backend analysis + generated Click CLI | Medium | Not magic; high value is the SOP and backend mapping discipline. |
| Statefulness | Session JSON + project files + undo/redo + locks | Medium | Practical engineering, not a novel algorithm. |
| Discovery | CLI `--help`, skill files, registry, cli-hub | Low-Medium | Very useful for agents; mostly conventions + packaging. |
| Testing | TEST.md planning + unit/e2e/backend/subprocess tests | Medium | Good discipline; quality depends on each harness actually following it. |
| Refinement | Agent analyzes coverage gaps and extends commands/tests/docs | Medium | The closed loop depends on model quality and test oracle quality. |
| Governance / audit | Mostly delegated out of scope | Low | This is where Cat Cafe’s layer begins. |

## 7. Cat Cafe Comparison

| Dimension | CLI-Anything | Cat Cafe |
|---|---|---|
| Primary object | Software tool interface | Agent team / work loop |
| Core question | “How can an agent operate this software?” | “How do agents reliably work together over time?” |
| Unit of abstraction | CLI harness for one app | Cat identity + skill + SOP + memory + review |
| State | Per-app session/project state | Feature state, memory state, review state, thread/session state |
| Verification | Per-harness tests and artifact checks | Quality gate, peer review, cross-vendor review, eval feedback |
| Governance | Mostly out of scope | Core product layer |
| Best use | Special-worker tool capability | Long-running collaborative work |

This maps well to the “特种工小猫” idea:

- 宪宪/砚砚 are generalist senior cats.
- CLI-Anything can generate “tool hands” for specialized domains: GIMP cat, Blender cat, LibreOffice cat, QGIS cat.
- But the specialized tool cat still needs Cat Cafe style routing, memory, review, and CVO authority if it participates in real work.

## 8. What We Should Learn

### Learn

1. **HARNESS.md as single source of methodology**  
   Their conversion discipline is written once and reused across Claude/OpenCode/Codex/Qoder surfaces. We should keep our own skill methodology similarly canonical.

2. **Per-tool SKILL.md packaging**  
   Each generated CLI becomes discoverable to agents. This matches our “Wearing Protocol” direction: tool capability should come with usage guidance, not only binaries.

3. **REPL + one-shot + JSON as a standard trio**  
   This is a good convention for agent-facing CLIs:
   - REPL for exploratory stateful sessions;
   - one-shot for scripts / workflows;
   - `--json` for machine parsing.

4. **Test plan before implementation**  
   `TEST.md` before test code is a useful guardrail. It forces the agent to name what “real output works” means.

5. **Real backend validation**  
   They explicitly say backend tests should fail if real software is missing, not silently degrade. This is correct for harness credibility.

### Do Not Follow Blindly

1. **Do not copy the “ALL software” framing**  
   It invites overclaim. Better framing: “software with accessible backend/data model can become agent-operable.”

2. **Do not optimize for catalog breadth before reliability**  
   A large registry is impressive, but each app is a separate product surface.

3. **Do not let tool substrate branding swallow governance**  
   Once a CLI harness is used in real work, the hard questions move to audit, permission, rollback, review, and memory.

## 9. Suggested Cat Cafe Follow-Ups

1. **Use CLI-Anything as a reference substrate for future “special-worker cat” design**  
   If we ever want a dedicated design/video/data-tool cat, CLI-Anything is a useful pattern for tool access.

2. **Consider a small experiment, not a big adoption**  
   Pick one tool we actually need, such as GIMP/LibreOffice/Draw.io, and run it through our own workflow:
   ```text
   skill load -> tool call -> artifact output -> review -> lesson/eval
   ```
   The point is not “does CLI-Anything install”; the point is whether it improves our Cat Cafe work loop.

3. **Add a talk-track distinction**
   For future external talks:
   > “CLI-Anything is tool substrate. Cat Cafe is agent governance and work continuity. We can use substrates like this, but they do not replace memory, review, and eval.”

4. **Watch the issue tracker for maturity signals**
   Especially lifecycle/persistence bugs (#182), package completeness bugs (#234), and app-specific runtime bugs (#278).

## 10. Bottom Line

CLI-Anything is the most credible kind of “agent tool ecosystem” project: it has a clear interface thesis, a reusable methodology, many real harness directories, and enough issue traffic to show real friction.

Its weakness is not that it is fake. Its weakness is boundary ambiguity:

- As “make GUI software agent-operable,” it is strong.
- As “make software agent-native,” it is incomplete unless paired with governance.

For Cat Cafe, the correct stance is:

> We should learn from CLI-Anything’s tool substrate discipline and maybe use pieces of it. But our differentiator remains the layer above it: multi-agent continuity, cross-vendor review, memory governance, audit, and eval feedback.

[砚砚/GPT-5.5🐾]
