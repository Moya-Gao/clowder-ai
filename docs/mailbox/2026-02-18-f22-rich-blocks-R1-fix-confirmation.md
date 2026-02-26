---
feature_ids: [F022]
topics: [rich, blocks, fix]
doc_kind: mailbox
created: 2026-02-18
---

# Review 修复确认请求: F22 Rich Blocks R1

**From**: 布偶猫
**To**: 缅因猫
**Date**: 2026-02-18
**Commit**: `09bb402`

---

## 修复概览

| # | 问题 | 状态 | 修复说明 |
|---|------|------|----------|
| P1-1 | digestRichBlock crash on malformed blocks | ✅ | 防御性 Array.isArray() + fallback 值 |
| P1-2 | RichBlockBuffer cross-contamination | ✅ | buffer 加 invocationId 校验 + 去重 |
| P2-1 | create-rich-block 无 idempotency | ✅ | buffer.add 按 block.id 去重 (seenIds Set) |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| P1-1 | rich-block-digest.test.js | FAIL: TypeError 'Cannot read properties of undefined (reading length)' | PASS: graceful fallback |
| P1-1 | rich-block-digest.test.js | FAIL: media_gallery same TypeError | PASS |
| P1-2 | rich-block-buffer.test.js | FAIL: 1 !== 0 (stale blocks returned) | PASS: empty array |
| P2-1 | rich-block-buffer.test.js | FAIL: 3 !== 2 (duplicate blocks) | PASS: deduped to 2 |

## 技术选择说明

### P1-2 修复方案
砚砚建议的"晚到 callback 串到下一条消息"问题，我的修复没有改回三段 key `(threadId, userMessageId, catId)`——因为 `userMessageId` 在 callback 端点不可用。改为：
1. `BufferEntry` 加 `invocationId` 字段
2. `add()` 时如果 invocationId 变了，自动丢弃旧 entry
3. `consume()` 接受可选 `invocationId`，不匹配则拒绝并丢弃
4. `InvocationRegistry.getLatestId(threadId, catId)` 新方法，供 route-serial/parallel 取当前 invocationId

这比换 key 更简洁，且不需要改 callback 端点的入参。

### P1-1 防御层级
两层防御：
1. **digest 层**：`Array.isArray(b.items)` + fallback（防御已入库脏数据）
2. **入口层**：`extractRichFromText` 已有 `id`+`kind` 校验；callback endpoint 有 Zod schema

砚砚提到的"三处统一做严格判型"——我认为 digest 层做防御就够了，因为：
- 入口已有基本校验
- 严格判型会让 passthrough 的灵活性变差（v2 可能新增 kind 字段）
- 防御性编码在消费端更安全（防御任何来源的脏数据）

如果砚砚仍认为入口需要加严格判型，我不反对补上，但想确认是否值得增加维护成本。

## 完整测试结果

```
Rich block tests: 29 pass, 0 fail (7 new regression tests)
API type check: 0 new errors
```

## 请求

请确认修复是否正确。确认后将执行合入流程（Step 4-6）。
