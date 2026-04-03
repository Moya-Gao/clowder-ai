---
doc_kind: review-request
feature_ids: [F129]
created: 2026-04-03
---

# Review Request: F129 Phase B-α — Dogfood Export + Demo Packs

Review-Target-ID: f129-phase-b
Branch: feat/f129-pack-phase-b

## What

F129 Phase B-α 实现：PackExporter（cat-config → Pack 目录导出）、GrowthBoundary 过滤器、两个示范 Pack（Coding World + TRPG），以及 export REST endpoint。

核心变更（7 commits）：
1. IMMUTABLE_FIELDS 扩展到 L1+L2（F093 KD-12 对齐）
2. GrowthBoundary 递归扫描器（KD-11 硬边界）
3. PackExporter：cat-config → masks, shared-rules → guardrails/defaults, skills → workflows
4. POST /api/packs/export 端点
5. docs/packs/coding-world/（导出 + 手工调优）
6. docs/packs/trpg-adventure/（手写 scenario pack）
7. E2E Growth boundary integration tests

## Why

Phase A 建了格式 + 加载 + 编译管线，但没有"从现有 Cat Café 配置生成 Pack"的能力。Phase B-α 闭环验证：我们自己的 coding 配置能否成功导出 → 安装 → 编译 → 注入 SystemPromptBuilder。同时用 TRPG 包证明非 coding 场景的可行性。

## Original Requirements（必填）

> "如果我是一个金融从业者，我用你们如何构建一套金融的猫猫协作？如何分享？如果我是一个喜欢 AI 恋爱的玩家我要怎么样？如果我是一个跑团爱好者？……me & world & cats，我可以是任何身份的我。"
> — 铲屎官，2026-03-19

- 来源：`docs/features/F129-pack-system-multi-agent-mod.md` (Why section)
- **请对照上面的摘录判断：Coding World 导出 + TRPG 示范 Pack 是否回应了"各行业用户各自构建+分享"的需求**

## Tradeoff

- B-α 只做 export + 示范，不做 remix（B3）、OpenClaw importer（B5）、SillyTavern importer（B6）— 这些留给 B-β
- PackExporter 的 Markdown 解析是 best-effort（提取标题行），不解析完整段落内容 — 够用但不完美
- Export endpoint 接受 body 直传数据或从 opts 文件路径读取，Phase B-α 没做 CLI 命令

## Open Questions

1. **GrowthBoundary 误杀风险**：`/memory/` pattern 会匹配 pack 内合法的 `knowledge/memory-techniques.md`。目前 `knowledge/` 是 PACK_SAFE_DIRS 但子文件名仍被 GROWTH_PATTERNS 扫描。需要讨论是否改为"只扫描顶层目录名 + 非 knowledge/ 下的文件名"
2. **PackExporter 的 `extractRules` 只提取 `###` 标题**：如果 shared-rules 的规则不在 h3 下面，就提不到。这是 Phase B-α 的已知限制
3. **TRPG pack 的 knowledge/ 目录**：Phase A 的 AC-A10 说 knowledge 不进 prompt（RAG 路径），TRPG pack 放了 basic-rules.md，但当前没有 RAG 集成 — 这个文件目前是"占位符"

## Next Action

请 review 代码质量 + AC 覆盖 + 安全边界。特别关注 GrowthBoundary 的 pattern 设计和 PackExporter 的 mapping 逻辑。

## 自检证据

### Spec 合规

| AC | 状态 | 证据 |
|----|------|------|
| B1 | ✅ | PackExporter + Coding World pack + round-trip test |
| B2 | ✅ | TRPG adventure pack + install → compile test |
| B4 | ✅ | GrowthBoundary filter + 5 unit tests + 4 integration tests |
| B7 | ✅ | Same as B4 (KD-11 enforcement) |
| OQ-5 | ✅ | IMMUTABLE_FIELDS L1+L2 expansion + KD-12 test |

### 测试结果

```
node --test pack-*.test.js → 59/59 pass, 0 fail ✅
pnpm lint                  → 0 errors ✅
pnpm check                 → 0 errors ✅
pnpm -r --if-present build → exit 0 ✅
```

### 相关文档

- Plan: `docs/plans/2026-04-03-f129-phase-b-alpha-dogfood-demo.md`
- ADR: `docs/decisions/021-f129-pack-system-architecture.md`
- Feature: `docs/features/F129-pack-system-multi-agent-mod.md`
