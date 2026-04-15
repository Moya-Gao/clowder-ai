# Review Request: F144 AC-D5 垂直切片 — htmlToSlide 编排器

Review-Target-ID: f144-d5
Branch: feat/f144-d5-vertical-slice

## What

新增 `htmlToSlide` 编排函数，将 AI-direct HTML→PPTX 管线的五个独立模块串成单一入口：

```
HTML → flatExtract(Playwright) → screenshot(4x Retina)
     → densityGate(<30%) → routeElements(flat)
     → buildCompiledDeck → PPTX buffer
```

**文件变更**:
- `packages/ppt-forge/src/compiler/vertical-slice.ts` — 编排器实现（~110 行）
- `packages/ppt-forge/test/compiler/vertical-slice.test.ts` — 3 个 e2e 测试
- `packages/ppt-forge/examples/d5-architecture-slice.html` — 修复 `.slide` → `.ppt-slide`（符合 flat-dom-compiler 契约）

## Why

AC-D5 要求"1 页高密页走完 HTML→截图→density→PPTX 全链路"。此前五个模块各自独立可用但无编排层。`htmlToSlide` 是 D7（Skill 化/管线集成）的前置。

## Original Requirements（必填）

> "你更新一下 f144？然后按照你觉得合适的方式直接搞？先把 c 四个 ac 收敛然后继续"
> "@opus 可以 按照规划走起来"

- 来源：铲屎官当面指示（2026-04-13/14 会话）
- AC-D5 spec：`docs/features/F144-ppt-forge.md` line 303
- **请对照 AC-D5 定义判断四件套交付是否完整**

## Tradeoff

- Screenshot 用独立 Browser 实例而非复用 flatExtract 的 page（flatExtract 在提取后立即关闭 page，修改其内部逻辑会影响所有消费者）
- 华为 example HTML 修改 `.slide` → `.ppt-slide`（遵守 flat-dom-compiler 的 CSS selector 契约，而非在 compiler 中加第二个 selector）

## Open Questions

1. **密度阈值**：当前硬编码 0.3（30%），D6 华为级验收时是否需要更严（如 0.25）？
2. **Screenshot browser 生命周期**：当前与 flatExtract browser 独立管理，D7 集成时可考虑合并

## Next Action

请 @codex 做结构审：
- [ ] 管线链路是否正确（flatExtract → densityGate → route → build → write）
- [ ] 四件套返回值是否完整（HTML/截图/density/PPTX）
- [ ] 测试覆盖是否充分
- [ ] example HTML 的 `.ppt-slide` 修改是否合理

## 自检证据

### Spec 合规
- AC-D5 四件套: HTML ✅ / screenshot(4x PNG) ✅ / densityReport ✅ / PPTX ✅
- 密度门禁 < 30%: ✅（测试断言通过）
- 文本可编辑（非截图）: ✅（textCount >= 20 断言通过）
- 空 HTML 拒绝: ✅（throws on 0 elements）

### 测试结果
```
pnpm --filter @cat-cafe/ppt-forge test → 242 passed, 0 failed ✅
pnpm --filter @cat-cafe/ppt-forge lint → 0 errors ✅
pnpm biome check → 0 errors ✅
```

### 相关文档
- Feature: `docs/features/F144-ppt-forge.md`
- Phase D spike: `packages/ppt-forge/test/spike-dom-to-pptx.test.ts`
- KD-16/KD-17: AI-direct HTML path decision
