# Review Request: F114 Magic Words + 愿景守护 Gate

## What

两处改动：
1. **SystemPromptBuilder.ts** — `GOVERNANCE_L0_DIGEST` 末尾追加 4 个 Magic Words 定义（脚手架/绕路了/喵约/星星罐子），每个带触发行为说明（+5 行）
2. **feat-lifecycle/SKILL.md** — 愿景守护 Step 0 新增 BLOCKED 条件：守护猫必须输出「铲屎官原话 vs 实际状态」证物对照表（+16 行）
3. **system-prompt-builder.test.js** — 5 个 size guard 阈值各 +300 字符适配新增内容

## Why

- 愿景守护流于形式（F101 教训：两轮守护都没拦住 checkbox 审计）
- 铲屎官缺乏紧急拉闸手段
- 三方共识（铲屎官 + 宪宪 + 砚砚）：不瘦身不分层，只做这两件事

## Original Requirements（必填）

> "我感觉做愿景守护的喵，要么他没有认真的看我的愿景，要么你们两只猫的人类意图理解能力有问题。" — 铲屎官 2026-03-13
> "我们的家规或者喵约里面很多很重要的该怎么办？" — 铲屎官 2026-03-13
> "如果一天就能写完，你还要做那些先搞一个垃圾版本……可能又搞了一周都没干完" — 铲屎官 2026-03-13

- 来源：`docs/features/F114-governance-magic-words.md` §Why
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

放弃了 v1 四层架构方案（喵约瘦身 + 动态注入 + skill 内联规则）。铲屎官指出这是开倒车——F042 以前就是分层的，移到 refs/skills 后注意率从 70% 降到 1%。

## Open Questions

1. Magic words 的行为描述（尤其「星星罐子」的停机范围）是否足够精确？
2. 证物对照表的"铲屎官原话"要求逐字引用——如果 Discussion 是语音转文字，精度是否够？
3. Size guard +300 的余量是否合理（实际增加 ~250 字符）？

## Next Action

请 review：
- `packages/api/src/domains/cats/services/context/SystemPromptBuilder.ts` L228-232（magic words）
- `cat-cafe-skills/feat-lifecycle/SKILL.md` L145-161（BLOCKED 条件）
- `packages/api/test/system-prompt-builder.test.js`（size 阈值调整）

分支：`feat/f114-governance-magic-words`

## 自检证据

### Spec 合规

| AC | 状态 | 验证方式 |
|----|------|---------|
| AC-1: GOVERNANCE_L0_DIGEST 包含 4 magic words | ✅ | `grep -c` 确认 5 次匹配 |
| AC-2: 星星罐子 停止副作用 | ✅ | 行为定义包含"不发新命令、不写新文件、不push" |
| AC-3: feat-lifecycle BLOCKED 条件 | ✅ | `grep -c BLOCKED` = 6 |
| AC-4: 对照表格式 | ✅ | 含铲屎官原话 + 实际状态 + 匹配列 |
| AC-5: 测试通过 | ✅ | 67/67 pass |

### 测试结果

```
node --test packages/api/test/system-prompt-builder.test.js
# tests 67, pass 67, fail 0
```

### 相关文档

- Feature spec: `docs/features/F114-governance-magic-words.md`
- Related: F086（元思考触发器）、F073（愿景守护自动化）、F041（AC ✅ 但 UI 不可用）
