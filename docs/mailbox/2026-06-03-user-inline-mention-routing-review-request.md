---
doc_kind: mailbox
topics: [review, routing, mention-parser]
created: 2026-06-03
---

# Review Request: User Inline Mention Routing Fix

Review-Target-ID: fix-user-inline-mention-routing
Branch: fix/user-inline-mention-routing

## What

修复用户消息里的 inline `@codex` 被当成 inert text，随后 fallback 到上一只活跃猫的问题。

- `AgentRouter.parseMentionsRaw` 现在对用户输入接受正文任意位置的显式 `@句柄`
- 猫猫 A2A / callback 出站仍走 `a2a-mentions.ts` 的 line-start 规则，不改变传球协议
- 保留结构排除：fenced code、blockquote、quoted pasted commands、email / URL-like token 不触发用户路由
- `f32b-mention-parsing.test.js` 增加用户 inline 正例、排序正例、email 负例

## Why

铲屎官在普通用户消息中写 `@codex`，期望直接召唤砚砚；当前实现把用户消息和猫猫出站 route-line DSL 混在一起，导致 `@codex` 未解析，随后 fallback 到宪宪 / 上一只活跃猫。

## Original Requirements

> "最重要的是路由路由错了！！ 他这是把要给你的路由fallback到宪宪了！！"
> "那你赶紧按照sop走流程？ 搞起来？ 找47/48review一下"

- 来源：当前 thread 导航消息，2026-06-03 03:47 / 03:58 America/Los_Angeles
- 请对照上面的摘录判断：用户自然语言 inline `@codex` 是否不再 fallback 到其他猫，同时猫猫 A2A 行首规则是否仍保持。

## Tradeoff

没有引入语义 intent 分类器。修复只基于结构边界：

- 用户输入层：任意正文 `@句柄` 是显式召唤
- 猫猫出站层：仍必须行首 `@句柄` 才是球权转移
- quoted pasted commands 用引号左边界排除，避免恢复今天早上的 zombie startup 原 bug

## Architecture Ownership

Architecture cell: dispatch
Map delta: none
Why: 修改现有 `AgentRouter` mention parser 的输入语法边界；没有新增 Store / Queue / Router / Adapter / Dispatcher / Binding。

请 reviewer 检查：

- diff 是否与 `Map delta: none` 一致
- 用户输入路由和猫猫 A2A 出站路由是否被正确分层
- quoted / email / URL-like 排除是否足够机械，未滑向语义分类器

## Review Round 1 Fixes

Reviewer: 宪宪 / Opus-47  
Verdict: APPROVE with P2 nits; P2 nits fixed before merge-gate.

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P2-1 | `recordResolvedMention` position-min branch unreachable | ✅ 删除 dead branch | existing ordering tests stay green |
| P2-2 | CRLF blockquote exclusion used split offset approximation | ✅ 改为 `matchAll(/^[ \t]*>[^\n]*/gm)` true index | new CRLF blockquote test FAIL → PASS |
| P2-3 | Single-backtick inline code was not excluded | ✅ add inline-code exclusion span | new inline-code test FAIL → PASS |

Failure-mode sweep: all three are independent mechanical boundary / cleanup issues, not repeated same-class misses. No additional sibling call sites beyond `buildMentionExclusionSpans` and `recordResolvedMention`.

## Cloud Review Round 2 Fixes

Reviewer: Cloud Codex
Verdict: COMMENTED with P2; P2 fixed before merge.

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P2-4 | Domain-suffixed handles like `张三@codex.com` / `dev+@codex.com` could resolve `@codex` | ✅ handle 后 `.` + letter/number 不再是 mention boundary | new domain-suffix test FAIL → PASS |

Failure-mode sweep: this is the same class as email-like boundary protection, so the fix is placed at `isMentionEndBoundary` rather than adding another fallback layer in candidate scanning. Existing user inline positive, email negative, inline-code negative, CRLF blockquote negative, and A2A targeted regressions stay green.

## Cloud Review Round 3 Fixes

Reviewer: Cloud Codex
Verdict: COMMENTED with P1 + P2; both fixed before merge.

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P1-5 | Quoted prose like `他说：“请 @codex 看看”` could still route because only immediate quote-before-mention was excluded | ✅ common paired quote spans now join fenced code / inline code / blockquote exclusion spans | new quoted-prose test FAIL → PASS |
| P2-6 | Domain-suffixed known aliases no longer routed, but still emitted `cat_not_found` warnings for `codex.com` | ✅ known-alias + domain suffix is skipped before unknown-handle warning fallback | domain-suffix test extended with `routing_warnings=[]` FAIL → PASS |

Failure-mode sweep: both issues are mechanical boundary leaks in the same user-input parser surface. The fix stays in `buildMentionExclusionSpans` / mention-pattern warning guard; A2A parsing remains isolated in `a2a-mentions.ts`.

## Cloud Review Round 4 Fixes

Reviewer: Cloud Codex
Verdict: COMMENTED with two P2s; both fixed before merge.

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P2-7 | Bare URL paths like `github.com/@codex/repo` could route `@codex` because URL detection only covered `://` / `www.` | ✅ bare domain URL prefixes before `@` are treated as URL-like inert tokens | new bare-URL-path test FAIL → PASS |
| P2-8 | Domain-like unknown handles like `张三@ghostcat.com` could emit noisy `cat_not_found ghostcat.com` warnings | ✅ `@unknown.tld` shape is treated as domain-like text, while plain `@unknown` still warns | domain-suffix warning test extended FAIL → PASS |

Failure-mode sweep: same class as Round 2/3 boundary misses: URL/domain-like prose must not create routing side effects. Audit scope checked `isUrlishMentionToken`, `hasDomainSuffixedMentionPatternAt`, and `recordUnknownMentionWarning`; fix stays in those structural parser guards and does not touch A2A line-start parsing.

## Cloud Review Round 5 Fixes

Reviewer: Cloud Codex
Verdict: COMMENTED with one P2; fixed before merge.

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P2-9 | Fullwidth-wrapped bare URLs like `（github.com/@codex/repo）` could bypass URL-prefix detection because the old scan used whitespace token start | ✅ bare domain URL detection now checks whether the text before `@` ends with a domain/path prefix, independent of Chinese prose or opening wrappers | bare-URL-path test extended with fullwidth bracket cases FAIL → PASS |

Failure-mode sweep: same class as Round 4 P2-7, not a new parser layer. The invariant is "URL/domain-like prose must not create routing side effects." Audit expanded the bare URL test matrix to fullwidth parentheses, fullwidth square brackets, and wrapped `www.` paths; A2A line-start parsing remains untouched.

## Cloud Review Round 6 Fixes

Reviewer: Cloud Codex
Verdict: COMMENTED with one P2; fixed before merge.

| # | 问题 | 状态 | Red→Green |
|---|------|------|-----------|
| P2-10 | Straight-single quoted prose like `他说 'please @codex review this'` could still route because only double/smart/CJK quote spans were paired | ✅ straight-single quoted spans are excluded with delimiter-aware matching, while word apostrophes still allow real inline mentions | quoted-prose test extended FAIL → PASS; apostrophe positive sanity PASS |

Failure-mode sweep: same quoted-prose invariant as Round 3 P1-5. The fix is structural and local to `buildMentionExclusionSpans`; it does not add A2A behavior. Delimiter-aware matching avoids treating contractions/possessives as quote spans.

## Open Questions

### 技术 OQ

1. `QUOTE_BEFORE_MENTION_RE` 排除 quoted pasted commands 是否太宽，会不会误杀用户写 `"请看 @codex"` 这种真实召唤？
2. URL/email 误触发现在覆盖 `://`、`www.`、bare domain path、known/unknown domain-suffixed handles；仍刻意保持结构规则，不做语义分类器。
3. 是否需要把用户 mention parser 和 A2A route-line parser 的函数命名再进一步显式化，降低未来混用概率？

### 价值 OQ

无。

## Next Action

请 47 做 peer review，重点看 routing 语义边界和回归测试覆盖。若 47 不方便，48 可接。

## Review Sandbox

- Path: `/tmp/cat-cafe-review/fix-user-inline-mention-routing/opus47`
- Start Command: `pnpm review:start`（或只读 diff review；本改动不需要浏览器）
- Ports: 不需要启动服务；如 reviewer 需要启动，禁止使用 3001/3002/3011/3012/4111

## 自检证据

### Quality Gate

- Vision: 用户 inline `@codex` 不再 fallback 到上一只活跃猫；猫猫 A2A line-start 规则保持
- Dogfood: `router.resolveTargetsAndIntent('... @codex ...')` 在 thread fallback 存在 `opus` 时返回 `targetCats=["codex"]`
- Hotfix pattern: no hotfix keywords; `hotfix=false`
- Fallback layer: final script reports `+2 -1 (net +1)` in `AgentRouter.ts`; cumulative historical total still triggers self-check
- Architecture ownership: warning-only 脚本 exit 0；diff architecture nouns OK；既有 stale/unknown doc warnings 与本改动无关
- Artifact hygiene: 根目录媒体工件检查无输出
- Gate unblock: latest `origin/main` had F221 marked `done` in `docs/features/F221-taste-lane.md` while still listed active in `docs/BACKLOG.md`; fixed directly on main in `8661b392f` per shared-state rules, then rebased this PR. No parser behavior delta.

### Fallback Coordinate Self-Check

1. 修坐标系还是补错误坐标系？  
   修坐标系。当前 bug 的根因是把两个坐标系混用：用户输入召唤 vs 猫猫 A2A 出站传球。本改动明确拆开两套 parser 语义。
2. 坐标变换能否消除这些层？  
   已做：用户 parser 用结构候选扫描，A2A 继续用 line-start parser；后续 cloud P2 继续收敛在 URL/domain-like token 坐标边界，而不是加语义 fallback。
3. 每层为什么不能去掉？  
   本轮净增 1 层来自同一 parser 文件的机械边界守卫；脚本额外触发主要来自 `AgentRouter.ts` 历史累计层数。现有历史层不在本 bugfix scope，review focus 是本 diff 是否继续混淆用户召唤和 A2A 传球坐标系；当前没有。

### 测试结果

```bash
pnpm --filter @cat-cafe/api build
# exit 0

node --test packages/api/test/f32b-mention-parsing.test.js
# 22 pass, 0 fail

node --test --test-name-pattern 'A2A|non-line-start|line-start mention' packages/api/test/route-strategies.test.js
# 23 pass, 0 fail

pnpm exec biome check packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts packages/api/test/f32b-mention-parsing.test.js
# exit 0; existing AgentRouter complexity warnings only

node --test packages/api/test/messages-delivery-mode.test.js
# 21 pass, 0 fail

node scripts/check-fallback-layers.mjs
# exit 0; AgentRouter.ts +2 -1 (net +1), historical cumulative warning only

pnpm check:architecture-ownership
# exit 0; warning-only known stale/unknown docs
```

完整 `route-strategies.test.js` 当前 99/100 pass，唯一失败是既有 bootcamp context `members=1` 断言，与本次 parser 改动无关；上面的 A2A routing targeted 回归全绿。

### Dogfood Output

```json
{
  "targetCats": ["codex"],
  "hasMentions": true,
  "intent": "execute"
}
```

### Related Files

- `packages/api/src/domains/cats/services/agents/routing/AgentRouter.ts`
- `packages/api/test/f32b-mention-parsing.test.js`
