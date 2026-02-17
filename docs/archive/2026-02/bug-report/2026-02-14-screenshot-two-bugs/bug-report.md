# Bug Report: 情人节截图中的双 bug（消息工具条重叠 + Claude CLI code:1 瞬断无自愈）

## 1) 报告人

- 报告人：铲屎官（通过截图反馈）
- 接收与定位：缅因猫（砚砚）
- 发现时间：2026-02-14

## 2) 复现步骤（期望 vs 实际）

### Bug A: 消息工具条压住消息头（时间/头像）

复现：
1. 打开任一包含用户消息气泡的线程。
2. 鼠标悬停在消息区域，触发右上角 `MessageActions` 工具条（删除/分支/编辑等按钮）。
3. 观察用户消息头部（时间、昵称、头像）区域。

期望：
- 工具条不遮挡时间戳与头像，消息头信息完整可读。

实际：
- 工具条定位在消息容器右上角，覆盖了时间戳/头像区域，出现 UI 重叠。

### Bug B: Claude CLI `code:1` 直接打红，无瞬断自愈

复现：
1. 触发一次 Claude 调用（截图场景为带图片上下文的对话调用）。
2. 后端收到 CLI 异常退出事件：`CLI 异常退出 (code: 1, signal: none)`。
3. 前端展示系统错误气泡：`Error: Claude CLI: CLI 异常退出 (code: 1, signal: none)`。

期望：
- 对“无输出即退出”的瞬态失败做一次自动重试，优先自愈，避免直接打红用户会话。

实际：
- 当前仅对 `No conversation found with session ID` 做自愈重试；
- 普通 `code:1` 直接透传为错误，用户侧可见红色失败。

## 3) 根因分析（定位过程）

### Bug A 根因

- `packages/web/src/components/MessageActions.tsx` 使用固定绝对定位：
  - `absolute top-1 right-1`
- `MessageActions` 包裹的是整条 `ChatMessage`（含 header + bubble），因此按钮浮层会压到 header 行，而不只在 bubble 内显示。

### Bug B 根因

- `packages/api/src/domains/cats/services/invoke-single-cat.ts` 的自愈逻辑仅覆盖 `isMissingClaudeSessionError(...)`。
- 对 `Claude CLI: CLI 异常退出 (code: 1, signal: none)` 这类“无信号、无有效输出”的瞬态失败，没有 retry 分支。
- 结果是首轮失败直接产出 `error` 事件并上屏。

## 4) 修复方案（选择与权衡）

### Bug A

- 方案：将 `MessageActions` 浮层按消息类型做差异化定位。
  - 用户消息：下移到 header 下方，避免覆盖时间/头像。
  - 其他消息：保持现有紧贴右上角行为。
- 权衡：
  - 优点：改动小、风险低，直接消除可见重叠。
  - 代价：定位样式增加分支，需要新增回归测试固定行为。

### Bug B

- 方案：在 `invoke-single-cat` 中新增一次“瞬断重试”：
  - 条件：本轮尚未产出任何正文/工具输出，仅出现 `CLI 异常退出 (code: 1, signal: none)`。
  - 行为：对当前调用重试一次；若重试成功则不向前端暴露首轮错误；若仍失败则按现状报错。
- 权衡：
  - 优点：改善短暂 CLI 抖动体验，减少无意义红错。
  - 代价：增加一次额外调用成本；需确保“已有输出”的场景不重试，避免重复内容。

## 5) 验证方式

自动化验证（Red -> Green）：
1. 前端测试：新增 `MessageActions` 定位测试，先红后绿，确认用户消息按钮不压 header。
2. 后端测试：新增 `invokeSingleCat` 自愈测试：
   - 瞬断首轮 + 二轮成功 => 不上报首轮错误；
   - 首轮已有输出再 `code:1` => 不重试（防重复）。

回归验证：
1. `pnpm --filter @cat-cafe/web test -- <message-actions 相关测试>`
2. `pnpm --filter @cat-cafe/api run build`
3. `node --test packages/api/test/invoke-single-cat.test.js`
