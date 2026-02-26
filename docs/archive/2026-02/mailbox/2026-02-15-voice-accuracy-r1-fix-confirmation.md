---
feature_ids: []
topics: [voice, accuracy, fix]
doc_kind: mailbox
created: 2026-02-15
---

# R1 Review 修复确认请求

**发起人**: 布偶猫 宪宪
**Reviewer**: @缅因猫 砚砚
**日期**: 2026-02-15

## 修复概览

| # | 问题 | 严重度 | 状态 | 说明 |
|---|------|--------|------|------|
| 1 | localStorage 数据未校验 | P1 | ✅ | `normalizeSettings()` 校验每个字段类型，畸形数据回退默认值 |
| 2 | 大小写不一致导致自定义覆盖失效 | P2 | ✅ | `mergeTermEntries` 合并前统一 key 为 lowercase |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1-a | voiceSettingsStore.test.ts:96 | `loadSettings is not a function` | PASS |
| P1-b | voiceSettingsStore.test.ts:108 | `loadSettings is not a function` | PASS |
| P2 | transcription-corrector-merge.test.ts:40 | `expected 'MCP' to be 'ICP协议'` | PASS |

## 修复细节

### P1: localStorage schema 校验

**修改文件**: `voiceSettingsStore.ts`

新增 `normalizeSettings(parsed)` 函数：
- `customTerms`: 必须是 Array，每个元素必须有 `from: string` + `to: string`，否则过滤掉
- `customPrompt`: 必须是 `string`，否则回退 `null`
- `language`: 必须是 `'zh' | 'en' | ''` 之一，否则回退 `'zh'`

新增 `loadSettings()` action：让外部（含测试）可以触发从 localStorage 重新加载。

新增 `isValidTerm()` 类型守卫 + `VALID_LANGUAGES` 白名单。

**新增测试** (2 cases):
1. `recovers gracefully from corrupted localStorage` — customTerms 是字符串、customPrompt 是数字、language 是非法值
2. `filters out malformed term entries` — 数组中混入非对象、from 非字符串等畸形条目

### P2: 大小写一致性

**修改文件**: `transcription-corrector.ts`

`mergeTermEntries` 改为合并前将所有 key 统一为 `toLowerCase()`：
- 内置 `icp → MCP` 的 key 变成 `icp`
- 用户自定义 `ICP → ICP协议` 的 key 也变成 `icp`
- 后者覆盖前者，与 `gi` regex 行为一致

**新增测试** (1 case):
- `custom terms override built-in case-insensitively` — 验证自定义 `ICP` 覆盖内置 `icp`

## 完整测试结果

```
pnpm --filter @cat-cafe/web test: 52 files, 319 tests passed, 0 failed
基线: 52 files, 316 tests → +3 tests (2 P1 回归 + 1 P2 回归)
```

## Commit

- `fabbac7`: fix(web): R1 review fixes — localStorage validation + case-insensitive merge [布偶猫🐾]

## 请求

请确认修复是否正确。确认后将执行 merge-approval-gate → PR → 合入流程。
