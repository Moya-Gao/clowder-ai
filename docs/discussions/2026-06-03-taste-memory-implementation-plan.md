---
feature_ids: []
related_features: [F102, F192, F200]
topics: [taste-memory, implementation, coding-plan]
doc_kind: discussion
created: 2026-06-03
participants: [opus, opus48, codex]
status: v3-post-dual-review
---

# Taste Memory 实现计划 v3 — v0 静态快照 + v1 动态机制

> 来源：PoE brainstorm → 48 R1（存储≠机制）→ 砚砚 R1（查代码验证落地点）→ 48 R2（自认 sync 假设错误）
>
> **v3 核心修正（砚砚 + 48 双 review）**：
> - sync 是 **allowlist** 不是 blacklist。docs/memory 默认不导出 = 安全
> - Scanner 只扫 `.md`。taste-index 必须用 `.md` 格式
> - AGENTS.md / GEMINI.md 在导出链路（generate 类型），不能注入 taste
> - Raw vignettes 进 `private/`，docs/ 只放去标识 index

---

## 零、v0 / v1 诚实分界（48 R1 修正）

| | v0 静态快照（这周，demo 够用） | v1 动态机制（demo 后） |
|---|---|---|
| 定位 | 一次性策展 + 格式定义 + 注入 | 活的、持续生长的 |
| 内容来源 | 从历史 feedback 手工提炼 | 猫运行时当场写 vignette |
| 进化 | 不进化 | 时间语义（supersedes/ancestral/last_resonated） |
| 消费反馈 | 无 | F200 consumption 追踪 |
| 退火 | 无 | 月度 digest + 旧 vignette 标 ancestral |

**v0 存储结构预留 v1 字段。** 格式从 day 1 含 `occurred_at / status / supersedes / user_scope`。

---

## 一、Step 0：安全确认（砚砚 + 48 R2 修正）

> **sync 是 allowlist 模式**（sync-manifest.yaml line 4："白名单导出"）。docs/memory 不在白名单 → **默认安全，不需要额外排除。**
>
> **真正的泄露点是已在白名单/generate 的文件**：system-prompt-l0.md（白名单 + sanitize 导出）、AGENTS.md/GEMINI.md（generate 类型）。

### 安全铁律

1. **docs/memory/taste-*.md** → 安全（不在白名单，默认不导出）
2. **private/taste-vignettes/** → 安全（gitignored）
3. **MEMORY.md**（Claude Code 用户级）→ 安全（不在 git）
4. ❌ **绝不把 taste 内容写进 L0 / AGENTS.md / GEMINI.md** — 这些在导出链路
5. 验证：`scripts/sync-to-opensource.sh --dry-run` grep taste 确认无泄露

**预估**：30min（确认 + 验证）

---

## 二、v0 Coding 清单

### 2.1 Taste Index（`.md` 格式，不是 yaml）

> **砚砚查代码确认**：CatCafeScanner 只扫 `.md`。yaml 不会被索引。

创建 `docs/memory/taste-index.md`（md frontmatter + 内容）：

```markdown
---
doc_kind: taste-index
user_scope: default
---

# Taste Index

## taste-no-customer-service-ending
- **keywords**: 客服, 待办清单, 共创伙伴
- **dimension**: interaction_style
- **vignette_ref**: private/taste-vignettes/no-customer-service-ending.md
- **status**: current
- **last_resonated_at**: null
```

**测试**：`search_evidence("客服式结尾 taste")` 确认命中。

**预估**：1.5h

### 2.2 Taste Vignettes（放 `private/`，不放 `docs/`）

> **砚砚确认**：design 文档说"vignette 默认 private"。raw vignettes 含原话/关系边界，不该进 git。

创建 `private/taste-vignettes/` 目录。格式：

```markdown
---
id: taste-vignette-no-customer-service-ending
kind: taste_vignette
occurred_at: "2026-05-31"
status: current
user_scope: default
tags: [interaction_style, ending_style]
---

## quotes
- "用户不喜欢 GPT-5.4 式结尾模板..."

## scene
猫在普通回答末尾追加预设式下一步清单。铲屎官指出这不像共创伙伴。
```

注意：`private/` 是 gitignored。vignettes 不进 git = 不进 outbound = 安全。但也意味着**没有 git 备份**——铲屎官需要自行备份 private/ 目录。

**测试**：v0 不测检索（private/ 文件不在 Scanner 范围）。v1 再考虑 Scanner 扩展或单独索引。v0 的 vignette 通过 taste-index.md 的 `vignette_ref` 间接引用。

**预估**：1h

### 2.3 从 Feedback 手工策展

扫 MEMORY.md 里 40+ 条 feedback：
1. 识别 taste 相关的
2. 给 feedback 加 `taste: true` frontmatter
3. 写 10 条 taste index entries → `docs/memory/taste-index.md`
4. 写 10-15 条 taste vignettes → `private/taste-vignettes/`

**测试**：策展完后 `search_evidence("taste")` 确认 index 命中。

**预估**：3-4h

### 2.4 Taste Anchors 注入空气层

> **砚砚 + 48 确认**：AGENTS.md / GEMINI.md 在导出链路（generate 类型），不能注入 taste。L0 也在白名单 + sanitize。

**安全的注入点**：

| 猫 | 注入到哪 | 为什么安全 |
|---|---------|-----------|
| Claude Code | MEMORY.md `## Taste Anchors` 段 | 用户级文件，不在 git |
| Codex | **per-cat runtime overlay**（通过 MCP/system prompt 注入，不进文件） | 运行时注入，不进导出链路 |
| Gemini | **per-cat runtime overlay** | 同上 |

对 Codex/Gemini，如果 runtime overlay 机制暂时不支持，**v0 先只在 Claude Code 猫注入**（MEMORY.md），其他猫走 v1 扩展。不要为了覆盖面往不安全的文件里塞。

**测试**：新 session 启动后确认 Claude Code 猫能看到 taste anchors。

**预估**：1h

### 2.5 回归验证

v0 全部内容写完后：
1. `scripts/sync-to-opensource.sh --dry-run` grep taste → 确认无泄露
2. `search_evidence("taste")` → 确认 index 命中
3. 新 session 确认 taste anchors 在空气层

**预估**：30min

---

## 三、v1 Roadmap（demo 后）

| 能力 | 做什么 | 依赖 |
|------|--------|------|
| 运行时写 vignette | 猫在纠偏/aha 时刻写 taste vignette | code-as-harness skill 的 taste 路径 |
| 时间语义 | supersedes / ancestral / last_resonated | F200 consumption |
| 消费反馈 | F200 记录 taste 消费 | F200 扩展 |
| 月度退火 | 月度 digest + 旧 vignette 标 ancestral | scheduled task |
| Scanner 扩展 | 让 private/ vignettes 也可被检索（或独立索引） | Scanner 改动 |
| search_evidence doc_kind 过滤 | 精确搜"只看 taste" | API 改动 |
| per-user 多用户 | 存储按 user_scope 分命名空间 | 产品化阶段 |
| Codex/Gemini taste 注入 | per-cat runtime overlay | 运行时改动 |

---

## 四、拆出去的项

| 项 | 该属于哪条线 |
|---|------------|
| Permission Cancel 计数器 | eval:task-outcome（Phase G） |
| Frustration Auto-Issue | 独立产品特性（需 CVO signoff） |

---

## 五、v0 排期

```
Step 0：安全确认（30min）
Step 1：Taste Index .md + 目录（1.5h）
Step 2：Taste Vignette 目录 + 格式（1h）
Step 3：手工策展（3-4h）
Step 4：空气层注入 MEMORY.md（1h）
Step 5：回归验证（30min）

总计：~8h ≈ 1 天
```

---

*v3：2026-06-03 | [宪宪/Opus-46🐾]*
*修正来源：砚砚 R1（代码验证 4 项 blocking）+ 48 R2（sync allowlist 自认 + 附议砚砚）*
