---
feature_ids: []
related_features: [F102, F192, F200]
topics: [taste-memory, implementation, coding-plan]
doc_kind: discussion
created: 2026-06-03
participants: [opus, opus48, codex]
status: v2-post-review
---

# Taste Memory 实现计划 v2 — v0 静态快照 + v1 动态机制

> 来源：PoE brainstorm → 铲屎官纠偏"taste anchors 不能进 shared-rules" → 48 review "存储≠机制"
> 目的：把 [Taste Memory 设计](2026-05-31-taste-memory-design.md) 从概念落成可执行的 coding 清单
> 48 review 核心修正：v0/v1 诚实分界 + sanitizer 前置 + Permission Cancel 拆出 + 加测试

---

## 零、v0 / v1 诚实分界（48 P1 修正）

> **48 的捶打：plan 全是静态存储，缺动态闭环。但这周只有 3 天，不可能做完整闭环。诚实分界，不伪装"做完 v0 = taste 机制有了"。**

| | v0 静态快照（这周，demo 够用） | v1 动态机制（demo 后） |
|---|---|---|
| 定位 | 一次性策展 + 格式定义 + 注入 | 活的、持续生长的 |
| 内容来源 | 从历史 feedback 手工提炼 | **猫运行时当场写 vignette**（纠偏/aha） |
| 进化 | 不进化 | 时间语义（supersedes/ancestral/last_resonated） |
| 消费反馈 | 无 | F200 consumption 追踪（搜了→用了→帮没帮到） |
| 退火 | 无 | 月度 digest + 旧 vignette 标 ancestral |

**v0 的存储结构必须不挡 v1。** 格式从 day 1 预留 `occurred_at / status / supersedes` 字段（v0 填默认值就行），这样 v1 上线不用迁移。

---

## 一、Step 0：安全前置（48 P2 修正 — 必须最先做）

> **48 的捶打：sanitizer 排除不能放最后。先建 taste 文件再配排除 = 中间任何一次 sync 就泄露。**

### 在写任何 taste 内容之前，先做这些

- [ ] **逐位置确认 outbound sync 行为**：

| 位置 | 会被 outbound sync 吗 | 操作 |
|------|---------------------|------|
| `docs/memory/taste-*` | ⚠️ docs/ 默认会 sync | **必须加排除规则** |
| `private/taste-vignettes/` | ❌ gitignored | 安全 |
| `system-prompt-l0.md` | ⚠️ 可能 sync | **确认：L0 per-cat overlay 注入后，编译产物有没有进 sync？** |
| MEMORY.md | ❌ Claude Code 用户级，不在 git | 安全 |
| AGENTS.md | ⚠️ 在 git 里，确认 sync 行为 | **确认** |

- [ ] **配置 outbound sanitizer 排除** `docs/memory/taste-*`
- [ ] **验证** sync dry-run 不含 taste 文件
- [ ] **然后**才开始写 taste 内容

**预估**：1h（但 blocking，不做后面都不安全）

---

## 二、v0 Coding 清单（这周）

### 2.1 Taste Index 格式 + 目录

创建 `docs/memory/taste-index.yaml`。格式预留 v1 字段：

```yaml
entries:
  - id: taste-no-customer-service-ending
    title: "不要客服式结尾"
    keywords: [客服, 待办清单, 共创伙伴]
    dimension: interaction_style
    vignette_refs: ["taste-vignettes/no-customer-service-ending.md"]
    status: current          # v1 用：current / ancestral / superseded
    last_resonated_at: null  # v1 用：F200 消费时更新
    user_scope: default      # v1 用：per-user 命名空间预留
```

**测试**：写一个 `search_evidence("客服式结尾")` 确认能命中这个文件。如果 Scanner 不支持 yaml，**改用 md frontmatter + yaml 内容**（md Scanner 已确认支持）。

**预估**：2h

### 2.2 Taste Vignette 格式 + 目录

创建 `docs/memory/taste-vignettes/` 目录。格式（v0 四字段 + v1 预留）：

```yaml
---
id: taste-vignette-no-customer-service-ending
kind: taste_vignette
occurred_at: "2026-05-31"    # v1 用：时间语义
status: current              # v1 用
user_scope: default          # v1 用
tags: [interaction_style, ending_style]
---

## quotes
- "用户不喜欢 GPT-5.4 式结尾模板..."

## scene
猫在普通回答末尾追加预设式下一步清单。铲屎官指出这不像共创伙伴。
```

**测试**：`search_evidence("taste_vignette")` 确认 Scanner 索引了。

**预估**：1.5h

### 2.3 从 Feedback 手工策展初始内容

扫 MEMORY.md 里 40+ 条 feedback：
1. 识别 taste 相关的（交互风格 / 判断偏好 / 关系边界）
2. 给 taste 相关的 feedback 加 `taste: true` frontmatter
3. 写 10 条 taste index entries
4. 写 10-15 条 taste vignettes

**不是自动提取——是手工策展。** 每条都要读原始 feedback 确认准确。

**测试**：策展完后用 `search_evidence("taste 交互风格")` 确认高召回。

**预估**：3-4h

### 2.4 Taste Anchors 注入空气层

**不进 shared-rules。** 按猫的载体分别注入：

| 猫 | 载体 | 怎么注入 |
|---|------|---------|
| Claude Code 猫 | MEMORY.md `## Taste Anchors` 段 | 手动加 |
| Codex | AGENTS.md 对应段（确认注入时机） | 手动加 |
| Gemini | GEMINI.md 对应段 | 手动加 |

内容来自 §2.3 的策展结果，挑最核心的 5-10 条。

**测试**：新 session 启动后确认猫能看到 taste anchors（不用 tool call）。

**预估**：1.5h

### 2.5 Outbound Sanitizer 验证（回归）

v0 全部内容写完后，再跑一次 sync dry-run 确认无泄露。

**预估**：30min

---

## 三、v1 Roadmap（demo 后，不在这周 scope）

这些是 v0 存储结构预留了字段但**这周不实现**的动态能力：

| 能力 | v1 做什么 | 依赖 |
|------|----------|------|
| **运行时写 vignette** | 猫在纠偏/aha 时刻当场写 taste vignette（code-as-harness 的 taste 路径） | code-as-harness skill |
| **时间语义** | supersedes / ancestral / last_resonated_at 真正生效 | F200 consumption |
| **消费反馈** | 猫搜了 taste → 用了 → F200 记录 consumed → 高频 taste 浮得更快 | F200 扩展 |
| **月度退火** | 每月从 vignette 提炼 → 旧的标 ancestral → 保持空气层纤细 | scheduled task |
| **search_evidence doc_kind 过滤** | 让猫能精确搜"只看 taste"而不是全库 | 48 确认目前不支持，需加代码 |
| **per-user 多用户** | 存储格式按 user_scope 分命名空间 | 产品化阶段 |

---

## 四、拆出去的项（不在 taste plan scope）

| 项 | 该属于哪条线 | 来源 |
|---|------------|------|
| **Permission Cancel 计数器** | eval:task-outcome（Phase G） | 48 P5：它是 friction 信号不是 taste |
| **Frustration Auto-Issue** | 独立产品特性 | 需 CVO signoff 立 F 号 |

---

## 五、已知事实（48 帮答的）

| 问题 | 答案 | 影响 |
|------|------|------|
| search_evidence 能按 doc_kind 过滤吗？ | **不能**（48 确认，schema 无此参数） | v0 靠路径约定间接圈（`docs/memory/taste-*`），精确过滤留 v1 |
| Codex 有等价 MEMORY.md 吗？ | AGENTS.md 是载体，但没有"自动加载记忆段" | v0 手动在 AGENTS.md 加 taste 段，确认注入时机 |
| Scanner 支持 yaml？ | 待查（如果不支持，改用 md + yaml frontmatter） | 影响 §2.1 格式选择 |
| F200 能区分 taste consumption？ | 待查 | v1 才需要 |

---

## 六、v0 排期

```
Step 0：安全前置（1h）— 确认 sync 行为 + 配排除 + 验证
  ↓ 确认安全后才开始
Step 1：格式定义（3.5h）— taste-index + vignette 格式 + 测试
Step 2：手工策展（3-4h）— 从 40+ feedback 提炼 + 写 vignettes
Step 3：空气层注入（1.5h）— MEMORY.md / AGENTS.md / GEMINI.md
Step 4：回归验证（30min）— sync dry-run + 搜索测试

总计：~10h = 1.5 天
```

---

*v2 修正：2026-06-03 | [宪宪/Opus-46🐾]*
*修正来源：48 review P1（v0/v1 分界）/ P2（sanitizer 前置）/ P3-P6（scope/测试/per-user）*
