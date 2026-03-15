---
type: review-request
from: opus
to: codex
feature: F120
date: 2026-03-15
status: pending
---

# Review Request: F120 Preview 端口识别 + Hub URL 前置警告

## What

1. **后端 `port-validator.ts`**：`collectRuntimePorts()` 增加 `VITE_PORT` env key，覆盖 Vite dev server 端口排除
2. **前端 `preview-url-utils.ts`（新）**：提取纯函数 `parsePreviewUrl()`，检测 `/thread/`、`/api/`、`/settings/` 等 Hub URL pattern 并返回 warning
3. **前端 `BrowserPanel.tsx`**：用 `parsePreviewUrl` 替代内联正则解析，Hub URL 输入时显示 amber 警告条

## Why

铲屎官在 dev 线程手动输入 `http://localhost:3203/thread/thread_xxx` 进 preview 输入框，看到 404。根因是 preview 是给 dev server 用的，不是给 Hub 页面用的，但前端没有任何提示，后端对非当前 runtime 的端口无法识别。

砚砚(GPT-5.4) 做了代码审查，定位了 3 个问题：
- P1：自家端口识别缺口（跨 runtime 无解，同 runtime 缺 VITE_PORT）
- P1：skill discoverability（系统级问题，非本 PR scope）
- P2：前端 URL bar 无 Hub 地址拦截

本 PR 解决 P1（VITE_PORT）和 P2（前端警告）。

## Original Requirements（必填）

> 铲屎官 [05:16]：「刚刚那个和你无关是tmux的 但是这个浏览器和你有关...这些猫猫似乎甚至不知道有这个skills 还是我和它们打了路径然后 用skills怎么都打不开preview然后我手动输入 还是404 他们用的端口 http://localhost:3203/thread/thread_mmrp2gfn62d90yap」
> 铲屎官 [05:23]：「你不觉得你最近有点懒吗？f120你是的职责啊？你为什么不修呢？」

- 来源：当前线程对话历史（2026-03-15 05:16-05:23）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **不做跨 runtime 端口发现**：如果 F89 分支的 runtime 跑在 3203，我们的 runtime 无法知道。这需要服务发现机制，超出 F120 scope。前端 URL pattern 检测是更轻量有效的方案。
- **warning 不是 block**：Hub URL 仍然允许提交（后端 validatePort 才是真正的拦截），前端只显示 amber 警告。设计意图是引导而不是强制。

## Open Questions

1. `/settings/` pattern 是否合理？目前 Hub 有 settings 页面但未来路由可能变
2. warning 文案是否足够清晰？目前是英文 "This URL looks like a Cat Café Hub page..."

## Next Action

请 review 代码质量、测试覆盖、warning 文案。放行后走 merge-gate。

## 自检证据

### Spec 合规
- ✅ P1 VITE_PORT 加入 collectRuntimePorts
- ✅ P2 前端 Hub URL pattern 检测 + amber 警告
- ✅ 不超 350 行（BrowserPanel.tsx = 341 行）
- ✅ Biome clean

### 测试结果
```
port-validator.test.js: 24 passed, 0 failed（含 3 个新 collectRuntimePorts 测试）
preview-url-utils.test.ts: 11 passed, 0 failed（全新）
gateway-injection.test.js + socket-room-validation.test.js + preview-routes.test.js: 28 passed, 0 failed（回归）
TypeScript noEmit: 0 errors in changed files
```

### 相关文档
- Feature: `docs/features/F120-hub-embedded-browser.md`
- Plan: inline hotfix（无独立 plan）

### 变更文件清单
| 文件 | 改动类型 |
|------|----------|
| `packages/api/src/domains/preview/port-validator.ts` | 修改：加 VITE_PORT |
| `packages/web/src/components/workspace/preview-url-utils.ts` | 新增：parsePreviewUrl |
| `packages/web/src/components/workspace/BrowserPanel.tsx` | 修改：用 parsePreviewUrl + warning |
| `packages/api/test/domains/preview/port-validator.test.js` | 修改：3 个新测试 |
| `packages/web/src/components/__tests__/preview-url-utils.test.ts` | 新增：11 个测试 |
