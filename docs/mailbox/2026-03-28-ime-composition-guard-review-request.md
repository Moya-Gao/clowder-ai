# Review Request: Chrome IME 回车误提交全量修复

Review-Target-ID: fix-ime-composition-guard
Branch: fix/ime-composition-guard

## What

创建 `useIMEGuard` hook 并全量替换 19 个输入组件的 IME 防护，修复 Chrome 上中文输入法按 Enter 选词时误触发表单提交的问题。

核心变更：
- **新增** `packages/web/src/hooks/useIMEGuard.ts` — 用 `compositionstart/end` 事件 + `requestAnimationFrame` 延迟清除 composing 状态
- **修复** 15 个组件：将 `e.nativeEvent.isComposing` 替换为 hook 调用
- **修复** 2 个组件（ThreadItem, SectionGroup）：将 `isComposingRef` 无延迟模式替换为 hook
- **补防** HubPermissionsTab：之前完全没有 IME 守卫
- **更新** 4 个测试文件：模拟方式从 `Object.defineProperty(event, 'isComposing', ...)` 改为 `compositionstart → keydown` 事件序列
- **新增** 5 个 hook 单元测试（含 Chrome 事件序列场景）
- **记录** LL-044 教训

## Why

Chrome 的事件顺序是 `compositionend → keydown(Enter, isComposing: false)`，与 Firefox 相反。`e.nativeEvent.isComposing` 在 Chrome 上对 Enter 键无效，因为 Enter 的 keydown 触发时 composition 已经结束了。铲屎官报告主聊天输入框中文输入时按回车选词会直接提交消息。

## Original Requirements（必填）
> "猫猫输入界面里面，一直有个问题，就是中文输入按回车，他不仅选择了，而且会直接输入提交。这样中文输入中夹杂着英文的时候，很容易打字一半就提交给猫猫了。"
> "你们还得全量扫瞄一下各种可以输入的地方还有哪里有这个问题？然后必须记录到我们的教训里？"
- 来源：当前会话铲屎官直接消息
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 `requestAnimationFrame` 延迟（~16ms）而非固定 `setTimeout(50ms)`：rAF 更精确，刚好覆盖一帧内的事件序列
- 选择统一 hook 而非每个组件自己管 ref：17 个组件统一模式，减少遗漏风险
- `cancelAnimationFrame` 处理快速连续输入场景：避免前一次 compositionEnd 的清除误伤新一轮输入

## Open Questions

1. **rAF vs setTimeout 选择**：rAF 在后台标签页会被暂停，但输入框在后台标签页也不会有交互，所以应该安全。请 reviewer 评估。
2. **SchedulePanel.tsx** 的 `onKeyDown={(e) => e.key === 'Enter' && handleToggleExpand(task.id)}` 未修——该 Enter 只是 toggle 展开/折叠，不是提交动作，IME 误触发影响极低。请 reviewer 确认是否需要补。

## Next Action

请 review 代码质量 + 修复完整性，确认无遗漏后放行。

## 自检证据

### Spec 合规
- Bug fix，无 feature spec
- 铲屎官需求：✅ 全量扫描 + ✅ 修复 + ✅ 记录教训 LL-044

### 测试结果
```
pnpm --filter @cat-cafe/web test  # 254 files, 1796 passed, 0 failed
pnpm --filter @cat-cafe/web lint  # 0 errors
pnpm biome check                  # 0 errors
```

### 相关文档
- Lesson: `docs/lessons-learned.md` LL-044
- Hook: `packages/web/src/hooks/useIMEGuard.ts`
- Hook test: `packages/web/src/hooks/__tests__/useIMEGuard.test.ts`

---
Author: [宪宪/Opus-46🐾]
