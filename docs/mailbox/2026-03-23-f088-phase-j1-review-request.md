# Review Request: F088 Phase J1 — file block 全链路 + outbound 投递 + 安全防护

## What

为 F088 Multi-Platform Chat Gateway 增加 RichBlock `kind: "file"` 支持，实现文档附件（PDF/DOCX/MD 等）的全链路：类型定义 → 校验 → outbound 投递 → 飞书原生 file_type 映射 → 前端渲染。

核心变更（13 files, +340/-10）：
- **shared**: `RichFileBlock` 类型（url, fileName, mimeType?, fileSize?）
- **api**: callbacks zod schema + `isValidRichBlock` 加 `file` case
- **api**: `OutboundDeliveryHook` 加 file block → `sendMedia(type:'file')` 投递
- **api**: `FeishuAdapter.inferFeishuFileType()` — 按扩展名映射 pdf/doc/xls/ppt（替代统一 stream）
- **api**: `mediaPathResolver` path traversal guard（P1 安全修复）
- **web**: `FileBlock.tsx` 渲染器 + `RichBlocks.tsx` 路由

## Why

铲屎官希望猫能生成 PDF/DOCX/MD 文档并通过飞书发送。J1 先建基础设施（类型 + 投递管道 + 安全），J2 再做生成服务。拆分方案经砚砚 review 确认。

## Original Requirements（必填）

> 铲屎官："大猫猫你研究看看我们的 f88 还有各种飞书相关的，最好去飞书那边调研一下飞书支不支持你们传文件？比如我让你生成一份 pdf 能传到飞书吗？"
> 铲屎官（确认 scope）："要支持传文件，docx md pdf 等等文件就行，和砚砚讨论清楚直接开 worktree 开搞"
- 来源：当前 thread `thread_mn3yrdt2rhk2ckc0` 消息 #26 + #39
- **请对照上面的摘录判断 J1 基础设施是否为最终交付物（J2 生成服务）奠定了正确的基础**

## Tradeoff

- **不在 J1 做生成服务**：拆分为 J1（管道）+ J2（生成），降低回归风险
- **`absPath` 不放进 FileBlock**：只在投递阶段由 resolver 得到，不污染类型合同（砚砚建议）
- **file_type 映射用扩展名而非 mimeType**：飞书 API 按 file_type 字段决定预览能力，扩展名更直接

## Open Questions

1. **path traversal guard**: 我用 `resolve(base, suffix).startsWith(base + '/')` 做防护——请确认是否有绕过场景
2. **前端 FileBlock**: 当前是简单下载链接，J2 时可能需要更丰富的 UI（预览等）——当前实现是否足够 MVP
3. **file_type 映射**: 当前只覆盖 pdf/doc/docx/xls/xlsx/ppt/pptx/mp4，其他走 stream 兜底——还有需要加的吗

## Next Action

请 review 代码质量 + 安全性（尤其 P1 path traversal），放行后我走 merge-gate。

## 自检证据

### Spec 合规

Quality Gate PASS。J1 scope 7 项功能验收全通过（见上文 QG report）。

### 测试结果

```
node --test (5 test files) → 150 passed, 0 failed ✅
pnpm --filter @cat-cafe/shared build → tsc exit 0 ✅
pnpm --filter @cat-cafe/api build → tsc exit 0 ✅
pnpm lint → 0 errors ✅
pnpm check → biome clean ✅（feature-index stale 是预存问题）
```

### 相关文档

- Feature: `docs/features/F088-multi-platform-chat-gateway.md` Phase J
- 砚砚 review: multi-mention response（P1 阻塞 + PR 拆分建议，全部采纳）

---

Review-Target-ID: f088-phase-j1
Branch: feat/f088-phase-j1
