# Review Request: F098 Cleanup — P3 Tests + AC-C1 targetCats + AC-A5 tintedLight

## What

F098 遗留项一把清理（铲屎官明确要求不留历史债务）：

1. **P3 regression tests**: `deliveredAt` + `source.meta` + `extra.targetCats` 序列化合约锁定
2. **AC-C1**: `post_message` MCP 工具 + 后端路由新增 `targetCats` 字段，存入 `extra.targetCats`，与内容解析的 @mentions 合并，前端 `parseDirection` 读取
3. **AC-A5**: `tintedLight()` 颜色函数（与 `tintedDark` 对称），callback 消息用 `tintedLight(primary, 0.08)` 浅色品种气泡
4. **Bug fix**: 修复过时的 `source.meta` 剥离测试（Phase C 已改为包含 meta）

## Why

铲屎官要求 Phase D 合入后把所有 A 遗留项 + P3 全清：
> "我个人建议你，我们这些什么A遗留项，然后什么P三，全部一把做啦，就不要不要留历史债务。"

## Original Requirements（必填）

- Discussion: thread context from 2026-03-12 ~23:47
- **原始需求摘录**：
  > "全部一把做啦，就不要不要留历史债务。"
- 铲屎官核心痛点：F098 多个 Phase 留下的碎片化遗留项，不想分批清
- **请 Reviewer 对照上面的摘录判断：交付物是否解决了铲屎官的问题？**

## Tradeoff

- `targetCats` 存在 `extra.targetCats` 而非 `source.meta.targets`：因为 callback 消息没有 `source` 字段（那是 connector 消息的），用 extra 更自然
- `tintedLight` callback bubble 只改 bgColor/borderColor，不改字体颜色：spec 说"文字保持深色"

## Open Questions

- 现有 `source.meta` 剥离测试改为包含测试——Phase C 之后 meta 是需要的（frontend parseDirection 读 meta.targets）。请确认这个方向对
- `mentions` 合并逻辑：`explicitTargetCats` union `parseA2AMentions()` 结果。请确认 dedup 策略是否正确

## Next Action

请 review 代码质量 + 逻辑正确性，放行后我走 merge-gate。

## 自检证据

### Spec 合规
- AC-C1 ✅ | AC-A5 ✅ | P3-deliveredAt ✅ | P3-source.meta ✅

### 测试结果
```
node --test (messages-endpoint + callback-routes + delivered-at + queue-processor) → 111 pass, 0 fail
vitest run (color-utils + parse-direction) → 17 pass, 0 fail
pnpm --filter @cat-cafe/api build → exit 0
pnpm --filter @cat-cafe/web build → exit 0
```

### 相关文档
- Spec: `docs/features/F098-callback-message-ux.md`
- Feature: F098 / BACKLOG
