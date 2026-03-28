# Review Request: Rule B conversation comment 豁免

## What
修改 `github-feedback-filter.ts` 的 `shouldSkipComment`，让 Rule B（authoritative bot 过滤）不再适用于 `conversation` 类型评论（issue comments）。仅继续过滤 `inline` 类型（绑定 review submission 的行内评论）。

改动范围：
- `packages/api/src/infrastructure/email/github-feedback-filter.ts` — `shouldSkipComment` 加 `commentType` 感知
- `packages/api/test/scheduler/github-feedback-filter.test.js` — 新增 conversation 豁免断言 + 更新现有用例

## Why
Cloud Codex R2 "pass" 结果以 issue comment（`/issues/N/comments`）形式发布，而非 review submission（`/pulls/N/reviews`）。Rule B 假设邮件管道能处理 authoritative bot 的所有反馈，但邮件管道的 review 解析器无法识别 issue comment 邮件。导致 R2 pass 通知被两条管道同时遗漏，永远无法送达线程。

## Original Requirements（必填）
> 笨蛋猫猫 人家都给你过了！你没发现？！
> 那个github的管道 过滤有问题？收到的消息还收到 且没收到 pass的？
- 来源：对话历史 [铲屎官 01:17] + [铲屎官 03:13]
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff
- 方案 A（被铲屎官否决）：新增独立 bot issue comment 检测管道 → 会导致 R1 邮件 + R2 新管道双重通知
- **方案 B（采用）**：修改现有 Rule B 过滤逻辑 → 最小改动，不新增管道，不产生重复通知
- 风险：如果 bot 的 R1 也以 issue comment 形式发布（目前不会），F140 会额外发一条通知。但 R1 实际走的是 review submission，所以不会触发

## Open Questions
1. `commentType` 未传入时（undefined），当前实现仍应用 Rule B（向后兼容）——这个 fallback 是否合理？
2. 现有 `review-feedback-spec.test.js` 第 429 行测试用 stub predicate，未覆盖 `commentType` 感知——是否需要补集成级测试？

## Next Action
请 review 代码改动（2 文件），确认 Rule B 豁免逻辑正确且无回归风险。

Review-Target-ID: fix-rule-b-conversation
Branch: fix/rule-b-conversation-exemption

## 自检证据

### Spec 合规
- Bug fix，无 feature spec，对照铲屎官原话确认解决"过滤有问题"
- Rule A（self-authored）行为不变
- Rule B（authoritative bot）仅对 conversation 类型豁免
- Rule C（email watcher 用 isSelfAuthored）不受影响

### 测试结果
```
node --test github-feedback-filter.test.js  # 7 passed, 0 failed
node --test review-feedback-spec.test.js    # 21 passed, 0 failed
pnpm --filter @cat-cafe/api lint            # tsc --noEmit 通过
pnpm check                                  # Biome 通过（仅 ppt-forge 有预存格式问题）
```

### 相关文档
- Feature: F140 (github-pr-automation, 已 close)
- Bug report: 对话历史 [布偶猫 01:56] PR #813 R2 pass 未送达
