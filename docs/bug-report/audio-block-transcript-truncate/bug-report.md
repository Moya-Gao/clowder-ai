---
feature_ids: [F034]
topics: [audio, block, transcript]
doc_kind: bug-report
created: 2026-02-26
---

# Bug Report: Audio 富块转写文本被截断

- 报告日期：2026-02-22
- 报告人：铲屎官
- 处理人：缅因猫（codex）
- 范围：`packages/web` 语音富块渲染

## 1. 复现步骤

1. 发送一个 `kind: "audio"` 的富块，包含较长 `text`（语音转写）。
2. 在聊天消息区查看 `AudioBlock` 下方转写文本。
3. 观察到文本被单行省略显示，无法看到完整内容。

期望行为：
- 转写文本应完整可见，至少通过换行展示全部内容。

实际行为：
- 文本被 `truncate` 单行截断，长内容显示不完整。

## 2. 根因分析

- 定位文件：`packages/web/src/components/rich/AudioBlock.tsx`
- 定位行（修复前）：转写文本容器使用 `max-w-[220px] truncate`。
- 根因：
  - `truncate` 强制单行省略，与“语音转写可读性”目标冲突。
  - 固定较窄宽度进一步放大了截断概率。

## 3. 修复方案

- 将语音转写样式从单行截断改为多行换行展示：
  - 移除 `truncate`
  - 增加 `whitespace-pre-wrap break-words leading-relaxed`
  - 调整 `max-w-[420px]`，在对话区域内保留可读宽度上限

Why：
- 优先保证语义完整可读，语音文本比摘要更依赖完整显示。

Tradeoff：
- 消息高度会增加（特别是长段落），换取完整可读性。
- 暂不引入“展开/收起”交互，先用最小改动修复核心问题。

## 4. 验证方式（Red → Green）

1. 新增回归测试：
   - `packages/web/src/components/__tests__/audio-block-voice.test.ts`
   - 用例：`voice transcript text wraps instead of truncating (regression)`
2. Red：
   - 运行 `pnpm --filter @cat-cafe/web test -- src/components/__tests__/audio-block-voice.test.ts`
   - 失败点：HTML 不含 `break-words`，且仍出现 `truncate`
3. Green：
   - 修复样式后再次运行同一命令
   - 结果：`5 passed, 0 failed`

## 5. 后续观察点

- 若长文本导致视觉密度过高，可在后续评估“默认展示前 N 行 + 展开”交互。
- 当前版本先以完整展示为主，不引入额外状态复杂度。
