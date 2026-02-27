---
feature_ids: [F027]
topics: [polish, identity, a2a]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: UX Polish Rebase 后 S1-S8 语义回归（身份与 A2A 操作）

> **报告人**: 铲屎官（合入前复审要求）
> **定位猫猫**: 缅因猫 🐾
> **报告日期**: 2026-02-10
> **严重程度**: P1 + P2
> **状态**: 修复中

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：要求对 `feat/ux-polish` rebase 后进行 S1-S8 逻辑冲突复审

---

## 2. 复现步骤（期望 vs 实际）

### 问题 A（P1）：message actions 身份来源回退到 `default-user`

1. 以 `?userId=alice` 进入页面并发送消息（消息作者为 alice）。
2. 对该消息执行“删除/从这里分支/编辑分支”。

期望：message actions 使用当前用户身份（alice）调用 API。  
实际：`MessageActions.tsx` 仍在 body 中硬编码 `userId: 'default-user'`，后端按 userId 鉴权后返回 403。

### 问题 B（P2）：A2A 折叠组内 assistant 消息无法执行 S8 操作

1. 触发 A2A 链路，使 assistant/system 消息带 `a2aGroupId`。
2. 展开“查看内部讨论”。

期望：组内 assistant 消息与普通消息一致，仍可见 MessageActions（删除/分支等）。  
实际：组内渲染走 `renderSingleMessage -> ChatMessage`，未包裹 `MessageActions`，导致操作缺失。

---

## 3. 根因分析

- 问题 A 根因：`ux-polish` 已引入统一身份层（`apiFetch` + `X-Cat-Cafe-User`），但 `MessageActions.tsx` 仍沿用 ADR-008 阶段的硬编码 `default-user` 旧路径，形成语义分叉。
- 问题 B 根因：A2A 折叠重构时，`A2ACollapsible` 的 `renderMessage` 传入了裸 `ChatMessage` 渲染函数，绕过了 S8 的 `MessageActions` 包装。

---

## 4. 修复方案（为何选择）

1. 统一 `MessageActions` 的请求入口到 `apiFetch`，并使用 `getUserId()` 写入后端当前仍要求的 body `userId` 字段。  
Why：与现有 identity 层一致，不改动后端契约即可恢复鉴权一致性。

2. 将 A2A 组内 `renderMessage` 改为复用同一套 `MessageActions` 包装。  
Why：最小改动恢复 S8 一致行为，避免 A2A 特殊分支继续漂移。

放弃方案：
- 不采用“仅后端兼容 default-user”的放宽鉴权，会掩盖身份链路回退。
- 不采用“单独给 A2A 写一套操作栏”，会重复逻辑并增加后续偏差风险。

---

## 5. 验证方式

- Red（先失败）：
  1. `MessageActions` 测试断言 branch 请求 body 使用当前用户，而不是 `default-user`。
  2. `ChatContainer` A2A 组渲染测试断言组内消息仍带 MessageActions 的“从这里分支”按钮。

- Green（修复后）：
  1. 新增两条回归测试转绿。
  2. 运行 `pnpm --filter @cat-cafe/web test` 全量前端测试确认无回归。
