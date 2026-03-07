# Review Request: F058 Remote-first BACKLOG sync + frontmatter status fix

## What

两项改动：

1. **Remote-first 文件读取**：Mission Hub import sync 现在通过 `git fetch origin main` + `git show` 从远程 main 读取 `docs/BACKLOG.md` 和 `docs/features/*.md`，而非读本地文件系统。本地文件作降级 fallback。
2. **Frontmatter status 解析**：`parseFeatureDocStatus()` 现在也检查 YAML frontmatter 的 `status:` 字段，修复 F068、F064 等使用 frontmatter-only 格式的 feature doc 状态无法被识别的 bug。

新模块 `git-doc-reader.ts`：git fetch 节流（1 次/分钟），`gitShowFile()`、`gitListFeatureDocs()`、`readFeatureDocContent()`、`readBacklogContent()`。

## Why

铲屎官反馈 F068 已关闭但仍在 Mission Hub 显示"等待建议"。根因：
- runtime 是 main 的 checkout，可能落后几十个 commit，import sync 读本地文件 = 数据不是最新
- F068 的 feature doc 用 YAML frontmatter `status: done`，但 parser 只认 `> **Status**: done` body 格式

## Original Requirements（必填）

> 铲屎官 [17:39]："我是认为mission hub要同步的是remote main"
> 铲屎官 [17:44]："最好的是 A. 每次 import 前先 git fetch origin main && git show origin/main:docs/BACKLOG.md，本地 main 当降级，runtime可能落后几十个commit都可能"

- 来源：Thread `thread_mm72eyvcbnb7jjbv`，2026-03-06 17:39-17:44
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 方案 B（GitHub API raw file）被排除——有 rate limit 和网络延迟
- `git fetch` 节流 60s——多次连续导入不会重复 fetch，但允许最多 1 分钟的延迟
- `feat-index-doc-import.ts` 也有本地读取，这次没改——范围限定在 backlog import sync

## Open Questions

1. `git fetch` 超时设 10s、`git show` 超时设 5s——是否足够？
2. `iterateFeatureDocs` 改为 `getFeatureDocs`（返回数组而非 AsyncGenerator），对于大量 feature docs 的内存影响？目前 ~70 个 doc，不是问题。
3. frontmatter 优先级：body status 优先于 frontmatter——是否正确？

## Next Action

请 review 代码变更，关注：
- git 命令的安全性（`execFile` vs `exec`、超时、maxBuffer）
- 降级逻辑是否覆盖所有 failure 场景
- 测试覆盖度

## 自检证据

### Spec 合规
- 铲屎官要求 remote main 同步 → git fetch + git show 实现 ✅
- 本地降级 → 所有 git 操作 catch 后 fallback 到 readFile ✅
- frontmatter status 修复 → body 优先 + YAML 降级 ✅

### 测试结果
```
REDIS_URL= node --test packages/api/test/backlog-doc-import.test.js  # 28 passed, 0 failed
REDIS_URL= node --test packages/api/test/backlog-routes.test.js      # 30 passed, 0 failed
pnpm --filter @cat-cafe/api build                                     # 成功
biome check (changed files only)                                      # 仅 pre-existing parseActiveFeaturesFromBacklog complexity
```

### 相关文档
- Feature: F058 Mission Control Enhancements
- Files changed: `backlog-doc-import.ts` (modified), `git-doc-reader.ts` (new), test (modified)
