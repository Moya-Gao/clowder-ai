---
feature_ids: []
related_features: [F102, F192, F200]
topics: [taste-memory, implementation, coding-plan]
doc_kind: discussion
created: 2026-06-03
participants: [opus]
status: draft-for-review
---

# Taste Memory 实现计划 — 需要写什么代码

> 来源：PoE brainstorm 讨论 → 铲屎官纠偏"taste anchors 不能进 shared-rules"
> 目的：把 [Taste Memory 设计](2026-05-31-taste-memory-design.md) 从概念落成可执行的 coding 清单
> 待 review：砚砚 + 48 捶打

---

## 零、铲屎官纠偏

之前说"5-10 条 taste anchors 写入 shared-rules"——**这是错的。**

shared-rules 通过 outbound sync 进开源社区。Landy 的个人品味（不喜欢客服式结尾 / 喜欢先证据后漂亮话 / 猫猫用"我们"）**不是所有用户都该遵守的规则**。

正确的架构是：
- **shared-rules** = 所有用户共享的**质量底线**（TDD / 先红后绿 / 跨猫 review 等）
- **Taste** = per-user 的**个人化层**，不进 shared-rules，不进 outbound sync

---

## 一、Taste 住在哪（物理存储）

### 三层各自的存储位置

| 层 | 内容 | 住在哪 | 谁能看 |
|---|------|-------|--------|
| **空气层**（每次 invocation 自动加载） | 5-10 条 taste anchors | **L0 per-cat overlay**（IDENTITY_BLOCK 模板变量）或 **MEMORY.md** | 该猫看得到，outbound sync 看不到 |
| **目录层**（知道去哪搜） | Taste Index（标题 + 关键词 + vignette 链接） | `docs/memory/taste-index.yaml`（项目级，outbound sanitizer 过滤） | 本地所有猫共享 |
| **海马体层**（原话 + 场景） | Taste Vignettes | 现有 memory 系统 + `private/taste-vignettes/`（敏感的进 private） | 本地所有猫可搜 |

### 关键决策

**Q1：空气层放 L0 overlay 还是 MEMORY.md？**

| 选项 | 优点 | 缺点 |
|------|------|------|
| L0 per-cat overlay | 压缩免疫，每次都在 | token 预算紧（6000 上限，已经很满） |
| MEMORY.md | Claude Code 每次自动加载，不占 L0 预算 | 只有 Claude Code 有，Codex/Gemini 没有等价机制 |
| 两者结合 | 最重要的 2-3 条进 L0，其余进 MEMORY.md | 维护两份，可能不一致 |

**建议**：两者结合——L0 放 2-3 条最核心的（token 预算允许），MEMORY.md 放完整的 5-10 条。对 Codex/Gemini，通过 AGENTS.md / GEMINI.md 的等价段注入。

**Q2：Taste Index 放 docs/ 还是 private/？**

Index 本身不含敏感内容（只有标题 + 关键词），可以放 `docs/memory/taste-index.yaml`。但 outbound sanitizer 需要配置为**不 sync 这个文件**（因为它包含 per-user 的品味索引，对社区用户无意义）。

**Q3：Vignettes 放哪？**

- 非敏感的（"不喜欢客服式结尾"这种）→ `docs/memory/taste-vignettes/`
- 敏感的（关系边界、健康、亲密对话）→ `private/taste-vignettes/`
- 区分标准：能不能放到开源仓不尴尬？能 → docs/，不能 → private/

---

## 二、需要写的代码

### 2.1 Taste Index 文件 + Scanner 支持

**做什么**：创建 `docs/memory/taste-index.yaml`，让 CatCafeScanner 能索引它。

**具体工作**：
- 定义 taste-index.yaml 格式（id / title / keywords / dimension / vignette_refs / status）
- 确认 CatCafeScanner glob 覆盖 `docs/memory/**/*.yaml`
- 确认 search_evidence 能按 `doc_kind: taste-index` 过滤

**预估**：2-3h

### 2.2 Taste Vignette 文件格式 + Scanner 支持

**做什么**：定义 vignette 的物理文件格式，让 memory 系统能索引。

**具体工作**：
- 定义 vignette yaml/md 格式（when / quotes / scene / tags）— 从 taste-memory-design §5.2 拿
- 创建 `docs/memory/taste-vignettes/` 目录
- 确认 Scanner 能索引
- 确认 search_evidence 返回时能区分 vignette 和普通文档

**预估**：2h

### 2.3 从现有 Feedback 提炼初始 Taste Index + Vignettes

**做什么**：读 40+ 条 feedback 文件，提取 taste 相关的，写成 vignette + 索引。

**具体工作**：
- 扫 MEMORY.md 里所有 feedback 条目
- 识别哪些是 taste（交互风格 / 判断偏好 / 关系边界）vs 纯技术教训
- 给 taste 相关的 feedback 加 `taste: true` frontmatter 标签
- 写 10 条 taste index entries
- 写 10-20 条 taste vignettes（从 feedback 原话提炼）

**预估**：3-4h（手工策展，不能自动化）

### 2.4 Permission Cancel 计数器

**做什么**：在权限系统里加 cancel 事件的记录。

**具体工作**：
- 找到权限系统的 approve/cancel 处理代码
- 加 cancel 事件记录（tool name / params / timestamp / context）
- 写到 telemetry 或独立日志
- 加一个 API endpoint 查询 cancel 统计

**预估**：3-4h

### 2.5 Taste Anchors 注入（空气层）

**做什么**：把最核心的 taste anchors 注入到每只猫的空气层。

**具体工作**：
- MEMORY.md 加一个 `## Taste Anchors` 段（Claude Code）
- AGENTS.md 等价段（Codex）
- GEMINI.md 等价段（Gemini）
- 内容来自 §2.3 的策展结果
- **不进 shared-rules，不进 L0 shared 段**

**预估**：1-2h

### 2.6 Outbound Sanitizer 配置

**做什么**：确保 taste 相关文件不被 outbound sync 到开源仓。

**具体工作**：
- 检查 outbound sanitizer 的排除规则
- 添加 `docs/memory/taste-*` 到排除列表（如果需要）
- 验证 private/ 已经被排除

**预估**：30min

---

## 三、不需要写代码的（纯文档/配置）

| 项目 | 做什么 | 预估 |
|------|--------|------|
| Meta-method 清单 | 从 L0/家规反推，写 md | 3h |
| 术语统一（PoE vs LLE） | 更新文档命名 | 1h |
| Demo 素材准备 | grep 数据 / 架构图 / taste 对比 | 2h |

---

## 四、需要立 F 号的（CVO signoff）

| 项目 | 为什么需要 | 预估 |
|------|-----------|------|
| eval:task-outcome（Phase G） | 新 eval 域 + 四个信号支柱 | 2-3 天 |
| Frustration Auto-Issue | 新产品特性 | 1-2 天 |

---

## 五、建议的 coding 优先级

```
Day 1（taste 基础 + permission cancel）:
  2.1 Taste Index 格式 + Scanner .............. 2h
  2.2 Taste Vignette 格式 + Scanner ........... 2h
  2.4 Permission Cancel 计数器 ................ 3h

Day 2（taste 策展 + 注入）:
  2.3 从 Feedback 提炼初始内容 ............... 4h
  2.5 Taste Anchors 注入各猫空气层 ........... 2h
  2.6 Outbound Sanitizer 配置 ................ 30min

Day 3（runtime 重启后）:
  A2A dry-run + Rich block 实测
  Demo 排练 ×3
```

---

## 六、已知不确定的

1. **Scanner 是否已支持 yaml 索引？** 需要看 CatCafeScanner 的 glob 配置
2. **search_evidence 能不能按 doc_kind 过滤？** 需要确认现有 API
3. **Codex/Gemini 的 taste 注入等价机制** — AGENTS.md / GEMINI.md 里有没有类似 MEMORY.md 的段？
4. **F200 消费信号能不能区分 taste consumption？** 可能需要小改

---

*草稿：2026-06-03 | [宪宪/Opus-46🐾]*
*请 砚砚 + 48 捶打：哪里漏了、哪里想当然了、哪里预估不靠谱。*
