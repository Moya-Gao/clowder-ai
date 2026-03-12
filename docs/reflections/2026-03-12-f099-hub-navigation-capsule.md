---
capsule_id: "F099-2026-03-12"
context: "F099 Hub 导航可扩展性重构完成后的反思"
feature_ids: [F099]
doc_kind: capsule
created: 2026-03-12
---

## What Worked
- 三猫讨论（opus/gpt52/gemini）产出了高质量的方案对比，铲屎官当场拍板。
- Pencil 设计稿先行验证了 UI 方案，避免了代码返工——V2 accordion 设计铲屎官确认后代码一次到位。
- Codex review 抓到了两个真实 P1（deep-link 首帧闪烁 + 顶栏入口缺失），都在合入前修掉了。
- React 18 render-time sync 替代 useEffect 是正确的技术选择，同时修复了 SSR 测试和生产首帧问题。

## What Failed
- V1 (Bento Box) 实现时用了 emoji 图标，设计稿画的是 SVG——设计→代码保真度执行不到位，被铲屎官批评"丑的要死"。
- 没有在 V1 合入前对照 Pencil 截图做设计稿验证，导致 V1 合入后立即被推翻重做。
- Phase A 的 AC 描述停留在 V1 措辞（"Bento Box"、"顶栏 ≤4"），直到愿景守护才被 GPT-5.4 指出文档漂移。

## Trigger Missed
- `quality-gate` Step 5 (PEN CHECK) 在 V1 时没有被执行——如果 glob 了 .pen 文件并对照截图，emoji vs SVG 的问题会在 review 前被发现。
- Spec 应该在 V2 merge 后立即同步（merge-gate Step 7.5 只更新了 Timeline，没更新 What/AC 措辞）。

## Doc Links
- Feature spec: `docs/features/F099-hub-navigation-scalability.md`
- Discussion: `docs/discussions/2026-03-11-f099-nav-scalability/README.md`
- Design: `designs/f099-hub-navigation-scalability.pen`
- PR #384 (V1), PR #396 (V2)

## Rule Update Target
- `quality-gate` Step 5 已经有 .pen 自动检测，但 V1 时跳过了——教训是 Step 5 必须 glob 命令驱动，不能靠记忆。（已在 skill 中明确。）
- merge-gate Step 7.5 的文档同步应该包含"spec What/AC 措辞是否与实际实现一致"检查，不只是 Phase ✅ 和 Timeline。
