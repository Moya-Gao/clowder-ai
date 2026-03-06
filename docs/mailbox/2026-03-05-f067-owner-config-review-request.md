# Review Request: F067 Owner Config — configurable @mention identity for 铲屎官

## What
让 `@user`/`@铲屎官` 变为可配置的 owner 身份。现在猫猫知道铲屎官叫 Landy，可以用 `@landy`、`@lysander`、`@l.s.` 来 @ 铲屎官。开源后其他用户也可以配置自己的名字和句柄。

核心变更（9 files, +118/-6）：
1. `cat-config.json` — 新增 `owner` 配置块
2. `shared/types/cat-breed.ts` — 新增 `OwnerConfig` 类型
3. `cat-config-loader.ts` — owner schema + `getOwnerConfig()` + `getOwnerMentionPatterns()`
4. `user-mention.ts` — 从 config 读 patterns，不再硬编码（@user/@铲屎官 作为 fallback 始终保留）
5. `SystemPromptBuilder.ts` — 用 owner name + handles 告诉猫如何 @ 铲屎官
6. `BrainstormMode.ts` — 新增 `detectUserMention()` 检测 mid-chain break

## Why
F057-C2 实现了 `@user` 检测，但 SystemPromptBuilder 从未告诉猫这个能力——猫根本不知道可以 @ 铲屎官。铲屎官发现后要求：(1) 修 prompt gap，(2) 可配置化，叫名字不叫 @user。

## Original Requirements（必填）
> @opus 我希望是可配置的，我不要叫user 或者铲屎官 我叫Landy （昵称） /L.S./ Lysander 我们是伙伴 叫user 太奇怪了！所以我们应该是可配置的？ 默认就是 我自己现在告诉你的这三个 你们也这样喊我，然后如果未来开源其他人也可以配置他们的

- 来源：Thread 实时对话，2026-03-05
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 保留 `@user`/`@铲屎官` 作为 backward-compat fallback，即使配置了新 patterns，旧的仍能被检测
- Owner 放在 V2 config 里作为 optional 字段，V1 config 不支持（返回默认 @user/@铲屎官）
- BrainstormMode 的 `includes('@铲屎官')` 保留（mid-line 检测），叠加 `detectUserMention()` 覆盖新 patterns

## Open Questions
1. **token boundary**: `@l.s.` 末尾有 `.`，CONTINUATION_RE 不会 reject（只 reject ASCII letter/digit/underscore），是否需要额外处理？当前行为是正确的（`@l.s.` 可以匹配）
2. **前端 mention-highlight**: `@landy` 在消息中不会高亮（highlight 那边还没改），是否需要一起做？

## Next Action
请 review 这 9 个文件，确认：
- Schema 设计合理（owner 放 V2 config optional）
- Backward compat 没漏洞（旧 patterns 始终保留）
- Prompt 文案自然（猫看到 "Landy（铲屎官）" 合理）
- 测试覆盖充分

## 自检证据

### Spec 合规
- 铲屎官需求 ✅：可配置 owner name + aliases + mentionPatterns
- 默认 patterns ✅：@landy / @l.s. / @lysander
- Backward compat ✅：@user / @铲屎官 始终作为 fallback
- Prompt 告知 ✅：SystemPromptBuilder 输出含 owner handles

### 测试结果
- user-mention: 23 passed, 0 failed（含 5 new）
- system-prompt-builder: 57 passed, 0 failed（含 1 new）
- cat-config-loader: 61 passed, 0 failed
- Full API: 2782 tests, 2666 pass, 5 fail（全部 pre-existing: Redis drills + Dare env）
- pnpm lint: ✅ 通过
- pnpm check: pre-existing errors only, 0 in our files

### 相关文档
- Related: F057 Thread 可发现性（历史来源：F057-C2 实现了 @user 检测）
- Current: F067（本次实现：owner 可配置化 + prompt 告知）
- Plan: 无独立 plan（改动较小）
