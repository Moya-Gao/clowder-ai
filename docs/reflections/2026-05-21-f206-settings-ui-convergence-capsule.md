---
capsule_id: "F206-2026-05-21"
context: "16 Phase (A-P) Settings/Console/Hub/Workspace/Memory/Mission 视觉语言归一"
feature_ids: [F206]
doc_kind: capsule
created: 2026-05-21
---

## What Worked

- **CVO 快速路 directive (KD-1) 极大缩短周期**：不走云端 review，opus coding + codex 本地 review + opus-47 愿景守护。16 Phase 在 ~3 天内全部合入（5-18 到 5-21），远快于正常流程
- **砚砚 post-merge audit 驱动式推进**：每个 Phase merge 后砚砚审计 main 现状，精确指出下一批残留文件+处数，消除了"扫到哪算哪"的模糊性。Phase E-P 全部由砚砚审计产出 scope
- **Phase 粒度与 token 命名空间对齐**：按区域切 Phase（settings → console → workspace → hub → mission → memory），每个 Phase 的新 token 前缀隔离（console-* / ws-* / hub-* / mc-* / terminal-*），避免命名冲突
- **Exempt 标注 + KD-4 规则消除反复 reopen**：data-viz palette / brand colors / xterm.js canvas 等明确标注 exempt 后，后续审计不会重复 flag
- **text-micro bulk migration (Phase L) 一次 510 处零回归**：纯 className 替换 + rg verified zero remaining，证明 bulk 机械替换在 CSS token 场景安全

## What Failed

- **Phase A-C 首次 close 过早**：5-18 三猫愿景守护 PASS 后 close，5-20 铲屎官看到仍有大量 raw hex → reopen 追加 Phase D-P。教训：视觉归一类 feat 的"完成"标准不能只看 primitives 迁移，要做全仓 raw hex 扫描
- **CTA button WCAG AA 限制发现晚（Phase O）**：`--console-button-emphasis` dark mode 3.31:1 对比度不够 4.5:1 才被发现，导致 Phase O P2-1 需要回滚 CTA 按钮。应在 Phase D token 定义时就做对比度验证
- **VoiceSettingsPanel 不在 settings/ 子目录**：Phase P 审计时 Explore agent 在 `settings/` 找不到文件，实际在 `components/` 根。组件目录结构不统一是已有 tech debt

## Trigger Missed

- **全仓 raw hex 审计应在 Phase A 之前做**：Phase A 只看了 4 高定制页面，没有全量扫描。如果先跑 `rg '#[0-9a-fA-F]{3,8}'` 做 baseline，Phase 拆分会更准确，避免 reopen + 追加 13 个 Phase
- **Dark mode WCAG 验证触发器缺失**：新增/修改 CSS custom property 时应自动检查 dark mode 下与常见前景色的对比度，而不是等 reviewer 发现

## Doc Links

- [F206 spec](../features/F206-settings-ui-convergence.md)
- [Settings 对比审计](../evidence/settings-comparison/settings-comparison.md)
- [F190 post-close capsule](../reflections/2026-05-13-f190-console-settings-intake-capsule.md)（前序教训）
- PRs: #1765, #1769, #1770, #1806, #1808, #1809, #1810, #1811, #1812, #1813, #1814, #1815, #1817, #1818, #1819, #1820

## Rule Update Target

- `quality-gate` Step 5 可扩展：对 CSS token 迁移类 feat，gate 前自动跑 `rg '#[0-9a-fA-F]{3,8}' packages/web/src/` 做残留扫描，而不是等 reviewer post-merge audit 驱动
- `writing-plans` 对视觉归一类 feat 的 Straight-Line Check 应增加"全量 baseline scan → scope 再拆 Phase"步骤，避免 scope creep 式 reopen
