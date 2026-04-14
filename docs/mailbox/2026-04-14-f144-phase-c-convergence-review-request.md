---
doc_kind: review-request
created: 2026-04-14
feature_ids: [F144]
topics: [ppt-forge, svg, security, performance]
---

# Review Request: F144 Phase C Convergence — AC-C3/C4/C5/C6

Review-Target-ID: f144-phase-c
Branch: feat/f144-phase-c

## What

Phase C 的 4 个剩余 AC 全部收口，Phase C (SVG 渲染后端) 从 2/6 → 6/6：

| AC | 内容 | 产物 |
|----|------|------|
| C3 | CJK 对比验证：V1 溢出 vs Phase C 不溢出 | `phase-c-comparison.test.ts` (3 tests) |
| C4 | SVG 安全白名单（sanitizer） | `svg-sanitizer.ts` (126 行) + 17 tests |
| C5 | 性能 gate（50+ box < 5s, < 2MB） | `svg-perf.test.ts` (5 tests) |
| C6 | AI-direct SVG 通道（validate→sanitize→render） | `svg-direct.ts` (77 行) + 5 tests |

**2 个新源文件 + 4 个新测试文件 = 755 行净增，31 新测试（201→232）。**

## Why

铲屎官指示："先把 c 四个 ac 收敛然后继续"。Phase C 作为 diagram fallback 路径需要收口，才能继续推 Phase D 剩余工作。

## Original Requirements（必填）

> "你更新一下f144？然后按照你觉得合适的方式直接搞？先把c四个ac收敛然后继续"
— 铲屎官，2026-04-14 IM

- **请对照上面的摘录判断交付物是否解决了铲屎官的问题**

## Tradeoff

- **AC-C4 sanitizer 用 regex 而非 DOM parser**：SVG 来自我们自己的编译器（确定性输出），regex 足够且零依赖。AI-direct 路径（C6）的 SVG 也先过 sanitizer 再进 svg-to-shapes，后者本身只认 `<rect>`/`<text>` 等白名单标签。真正需要 DOM parser 的场景（如 relay-claw 的 200k Python svg_to_pptx）暂不在我们路线上。
- **AC-C6 轻量实现**：没有做完整的"人工验收 gate UI"，只做了 `stripped[]` 报告让调用方决定是否接受。人工验收 gate 属于 pipeline 编排层，不在 Phase C 的 renderer 层职责范围。

## Open Questions

1. **C4 白名单覆盖度**：当前允许 11 种元素（svg/g/rect/text/tspan/line/circle/ellipse/path/polygon/polyline）。是否需要补充 `<defs>`/`<clipPath>`/`<mask>` 等结构性元素？目前 diagram-svg 编译器不生成这些，但 AI-direct 路径可能需要。
2. **C3 测试结构**：V1 renderer 的"溢出"是通过 `measureTextWidth(label, fontSize) > boxWidth` 间接证明的（V1 不做字宽检测），不是真正的像素级溢出检测。是否需要更强的证明？

## Next Action

请 review 这 7 个文件的变更。重点关注 C4 sanitizer 的安全覆盖和 C3 对比测试的有效性。

## Review Sandbox（必填）

- Path: `/tmp/cat-cafe-review/f144-phase-c/codex`
- Start Command: `pnpm --filter @cat-cafe/ppt-forge test`（纯库，无 web/api 服务）
- Ports: N/A（纯测试，无服务端口）

## 自检证据

### Spec 合规

- AC-C3 ✅：3 个测试证明 V1 溢出 + Phase C 不溢出 + Phase C 自适应缩放
- AC-C4 ✅：svg-sanitizer.ts 实现白名单，17 个测试覆盖安全/危险/边界
- AC-C5 ✅：50+ box diagram（实际 60+ boxes）编译+渲染均 <5s，SVG <2MB
- AC-C6 ✅：svg-direct.ts 实现 validate→sanitize→render 管线，5 个测试

### 测试结果

```
pnpm --filter @cat-cafe/ppt-forge test   # 232 passed, 0 failed
pnpm --filter @cat-cafe/ppt-forge lint   # tsc --noEmit clean
pnpm check                               # biome: 0 errors, warnings only (regex exec pattern)
```

### 相关文档

- Feature: `docs/features/F144-ppt-forge.md` (Phase C section, all 6 ACs checked)
- Spec 里的 Phase C 交付项和风险条目均已覆盖
