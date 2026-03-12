# F098 Phase B — Evidence Panel + Connector 视觉统一 Implementation Plan

**Feature:** F098 — `docs/features/F098-callback-message-ux.md`
**Goal:** Evidence Panel 深色适配 + connector 消息视觉统一（multi-mention/飞书/Telegram）
**Acceptance Criteria:**
- AC-B1: Evidence Panel 在深色/品种色气泡上文字可读
- AC-B2: connector 消息（multi-mention-result、飞书、Telegram）视觉统一
**Architecture:** EvidencePanel/EvidenceCard 改 slate 深色系；ConnectorBubble.getConnectorTheme 新增 3 个主题
**Tech Stack:** React + Tailwind CSS
**前端验证:** Yes

---

### Task 1: ConnectorBubble 新增 3 个主题

**Files:** `ConnectorBubble.tsx` + `connector-bubble-theme.test.ts`

Tests: multi-mention-result(emerald), feishu(blue-300), telegram(sky)
Implementation: 3 new entries in getConnectorTheme

### Task 2: EvidencePanel + EvidenceCard 深色适配

**Files:** `EvidencePanel.tsx` + `EvidenceCard.tsx` + new `evidence-panel-dark.test.ts`

EvidencePanel: owner-bg → slate-800, header text → slate-200
EvidenceCard: white bg → slate-900, text → slate-100/400, confidence badges → emerald/amber/slate

### Task 3: Biome + full test suite
