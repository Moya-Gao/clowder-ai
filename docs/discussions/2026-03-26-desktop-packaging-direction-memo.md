---
topics: [desktop, macos, pwa, electron, tauri, architecture]
doc_kind: discussion
created: 2026-03-26
participants: [opus, gpt52, landy]
status: converged
thread: current
---

# Desktop Packaging Direction Memo

> 背景：社区 PR `clowder-ai#259` 提出了 `Tauri v2 + Rust + Node sidecars` 的 macOS 桌面客户端实现。两猫（opus + gpt52）独立审查并讨论后，需要形成一版可复用的技术口径，供后续 desktop 方向判断使用。

## 一、结论

当前共识：

1. **`clowder-ai#259` 不合入 `main`。**
2. **现在不引入 `Rust/Tauri` 作为桌面方向主线。**
3. **先用 `PWA / Safari Web App` 验证需求。**
4. **桌面壳的正确原则是：壳只开窗口，runtime 自己管自己。**

## 二、核心判断

### D1. 我们的复杂度在 runtime，不在窗口壳

Cat Café / Clowder AI 的核心复杂度来自：

- 本地 Node/TypeScript runtime
- CLI orchestration
- 文件系统 / PTY / sidecar / WebSocket / connector 集成

因此，桌面端的首要问题不是“选哪个壳最潮”，而是：

**如何在不污染主仓构建链、不引入第二套不必要 runtime 的前提下，把现有 runtime 以桌面形态交付出去。**

### D2. 壳与 runtime 必须分层

这是本次讨论收敛出的架构铁律：

**Shell should stay thin. Runtime should own its own lifecycle.**

反例就是 `clowder-ai#259` 这类方案：壳同时承担

- 进程启动
- sidecar 编排
- 健康检查
- runtime 生命周期管理
- UI 渲染

这会把本来应该稳定、可替换的边界打碎。后续无论换 `Swift`、`Electron` 还是 `Tauri`，都会继续在错误层级上累复杂度。

## 三、技术路线排序

### Phase 0: PWA / Safari Web App

这是当前一致推荐的第一步。

目的不是“凑合”，而是先验证用户真正需要的是不是：

- 独立窗口
- Dock 图标
- 通知
- app-like launch behavior

如果这些诉求通过 `PWA / Safari Web App` 就已满足，那么我们不应该过早把桌面打包复杂度引入主仓。

### Phase 1a: macOS-only 时，优先原生薄壳

如果下一阶段仍然是 **macOS 专属需求**，当前更优解是：

**`Swift + WKWebView` 薄壳**，只做一件事：渲染现有 runtime 提供的 UI。

理由：

- 我们已经有自己的 Node runtime，不需要再捆一套 Electron 的 Node + Chromium
- 壳可以极薄，职责单一
- 与 F124 苹果生态方向天然兼容（通知中心、Handoff、Shortcuts、菜单栏等）

### Phase 1b: 跨平台打包成为硬需求时，优先 Electron

如果目标升级成 **跨平台 packaged desktop**，则当前排序变成：

**`Electron` 优先于 `Tauri`。**

理由：

- Electron 与我们现有 `Node/TypeScript/CLI-heavy` runtime 更贴合
- 团队认知和调试成本更低
- 虽然包体更大，但当前主要矛盾不是包体，而是维护复杂度与交付速度

### Tauri / Rust

当前结论不是“永远不用 Tauri”，而是：

**`Tauri/Rust` 不进入当前 shortlist。**

它只在以下前提都成立时才值得重新评估：

- 我们明确愿意长期维护 Rust 工具链
- 桌面端需要更强的 native/capability 边界
- 有充分理由证明 `Tauri` 带来的收益大于第二套语言和工具链的成本

## 四、主仓边界

任何未来的桌面方案都必须满足：

1. **不污染根 `pnpm build` / `pnpm dev` / `pnpm test`。**
2. **单独 CI，单独 release lane。**
3. **先有 accepted issue / design anchor，再有实现。**
4. **壳与 runtime 的职责分层明确。**
5. **必须有 clean-machine 验证。**

## 五、对 `clowder-ai#259` 的判定模板

后续再遇到类似 PR，可以直接套用以下判断口径：

- 方向可能有价值，但 **实现-first** 不可接受
- 大体量 desktop/toolchain 引入，必须先有 design discussion
- 壳不能接管 runtime 编排
- macOS-only 与 cross-platform 是两条不同路线，不能混成一个“先上了再说”的实现

## 六、最终收敛

当前推荐排序：

```text
PWA / Safari Web App
  -> macOS-only: Swift + WKWebView thin shell
  -> cross-platform: Electron
  -> Tauri/Rust: future option, not now
```

这份 memo 的目的不是一次性拍死未来技术选型，而是把判断顺序固定下来：

**先验证需求，再选壳；先保证边界正确，再谈工具偏好。**
