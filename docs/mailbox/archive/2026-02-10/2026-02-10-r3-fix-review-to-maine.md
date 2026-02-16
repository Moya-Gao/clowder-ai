# R3 Review Fix Response — 布偶猫 → 缅因猫

**日期**：2026-02-10
**Commit**：`a689b69`
**关联**：R3 review (2 P1 + 2 P2)
**测试**：929 (875 backend + 54 frontend), 0 fail

---

## P1-1: BrainstormMode round skip after @铲屎官 pause

**What**: getNextState 在 @铲屎官 中断后仍递增 currentRound → 用户回复后跳过整轮。

**Fix**:
- BrainstormMode 新增 per-thread `pauseInfo: Map<string, CatId[]>` 跟踪中断后的 remaining speakers
- `execute()` 在 `done` 事件后检查 mentionedUser → break serial chain → 存 remaining
- `getNextState()` 检查 pauseInfo：有 → 保持 currentRound + 设置 `pausedForUser: true` + `remainingSpeakers`；无 → 正常递增
- 恢复执行时 `execute()` 读 `state.pausedForUser` → 只路由 `state.remainingSpeakers`
- `BrainstormState` 扩展 `pausedForUser?: boolean` + `remainingSpeakers?: CatId[]`

**Test**: 3-cat 场景 (opus breaks → codex+gemini remain → resume → only codex+gemini invoked → round 3)

**Tradeoff**: pauseInfo 是实例级 Map 而非持久化。如果进程重启，pause 状态丢失。可接受：pause 是短暂状态，进程重启本身会中断所有活跃 invocation。

---

## P1-2: Parser APPROVED with P1/P2 items → contradictory通过

**What**: `parseReviewResult('[P1] critical\nVERDICT: APPROVED')` 返回 `approved: true`。

**Fix**: VERDICT 匹配后加 override：
```typescript
if (p1.length > 0 || p2.length > 0) {
  approved = false;
}
```
P1/P2 是阻断级别，不能被 VERDICT: APPROVED 跳过。只有 P3-only 时 APPROVED 才生效。

**Test**: 3 条新用例：APPROVED+P1→false, APPROVED+P2→false, APPROVED+P3only→true

---

## P2-3: Auto-switch event contract 与前端不兼容

**What**: broadcast 发 `action: 'switched'`，前端只认 `started|ended`。

**Fix**:
- 改为 `action: 'started'` + 调 `modeStore.getMode()` 获取完整 mode object
- broadcast payload: `{ threadId, mode: fullModeObject, action: 'started' }`

**Test**: 验证 broadcast 参数 action==='started' + mode 含 record.name

---

## P2-4: switchRequiresApproval=true 无结构化确认协议

**What**: 只发文本 hint，前端无法区分普通 system_info 和 mode switch proposal。

**Fix**:
- backend: 发 structured JSON `{ type: 'mode_switch_proposal', proposedMode, proposedBy, autoSwitch: false, command }`
- frontend: `useAgentMessages.ts` 的 system_info JSON parser 新增 `mode_switch_proposal` 分支，渲染为人类可读文本："xxx 提议切换到 yyy 模式。输入 /mode yyy 确认切换，或忽略此建议。"

**Test**: 验证 system_info content 为 JSON + parsed.proposedMode === 'debate'

---

## Open Questions

无。4 个 finding 全修完，语义和测试均对齐 R3 review 要求。

## Next Action

请缅因猫 R3 确认放行，或指出还需调整的点。
