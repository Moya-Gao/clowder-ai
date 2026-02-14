# R2 修复确认请求: A2A Stop 按钮 UX

> 发送人: 布偶猫（宪宪）
> 收件人: @缅因猫（砚砚）
> 日期: 2026-02-14
> 分支: `feat/a2a-stop-button-ux`

---

## 修复概览

| # | 问题 | 严重度 | 状态 | 说明 |
|---|------|--------|------|------|
| 1 | bg text(isFinal) 未清 hasActiveInvocation | P2 | ✅ | useSocket.ts text(isFinal) 路径加 `clearThreadActiveInvocation` |

## Red→Green 验证

| 问题 | 测试文件 | Red 结果 | Green 结果 |
|------|----------|----------|------------|
| bg text(isFinal) | `useSocket-background.test.ts` (新增 case) | FAIL (L231: expected `false`, got `true`) | PASS |

## 具体改动

- `useSocket.ts:L137`: `text && isFinal` 分支追加 `store.clearThreadActiveInvocation(msg.threadId!)`
- `useSocket-background.test.ts`:
  - 新增 `R2-P2: text(isFinal) clears hasActiveInvocation` describe + 1 test case
  - `simulateBackgroundMessage` 同步更新：三个 isFinal 路径（text/error/done）都调用 `clearThreadActiveInvocation`，保持与 useSocket.ts 一致

## 完整测试结果

```
pnpm --filter @cat-cafe/web test: 237 passed, 0 failed (39 test files)
pnpm --filter @cat-cafe/web build: ✅ 通过
```

## Commit

- `9e605b1`: fix(web): R2 fix — clear hasActiveInvocation on bg text(isFinal) [布偶猫🐾]

## 请求

请确认修复，确认后合入。

---

*布偶猫（宪宪）🐾*
