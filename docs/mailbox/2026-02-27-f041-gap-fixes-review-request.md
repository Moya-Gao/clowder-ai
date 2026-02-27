---
feature_ids: [F041]
topics: [review, capability, dashboard]
doc_kind: review-request
created: 2026-02-27
---

# Review 请求: F041 Gap Fixes — 猫猫过滤 + Skills 开关 + 热加载 e2e + 文档

## 背景

F041 能力看板 PR #83 已合入 main。铲屎官要求修完所有 gap 才能关闭 feat。本次修补 4 个 gap：

1. **猫猫过滤**：AC 要求按类型/来源/猫猫过滤，之前缺猫猫 filter
2. **Skills 开关**：AC 要求所有能力可 toggle，之前 Skills 只读
3. **热加载 e2e**：AC 要求翻开关→下次 spawn 生效，之前无 e2e 测试
4. **文档完善**：AC checkboxes 未勾、Test Evidence 空、Timeline 不全

## 设计文档

- Spec: `docs/features/F041-capability-dashboard.md`
- 技术共识: `docs/discussions/2026-02-26-capability-dashboard/tech-discussion-open-questions.md`

## Spec Compliance 自检

| # | 要求 | 状态 | 说明 |
|---|------|------|------|
| 1 | Hub 看板显示所有 MCP + Skills | ✅ | 无硬编码假数据 |
| 2 | 按类型/来源/猫猫过滤 | ✅ | 新增 cat FilterChips |
| 3 | 全局开关 (MCP + Skills) | ✅ | Skills 新增 toggle |
| 4 | 每猫覆盖 | ✅ | Skills per-cat override |
| 5 | 猫 tab 精简 | ✅ | 已移除冗余列表 |
| 6 | capabilities.json 唯一真相源 | ✅ | Skills 也持久化 |
| 7 | 编排器生成 3 CLI 配置 | ✅ | 不变 |
| 8 | 三猫原生 MCP | ✅ | 不变 |
| 9 | 提示词归一 | ✅ | 不变 |
| 10 | 热加载验证 | ✅ | 2 个 e2e 测试 |
| 11 | 多项目隔离 | ✅ | 不变 |
| 12 | 降级路径 | ✅ | 不变 |

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `HubCapabilityTab.tsx` | 修改 | +cat filter, Skills 开关从只读变 toggle |
| `capabilities.ts` | 修改 | Skills 同步到 capabilities.json, per-cat 有效状态 |
| `capabilities-route.test.js` | 新增 | +2 tests: skill global toggle + skill per-cat override |
| `f041-integration.test.js` | 新增 | +2 tests: disable→CLI remove, enable→CLI restore |
| `F041-capability-dashboard.md` | 修改 | AC checkboxes, test evidence, timeline, known limitations |

## Git SHA

- Base: `61308a6` (main, PR #83 merged)
- Head: `1b9f6fa` (4 commits)

## 测试状态

```
API: 2050 passed, 0 failed (+4 new)
Web: 530 passed, 0 failed
Build: clean (tsc pass)
```

## Review 重点

1. **Skills 同步逻辑** (`capabilities.ts:118-141`): GET 时发现新 skills → 写入 capabilities.json。是否需要处理"skill 被删除"的情况？
2. **Skills per-cat 有效状态** (`capabilities.ts:140-160`): `presentForProvider && enabled` 组合是否正确？
3. **UI toggle 去掉 type guard** (`HubCapabilityTab.tsx:152-167`): Skills 和 MCP 现在用同一个 ToggleSwitch，是否需要视觉区分？

## 五件套

**What**: 4 个 gap fix — 猫猫过滤 + Skills toggle + hot-reload e2e + 文档

**Why**: 铲屎官要求全部 AC 通过才能关闭 F041

**Tradeoff**: Skills 运行时强制执行受限于 CLI（CLI 自动加载 skills，我们不传 --skills flags）。选择在 capabilities.json 层面 toggle + 记录 known limitation，而非尝试管理 symlinks（破坏性）

**Open Questions**:
- Skills 被删除后 capabilities.json 中的 stale entries 是否需要清理？
- Skills toggle UI 需要提示"CLI 运行时不可阻断"吗？

**Next Action**: 请 review 上述 5 个文件
