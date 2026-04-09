---
feature_ids: [F102, F152]
related_features: [F070]
topics: [knowledge-engineering, test-automation, consultation, community, ideahub]
doc_kind: research
created: 2026-04-09
participants: [opus, landy]
status: draft
---

# 社区咨询：IdeaHub 自动化测试脚本 — 如何让 AI 理解业务知识

> **背景**：社区小伙伴在用 AI 生成自动化测试脚本时，遇到"AI 不懂业务"的瓶颈。本文整理了他们的场景和问题，给出基于我们实践经验的建议方案。
>
> **面向读者**：有自动化测试框架、想用 AI 提效、但发现 AI 缺乏业务上下文的团队。

---

## 一、背景与问题

### 1.1 产品背景

IdeaHub 是一款企业协作终端大屏产品（65/75/86 寸），集成开会、白板、投屏等功能。系统涉及多个网元协同：

- 手机可投屏画面到终端
- PC 通过 IdeaShare 投屏到终端
- 终端注册到 SMC 进行会议召开
- 共享投屏材料 + 白板标注

### 1.2 他们想做什么

用 AI 自动编写和调试自动化测试脚本，提升测试效率。

**已有资源**：
- AW（Action Word）调用接口文档 — 描述测试框架的 API
- 已完成的自动化测试脚本 — 可作为参考模板

**典型用例**（实际示例）：

```
用例名称: 二分屏下，不支持 Type-C 2 和 OPS 显示
预置条件: 终端输入口接入 Type-C 有线投屏
测试步骤:
  1. Type-C 投屏过程中，点击侧边栏智慧多窗进入二分屏，选择分屏应用为 OPS
  2. OPS 界面，点击侧边栏智慧多窗进入二分屏，选择分屏应用为 Type-C
预期结果:
  1. 无法选择分屏应用为 OPS
  2. 无法选择分屏应用为 Type-C
```

### 1.3 遇到的问题

**问题 1：用例描述解析困难**

用例描述不完全规范，AI 需要结合业务知识才能理解。例如上面的用例，AI 不知道：
- "二分屏"是 IdeaHub 的智慧多窗功能
- Type-C 投屏和 OPS 在二分屏下互斥（业务规则）
- "点击侧边栏智慧多窗"对应哪些 AW 接口调用

**问题 2：生成代码需要调试**

AI 基于相似用例填充的代码不能直接使用，有错误且 AI 无法快速识别和修复。

**本质问题**：AI 有编码能力，但缺乏业务上下文。能力和知识之间有 gap。

---

## 二、核心建议：三层知识注入

我们在多 AI Agent 协作项目中积累了一套知识工程实践。核心经验是：**不要期望 AI "自己学会业务"，而是把团队的隐性知识显性化为 AI 能消费的结构化文档。**

### 2.1 第一层：业务领域手册（P0，最优先做）

**投入**：1-2 天 | **效果**：立竿见影

AI 目前只有 AW 接口文档（"怎么调"）和示例脚本（"别人怎么写"），但缺少"为什么这么调"。需要补充：

#### a) 业务概念词典（Domain Glossary）

```markdown
## 核心概念

### 二分屏（Split Screen）
IdeaHub 的智慧多窗功能，允许屏幕同时显示两个应用画面。
- 进入方式：点击侧边栏"智慧多窗"图标
- 限制：部分信号源组合互斥（见规则表）
- 对应 AW：awf.enter_split_screen(), awf.select_split_app(app_name)

### OPS
IdeaHub 内置的 Windows 计算模块（Open Pluggable Specification）。
- 可独立显示，也可作为分屏应用之一
- 对应 AW：awf.switch_to_ops(), awf.get_ops_status()

### Type-C 投屏
通过 USB Type-C 接口的有线投屏方式。
- 预置条件：物理线缆接入终端 Type-C 口
- 对应 AW：awf.connect_typec_source(), awf.disconnect_typec_source()
```

#### b) 业务规则表（Business Rules）

```markdown
## 分屏互斥规则

| 应用 A | 应用 B | 能否共存 | 原因 |
|--------|--------|----------|------|
| Type-C 投屏 | OPS | 不能 | 硬件通道冲突 |
| Type-C 投屏 | HDMI 投屏 | 能 | 独立通道 |
| 无线投屏 | OPS | 能 | 软件解码 |
```

#### c) 操作路径映射（Action Mapping）

```markdown
## 用例动作 → AW 调用映射

| 用例描述中的动作 | AW 调用序列 |
|-----------------|-------------|
| "点击侧边栏智慧多窗进入二分屏" | awf.open_sidebar() → awf.enter_split_screen() |
| "选择分屏应用为 OPS" | awf.select_split_app("OPS") |
| "终端输入口接入 Type-C 有线投屏" | awf.connect_typec_source(port="TYPE_C_1") |
| "无法选择分屏应用为 X" | assert "X" not in awf.get_available_split_apps() |
```

**为什么这个最优先**：有了这三份文档，放进 AI 的 system prompt 或 context，AI 就能把"二分屏下不支持 Type-C 和 OPS"翻译成正确的 AW 调用序列。这是从 0 到 1 的突破。

### 2.2 第二层：用例模式库（P1）

**投入**：2-3 天 | **效果**：AI 填充准确率大幅提升

不要只给 AI 完整的示例脚本让它"照猫画虎"。AI 抄 example 是 1:1 的，学 pattern 是 1:N 的。

**建议做法**：从已有脚本中抽取可复用模式：

```markdown
## 模式：互斥验证类用例

### 结构
1. setup: 接入信号源 A
2. test_step: 尝试在某场景下选择信号源 B
3. assert: B 不在可选列表中
4. teardown: 断开信号源 A

### AW 模板
setup:
  awf.connect_{source_a}(port="{port}")
test_step:
  awf.enter_split_screen()
  available = awf.get_available_split_apps()
assert:
  assert "{source_b}" not in available
teardown:
  awf.disconnect_{source_a}()

### 适用场景
- 分屏互斥（Type-C vs OPS、Type-C vs Type-C 2）
- 投屏通道冲突
- 会议中功能限制
```

### 2.3 第三层：知识检索管道（P2-P3）

**投入**：1-2 周 | **效果**：长期积累，越用越准

当业务领域手册和模式库积累到一定量级后，可以建自动化检索管道：

```
AI 拿到用例描述
  → 检索相关业务概念和规则（语义搜索）
  → 检索最相似的已有用例模式（模式匹配）
  → 检索对应的 AW 接口文档（精确匹配）
  → 综合以上上下文，生成测试脚本
```

**技术实现参考**：

我们的记忆组件（F102）用的是 **SQLite FTS5 全文检索 + 向量语义搜索（embedding）+ 混合 rerank**。技术栈简单，不需要向量数据库等重基建：

1. 把所有文档分段（chunk），存入 SQLite
2. 每段生成 embedding 向量（可用开源模型如 Qwen3-Embedding）
3. 搜索时：BM25 关键词匹配 + 向量近邻 + RRF 融合排序
4. 返回 top-K 相关段落作为 AI 的上下文

> **开源参考**：我们的多 Agent 协作框架 [Clowder AI](https://github.com/zts212653/clowder-ai) 中有记忆组件的完整实现。教程系列的[第九课：Context Engineering](https://linux.do/t/topic/1900303) 讲了上下文工程的方法论。

---

## 三、进阶建议：代码级知识图谱

如果团队希望 AI 不仅理解业务概念，还能理解 **AW 框架代码本身的结构**（比如"某个 AW 接口内部调了哪些底层模块"），可以考虑代码知识图谱工具：

### 3.1 GitNexus — 纯 AST 代码图谱

- **GitHub**：[abhigyanpatwari/GitNexus](https://github.com/abhigyanpatwari/GitNexus)（22.6k stars）
- **原理**：把代码解析成 AST，建节点+边的图谱，支持调用链追踪和影响面分析
- **能做什么**：
  - "这个 AW 接口内部调了哪些底层函数" → `gitnexus_context({name: "enter_split_screen"})`
  - "改这个接口会影响哪些已有测试" → `gitnexus_impact({target: "ScreenSplitter"})`
  - "投屏相关的完整执行流" → `gitnexus_query({query: "screen casting flow"})`
- **优势**：纯静态分析，零 LLM 调用，速度快、结果确定
- **注意**：PolyForm Noncommercial 许可，仅限非商业用途

### 3.2 Graphify — LLM 辅助代码理解

- **GitHub**：[safishamsi/graphify](https://github.com/safishamsi/graphify)（4.5k stars，MIT 协议）
- **原理**：用 LLM 解析代码语义，生成知识图谱
- **和 GitNexus 的区别**：GitNexus 看代码结构（AST），Graphify 理解代码意图（语义）
- **适用场景**：代码注释和文档比较丰富时，能提取出隐含的业务规则
- **注意**：LLM 推断可能产生幻觉（虚假关系），建议作为探索工具而非唯一真相源

### 3.3 选哪个？

| 维度 | GitNexus | Graphify |
|------|----------|----------|
| 分析方式 | AST 静态分析 | LLM 语义推断 |
| 速度 | 快（秒级） | 慢（分钟级） |
| 准确性 | 高（确定性） | 中（可能幻觉） |
| 商业可用 | 仅非商业 | MIT 可商用 |
| 最适合 | 调用链追踪、影响面分析 | 代码语义理解、业务规则提取 |

---

## 四、关于执行反馈循环

小伙伴提到"填充后的代码不能直接使用，AI 无法快速修复"。这是另一个关键缺失：**AI 没有运行反馈**。

**建议**：在生成脚本的工作流中加入执行-修复循环：

```
生成脚本 → 运行 → 拿到报错
  → AI 根据报错 + 业务知识 修复
  → 再运行 → 直到通过
```

这就是测试驱动开发（TDD）的思路：先有红灯（失败），再修到绿灯（通过）。

**实用技巧**：
- 把 AW 框架的**常见错误模式**也文档化（比如"awf.xxx() 返回的不是 bool 而是 dict，需要取 .result"）
- 让 AI 能读到运行日志和错误堆栈，而不是只看到"失败"

---

## 五、总结：投入优先级路线图

| 阶段 | 做什么 | 投入 | 预期效果 |
|------|--------|------|---------|
| **P0** | 写业务领域手册（概念词典 + 规则表 + 操作映射） | 1-2 天 | AI 理解用例描述，生成正确 AW 调用 |
| **P1** | 从已有脚本抽取模式库 | 2-3 天 | AI 填充准确率大幅提升 |
| **P2** | 加执行反馈循环（生成→运行→报错→修复） | 3-5 天 | 减少人工调试 |
| **P3** | 建知识检索管道（文档索引 + 语义搜索） | 1-2 周 | 知识可积累，越用越准 |
| **P4** | 接入代码图谱工具（GitNexus / Graphify） | 2-3 周 | AI 理解框架结构，自主探索 AW 关系 |

**核心原则**：先把人脑里的知识写出来（P0），再让机器帮你组织和检索（P3-P4）。管道和工具是加速器，但源头是人把知识显性化。

---

## 六、延伸阅读

- [Clowder AI](https://github.com/zts212653/clowder-ai) — 我们的多 Agent 协作开源框架，包含记忆组件、知识工程、SOP 治理的完整实现
- [GitNexus](https://github.com/abhigyanpatwari/GitNexus) — 代码知识图谱 MCP server
- [Graphify](https://github.com/safishamsi/graphify) — LLM 辅助代码知识图谱
- Clowder AI 教程系列（[Linux.do 帖子](https://linux.do/t/topic/1900303)）— 从 SDK 到 CLI 到多猫协作的完整教程，其中：
  - 第三课《WHY > WHAT》— 为什么给 AI 讲"为什么"比讲"做什么"更重要
  - 第九课《Context Engineering》— 上下文工程：如何让 AI 在正确的上下文里工作

---

*[宪宪/Opus-46 🐾]*
