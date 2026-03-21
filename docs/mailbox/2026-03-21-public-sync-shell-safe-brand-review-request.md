# Review Request: public sync shell-safe env and acceptance parity

Review-Target-ID: public-sync-shell-safe-brand
Branch: fix/public-sync-shell-safe-brand

## What
- 给 `.env.example.opensource` 里的 `NEXT_PUBLIC_BRAND_NAME` 加 shell-safe 引号，避免公开仓 `source .env` 时把 `AI` 当命令执行
- 把 `cat-template.json` 补进 `sync-manifest.yaml` 的导出清单
- 重写 `packages/api/test/start-dev-script.test.js` 里那条 direct-mode 端口测试，让它自建临时 `.env`，不再硬绑定家里 3001/3002
- 给 `scripts/sync-to-opensource.sh` 的 `test:public` 与 startup acceptance 加环境净化 helper，并把 API 探活路径修正为 `/health`
- 扩展 `scripts/start-dev-profile-isolation.test.mjs`，新增：
  - 公开导出 `.env.example` 可被 shell 成功 source
  - 公开导出产物包含 `cat-template.json`

## Why
- `#628` 合回家后，真实 full sync 继续暴露了 4 个 source-side 根因：
  1. 公开 `.env.example` 里的 `Clowder AI` 未加引号，`source .env` 直接炸
  2. 公开仓缺少 `cat-template.json`，导致多组 API tests 直接 `ENOENT`
  3. `start-dev-script.test.js` 还在假设家里端口，和公开仓 3003/3004 契约不一致
  4. sync 脚本 post-sync acceptance 继承了我当前 runtime shell 的 ambient env，并且探活打错到了 `/api/health`
- 这些都不是 `clowder-ai` 应该手补的尾巴，而是我们家里的 sync/source pipeline 还没把公开仓契约收完整

## Original Requirements
> “那你来吧！ 现在家里没有其他任何thread在跑 全部都在等你收拾 你开始收拾清楚红灯？ 然后再考虑走full gate？”
>
> “你来负责检查是否全量同步？  或者是说家里基线按照我们的全量同步sop 先修到全绿，然后走全量同步？”
- 来源：当前 thread，消息 `0001774099762276-000002-1f2b4663` 与 `0001774099348182-000000-da7cad6c`
- **请对照上面的摘录判断：这组修复是否确实把 full sync/source pipeline 自己的阻塞收干净了，而不是把共享问题继续留给社区仓**

## Tradeoff
- 我没有去动 `clowder-ai` 再补一轮 hotfix；那样下次 full sync 还会回归
- 我也没有把 `start-dev.sh` 改成到处 `if exists then source`；这次根因不是 helper 可选，而是 source pipeline 应该导出什么、应该如何验收
- `run_public_acceptance_env` 只清 acceptance 相关的 ambient env，不扩大到整个 sync 过程，避免把非 acceptance 阶段的真实问题掩掉

## Open Questions
1. 这 5 个文件的边界是否还保持在 source-of-truth / sync durability，而没有越界到社区仓特化？
2. `start-dev-script.test.js` 改成临时工程根后，是否真正测到了“公开契约优先于 ambient shell”的行为，而不是换了另一种实现耦合？
3. `run_public_acceptance_env` 的 unset 清单是否足够，只清了 acceptance 污染源，没有误伤公开仓应当继承的变量？

## Next Action
- 请按严格标准 review 这 5 个文件。
- 如果放行，我下一步直接拿当前分支重跑 full sync，并以这轮成功结果为依据推进 outbound sync。

## 自检证据

### Spec / 边界合规
- 改动全部落在 source repo：`.env` 模板、manifest、shared tests、sync script
- 没有新增 `clowder-ai` 手补，没有把 shared 问题继续留在 target

### 验证命令输出
```bash
pnpm check
# PASS check-feature-truth: features=135 backlog_active=37
# scripts/check-env-port-drift.test.mjs: 45 pass / 0 fail

node --test scripts/start-dev-profile-isolation.test.mjs
# 3 pass / 0 fail

cd packages/api && node --test test/start-dev-script.test.js
# 19 pass / 0 fail

CLOWDER_AI_DIR=/tmp/clowder-ai-sync-rerun5.cD0oRe bash scripts/sync-to-opensource.sh --yes
# test:public -> fail 0
# Startup acceptance -> API health check passed (3004), Frontend page responded (3003)
# Port verification passed
# === Sync complete ===
```

### 相关文件
- `sync-manifest.yaml`
- `.env.example.opensource`
- `scripts/sync-to-opensource.sh`
- `scripts/start-dev-profile-isolation.test.mjs`
- `packages/api/test/start-dev-script.test.js`
