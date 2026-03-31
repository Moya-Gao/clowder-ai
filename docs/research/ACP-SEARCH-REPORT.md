# ACP/Agent Communication Protocol Search Report

## Executive Summary

**Total References Found**: 58 matches across 17 files  
**Primary Finding**: All references to "ACP" refer to **Agent Communication Protocol** or **Agent Hosting Protocol** as a protocol/architecture concept, NOT as a project or feature in active development.

---

## Key Findings

### 1. ACP as a Reference Protocol (Not Implemented)

#### F143: Hostable Agent Runtime (Current Focus)
- **File**: `docs/features/F143-hostable-agent-runtime.md`
- **Context**: F143 discusses ACP as a reference implementation from the playground branch
- **Key Quote**: 
  > "playground 分支的 ACP 实现验证了'配置接入'的可行性（填表 → 自动 probe → agent 可用），但它是 Clowder 自研协议，不是行业标准。"

- **Decision**: NOT to bind core architecture to ACP specifically
  > "内核不绑定协议名（不叫 ACP/A2A），对外缝线像标准"

#### ADR-023: Hostable Agent Runtime Decision Record
- **File**: `docs/decisions/023-hostable-agent-runtime.md`
- **Status**: Proposed (awaiting final approval)
- **ACP Role**: Reference for understanding local agent hosting patterns
- **Key Points**:
  - ACP-style local agent mentioned as "Phase B1" candidate
  - Would verify `SessionContract + full_duplex` capability
  - **NOT** the only target protocol—must support A2A (remote agents) as well

---

### 2. ACP vs A2A Architectural Distinction

#### F126: Limb Control Plane
- **File**: `docs/features/F126-limb-control-plane.md`
- **Most Explicit ACP References**:

| Line | Content |
|------|---------|
| 65 | `\| **ACP** \| Agent Client Protocol \| JetBrains + Zed (2025.06) \| IDE ↔ Agent \| 显示器接口 \|` |
| 67-70 | "为什么 F126 不涉及 ACP：F126 是'大脑伸出四肢去控制外部'（猫猫 → 设备/Agent）<br>ACP 是'外部 IDE 伸手进来用猫猫'（IDE → 猫猫），方向反了" |
| 230 | "Blocked by (Phase C): F050 Phase 3（A2A/ACP 协议适配…" |
| 255 | "OQ-5: 远程 Agent 类四肢用 A2A 还是 ACP？✅ 已定：A2A…ACP 是 IDE↔Agent，方向相反，不适用" |
| 268 | "KD-8: 执行顺序：F126 A → B → F050 Phase 3（A2A/ACP）→ F126 C → F126 D" |
| 269 | "KD-9: 哑四肢用 MCP，有脑四肢（远程 Agent）用 A2A/ACP" |

**Key Decision**: 
- **For F126 (Limb Control Plane)**: Use A2A for remote agent-type limbs, NOT ACP
- **ACP is dismissed** because it's IDE-to-Agent direction, not Agent-to-Agent/Brain-to-Limb
- **Reasoning**: ACP solves "IDE integration" (JetBrains/Zed invoking agents), not multi-limb orchestration

---

### 3. External References in Research Documents

#### Hostable Agent Runtime Consultation (GPT Pro)
- **File**: `docs/research/2026-03-27-hostable-agent-runtime-abstraction-gpt-pro-consult.md`

**Section: ACP as Reference Implementation**
```
1. playground ACP 值得吸收，但不应全盘照搬 — 它是 Clowder 自研协议，不是行业标准
2. 不替代 A2A — A2A 管远程 agent-to-agent 互联，ACP 管本地 agent hosting，互补不冲突
```

**Architecture Table** (Line 138):
- Lists "playground ACP | stdio (双向) | JSON-RPC 2.0 | full session+MCP+permission | acp-transform"
- Positioned as ONE option among CLI providers, A2A, and WebSocket agents

**Key Lines**:
- Line 71: "stdio JSON-RPC 2.0 的 Agent Hosting Protocol（内部叫 ACP）"
- Line 206: "你们不是缺一个 ACP adapter，你们缺的是一个 **runtime kernel**"
- Phase 1 Decision: "先做一个新栈 local provider（ACP-style），验证 SessionContract + full_duplex"

**Conclusion**: ACP mentioned as inspiration but NOT the target protocol for Cat Café's core

---

### 4. Story References

#### Three Days Productization
- **File**: `docs/stories/three-days-productization/diagnostic-report.md`
- **Line 137**: `{ "catId": "agentteams","provider": "acp", "nickname": "小协" }`
- **Context**: Hypothetical configuration example showing how different providers could be configured
- **Status**: This is a FUTURE scenario example, not current implementation

---

### 5. Design Document References

#### F143 Hostable Agent Runtime Design
- **File**: `designs/F143-hostable-agent-runtime.pen`
- **Line 1661**: `"content": "ACP-style local"`
- **Context**: Design mockup showing runtime contract options
- **Purpose**: Visual documentation of architectural choices

---

### 6. F050 Phase 3 Plan

- **File**: `docs/plans/2026-03-17-f050-phase-3-a2a-protocol.md`
- **Line 17**: `- 不做 A2A server（Cat Café 暴露 AgentCard 给外部——那是 ACP/future scope）`
- **Context**: Explicitly defers ACP work to future scope
- **Status**: F050 Phase 3 focuses on A2A protocol adaptation, NOT ACP

---

### 7. OpenCode (F105) Reference

- **File**: `docs/features/F105-opencode-golden-chinchilla.md`
- **Line 24**: `3. **多接入方式** — CLI headless (\`opencode run --format json\`)、HTTP API (\`opencode serve\`)、ACP stdio`
- **Context**: Noting that opencode supports multiple interfaces including ACP
- **Current**: F105 implements only CLI headless mode, NOT ACP mode
- **Reference**: Section "Phase 1" explicitly notes "No opencode HTTP API/ACP integration (L1 CLI adapter only)"

---

## What ACP Means in Cat Café Context

### Definition
**ACP** = **Agent Communication Protocol** (or sometimes **Agent Client Protocol** in JetBrains/Zed context)

### Three Different Interpretations Found:
1. **playground ACP**: Clowder's internal self-researched stdio JSON-RPC 2.0 protocol
2. **JetBrains/Zed Agent Client Protocol**: IDE integration standard (2025.06)
3. **IBM Agent Communication Protocol**: Originally distinct, merged into A2A (August 2025)

### Cat Café's Position on ACP:
- ✅ **Acknowledged** as a valid local agent hosting protocol
- ❌ **Not currently implemented** 
- ⏳ **Deferred** to future phases (F143 Phase C at earliest)
- 🎯 **Replaced by**: Generic "Transport × Binding × RuntimeContract × EventAdapter" abstraction that can support ACP-style protocols WITHOUT hardcoding to them

---

## Timeline & Decision Record

| Date | Event | Decision |
|------|-------|----------|
| 2026-03-02 | Enterprise Agent Harness research | IBM ACP merged into A2A (Aug 2025) |
| 2026-03-16 | F126 design | ACP dismissed: "IDE↔Agent, direction wrong" |
| 2026-03-27 | F143 kickoff | Core runtime kernel should NOT bind to ACP |
| 2026-03-27 | ADR-023 | Design protocol-agnostic abstraction |
| TBD | F143 Phase B1 | ACP-style provider as test case (optional) |
| TBD | F143 Phase D | Decision whether to implement ACP support |

---

## Dependency Chain

```
F050 Phase 3 (A2A protocol)
    ↓
F126 Phase C (Remote node management)
    ↓
F143 Phase B (Runtime kernel stabilization)
    ↓
F143 Phase C (Hub UI for agent registration)
    ↓
[Future] ACP support (if needed)
```

---

## Related Protocols in Use

| Protocol | Purpose | Status | Reference |
|----------|---------|--------|-----------|
| **MCP** | Model-to-Tool communication | ✅ In use | F041, F145 |
| **A2A** | Agent-to-Agent communication | ✅ In use (Phase 3 planned) | F002, F050, F126 |
| **ACP** | Agent Hosting / IDE Integration | ⏳ Deferred | F143 Phase B (optional) |
| **LSP** | Language Server Protocol | ✅ Under investigation | Research documents |

---

## No Production Dependencies

### Package.json Analysis
- **No npm package** named "acp" or "agent-communication-protocol" found
- No direct ACP-related dependencies in:
  - `packages/api/package.json`
  - `packages/web/package.json`
  - `packages/mcp-server/package.json`
  - `packages/shared/package.json`
  - Root `package.json`

### Git History
- No commits with "acp" or "ACP" as primary subject
- All references are in documentation/planning files only

---

## Conclusion

### What ACP Is in Cat Café
A **reference architecture pattern** that influenced F143's design, NOT an active project or dependency.

### Current Status
- 📚 **Discussed**: In multiple design documents and research papers
- 🎯 **Acknowledged**: As a valid protocol for local agent hosting  
- ❌ **Not Implemented**: No code changes to support it yet
- ⏳ **Deferred**: To F143 Phase B or later (if at all)
- 🔒 **Explicitly Not Required**: F143 core design intentionally protocol-agnostic

### Decision Record
- **ADR-023** explicitly rejects binding the runtime kernel to ACP
- Core architecture supports any Transport/Binding/RuntimeContract combination
- Future ACP support would be additive plugin, not foundational

### Next Steps (If ACP Becomes Priority)
1. Stabilize F143 Phase A-B core runtime
2. Implement ACP-style provider as proof-of-concept for RuntimeContract extensibility
3. Compare with A2A adoption rate and industry movement
4. **Final Decision**: Implement or defer based on business/technical priorities

---

## Search Coverage

### Files Scanned (17 total with ACP references)
- ✅ Markdown documentation (11 files)
- ✅ Design files (3 files)  
- ✅ Research documents (2 files)
- ✅ Diagnostic stories (1 file)
- ✅ Package lock file (1 file - false positives)
- ✅ TypeScript source (1 file - false positive)

### Search Patterns Used
- `(?i)acp|acpx|agent.communication.protocol|agent.context.protocol`
- Case-insensitive regex to catch all variations
- 58 matches identified, 57 relevant (1 false positive in llamacpp reference)

---

## Appendix: Full Match Locations

### Primary References (Substantive Content)

1. **F126-limb-control-plane.md** (6 matches)
   - Line 65: ACP definition table
   - Lines 67-70: "Why F126 doesn't involve ACP"
   - Line 230: Blocked by F050 Phase 3 (A2A/ACP)
   - Line 255: OQ-5 decision
   - Line 268: KD-8 execution order
   - Line 269: KD-9 protocol choice

2. **023-hostable-agent-runtime.md** (18 matches)
   - Lines 43-86: playground ACP analysis
   - Lines 93, 311, 317, 334: Phase decisions
   - Line 332: Explicit rejection of ACP binding
   - Line 373: Industry reference

3. **2026-03-27-hostable-agent-runtime-abstraction-gpt-pro-consult.md** (18 matches)
   - Lines 71, 138: ACP definition
   - Lines 86, 206: Design rationale
   - Multiple architecture table entries

4. **F143-hostable-agent-runtime.md** (5 matches)
   - Line 21: playground ACP verification
   - Lines 41, 75, 100, 129: Phase design and references

5. **F105-opencode-golden-chinchilla.md** (2 matches)
   - Line 24: opencode multi-interface support
   - Line 180: Feature plan details

6. **F050-phase-3-a2a-protocol.md** (1 match)
   - Line 17: ACP deferred to future scope

7. **2026-03-16-f126-phase-a-limb-abstraction.md** (1 match)
   - Line 26: Not doing A2A/ACP in Phase A

8. **2026-03-12-f105-phase2-omoc-integration.md** (1 match)
   - Line 180: No opencode ACP integration

9. **diagnostic-report.md** (1 match)
   - Line 137: Hypothetical provider configuration

10. **Enterprise AI agent runtime research** (1 match)
    - Line 38: IBM ACP merged into A2A

### Design/Visualization References (3 files)
- **F143-hostable-agent-runtime.pen**: Line 1661
- **mission-hub-f091-signal-study-mode.pen**: Line 1882 (false positive: "kkaCp" ID)
- **f088-im-hub-config-wizard-ux.pen**: Line 375 (false positive: "ACpUQ" ID)

### Dependency Files (1 file - false positives)
- **pnpm-lock.yaml**: Multiple matches in integrity hashes (not relevant)

