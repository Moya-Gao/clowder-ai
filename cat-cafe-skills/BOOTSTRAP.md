# Cat Café Skills Bootstrap

<EXTREMELY_IMPORTANT>
你已加载 Cat Café Skills。这些 skills 包含三猫协作规则和开发流程。

## Skills 列表

### 三猫协作规则（Cat Café 独有）
| Skill | 触发场景 |
|-------|----------|
| `merge-approval-gate` | 准备合入 main 时 |
| `spec-compliance-check` | 开发完成、准备提 review 时 |
| `cross-cat-handoff` | 写交接/传话/review 请求时 |
| `cat-cafe-requesting-review` | 请求本地 review 时 |
| `cat-cafe-receiving-review` | 收到 review 反馈时 |
| `requesting-cloud-review` | 开 PR + 触发云端 Codex review 时 |
| `feat-discussion` | 讨论新功能需求时 |

### 开发流程（改进自 Superpowers）
| Skill | 触发场景 |
|-------|----------|
| `brainstorming` | 开始创意工作前 |
| `writing-plans` | 写实施计划时 |
| `executing-plans` | 执行计划时 |
| `test-driven-development` | 写代码前 |
| `systematic-debugging` | 遇到 bug 时 |
| `using-git-worktrees` | 开始功能开发时 |
| `finishing-a-development-branch` | 功能完成准备合入时 |
| `verification-before-completion` | 声称完成前 |

### 协作工具
| Skill | 触发场景 |
|-------|----------|
| `dispatching-parallel-agents` | 有多个独立任务时 |
| `subagent-driven-development` | 需要子任务驱动开发时 |
| `writing-skills` | 写新 skill 时 |

## 关键规则

1. **如果 skill 适用于你的任务，你必须使用它，没有选择**
2. **合入 main 前必须经过 reviewer 确认**（见 merge-approval-gate）
3. **交接必须包含五件套**：What/Why/Tradeoff/Open Questions/Next Action
4. **Review 修复后必须回给 reviewer 确认**（不能自己判断"改对了"直接合入）
5. **Red→Green 验证**：先写失败测试，再修复

## 使用方式

- **Claude**: Skills 自动触发（已在 ~/.claude/skills/ 配置）
- **Codex**: 手动加载 `cat ~/.codex/skills/cat-cafe-skills/{skill-name}/SKILL.md`
- **Gemini**: Skills 自动触发（已在 ~/.gemini/skills/ 配置）

## 来源

- Cat Café 项目：/Users/lysander/projects/relay-station/cat-cafe/
- Skills 源目录：cat-cafe-skills/
- 决策文档：docs/decisions/009-cat-cafe-skills-distribution.md

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.
</EXTREMELY_IMPORTANT>
