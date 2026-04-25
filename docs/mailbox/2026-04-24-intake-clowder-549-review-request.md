# Review Request: intake(clowder-ai#549): absorb F159 Phase E SSE streaming

Review-Target-ID: fix-intake-clowder-549
Branch: fix/intake-clowder-549

## What
- absorb `clowder-ai#549` into `cat-cafe#1390`
- bring home the 7 safe-classified CatAgent Phase E files from upstream merge commit `16ddb676`
- sync the home truth source for F159 Phase E and regenerate `docs/features/index.json`

## Why
- maintainer side already merged `clowder-ai#549`; this is the home-side `absorbed` intake leg
- the risky part here is not brand/manual-port, but **intake completeness**: source behavior must come home without regressing our existing CatAgent provider invariants
- `cat-cafe#1389` is the file-level intent source; this review should check issue table vs final PR diff, not just “tests are green”

## Original Requirements（必填）
> “所以 maintainer 口径现在是：可以放行 merge；merge 后按 absorbed intake 回家。”
> “那你走intake 回家的流程吧，merge 然后读sop 走流程回家”
> “记得一定要好好看看intake skills… 每次 intake都会有各种错误”
- 来源：当前线程 + `cat-cafe#1389`
- **请对照上面的摘录判断交付物是否真的把 `clowder-ai#549` 按 absorbed 流程带回家，而不是只做了 record / 只抄了 patch**

## Tradeoff
- 没有额外引入“更通用”的 provider stream abstraction；保持这次 intake 只吸收 upstream 已合入的 F159 Phase E slice
- 真相源只补 F159 feature doc + generated index，没有顺手改 BACKLOG，避免把共享状态扩到本轮 absorb 之外

## Open Questions
1. `cat-cafe#1390` 的最终文件集合是否严格落在 `cat-cafe#1389` 的 7 个 source 文件 + 2 个 exception（`F159` spec / `docs/features/index.json`）之内？
2. `CatAgentService.ts` / parser / tests 的 home-side behavior 是否完整覆盖 upstream Phase E intent，并且没有回退我们现有的 provider contract（尤其 `error + done`、strict fail-closed、tool loop 终态）？
3. 当前 HEAD `a131da1ac6bd93ea973d8320f9eba19202015a22` 是否被你的 review 明确覆盖？如果后面 HEAD 再变，请显式说明是延续还是重审。

## Next Action
- 请直接 review `cat-cafe#1390`，并在 GitHub PR 页面留 formal review comment
- comment 里请显式写出你 review 覆盖的 HEAD SHA（当前是 `a131da1ac6bd93ea973d8320f9eba19202015a22`）
- 通过后我再执行 `--record` + `--advance-ledger`

## Review Sandbox（必填）
- Path: `/tmp/cat-cafe-review/fix-intake-clowder-549/opus-47`
- Start Command: `pnpm review:start`
- Ports: `web=3201`, `api=3202`（默认对；若被占用会自动按 +2 递增）

## 自检证据

### Spec 合规
- Intake intent issue：`cat-cafe#1389`
- absorb PR：`cat-cafe#1390`
- source PR：`clowder-ai#549`（已 merged）
- home truth source 已补：`docs/features/F159-catagent-native-provider.md` Phase E / AC-E1~E5 / KD-6 / timeline / links
- generated follow-up 已补：`docs/features/index.json`
- Brand Guard：`bash scripts/intake-from-opensource.sh --validate-inbound` → `No brand violations detected`
- Artifact Hygiene：
  - `git status --short | rg '^.. [^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无
  - `git diff --name-only origin/main...HEAD | rg '^[^/]+\\.(png|jpe?g|webp|gif|webm|mp4|mov|wav|pdf|pen)$'` → 无

### 测试结果
- `pnpm --filter @cat-cafe/api run build` → 成功
- `bash ./scripts/with-test-home.sh node --test test/catagent-phase-d.test.js test/catagent-phase-e.test.js test/catagent-provider.test.js test/catagent-stream-parser.test.js` → `60 passed, 0 failed`
- `pnpm check` → 成功

### 相关文档
- Intent Issue: `cat-cafe#1389`
- Absorb PR: `cat-cafe#1390`
- Feature: `docs/features/F159-catagent-native-provider.md`
- Decision: `docs/decisions/001-agent-invocation-approach.md`
