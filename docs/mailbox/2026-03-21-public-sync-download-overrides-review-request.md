# Review Request: public sync startup acceptance hotfix

Review-Target-ID: public-sync-download-overrides
Branch: fix/public-sync-download-overrides

## What
- 把 `scripts/download-source-overrides.sh` 加进 `sync-manifest.yaml` 的 `managed_scripts`
- 调整 `scripts/start-dev-profile-isolation.test.mjs`
  - 公开仓缺少 `scripts/sync-to-opensource.sh` 时，跳过 home-only 的 export transform 子测试
  - 反向补一条断言：sync 导出的公开仓必须包含 `scripts/download-source-overrides.sh`

## Why
- 我刚执行真实 full sync 时，`clowder-ai` 的 post-sync acceptance 掉在公开启动链上：
  - `scripts/start-dev.sh` line 46 会 `source "$SCRIPT_DIR/download-source-overrides.sh"`
  - 但当前 sync manifest 没把这个 helper 导出去
  - 结果公开仓 `pnpm check:start-profile-isolation`、`packages/api/test/start-dev-script.test.js`、startup acceptance 的 API 3004 启动都一起炸
- 这不是社区手改的问题，是家里 sync/source 链把依赖漏导出了，应该在家里修

## Original Requirements
> “你来负责检查是否全量同步？ 或者是说家里基线按照我们的全量同步sop 先修到全绿，然后走全量同步？”
>
> “那你来吧！ 现在家里没有其他任何thread在跑 全部都在等你收拾 你开始收拾清楚红灯？ 然后再考虑走full gate？”
- 来源：当前 thread，消息 `0001774099348182-000000-da7cad6c` 与 `0001774099762276-000002-1f2b4663`
- **请对照上面的摘录判断：这组 hotfix 是否确实在修 full sync 本身的阻塞，而不是把问题甩回社区仓手补**

## Tradeoff
- 我没有把 `download-source-overrides.sh` 改成所有脚本都 `if exists then source`，因为这次根因不是“源仓里文件可选”，而是“公开仓本应导出却漏了”
- 我也没有在社区仓直接补测试或脚本；那样下次 full sync 还会再坏一次

## Open Questions
1. 这次修法是否保持了正确边界：修 sync/source pipeline，而不是在 `clowder-ai` 手补？
2. `start-dev-profile-isolation` 在公开仓跳过 home-only 子测试，是否符合我们对 public repo 的契约分层？
3. 这组改动放行后，我就直接重跑 full sync，是否还需要额外门禁？

## Next Action
- 请按严格标准 review 这 2 个文件。
- 如果放行，我下一步直接重跑 full sync，并只盯这次暴露出来的 target residual。

## 自检证据

### Spec 合规
- 根因已定位：manifest 漏导出 helper + exported test 没按 repo 能力分层
- 修法只动 source-of-truth 两处，不碰社区仓，不扩 scope

### 测试结果
```bash
node --test scripts/start-dev-profile-isolation.test.mjs
# 3 pass / 0 fail
#
# 其中 sync-to-opensource 子测试已覆盖：
# - 导出产物包含 scripts/download-source-overrides.sh
# - 公开 direct-launch wrappers 仍固定到 opensource profile
```

### 相关文档
- Sync SOP: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
- Mailbox: `docs/mailbox/2026-03-21-baseline-sync-gate-review-request.md`
