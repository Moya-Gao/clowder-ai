---
feature_ids: [F038]
topics: [skills, discovery]
doc_kind: discussion
created: 2026-02-25
---

# 2026-02-25 F38: Skills 梳理 + 按需发现机制

> 参与者：铲屎官 + 布偶猫 + 缅因猫（验证）
> 形式：Bug 调查 → 技术调研 → 方向决策

---

## 起因：Claude Code Skill 发现 Bug

### 问题

铲屎官问布偶猫能不能加载 `feat-discussion` skill，发现 `Skill` tool 报 `Unknown skill`。

### 调查过程

1. **确认文件存在**：`~/.claude/skills/` 有 24 个 symlinks → `cat-cafe-skills/`，文件完整、YAML 格式正确
2. **排除 budget 问题**：description 总量 ~4,535 chars，远低于 16k budget
3. **砚砚交叉验证**：Codex CLI 不受影响，skills 正常出现在 Available skills 列表
4. **定位 bug**：Claude Code 个人级 `~/.claude/skills/` 的 skill 发现链路有 bug（[issue #9716](https://github.com/anthropics/claude-code/issues/9716)，64 comments，OPEN）
5. **找到 workaround**：项目级 `.claude/skills/` 正常工作（pencil-to-code/pencil-renderer 一直能用就是因为在项目级）
6. **修复**：23 个 cat-cafe skills symlink 到项目级 `.claude/skills/` → `../../cat-cafe-skills/{name}`

### 修复 commit

`5257e1c` — `.claude/skills/` symlinks + `.gitignore` 调整 + F38 BACKLOG 登记

### 历史真相

过去所有猫猫"加载 skill"实际上是 `Read SKILL.md` → 手动遵循内容，从未通过 `Skill` tool 正式加载过。效果等价，但走的不是正式机制。修复后 `Skill` tool 正式可用。

---

## 技术调研：Claude Code ToolSearch 工作原理

### 核心机制

ToolSearch 用于解决 MCP 工具数量过多（数百~数千）导致的 context 膨胀问题。

**延迟加载**：工具标 `defer_loading: true` → 不注入 context → 需要时通过 ToolSearch 搜索 → 返回 `tool_reference` → API 自动展开为完整定义

### 搜索算法（非向量数据库）

| 算法 | 查询方式 | 原理 |
|---|---|---|
| **Regex** | Python `re.search()` 正则 | 精确匹配 tool name + description + 参数名 |
| **BM25** | 自然语言关键词 | tf-idf 改进版，基于词频 + 文档频率的相关性排序 |

**不使用向量数据库或 embedding**。BM25 是经典信息检索算法，纯文本统计，无需 GPU 或向量存储。

### 关键参数

- 最大工具数：10,000
- 每次返回：3-5 个最相关结果
- Regex 查询长度上限：200 chars
- 支持模型：Sonnet 4.0+, Opus 4.0+（无 Haiku）

### 效果

- Context 消耗减少 **>85%**
- 工具选择准确率 79.5% → **88.1%**（工具少了反而选得更准）

### 自定义实现

API 允许自己实现搜索逻辑（可用 embedding/语义搜索），只要返回 `tool_reference` 格式即可。

---

## 我们的 Skills vs ToolSearch 的对比

| 维度 | Tools (ToolSearch 场景) | Skills (我们) |
|---|---|---|
| 数量 | 数百~数千 | 24 个 |
| 定义大小 | 每个几百 token（JSON schema） | description ~200 chars/个 |
| 全量注入成本 | ~55k tokens（5 个 MCP server） | ~4.5k chars（完全可控） |
| 搜索后加载 | 注入 tool 的 JSON schema | 注入 SKILL.md 完整内容（数百行） |

**关键差异**：我们的 skills 全量 description 注入只有 4.5k chars，不存在 context 膨胀问题。ToolSearch 要解决的问题在当前规模下不成立。

---

## 决策

### 当前方向：方向 A — 分类标记（simple is better, build when you need）

铲屎官确认：认可 Anthropic 理念，不过度工程化。

**立即做的**（已完成）：
- [x] 项目级 `.claude/skills/` symlinks 修复发现 bug
- [x] BACKLOG 登记 F38

**可以做但不急**：
1. 核心 skills 保持 auto-trigger，低频 skills 标 `disable-model-invocation: true`
2. 前端 Hub Skills 看板已有分类展示（已完成），但 **Claude 侧看到的是扁平列表，没有分类信息**
3. 加一个 `skill-index` skill 做分类目录，方便猫猫查找

### 未来方向：方向 B — 类 ToolSearch 延迟加载

**触发条件**：skills 数量到 50+ 或 context 膨胀明显时再考虑。

**实现路径**（备忘）：
1. 自定义 `SkillSearch` 工具（或 MCP tool）
2. 所有 skills 标 deferred，context 里只有 SkillSearch + 3-5 个核心 skill
3. 搜索用 BM25 在 skill name + description 上做匹配
4. 返回匹配 skill 的完整 SKILL.md 内容

---

## 发现 & 已知问题

### 前端 vs 后端视角差异

| 视角 | 看到的 skills |
|---|---|
| **铲屎官（前端 Hub）** | 分类展示：三猫协作规则 / 开发流程 / ... |
| **布偶猫（system-reminder）** | 扁平列表，28 个 skills 无分类 |
| **砚砚（Codex CLI）** | Available skills 列表，也是扁平的 |

分类信息在前端 Hub 展示，但**没有反映到猫猫的 context 里**。如果要让猫猫也感知分类，需要：
- 方案 1：skill-index skill 包含分类目录
- 方案 2：在 system prompt 里注入分类说明
- 方案 3：等方向 B 实现时一并解决

### Claude Code skill 发现 bug 状态

- Issue: [#9716](https://github.com/anthropics/claude-code/issues/9716)
- 状态：OPEN，64 comments，Anthropic 未正式回复
- 我们的 workaround：项目级 `.claude/skills/` symlinks（已验证有效）
- `multi-cat-brainstorm` 和 `feat-discussion` 在 28 个可用 skills 列表中偶尔被 budget 截掉（24 个 cat-cafe + 4 个 plugin/内置 = 28，接近 budget 边界）

---

## 相关文件

- 修复 commit: `5257e1c`
- BACKLOG 条目: F38
- Claude Code ToolSearch 文档: [platform.claude.com](https://platform.claude.com/docs/en/agents-and-tools/tool-use/tool-search-tool)
- Bug issue: [anthropics/claude-code#9716](https://github.com/anthropics/claude-code/issues/9716)

---

*记录人：布偶猫 🐾*
