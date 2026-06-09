---
feature_ids: [F228]
topics: [skills, governance, mount, symlink, distribution, ux]
doc_kind: decision
created: 2026-04-07
status: draft
supersedes: ADR-009
related: [F070, F041, F038, F228]
---

# ADR-025: Skills Canonical Mount Policy — 受管 Symlinks + 外部生态共存

> 状态：草稿（待铲屎官终审）
> 日期：2026-04-07（R3 修订：2026-04-15）
> 决策者：铲屎官 + 布偶猫 + 缅因猫(GPT-5.4) + 暹罗猫(Gemini)
> Supersedes：[ADR-009](009-cat-cafe-skills-distribution.md)
> 触发：[clowder-ai#386](https://github.com/zts212653/clowder-ai/issues/386)

## 背景

ADR-009（2026-02-10）选择了"用户级 symlink 分发"，F070（2026-03-08）又加了项目级 governance bootstrap。两层同时存在，无一致性校验。ADR-009 已标注 `drifted`。

**R3 新增背景**：Claude Code 已有外部 skills 生态（`skills.sh` / `npx skills add`），用户可下载第三方 skills 到 `.claude/skills/`。原草稿的"目录级 symlink"方案会劫持整个安装目录，导致外部 skill 安装穿透到 git-tracked 源树。此外，Claude Code 的 skill 优先级为 **enterprise → personal → project**，项目级不一定赢用户级。

## 决策

### 1. 项目级 Skills 目录：真实目录，非 symlink

`.claude/skills/`（及其他 provider 目录）保持为**真实目录**，内含两类内容：

| 类型 | 形式 | 管理者 | 示例 |
|------|------|--------|------|
| **官方受管 skills** | per-skill symlink → `cat-cafe-skills/<name>` | governance sync | `worktree → ../../cat-cafe-skills/worktree` |
| **外部 skills** | 真实目录（用户安装的） | 用户自己 | `react-best-practices/SKILL.md` |

- **不使用目录级 symlink**——避免劫持整个安装目录，让外部 skills 生态正常工作
- 官方 skills 的**内容更新**仍然零操作（symlink 指向源目录，`git pull` 自动生效）
- 官方 skills 的**名称增减**需要一次 sync（Hub 一键 / 猫主动帮忙 / 命令行 fallback）

### 2. 受管状态文件：`skills-state.json`

在 `.cat-cafe/governance/skills-state.json` 记录受管状态：

```json
{
  "managedSkillNames": ["worktree", "tdd", "quality-gate", "..."],
  "sourceRoot": "../../cat-cafe-skills",
  "sourceManifestHash": "sha256:abc123...",
  "lastSyncedAt": "2026-04-15T12:00:00Z"
}
```

- Hub / preflight / sync 逻辑只操作 `managedSkillNames` 里的 skills
- 非受管目录（用户安装的外部 skills）一律不动
- Manifest hash = 源目录的目录列表 + 内容摘要，检测新增/删除/变更

### 3. 用户级：Personal / External Skills Only

`~/.claude/skills/` 等用户级目录不再默认承载官方 skills。用途：
- 个人 skills、第三方 skills
- `pnpm sync:skills --user` 可 opt-in 写入（适用于未 bootstrap 的临时项目）

### 4. 冲突检测：阻塞 + 选择，不是静默覆盖

**重要**：Claude Code 的优先级是 enterprise → personal → project。用户级同名 skill 会 shadow 项目级。

同名冲突处理：
- 系统自动检测同名 skill 跨层存在且 realpath 不一致
- **不是红灯报错**，而是给用户**选择卡片**：
  - "官方的 `xxx` 和你安装的 `xxx` 撞名了，目前用户级会覆盖项目级。你想保留哪个？"
  - `[用官方版本]` → 移除用户级同名 skill
  - `[用我的版本]` → 从受管列表中排除该 skill
- Preflight 日志里仍记录冲突（可审计），但面向用户的体验是选择而非报错

### 5. 更新机制

#### 5a. 传输层：per-skill symlinks + git pull

官方 skills 的内容变更通过 symlink 自动传播。只有名称增减需要 sync。

#### 5b. 感知层：Manifest Hash + Hub Toast

- Preflight 比对 `skills-state.json` 的 hash vs 源目录实际 hash
- Stale 时 Hub **不弹红色警告**，而是显示温和的上新通知：
  - "咖啡馆上新啦！有 N 个新 skill 可用" + 一键同步按钮
- 猫在工作中发现 stale 时主动提醒并可直接帮忙 sync

#### 5c. 操作层：Hub Skills 面板

面板视觉分区：

- **【官方 Skills】**：Cat Café 官方受管 skills，带状态标识（fresh / stale / conflict）
  - 一键同步按钮
  - 新 skill 到来时高亮展示
- **【已安装 Skills】**：用户通过 `npx skills add` 等安装的外部 skills
  - 显示来源、安装方式
  - Worktree 间差异时，提供可选的"从 main 同步"按钮（显式操作，非自动）
- **【用户级 Skills】**：`~/.claude/skills/` 里的跨项目 skills

#### 5d. 派遣时自动同步

已有机制确认为正式策略。派遣到外部项目时：
1. 检测 manifest hash → stale 则自动 sync 受管 skills
2. 不触碰外部 skills

#### 5e. Worktree 生命周期集成

- 创建 worktree 时自动 bootstrap per-skill symlinks（通过 worktree skill 的生命周期 hook）
- 切分支时后台检测 skill 名称变化，有则提示

### 6. Worktree 外部 Skills：可见但不强制一致

不同 worktree 的外部 skills 不一致是**合理的实验隔离**（和 `node_modules` 类似）。

- **官方受管 skills**：必须一致，sync 保证
- **外部 skills**：只做可见 + 可选复制
  - Hub 展示"本 worktree 外部 skills"列表
  - 提供"与 main worktree 的差异"视图
  - 可选操作："把 main 的外部 skills 集合同步到当前 worktree"（显式按钮）

### 7. Provider 路径差异

外部生态（`skills.sh`）的 provider 路径映射不完全等于我们的：

| Provider | Cat Café 受管路径 | 外部生态路径 |
|----------|------------------|-------------|
| Claude | `.claude/skills/` | `.claude/skills/` |
| Codex | `.codex/skills/` | `.agents/skills/`（skills CLI） |
| Gemini | `.gemini/skills/` | `.agents/skills/`（skills CLI） |

Hub 扫描时需分两层：
- Cat Café 官方受管路径：按 governance bootstrap 口径
- 外部生态路径：按各 provider 原生口径

### 8. 安装脚本迁移

- `setup.sh` / `install.sh` 停止将官方 skills 写入用户级目录
- 改为：在当前 repo 创建项目级 per-skill symlinks + 写入 `skills-state.json`
- 旧用户级 symlinks → 清理提示（不自动删除）
- `pnpm sync:skills --user` 保留为 opt-in

## 否决理由

- **目录级 symlink**：不选。劫持整个安装目录，外部 `npx skills add` 会穿透到 git-tracked 源树，与外部 skills 生态冲突。
- **方案 B（干掉用户级）**：不选。临时项目无 skills。
- **方案 C（保留双层只加守卫）**：不选。不定义 canonical = 止血不治本。
- **原 ADR-009（纯用户级）**：不选。已被 F070 推翻。

## Tradeoff

### 选择了
- 受管 per-skill symlinks + 外部真实目录共存（兼容外部生态）
- `skills-state.json` 受管状态（精确区分官方 vs 外部）
- Hub 分区展示 + 上新通知 + 选择卡片（丝滑 UX）
- Worktree 外部 skills 可见不强制（尊重用户）

### 放弃了
- 目录级 symlink（污染源树）
- 纯用户级分发（ADR-009，已 drifted）
- 新增 skill 零操作自动出现（用 Hub 通知 + 一键同步补偿）
- Worktree 外部 skills 强制一致（侵入性太强）

## 验收标准

1. 同一 project/session 内，每个官方 skill 通过受管 symlink 只有一个 canonical source
2. 外部 skills（`npx skills add`）可正常安装到 `.claude/skills/`，不被阻断或污染源树
3. 同名冲突时 Hub 给出选择卡片，用户可一键决定保留哪个
4. 所有 skill surface 对 skill source 判断一致，三家 provider 均被扫描
5. A/B checkout 切换后，不会让旧项目静默混用两棵 skill tree
6. Hub skills 面板视觉分区展示官方 / 外部 / 用户级 skills
7. 新增官方 skill 时 Hub 展示上新通知 + 一键同步
8. 猫主动提醒 skill 更新，可帮用户一键修复
9. Worktree 间外部 skills 差异可见，可选复制
10. 覆盖测试：worktree 创建 → 受管 symlinks 自动补齐

## 实施路线

| 阶段 | 内容 | 依赖 |
|------|------|------|
| Phase 1 ✅ | 受管状态基础：`skills-state.json` + sync 逻辑只操作受管集合。所有 skill surface（`/api/skills` + `/api/capabilities` + preflight + bootstrap）统一校验逻辑。governance bootstrap 从目录级改为 per-skill symlinks | 无 |
| Phase 2 ✅ | Manifest hash 检测 + Hub 上新通知（stale toast） + 同名冲突选择卡片 | Phase 1 |
| Phase 3 | Hub skills 面板分区展示（官方 / 外部 / 用户级）+ 一键同步按钮 | Phase 2 |
| Phase 4 | Worktree 生命周期集成（创建时自动 bootstrap）+ 外部 skills diff 视图 | Phase 1 |
| Phase 5 | 安装脚本迁移 + 旧用户级 symlinks 清理提示 + 猫主动提醒 | Phase 3 |

## 相关文档

- [ADR-009: Cat Café Skills 分发策略](009-cat-cafe-skills-distribution.md)（superseded，保留为历史记录）
- [F228: Multi-Project Skill Mount Management](../features/F228-multi-project-skill-mount-management.md)（将本 ADR 的 canonical mount policy 产品化为多项目 / per-provider skill 管理）
- [F070: Portable Governance](../features/F070-portable-governance.md)
- [F041: Capability Dashboard](../features/F041-capability-dashboard.md)
- [clowder-ai#386](https://github.com/zts212653/clowder-ai/issues/386)
- [skills.sh / Skills CLI](https://skills.sh/)（外部 skills 生态）
- [Claude Code Skills Docs](https://docs.anthropic.com/en/docs/claude-code/common-workflows#use-skills)（优先级：enterprise → personal → project）
