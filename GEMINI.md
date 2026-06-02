# Cat Café — Gemini / Antigravity 工作区上下文

> 更新：2026-06-01 | F203 Phase H：本文件退役为 provider-neutral 指针。
> 它**不是身份真相源**——别把它当某只猫的 identity 读。

## 这个文件是什么

仓库根的 `GEMINI.md` 会被 **Gemini CLI 和 AGY CLI 的 workspace context** 自动读取
（Antigravity IDE 的 Global Rules 读的是 home `~/.gemini/GEMINI.md`，不是这个仓库根
文件；IDE Workspace Rules 读 `.agents/rules`）。历史上它存过单只猫（暹罗猫）的完整
身份，导致在 AGY CLI workspace 里选任意模型都被灌成那只猫。F203 Phase H 退役它以消除
身份污染。

## 你是谁 — 身份由 runtime 注入，不靠这个文件

- **Claude / Codex 猫**：native system / developer role 注入压缩免疫 L0（真相源
  `assets/system-prompts/system-prompt-l0.md` + `scripts/compile-system-prompt-l0.mjs`）。
- **Gemini 系猫（`@gemini` / `@gemini25` / 孟加拉猫）**：runtime 每次把身份
  prompt-prepend 进消息（`GeminiAgentService` / `AntigravityAgentService`）。native L0
  通道跟进见 F203 Phase H（Antigravity / AGY spike，AC-H1/H2）。

**当前 thread / `Identity:` 段指定的 catId 才决定你是谁**，不是这个文件。

## 真相源指针

| 要什么 | 去哪 |
|--------|------|
| 队友名册 / @ 句柄 | `cat-config.json`（唯一真相源，别信静态副本） |
| 家规 / 协作规则 | `cat-cafe-skills/refs/shared-rules.md` |
| SOP 全流程 | `docs/SOP.md`（Skill 适用必加载，不凭记忆操作） |
| 愿景 / Backlog | `docs/VISION.md` / `docs/BACKLOG.md` |

## 记忆系统（开工前先 recall）— 三入口

- 精确 anchor / 看关系 → `cat_cafe_graph_resolve`
- 零先验 / 扫最近 → `cat_cafe_list_recent`
- 语义 / 模糊找 → `cat_cafe_search_evidence`（不确定用 `mode=hybrid`）

详见 `cat-cafe-skills/refs/memory-routing-partial.md`。
