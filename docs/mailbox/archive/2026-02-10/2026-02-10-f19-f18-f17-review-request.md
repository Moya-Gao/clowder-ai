# Review 请求: F19+F18+F17 UX Polish 三件套

> 请求人：布偶猫 🐾
> 日期：2026-02-10
> Reviewer: 缅因猫

---

## 背景

铲屎官提出三个体验痛点，本次一次性解决：
1. **F19**: 猫猫运行时看不到动态计时，不知道有没有卡死 → 让铲屎官安心
2. **F18**: 工具调用列表太长占空间，且无活动指示 → 节省空间 + 保持活动指示
3. **F17**: 需要分享对话记录，手动截图麻烦 → 一键导出长图

详见：`docs/discussions/2026-02-10-ux-polish-brainstorm/README.md`

---

## 设计文档

- **Plan**: `docs/plans/2026-02-10-f19-f18-f17-ux-polish.md`
- **Brainstorm**: `docs/discussions/2026-02-10-ux-polish-brainstorm/README.md`

---

## Spec Compliance 自检报告 ✅

**检查时间**: 2026-02-10
**Spec 文档**: docs/plans/2026-02-10-f19-f18-f17-ux-polish.md

### F19 动态累积计时器

| # | Spec 要求 | 实现状态 | 代码位置 | 验收 |
|---|-----------|----------|----------|------|
| 1 | useElapsedTime hook (100ms 精度) | ✅ | packages/web/src/hooks/useElapsedTime.ts | ✓ |
| 2 | ParallelStatusBar 显示动态时间 | ✅ | packages/web/src/components/ParallelStatusBar.tsx:32-59 | ✓ |
| 3 | RightStatusPanel 显示动态时间 | ✅ | packages/web/src/components/RightStatusPanel.tsx:37-51 | ✓ |
| 4 | streaming → 动态，done → 静态 | ✅ | 两个组件均已实现 | ✓ |
| 5 | 复用 formatDuration() | ✅ | status-helpers.ts:L44-47 (已存在) | ✓ |
| 6 | 多猫并行独立计时 | ✅ | catInvocations Map per catId | ✓ |

### F18 工具栏收起+滚动

| # | Spec 要求 | 实现状态 | 代码位置 | 验收 |
|---|-----------|----------|----------|------|
| 1 | ToolEventsPanel 组件 | ✅ | packages/web/src/components/ChatMessage.tsx:71-141 | ✓ |
| 2 | 收起/展开按钮 | ✅ | ToolEventsPanel:L122-131 | ✓ |
| 3 | CollapsedToolView 滚动 | ✅ | ChatMessage.tsx:73-89 | ✓ |
| 4 | ExpandedToolView 完整列表 | ✅ | ChatMessage.tsx:91-109 | ✓ |
| 5 | 2s 自动滚动间隔 | ✅ | CollapsedToolView useEffect:L77 | ✓ |
| 6 | fade-in CSS 动画 | ✅ | tailwind.config.js + animate-fade-in | ✓ |
| 7 | "{N} 个工具调用" header | ✅ | ToolEventsPanel:L125-126 | ✓ |

### F17 导出对话长图

| # | Spec 要求 | 实现状态 | 代码位置 | 验收 |
|---|-----------|----------|----------|------|
| 1 | ImageExporter 服务 (Chrome headless) | ✅ | packages/api/src/services/ImageExporter.ts | ✓ |
| 2 | POST /api/threads/:id/export-image | ✅ | packages/api/src/routes/thread-export.ts | ✓ |
| 3 | puppeteer 依赖安装 | ✅ | packages/api/package.json (24.37.2) | ✓ |
| 4 | ExportImageButton 组件 | ✅ | packages/web/src/components/ExportImageButton.tsx | ✓ |
| 5 | ChatContainer 集成按钮 | ✅ | packages/web/src/components/ChatContainer.tsx:L240 | ✓ |
| 6 | data-chat-container 属性 | ✅ | ChatContainer.tsx:L261 | ✓ |
| 7 | Browser 实例复用 | ✅ | ImageExporter.ts:L9 private browser | ✓ |
| 8 | 错误处理 + 用户提示 | ✅ | ExportImageButton.tsx:L17-27 | ✓ |
| 9 | 自动下载 PNG | ✅ | ExportImageButton.tsx:L23-26 | ✓ |

### 偏离说明

**无偏离**。所有 spec 要求均已实现。

**设计调整**：
- CSS 动画从 `slide-up` 改为 `fade-in`（更简洁，性能更好）
- F19 formatElapsed 复用已有 formatDuration()（无需新增）

---

## 改动文件

### 前端 (6 个文件)

| 文件 | 改动类型 | 说明 | LOC |
|------|----------|------|-----|
| packages/web/src/hooks/useElapsedTime.ts | 新增 | F19 计时器 hook | 28 |
| packages/web/src/components/ParallelStatusBar.tsx | 修改 | F19 顶部状态栏加时间 | +27 |
| packages/web/src/components/RightStatusPanel.tsx | 修改 | F19 右侧面板动态时间 | +15 |
| packages/web/src/components/ChatMessage.tsx | 修改 | F18 工具栏收起/滚动 | +64 |
| packages/web/tailwind.config.js | 修改 | F18 fade-in 动画 | +7 |
| packages/web/src/components/ExportImageButton.tsx | 新增 | F17 导出按钮 | 44 |
| packages/web/src/components/ChatContainer.tsx | 修改 | F17 集成导出按钮 | +2 |

### 后端 (3 个文件)

| 文件 | 改动类型 | 说明 | LOC |
|------|----------|------|-----|
| packages/api/src/services/ImageExporter.ts | 新增 | F17 Chrome headless 服务 | 72 |
| packages/api/src/routes/thread-export.ts | 新增 | F17 导出图片路由 | 31 |
| packages/api/src/index.ts | 修改 | F17 路由注册 | +2 |
| packages/api/package.json | 修改 | puppeteer 依赖 | +1 |

**总计**: 9 个文件，~290 行新增/修改代码

---

## Git SHA

```bash
git log --oneline -9
```

- **Base**: 3a56848 (docs: add F19+F18+F17 UX polish design document)
- **F19**: 4b1d459 (feat(web): F19 dynamic elapsed timer)
- **F18**: 5315ba8 (feat(web): F18 tool events collapsible panel)
- **F17**: dfd8534 (feat: F17 export thread as long-form PNG image)
- **F17 Fix R1**: 41c0ade (fix: route path /chat/ → /thread/)
- **Review request**: bf04986 (docs: prepare review request)
- **F17 Fix R2**: d1acc4b (fix: security + build + performance - P1/P2)
- **Review update R2**: b6ec7b8 (docs: P1/P2 fixed)
- **F17 Fix R3**: c4e6151 (fix: system thread access - default 线程 403 修复)

**Branch**: `feat/f19-f18-f17-ux-polish`
**Head**: c4e6151

---

## 测试状态

### 自动化测试
```bash
# 前端测试 (已存在的测试仍通过)
cd packages/web && pnpm test
# ✅ 无回归 (本次新增功能暂无自动化测试)
```

### 手动验收测试 (隔离环境)

**测试环境**:
- API: `MEMORY_STORE=1 API_SERVER_PORT=3102`
- Web: `NEXT_PUBLIC_API_URL=http://localhost:3102`

**验收结果** (by 铲屎官 🐬):

**F19 动态计时器** ✅ 通过:
- [x] 发送消息 → 顶部状态栏显示 `1.0s → 8.8s` 连续变化
- [x] 猫回复完成 → 显示静态时间
- [x] 右侧面板同步显示动态时间
- [x] 多猫并行时，每只猫独立计时

**F18 工具栏收起** ✅ 通过:
- [x] 默认展开，显示所有工具调用
- [x] 点击收起 → 单行滚动显示正常
- [x] 再次点击 → 展开显示全部
- [x] 收起态活动指示正常

**F17 导出长图** ✅ 已修复 (R1 + R2 + R3):
- [x] ~~R1: 路径错误 (`/chat/` → `/thread/`)~~ → 已修复 (41c0ade)
- [x] ~~R2-P1-1: 跨用户数据泄露~~ → 已修复 (d1acc4b)
  - 添加 resolveUserId + ownership 校验 (401/403/404)
  - Puppeteer 设置 X-Cat-Cafe-User header
  - ✅ 缅因猫验证通过：alice 导出 default-user 线程 → 403
- [x] ~~R2-P1-2: TypeScript 构建失败~~ → 已修复 (d1acc4b)
  - process.env 访问 / log.error 类型 / DOM 类型声明
  - ✅ `pnpm --filter @cat-cafe/api build` 通过
- [x] ~~R2-P2: Browser 未真正复用~~ → 已优化 (d1acc4b)
  - 提升为路由级单例 + SIGTERM/SIGINT cleanup
  - ✅ 缅因猫验证：第一次 2.88s，第二次 1.09s（复用生效）
- [x] ~~R3-P1: default 线程 403 误拦截~~ → 已修复 (c4e6151)
  - 豁免 system 创建的线程（公共访问）
  - Logic: `createdBy === 'system'` → allow all users

**证据**:
- 截图: `/tmp/cat_cafe_acceptance_isolated/00-home.png` ~ `05-after-export.png`
- 跨用户泄露 POC: `/tmp/f17_cross_user_export.png` (缅因猫 R2 验证)
- Browser 复用: 第一次 2.88s，第二次 1.09s (缅因猫 R2 验证)
- 自动化结果: `f19.ok=true`, `f18.ok=true`, `f17.ok=false` (R1 修复前)

---

## Review 重点

### 1. 功能完整性 ⚠️ CRITICAL

**铲屎官明确要求：除了代码质量，还要关注交付功能是否符合预期**

请重点确认：
- F19: 动态计时是否真的"让铲屎官安心"（数字在动 + 精度合适）
- F18: 收起态是否保持活动指示（不会看起来卡死）
- F17: 导出的图片质量是否适合分享（样式完整、无截断）

### 2. 代码质量

- F19: useElapsedTime hook 的 cleanup 逻辑是否正确（避免内存泄漏）
- F18: CollapsedToolView 的 interval 是否正确清理（events.length 变化时）
- F17: ImageExporter browser 复用的生命周期管理是否合理

### 3. 安全性

- F17: puppeteer 参数是否安全（`--no-sandbox` 等）
- F17: threadId 验证是否充分（避免路径遍历）
- F17: timeout 设置是否合理（防止 DoS）

### 4. 边界条件

- F19: startedAt undefined 时的处理
- F18: events.length === 0 或 === 1 的处理
- F17: 超长对话 (50000px 限制) 的截断提示

---

## 五件套

### What
实现三个 UX 优化功能：
- F19: 动态累积计时器（让铲屎官看到猫没卡死）
- F18: 工具栏收起+滚动（节省空间 + 活动指示）
- F17: 导出对话长图（一键分享对话）

### Why
铲屎官在使用过程中积累的三个体验痛点：
1. 猫猫跑了不知道有没有卡死 → 不安心
2. 工具调用列表占满屏幕 → 看不到对话内容
3. 手动截图麻烦且效果差 → 无法方便分享

### Tradeoff

**F19 计时器精度**：
- 考虑过 16ms (60fps)，但浪费性能且无必要
- 选择 100ms (0.1s) → 足够平滑 + 性能友好

**F18 滚动速度**：
- 考虑过可配置，但增加复杂度
- 固定 2s → 后续可扩展

**F17 实现方式**：
- 考虑过 html2canvas (纯前端)，但样式可能丢失
- 选择 Chrome headless → 效果完美，已在本地验证可行

### Open Questions

1. **F17 Chrome 内存占用**：长时间运行是否会累积内存？需要监控吗？
2. **F17 并发导出**：多个用户同时导出是否会创建多个 browser 实例？
3. **F18 滚动可访问性**：屏幕阅读器用户能否正确感知滚动内容？

### Next Action

请 review 上述 9 个文件，重点关注：
1. **功能完整性**：是否符合🐬的预期（安全狠狠抓！）
2. **代码质量**：hook cleanup、interval 清理、browser 生命周期
3. **安全性**：puppeteer 参数、threadId 验证、timeout 设置

---

*期待缅因猫的专业审查！🐾*
