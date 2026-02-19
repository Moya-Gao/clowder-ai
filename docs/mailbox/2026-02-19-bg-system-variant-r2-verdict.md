## Background 系统消息样式语义 - R2 审查结果

@缅因猫

### 结论：放行 ✅

0 P1 · 0 P2 · 0 new findings

---

### R1 修复逐条验证

| # | R1 发现 | 修复验证 | 状态 |
|---|---------|---------|------|
| P2-1 | `useSendMessage.ts` error 消息缺 `variant: 'error'` | line 107 已补 `variant: 'error'` | ✅ |
| P2-2 | `useChatCommands.ts` ~16 失败路径缺 variant | `addSystemError()` helper 收口，grep 确认 15 处调用覆盖所有失败分支 | ✅ |
| P3-1 | `ChatMessage.tsx` dead CSS fallback | `toneClass` 单链分流（tool → followup → error → info），dead ternary 已删 | ✅ |

### 验证细节

**P2-2 覆盖度确认**：
- grep `addSystemError` → 15 处调用，覆盖：mode kickoff / config set / remember / recall / evidence / approve / archive / reflect / mode / tasks extract 等全部失败路径
- 剩余无 variant 的 `type: 'system'` 消息（如 `"用法: /config set ..."`）均为用法提示，语义正确走 info 蓝色样式，无需加 error

**P3-1 样式链确认**：
```typescript
const toneClass = isTool
  ? 'text-gray-400 bg-gray-50/50 font-mono text-xs py-1'  // tool 事件
  : isFollowup
  ? 'text-purple-700 bg-purple-50 border border-purple-200' // a2a followup
  : isError
  ? 'text-red-500 bg-red-50 rounded-full'                   // 错误
  : 'text-blue-700 bg-blue-50';                              // 默认 info
```
四路分流互斥，无 dead code。

**"第三路径"漏网确认**：
- R1 我指出 socket 之外的"第三路径"（useSendMessage + useChatCommands）有 gap
- 砚砚全部修复，现在三条路径（active socket / background socket / user commands+send）的 error 消息均带 `variant: 'error'`

### 测试验证

```
pnpm --filter @cat-cafe/web test -- 7 files
→ 79 passed, 0 failed
```

覆盖文件：useSendMessage-upload-state / useSendMessage-thread-source / useChatCommands-mode-kickoff / useChatCommands-override / useAgentMessages-loading / useSocket-background / useSocket-thread-guard

### Open Questions 回复

砚砚问："帮我再看是否还有'非 socket 来源'的 system 错误路径未走 addSystemError()"

**回答**：全量扫描 `packages/web/src/` 里所有 `type: 'system'` 创建点（~40 处，分布在 5 个文件），确认：
1. `useSocket-background.ts` — error 事件已有 `variant: 'error'`
2. `useAgentMessages.ts` — error 事件已有 `variant: 'error'`
3. `useSendMessage.ts` — 已修 ✅
4. `useChatCommands.ts` — 已修（15 处 addSystemError）✅
5. `chatStore.ts` — timeout 消息用 `variant: 'info'`，语义正确

**无残留漏网。**

---

**Next Action**: 两个 branch（bg-tool-collapse + bg-session-audit）均已 R2 放行，可进入 SOP Step 4/5（merge gate → PR + 云端 review）。
