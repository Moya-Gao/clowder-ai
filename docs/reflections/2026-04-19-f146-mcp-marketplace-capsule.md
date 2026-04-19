---
capsule_id: "F146-2026-04-19"
context: "MCP Marketplace Control Plane — 一键接入 + 多生态聚合"
feature_ids: [F146]
doc_kind: capsule
created: 2026-04-19
---

## What Worked
- Phase R 双顾问调研（GPT Pro + Gemini Deep Think）产出高质量竞品分析，为架构决策提供了充分证据
- 4-Adapter 架构（Claude/Codex/OpenClaw/AntiGravity）使用 `Promise.allSettled` 并发搜索，既保证容错又保证速度
- Content Scanner 14 条中英双语规则 + quarantine 隔离机制，安全审计自动化程度高
- Phase 分层交付（R→A→B→C→D），每 phase 独立可验证，避免大爆炸式集成

## What Failed
- 27 个 AC 粒度过细，部分 AC 之间有隐含依赖关系未在 spec 中明确标注，导致实施时需要反复查看 spec 确认顺序
- Phase A 的 UI mockup 阶段和 Phase D 的实际 UI 实现之间存在 gap，部分设计在实现时需要调整

## Trigger Missed
- 应该在 Phase B（adapter 实现）完成后触发一次跨猫 review，而不是等到全部完成；adapter 接口一致性问题如果早发现可以更早修
- 生态 API 的 rate limit / auth 策略差异大，应该在 Phase R 就建立统一的 error handling 规范

## Doc Links
- [F146 spec](../features/F146-mcp-marketplace-control-plane.md)
- [F041 能力看板](../features/F041-capability-dashboard.md)（前置 feature）
- [F145 MCP Portable Provisioning](../features/F145-mcp-portable-provisioning.md)（姊妹 feature）
- PR #1220, #1231, #1235, #1249, #1283

## Rule Update Target
- `cat-cafe-skills/refs/shared-rules.md §调研规范`: 补充"多生态 adapter 场景下，Phase R 必须输出 unified error handling 规范"
- `docs/reflections/README.md`: 无需修改（当前模板已覆盖）
