---
feature_ids: [F051]
topics: [swiftbar, menubar, quota, phase4]
doc_kind: guide
created: 2026-03-03
updated: 2026-03-03
---

# F051 Phase 4 — SwiftBar 菜单栏接入指南

## 目标

把 `猫粮摘要` 放进 macOS 菜单栏，做到“不进 Hub 也能看状态”。

插件脚本：`scripts/swiftbar/cat-cafe-quota.1m.sh`

## 依赖

1. 安装 SwiftBar（或 xbar）
2. 安装 `jq`

```bash
brew install --cask swiftbar
brew install jq
```

## 安装步骤

1. 打开 SwiftBar 插件目录（SwiftBar > Open Plugins Folder）
2. 在仓库根目录执行，链接脚本到插件目录：

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
ln -sf "${REPO_ROOT}/scripts/swiftbar/cat-cafe-quota.1m.sh" \
  "${HOME}/Library/Application Support/SwiftBar/Plugins/cat-cafe-quota.1m.sh"
```

如果不是在仓库目录执行，请把 `${REPO_ROOT}` 手动替换成你本机的仓库绝对路径。

3. 点 SwiftBar 的 `Refresh All`

## 可选环境变量

```bash
export CAT_CAFE_API_URL="http://127.0.0.1:3002"
export CAT_CAFE_WEB_URL="http://127.0.0.1:3000/widget/quota"
export CAT_CAFE_HUB_URL="http://127.0.0.1:3000"
export CAT_CAFE_TIMEOUT_SECONDS="4"
```

## 说明

- 菜单栏顶部显示 `风险级别 + 最大利用率`
- 下拉菜单显示三平台摘要、风险原因、探针状态
- 支持一键触发：
  - `POST /api/quota/refresh/official`
  - `POST /api/quota/refresh/claude`

## 故障排查

- 顶部显示 `离线`：检查 API 是否启动（`http://127.0.0.1:3002/health`）
- 显示 `缺少 jq`：安装 `jq` 后刷新插件
- 刷新官方额度失败：先在 Hub 中确认官方探针开关已启用，并完成官方页面登录
