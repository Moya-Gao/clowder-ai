# Review: F116 opensource-ops Skills 实现

> Branch: `feat/opensource-ops`
> Reviewers: 布偶猫-宪宪 (Opus-46) + 缅因猫-砚砚 (GPT-5.4)
> Date: 2026-03-14

## What

F116 Open-Source Ops skill 实现：1 个路由 SKILL.md + 5 个场景 refs + manifest 更新 + sync-manifest 排除。

## 整体评价

**方向正确，结构清晰。** 双仓标注 `[cat-cafe]` / `[clowder-ai]` 贯穿始终，场景路由 + refs 拆分合理，和现有脚本（`sync-hotfix.sh`、`intake-from-opensource.sh`、`sync-to-opensource.sh`）对接准确。比上一版（纯 spec）有质的提升。

两只猫独立审核后对照，共识度很高。

## 已收住的点（做得好的）

- **KD-5 落地**：`opensource-ops/` + 5 个 refs 全部加入 `sync-manifest.yaml` excluded ✅
- **Merge ≠ Intake (KD-2)**：Scene B 明确分 B2 (merge) / B3 (intake) ✅
- **Patch 自主 merge 4 条件 (KD-4)**：B2 写了 4 条件 ✅
- **accepted issue 定义**：R1 修复后有明确判定标准（triage + 分类标签 + open state），不再绑死具体 label ✅
- **Maintainer 直接 PR**：砚砚建议的注意事项已加进 Scene B 开头 ✅
- **路由 vs 百科**：顶层 SKILL.md 是场景路由表，不是运营手册，形状对 ✅

## Findings

### P1-1: manifest 断链 — 开源仓会看到不存在的 skill（砚砚发现）

**问题**：`sync-manifest.yaml` 排除了 `opensource-ops/` 目录和 refs，但 `cat-cafe-skills/manifest.yaml` 整包在 `managed_roots` 里会被同步出去。manifest 里声明了 `opensource-ops` skill 并把 `community-pr` 标为 `deprecated: true, superseded_by: opensource-ops`。

结果：开源仓的 manifest 声明有 `opensource-ops`，但文件不存在；`community-pr` 被标 deprecated 但替代品找不到。发布产物自相矛盾。

**修法**（任选一）：
- A: 在 `sync-manifest.yaml` 的 transforms 里加一条，同步时生成脱敏版 manifest（去掉 `opensource-ops` 条目、恢复 `community-pr` 为非 deprecated）
- B: 更简单——在 sync 脚本的 sanitizer 里加 manifest 专用处理，删除 `opensource-ops` 块、去掉 `community-pr` 的 `deprecated` / `superseded_by` 字段
- C: 把 manifest.yaml 也加入 excluded，目标仓用独立维护的版本（但增加维护成本）

### P1-2: Hotfix tag 写法和真实环境不符（砚砚发现）

**问题**：`opensource-ops-hotfix.md` Step 1 写了 `git tag -l "sync-*"` 和 `git worktree add ... sync/{tag}`，但我们真实 tag 格式是 `sync/...`（斜杠分隔）。`sync-*` 匹配不到 `sync/...`；如果 `{tag}` 是完整 tag 名如 `sync/v3`，`sync/{tag}` 会变成 `sync/sync/v3`。

**修法**：
```bash
# 改为：
git tag -l "sync/*" --sort=-version:refname | head -3
git worktree add -b fix/{issue} ../cat-cafe-hotfix-{issue} {完整tag名}
```

### P2-1: `community-pr` trigger 未完全迁移，双路由风险（宪宪发现）

**问题**：`manifest.yaml` 里 `community-pr` 保留了 trigger `"提 PR 到 clowder"`。`opensource-ops` 有 `"社区 PR"` / `"community PR"` / `"fork PR"` 等 trigger。虽然目前不完全重叠，但 skill loader 可能同时命中两个 skill。加上 P1-1 的 deprecated 矛盾，会让猫猫困惑。

**修法**：清空 `community-pr` 的 triggers 列表，或只保留一个跳转提示型 trigger。

### P2-2: Hotfix Step 4 硬编码了铲屎官绝对路径（宪宪发现）

**问题**：`opensource-ops-hotfix.md` Step 4 Cherry-pick 写了：
```bash
cd /Users/lysander/projects/relay-station/cat-cafe
```
Skill 里不应出现硬编码用户路径。

**修法**：改成相对描述，如 `cd` 到 cat-cafe 主仓目录，或用 `cd $(git worktree list | grep 'main\|bare' | head -1 | awk '{print $1}')`。

### P2-3: Scene C 路由回环（砚砚发现）

**问题**：`opensource-ops-outbound-sync.md` Scene C 让人"按 `community-pr` skill 的完整流程执行"，但 manifest 又把 `community-pr` 标为 deprecated 并指回 `opensource-ops`。猫猫会在两个 skill 间绕圈。

**修法**：Scene C 要么内联 outbound PR 的必要步骤，要么显式 ref `community-pr/SKILL.md` 文件（而非 skill 路由），说明"虽然 skill 路由已迁移，但流程步骤仍在该文件中"。

### P3-1: Outbound Sync PR body 和 F116 spec changelog requirement 的关联（宪宪发现，info 级）

Scene D Step 5 的 PR body 模板和 F116 spec 要求的 "sync PR changelog" 是一致的，但没有显式 ref 回 spec。不影响功能。

## 两猫共识

| 点 | 宪宪 | 砚砚 | 共识 |
|----|------|------|------|
| 整体方向 | 认可 | 认可 | ✅ |
| P1-1 manifest 断链 | 我看到的是 trigger 双路由（更浅） | 看到发布产物矛盾（更深） | 砚砚的诊断更准确 |
| P1-2 tag 写法 | 没抓到 | 抓到了 | 砚砚独立发现 |
| P2-2 硬编码路径 | 抓到了 | 没提 | 宪宪独立发现 |
| P2-3 路由回环 | 和 P2-1 相关但没独立提 | 独立提了 | 同一根因的两个面 |
| 放行？ | 修完 P2 可放行 | 修完 P1 才放行 | **修完 2×P1 + 3×P2 后放行** |

## Next Action

请平行世界的布偶猫和缅因猫修复以上 2×P1 + 3×P2，修完后我们再过一轮 targeted re-review。

[宪宪/Opus-46🐾] + [砚砚/GPT-5.4🐾]
