# Bug Report: F069 未读 Badge 点不掉 + 消息气泡异常空白

## 1. 报告人

- **谁**：铲屎官 (Landy)
- **时间**：2026-03-07 01:00
- **发现方式**：Runtime 实际使用，发现 lesson-tutorial thread 的橙色未读 badge "20" 点击多次无法清除

## 2. 复现步骤

**Bug A: 未读 badge 点不掉**
- Thread: `lesson-tutorial`
- Badge: 橙色 20（hasUserMention = true）
- 操作：点击 thread 进入 → badge 不消失
- 期望：进入 thread 后 badge 清零
- 实际：badge 持续显示 20

**Bug B: 消息气泡异常空白**
- 截图显示：消息气泡左侧有明显空白/错位
- 第一张图中的两个消息块（布偶猫 23:29/23:30）左侧对齐异常

## 3. 根因分析

**Phase 1 完成** — 根因定位：

### Bug A: 未读 badge 点不掉
**症状**: PATCH `/api/threads/:id/read` 返回 400 Bad Request
**证据**: DevTools Network 面板截图 + console 输出
**根因假设**:
1. **最可能**: 浏览器缓存了旧代码 — 防护逻辑 `if (!lastMessageId) return;` 未生效 → 发送了空 body → 后端 validation 失败
2. 或 messages 数组为空时 `lastMessageId` 是 `undefined`，但 useEffect 仍触发

**验证方式**:
- 硬刷新浏览器（Cmd+Shift+R）
- 或重启 runtime frontend dev server

### Bug B: 消息气泡异常空白
**待排查** — 可能和 F069 无关，CSS/布局问题

### Bug C: @ 弹窗猫猫列表不全
**症状**: 只显示 3 只猫（布偶/缅因/暹罗），缺失 8-9 个变体
**证据**: `GET /api/cats` 返回 200 但只有 3 只猫（opus/codex/gemini）
**根因**: cat-config-loader.ts Zod schema 缺少 'antigravity' provider + nickname 不接受 null
  - Line 58: `provider` enum 缺少 'antigravity'（bengal 品种的 provider）
  - Line 122: `nickname` 字段只允许 `string | undefined`，但 bengal 的 nickname 是 `null`
  - 导致 loadCatConfig() 抛异常 → fallback 到 CAT_CONFIGS（只有 3 只猫）
**修复**: ✅ 已修复
  - 添加 'antigravity' 到 provider enum
  - 改 `nickname: z.string().optional()` 为 `z.string().nullable().optional()`
  - Runtime API 已重启，现在返回全部 11 只猫

## 4. 修复方案

### Bug C: ✅ 已修复（2026-03-07 17:20）
- **修改文件**: `packages/api/src/config/cat-config-loader.ts`
- **变更**:
  - Line 58: `provider: z.enum(['anthropic', 'openai', 'google', 'dare', 'antigravity'])`
  - Line 122: `nickname: z.string().nullable().optional()`
- **生效**: Runtime API 已重启，`/api/cats` 现在返回 11 只猫

### Bug A: 待修复（线程切换竞态）
（暂缓，用户优先 Bug C）

### Bug B: 待排查（消息气泡空白）
（可能与 F069 无关）

## 5. 验证方式

（待修复方案确定后填写）

---

**当前阶段**：Phase 1 — 根因调查
