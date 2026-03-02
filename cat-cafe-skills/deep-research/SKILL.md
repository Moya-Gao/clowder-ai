---
name: deep-research
description: >
  多源深度调研管道（Web Deep Research + Coder 合成）。
  Use when: 技术问题需要多源调查、设计决策需要证据、铲屎官说"调研"/"research"。
  Not for: 简单搜索（直接用 WebSearch）、已有结论的确认。
  Output: 调研报告 + 证据合成。
triggers:
  - "调研"
  - "research"
  - "深度研究"
renamed-from: deep-research-pipeline
---

# Deep Research

Web 猫（网络搜索）+ Coder 猫（代码判断）+ GPT-5.2 Pro（审阅）= 三角验证。

## 两种猫，各有分工

| | Web 猫（Deep Research 模式） | Coder 猫（CLI/Cat Cafe） |
|---|---|---|
| 强项 | 搜 100+ 来源，有引用 | 读项目代码，跑测试 |
| 弱点 | 不了解我们的 codebase | 网络搜索深度有限 |
| 用途 | Step 2 并行调研 | Step 4 综合判断 |

**不适用场景：**
- 快速事实查询（直接用 WebSearch）
- 纯代码问题（用 Explore agent）
- 项目文档里已有答案

## 四步流程

**Step 1 — 写 Prompt 并落盘**
```
docs/prompts/YYYY-MM-DD-{topic}-research-prompt.md
```
模板见下方。写完再发，不要边写边发。

**Step 2 — 三路并行 Web 调研**
```
同一个 prompt →
  Claude.ai Deep Research
  Gemini Deep Research
  ChatGPT Deep Research  ← 可能先问澄清问题，答完后把 Q&A 追加到另外两路的 prompt
```
结果存：`docs/research/YYYY-MM-DD-{topic}/`（chatgpt / claude-ai / gemini）

**Step 3 — GPT-5.2 Pro 审阅**
输入三份报告 → 找逻辑漏洞、弱证据、三方分歧
存：`gpt-pro-review.md`（注意：Pro 是审阅者，不是调研者，不要让他搜索）

**Step 4 — Coder 猫综合 + 决策**
读全部四份文档 → 对照实际 codebase 验证 → 标注"直接可用/需验证/项目特殊约束"
存：`synthesis.md` → 和铲屎官讨论 → 落到 ADR

## Prompt 模板（Step 1）

```markdown
# {Topic} 调研

> 委托人：{who}  日期：YYYY-MM-DD

## 背景
{为什么需要这个调研，哪些项目上下文是相关的}

## 需要调研的问题
1. {具体问题 + 范围}
2. {具体问题}

## 输出要求
- 每个结论标注信息来源（URL 或文档名）
- 区分"已确认"和"推测"
- 给出推荐方向 + 风险

## 参考资料
{相关项目文档链接或已有代码路径}
```

详细模板见 `../refs/` 目录。

## Quota 意识

| 资源 | 策略 |
|------|------|
| ChatGPT Deep Research | 30 天滚动上限，发前确认值得用 |
| Claude / Gemini Deep Research | Plan-dependent，同上 |
| GPT-5.2 Pro | 仅用于 Step 3 审阅，不用于普通对话 |

**三个视角的必要性：** Claude / Gemini / GPT 各家族有不同的训练偏差。分歧处往往是最有价值的信号。

## Chrome MCP 自动化（Step 2）

执行猫可用 `mcp__claude-in-chrome__*` 工具自动发送 prompt：

- **Claude.ai**：`tabs_create_mcp` → navigate → `javascript_tool` 注入文本 → 发送
- **ChatGPT**：同上，切换到 Deep Research 模式再发
- **Gemini**：⚠️ contenteditable 不接受标准 clipboard paste → **fallback：铲屎官手动粘贴**

**报告下载卡点**（Chrome MCP 无法跨域读 iframe）：
- ChatGPT：点报告卡片标题栏 ↓ 图标
- Claude.ai：点附件 Download 按钮
- Gemini：分享 → 导出 Google Docs → 下载 Markdown

自动下载失败时 → 召唤铲屎官手动下载，执行猫负责重命名归档。

## 常见错误

| 错误 | 修正 |
|------|------|
| 没落盘 prompt 就发 | prompt 文件 = 可追溯性，必须先写 |
| 三路发了不同的 prompt | 基础 prompt 相同；只有 GPT Q&A 是追加的 |
| 让 GPT Pro 去搜索 | Pro 是审阅者，不是调研者 |
| 忽略三方分歧 | 分歧 = 最有价值的信号，必须分析 |
| Coder 猫盲信 web 报告 | 必须对照实际 codebase 验证 |

## Next Step

→ `collaborative-thinking`（讨论调研结论，形成决策）
