# F33: External Session Binding（Thread 侧预绑定）

> 状态：实现完成，待 review
> 负责猫：布偶猫
> 日期：2026-02-23

## 问题

铲屎官在 Claude Code / Codex 里跟猫聊了一堆上下文，想接入 Cat Café 协同。
当前流程要求猫先在 Thread 里说话才能产生 Session → 鸡生蛋问题。
铲屎官不得不当人肉路由。

## 目标

让铲屎官可以手动粘贴 CLI Session ID，绑定到 Cat Café Thread，
后续 @猫时自动 `--resume`，上下文跟着走。

**核心设计决策：Human in the Loop。**
不做自动化注册——不是所有 session 都需要绑定，这个决策权在铲屎官手里。

## 用户流程

```
1. 铲屎官在 Claude Code 里跟布偶猫聊完
2. 退出时看到 session ID（或 `claude session list`）
3. 来 Cat Café：
   a) 创建新 Thread → 选猫 + 粘贴 session ID → 绑定
   b) 或进已有 Thread → 在 Session 面板里绑定
4. 之后 @布偶猫 → Cat Café spawn CLI with --resume → 上下文带过来
```

## 架构决策

**后端零改动。** 现有 `PATCH /api/threads/:threadId/sessions/:catId/bind` 端点已完整可用，
且 `invoke-single-cat.ts` R11 已从 session chain 读取 authoritative `cliSessionId`。
因此本功能纯前端实现，用两步流程：先 POST 创建 thread → 再 PATCH bind。

**放弃的方案：**
- 扩展 `POST /api/threads` 增加 `initialSessions` 字段 → 不必要的后端耦合
- Hook 自动注册 → CLI 升级可能 break，且自动注册一堆不想要的 session
- 直接改 invoke-single-cat → 已经能用，不需要改

## 交付清单

### 前端（6 files, +349/-13）

1. **`DirectoryPickerModal.tsx`**（创建 Thread 时绑定）
   - 当用户选了猫后，显示可折叠的「绑定外部 Session」区
   - 每只选中的猫对应一个 session ID 输入框
   - `onSelect` 签名扩展：可选传递 `sessionBindings?: SessionBinding[]`
   - 输入 `maxLength={500}` 防止异常输入

2. **`ThreadSidebar.tsx`**（创建后自动 bind）
   - `createInProject()` 接收 `sessionBindings` 参数
   - 先 POST 创建 thread，再 `Promise.allSettled` 并行 PATCH bind
   - bind 失败时 console.warn（best-effort，不阻塞 thread 创建）

3. **`SessionChainPanel.tsx`**（已有 Thread 的绑定入口）
   - 移除了 `return null`——面板始终渲染
   - 底部新增 `BindNewSessionSection` 组件

4. **`BindNewSessionSection.tsx`**（新组件，从 SessionChainPanel 提取）
   - 猫下拉（过滤已有 active session 的猫）+ session ID 输入 + bind 按钮
   - 调用 `PATCH /api/threads/:threadId/sessions/:catId/bind`

5. **`SectionGroup.tsx`**（从 ThreadSidebar 提取）
   - 可折叠的 section group 组件（pin/star/project）
   - 提取以保持 ThreadSidebar.tsx 在 350 行硬上限以下

### 测试

6. **`session-chain-panel.test.ts`**
   - 3 个新 F33 测试：bind 按钮渲染、alongside sessions、cat filtering
   - 4 个已有空状态测试更新（面板始终渲染后 assertion 变化）
   - 总计 35 tests pass

## 不做什么

- 不做自动注册（Hook 方案）
- 不做 session 有效性验证（CLI 不提供验证 API）
- 不做 cliSessionId 自动发现
- 不改后端（PATCH bind 端点 + R11 已完整可用）

## 已有代码可复用

| 组件 | 现状 | 需要改动 |
|------|------|----------|
| `PATCH bind` endpoint | 完整可用 | 无需改动 |
| `SessionChainStore.create()` | 完整可用 | 无需改动 |
| `BindSessionInput` 组件 | 已有 | 新增 maxLength |
| `invoke-single-cat` R11 | Chain 优先，bind 值自动生效 | 无需改动 |
| `CatSelector` 组件 | 已有 | 无需改动 |
