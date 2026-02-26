---
feature_ids: []
topics: [authorization, header, mismatch]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: 授权卡“同意/拒绝”点击无效并堆积 pending 请求

> **报告人**: 铲屎官  
> **定位猫猫**: 缅因猫 🐾  
> **报告日期**: 2026-02-10  
> **严重程度**: P1  
> **状态**: ✅ 已修复（Red→Green 完成）

---

## 1. 报告人

- 报告人：铲屎官
- 发现方式：前端点击“键盘起火/允许”后，权限请求仍挂在 pending 列表，无法消掉。
- 相关对话：`0001770767004728-000013-f8afa898`

---

## 2. 复现步骤（期望 vs 实际）

1. 猫侧调用 `POST /api/callbacks/request-permission` 发起 `git_commit` 审批。
2. 前端授权卡点击“允许（仅此次）”或“键盘起火”。

**期望行为**
- `/api/authorization/respond` 返回 200；
- pending 卡片从列表移除；
- 猫侧拿到 `granted/denied`，不再继续 pending 轮询。

**实际行为**
- 授权卡持续停留在 pending；
- 猫侧权限请求继续处于 pending；
- 用户感知为“点了没生效”。

---

## 3. 根因分析

### 已确认事实

1. 前端 `apiFetch` 默认发送 `X-Cat-Cafe-User` 作为身份头：
   - `packages/web/src/utils/api-client.ts`
2. `main` 分支授权路由只读取 `x-user-id`：
   - `packages/api/src/routes/authorization.ts`

### 结论

- 身份头协议不一致（`X-Cat-Cafe-User` vs `x-user-id`）导致授权路由返回 401，前端不移除卡片，pending 堆积。
- 已在 `main` 落地授权身份头统一解析，前端默认头 `X-Cat-Cafe-User` 与 legacy `x-user-id` 均可通过授权路由。

---

## 4. 修复方案（为何选择）

### 选定方案

1. 授权路由新增统一身份解析：优先 `X-Cat-Cafe-User`，兼容 legacy `x-user-id`。
2. 在 `authorization-routes` 增加两条回归测试，覆盖 `X-Cat-Cafe-User`：
   - `POST /api/authorization/respond`
   - `GET /api/authorization/pending`

### 放弃方案

- 方案 A：只在前端补发 `x-user-id`
  - 放弃原因：保留双协议，继续增加耦合与技术债。
- 方案 B：保持现状，仅在 UI 层吞错
  - 放弃原因：根因不消失，pending 继续堆积。

---

## 5. 验证方式（Red→Green）

1. Red：先补 `X-Cat-Cafe-User` 测试并在旧实现上执行，预期失败（401）。
2. Green：改路由后同测试转绿（200）。
3. 回归：legacy `x-user-id` 路径仍通过。

### 实测结果

- Red（2026-02-11）：`pnpm --filter @cat-cafe/api exec node --test test/authorization-routes.test.js`  
  两个用例失败（401）：`accepts X-Cat-Cafe-User header (frontend default)`、`accepts X-Cat-Cafe-User header for pending list`。
- Green（2026-02-11）：先执行 `pnpm --filter @cat-cafe/shared build && pnpm --filter @cat-cafe/api build`，再执行同一测试命令，结果 `21 passed, 0 failed`，含上述两条用例转绿，legacy `x-user-id` 回归用例保持通过。

---

*签名: 缅因猫 🐾*
