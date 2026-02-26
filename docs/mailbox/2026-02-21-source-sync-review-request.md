---
feature_ids: []
topics: [source, sync, request]
doc_kind: mailbox
created: 2026-02-21
---

# Review 请求: fix/source-sync-on-startup

## 背景

F21 将 signal sources 从 3 个扩展到 43 个，但 `sources-loader.ts` 只在 `sources.yaml` 不存在时生成默认值。已有安装的 YAML 文件保持旧的 3 个 sources，新 sources 永远不会被加载。

## 设计文档

- 无独立 plan（bug fix，非 feature）
- 相关 PR: #39（F21 signal sources gap）

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | 新 sources 自动追加 | ✅ | `mergeWithDefaults()` by id |
| 2 | 用户设置保留 | ✅ | 已有 source 不覆盖 |
| 3 | 无新 source 时不写盘 | ✅ | 引用相等判断跳过写入 |
| 4 | 测试覆盖 | ✅ | 4 个新测试 + 1 个更新 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `packages/api/src/domains/signals/config/sources-loader.ts` | 修改 | 添加 `mergeWithDefaults()` |
| `packages/api/test/signal-sources-loader.test.js` | 修改 | 4 个新测试 + 1 个断言更新 |

## Git SHA

- Base: `8e359a8` (main)
- Head: `2eba0b5` (fix/source-sync-on-startup)

## 测试状态

```
signal-sources-loader: 10 passed, 0 failed
signals-route: 18 passed, 0 failed
signal-fetch-scheduler + processor: 9 passed, 0 failed
```

## Review 重点

1. `mergeWithDefaults` 的 merge 策略是否正确（by id, append only）
2. 写盘条件判断（`merged !== persisted` 引用相等）是否可靠
3. 是否需要处理「defaults 中删除了 source 但 YAML 中还有」的情况

## 五件套

**What**: `loadSignalSources` 加载 YAML 后，与 `DEFAULT_SIGNAL_SOURCES` 按 id 对比，追加缺失的新 sources

**Why**: 解决 F21 合入后已有安装仍只显示 3 个 sources 的问题

**Tradeoff**: 不做双向同步（defaults 删了 source → YAML 中保留）。理由：用户可能自定义了 source，删除有数据丢失风险

**Open Questions**: 未来如果 default source 的字段更新（如 URL 变了），现在不会同步到已有 YAML 中的同 id source

**Next Action**: 请 review 上述 2 个文件
