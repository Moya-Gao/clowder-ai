---
name: pencil-design
description: >
  使用 Pencil MCP 创建/编辑 .pen 设计文件，或导出为 React 代码。
  Use when: 设计 UI、编辑 .pen 文件、从设计稿生成代码。
  Not for: 纯代码实现（无设计稿）、非 Pencil 工具的设计工作。
  Output: .pen 设计文件 或 React/Tailwind 组件代码。
triggers:
  - "pencil"
  - ".pen 文件"
  - "设计稿"
---

# Pencil Design — .pen 文件设计与代码导出

## 核心知识

Pencil 是装在 **Antigravity IDE** 上的设计扩展。
.pen 文件是加密格式，**只能通过 Pencil MCP 工具读写**，Read/Grep/cat 无法解析。

配置要求：MCP 配置必须加 `--app antigravity`（不是默认 IDE）。

## 两种模式

### Mode A：Design — 创建/编辑 .pen 文件

**用 Pencil MCP 工具操作设计画布**：

| 工具 | 用途 |
|------|------|
| `get_editor_state` | 查看当前画布状态（首先调用） |
| `open_document` | 打开已有 .pen 文件（`"new"` 不落盘，需用户手动 Cmd+S） |
| `batch_get` | 批量读取 layer/component 属性 |
| `batch_design` | 批量创建/修改设计元素（**每次最多 25 ops**） |
| `get_screenshot` | 获取当前画布截图（验证设计结果） |
| `get_guidelines` | 获取布局参考线 |
| `get_style_guide` | 获取项目色系/字体规范 |

**关键限制**：
- `batch_design` 每次最多 25 ops，超出必须分批调用
- Binding（绑定引用）不能跨 `batch_design` 调用复用
- MCP 配置改动需等下次调用才生效（无头模式）

### Mode B：Code Export — 从 .pen 设计稿生成代码

1. 用 `get_editor_state` + `batch_get` 读取设计属性
2. 用 `get_style_guide` 获取设计 token（颜色、字体、间距）
3. 生成 React + Tailwind 组件代码
4. 截图对比：`get_screenshot` → 目视验证还原度

## 工作流

```
设计任务
  ↓
get_editor_state（了解现状）
  ↓
Mode A: batch_design（分批，≤25 ops/次）
Mode B: batch_get → 生成 React/Tailwind
  ↓
get_screenshot（验证）
  ↓
有问题 → 继续 batch_design 修正
```

## Common Mistakes

| 错误 | 后果 | 修复 |
|------|------|------|
| 用 Read/Grep 读 .pen 文件 | 乱码，无法解析 | 只用 Pencil MCP 工具 |
| batch_design 超过 25 ops | 工具报错 | 拆成多次调用 |
| MCP 配置未加 `--app antigravity` | 工具不可用 | 加上后等下次激活 |
| 跨调用复用 binding | binding 失效 | 每次调用重新声明 |
| `open_document("new")` 后忘记保存 | 内容丢失 | 提醒用户手动 Cmd+S |

## 和其他 Skill 的区别

- `tdd` / `worktree`：代码实现阶段 — pencil-design 是**设计阶段**，先于代码
- `quality-gate`：检查代码合规 — pencil-design 输出的是设计文件或组件代码

## 下一步

- Mode A 完成设计 → 告知铲屎官/暹罗猫查看截图 → 如需实现 → `worktree` → `tdd`
- Mode B 导出代码 → 进入 `tdd` 编写测试 + 集成
