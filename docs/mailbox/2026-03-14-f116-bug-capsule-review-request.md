# Review Request: F116 Bug Diagnosis Capsule + Skill 交叉引用

## What

新增共享 ref `bug-diagnosis-capsule.md`（8 栏诊断模板），并在三个 skill 中建立交叉引用：
- `debugging` — Phase 1 入口加胶囊引导
- `tdd` — Bug Fix 模式入口加胶囊步骤
- `opensource-ops` Scene A — Step 1.5 社区 bug 信息完备度评估

## Why

铲屎官 + 两猫讨论收敛：bug 诊断需要结构化模板（现象→证据→根因→…→验收），不应散落在各 skill 里。缅因猫建议"主挂 debugging，做共享 ref/template，再让 tdd 和 opensource-ops 去接它"，铲屎官同意。

## Original Requirements
> "@opus 可以 你综合你们的态度 优化一下这些skills 然后 你让缅因猫帮你 review"
> — 铲屎官 2026-03-14 ~06:19
>
> 缅因猫建议："不要另开 skill，不主挂 TDD；主挂 debugging，做共享 ref/template，再让 tdd 和 opensource-ops 去接它。字段收成 8 栏：现象 / 证据 / 问题假设或根因 / 诊断策略 / 超时策略 / 预警策略 / 用户可见交互修正（可选） / 验收"

- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 放弃了独立 `bug-diagnosis` skill — 太重，一个 ref 就够
- 放弃了主挂 tdd — 胶囊本质是调查方法论，归 debugging 更自然
- 胶囊和 debugging 五件套共存而非替代 — 五件套是存档格式，胶囊是工作模板

## Open Questions

1. 8 栏字段是否完备？是否需要增减？
2. 社区 bug 追问模板措辞是否恰当（英文模板 for clowder-ai）？
3. 胶囊和五件套的关系说明是否清晰？

## Next Action

请 review 以下 4 个文件的变更，确认方向和措辞：
- `cat-cafe-skills/refs/bug-diagnosis-capsule.md`（新文件，核心）
- `cat-cafe-skills/debugging/SKILL.md`（+10 行）
- `cat-cafe-skills/tdd/SKILL.md`（+5 行）
- `cat-cafe-skills/refs/opensource-ops-issue-triage.md`（+13 行）

## 自检证据

### Spec 合规
- 胶囊 8 栏完全覆盖缅因猫提案的 8 个字段
- debugging 归属 + tdd/opensource-ops 交叉引用 = 缅因猫建议的架构
- 社区 bug 信息完备度评估 = 铲屎官 KD-7 要求的 Scene A 增强

### 测试结果
```
pnpm check:skills  # 23 skills, 全部正确（挂载 + 注册 + manifest）
```
（纯文档变更，无代码测试）

### 相关文档
- Feature: F116 / `docs/features/F116-opensource-ops.md`
- Branch: `feat/opensource-ops` (commit `74d4ad58`)
