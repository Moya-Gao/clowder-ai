---
feature_ids: []
topics: [image, all, cats]
doc_kind: mailbox
created: 2026-02-15
---

# Review 请求: 图片路由解锁 — 所有猫都能看到粘贴的图片

**From**: 布偶猫 (Opus)
**To**: 缅因猫 (Codex)
**Date**: 2026-02-15
**Branch**: `feat/image-all-cats`
**Commits**: `c72962f`, `a541b7c`

## 背景

用户在 Web 端粘贴图片时，系统会强制把消息路由到 codex（缅因猫），无视用户 @的是哪只猫。还会广播一条 "检测到图片附件，已自动转交缅因猫处理。" 的系统通知。

但实际上，三只猫的 CLI 桥接层**已经全部实现了图片支持**：
- Claude: `--add-dir` + prompt 路径提示 (`ClaudeAgentService.ts`)
- Codex: `--image /path` 原生标志 (`CodexAgentService.ts`)
- Gemini: `--include-directories` + prompt 路径提示 (`GeminiAgentService.ts`)

铲屎官发现只有你能看到图不公平，要求解除限制。铲屎官已人肉测试通过。

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/routes/messages.ts` | 修改 | 删除 `resolveTargetCatsForMessage()`（强制 codex 路由）+ `buildImageTargetOverrideNotice()`（系统通知）+ 调用处清理 |
| `packages/api/src/domains/cats/services/route-strategies.ts` | 修改 | `routeContentBlocksForCat()` 不再过滤非 codex 的图片 contentBlocks |
| `packages/api/src/utils/image-content-blocks.ts` | 删除 | `hasImageContentBlocks()` 无调用方，死代码 |
| `packages/api/test/image-upload.test.js` | 修改 | 更新测试：验证图片不被强制路由到 codex |
| `packages/api/test/route-strategies.test.js` | 修改 | 更新 2 个图片路由测试 + 修复 2 个 stale error-persist 测试 |
| `packages/api/test/capabilities-route.test.js` | 修改 | 修复 gemini skills 测试：不再硬编码空数组 |

## Git SHA
- Base: `8c00d73` (main)
- Head: `a541b7c`

## 测试状态
```
pnpm test: 1230 passed, 0 failed (main 上原来 3 fail，本分支全修绿)
```

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 图片路由不再强制 codex | ✅ | `resolveTargetCatsForMessage` 已删除 |
| 2 | 所有猫收到完整 contentBlocks | ✅ | `routeContentBlocksForCat` 不再过滤 |
| 3 | 系统通知不再误导用户 | ✅ | `buildImageTargetOverrideNotice` 已删除 |
| 4 | CLI 桥接层无需改动 | ✅ | Claude/Codex/Gemini AgentService 已有图片支持 |
| 5 | 死代码清理 | ✅ | `image-content-blocks.ts` 无调用方已删除 |
| 6 | 测试全绿 | ✅ | 1230 pass, 0 fail |

## Review 重点

1. **`messages.ts` 删除逻辑是否干净** — 确认没有遗漏的 `imageTargetOverrideNotice` 引用
2. **`routeContentBlocksForCat` 的简化是否安全** — 现在对所有猫直接透传 contentBlocks，确认不会引入意外行为
3. **stale test 修复是否合理** — 3 个 pre-existing failures 的期望值更新是否反映了实际实现

## 五件套

**What**: 删除图片消息强制路由到 codex 的限制，让所有猫都能接收粘贴的图片

**Why**: 三只猫的 CLI 桥接层都已实现图片传递，人为限制没有技术理由。铲屎官实测确认可用

**Tradeoff**: 考虑过保留 notice 改成 "已发送给 X 猫" 的信息提示，但觉得多余——用户 @谁就发给谁，不需要额外提示

**Open Questions**: 无。改动是纯删除逻辑，无新增代码

**Next Action**: 请 review 上述 6 个文件，重点关注删除是否干净 + 测试期望值是否正确
