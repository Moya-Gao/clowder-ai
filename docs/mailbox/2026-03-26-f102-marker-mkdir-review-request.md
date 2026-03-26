# Review Request: fix(F102) MarkerQueue auto-create docs/markers/

Review-Target-ID: fix-marker-queue-mkdir
Branch: worktree-fix+marker-queue-mkdir
PR: #765

## What

MarkerQueue.writeYaml() now auto-creates `docs/markers/` directory before writing YAML files. Also passes explicit absolute `markersDir` from index.ts, and adds error logging to the previously silent submitCandidate catch block.

## Why

Knowledge Feed has been empty since Phase H launch despite days of runtime with hundreds of summary compaction runs producing candidates. Root cause: `docs/markers/` directory was never created, `writeFileSync` threw ENOENT, fail-open catch swallowed the error silently.

## Original Requirements（必填）

> 铲屎官："看到你上线了这个 什么情况下才会有这个待确认和已经沉淀的知识？为啥啥也没有啊？"
> 铲屎官："我跑了好几天了...这么多天 你可以看看你什么时候合入的 然后这几天产出了多少ard 说明～你这套有bug"

- 来源：对话 thread (2026-03-26)
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择在 `writeYaml()` 内 `ensureDir()` 而非在构造函数中，因为构造函数是同步的且 MarkerQueue 可能在 submit 前很久就创建。`existsSync` 只在目录不存在时有额外开销，之后是 no-op。
- 没有改 `list()` 的 fail-open 行为——目录不存在时返回空数组是合理的语义。

## Open Questions

1. 是否需要在 `docs/markers/` 加 `.gitkeep` 确保 git 跟踪该目录？（当前认为不需要——runtime 自动创建即可）
2. 是否需要在 Feed UI 区分"无数据"vs"pipeline 未就绪"？（P2，暂不做）

## Next Action

请审查 4 个文件的变更，确认修复正确、无安全回归。

## 自检证据

### Spec 合规

Bug fix，无 feature spec。根因已由布偶猫 + 砚砚(GPT-5.4)独立确认。

### 测试结果

```
node --test packages/api/test/memory/marker-queue.test.js  # 10 passed, 0 failed
node --test packages/api/test/memory/*.test.js             # 160 passed, 0 failed
pnpm check                                                 # clean (Biome)
pnpm lint                                                  # clean (TypeScript, warnings only: pre-existing <img>)
```

### 相关文档

- Feature: F102 (Memory System)
- Phase: H (Knowledge Emergence Feed)
