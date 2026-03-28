---
feature_ids: [F046, F070, F105]
topics: [architecture, opencode, governance, research]
doc_kind: research
created: 2026-03-26
---

# Cat Café Comparison & Context Research Summary
## OpenClaw vs OMOC vs Claude Agent Team vs Spec/Vision-Driven Development

**Generated**: 2026-03-26  
**Search Scope**: docs/features/, docs/discussions/, docs/decisions/, docs/research/, CLAUDE.md, AGENTS.md, OPENCODE.md  
**Coverage**: F105 (opencode), F070 (portable governance), F046 (anti-drift), spec/vision-driven development patterns

---

## 1. OPENCODE INTEGRATION (F105 — 金渐层)

### Document: `docs/features/F105-opencode-golden-chinchilla.md`

**Key Context**: Cat Café integrated OpenCode as a third external agent family called "golden chinchilla" (金渐层).

**Architecture**:
- **Breed ID**: `golden-chinchilla` (金渐层)
- **Provider Integration**: L1 CLI Adapter (same as F050 DARE pattern)
- **Command**: `opencode run --format json` → NDJSON event stream
- **Oh My OpenCode (OMOC)**: Installed as plugin, provides Sisyphus orchestrator + Ralph Loop + Context management
- **Design Philosophy**: "毛色渐变如同 opencode 的'开放渐进'理念，圆润沉稳的英短体型体现稳定可靠"

**Comparison to Cat Café**:
| Dimension | DARE/Weaver (F050) | Antigravity/Bengal (F061) | OpenCode/Golden (F105) |
|-----------|-------------------|--------------------------|----------------------|
| Communication | CLI spawn + stdout NDJSON | CDP bridge + HTTP | CLI spawn + stdout JSON |
| Event Format | headless envelope v1 | DOM snapshot + WebSocket | opencode JSON |
| Control Plane | control-stdin | `/send` HTTP | stdin (future: HTTP) |
| Models | Configurable LLM | Multi-model switchable | All Claude models (via proxy) |
| **Unique Ability** | Deterministic execution | Screenshot/image generation | **OMOC internal orchestration + LSP + theme ecosystem** |
| MCP Support | Runtime reload | None | **Native MCP client** |

**OMOC Integration Decision**:
- **Method**: "Controlled OMOC" (受控 OMOC)
- **Sisyphus Isolation**: Only orchestrates OpenCode's internal sub-agents (Oracle/Librarian/Frontend)
- **Cat Café Boundary**: Cat Café's CatOrchestration manages cross-cat scheduling, not Sisyphus
- **Key Constraints**:
  - Sisyphus cannot orchestrate other Cat Café cats
  - Preserved: LSP tool integration, Ralph Loop, Context 70%/85% management
  - Avoided: Double orchestration conflicts, MCP namespace collisions

**Timeline**:
- 2026-03-11: Kickoff + spec finalized
- 2026-03-12: Phase 0-3 completed (89 tests green)
  - Phase 1: L1 CLI adapter integration (27 tests)
  - Phase 2: OMOC + MCP namespace isolation (24 tests)
  - Phase 3: Collaboration routing with @mention support (29 tests)

**Related Files**:
- `OPENCODE.md`: Golden Chinchilla configuration + identity guidelines
- `docs/reflections/2026-03-12-f105-opencode-golden-chinchilla-capsule.md`: Post-completion reflection

---

## 2. OH MY OPENCODE (OMOC) RESEARCH & ASSESSMENT

### Document: `docs/research/oh-my-opencode-research.md`

**Scope**: Technical evaluation of OMOC as multi-agent harness (截至 2026-02-13)

**OMOC Architecture**:
- **Core**: Not new multi-agent algorithm, but harness combining:
  - OpenCode plugin mechanism
  - Session system + tool system
  - Strong constraint prompts + hooks
- **Sisyphus Orchestrator**: Ultra-long system prompt with:
  - Staged workflow rules
  - Parallel strategy for exploration/retrieval
  - Delegation format + evidence requirements
  - Failure recovery + TODO discipline

**Key Technical Findings**:

1. **Task Decomposition**: Driven by LLM behavior rules, not coded algorithm
   - Prompt forces TODO discipline: mark in_progress/completed before execution
   - Orchestration logic in "behavior norms," plugins execute those norms
   
2. **Sub-agent Communication**: Mostly single-direction
   - Main (Sisyphus) sends tasks via `delegate-task` tool
   - Sub-agents report back via `background_output`
   - **Not peer-to-peer** — hierarchy prevents layer-by-layer delegation failures
   
3. **Parallel Execution**: True multi-session parallelism, but coordination is serial
   - Background tasks return immediately
   - Multiple tasks run simultaneously in separate sessions
   - Decision/integration still serial (orchestrator reads results, decides next)
   
4. **Context Management**: Subagents stateless by default
   - Dynamic prompt builder: "**Subagents are STATELESS**"
   - Continuation reuses original session when possible
   - Entire hook suite manages context pressure (compression, truncation)

**Real-World Issues** (from GitHub issues):
- Background tasks hang/deadlock (卡住不动)
- Concurrent task completion race conditions
- Notification loops
- Token cost explosion with parallel exploration
- Rate limiting with unstable models (Gemini, etc.)

**Technology Assessment**: **7 / 10**
- **Strengths**: Hierarchical delegation + tool isolation + hook-driven workflow
- **Weaknesses**: Concurrency stability + cost unpredictability + ToS risks (Claude OAuth 2026-01 limits)
- **Best Use**: Tasks naturally parallelizable (linting, refactoring, research) where main agent does synthesis
- **Avoid**: High-coupled tasks, strict cost requirements, strong ToS compliance

**Comparison to Anthropic Multi-Agent Guidance**:
- Anthropic article recommends: multi-agent only for 3 scenarios:
  1. **Context protection** (isolate noisy subtasks) ✅ OMOC does this
  2. **Parallelization** (wider search space) ✅ OMOC does this
  3. **Specialization** (distinct tool domains) ✅ OMOC does this with role isolation
  
- But OMOC deviates:
  - Default "ultrawork" = maximum parallelism (vs. Anthropic: start single-agent)
  - "Planner/Consultant/Reviewer/Implementer" job-type roles (vs. context-boundary split) — can lead to "telephone game" info loss
  - Pre-configured multi-agent as entry point (vs. opt-in when justified)

**Recommendation for Cat Café**: Use "nitrogen boost button, not default gear"
- Disable Sisyphus by default
- Enable for specific task domains (parallel research, batch refactoring)
- Monitor context + cost aggressively
- Track token consumption as hard constraint

---

## 3. OPENCLAW ARCHITECTURE LEARNING

### Documents:
- `docs/research/2026-03-16-openclaw-cat-cafe-learning-synthesis.md`
- `docs/discussions/2026-03-16-openclaw-node-learning-meeting-notes.md`

**OpenClaw Key Design Principles**:

1. **Gateway as Single Control Plane** (not just transport)
   - Owns messaging, sessions, routing, channel connections
   - Session state **truth source** (not distributed to clients)
   - Session store: `~/.openclaw/agents/<agentId>/sessions/`
   - Transcript: `~/.openclaw/agents/<agentId>/sessions/<SessionId>.jsonl`

2. **Memory = Plain Markdown (files are source of truth)**
   - Default: `memory/YYYY-MM-DD.md` (daily log) + `MEMORY.md` (long-term)
   - System triggers **automatic pre-seal memory flush** (silent turn before compaction)
   - Model only remembers what's written to disk

3. **Multi-agent Isolation is HARD**
   - Each agent: independent workspace, agentDir, session store, auth profiles
   - Routing via binding to specific agentId
   - **"Multiple brains + strong isolation"** not "one thread with multiple personas"

4. **Nodes ≠ Gateway Replicas**
   - Nodes = companion devices/peripherals
   - Connect via same Gateway WS with `role: "node"`
   - Provide: `canvas.*`, `camera.*`, `screen.record`, `location.get`
   - Messages still land on gateway, not node

5. **Tool/Sandbox Policy Per-Agent**
   - Each agent has own sandbox config + tool allow/deny rules
   - Privilege ratchet: can only get tighter, never looser
   - Tool groups: `group:sessions`, `group:memory`, `group:nodes`

**What Cat Café Already Learned**:
✅ Transport gateway + thread binding (F088)
✅ Unified message pipeline + structured orchestration
✅ Multi-platform connector abstraction (Feishu, WeChat, Telegram)

**What Cat Café Should Learn** (by priority, per meeting):
| Priority | Item | Context |
|----------|------|---------|
| P1 | **Session truth source consolidation** | Unify scattered state (thread/invocation/slot/binding/resume) into Conversation Identity |
| P1 | **Pre-seal durable memory flush** | Auto-trigger memory write before session compaction (F102 alignment) |
| P2 | **Per-cat tool policy** | Runtime tool permission config (allow/deny by family), not just personality |
| P3 | **Lightweight capability host** | Unified abstraction for browser/screenshot/terminal (not full node yet) |
| — | **Full multi-brain isolation** | ❌ Don't copy — violates Cat Café's multi-cat shared truth source model |

**Key Debate**: Opus vs Codex on iOS architecture
- Opus claimed: "iOS maintains two independent WebSocket sessions"
- Codex verification: Not found in official OpenClaw docs, marked "not confirmed"
- **Consensus**: Device can hold multiple roles (operator + node), but dual-WS detail unconfirmed

**Design Philosophy Contrast**:
- OpenClaw: **"One super-agent + N dumb devices"** (extends perception/execution)
- Cat Café: **"N intelligent agents + MCP tool ecosystem"** (extends thinking/collaboration)

---

## 4. MULTI-AGENT ARCHITECTURE COMPARISON

### Document: `docs/research/2026-02-24-multi-agent-comparison-synthesis.md`

**Four Methods Compared**:

| Method | Architecture | Human-in-Loop | Heterogeneity | Maturity | Open Source |
|--------|--------------|---------------|---------------|----------|-------------|
| **Claude Agent Teams** | Centralized Lead + shared DAG | Medium (hooks) | ❌ Same model only | Experimental | ❌ |
| **oh-my-opencode** | Centralized Sisyphus + role isolation | Low (auto-first) | ✅ Fallback chain | Production (unstable) | ✅ |
| **Kimi K2.5 Swarm** | Trained orchestrator (PARL) | Low (self-run) | ❌ Same model only | Research preview | Semi-open |
| **Cat Café A2A** | **Decentralized mention-driven** | **High (棘轮 + dual-channel)** | **✅ Cross-platform** | Production self-use | ❌ Private |

**Cat Café Unique Dimensions**:

1. **No Central Orchestrator** — Cats self-activate via @mention
2. **Worklist as Execution Queue** — Cats can extend chain up to depth 15
3. **Human Authority** — Three-tier approval ratchet + dual-channel push
4. **Cross-Platform Heterogeneity** — Claude/Codex/Gemini in same family
5. **Session Continuity** — Transcript archival + bootstrap injection (others fail at resume)
6. **Dynamic Intent Recognition** — @2+ cats → parallel ideate, @1 cat → serial execute

**Cat Café Limitations vs Others**:
- **Parallel Scale**: Limited (ideate mode is basic) vs Kimi's 100 sub-agents
- **Automatic Orchestration**: Requires human mention vs others auto-delegate
- **Context Sharing**: Isolated + MCP callback vs others have shared episodic memory
- **Cost Predictability**: Depends on manual collaboration patterns vs deterministic algorithms

---

## 5. VISION DRIFT vs SPEC-DRIVEN DEVELOPMENT

### Documents:
- `docs/research/2026-02-27-vision-drift/` (6 research reports + synthesis)
- `docs/mailbox/2026-02-28-opus-to-gemini-f041-ux-discussion.md`

**Vision Drift Problem**: F041 (能力看板) implementation diverged from original intent despite constant communication.

**Root Cause Analysis** (6 sources):
- Transformer context compression erodes goal-tracking
- LLM compliance with own instructions decays over time
- UI-only features lack visual verification infrastructure
- Process embedding (prompt-based) operates in same medium that gets compressed

**Three-Layer Defense Model**:

| Layer | Name | Status | Gap |
|-------|------|--------|-----|
| 1 | **Context Anchoring** | Have CLAUDE.md per-session load | Missing structured "vision anchor" section |
| 2 | **Process Enforcement** | 5 Skills with vision gates | All manual, no hard gates, no tracking |
| 3 | **Technical Embedding** | None | No visual verification, no drift monitoring, no automated gates |

**Recommended Mitigation** (from 6-source consensus):

**A1 (Immediate)**: Add **Anti-Drift Ritual** to CLAUDE.md/AGENTS.md/GEMINI.md
```markdown
## Anti-Drift Protocol
### Non-negotiables
- Read original Discussion/Interview docs before any feature
- AC checkoff ≠ done. Must ask "what does the user see in Hub?"
- UI features need screenshot/video evidence with AC→screenshot mapping

### Definition of Done (checklist)
- [ ] Original requirement docs fully read (with paths)
- [ ] Cross-cat verification (another cat confirms independently)
- [ ] UI screenshot evidence chain complete (if applicable)
- [ ] All ACs + original requirements covered

### Anti-Drift Ritual
- Reread this section after every context compression
- Before each subtask: "Current goal is X, deliverable proof is Y"
```

**A2 (Process)**: Add cross-cat sign-off tracking to feat-completion
```markdown
| Cat | Docs Read | Q1/Q2/Q3 Answers | Result |
|-----|-----------|------------------|--------|
| opus | F041.md, discussions/... | 1. ... 2. ... 3. ... | PASS/FAIL |
| gpt52 | (same) | 1. ... 2. ... 3. ... | PASS/FAIL |
```

**A3 (Frontend UX only)**: Screenshot evidence chain
- 3 key screenshots + 15s video
- Mapping: AC ID → screenshot number
- Tools: Playwright (CI) + Chrome MCP (runtime verification)
- When unclear: escalate to user, can launch worktree service for testing

**A4 (Codex)**: Complete AGENTS.md with discussion convergence check (currently missing)

**Spectrum: Vision-Driven vs Spec-Driven**:

Based on research, Cat Café operates on **spectrum blend**:

| Aspect | Cat Café Practice | Spec-Driven Extreme | Vision-Driven Extreme |
|--------|------|---|---|
| **Upfront Documentation** | Moderate (Discussion + Design Gate) | Heavy (spec-first, gates before code) | Minimal (start coding, iterate) |
| **Measurement** | AC + screenshots + cross-cat verify | Hard metrics, pre-defined acceptance | Subjective ("feels right") |
| **Iteration Freedom** | Constrained (Anti-drift tracking) | Locked (gate failures block progress) | Unlimited (follow inspiration) |
| **Human Oversight** | High (棘轮 + sign-off) | Low (metrics only) | High (subjective judgment) |
| **Scaling Risk** | Medium (manual cross-cat checks) | Low (deterministic gates) | High (subjective diverges) |

**Guidance from Research**:
> "Your process-embedding is valid first layer but riskier than technical gates. Best approach: combine persistent goal files (CLAUDE.md) + external state management + at least one technical gate (e.g., screenshot verification, AC audit hook). Within 12 months, industry will shift from manual practice to automated infrastructure (CORPGEN hierarchical planning, Google's User Alignment Critic). Position to adopt by building foundations now: persistent goals, external state, deterministic orchestration." — Anthropic research via Claude.ai

---

## 6. PORTABLE GOVERNANCE (F070 — 方法论输出)

### Document: `docs/features/F070-portable-governance.md`

**Context**: When cats are dispatched to external projects, they lose "tribal knowledge" — don't know port mapping, SOP, Redis zones, etc. F070 is the methodological export layer.

**Design**:
- **Cat Café = methodology hub** (SOP/Skills/collaboration rules)
- **External projects = independent execution planes** (use templates but own backlog)
- **Non-carrying**: Cat Café private MEMORY.md, Cat Café's BACKLOG.md entries, Cat Café's Feature specs

**Portable Governance Pack** includes:
1. **Governance Pack** (versioned, checksummed)
   - Managed blocks (hard constraints: Redis zones, port reservation, no self-review)
   - Frontmatter contract
   - Backlog methodology template

2. **Skills Symlink** (`project-level .claude/skills/`)
   - A2A exchange five-piece set
   - Anti-drift protocol
   - Review flow rules

3. **Mission Pack Injection** (into dispatched task)
   - mission (1-3 sentences)
   - work_item (external project's task ID)
   - phase (discussing/implementing/reviewing)
   - done_when (max 3 completion criteria)
   - links (relevant URLs)

**Timeline**:
- 2026-03-07 (PR #265): Phase 1 — governance skeleton + gates + Hub health dashboard
- 2026-03-07 (PR #274): Phase 2 — task pack injection + hooks + collaborative rules
- 2026-03-08 (PR #312): Phase 3 — execution result backflow + dispatch progress Hub tab
- 2026-03-20 (PR #602): Gap fix — UX for "governance blocked" with one-click bootstrap

---

## 7. KEY ARCHITECTURAL DECISIONS (ADRs)

### ADR-001: Agent Invocation Approach
- **Decision**: CLI subprocess model (not SDK, not pure API)
- **Why**: Can use subscription credits (Max/Plus/Pro), retains full agent capabilities
- **Refinement**: Support stateless wrapper pattern + MCP callback for unified abstraction

### Related ADRs on Agent Collaboration
- ADR-002: Collaboration Protocol (A2A + worklist semantics)
- ADR-003: Project Thread Architecture (session binding + multi-platform)
- ADR-009: Skills Distribution (per-provider skills folders + symlink strategy)

---

## 8. KEY TAKEAWAYS FOR ARCHITECTURE COMPARISON

### vs OpenClaw
**Learn**:
- ✅ Session truth source consolidation
- ✅ Pre-seal memory flush
- ✅ Per-cat capability registry
- ❌ Don't replicate hard multi-brain isolation (conflicts with Cat Café's collaboration model)

### vs Oh My OpenCode
**Learn**:
- ✅ Hierarchical delegation (main can delegate, workers cannot re-delegate)
- ✅ Hook-driven workflow enforcement
- ✅ Context pressure management (truncation, compression)
- ⚠️ Default to single-agent, enable multi-agent only for parallelizable tasks

### vs Claude Agent Team
**Learn**:
- ✅ Task DAG + file-locking for concurrency safety
- ✅ User can talk to any team member (distributed interaction)
- ✅ Pre-tool-use hook for permission enforcement
- ❌ Insufficient for cross-platform heterogeneity

### Cat Café Unique Positioning
- **Strongest**: Human-in-loop棘轮 + cross-platform heterogeneity + session continuity + anti-drift protocol
- **Weakest**: Auto-orchestration parallelism (requires manual @mention vs. automatic delegation)
- **Growing**: Vision-driven moving toward spec+vision blend with technical gates

---

## 9. FILE INDEX & QUICK REFERENCE

| Topic | Primary Files | Key Sections |
|-------|---------------|--------------|
| **F105 OpenCode** | `docs/features/F105-opencode-golden-chinchilla.md` | Why, What, AC, Timeline |
| **OMOC Assessment** | `docs/research/oh-my-opencode-research.md` | Architecture, Issues, Tech Grade, Best Use |
| **OpenClaw Learning** | `docs/research/2026-03-16-openclaw-cat-cafe-learning-synthesis.md`, meeting notes | What to learn, What NOT to learn |
| **Multi-Agent Compare** | `docs/research/2026-02-24-multi-agent-comparison-synthesis.md` | 4 methods side-by-side, Q1-Q6 analysis |
| **Vision Drift** | `docs/research/2026-02-27-vision-drift/` (6 reports + synthesis) | Root causes, 3-layer defense, A1-A4 mitigations |
| **Portable Governance** | `docs/features/F070-portable-governance.md` | What to carry, Phase 1-3 implementation |
| **Identity Files** | `CLAUDE.md`, `AGENTS.md`, `OPENCODE.md` | Role, SOP, memory system, execution discipline |

---

## 10. TERMINOLOGY MAPPING

| Concept | Cat Café Term | OpenClaw Term | OMOC Term |
|---------|--|--|--|
| Central Orchestrator | CatOrchestration (no center) | Gateway | Sisyphus |
| Multi-agent Pattern | Worklist (mention-driven) | Multi-brain isolation | Role-based hierarchy |
| Session State | Active→Sealing→Sealed chain | Gateway truth source | Subagent stateless |
| Memory | Session + MEMORY.md (Markdown) | Plain Markdown files | Hook-managed context |
| Tool Permissions |棘轮 (ratchet) per-cat | Per-agent tool policy | Prompt + tool constraints |
| Collaboration | A2A mention + parallel/serial intent | Direct agent communication | Parent delegate task |

---

**End of Summary**
