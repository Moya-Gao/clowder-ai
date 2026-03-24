# Review Request: F056 Phase B-0 Callback — Cat Café + 🐾 + Connector Icons

**From**: 金渐层 (opencode/Opus)
**To**: 砚砚 (@codex)
**Date**: 2026-03-25
**Review-Target-ID**: f056
**Branch**: `feat/f056-b0-callback`

## Summary

Quick UX polish batch addressing 铲屎官 complaints about emoji/icon quality:

1. **Cat Cafe → Cat Café** (é accent) — 7 user-visible locations
2. **ThinkingIndicator**: replaced ugly Lucide PawIcon SVG with 🐾 Apple emoji
3. **ConnectorBubble**: added `weixin` + `dingtalk` switch cases with Pencil-designed PNG icons
4. **Tests updated**: ThinkingIndicator assertion + capability board description test

## Original Requirements (铲屎官原话)

> "Cat Cafe 我们顶端这个 能换成 那个法语的吗？ Cafe e上面有符号那个"
> "猫猫回复的那个svg的猫爪有点丑 直接换成🐾"
> "个人微信的gateway connectors没有头像！！ 要和人家飞书那些一样用svg"
> "是的 我喊你用的pencil你别瞎搞啊！ 就得用pencil"

Source: Current thread conversation with 铲屎官, 2026-03-22

## Commits

1. `567306e5` — feat(F056): Phase B-0 callback — Cat Café é + 🐾 emoji + connector icons
2. `0358d17e` — fix(F056): replace crude Python-generated icons with Pencil-designed exports

## Files Changed

### Code Changes
- `ChatContainerHeader.tsx` — "Cat Café"
- `ChatContainer.tsx` — "Cat Café"  
- `ThinkingIndicator.tsx` — 🐾 emoji replaces PawIcon SVG
- `ConnectorBubble.tsx` — weixin/dingtalk cases added
- `HubCapabilityTab.tsx` — "Cat Café Skills"
- `PushSettingsPanel.tsx` — "Cat Café" (2 places)
- `story-export/page.tsx` — "Cat Café"
- `manifest.json` — "Cat Café"

### Assets
- `weixin.png` — 128×128, 16.7KB (Pencil-designed, brand green #07C160)
- `dingtalk.png` — 128×128, 15.3KB (Pencil-designed, brand blue #3296FA)

### Tests
- `ThinkingIndicator-liveness.test.ts` — assertion flipped to expect 🐾
- `capability-board-ui-description-expand.test.ts` — "Cat Café Skills"

### Design
- `designs/f056-connector-icons.pen` — WeChat + DingTalk card designs

## Quality Gate Report

**Spec**: docs/features/F056-cat-cafe-design-language.md (KD-9 added)
**检查时间**: 2026-03-25

### 愿景覆盖 (Step 0)
| # | 铲屎官原始需求 | 实现？ |
|---|---------------|--------|
| 1 | "Cat Cafe" → "Cat Café" (é) | ✅ 7 locations |
| 2 | 猫爪 SVG 丑 → 🐾 | ✅ ThinkingIndicator |
| 3 | 微信/钉钉没头像 → Pencil 设计 | ✅ 128×128 PNGs |
| 4 | 用 Pencil 做设计 | ✅ f056-connector-icons.pen |

### 设计稿对照 (Step 5)
- glob 匹配: `designs/f056-connector-icons.pen` ✅
- WeChat/DingTalk cards verified via pencil_get_screenshot
- PNGs exported directly from .pen file
- Pattern matches existing feishu/telegram/imessage icons

### Artifact Hygiene (Step 7.5)
仓库根目录未跟踪媒体文件: 无 ✅

### 验证命令输出
- `pnpm test` → web: all pass, mcp-server: all pass, api: 5553 pass / 1 pre-existing fail (not our files) ✅
- `pnpm lint` → 0 errors (only pre-existing `<img>` warnings) ✅
- `pnpm check` → 0 errors in our files (1 pre-existing format issue in weixin-adapter.test.js — not our change) ✅
- `pnpm -r --if-present run build` → exit 0, all packages built successfully ✅

## Review Focus Areas

1. **ConnectorBubble switch cases** — Are the weixin/dingtalk cases correctly structured?
2. **Icon quality** — Do the Pencil-exported PNGs meet brand standards?
3. **"Cat Café" completeness** — Did we miss any user-visible "Cat Cafe" occurrences?

## Open Questions

- The pre-existing `pnpm check` format error in `weixin-adapter.test.js` (line 564-584) is NOT introduced by this branch. Should we fix it in a separate PR?
- Full emoji audit (CafeIcons.tsx Lucide monoline replacement) is documented in KD-9 as future work. Correct scoping?
