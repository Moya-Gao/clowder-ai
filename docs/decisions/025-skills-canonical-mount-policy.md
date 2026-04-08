---
feature_ids: []
topics: [skills, governance, mount, symlink, distribution]
doc_kind: decision
created: 2026-04-07
status: draft
supersedes: ADR-009
related: [F070, F041, F038]
---

# ADR-025: Skills Canonical Mount Policy — 项目级优先 + 用户级 Personal Fallback

> 状态：草稿（待 review）
> 日期：2026-04-07
> 决策者：铲屎官 + 布偶猫 + 缅因猫(GPT-5.4)
> Supersedes：[ADR-009](009-cat-cafe-skills-distribution.md)
> 触发：[clowder-ai#386](https://github.com/zts212653/clowder-ai/issues/386)

## 背景

ADR-009（2026-02-10）选择了"用户级 symlink 分发"作为 Cat Café Skills 的唯一 runtime mount 策略，并显式否决了项目级。

F070（2026-03-08）引入了 Portable Governance，为外部项目 bootstrap 项目级 `.claude/.codex/.gemini/skills` symlinks。这在 ADR-009 之后独立演进，未更新 ADR-009。

结果：系统同时存在两层 skill mount，且无一致性校验。runtime skill discovery、preflight、capabilities board、installer 各自一套口径。ADR-009 已于 2026-04-07 标注为 `drifted`。

详细分析见 [clowder-ai#386](https://github.com/zts212653/clowder-ai/issues/386)。

## 决策

### 1. Canonical Mount：项目级

Cat Café 官方 skills 的 **canonical runtime mount** 是项目级：

```
<project>/.claude/skills  →  <cat-cafe>/cat-cafe-skills/    # 目录级 symlink
<project>/.codex/skills   →  <cat-cafe>/cat-cafe-skills/
<project>/.gemini/skills  →  <cat-cafe>/cat-cafe-skills/
```

- 使用**目录级 symlink**（非 per-skill），确保新增/删除 skill 自动生效
- Governance bootstrap 已在做这件事（`governance-bootstrap.ts:165-203`），本决策将其从"外部项目的 workaround"提升为"所有项目的 canonical 策略"
- Cat Café 自身的 `.claude/skills` 也从 per-skill 历史遗留迁移为目录级 symlink

### 2. 用户级：Personal / External Skills Only

`~/.claude/skills/`、`~/.codex/skills/`、`~/.gemini/skills/` **不再承载 Cat Café 官方 skills**。

用户级目录的用途：
- 个人 skills（用户自己写的、不属于 Cat Café 的）
- 第三方 skills（社区提供的、非 Cat Café 官方的）

**Opt-in fallback**：`setup.sh` / `install.sh` 默认不再将官方 skills 写入用户级。用户可显式执行 `pnpm sync:skills --user` 手动开启用户级官方 skills 降级体验（适用于未 bootstrap 的临时项目）。这是 opt-in 行为，不是默认行为。

### 3. 一致性守卫

同名 skill 同时出现在项目级和用户级时：

- 系统自动比对两层的 `realpath`
- **一致** → 正常，项目级优先（符合 Claude/Gemini 官方优先级规则）
- **不一致** → preflight 红灯 + Hub 告警，明确报告来源差异，不静默按名字去重

### 4. 更新机制

#### 4a. 传输层：symlink + git pull

目录级 symlink 指向 `cat-cafe-skills/` 源目录。`git pull` 后所有变化（内容修改、新增 skill、删除 skill）**自动生效**，无需额外操作。

#### 4b. 感知层：Skills Manifest Hash

Governance pack 新增 skills manifest hash（目录列表 + 内容摘要）：

- Preflight 比对本地 hash vs source hash
- Stale → Hub 治理面板展示"Skills 有更新"
- 猫派遣到外部项目前自动检测

#### 4c. 操作层：Hub 一键同步

- Hub 治理 tab 展示 skills 健康状态（fresh / stale / new available）
- **一键同步按钮**：调 `POST /api/governance/sync-skills` 触发 re-bootstrap
- 猫主动提醒："你的项目 skills 有 N 个更新了，要帮你同步吗？"
- 命令行 `pnpm sync:skills` 作为 CI / 高级用户的 fallback

#### 4d. 派遣时自动同步

已有机制（`capability-orchestrator.ts:790`）：猫被派遣到已确认项目前自动 re-bootstrap。本决策确认此行为为正式策略，并扩展为包含 manifest hash 校验。

### 5. 安装脚本迁移

- `setup.sh` / `install.sh` **停止**将 Cat Café 官方 skills 写入用户级目录
- 改为：在当前 repo 创建项目级目录级 symlink
- 已有旧用户级 symlinks → 提供清理提示（不自动删除，避免误删个人 skills）
- `pnpm sync:skills --user` 保留为 **opt-in** 命令，仅在用户显式执行时写入用户级官方 skills（与 §2 口径一致）

## 否决理由

- **方案 B（干掉用户级）**：不选。未 bootstrap 的临时项目完全无 skills，对开源用户不友好。
- **方案 C（保留双层只加守卫）**：不选。只做检测不定义 canonical = 止血不治本，长期仍困惑。
- **原 ADR-009 策略（纯用户级）**：不选。已被 F070 事实性推翻，不适合多项目治理场景。

## Tradeoff

### 选择了
- 项目级 canonical + 用户级 fallback（兼顾治本和兼容）
- 目录级 symlink（新 skill 自动生效）
- Hub UI 一键同步（面向普通用户，不依赖命令行）

### 放弃了
- 纯用户级分发（ADR-009 路线，已 drifted）
- 纯项目级（无 fallback，对临时项目不友好）
- 复杂的推送/分发系统（symlink + git pull 已是最简洁管道）

## 验收标准

来自 clowder-ai#386 + CVO 要求：

1. 同一 project/session 内，每个 skill 只有一个 canonical source 参与解析
2. User/project 同名 skill 双挂载时，系统检测并报告 realpath 不一致
3. 所有 skill surface（`/api/skills` / `/api/capabilities` / preflight / bootstrap）对 skill source 判断一致，三家 provider（claude/codex/gemini）的项目级目录均被扫描
4. A/B checkout 切换后，不会让旧项目静默混用两棵 skill tree
5. Hub 治理面板展示 skills 版本状态 + 一键同步按钮
6. 猫主动提醒 skill 更新，可帮用户一键修复
7. 覆盖测试：A checkout → A1 bootstrap → B repoint → 回 A1 漂移链

## 实施路线

| 阶段 | 内容 | 依赖 |
|------|------|------|
| Phase 1 | 一致性守卫：**所有 skill surface**（`/api/skills` + `/api/capabilities` + preflight + bootstrap）统一为同一套 realpath 校验逻辑。`/api/skills` 从只看用户级改为项目级优先；`/api/capabilities` 扩展为扫描 `.codex/skills` / `.gemini/skills` 项目级（当前只扫 `.claude/skills`）。不一致报红灯 | 无 |
| Phase 2 | Skills manifest hash 进 governance pack + Hub 展示 stale 状态 | Phase 1 |
| Phase 3 | Hub 一键同步按钮 + `POST /api/governance/sync-skills` | Phase 2 |
| Phase 4 | 安装脚本迁移 + 旧用户级 symlinks 清理提示 | Phase 3 |
| Phase 5 | 猫主动提醒 + 派遣时 manifest hash 校验 | Phase 2 |

## 相关文档

- [ADR-009: Cat Café Skills 分发策略](009-cat-cafe-skills-distribution.md)（superseded，保留为历史记录）
- [F070: Portable Governance](../features/F070-portable-governance.md)
- [F041: Capability Dashboard](../features/F041-capability-dashboard.md)
- [clowder-ai#386: user-level and project-level skill mounts can drift and conflict](https://github.com/zts212653/clowder-ai/issues/386)
