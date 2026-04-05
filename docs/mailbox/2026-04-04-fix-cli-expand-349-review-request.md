# Review Request: fix(web) CliOutputBlock 不尊重 defaultExpanded (clowder-ai#349)

Review-Target-ID: fix-cli-expand-349
Branch: fix/cli-output-block-expand-default-349

## What

修复 `CliOutputBlock` 两处状态逻辑 bug：
1. streaming→done 时 `setExpanded(false)` 改为 `setExpanded(defaultExpanded)`
2. 新增 useEffect 同步 `defaultExpanded` prop 变更（对齐 ThinkingContent 已有的同步逻辑）

两处修复都尊重 `userInteracted` ref，用户手动操作不会被覆盖。

## Why

社区用户报告（clowder-ai#349）：设置为"展开"后，新回复和 F5 刷新后气泡仍然折叠。
根因是 CliOutputBlock 在两个场景下忽略了 `defaultExpanded` prop。

## Original Requirements（必填）

> 前置条件：已经在系统配置中打开了气泡显示：展开
> 问题1：给猫猫发消息，猫猫在当前thread窗口回复的新消息默认是折叠的。
> 问题2：F5刷新后，聊天窗口所有的消息都被折叠起来了，切换thread后又全部展开了。

- 来源：`https://github.com/zts212653/clowder-ai/issues/349`
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

无备选方案取舍。这是明确的逻辑 bug，修法直截了当：
- Bug 1 只改了 `false` → `defaultExpanded`，最小侵入
- Bug 2 复用了 ThinkingContent 已验证的 useEffect 模式

## Open Questions

1. `streaming→done` 的自动收起行为（AC-A6）在 `defaultExpanded=false` 时保持不变，请确认既有测试 `auto-collapses when status changes from streaming to done` 仍然通过（已通过）
2. 新增的 prop 同步 useEffect 和 streaming→done useEffect 可能在同一 render cycle 触发——请审查是否有 race condition

## Next Action

请 review 代码改动（2 文件 63 行新增），重点关注 Open Questions 中的两点。

## 自检证据

### Spec 合规

社区 bug fix，无内部 spec。对照 issue 描述的两个问题：
- 问题 1（新回复折叠）→ Bug 1 修复 + 回归测试覆盖
- 问题 2（F5 刷新全折叠）→ Bug 2 修复 + 回归测试覆盖

### 测试结果

```
pnpm --filter @cat-cafe/web test  # 270 files / 1921 tests passed, 0 failed
pnpm lint                         # 0 errors (pre-existing warnings only)
pnpm check                        # 0 errors (biome)
pnpm -r --if-present run build    # exit 0
```

### 相关文档

- Issue: clowder-ai#349
- 改动文件:
  - `packages/web/src/components/cli-output/CliOutputBlock.tsx`（逻辑修复）
  - `packages/web/src/components/__tests__/cli-output-block.test.ts`（2 个回归测试）
