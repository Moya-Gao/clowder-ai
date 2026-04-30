# Review Request: F180 AC-D4 outbound sync public gate repair

Review-Target-ID: fix-public-skill-manifest-next
Branch: fix/public-skill-manifest-next

## What

修复 F180 AC-D4 outbound sync 在 source-owned public gate 阶段的两个阻塞：

- public `cat-cafe-skills/manifest.yaml` 隐藏 `opensource-ops` skill 后，清理 `next` 数组里遗留的 `"opensource-ops"` dangling reference。
- `sync-manifest.yaml` 导出 root `package.json` 已引用的 `scripts/check-followup-tails.mjs`，避免 open-source temp target 缺脚本。

## Why

F180 Phase D 已合入后，执行 AC-D4 outbound sync 前先跑 `scripts/sync-to-opensource.sh --validate --yes`。首次从 main 验证失败，但脚本明确停在 source-owned public gate，真实 open-source target 未被写入。失败点不是 F180 UI 本身，而是同步管道已有 public surface drift：一个 manifest dangling reference，一个 root package script 未导出。

## Original Requirements

> "不过你这里主要聚焦完成这个 issue"
> "诶嘿？ 原来弹幕你在干活啊！我以为你挂了 你继续？"

- 来源：当前 F180 AC-D4 协作线程 / 铲屎官对 AC-D4 继续推进的指令
- **请对照上面的摘录判断：本 patch 是否让 AC-D4 outbound sync 能继续，而不是绕开 public gate。**

## Tradeoff

没有直接绕过 public gate，也没有手动改 `/tmp/clowder-ai-f180-acd4-sync`。先修源仓同步规则，保持 outbound sync 的安全门禁有效。

`opensource-ops` 仍然不导出到开源仓；本 patch 只删除 public manifest 中指向它的 dangling `next` reference。

## Open Questions

1. `_sanitize-rules.pl` 对 inline YAML `next` 数组移除 `"opensource-ops"` 的规则是否足够窄，不会误删其它 public skill link？
2. `check-followup-tails.mjs` 加入 `managed_scripts` 是否是正确出口，而不是应该从 public `package.json` 移除该 check？
3. 这条修复是否可在 review 后合入 main，然后重新执行 F180 AC-D4 outbound sync？

## Next Action

请做 code review。若 LGTM，我会走 merge gate 合入 main，然后从更新后的 main 重新跑 F180 AC-D4 outbound sync 到 clean `/tmp/clowder-ai-f180-acd4-sync`。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-public-skill-manifest-next/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`

## 自检证据

### Spec 合规

- F180 AC-D4 outbound sync 继续走 source-owned public gate，没有跳过 security scan / public check / smoke test / startup acceptance。
- 真实 target `/tmp/clowder-ai-f180-acd4-sync` 在验证失败与修复验证期间保持 clean。

### 测试结果

```bash
node --test scripts/sanitize-rules-regression.test.mjs --test-name-pattern 'public skill manifest'
# pass

node --test scripts/check-env-port-drift.test.mjs --test-name-pattern 'root package check script targets'
# pass

pnpm check
# pass

CLOWDER_AI_DIR=/tmp/clowder-ai-f180-acd4-sync bash scripts/sync-to-opensource.sh --dry-run
# pass; includes scripts/check-followup-tails.mjs; included_file_count=2973

CLOWDER_AI_DIR=/tmp/clowder-ai-f180-acd4-sync bash scripts/sync-to-opensource.sh --validate --yes
# pass; public smoke test fail=0; startup acceptance API 3004 + web 3003 passed; port verification passed
```

### 相关文档

- Feature: `docs/features/F180-agent-cli-hook-health.md`
- Outbound manifest: `sync-manifest.yaml`
- Sanitizer: `scripts/_sanitize-rules.pl`
