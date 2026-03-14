# Review Request: fix(backlog) 按列名解析 BACKLOG.md 表头

## What

`parseActiveFeaturesFromBacklog` 从硬编码正则+固定列索引改为**动态列名匹配**：
1. 解析表头行，建 `columnName → index` 映射
2. 按列名（ID/名称/Status/Owner/Link）取值，不依赖列顺序和列数
3. 只要求 4 个必要列存在（ID/名称/Status/Owner），Link 可选，其他列随意加

## Why

BACKLOG.md 新增了 `Source` 列（6 列），原正则只匹配精确 5 列表头 → 匹配失败 → `parseActiveFeaturesFromBacklog` 返回空数组 → sync 把所有活跃 feature 标记为 "disappeared" → 全部 `markDone` → Mission Hub 显示 0 执行中、113 已完成。

**P0 数据污染**：每次触发 sync 都在把活跃 feature 标成 done。

## Original Requirements（必填）

> 我们的 mission hub 出啥 bug 了怎么没完成的也全部已完成？你可以看看我们的 main 的 backlog
> 我知道了 backlog 里增加了一列来源！这个 column 导致错误？
> 它能够更加智能地去匹配，而不是别的猫只是增加一个列你就识别不到

- 来源：铲屎官实时对话 + Mission Hub 截图（0 待审批 / 0 执行中 / 113 已完成）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了"枚举所有可能列组合"的方案 — 新列还是会遗漏
- 选择了动态 Map 查找 — 简单、零维护成本、任意加列不会 break

## Open Questions

1. `Link` 列目前是可选的（`colIndex.get('link')` 可能为 undefined）。如果 BACKLOG.md 去掉 Link 列，feature 就没有 link 字段。这是否可接受？
2. 列名匹配是 case-insensitive 的（`toLowerCase()`）。中文列名"名称"没有大小写问题，但如果以后有人写 `NAME` 也会匹配。

## Next Action

请 review 代码变更（2 文件，+60/-9），确认修复正确后放行。

## 自检证据

### Spec 合规

- ✅ 根因定位：正则匹配失败 → 返回空数组 → 所有 feature 被 markDone
- ✅ 修复：动态列名匹配，不依赖列数和顺序
- ✅ 防御：未来任意加列不会 break（只要必要列在）

### 测试结果

```
node --test test/backlog-doc-import.test.js
# tests 34 | pass 34 | fail 0

新增测试：
- "parses table with extra Source column (6 columns)" — 验证 6 列表头 + 正确取值
- "parses table with reordered columns" — 验证列顺序无关

pnpm check  # Biome 无新 warning
pnpm lint   # 类型检查通过（已有 web warning 非本次引入）
```

### 相关文档

- Feature: Mission Hub (F076) / Backlog sync (F058)
- 变更文件：
  - `packages/api/src/routes/backlog-doc-import.ts` (解析逻辑)
  - `packages/api/test/backlog-doc-import.test.js` (2 个新测试)
