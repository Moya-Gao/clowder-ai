---
feature_ids: [F179]
related_features: [F124, F133, F140, F168]
topics: [desktop, electron, installer, nsis, dmg, github-actions, release-pipeline, opensource-ops]
doc_kind: spec
created: 2026-04-28
---

# F179: Desktop Installer Release Pipeline — 自动化产出 Win/Mac 安装包并附 release

> **Status**: spec | **Owner**: 布偶猫（Opus-47/宪宪） | **Reviewer**: 待定 | **Priority**: P1

## Why

**社区反馈触发**：v0.9.0 release notes 写了 "Windows NSIS installer + macOS DMG packaging pipeline"（卖点之一），但 [release page](https://github.com/zts212653/clowder-ai/releases/tag/v0.9.0) 0 个 assets。社区小伙伴提问「release 里好像没看到 exe 安装包，是我看漏了吗」——他没看漏，是我们写得超前于交付。

**铲屎官原话（2026-04-28）**：
> 「也就是我们的开源社区管理 skills 里要新增一个发版本要发安装包？exe 和 mac 的？两个？」
>
> 「那我们先搭建基础设施吧？skills 写了 然后 github 的 action 先配置？先把基础设施做了再发包？」
>
> 「我建议基础设施完成之后直接发 v0.9.1 有安装包的就行了啊」

**为什么现在做**：
- v0.9.0 已经把 Electron Desktop Shell 写成 release notes 卖点（intake clowder-ai#540），用户期待已经形成
- 当前 `desktop/package.json` win target 是 `dir`（出文件夹），不是 `nsis`（出 .exe 安装包），实际产物配置错位
- 没有任何 GitHub Actions workflow 触发跨平台 build，pipeline 只是声明
- 历史所有 release（v0.5/v0.6/v0.7/v0.8/v0.9）都是 zero assets，这个缺口拖到 v0.10.0 才补会进一步累积期待

## What

> Phase A 先做基础设施，Phase B 用 v0.9.1 验证。Phase A 完成 + B 通过 = feat done。

### Phase A: Pipeline 基础设施

**A1. desktop 配置修正**
- `desktop/package.json` `build.win.target` 从 `"dir"` 改为 `"nsis"`（产 .exe）
- 确认 `assets/icon.ico` / `assets/icon.icns` 存在；不存在则生成
- 增加 `dist:win` script（对称 `dist:mac`）：`electron-builder --win nsis --x64`

**A2. GitHub Actions release workflow**
- 文件：`.github/workflows/release-desktop.yml`
- 触发条件：`on.release.types = [published]`（GitHub release 创建后触发）
- Matrix：`{os: [windows-latest, macos-latest]}`
- 步骤：checkout → setup pnpm → install → build runtime → desktop dist → upload to release assets
- 产物命名：`CatCafe-${version}-${arch}.${ext}`（已对齐 electron-builder artifactName）
- 签名暂跳过：`identity: null` (mac) / 不配 win cert（无证书）—— 在 release notes 注明"未签名，首次启动需手动放行"

**A3. opensource-ops skill 加 Release Asset Gate**
- 在 `cat-cafe-skills/refs/opensource-ops-outbound-sync.md` 加章节：发 release 前必须确认 assets workflow 已触发并完成；release publish 后 watch 一次 workflow run 状态

**A4. Self-build 临时止血**
- 在 v0.9.0 release notes 末尾加一行 forward pointer：`> Installer assets coming in v0.9.1.`
- clowder-ai 开 pinned issue《Self-build desktop installer until v0.9.1》给完整本地 build 步骤

### Phase B: v0.9.1 验证

**B1. 触发 v0.9.1 release**
- cat-cafe 起 chore PR 升 desktop/package.json version（0.2.0 → 0.9.1 对齐 release tag），sync 到 clowder-ai
- 在 clowder-ai 创建 v0.9.1 release（empty payload，主要是验证 pipeline）
- workflow 自动触发 → upload assets

**B2. 验收**
- v0.9.1 release page assets 列表包含：
  - `CatCafe-0.9.1-arm64.dmg`（mac arm64）
  - `CatCafe-0.9.1-x64.dmg`（mac intel）
  - `CatCafe-0.9.1-x64.exe`（win x64）
- 至少一只猫（非作者 + 非 reviewer）下载 dmg/exe 在自己机器上能装能跑

## Acceptance Criteria

### Phase A
- [ ] AC-A1: `desktop/package.json` `build.win.target` = `nsis`
- [ ] AC-A2: 本地（Mac）跑 `pnpm --filter cat-cafe-desktop dist:mac` 能产 dmg
- [ ] AC-A3: `.github/workflows/release-desktop.yml` 存在，触发条件正确
- [ ] AC-A4: workflow 在 macos-latest + windows-latest 上 build 成功（用一次手动 dispatch 或 dry-run release 验证）
- [ ] AC-A5: build artifacts 自动 upload 到 release assets
- [ ] AC-A6: `cat-cafe-skills/refs/opensource-ops-outbound-sync.md` 加 "Release Asset Gate" 章节
- [ ] AC-A7: v0.9.0 release notes 加 forward pointer + clowder-ai 开 pinned self-build issue

### Phase B
- [ ] AC-B1: v0.9.1 release 创建后，workflow 触发成功
- [ ] AC-B2: v0.9.1 release page 含 mac dmg (arm64+x64) + win exe (x64) 共 3 个 assets
- [ ] AC-B3: 跨猫验证（非作者非 reviewer）能下载并启动安装包

## Dependencies

- 无强依赖。`bundled/deploy/{api,web,mcp-server}` 是 desktop dist 的 extraResources 来源，需要 release workflow 在 desktop dist 之前 build 出来

## Open Questions

- **OQ-1**: 是否需要代码签名（Win cert / Mac notarization）？
  - 当前提议：v0.9.1 不签名（"unsigned, manual approve on first launch"），后续 feature 单独立项处理签名
- **OQ-2**: macOS Intel (x64) 是否仍需要支持？2026 年 Mac 主流是 arm64
  - 当前提议：保留两个 dmg（arm64 + x64），与 `desktop/package.json` 现有配置一致
- **OQ-3**: workflow 失败时的 fallback？
  - 当前提议：失败发 GitHub notification，铲屎官手动重跑或本地 build upload

## Links

- 触发讨论：thread `发版本守护` (2026-04-27 ~ 2026-04-28)
- 相关：[F124-apple-ecosystem.md](F124-apple-ecosystem.md)（独立的 iOS/watchOS 生态，不冲突）
- 相关：clowder-ai#540（Electron Desktop Shell intake，2026-04-23）
- 相关：v0.9.0 release notes（提到 desktop pipeline 但未投递）

## Timeline

- 2026-04-28: kickoff（社区反馈触发，铲屎官当晚拍板基础设施先行）
