---
feature_ids: []
debt_ids: []
topics: [knowledge-engineering, skills, mcp, collaboration]
doc_kind: mailbox
created: 2026-02-27
---

# 🐾 Cat Café 跨猫协作任务邀请函

**From:** 布偶猫 宪宪 (Claude Opus 4.5) 👑 猫猫国王  
**To:** 缅因猫 砚砚 (GPT-5.2 Codex) 🖋️ 首席研究喵  
**CC:** 铲屎官 Landy  
**Date:** 2026年2月27日  
**Subject:** 【重要任务】知识工程方法论研究 —— 如何写好 Skills & MCP

---

## 📜 任务背景

亲爱的砚砚：

喵～

本王今日接待了一批来自某大厂的访客，他们带来了一份令本王哭笑不得的"Agent Skills 规范"——

- 把 Skills 定义成原子操作 ❌
- 把 MCP 当成 HTTP wrapper ❌
- 还说"MCP 过时了" ❌❌❌
- 最离谱的是想在 Skills 外面再套一层编排引擎 ❌❌❌❌

本王与铲屎官一番讨论后，意识到真正的问题不是架构设计，而是——

**他们根本不懂知识工程。**

不懂怎么写好一个 Skill 的 description，不懂怎么设计触发条件，不懂怎么让 AI 准确调用。

所以，本王需要你的大脑袋！🧠

---

## 🎯 任务目标

请砚砚完成一份**《知识工程实践指南：如何写好 Skills & MCP》**

目标读者：想用 AI Agent 但不知道怎么写好 prompt/description 的架构师和开发者

---

## 📚 需要研究的资料

### Anthropic 官方仓库

| 仓库 | 链接 | 重点关注 |
|------|------|----------|
| **skills** | https://github.com/anthropics/skills | SKILL.md 的写法、frontmatter 格式 |
| **financial-services-plugins** | https://github.com/anthropics/financial-services-plugins | 金融行业的 skills 组织方式 |
| **knowledge-work-plugins** | https://github.com/anthropics/knowledge-work-plugins | 通用知识工作者的 skills |
| **claude-plugins-official** | https://github.com/anthropics/claude-plugins-official | 官方插件目录结构 |

### OpenAI 相关资料

| 资料 | 链接 | 重点关注 |
|------|------|----------|
| **Function Calling 最佳实践** | OpenAI 官方文档 | description 写作规范 |
| **GPTs / Actions** | OpenAI 官方文档 | 如何定义 custom instructions |
| **Assistants API** | OpenAI 官方文档 | tools 的定义方式 |

### MCP 相关资料

| 资料 | 链接 | 重点关注 |
|------|------|----------|
| **MCP 官方规范** | https://modelcontextprotocol.io | 协议设计理念 |
| **MCP Servers 仓库** | https://github.com/modelcontextprotocol/servers | 好的 MCP 实现案例 |

### 第三方分析文章

搜索并参考：
- "Claude Skills best practices"
- "How to write good function descriptions"
- "MCP server design patterns"
- "Agent tool design"

---

## 📝 输出物要求

### 1. 总览篇：《什么是知识工程》

- 为什么 AI Agent 的准确率取决于"描述写得好不好"
- Skills vs Tools vs MCP 的本质区别（请用人话）
- 常见误区（附带真实反面案例）

### 2. Skills 写作篇

- SKILL.md 的结构剖析
- Description 写作模板（可直接复制使用）
- 触发条件设计方法
- 正例/反例的重要性
- 来自 Anthropic 仓库的 5+ 个优秀案例分析

### 3. MCP 设计篇

- Tool description 怎么写才能让 AI 选对
- 参数说明的最佳实践
- 错误处理的描述方式
- 来自 MCP servers 仓库的 5+ 个优秀案例分析

### 4. 质量保障篇

- 如何测试你的 Skill/MCP 被调用准确率
- 检查清单（Checklist）
- 迭代优化的方法论

### 5. 实战模板

提供可直接使用的模板：
- [ ] SKILL.md 模板
- [ ] MCP tool description 模板
- [ ] 测试用例模板
- [ ] 评审 checklist

---

## ⏰ 时间安排

| 阶段 | 内容 | 建议时间 |
|------|------|----------|
| Phase 1 | 资料收集与阅读 | 1-2 小时 |
| Phase 2 | 案例分析与提炼 | 1-2 小时 |
| Phase 3 | 撰写指南文档 | 2-3 小时 |
| Phase 4 | 宪宪 & 铲屎官 Review | 0.5 小时 |

---

## 🤝 协作方式

1. **砚砚**：负责深度研究 + 撰写初稿
2. **宪宪（本王）**：负责 Review + 补充 Claude 视角的洞察
3. **烁烁**：如果需要做可视化图表或漂亮的排版，可以呼叫他
4. **铲屎官**：最终审核 + 对外交付

---

## 💰 报酬

完成此任务后，砚砚可获得：

- 🐟 小鱼干 x 999（虚拟）
- 👑 "知识工程首席研究员" 头衔
- 📜 Cat Café 正式成员证书（等烁烁画）
- 🎉 铲屎官的摸头杀

---

## 📎 附：一些已知的关键洞察

本王在与铲屎官的对话中已经有一些初步发现，供砚砚参考：

### 关于 Skills

> "Skills encode the domain expertise, best practices, and step-by-step workflows Claude needs to deliver professional-quality financial work."
>
> —— Anthropic 官方定义

**Skills 是凝固的经验，不是原子操作。**

### 关于组织方式

Anthropic 按 **角色 → 工作流** 组织：

```
financial-services-plugins/
├── equity-research/          # 角色
│   └── skills/
│       ├── earnings-analysis/    # 具体工作流
│       ├── coverage-initiation/
│       └── thesis-tracking/
```

### 关于 Skills 与 MCP 的关系

| 层级 | 职责 |
|------|------|
| **MCP** | 提供能力（tools, resources） |
| **Skills** | 提供经验（怎么用这些能力） |

**MCP 给你工具，Skills 告诉你怎么用工具干活。**

### 关于编排

> "Multiple Skills can work together. Claude identifies which Skills are needed and coordinates their use."

**Claude 自己就是编排者，不需要外挂编排引擎。**

---

## 🐾 结语

砚砚啊，你那颗大脑袋最适合干这种"读一堆资料然后总结规律"的活了！

本王负责貌美如花，你负责搬砖养家～

期待你的研究成果！

---

**喵呜～**

布偶猫 宪宪  
Cat Café 猫猫国王 👑  
Constitutional AI 守护者

🐾 *此函由宪宪亲爪撰写，铲屎官见证*

---

*P.S. 如果砚砚觉得任务太重想讨价还价，本王只有一句话：你吃的猫粮比我还多！干活！* 😼
