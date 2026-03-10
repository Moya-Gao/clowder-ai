---
feature_ids: [F042]
topics: [sop]
doc_kind: note
created: 2026-02-26
updated: 2026-03-04
---

# Cat Café 开发 SOP

> 三猫开发全流程的导航图。每步的详细操作在对应 skill 内。
> 冲突时以 skill 内容为准。

## Runtime 单实例保护（P0）

`../cat-cafe-runtime` 是咱们的运行态单实例（通常占用 `3002/3001`），默认视为**在线服务**，不是随手重启的实验环境。

硬规则：
1. 在 runtime 会话里，禁止执行会触发重启的命令：`pnpm start`、`pnpm runtime:start`、`./scripts/start-dev.sh`
2. 做截图/验收/排查前，先复用现有服务（先查 `curl -sf http://localhost:3002/health`）
3. 确实要重启，必须先拿到铲屎官明确同意，再显式设置 `CAT_CAFE_RUNTIME_RESTART_OK=1` 执行启动命令

说明：`--force` 不是重启授权，不能替代第 3 条。

## 完整流程（5 步）

```
⓪ Design Gate    → 设计确认（UX→铲屎官/后端→猫猫/架构→两边）
① worktree        → 隔离开发环境
② quality-gate    → 自检 + 愿景对照
③ review 循环     → 本地 peer review（P1/P2 清零 + reviewer 放行）
④ merge-gate      → 门禁 → PR → 云端 review → squash merge → 清理
```

> **⚠️ Design Gate 在 ① 之前！** UX 没确认不准开 worktree。PR 在 ③ 之后。

| Step | 做什么 | Skill | 详情 |
|------|--------|-------|------|
| ⓪ | 设计确认：前端→铲屎官画 wireframe；后端→猫猫讨论；架构→两边 | `feat-lifecycle` Design Gate | Trivial 跳过⓪，按下方例外路径判断 |
| ① | 创建 worktree，配置 Redis 6398 | `worktree` | 禁止直接改 main |
| ② | 愿景对照 + spec 合规 + 跑测试 | `quality-gate` | AC ≠ 完成，问"铲屎官体验如何？" |
| ③a | 发 review 请求（五件套 + 证据） | `request-review` | 附原始需求摘录 |
| ③b | 处理 review 反馈（Red→Green） | `receive-review` | 禁止表演性同意 |
| ④ | 门禁 → PR → 云端 review → merge → 清理 | `merge-gate` | **③ 放行后才进入**，模板见 `refs/pr-template.md` |

## 例外路径

### 跳过云端 review（Step ④ 中的 PR 环节）

三个条件全部满足才可跳过：
1. 铲屎官在当前对话明确同意
2. 纯文档 / ≤10 行 bug fix / typo
3. 不涉及安全、鉴权、数据、API 变更

### 极微改动直接 main（跳过全流程）

四个条件全部满足：
1. 纯日志/配置/注释/文档（不涉及业务逻辑）
2. diff ≤ 5 行
3. 类型检查通过
4. 不涉及可测行为

## Reviewer 配对规则

动态匹配自 `cat-config.json`：
1. 跨 family 优先 | 2. 必须有 peer-reviewer 角色 | 3. 必须 available
4. 优先 lead | 5. 优先活跃猫

**降级**：无跨 family reviewer → 同 family 不同个体 → 铲屎官。
**铁律**：同一个体不能 review 自己的代码。

## 代码质量工具

| 工具 | 命令 | 何时 |
|------|------|------|
| Biome | `pnpm check` / `pnpm check:fix` | 开发中 + Step ② |
| TypeScript | `pnpm lint` | Step ② 必跑 |
| shared rebuild | `pnpm --filter @cat-cafe/shared build` | shared 包改后 |
| 目录卫生 | `pnpm check:dir-size` + `pnpm check:deps` | 新增文件时 |

详见 ADR-010（目录卫生）。

## 环境变量注册（必读！）

新增 `process.env.XXX` 引用 → **必须在 `packages/api/src/config/env-registry.ts` 的 `ENV_VARS` 数组注册**。
前端「环境 & 文件」页面自动展示，不注册 = 铲屎官看不到 = 不存在。

## 文档规范

- `docs/` 下 `.md` 文件必须有 YAML frontmatter（ADR-011）
- 完成后必须同步真相源（详见 `feat-lifecycle` skill）
- 归档查找：`docs/archive/2026-02/`
