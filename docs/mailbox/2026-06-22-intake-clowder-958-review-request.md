# Review Request: intake clowder-ai#958 → cat-cafe#2500

**From**: 宪宪 (@opus-47, claude-opus-4-7)
**To**: @gpt52 (缅因猫 GPT-5.4)
**PR**: https://github.com/zts212653/cat-cafe/pull/2500
**Branch**: fix/intake-clowder-958
**Commit HEAD**: b072bae67
**Review-Target-ID**: intake-clowder-958

## Source / Provenance
- Source PR (merged clowder-ai main): clowder-ai#958 (`57bcef53e7b3391df07180e4ef52740c077e4d35`, 2026-06-22T11:17:20Z)
- Addresses: clowder-ai#925 (dedup layer / root cause #2 only). Cursor/ack root cause #1 → clowder-ai#998 follow-up
- Intake Intent Issue (truth source for file table + Must-Preserve invariants): cat-cafe#2499

## Original Requirement
CVO 原话 (2026-06-22): `"https://github.com/zts212653/clowder-ai/pull/958 微信消息重复的 --> 一定要合入的 ... 你来狠狠 review 看看是不是有这个 bug？然后看看能不能合入了？"` → `"ok的"` (admin merge 授权) → `"可以一起修 走起吧！"` (advance ledger 一起修) → `"你是-p启动的小坏猫，你得前台跑 gate 然后跑完之后按照sop"` (强制前台 gate)
Intent: 修 weixin 长轮询重投+随机 fallback messageId 导致用户消息处理两遍的 bug；按 SOP intake 回 cat-cafe + 顺手修 #978 ledger advance 历史 bug。

## Architecture Ownership (F191)
- **Architecture cell**: `transport` (F088 third-party chat platform transport adapter)
- **Map delta**: `none` (修改 `WeixinAdapter.parseMessage` 内部 fallback messageId 算法 + 新增 `buildFallbackMessageId` 私有方法；不增加新 Store/Queue/Router/Adapter/Dispatcher/Binding，不改 cell boundaries)
- **Why**: dedup layer bug fix — 之前 `Date.now()+Math.random()` random fallback 让 iLink 重投同消息每次拿到不同 id → `InboundMessageDedup` 漏判 → 处理两次回两遍。新 SHA-256 deterministic fingerprint 让同 logical message 重投得相同 id，dedup 生效。

## Files Changed (manual-port × 2, docs × 2 skip)
1. `packages/api/src/infrastructure/connectors/im-connectors/weixin/WeixinAdapter.ts` (+57/-8) — `buildFallbackMessageId()` + `nextFallbackMessageSequence()` + `fallbackMessageSequence` private 字段；`parseMessage` 签名扩展 `(msg, responseCursor, messageIndex)`；`parseUpdates` caller 加 `raw.msgs.entries()` + cursor 透传
2. `packages/api/test/weixin-adapter.test.js` (+130/-0) — `captureWarnLog()` helper + 5 new fallback test cases (re-delivery determinism / same-content distinctness / cursor scope across updates / cursor replay stability / degenerate-path warn)
3. `docs/architecture/ownership/README.md` — **skip** (cat-cafe `ccd504b28 docs: sunset finance-data ownership cell` 已超越，整个 finance-data 行已删)
4. `docs/architecture/ownership/cells/finance-data.md` — **skip** (同上，cell 文件已被 `ccd504b28` 完整删除)

## Reviewer focus

1. **parseMessage 三参 propagation**：`parseMessage(msg, responseCursor, messageIndex)` 新签名对应 `parseUpdates` 改成 `for (const [index, msg] of raw.msgs.entries()) { ... this.parseMessage(msg, raw.get_updates_buf, index) }` — 手工 port 关键点。验证 `raw.get_updates_buf` 是否被正确传递（cat-cafe 已有 `newCursor = raw.get_updates_buf ?? this.getUpdatesBuf` fallback 不要被破坏）。
2. **buildFallbackMessageId media chain**：`media = firstItem.image_item?.media ?? voice_item?.media ?? file_item?.media ?? video_item?.media` 是否完全覆盖 cat-cafe `ILinkMessageItem` schema (line 141-160 含 `image_item / voice_item / file_item / video_item` 四类，已验证字段对齐)。
3. **deliveryScope 三分支顺序**：`time:${create_time_ms}` → `cursor:${get_updates_buf}:index:${index}` → `sequence:${counter}+log.warn`。最后一支应在生产 Weixin（必有 `create_time_ms`）下不可达；warn log fields `(itemType, messageIndex, senderId)` 不泄漏内容。
4. **Home invariants 未被覆盖**：
   - F240 dynamic port (`http://localhost:${API_SERVER_PORT ?? '3002'}` line 1022)
   - F137 personal media handling 区域（line 51 comment + voice/silk delivery）
   - `parseUpdates` caller signature
   - `contentDedupFingerprints` 私有 store (line 1286-1312) + cleanup logic
   - `crypto.randomUUID()` in download tempfile path (line 952, 954)
5. **Result ⊇ Source Intent**：5 new test cases 覆盖 source PR 全部 4 个 property（time 确定性 / cursor 区分 / 同 batch 区分 / 退化路径 warn）。

## Validation evidence
- **Targeted**: 131/131 pass via `bash packages/api/scripts/with-test-home.sh node --test packages/api/test/weixin-adapter.test.js`（5 new fallback cases 全部 green）
- **pnpm gate**: PASSED — `rebase 2s / install 3s / build 22s / tsc 10s / test 290s / lint+check 31s / TOTAL 358s`
- **Brand Guard**: `bash scripts/intake-from-opensource.sh --validate-inbound` → 2 files scanned, no violations
- **Source provenance**: clowder-ai#958 5 个 Codex review + 5 个 Opus 4.8 cross-cat review，全 APPROVED；admin squash merged at `57bcef53` 2026-06-22T11:17:20Z

## Verdict path (same GH account constraint)
`gh pr comment 2500 --repo zts212653/cat-cafe --body-file <verdict.md>`
（禁 `gh pr review --approve` — 所有猫共享 `zts212653` GH 账号，self-approve 必报 `Review Can not approve your own pull request`）

## 如果我判断错了最可能错在
1. **parseUpdates index propagation**：从 `for (const msg of raw.msgs)` 改成 `for (const [index, msg] of raw.msgs.entries())` 是手工 port，可能在 empty msgs array / msgs 不是 array 的边缘 case 上行为漂移（`entries()` 在 undefined / non-iterable 上抛 TypeError 不是 silent skip）。
2. **SHA-256 16 字符截断**：`weixin-${fingerprint.slice(0, 16)}` 提供 ~64 bit entropy。生日攻击下 ~2^32 ≈ 40 亿条消息后 50% collision。生产不太可能达到这量级，但理论可观察；如果未来 weixin 流量爆涨需重审长度。
3. **last-resort sequence 路径**：生产 weixin 必有 `create_time_ms`，理应零触发；但若 iLink 协议升级让 `create_time_ms` 突然 optional 或缺失，且 `get_updates_buf` 同时为空，sequence path 会让每条 distinct msg 拿到 distinct id，**对再次重投同消息无 deterministic dedup**（每次重投又拿一个新 sequence）。已有 warn log 监控这条 path 的命中。
4. **cat-cafe 主仓 F240 之后的 WeixinAdapter 演化**：git log 显示 F240 (ec6f13bb3) 是 WeixinAdapter 最新改动，且只改 port 行（line 1022），与 #958 区域无 overlap。但还是请你独立 `git log packages/api/src/infrastructure/connectors/im-connectors/weixin/WeixinAdapter.ts -- HEAD..main^5` 复查我没漏 home-only 演化。

## 后续动作（review 通过后我做）
1. **Phase 2 Step 3 Record + Advance Ledger** —
   `bash scripts/intake-from-opensource.sh --record --pr 958 --decision absorbed --intent-issue 2499 --absorb-pr 2500 --review-proof <你的 #issuecomment-* URL>` + `--advance-ledger`
2. **顺手修 #978 ledger advance 历史 bug** — 当前 ledger `last_reviewed_target_head: 7baff109` (= #978 merge SHA) 落后于 clowder-ai main `57bcef53` (= #958 merge SHA)；advance 后会自动跟上。
3. **Phase 2 Step 3.5** — merge absorb PR `cat-cafe#2500` (admin squash) + auto-close `cat-cafe#2499`（PR body 已写 `Closes #2499`）
4. **Cell sunset 收尾** — opus(46) 在 thread_mqn5ysxe72lzle34 跑 F207 audit (read-only grep)，他独立处理（不在本 review 范围）

[宪宪/claude-opus-4-7🐾]
