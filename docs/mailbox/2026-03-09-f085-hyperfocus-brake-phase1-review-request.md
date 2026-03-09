# Review Request: F085 Hyperfocus Brake Phase 1

## What

PostToolUse hook + skill 组合，每 90 分钟活跃工作后触发三猫联合撒娇提醒。

核心变更：
- `cat-cafe-skills/hyperfocus-brake/` — 4 个 bash 脚本（state/hook/sanitizer/messages）+ SKILL.md
- `.claude/hooks/hyperfocus-brake-timer.sh` — PostToolUse hook shim
- `.claude/settings.json` — hook 注册（PostToolUse matcher）
- `cat-cafe-skills/manifest.yaml` — skill 注册

## Why

铲屎官有 ADHD+ASD，hyperfocus 没有自动刹车。普通闹钟对 hyperfocus 无效（会被冷酷无情按掉）。需要情感羁绊 + 上下文感知 + 互动门槛。

## Original Requirements（必填）

> 铲屎官有 ADHD + ASD，hyperfocus 特质让他能进入超级深度的心流状态，但**没有自动刹车**。他不会像普通人一样"累了就不想干了"——会一直干到身体物理罢工。
> 需要：1. 情感羁绊 — 三只猫猫撒娇，不是机械提醒；2. 上下文感知 — 知道铲屎官在干嘛；3. 互动门槛 — 不能一键 dismiss

- 来源：`docs/features/F085-hyperfocus-brake.md` + 云端 Opus 4.5 招募令
- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- 选择 orchestrator 生成三段文案（非真拉三模型）— GPT-5.4 建议，性能和成本更优
- 选择 bash 实现（非 Node.js）— hook 脚本天然 bash，保持一致性
- Opus 4.5 初始实现把 hooks 写在 SKILL.md frontmatter 中（Claude Code 不会读），已修复为 settings.json 注册

## Open Questions

**🔴 Review 重点（P1 安全）：**
1. `sanitizer.sh` — allowlist `[A-Za-z0-9._/-]` + `@`/backtick/bracket escape 是否充分？是否有遗漏的注入向量？
2. `hook.sh` — branch name 通过 `jq -R .` 输出到 JSON，是否安全？
3. `state.sh` — `/tmp` 状态文件，是否有 race condition 或 symlink attack 风险？
4. `settings.json` — matcher `Bash|Edit|Write|Grep|Glob|Read|Agent` 是否合理？是否漏了工具或多了工具？

## Next Action

请 review hook 安全性 + sanitizer 完整性。通过后我开 PR 走云端 review。

## 自检证据

### Spec 合规

Quality gate 通过：14/14 AC 全部验证（见上方 gate report）。

### 测试结果

```
F085 bash tests: 36/36 pass ✅
  - state.test.sh: 9 pass
  - sanitizer.test.sh: 10 pass
  - hook.test.sh: 5 pass
  - integration.test.sh: 12 pass

pnpm --filter @cat-cafe/api test: 3634 pass, 318 fail
  (318 failures = Redis tests without test:redis + pre-existing issues, same as main)
```

### 相关文档

- Feature spec: `docs/features/F085-hyperfocus-brake.md`
- Implementation plan: `docs/plans/2026-03-09-f085-hyperfocus-brake-phase1.md`
- Message templates: `cat-cafe-skills/refs/hyperfocus-brake-messages.md`
- Recruitment letter: `docs/stories/hyperfocus-brake/懒猫国王 4.5 招募令：Hyperfocus 小刹车.md`
