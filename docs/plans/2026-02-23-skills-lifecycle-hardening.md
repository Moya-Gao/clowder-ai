---
feature_ids: [F092]
topics: [skills, lifecycle, hardening]
doc_kind: plan
created: 2026-02-23
---

# F92: Skills Lifecycle Hardening

> 发起：2026-02-23，铲屎官 + 布偶猫
> 状态：计划中
> 关联：BACKLOG #92

## 背景

Skills 是三猫协作的灵魂。当前 Cat Café 有 20 个共同 Skills（`cat-cafe-skills/`），
但我们发现了三个流程缺口导致 skill 发布不完整：

### 问题 1: `using-rich-blocks` 写了内容但没挂载

某只猫创建了 `cat-cafe-skills/using-rich-blocks/SKILL.md`（96 行，内容完整），
但**三只猫都没有 symlink**。SystemPromptBuilder 里写着"加载 `using-rich-blocks` skill"，
但猫猫根本找不到这个 skill（没挂载 = 不在发现路径里）。

**根因**：创建 skill 的流程中没有"发布到三猫"的强制步骤。

### 问题 2: `writing-skills` 缺少 Cat Café 发布流程

`writing-skills/SKILL.md` 的 Deployment 段（第 631-633 行）只有两步：
```
- [ ] Commit skill to git and push to your fork
- [ ] Consider contributing back via PR
```

**完全没提**：
- 为三猫创建 symlink（`~/.claude/skills/`, `~/.codex/skills/`, `~/.gemini/skills/`）
- 在 BOOTSTRAP.md 注册
- `pnpm check:skills` 验证

这就是为什么 `using-rich-blocks` 只写了一半就停了——流程文档没告诉猫猫还有后续步骤。

### 问题 3: `check:skills` 只检挂载，不检注册

当前 `check:skills` 检查：`cat-cafe-skills/` → `~/.{claude,codex,gemini}/skills/` symlink 是否存在。

但**不检查**：
- BOOTSTRAP.md 里有没有注册（漏注册 = 猫猫启动时看到的 skill 清单不完整）
- 源目录有 SKILL.md 但 BOOTSTRAP.md 没列 → 静默遗漏
- BOOTSTRAP.md 列了但源目录没有 → 幽灵条目

---

## 改动清单

### M1: 挂载 `using-rich-blocks`（简单）

为三猫创建 symlink：
```bash
ln -s .../cat-cafe-skills/using-rich-blocks ~/.claude/skills/using-rich-blocks
ln -s .../cat-cafe-skills/using-rich-blocks ~/.codex/skills/using-rich-blocks
ln -s .../cat-cafe-skills/using-rich-blocks ~/.gemini/skills/using-rich-blocks
```

验证：`pnpm check:skills` 全绿（20/20）。

### M2: 给 `writing-skills` 补 Cat Café 发布 Checklist（关键）

在 `writing-skills/SKILL.md` 的 Deployment 段后面追加一节：

```markdown
## Cat Café Skill Publishing (Required for shared skills)

Shared skills live in `cat-cafe-skills/` and must be discoverable by all three cats.

**Publishing Checklist (after Skill Creation Checklist passes):**

1. **Source**: Place `SKILL.md` (+ supporting files) in `cat-cafe-skills/{skill-name}/`
2. **Symlink 三猫**:
   ```bash
   SKILLS_SRC=/Users/lysander/projects/relay-station/cat-cafe/cat-cafe-skills
   ln -s $SKILLS_SRC/{skill-name} ~/.claude/skills/{skill-name}
   ln -s $SKILLS_SRC/{skill-name} ~/.codex/skills/{skill-name}
   ln -s $SKILLS_SRC/{skill-name} ~/.gemini/skills/{skill-name}
   ```
3. **Register**: Add entry to `cat-cafe-skills/BOOTSTRAP.md` under the right category
4. **Verify**: Run `pnpm check:skills` — must show all green
5. **Commit**: Include `cat-cafe-skills/{skill-name}/` in commit

**Forgetting any step = skill is invisible to some/all cats.**
```

位置：放在现有 Deployment 段之后，用 `##` 二级标题独立成节。

**为什么加在 `writing-skills` 而不是新建 skill**：
- `writing-skills` 已经是"写 skill 时"的触发目标
- 加一个新 skill 反而增加发现成本——猫猫已经在用 `writing-skills`，加在这里自然衔接
- 保持 "一个触发场景 = 一个 skill" 原则

### M3: 增强 `check:skills` 双向校验（重要）

扩展 `scripts/check-skills-mount.sh`，在现有挂载检查后增加：

**校验 A: 源目录 → BOOTSTRAP.md**
- 扫描 `cat-cafe-skills/*/SKILL.md`
- 检查 BOOTSTRAP.md 是否包含该 skill name
- 不包含 → 报 `⚠ not registered`

**校验 B: BOOTSTRAP.md → 源目录**
- 解析 BOOTSTRAP.md 中所有 `` `skill-name` `` 条目
- 检查 `cat-cafe-skills/{skill-name}/SKILL.md` 是否存在
- 不存在 → 报 `⚠ phantom entry`

输出示例：
```
注册检查（BOOTSTRAP.md ↔ 源目录）
my-new-skill            ⚠ not registered in BOOTSTRAP.md
old-removed-skill       ⚠ phantom entry (in BOOTSTRAP.md but no source)
```

---

## 不做什么

- **不改 SystemPromptBuilder 注入逻辑**：当前"Skills-as-source-of-truth"架构是对的，
  prompt 保持极简，skill 按需加载。不需要把 20 个 skill 名字塞进 system prompt。
- **不新建 skill**：改进现有 `writing-skills` + `check:skills` 即可。
- **不改 `using-rich-blocks` 内容**：内容已经完整且质量好，只缺挂载。

## 风险

| 风险 | 缓解 |
|------|------|
| `writing-skills` 变更后未经 TDD 验证 | 追加的是发布流程（checklist），不是行为规则，不需要 pressure test |
| BOOTSTRAP.md 解析脆弱 | 用简单 grep 匹配反引号包裹的 skill name + `\|\| true` 防空匹配退出 |
| check:skills 在 worktree 误报 | 用 `git worktree list` 推导主仓 canonical path，不用脚本位置 |
| 注册检查误阻断 | 注册不一致仅 warning（exit 0），挂载异常才 blocking（exit 1） |

## 验证方式

1. `pnpm check:skills` — 20/20 全绿 + 双向校验 0 warning
2. 手动删一个 BOOTSTRAP.md 条目 → 脚本报 `not registered`
3. 手动加一个 BOOTSTRAP.md 幽灵条目 → 脚本报 `phantom entry`
4. 新猫启动时 `using-rich-blocks` skill 可被发现
