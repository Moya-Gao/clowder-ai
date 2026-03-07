---
feature_ids: [F073]
topics: [review-request, sop, automation, hooks]
doc_kind: review-request
created: 2026-03-07
---

# Review Request: F073 SOP Auto-Guardian — 流程自闭环守护

## What

三层机制让 SOP 流程自闭环，铲屎官不用反复手动提醒：

1. **SOP Stage Bookmark hook** (`sop-stage-bookmark.sh`) — PostToolUse/Skill 钩子，自动记录当前 SOP 阶段到 `/tmp` 文件
2. **Post-compact 增强** — TTL 5min→30min，注入 SOP 阶段恢复提示 + 诊断日志
3. **Worktree skill 门禁** — 创建前必须检查 main 文档已 commit
4. **Feat-lifecycle skill 自动化** — completion 自动发起跨猫愿景守护

## Why

铲屎官反复手动提醒猫猫 SOP 步骤是系统缺陷。压缩后猫忘规则、hook 提醒不可靠、每步停下来问铲屎官——需要系统级硬约束替代人肉提醒。

## Original Requirements

> "你看你们很多时候需要我一次次的提醒。如果不唠叨你们很容易走错，特别是上下文压缩之后。"
> "布偶猫的 hook 似乎也不怎么好使，压缩后提醒他的那个是不是也得拉出来看看为什么呢？"
> "提醒你们要先更新 feat 或者 backlog md 在 main 上 commit push 然后才能开 worktree 不然文档不一致"
> "feat close 是需要其他猫猫帮你在 pr 合入之后再做一次愿景守护的吧？"
> "自己跑完全流程不要问我，只需要当你 feat close 了喊我就行"

- 来源：铲屎官 2026-03-07 对话（thread_mmdcsxy7ng980inj 相关讨论）
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

| 放弃的方案 | 原因 |
|-----------|------|
| 常用话术编辑器 | 治标不治本 |
| 向量化 SOP 偏离检测 | 过度工程 |
| 强制 MCP 调用 @ | 改动太大 |

## Open Questions

1. `SessionStart` hook 的 `"compact"` matcher 是否在 in-session compaction 后可靠触发？诊断日志已加，需要实际压缩事件来验证
2. SOP stage bookmark 的 `/tmp` 文件在系统重启后丢失——是否需要持久化到其他位置？

## Next Action

请 review 以下 6 个文件的变更，重点关注：
- Hook 脚本的健壮性（错误处理、边界条件）
- Skill 文本的准确性和可执行性
- settings.json 的 hook 注册是否正确

## 自检证据

### Spec 合规
5/5 AC 覆盖，愿景逐项对照通过（见 quality-gate report）

### 测试结果
- `pnpm check:skills` → 15/15 pass
- `bash -n` (3 scripts) → syntax valid
- `jq .claude/settings.json` → valid JSON
- Functional test (sop-stage-bookmark echo pipe) → correct output
- 变更文件全部为 .sh/.json/.md，无 TS 代码变更

### 相关文档
- Feature: `docs/features/F073-sop-auto-guardian.md`
- Related: F046 (Anti-Drift), F067 (Cold-start Verifier), F042 (Prompt Engineering)
