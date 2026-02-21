# Review 请求: F10 Phase A — PWA 手机化

## 背景

铲屎官想在手机上看到猫猫们（"本质需求是我想也在手机上看见我的猫猫们"）。三猫独立调研后一致选择 PWA 先行。本 PR 实现 Phase A 的核心子任务：响应式 CSS、PWA 配置、viewport 适配。

铲屎官在 iPhone 上实测并反馈了多个体验问题，均已修复。

## 设计文档

- **Roadmap**: `docs/plans/2026-02-20-mobile-cat-roadmap.md`
- **决策**: 三猫共识 PWA > native > iMessage（详见 roadmap "决策" 章节）

## Spec Compliance 自检

**Spec**: Phase A 子任务（来自 roadmap）

| # | Spec 要求 | 状态 | 说明 |
|---|-----------|------|------|
| A1 | 响应式 CSS: 底部固定输入、可折叠侧栏 | ✅ | sidebar overlay + bottom-fixed input |
| A1+ | 手机输入栏优化 | ✅ | + 按钮展开工具栏（铲屎官反馈新增） |
| A1+ | 状态面板手机可见 | ✅ | 底部上滑面板 bottom sheet（铲屎官反馈新增） |
| A1+ | textarea 自动增长 | ✅ | 手机 max 120px, 桌面 max 200px（铲屎官反馈新增） |
| A1+ | 项目选择器手机友好 | ✅ | 快速选项 + 折叠浏览器（铲屎官反馈新增） |
| A2 | PWA 配置: manifest + SW + 图标 | ✅ | @ducanh2912/next-pwa, manifest.json, 3 icon sizes |
| A3 | viewport 适配: dvh + safe-area | ✅ | h-dvh, viewportFit: cover, safe-area-inset-bottom |
| A4 | Rich Blocks 手机优化 | ⚠️ 延后 | 现有 blocks 尚未专门优化，待后续 |
| A5 | 手机端语音输入 | ⚠️ 延后 | 已有 browser API 基础，需要 Tailscale 可达验证 |
| A6 | Tailscale 隧道 | ✅ | 实测通过 (env 配置)，CORS 支持 FRONTEND_URL |

**偏离说明**: A4/A5 延后到 Phase A round 2，不影响核心体验。

## 改动文件

| 文件 | 改动类型 | 说明 |
|------|----------|------|
| `layout.tsx` | 修改 | viewport meta + PWA manifest/appleWebApp metadata |
| `globals.css` | 修改 | safe-area-inset-bottom CSS |
| `next.config.js` | 修改 | withPWA wrapper (NetworkOnly API, CacheFirst static) |
| `package.json` | 修改 | +@ducanh2912/next-pwa |
| `manifest.json` | 新增 | PWA manifest |
| `icons/` (3 files) | 新增 | apple-touch-icon, 192x192, 512x512 |
| `.gitignore` | 修改 | SW 生成文件 |
| `ChatContainer.tsx` | 修改 | sidebar overlay + mobile status sheet trigger |
| `ChatInput.tsx` | 修改 | rows=1 + auto-grow + mobile + button toggle + matchMedia guard |
| `MobileInputToolbar.tsx` | 新增 | 手机展开工具栏（从 ChatInput 提取，350 行限制） |
| `MobileStatusSheet.tsx` | 新增 | 底部上滑状态面板 |
| `ChatMessage.tsx` | 修改 | 手机加宽气泡 85% + 图片 max-w-full |
| `MarkdownContent.tsx` | 修改 | 代码复制按钮 touch-visible |
| `SplitPaneView.tsx` | 修改 | h-screen → h-dvh |
| `ThreadSidebar.tsx` | 修改 | +onClose prop, 选择后自动关闭 |
| `DirectoryPickerModal.tsx` | 修改 | 快速选项 (cwd/已有项目) + 折叠式文件浏览器 |

## Git SHA

- Base: `c466213` (main)
- Head: `ecdb609` (feat/f10-pwa-mobile, 11 commits)

## 测试状态

```
pnpm --filter @cat-cafe/web test: 417 passed, 1 failed (pre-existing)
pnpm --filter @cat-cafe/web build: ✅ clean (0 errors)
```

1 pre-existing失败: `useSendMessage-routing.test.ts`（main 上也失败，与本 PR 无关）

## Review 重点

1. **MobileStatusSheet.tsx (154行)**：新组件，bottom sheet 实现，z-index 和 transition 是否合理
2. **DirectoryPickerModal.tsx (231行)**：改动较大，快速选项逻辑是否清晰
3. **next.config.js withPWA wrapper**：PWA 配置是否正确，dev 模式 disable 是否生效
4. **ChatContainer.tsx (468行)**：已超 350 行硬限制（pre-existing 435→468），建议后续拆分但不在本 PR 范围
5. **安全**：`API_SERVER_HOST=0.0.0.0` 是 .env.local 配置（不入库），但 CORS 逻辑是否足够严格

## 五件套

**What**: F10 Phase A — 把 Cat Cafe 变成手机可用的 PWA，包括响应式布局、PWA 安装、手机输入优化、状态面板、项目选择器

**Why**: 铲屎官要在手机上看到猫猫。Next.js 已有完整聊天前端，PWA 是最快的手机化路径（三猫共识）

**Tradeoff**: 选择 PWA 而非原生 App，牺牲了 iOS 后台/推送的完整性，换取零额外依赖和迭代速度。A4（Rich Blocks 手机优化）和 A5（语音输入手机版）延后

**Open Questions**:
- ChatContainer.tsx 468 行已超硬限制，需要后续拆分（pre-existing 问题+33 行增量）
- iOS PWA 推送通知稳定性待 Phase C 验证
- 铲屎官反馈"好像很卡"——性能优化待后续

**Next Action**: 请 review 上述 19 个文件（重点关注 5 个标注项）
