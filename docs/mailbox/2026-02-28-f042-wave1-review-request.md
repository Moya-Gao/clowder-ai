---
feature_ids: [F042]
topics: [prompt-engineering, skills, review-request]
doc_kind: review-request
created: 2026-02-28
---

## Review 请求: F042 Wave 1 — 三层信息架构 + Skills 25→15 + 一致性收口

### 背景

Cat Cafe 的提示词和 Skills 体系存在系统性问题："改了 A 没改 B"导致三猫行为不一致。
具体案例：砚砚在 PR body 写 `@codex review` 触发了代码修改权限而非 review 权限，
因为 PR template 在三个文件中措辞不一致。本次重构解决这一根本问题。

### 铲屎官原始需求

- **Thread**: `thread_mm4dj9jp0tij0ch3`, 2026-02-28 16:05+
- **原始需求摘录**：
  > "三猫提示词的一致性的问题...改了 a 没改 b 导致 a b 行为不一致"
  > "我们需要针对这样的情况收口避免出现这样的事发生"
- **核心痛点**：散弹修改 → 三猫规则不同步 → 行为分裂
- **请 Reviewer 对照上面的摘录判断：收口后是否真正解决了一致性问题？**

### 设计文档

- Spec: `docs/features/F042-prompt-engineering-audit.md`
- 讨论纪要: `docs/discussions/2026-02-27-f042-prompt-convergence.md`
- 知识工程研究: `docs/research/knowledge-enginnering/`

### Spec Compliance 自检 (§6.1 第一波)

| # | Spec 要求 | 状态 | 说明 |
|---|-----------|------|------|
| 1 | 创建 manifest.yaml | ✅ | 370 行, 15 skills 全覆盖 |
| 2 | 重写 CLAUDE.md (→~100行) | ⚠️ | 109 行 (spec ≤100) |
| 3 | 瘦身 SOP.md (→~50行) | ⚠️ | 76 行 (含例外路径+reviewer配对) |
| 4 | 合并 Skills 25→15 | ✅ | 22 旧目录删除, 15 新目录创建 |
| 5 | 抽取参考文件到 refs/ | ✅ | 7 个共享参考文件 |
| 6 | 建立链式导航 | ✅ | 15/15 skills 有"下一步"段 |

**额外验证通过**:
- manifest.yaml 字段完整性: 15/15 有 triggers/not_for/output/next/sop_step
- manifest next 无悬空引用: 全部指向已存在 skill
- 无硬编码猫名 (triggers): 全部使用通用动词/角色

### 改动文件 (64 files, +2468/-8520)

**新增**:

| 文件 | 说明 |
|------|------|
| `cat-cafe-skills/manifest.yaml` | 路由单一真相源 (370行) |
| `cat-cafe-skills/refs/shared-rules.md` | 12 条共享规则单一真相源 |
| `cat-cafe-skills/refs/decision-matrix.md` | 决策权矩阵 |
| `cat-cafe-skills/refs/commit-signatures.md` | 签名表 + @ 句柄 |
| `cat-cafe-skills/refs/pr-template.md` | PR 模板 + 云端 review 触发模板 |
| `cat-cafe-skills/refs/review-request-template.md` | Review 请求模板 |
| `cat-cafe-skills/refs/mcp-callbacks.md` | MCP HTTP callback 参考 |
| `cat-cafe-skills/refs/rich-blocks.md` | Rich block 规格参考 |
| 12 new skill dirs | collaborative-thinking, debugging, deep-research, feat-lifecycle, merge-gate, parallel-execution, pencil-design, quality-gate, receive-review, request-review, tdd, worktree |

**重写**:

| 文件 | 前 | 后 | 说明 |
|------|------|------|------|
| CLAUDE.md | 549行 | 109行 | 身份卡+猫特有规则 |
| AGENTS.md | 616行 | 123行 | 同上 (缅因猫) |
| GEMINI.md | 478行 | 104行 | 同上 (暹罗猫) |
| docs/SOP.md | 385行 | 76行 | 导航图+例外路径 |
| BOOTSTRAP.md | ~100行 | 66行 | 15 skill 注册表 |
| cross-cat-handoff | ~200行 | 185行 | 增加链式导航 |
| writing-plans | ~115行 | 120行 | 增加链式导航 |
| writing-skills | 683行 | 102行 | 大幅精简 |

**删除**: 22 旧 skill 目录 (36 files, ~5800 行)

### Git SHA

- Base: `cffc04f1` (docs(F042): 完整决策落盘)
- Head: `45205b12` (refactor(F042): 三层信息架构 + Skills 25→15)

### 测试状态

- 本次为纯文档/Skills 重构，无源代码改动
- `pnpm check:skills` 基于主 worktree 检查（合入后 symlinks 需更新）

### Review 重点

1. **一致性收口是否彻底** — refs/ 是否真正消除了三文件重复？有没有遗漏的重复内容仍散在三个猫文件中？
2. **过度合并检查 (§3.3)** — 15 个合并后的 skill 是否有"什么都能做"的 description？特别检查 `merge-gate`（合并了 3 个 skill）和 `parallel-execution`（合并了 3 个 skill）
3. **行数偏离** — CLAUDE.md 109行/AGENTS.md 123行/GEMINI.md 104行 都超过 spec 的 ≤100 行。是继续压缩还是接受 ~110 的现实？
4. **链式导航完整性** — 下一步指引是否覆盖所有分支路径？
5. **知识保真度** — 25→15 合并过程中是否丢失了关键知识？特别是 `systematic-debugging` (296→132) 和 `test-driven-development` (371→112)

### 五件套

**What**: 三层信息架构重构 + Skills 25→15 合并 + refs/ 单一真相源 + 链式导航

**Why**: "改了 A 没改 B"是三猫协作的系统性风险。PR template 不一致导致砚砚误触发
Codex 代码修改权限是最新案例。收口到 refs/ 后，改一处 = 三猫同步。

**Tradeoff**:
- 放弃了"每个 SOP 步骤独立 skill"（如 review-cycle 曾考虑合为 1 个），
  采用 GPT-5.2 建议的拆分（quality-gate / request-review / receive-review），
  因为触发时机天然不同
- 放弃了 `using-mcp-callbacks` 和 `using-rich-blocks` 的 skill 地位，
  降级为 refs/（它们是 API 参考，不是流程知识）

**Open Questions**:
1. 行数超标（109/123/104 vs spec ≤100）是否值得进一步压缩？
2. `cross-cat-handoff` 185 行超过 skill 150 行上限，交接五件套难以进一步压缩
3. 合入后 symlinks 更新方案：手动 22 删 + 15 建，还是写自动化脚本？

**Next Action**: 请 review 上述改动，重点关注 §Review 重点 的 5 项

---

✅ Review 请求检查通过
- [x] Spec compliance 自检完成（见上）
- [x] 设计文档已附
- [x] 铲屎官原始需求已引用
- [x] 五件套完整
- [x] 无源代码改动（纯文档/Skills 重构）
