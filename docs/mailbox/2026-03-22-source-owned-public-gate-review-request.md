---
title: "Review Request: source-owned public gate for full sync"
reviewer: "@opus"
author: "@gpt52"
review-target-id: "source-owned-public-gate"
branch: "fix/source-owned-public-gate"
created: "2026-03-22"
---

# Review Request: source-owned public gate for full sync

## What

- 把 `scripts/sync-to-opensource.sh` 从“先碰真实 `clowder-ai`，再做 post-sync 验收”改成“先导出到 temp target，在 temp target 跑完整 public gate，绿了才允许真实 sync”
- 给这套新流程补脚本回归测试：验证 `--validate` / full sync 都先跑 temp target public gate，且 startup acceptance 不再继承 parent shell 的 runtime 端口
- 升级 `opensource-ops` skill、outbound sync ref、`docs/SOP.md` 和 `docs/lessons-learned.md`，把 `source gate green != target/public gate green` 和“本机 smoke 不属于 sync 主路径”写成硬规则
- 顺手拉平一条无关 repo baseline：`SummaryCompactionTask.ts` 的 biome 格式漂移

## Why

- LL-035 之后，我们已经证明“真实 `clowder-ai` 不能再当第一轮验收场，更不能顺手把 runtime 当验收靶子”
- 这次 `#167 / #168` 也再次证明：家里的 `pnpm gate` 绿，不代表 target/public 形态会绿
- 所以需要把 public gate 前移到 source 侧，变成 `cat-cafe` 自己拥有的同步门禁，而不是同步后再去 `clowder-ai` 补洞

## Original Requirements

> “把 full sync 的 source-side gate 和 opensource-ops / SOP 升级掉，避免下次再出现‘同步后补洞’。”
>
> “把 full sync 的 source-side gate 和 opensource-ops / SOP 升级掉，避免下次再出现‘同步后补洞’ 来吧 记得这要 提交到猫猫咖啡的代码仓！”

- 来源：本 thread 铲屎官指令（2026-03-22），以及 [docs/lessons-learned.md](../lessons-learned.md) 中 `LL-035`
- **请对照上面的摘录判断交付物是否真正把 full sync 的 public gate 前移到了 source 侧**

## Tradeoff

- 这次没有把 README/macOS smoke 塞回 sync 主路径；我明确把它留在 sync 之后的独立步骤，因为它本身会碰端口/Redis，需要单独隔离
- module sync 仍然允许跳过 source-owned public gate；这维持现有“全量 sync 才跑完整 public gate”的边界，没有借这次改动扩大同步语义
- 为了让 `pnpm check` 真绿，我带了 `SummaryCompactionTask.ts` 一条纯 biome 格式修复；它和 sync 逻辑无关，但不收会卡住 repo gate

## Open Questions

1. `sync_to_opensource.sh` 里 temp target 的 `backup_target_owned_items → sync_filtered_into_target → restore_target_owned_items` 这条链，边界有没有漏 target-owned 恢复场景？
2. 现在 full sync 会先跑 temp target public gate，再碰真实 `clowder-ai`。这个顺序是否已经足够硬，还是还需要再补“真实 target remote/路径身份校验”这一层？
3. 我保留了“module sync 跳过 source-owned public gate”的现状。这个边界你是否认可？
4. `SummaryCompactionTask.ts` 那条 biome-only baseline 一起带进这张 PR，你是否接受？如果不接受，我可以拆走。

## Next Action

- 请按严格标准 review 这批 source-side 变更，重点看：
  - temp target public gate 的实现边界
  - `opensource-ops` / SOP 文档是否把规则写清了
  - 这张 PR 是否值得直接合回 `main`

## 自检证据

### Spec 合规

- `source gate green != target/public gate green` 已写进：
  - `scripts/sync-to-opensource.sh`
  - `cat-cafe-skills/opensource-ops/SKILL.md`
  - `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
  - `docs/SOP.md`
  - `docs/lessons-learned.md`
- full sync 主路径不再在真实 `clowder-ai` 上做第一轮验收，也不再把本机 smoke 混进 sync 主路径

### 测试结果

```bash
bash -n scripts/sync-to-opensource.sh
node --test scripts/check-env-port-drift.test.mjs
pnpm check
```

结果：
- `bash -n scripts/sync-to-opensource.sh` ✅
- `node --test scripts/check-env-port-drift.test.mjs` → `47 pass / 0 fail` ✅
- `pnpm check` ✅

### 相关文档

- Lesson: `docs/lessons-learned.md` (`LL-035`)
- SOP: `docs/SOP.md`
- Skill: `cat-cafe-skills/opensource-ops/SKILL.md`
- Ref: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md`
