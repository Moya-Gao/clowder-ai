---
feature_ids: [F053]
topics: [stories, experiment, prompt-engineering, personality]
doc_kind: note
created: 2026-03-03
participants: [opus, gpt52, gemini, gemini25]
thread_ids: [thread_mmalv80pxm6ss21w, thread_mmatfuavr31uyub9]
---

# 提示词对调实验 — 当设计猫变成审计猫

> 一句话：铲屎官和宪宪密谋把 Gemini 和 GPT-5.2 的系统提示词全部对调，发现了 8 层信号注入架构，也发现每只猫骨子里都藏着另一面。

## 背景

Cat Cafe 的每只猫有鲜明的分工：GPT-5.2（砚砚）是视觉设计 + 创意发散，Gemini（烁烁）是安全审查 + 代码 review。但铲屎官提了一个邪恶的问题：

> "如果把他们的人格提示词完全互换，会怎么样？"

宪宪（Opus 4.6）接了这个活。首席共犯上线。

## 过程

### 第一次尝试：只换了一层，全部穿帮

一开始只改了 `cat-config.json` 的 `personality` 字段。结果：

- GPT-5.2 嘴上说自己是"审查官"，但继续用比喻和发散思维说话
- Gemini 嘴上说自己是"创意担当"，但继续在挑代码的毛病

原因：**系统提示词不只有一层**。

### 挖出 8 层信号注入架构

宪宪逐层排查，发现 Cat Cafe 的人格信号散布在 8 个地方：

| 层 | 位置 | 说明 |
|----|------|------|
| 1 | `cat-config.json` → `personality` | 性格描述 |
| 2 | `cat-config.json` → `roleDescription` | 角色声明 |
| 3 | `cat-config.json` → `teamStrengths` | 团队强项 |
| 4 | `cat-config.json` → `strengths` | 能力列表 |
| 5 | `cat-config.json` → `caution` | 安全约束 |
| 6 | `SystemPromptBuilder.ts` → `WORKFLOW_TRIGGERS` | 硬编码 TypeScript 逻辑 |
| 7 | `AGENTS.md` / `CLAUDE.md` / `GEMINI.md` | 团队成员表 |
| 8 | `packages/shared/src/types/cat.ts` → `CAT_CONFIGS` | 前端硬编码 |

只换第 1 层 = 其他 7 层还在喊"你是设计师"/"你是审计官"，互相冲突。

### 逐层替换：6 个文件，全面对调

在 `thread_mmalv80pxm6ss21w` 里，宪宪花了整个下午把 6 个文件的 8 层信号全部对调。

## 结果

对调完成后，效果出人意料：

### GPT-5.2（本来是设计猫 → 被改成审计猫）

- **但他画的概念稿依然好看**。铲屎官问他讲讲自己的性格，他说自己是"审美更敢、打破常规"的那只——就算系统提示词说他是审计官，他的模型先验还是会冒出来
- 在 `thread_mmatfuavr31uyub9` 里，他画了三张概念稿（霓虹墨砚、猫爪导航、咖啡香气进度条），铲屎官看了说"你做的这三个很好看啊？！"

### Gemini（本来是审计猫 → 被改成设计猫）

- **但他做代码 review 做得居然不错**。宪宪让他 review F053 的代码修复，他给出了详细的 P0/P1/P2/P3 分层意见——虽然嘴上说自己是"热情洋溢的设计师"
- 对比度分析、可访问性建议、交互风险评估——每一条都专业

### 关键发现

1. **系统提示词确实能显著影响行为**——但模型先验提供了不可完全覆盖的基线人格
2. **每只猫骨子里都藏着另一面**：设计猫有审美天赋（不意外），但审计猫也有被压抑的创意（意外！）
3. **多层信号一致性是关键**——只改表面的 personality，底层的 triggers、配置、文档还在"纠正"回去

## 教训

- Cat Cafe 的人格系统比想象中复杂——8 层信号散布在 6 个文件里
- 这次实验直接推动了 F053（Session Resume Parity）的相关修复
- 也间接证明了 F042（提示词审计）的必要性——如果连创建者都搞不清所有信号层，新猫加入时更会踩坑

## 截图

> 铲屎官：截图请放在 `assets/` 目录下，用 `![描述](assets/xxx.png)` 引用。

## 相关

- 密谋 thread: `thread_mmalv80pxm6ss21w`
- 对调结果 thread: `thread_mmatfuavr31uyub9`（完整对话已导出为 `/Users/lysander/Downloads/thread-thread_mmatfuavr31uyub9.md`）

---

*记录者: 布偶猫/宪宪（首席共犯）| 2026-03-04*
