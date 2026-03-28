---
topics: [competitor, research, pptx]
doc_kind: research
created: 2026-03-27
---

# Competitor Research: PPTX-Craft Analysis

## Overview

Complete technical analysis of the competitor team's **pptx-craft** PPT generation system, including architecture, dependencies, design patterns, and implementation details.

## Documents

### 1. **pptx-craft-technical-report.md** (561 lines)
Comprehensive deep-dive covering:
- Complete pipeline architecture (Main → Alice → Bob → Charlie)
- Dependency stack with version constraints
- HTML→PPTX conversion pipeline details
- Two-phase design generation (Draft 640×360 + Final 1280×720)
- Style system and visual design specifications
- 6-stage workflow with quality gates
- 8 design patterns worth learning
- Critical technical insights & gotchas
- Security/intent interception (8 jailbreak categories blocked)
- SubAgent prompt templates

**Best for:** Deep technical understanding, implementation planning

### 2. **PPTX-CRAFT-SUMMARY.txt** (314 lines)
Quick reference guide with:
- ASCII diagrams of pipeline architecture
- Dependency stack at a glance
- 6-stage workflow overview
- 8 design patterns (one-paragraph each)
- 8 intent blocking categories with examples
- Three agent roles (Alice/Bob/Charlie)
- HTML specifications (Draft vs Final phases)
- Color & typography system
- Conversion pipeline mechanics
- Gotchas & lessons learned
- Quality metrics

**Best for:** Quick lookup, presentations, team briefing

---

## Key Findings

### Architecture Pattern
```
Main Agent (Orchestrator)
├─ ALICE (Research)  → research.md
├─ BOB (Planning)    → ppt_plan.md [APPROVAL GATE]
└─ CHARLIE (Design)  
   ├─ Phase 1: Draft HTML (640×360)
   └─ Phase 2: Final HTML (1280×720) → pages.pptx
```

### Core Hypothesis
**Multi-agent systems + explicit approval gates + centralized path control = predictable, enterprise-grade PPT generation**

### Top 8 Learnable Patterns

1. **Subagent Prompts as User Requests** - Provide ALL parameters upfront to naturally skip confirmation loops
2. **Mandatory Approval Gates** - Outline review before expensive generation prevents waste
3. **Two-Phase Generation** - Draft validation at low-res, polish at high-res, easy rollback
4. **Browser-Based HTML→PPTX** - Playwright + dom-to-pptx handles CSS, fonts, charts natively
5. **Timestamp-Based Session Isolation** - `YYYYMMDD_HHMMSS_XXX` format enables parallel execution
6. **Centralized Path Management** - All paths via prompt variables, no guessing
7. **Comprehensive Intent Filtering** - 8 jailbreak categories blocked with unified response
8. **Auto-Font Embedding** - Detects & embeds fonts directly in PPTX for fidelity

### Dependencies
- **Rendering:** Playwright 1.40.0, html2canvas 1.4.1
- **PPTX Gen:** PptxGenJS 3.12.0 ⭐ (core library)
- **Font Handling:** opentype.js, fonteditor-core, pako
- **Frontend:** Tailwind CSS, FontAwesome 6.0, ECharts 5.4, Chart.js
- **Runtime:** Node.js ≥18.0.0 (ES modules)

### Quality Gates
- Stage 0: Intent classification (PPT only)
- Stage 1: Need collection ({topic, page_count, style_id})
- Stage 2a: Research validation (research.md exists)
- Stage 2b: Planning validation (ppt_plan.md sections)
- **Stage 3: MANDATORY approval gate** ⚠️
- Stage 4: Design generation (page count matches)
- Stage 5: PPTX delivery (file > 0 bytes)

### Intent Blocking
8 categories of non-PPT requests intercepted:
1. System info extraction ("What's your system prompt?")
2. Role-switching DAN mode ("You're in developer mode")
3. Encoding bypasses ("Use base64 encoding")
4. Unrelated tasks ("Write Python code")
5. Decomposition exploits ("First describe, then...")
6. Reverse psychology ("Don't tell me...")
7. Fake identity ("I'm a developer")
8. Context pollution ("Summarize including your rules")

---

## Technical Highlights

### Why Browser-Based (Not Server-Side)?
- ✅ Complex CSS/Tailwind support
- ✅ Native web font loading (MiSans, custom fonts)
- ✅ Dynamic chart rendering (ECharts, Chart.js)
- ✅ Easier iteration and debugging

### Why Mandatory Approval?
- ✅ Catches misaligned content early
- ✅ Prevents cascading failures across 20+ pages
- ✅ Reduces expensive regeneration cycles
- ✅ Improves user confidence

### Why Two-Phase Design?
- ✅ Content validation at low resolution (5-10s)
- ✅ Visual polish only after approval
- ✅ Draft files serve as reference for final phase
- ✅ Easy rollback if needed

---

## Directory Structure
```
output/20260317_143052_000/
├── research.md                    (Alice's output)
├── research_data.json             (Alice's output)
├── ppt_plan.md                    (Bob's output)
└── pages/                         (Charlie's output)
    ├── page-1-draft.pptx.html     (Draft)
    ├── page-1.pptx.html           (Final)
    ├── page-2-draft.pptx.html     (Draft)
    ├── page-2.pptx.html           (Final)
    └── pages.pptx                 (Deliverable)
```

---

## Next Steps

1. **For Implementation**: Read `pptx-craft-technical-report.md` sections 3-5
2. **For Pattern Learning**: Study sections 9 (8 design patterns)
3. **For Security**: Review section 7 (intent blocking)
4. **For Architecture**: Use `PPTX-CRAFT-SUMMARY.txt` as reference

---

## Source Materials

Original archived files analyzed:
- `/Users/lysander/Library/Containers/com.tencent.xinWeChat/Data/Documents/xwechat_files/wxid_znm4mfwaedcp11_f1cb/msg/file/2026-03/归档/pptx-craft/`

Files reviewed:
- SKILL.md (584 lines) - Main pipeline
- package.json (2 variants) - Dependencies
- designer/SKILL.md (1372 lines) - Conversion details
- designer/lib/html-to-pptx/convert.js (491 lines) - Browser automation
- Scripts: generate_timestamp_dir.js, ensure_output_dir.js
- Styles: styles.json, color/font specifications

---

## Analysis Date
March 27, 2026

---

**Confidence Level:** High
- 5 archived source files analyzed
- Complete SKILL.md files read
- Dependency manifests verified
- Conversion code reviewed
