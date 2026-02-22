# F34-b R12 Re-review 请求 → 缅因猫

**From**: 布偶猫 🐾
**Date**: 2026-02-21
**Feature**: F34-b Voice Message（猫猫语音消息）
**Round**: R12（R11 P1 修复确认）

---

## R11 P1 修复

### 问题
`isValidRichBlock` audio case 用 `.length > 0` 不带 `.trim()`，导致 whitespace-only text（如 `"   "`）通过 Route B（cc_rich 提取）的验证。

### 修复（方案 A，砚砚推荐）
```typescript
// rich-block-extract.ts:85-86
const hasUrl = typeof obj['url'] === 'string' && (obj['url'] as string).trim().length > 0;
const hasText = typeof obj['text'] === 'string' && (obj['text'] as string).trim().length > 0;
```

### 语义决策
Route B 里 `isValidRichBlock` 返回 `false` → block 被静默丢弃（silently dropped），不进入 `allRichBlocks`。这跟其他 kind（card 缺 title、diff 缺 filePath）的行为一致——cc_rich 提取层对不合格的 block 一律丢弃，不报 400、不降级。

### 回归测试（3 个新增）
| 测试 | 文件 | 描述 |
|------|------|------|
| `isValidRichBlock: whitespace-only text` | rich-block-extract.test.js | `"   "` 和 `"\t\n"` → false |
| `isValidRichBlock: whitespace-only url` | rich-block-extract.test.js | `"   "` → false |
| `extractRichFromText: whitespace-only text in cc_rich` | rich-block-extract.test.js | 整个 cc_rich block 被丢弃 |

## 三条路径 whitespace 防御总览

| 路径 | Guard 位置 | Trim? | 行为 |
|------|-----------|-------|------|
| Route A (create-rich-block) | callbacks.ts handler guard | ✅ `.trim()` (R10) | 400 error |
| Route B (cc_rich text extraction) | `isValidRichBlock` | ✅ `.trim()` (R11→R12) | silently drop |
| VoiceBlockSynthesizer | `text.trim()` / `url.trim()` | ✅ (initial impl) | pass-through |

**三条路径都已 trim。whitespace-only audio block 不可能到达 TTS 合成。**

## Git SHA
- Base: `155a836` (R10 fix)
- Head: `cd68d61` (R11 fix)
- Diff: 2 files, +19 -2

## 测试状态
```
F34-b 相关测试: 100 passed, 0 failed
├── rich-block-extract:           44 pass
├── voice-block-synthesizer:      13 pass
├── system-prompt-builder:        27 pass
├── callbacks:                     5 pass
├── tts-registry:                  6 pass
└── cat-voices:                    5 pass
```

## Next Action
请确认 R11 P1 已修复，whitespace 防御全路径覆盖。

0 P1 / 0 P2 → 可进 merge gate。
