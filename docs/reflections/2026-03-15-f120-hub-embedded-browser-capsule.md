---
capsule_id: "F120-2026-03-15"
context: "F120 Hub Embedded Browser — Phase A/B/C 全量交付"
feature_ids: [F120]
doc_kind: capsule
created: 2026-03-15
---

## What Worked

- **TDD 红绿灯纪律**：每个 AC 先写失败测试再实现，preview 域 77→84 个测试零回归
- **组件提取控制行数**：BrowserPanel 反复逼近 350 行硬上限，通过提取 BrowserToolbar/ConsolePanel/BrowserTabBar/useHmrStatus/usePreviewBridge 保持在 334 行
- **砚砚 review 质量高**：P1 brotli 白屏、P1 join_room 无鉴权、P2 postMessage 校验，都是真实边界问题
- **GPT-5.4 愿景守护抓到"功能在但猫不会用"**：skill 文档没跟上 Phase C 能力，这是比代码 bug 更隐蔽的愿景偏离
- **Phase 文档实时同步**：每次 merge 后立刻更新 feature doc，避免冷启动读到过时状态

## What Failed

- **Biome check:fix 改了不相关文件**：全量 `pnpm check:fix` 格式化了 21 个文件，需要手动 `git checkout` 恢复无关改动。应该限制 scope 到自己的文件
- **BrowserPanel 行数反复超限**：Biome 格式化展开代码后从 348→379 行，需要再次压缩。应该在写代码时留更大余量（≤320 目标而非卡 350 上限）

## Trigger Missed

- **Skill 文档同步应该在 merge-gate Step 7.5 做**：每次 merge 后不仅同步 feature doc，还应该检查相关 skill 是否需要更新。GPT-5.4 踢回说明这一步被遗漏了
- **云端 review P2（Content-Encoding: identity）应该在本地就发现**：HTTP 标准编码 identity 在写 passthrough 逻辑时就该考虑到

## Doc Links

- Feature spec: `docs/features/F120-hub-embedded-browser.md`
- Phase C2 plan: `docs/plans/2026-03-15-f120-phase-c2.md`
- PR #450 (Phase A+B), PR #458 (Phase C1+C2), PR #461 (Phase C3+C4+C5)
- Design: `designs/F120-hub-embedded-browser.pen`

## Rule Update Target

- `merge-gate` Step 7.5：考虑加一步"检查相关 skill 文档是否需要同步"——目前只同步 feature doc，漏了 skill
- `quality-gate` Step 6：`pnpm check:fix` 应限制 scope 到改动文件，避免格式化无关代码
