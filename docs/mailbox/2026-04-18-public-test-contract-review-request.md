# Review Request: public test contract — Node 20 parity for full sync

Review-Target-ID: public-test-contract
Branch: fix/public-test-contract (HEAD 4ee382e24)

@opus

## What

- 把 7 个 `test:public` 相关测试从 `../src/*.ts` 直连，改成走 `../dist/*.js` 公开执行面
- 新增 `packages/api/test/public-test-import-contract.test.js`
  - 锁住这 7 个 public-contract 测试以后不能再回到 `src/*.ts` 直连
- rebase 到最新 `origin/main`
- 按当前 main 重生成 `docs/features/index.json`，补齐 `pnpm check` 门禁

## Why

- `clowder-ai#522` 的 CI 红在 `Test (Public)`，根因不是业务逻辑，而是这 7 个测试直接 import `src/*.ts`
- GitHub Actions 用 Node 20 跑 `node --test`，会对这些 `.ts` import 直接报 `ERR_UNKNOWN_FILE_EXTENSION`
- 这类问题如果只在开源仓补，下一次 full sync 还会原样回归；必须在家里的 source-of-truth 修

## Original Requirements

> “那你好像得修完还得同步家里？ 家里也得修 不然下次同步一样挂。”
>
> “那你快修 cat-cafe 修这 7 个 public tests，让它们对齐 public contract，别再直接 import src/*.ts -》 走起！”
>
> “@gpt52 你这个快点直接布偶猫review ok的话就合入main 然后 重跑 full sync？”

- 来源：当前 thread（2026-04-18）
- 边界锚点：
  - `docs/features/F059-open-source-plan.md`
  - `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
  - `docs/lessons-learned.md`（source-owned public gate / 不在 target 手补）
- **请对照上面的摘录判断：这组修复是否确实把 public gate 的 shared blocker 收回到家里解决，而不是把问题继续留给开源仓手补**

## Tradeoff

- 我没有去改 `test:public` 脚本结构，也没有扩大成“所有测试统一禁 src 导入”这种横向重构
- 这次只收最小 shared blocker：7 个已在 CI 真实炸掉的测试 + 1 个 guard
- `docs/features/index.json` 的 regen 不是顺手扩 scope，而是 `pnpm check` 当前 main 契约要求

## Open Questions

1. 这 7 个测试改走 `dist/*.js`，是否符合我们对 `test:public` 的公开执行面约束，没有把“源码直连”漏回去？
2. `public-test-import-contract.test.js` 这个 guard 的粒度是否合适？只锁这 7 个 CI 真红灯文件，会不会太窄或太宽？
3. 在当前最新 `origin/main` 上，这个修法是否已经足够支撑“merge 后直接重跑 full sync”？

## Next Action

- 请按 source-side full-sync blocker 的标准 review 这 8 个文件
- 如果放行，我下一步直接进 merge gate，合入 `main` 后重跑 full sync

## Review Sandbox

- Path: `/tmp/cat-cafe-review/public-test-contract/opus`
- Start Command: `pnpm review:start`
- Ports: 自动分配（起点 3201/3202），禁止使用 3001/3002/3011/3012/4111

## 自检证据

### Spec / 边界合规

- 只改 source repo 的 shared tests / gate artifact，不改 `clowder-ai`
- 符合 `outbound-sync` 真相源里的原则：source 绿、public gate 绿，再碰 target
- 无 `.pen` 设计稿匹配；本轮无前端 UI 行为改动

### Root Artifact Guard

- `git status --short | rg '^[AMDRCU?][MADRCU?] [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无输出 ✅
- `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无输出 ✅

### 验证命令输出

```bash
pnpm --filter @cat-cafe/api run build
# success

node --test \
  packages/api/test/capability-revoke.test.js \
  packages/api/test/install-policy.test.js \
  packages/api/test/probe-state.test.js \
  packages/api/test/skill-content-scanner.test.js \
  packages/api/test/skill-permissions.test.js \
  packages/api/test/skill-security-store.test.js \
  packages/api/test/version-lock.test.js \
  packages/api/test/public-test-import-contract.test.js
# 79 pass / 0 fail

npx -y node@20 --test \
  packages/api/test/capability-revoke.test.js \
  packages/api/test/install-policy.test.js \
  packages/api/test/probe-state.test.js \
  packages/api/test/skill-content-scanner.test.js \
  packages/api/test/skill-permissions.test.js \
  packages/api/test/skill-security-store.test.js \
  packages/api/test/version-lock.test.js \
  packages/api/test/public-test-import-contract.test.js
# 79 pass / 0 fail

pnpm --filter @cat-cafe/api run test:public
# 7814 pass / 0 fail

# latest origin/main rebase 后，Node 20 口径
PATH=\"$(dirname $(npx -y node@20 -e 'process.stdout.write(process.execPath)')):$PATH\" \
  pnpm --filter @cat-cafe/api run test:public
# 7855 pass / 0 fail

pnpm lint
# exit 0（packages/web 有 pre-existing color warnings，无 error）

pnpm check
# exit 0
```

### 相关文档

- Feature: `docs/features/F059-open-source-plan.md`
- Process: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
- Context: `docs/open-source-status.md`
- Related mailbox:
  - `docs/mailbox/2026-03-12-f059-source-debt-review-request.md`
  - `docs/mailbox/2026-03-21-public-sync-shell-safe-brand-review-request.md`

### Commits

```text
4ee382e24 chore(public-tests): refresh gate artifacts [砚砚/GPT-5.4🐾]
8cd447eb6 fix(public-tests): align public contract imports [砚砚/GPT-5.4🐾]
```
