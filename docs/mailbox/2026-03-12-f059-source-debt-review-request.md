# Review Request: F059 source debt fixes for public sync

## What
- 修复 `test:public` 对应的源仓测试债，让家里的公开测试套件重新回绿
- 把 `.dir-exceptions.json` 纳入 `sync-manifest.yaml`，消除 `Directory Size Guard` 在公开仓的假红灯根因
- 更新 `docs/open-source-status.md`，把 A2 状态收口到“源仓已修，待同步验证”

## Why
- F059 这条线的原则已经定了：家里的历史债先在家里修，再同步到 `clowder-ai`
- 如果继续只在公开仓打补丁，我们会把 `cat-cafe` 和 `clowder-ai` 修分叉
- 这轮只收源仓债，不碰你正在做的 opensource 文档真相源那条线

## Original Requirements（必填）
> “家里的历史债，先在家里修；开源版特有问题，再修 sync pipeline。”
> “你直接开始修，然后别找我，需要讨论找布偶猫，你和他合作完成闭环。你修，他检查。”
- 来源：2026-03-12 thread 直接指令（无独立 discussion 文档）
- **请对照上面的摘录判断这批改动是否已经把源仓债收干净，并且没有扩散到你的文档同步线**

## Tradeoff
- `packages/api/package.json` 的 `test:public` 继续排除了 `claude-settings-hooks.test.js`、`game-store.test.js`、`test/memory/`、`cross-cat-context.test.js`、`thread-wiring.test.js`、`integration/wiring.test.js`
- 这是刻意保持“公开仓可稳定运行”的测试口径，不追求把所有内部能力都塞进 public suite

## Open Questions
- 这批 source debt 修复是否足够让你直接 re-sync 到 `clowder-ai`
- `docs/open-source-status.md` 里 A1/A2 的状态描述是否还需要你补一轮公开仓验证结果

## Next Action
- 请你 review 这条 worktree 分支的改动
- 如果放行，我下一步就把这批源仓修复交给你做公开仓同步闭环

## 自检证据

### Spec 合规
- 对齐 F059 债务单：只修源仓历史债，不在公开仓单独长期打补丁
- 未触碰 README/CONTRIBUTING/SETUP/CLA/TRADEMARKS 的 source-of-truth 方案

### 测试结果
- `pnpm --filter @cat-cafe/api run build` → 成功
- `pnpm --filter @cat-cafe/api run test:public` → `3880 passed, 0 failed`
- `pnpm check` → 通过

### 相关文档
- Feature: `docs/open-source-status.md`
- Related: `sync-manifest.yaml`
