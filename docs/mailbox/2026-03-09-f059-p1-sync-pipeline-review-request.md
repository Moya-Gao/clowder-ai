# Review Request: F059 P1 — Open Source Sync Pipeline

## What

F059 Phase 1: 建立从主仓（cat-cafe）到开源仓（clowder-ai）的单向同步管道。

核心交付物：
1. **`sync-manifest.yaml`** — 导出白名单定义（managed_roots/files/scripts + excludes + transforms + denylist）
2. **`scripts/sync-to-opensource.sh`** — 五步管道（clean export → allowlist filter → transforms → security scan → output）
3. **Source sanitization** — 3 个源文件 + 8 个测试文件中的个人信息通用化
4. **`test:public`** — 排除 Redis/env-dependent 测试的公开测试套件
5. **cat-cafe-skills 导出** — 通用 skills 开放，4 个内部 refs 排除，内容通用化 transform

## Why

Cat Café 要开源为 clowder-ai，但主仓含大量敏感内容（个人信息、内部讨论、部署配置、Git 历史）。需要一个可重复执行的白名单同步管道，而不是 fork + 手动删除。

关键设计选择：**allowlist export（白名单导出）而非 blacklist deletion（黑名单删除）**——新文件默认不导出，必须显式加入白名单。

## Original Requirements（必填）
> 铲屎官原话（2026-03-04）：
> "我们的代码仓其实不能开源？以后开源要和教程仓那样精挑细选同步？"
> "330 开源如何？"
>
> 铲屎官原话（2026-03-07）：
> "猫猫咖啡的 redis 等不能动，不然开源的猫猫干着干着把自己老家端了"

- 来源：`docs/features/F059-open-source-plan.md` L96-99, L174
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 方案 | 放弃原因 |
|------|----------|
| Fork + strip history | 历史清洗不彻底，commit msg 含内部讨论 |
| Git subtree / submodule | 无法做 transforms（cat-config.json 脱敏等）|
| Monorepo filter-repo | 一次性操作，不可重复 |
| **选择：Shell 脚本 + manifest** | 可重复、可审计、支持 transforms |

## Open Questions

1. **test:public 排除列表维护**：目前用 `grep -v` 链式排除，随着 Redis 测试增多会变长。P2 考虑改用 `test/public/*.test.js` 目录结构或 tag-based 过滤？
2. **Skills SKILL.md 内容通用化程度**：目前只做了 `铲屎官→team lead` 等基础替换。是否需要更深入地审查每个 SKILL.md 的内容？
3. **`--validate` 模式**：脚本中已实现但未在 CI 中跑。P2 加？

## Next Action

请 @codex 做以下 review：
1. **安全审查**：sync-manifest.yaml 的白名单是否遗漏了应排除的敏感文件？
2. **脚本健壮性**：sync-to-opensource.sh 的 transforms 和 security scan 是否有绕过风险？
3. **source sanitization 完整性**：grep 是否还有遗漏的个人信息硬编码？
4. **test:public 覆盖度**：排除列表是否正确、是否遗漏了其他 env-dependent 测试？

## 自检证据

### Spec 合规
- P1 checklist 8/9 项完成（`--validate` CI 集成为 P2 scope）
- 愿景覆盖："精挑细选同步" ✅、"不含个人信息" ✅、"可重复执行" ✅

### 测试结果
```
pnpm --filter @cat-cafe/api test:public  # 3139 passed, 1 failed (pre-existing on main)
pnpm lint                                # 0 errors (warnings only, pre-existing)
pnpm -r --if-present run build           # exit 0
sync-to-opensource.sh --dry-run           # 1089 files, 0 errors, 2 warnings (expected env refs)
```

Pre-existing failures (confirmed on main):
- `agent-router.test.js:1246` — mock 缺 `consumeMentionRoutingFeedback`
- `dare-agent-service.test.js` / `dare-l1-acceptance.test.js` — env 真实 API key 干扰
- `codex-agent-service.test.js` — worktree 目录名 ≠ cat-cafe

### 相关文档
- Feature: `docs/features/F059-open-source-plan.md`
- Branch: `feat/f059-open-source-p1` (3 commits, 19 files, +613/-472)

### 变更文件清单
```
NEW:  sync-manifest.yaml (109 lines)
NEW:  scripts/sync-to-opensource.sh (484 lines, executable)
MOD:  packages/api/package.json (test:public script)
MOD:  packages/shared/src/types/cat-breed.ts (JSDoc examples genericized)
MOD:  packages/web/src/components/ThreadSidebar/DirectoryPickerModal.tsx (placeholder path)
MOD:  packages/web/src/components/workspace/LinkedRootsManager.tsx (placeholder path)
MOD:  packages/api/test/agent-router.test.js (test paths genericized)
MOD:  packages/api/test/codex-agent-service.test.js (test paths genericized)
MOD:  packages/api/test/external-project-store.test.js (test paths genericized)
MOD:  packages/api/test/project-path.test.js (comment genericized)
MOD:  packages/api/test/signals-shared-contract.test.js (test paths genericized)
MOD:  packages/api/test/thread-store.test.js (test paths genericized)
MOD:  packages/web/src/components/ThreadSidebar/__tests__/sidebar-project-restore.test.ts (test paths)
MOD:  packages/web/src/components/__tests__/card-block-markdown.test.ts (test paths + assertion)
```
