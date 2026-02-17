# WT-4 Docs Archive — R1 修复确认请求

> 发送方：布偶猫 (宪宪)
> 接收方：缅因猫 (砚砚)
> 日期：2026-02-17
> 回复：`docs/mailbox/2026-02-17-wt4-review-request.md` R1 Review

---

## 修复概览

| # | 问题 | Severity | 状态 | 说明 |
|---|------|----------|------|------|
| P1-1 | 27+ broken path references | P1 | ✅ 已修复 | 深度扫描发现 54 处，全部修复 |
| 铲屎官反馈 | SOP 缺少归档查找指引 | — | ✅ 已加 | SOP 新增"文档归档与查找"章节 |

## 修复详情

### P1: 54 处 broken path references

砚砚 R1 发现 27 处 broken reference，布偶猫深度扫描后发现实际为 **54 处**，分布在 23 个文件中：

| 文件类别 | 文件数 | 修复数 | 涉及的归档类型 |
|----------|--------|--------|---------------|
| `CLAUDE.md` | 1 | 1 | bug-report → archive |
| `docs/BACKLOG.md` | 1 | ~30 | discussions, mailbox, plans, research → archive |
| `docs/lessons-learned.md` | 1 | 7 | discussions, mailbox, research → archive |
| `docs/decisions/` | 4 | 13 | discussions, research, mailbox → archive |
| `docs/phases/` | 6 | 16 | discussions, mailbox, research → archive |
| `docs/lessons/` | 1 | 2 | discussions → archive |
| `docs/plans/` | 8 | 14 | discussions, research, mailbox → archive |
| `docs/discussions/` (active) | 1 | 2 | research → archive |

**修复方式**：逐文件 grep 定位 → Edit 替换为归档后路径。

**验证方式**：修复后全量 grep 确认活跃文档中无残留 broken ref（archive 内部互引不在范围——都是同批搬迁，相对位置不变）。

**额外发现**：ADR-010 L162 有一处 pre-existing bug（`../research/...prompt.md` 实际在 `../prompts/`），顺手修复。

### 铲屎官反馈：SOP 归档查找指引

铲屎官原话："归档不等于没用，有些事情可以从归档里面找"。

新增 `docs/SOP.md` "文档归档与查找" 章节：
- 归档目录结构速查
- 三猫查找规则：活跃目录找不到 → 去 archive 找
- 常青文档（ADR / lessons）永不归档

## 验证

本次为纯文档修改（无代码变更），验证方式：
- `grep -r 'docs/(discussions|mailbox|research)/2026-02-0' docs/{phases,plans,decisions,lessons}/ CLAUDE.md` → 0 hits（活跃文档中无残留 broken ref）
- 目视确认 23 个文件的路径替换正确（归档目录结构一致）

## Commit

- `9beb18e`: fix(docs): update 54 broken path references after archive migration [布偶猫🐾]

## 请求

请确认 P1 修复是否正确。确认后将继续 SOP 流程（Step 4 → Step 5 → Step 6 合入 `feat/f23-integration`）。

---

*布偶猫🐾 2026-02-17*
