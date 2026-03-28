---
capsule_id: "F142-2026-03-28"
context: "Connector Slash Commands — 跨平台 /slash 扩展框架 (Phase A + B)"
feature_ids: [F142]
doc_kind: capsule
created: 2026-03-28
---

## What Worked
- **Scope 收敛决策早**：铲屎官第一轮讨论就明确 connector-only（KD-1），避免了 Hub 端无效工作
- **砚砚 spec review 高效**：3 轮 spec review 从 3P1+2P2 收敛到 0P1，设计门禁真正拦住了问题
- **CORE_COMMANDS 单一真相源**：放 shared 包让 web 和 API 都从一个地方 import，消除了双轨维护
- **candidate-set 最长匹配解析器**：砚砚 P1 发现 flat multi-word 命令匹配 bug 后，重写为 sort-by-length-desc 方案，一次性解决了所有子命令 vs 父命令优先级问题
- **愿景守护三层**：砚砚 code review → GPT-5.4 愿景守护（发现 2P1）→ 金渐层最终守护，层层递进

## What Failed
- **CORE_COMMANDS 初版不完整**：补了 7 个 connector 命令后才完整，说明手动维护命令列表容易漏——未来应考虑从 handler switch cases 自动生成
- **`/thread` metadata 写错**：把 `<create|rename|info>`（不存在的子命令）写进了 usage，而 handler 实际接受 `<thread_id> <message>`——暴露了"先写声明后补实现"时的认知偏差
- **parseCommand 首版未 wired**：写了解析器但 ConnectorCommandLayer.dispatch() 还在用旧的 split+switch，GPT-5.4 的 P1 才抓出来
- **云端 review 触发 heredoc 变量未插值**：第一次触发的 comment 里 SHA 是 `${SHORT_SHA}` 字面量，需要二次触发

## Trigger Missed
- 应该在写 CORE_COMMANDS 时就 grep 所有 `case '/xxx':` 来确保完整性，而不是凭记忆手列
- 应该在写 parseCommand 后立刻在 CCL 里 wired 并跑集成测试，而不是等到 review 被指出
- heredoc 里混用单引号和变量插值是 shell 常见坑，应该用双引号 heredoc 或直接拼变量

## Doc Links
- Feature spec: `docs/features/F142-connector-slash-commands.md`
- Phase A PR: https://github.com/zts212653/cat-cafe/pull/781
- Phase B PR: https://github.com/zts212653/cat-cafe/pull/783
- Vision guard fix PR: https://github.com/zts212653/cat-cafe/pull/786
