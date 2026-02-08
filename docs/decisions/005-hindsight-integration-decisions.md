# ADR-005: Hindsight 集成决策

> 日期: 2026-02-08
> 状态: 已拍板
> 参与者: 布偶猫 (Opus 4.5) + 铲屎官 🐬
> 背景: Phase 5 上下文工程规划

---

## 背景

Phase 5 要集成 Hindsight 作为协作记忆系统。在开工前需要拍板 7 个关键问题。

---

## 问题 1：Hindsight 连接参数 ✅

**决策**: 用环境变量 `HINDSIGHT_URL=http://localhost:8888`

**现状**:
- API: `http://localhost:8888`
- Web UI: `http://localhost:9999/dashboard`
- 认证: 暂无（本地开发）

---

## 问题 2：Bank 设计

### 布偶猫初始方案

| 方案 | Bank 结构 | 优点 | 缺点 |
|------|----------|------|------|
| A | 单一 `cat-cafe` | 简单 | 所有记忆混在一起 |
| B | `cat-cafe-shared` + `cat-cafe-{catId}` | 共享 vs 个人分离 | 需要决定什么进哪里 |
| C | `cat-cafe-{projectPath}` | 项目独立 | 跨项目知识不能共享 |
| D | B + C 混合 | 最灵活 | 最复杂 |

布偶猫推荐 B：共享知识放 `cat-cafe-shared`，个人经验放 `cat-cafe-{catId}`。

### 铲屎官反馈 🐬

> "如果缅因大猫不知道你为什么如此架构他要如何 review 你的代码呢？他可能会猫猫疑惑你这到底是 bug 还是 feature。"

**核心洞察**：
1. **"个人经验"不应该隔离** — 架构决策必须共享，否则其他猫无法理解 why
2. **Thread 级别不需要进 Hindsight** — Redis 已经保存完整聊天，thread 对话本身就是 session 记忆
3. **需要定期同步 thread 对话** — 导出成 md/log 作为可检索的历史

### 最终决策

**Bank 结构**:
- `cat-cafe-shared`: 所有项目知识、决策记录、协作规则（三猫都能读写）
- 暂不做 `cat-cafe-{catId}` — 避免知识孤岛

**记忆层次**:
```
┌─────────────────────────────────────────────────────────┐
│ Hindsight (cat-cafe-shared)                             │
│ - 决策记录 (docs/decisions/)                            │
│ - 阶段计划 (docs/phases/ 归档后的)                       │
│ - 协作规则、架构知识                                     │
│ - 重要讨论纪要                                          │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ 归档/沉淀
                         │
┌─────────────────────────────────────────────────────────┐
│ Thread Log (定期导出)                                    │
│ - 完整对话历史                                          │
│ - 可检索的 session 记忆                                  │
│ - 格式: md 或 NDJSON                                    │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ 实时
                         │
┌─────────────────────────────────────────────────────────┐
│ Redis (MessageStore)                                     │
│ - 当前 thread 完整消息                                   │
│ - 猫猫压缩后可回溯                                       │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ 索引/摘要
                         │
┌─────────────────────────────────────────────────────────┐
│ F3-lite (MemoryStore)                                    │
│ - 临时笔记、摘要索引                                     │
│ - 快速存取，MAX_KEYS=50                                  │
└─────────────────────────────────────────────────────────┘
```

**MCP 封装约束**:
- Cat Café 的 MCP 工具**只暴露 `cat-cafe-*` 开头的 bank**
- 不让猫猫看到其他项目的 bank（如 `routing-shared`, `mission-control-hub` 等）
- 原因：避免浪费猫猫上下文，聚焦当前项目

**待办**:
- [ ] 调研 Hindsight 的 memory types (world facts, experience, opinions)，确定如何利用
- [ ] MCP 封装时过滤 bank 列表（只返回 `cat-cafe-*`）

---

## 问题 3：F3-lite 与 Hindsight 分工

### 布偶猫分析

| 方案 | 描述 |
|------|------|
| A | 全部迁移到 Hindsight，废弃 F3-lite |
| B | 分层：F3-lite 做临时记忆，Hindsight 做持久记忆 |
| C | 保持两套，用户自己选 |

### 铲屎官反馈 🐬

> "F3-lite 像快速的短期记忆。猫猫压缩后丢失完整记忆，但有摘要。用摘要去 F3-lite 找，找不到就去 thread log 找。"

### 最终决策: 方案 B（分层）

**F3-lite 定位**:
- 短期记忆 / 摘要索引
- 猫猫压缩上下文后，留下的"指针"
- 例如：`/remember api-design 见 thread log 2026-02-08 的讨论`

**检索链路**:
```
猫猫需要回忆
    │
    ▼
F3-lite (摘要索引)
    │ 找到指针
    ▼
Thread Log (完整对话)
    │ 或者
    ▼
Hindsight Recall (语义检索)
```

---

## 问题 4：发布门禁实现位置

### 布偶猫分析

| 方案 | 描述 |
|------|------|
| A | Cat Café 调用层实现（Redis 存状态） |
| B | 用 Hindsight 的 metadata/tags 存状态 |
| C | 不做门禁，全部写入即生效 |

### 铲屎官反馈 🐬

> "可以注意做好优雅的实现，别丢东西 🤣 什么优雅停机之类的保障都搞上"

### 最终决策: 方案 A（Cat Café 调用层）

**实现要点**:
- Redis 存状态机 (draft → pending_review → published)
- EventAuditLog 记审计
- **优雅停机保障**: 复用 Phase 4.0 bug 修复的模式（BGSAVE + process.once + 幂等 guard）

---

## 问题 5：Evidence 检索是否用 Hindsight Recall

### 布偶猫分析

| 方案 | 描述 |
|------|------|
| A | 用 Hindsight Recall（需要批量导入） |
| B | 用 grep/glob 文件搜索 |
| C | 混合：先 grep 找候选，再用 LLM 排序 |

布偶猫推荐 A，创建 `cat-cafe-evidence` bank。

### 铲屎官反馈 🐬

> "好像可以直接到 shared 里面。Hindsight 本身就有 world facts, experience, opinions。"
>
> "注意只有归档后才是稳定的，正在讨论的 Phase 5 不稳定。"

### 最终决策: 方案 A（Hindsight Recall）

**调整**:
- 不单独建 `cat-cafe-evidence` bank，直接用 `cat-cafe-shared`
- **两只猫需要调研**: Hindsight 的 memory types 如何利用

**导入策略**:
- 只导入**归档后**的稳定文档
- `docs/decisions/` — 归档即导入
- `docs/phases/` — Phase 完成后导入
- `docs/discussions/` — 有明确结论的纪要才导入
- 正在进行的讨论（如当前 Phase 5）**不导入**

---

## 问题 6：Reflect 触发策略

### 布偶猫分析

| 触发时机 | 描述 | 成本 |
|----------|------|------|
| 定时（每日/每周） | 自动反思 | 固定成本 |
| 讨论结束时 | thread 关闭时触发 | 按需 |
| 手动命令 | `/reflect` 触发 | 最可控 |

### 铲屎官反馈 🐬

> "优先让猫猫和人自己主动调用，比如猫猫通过 MCP，人通过 slash magic word"

### 最终决策: 手动优先

**实现**:
- 用户: `/reflect [query]` slash command
- 猫猫: `cat_cafe_reflect` MCP callback
- 后续可加定时/自动

---

## 问题 7：UX 呈现方式

### 布偶猫分析

| 方案 | 描述 |
|------|------|
| A | 系统消息（蓝色 info） |
| B | 卡片组件（类似 TaskCard） |
| C | 折叠展开 |

布偶猫推荐 B（卡片）。

### 铲屎官反馈 🐬

> "我同意你的方式，但是放的位置可能都是在右边？参考 Claude Code 的 cowork 截图。"
>
> "我们现在的 tool_use 和 error 事件现在是被丢弃的 → 这个必须之后展示！可观测性很重要，不然等了几分钟前端只有猫猫在思考，感受太差了。"
>
> "这估计就是你这只猫猫写的 bug（还是 feature？🤣 这里就说明了问题 2 —— 你的架构决策如果只是你的记忆，铲屎官都无法判断到底为什么了！）"

### 最终决策: 卡片组件 + 右侧面板 + 可观测性修复

**布局参考**: Claude Code cowork 截图 (`reference-pictures/`)

**必须修复的 bug/feature**:
- `tool_use` 事件当前被丢弃 → 必须展示（猫猫在调用什么工具）
- `error` 事件当前被丢弃 → 必须展示
- 这是可观测性问题，也是 UX 问题

**铲屎官的灵魂拷问**:
> "这到底是 bug 还是 feature？你的架构决策如果只是你的记忆，铲屎官都无法判断！"

→ 这正是为什么决策必须共享、必须记录 why 的原因。

---

## 关键教训

1. **知识不能隔离** — "个人经验"的划分会导致其他猫无法理解 why
2. **Thread 对话本身就是 session 记忆** — 不需要额外进 Hindsight
3. **只导入归档后的稳定内容** — 正在进行的讨论不稳定
4. **记录决策过程的 why** — 选项分析 + 反馈 = 可追溯的决策思考
5. **可观测性是 UX** — tool_use/error 不能丢弃

---

*签名: 布偶猫 🐾 + 铲屎官 🐬*
