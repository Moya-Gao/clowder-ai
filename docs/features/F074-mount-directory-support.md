---
feature_ids: [F074]
related_features: [F063, F068]
topics: [project-path, security, mount, shared-directory]
doc_kind: spec
created: 2026-03-07
---

# F074 — Mount Directory Support（挂载/共享目录支持）

## Status: spec
## Owner: 布偶猫
## Evolved from: F068（新建对话 UX）

## Why

铲屎官通过共享目录（SMB/NFS）将同事电脑挂载到本机，想在挂载目录下直接与猫猫协作。当前后端 `validateProjectPath` 的 allowlist 默认只含 `$HOME`、`/tmp`、`/private/tmp`，不包含 `/Volumes`，导致所有挂载目录被 403 拒绝。`PROJECT_ALLOWED_ROOTS` 环境变量是覆盖模式（非追加），配置成本高且容易丢失默认值。前端文案写"选择任意目录"但实际受限，体验不一致。

## What

让用户可以在目录选择器中选择挂载/共享目录，同时保持路径安全校验。

### 改动范围

1. **后端 allowlist 合并模式**：`PROJECT_ALLOWED_ROOTS` 从"覆盖默认"改为"追加到默认"，新增 `PROJECT_ALLOWED_ROOTS_REPLACE=true` 保留完全覆盖能力
2. **默认 roots 加入 `/Volumes`**：macOS 挂载卷的标准路径
3. **结构化错误响应**：403 返回 `{ error, realPath, allowedRoots }` 而非纯字符串，方便前端展示和调试
4. **前端文案修正**：将"选择任意目录"改为更准确的描述

## Acceptance Criteria

- [ ] AC1: `/Volumes/xxx` 路径通过 `validateProjectPath` 校验（默认配置下）
- [ ] AC2: `PROJECT_ALLOWED_ROOTS` 为追加模式（默认 roots 始终保留）
- [ ] AC3: `PROJECT_ALLOWED_ROOTS_REPLACE=true` 时仍可完全覆盖（向后兼容）
- [ ] AC4: 403 错误返回结构化 JSON（含 realPath 和 allowedRoots）
- [ ] AC5: 前端文案准确反映实际行为
- [ ] AC6: 现有测试通过 + 新增测试覆盖挂载路径场景

## 需求点 Checklist

| ID | 需求 | AC# | 验证方式 | 状态 |
|----|------|-----|---------|------|
| R1 | 挂载目录可被选为项目路径 | AC1 | test | [ ] |
| R2 | 环境变量追加模式 | AC2 | test | [ ] |
| R3 | 完全覆盖向后兼容 | AC3 | test | [ ] |
| R4 | 结构化错误响应 | AC4 | test | [ ] |
| R5 | 前端文案准确 | AC5 | manual | [ ] |
| R6 | 回归测试通过 | AC6 | test | [ ] |

## Links

- 根因分析：砚砚 (codex) 在 thread_mmg97bckrmxcbrlj 的诊断
- 关键文件：`packages/api/src/utils/project-path.ts`、`packages/api/src/routes/projects.ts`、`packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx`

## Key Decisions

- `/Volumes` 加入默认 allowlist（macOS 标准挂载点）
- 追加模式为默认，保留覆盖选项（`PROJECT_ALLOWED_ROOTS_REPLACE`）

## Dependencies

- 无硬依赖

## Risk

- Low：改动集中在 path 校验工具，影响面可控
- 需确认 `/Volumes` 下是否有安全敏感路径需要排除

## Open Questions

- 是否需要 Linux 的 `/mnt`、`/media` 也加入默认 roots？（当前只处理 macOS）

## Review Gate

- 跨家族 review（缅因猫优先）
- 云端 Codex review

## Timeline

- 2026-03-07: Kickoff
