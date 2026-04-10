# Review Request: intake clowder-ai#405 persistence guardrails

## What
把 `clowder-ai#405` 的三处规则/skill 改动 hand-port 回家里：
- `shared-rules` 增加 `Write/Edit ≠ 持久化`
- `deep-research` 增加交接前持久化调研产出
- `merge-gate` Step 8 改为 dirty-tree fail-closed，明确禁止即兴 `git stash -u`

## Why
这组改动对我们家是正收益：它把“共享工作目录里 write 不等于安全保留”“清理前先 fail-closed”变成了显式规则，能直接降低误清理未提交产物的风险。

## Original Requirements
> “哪你要是觉得ok 对我们家有好处就合入然后intake回家？”
- 来源：当前 thread（2026-04-10 铲屎官指令，未单独落盘到 `docs/discussions/`）
- 请对照上面的摘录判断：这次 intake 是否确实把有价值的 guardrails 回流到了家里的真相源，而不是只在开源仓停留

## Tradeoff
没有把 incident 细节或日期带回家，只回流蒸馏后的规则和 workflow 护栏，避免把外部事故叙事污染我们的规则层。

## Open Questions
- `shared-rules` 里这段“共享工作目录中禁止对 untracked 文件做破坏性清理”是否需要再压缩措辞，还是现在这个粒度刚好？
- `merge-gate` 的 fail-closed 文案是否足够明确，能让执行猫第一眼就知道“停，不要 stash -u”？

## Next Action
请按 intake reviewer 视角检查 `cat-cafe#1053`：
- 逐文件对照 `cat-cafe#1052` 的决策表
- 确认三处 hand-port 与 `clowder-ai#405` 行为等价
- 若无 P1/P2，给 formal review 放行

## 自检证据

### Spec 合规
- Source PR: `clowder-ai#405`
- Intake Intent Issue: `cat-cafe#1052`
- `bash scripts/intake-from-opensource.sh --pr 405 --mode=plan` → `manual-port (3 files)`，与本次回流范围完全一致
- 无 brand-sensitive 文件，未触发 inbound brand guard

### 测试结果
- `git diff --check origin/main...HEAD` → clean
- `pnpm check` → pass
- `env -u REDIS_URL -u CAT_CAFE_REDIS_TEST_ISOLATED pnpm test` → pass

### 相关文档
- Intake Intent Issue: `cat-cafe#1052`
- Source PR: `clowder-ai#405`
- Cat-cafe PR: `cat-cafe#1053`
- Review-Target-ID: `intake-clowder-405`
- Branch: `fix/intake-clowder-405`
